import {
  Injectable,
  Logger,
  NotFoundException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';

type ControllerType = 'FANUC' | 'SIEMENS' | 'HEIDENHAIN' | 'HAAS' | 'MITSUBISHI' | 'OKUMA' | 'MAZAK';

interface GcodeEngineRequest {
  projectId: string;
  controller: ControllerType;
  operations: any[];
  material?: any;
  workOffset?: string; // G54, G55, etc.
  units?: 'mm' | 'inch';
}

interface GcodeEngineResponse {
  gcode: string;
  estimatedTime: number;   // seconds
  toolCount: number;
  lineCount: number;
  validationErrors?: { line: number; code: string; message: string }[];
}

@Injectable()
export class GcodeService {
  private readonly logger = new Logger(GcodeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Get / Generate ───────────────────────────────────────────────────────

  async getOrGenerate(projectId: string, controller: ControllerType = 'FANUC') {
    // Return the most recent cached program for this controller if it exists
    const existing = await this.prisma.cNCProgram.findFirst({
      where: { projectId, controller },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) return existing;

    // Nothing cached — generate
    return this.generateGcode(projectId, controller);
  }

  async generateGcode(projectId: string, controller: ControllerType = 'FANUC') {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const operations = await this.prisma.machiningOperation.findMany({
      where: { projectId, status: { not: 'skipped' } },
      include: { material: true },
      orderBy: { sequence: 'asc' },
    });

    if (operations.length === 0) {
      throw new NotFoundException(
        `No machining operations found for project ${projectId}. ` +
          'Run plan analysis first to generate operations.',
      );
    }

    // Update project status
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'GENERATING_GCODE' },
    });

    let result: GcodeEngineResponse;

    try {
      result = await this.callGcodeEngine({
        projectId,
        controller,
        operations,
        units: 'mm',
        workOffset: 'G54',
      });
    } catch (err) {
      this.logger.warn(
        `G-code engine unavailable (${err.message}), using built-in generator`,
      );
      result = this.generateGcodeLocally(operations, controller, project.name);
    }

    const gcodeHash = crypto
      .createHash('sha256')
      .update(result.gcode)
      .digest('hex');

    const program = await this.prisma.cNCProgram.create({
      data: {
        projectId,
        controller,
        gcode: result.gcode,
        gcodeHash,
        validated: (result.validationErrors?.length ?? 0) === 0,
        validationErrors: result.validationErrors ?? [],
        lineCount: result.lineCount,
        estimatedTime: result.estimatedTime,
        toolCount: result.toolCount,
      },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'READY' },
    });

    this.logger.log(
      `G-code generated for project ${projectId} (${controller}): ` +
        `${result.lineCount} lines, ~${Math.round(result.estimatedTime / 60)} min`,
    );

    return program;
  }

  async regenerate(projectId: string, controller: ControllerType = 'FANUC') {
    // Delete existing program for this controller and regenerate
    await this.prisma.cNCProgram.deleteMany({ where: { projectId, controller } });
    return this.generateGcode(projectId, controller);
  }

  async listPrograms(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    return this.prisma.cNCProgram.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        controller: true,
        validated: true,
        validationErrors: true,
        lineCount: true,
        estimatedTime: true,
        toolCount: true,
        gcodeHash: true,
        createdAt: true,
      },
    });
  }

  // ─── G-Code Engine HTTP Call ──────────────────────────────────────────────

  private async callGcodeEngine(req: GcodeEngineRequest): Promise<GcodeEngineResponse> {
    const engineUrl = this.configService.get<string>('gcodeEngine.url');
    const apiKey = this.configService.get<string>('gcodeEngine.apiKey');
    const timeoutMs = this.configService.get<number>('gcodeEngine.timeoutMs');

    const body = Buffer.from(JSON.stringify(req), 'utf-8');

    const responseText = await this.httpPost(
      `${engineUrl}/generate`,
      body,
      {
        'Content-Type': 'application/json',
        'Content-Length': body.length.toString(),
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      timeoutMs,
    );

    return JSON.parse(responseText) as GcodeEngineResponse;
  }

  private httpPost(
    url: string,
    body: Buffer,
    headers: Record<string, string>,
    timeoutMs: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const lib = parsedUrl.protocol === 'https:' ? https : http;

      const req = lib.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers,
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const data = Buffer.concat(chunks).toString('utf-8');
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`G-code engine HTTP ${res.statusCode}: ${data}`));
            }
          });
        },
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`G-code engine timed out after ${timeoutMs}ms`));
      });

      req.write(body);
      req.end();
    });
  }

  // ─── Built-in G-Code Generator (fallback) ────────────────────────────────

  private generateGcodeLocally(
    operations: any[],
    controller: ControllerType,
    projectName: string,
  ): GcodeEngineResponse {
    const lines: string[] = [];
    const toolChanges = new Set<number>();
    let estimatedTime = 0;

    // Program header
    if (controller === 'FANUC' || controller === 'HAAS') {
      lines.push(`%`);
      lines.push(`O0001 (${projectName.toUpperCase().replace(/[^A-Z0-9 ]/g, '')})`);
    } else if (controller === 'SIEMENS') {
      lines.push(`; ${projectName}`);
      lines.push(`; Generated by MathV2 CAD/CAM`);
    } else if (controller === 'HEIDENHAIN') {
      lines.push(`0 BEGIN PGM ${projectName.replace(/\s/g, '_')} MM`);
    }

    lines.push(`(Generated by MathV2 CAD/CAM - ${new Date().toISOString()})`);
    lines.push(`(Controller: ${controller})`);
    lines.push(`(Operations: ${operations.length})`);
    lines.push(``);

    // Safety / preamble
    lines.push(`G17 G40 G49 G80 G90 (Safety line)`);
    lines.push(`G21 (Metric mode)`);
    lines.push(`G54 (Work offset)`);
    lines.push(``);

    let toolNumber = 1;
    const toolMap = new Map<string, number>();

    for (const op of operations) {
      const toolKey = `${op.toolType}_${op.toolDiameter}`;
      if (!toolMap.has(toolKey)) {
        toolMap.set(toolKey, toolNumber++);
      }

      const tNum = toolMap.get(toolKey);
      const tStr = `T${String(tNum).padStart(2, '0')}`;
      toolChanges.add(tNum);

      lines.push(`(--- OP ${op.sequence}: ${op.operationType} ---)`);
      lines.push(`(Tool: ${op.toolType} Ø${op.toolDiameter}mm)`);

      lines.push(`${tStr} M06 (Tool change)`);
      lines.push(`G43 H${String(tNum).padStart(2, '0')} (Tool length compensation)`);
      lines.push(`S${op.spindleSpeed} M03 (Spindle CW)`);
      lines.push(`G00 X0. Y0. (Rapid to start position)`);
      lines.push(`G00 Z50. (Safe height)`);
      lines.push(`M08 (Coolant on)`);
      lines.push(``);

      switch (op.operationType) {
        case 'DRILLING':
        case 'REAMING':
        case 'BORING': {
          const depth = op.depth ?? 20;
          lines.push(
            `G81 X0. Y0. Z-${depth.toFixed(3)} R2. F${op.feedRate} (Drilling cycle)`,
          );
          lines.push(`G80 (Cancel canned cycle)`);
          break;
        }
        case 'TAPPING': {
          const pitch = 1.0; // Default pitch
          lines.push(
            `G84 X0. Y0. Z-${(op.depth ?? 15).toFixed(3)} R2. F${(op.spindleSpeed * pitch).toFixed(0)} (Tapping cycle)`,
          );
          lines.push(`G80 (Cancel canned cycle)`);
          break;
        }
        case 'MILLING_FACE': {
          const depth = op.depth ?? 0.5;
          const step = op.stepover ?? 50;
          lines.push(`G00 X-${(op.toolDiameter / 2 + 5).toFixed(3)} Y0.`);
          lines.push(`G00 Z2.`);
          lines.push(`G01 Z-${depth.toFixed(3)} F${(op.feedRate * 0.3).toFixed(0)}`);
          lines.push(`G01 X${(100 + op.toolDiameter / 2 + 5).toFixed(3)} F${op.feedRate}`);
          lines.push(`G00 Z50.`);
          break;
        }
        case 'MILLING_POCKET': {
          const depth = op.depth ?? 5;
          const width = op.width ?? 30;
          const stepdown = op.stepdown ?? 2;
          const passes = Math.ceil(depth / stepdown);
          for (let i = 1; i <= passes; i++) {
            const z = Math.min(i * stepdown, depth);
            lines.push(`(Pocket pass ${i}/${passes}, Z-${z.toFixed(3)})`);
            lines.push(`G00 X0. Y0.`);
            lines.push(`G01 Z-${z.toFixed(3)} F${(op.feedRate * 0.5).toFixed(0)}`);
            lines.push(
              `G01 X${(width).toFixed(3)} F${op.feedRate}`,
            );
            lines.push(`G01 Y${(width * 0.6).toFixed(3)}`);
            lines.push(`G01 X0.`);
            lines.push(`G01 Y0.`);
          }
          break;
        }
        case 'MILLING_SLOT': {
          const depth = op.depth ?? 8;
          const stepdown = op.stepdown ?? depth / 2;
          const passes = Math.ceil(depth / stepdown);
          for (let i = 1; i <= passes; i++) {
            const z = Math.min(i * stepdown, depth);
            lines.push(`G00 X0. Y0.`);
            lines.push(`G01 Z-${z.toFixed(3)} F${(op.feedRate * 0.5).toFixed(0)}`);
            lines.push(`G01 X50. F${op.feedRate} (Slot cut)`);
          }
          break;
        }
        default: {
          lines.push(`(Operation ${op.operationType} - manual programming required)`);
        }
      }

      lines.push(`G00 Z50. (Retract)`);
      lines.push(`M09 (Coolant off)`);
      lines.push(``);

      estimatedTime += op.estimatedTime ?? 60;
    }

    // Program footer
    lines.push(`G00 Z100. (Safe height)`);
    lines.push(`G28 G91 Z0. (Machine zero Z)`);
    lines.push(`G28 X0. Y0. (Machine zero XY)`);
    lines.push(`G90`);
    lines.push(`M05 (Spindle stop)`);
    lines.push(`M30 (Program end)`);

    if (controller === 'FANUC' || controller === 'HAAS') {
      lines.push(`%`);
    } else if (controller === 'HEIDENHAIN') {
      lines.push(`END PGM ${projectName.replace(/\s/g, '_')} MM`);
    }

    const gcode = lines.join('\n');

    return {
      gcode,
      estimatedTime,
      toolCount: toolChanges.size,
      lineCount: lines.length,
      validationErrors: [],
    };
  }
}
