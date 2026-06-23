import {
  Injectable,
  Logger,
  NotFoundException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateFeatureDto, ReanalyzeDto } from './dto/update-feature.dto';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

interface AiEngineFeature {
  type: string;
  value?: number;
  unit?: string;
  tolerance?: number;
  toleranceType?: string;
  tolerancePlus?: number;
  toleranceMinus?: number;
  confidence: number;
  position?: { x: number; y: number; width: number; height: number };
  label?: string;
  metadata?: Record<string, any>;
}

interface AiEngineResponse {
  planId: string;
  rawOcrData: Record<string, any>;
  features: AiEngineFeature[];
  processingTimeMs: number;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Main Orchestrator ────────────────────────────────────────────────────

  /**
   * Full analysis pipeline:
   *  1. Mark plan as PROCESSING
   *  2. POST file to Python AI engine
   *  3. Parse returned features and upsert to DB
   *  4. Trigger geometry reconstruction
   *  5. Trigger machining operation generation
   *  6. Mark plan COMPLETED (or FAILED)
   */
  async runAnalysis(planId: string, filePath: string): Promise<void> {
    this.logger.log(`Starting analysis for plan ${planId}`);

    await this.updatePlanStatus(planId, 'PROCESSING', 5);

    try {
      // Step 1: Send to AI engine
      await this.updatePlanStatus(planId, 'PROCESSING', 10);
      const aiResult = await this.callAiEngine(planId, filePath);

      // Step 2: Persist OCR data
      await this.updatePlanStatus(planId, 'PROCESSING', 40);
      await this.prisma.plan.update({
        where: { id: planId },
        data: { rawOcrData: aiResult.rawOcrData },
      });

      // Step 3: Persist detected features
      await this.updatePlanStatus(planId, 'PROCESSING', 55);
      await this.saveFeatures(planId, aiResult.features);

      // Step 4: Trigger geometry reconstruction
      await this.updatePlanStatus(planId, 'PROCESSING', 70);
      const plan = await this.prisma.plan.findUnique({
        where: { id: planId },
        select: { projectId: true },
      });
      if (plan) {
        await this.reconstructGeometry(plan.projectId, planId, aiResult.features);
      }

      // Step 5: Trigger machining operation generation
      await this.updatePlanStatus(planId, 'PROCESSING', 85);
      if (plan) {
        await this.generateMachiningOperations(plan.projectId, planId, aiResult.features);
      }

      // Step 6: Done
      await this.updatePlanStatus(planId, 'COMPLETED', 100);
      this.logger.log(`Analysis completed for plan ${planId}`);

      // Update project status if all plans are done
      if (plan) {
        await this.checkAndUpdateProjectStatus(plan.projectId);
      }
    } catch (error) {
      this.logger.error(`Analysis failed for plan ${planId}: ${error.message}`, error.stack);
      await this.prisma.plan.update({
        where: { id: planId },
        data: {
          analysisStatus: 'FAILED',
          analysisError: error.message,
          analysisProgress: 0,
        },
      });
    }
  }

  // ─── AI Engine Communication ───────────────────────────────────────────────

  private async callAiEngine(planId: string, filePath: string): Promise<AiEngineResponse> {
    const aiUrl = this.configService.get<string>('aiEngine.url');
    const apiKey = this.configService.get<string>('aiEngine.apiKey');
    const timeoutMs = this.configService.get<number>('aiEngine.timeoutMs');

    this.logger.log(`Calling AI engine at ${aiUrl}/analyze for plan ${planId}`);

    try {
      // Build a multipart/form-data request to the Python service
      const fileContent = fs.readFileSync(filePath);
      const filename = path.basename(filePath);
      const boundary = `----MathV2Boundary${Date.now()}`;

      const bodyParts: Buffer[] = [];
      bodyParts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${planId}\r\n`,
        ),
      );
      bodyParts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
        ),
      );
      bodyParts.push(fileContent);
      bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const body = Buffer.concat(bodyParts);

      const response = await this.httpPost(
        `${aiUrl}/analyze`,
        body,
        {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length.toString(),
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
        timeoutMs,
      );

      return JSON.parse(response) as AiEngineResponse;
    } catch (error) {
      this.logger.error(`AI engine call failed: ${error.message}`);
      // In development/demo mode, return a mock response so the pipeline keeps working
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn('AI engine unavailable — using mock response for development');
        return this.mockAiResponse(planId);
      }
      throw new BadGatewayException(`AI engine unavailable: ${error.message}`);
    }
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
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const data = Buffer.concat(chunks).toString('utf-8');
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`AI engine returned status ${res.statusCode}: ${data}`));
            }
          });
        },
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`AI engine request timed out after ${timeoutMs}ms`));
      });

      req.write(body);
      req.end();
    });
  }

  // ─── Feature Persistence ──────────────────────────────────────────────────

  private async saveFeatures(planId: string, features: AiEngineFeature[]) {
    // Clear old features first to allow re-analysis
    await this.prisma.detectedFeature.deleteMany({ where: { planId } });

    if (!features?.length) return;

    await this.prisma.detectedFeature.createMany({
      data: features.map((f) => ({
        planId,
        type: this.mapFeatureType(f.type),
        value: f.value ?? null,
        unit: f.unit ?? null,
        tolerance: f.tolerance ?? null,
        toleranceType: f.toleranceType
          ? this.mapToleranceType(f.toleranceType)
          : null,
        tolerancePlus: f.tolerancePlus ?? null,
        toleranceMinus: f.toleranceMinus ?? null,
        confidence: f.confidence ?? 1.0,
        position: f.position ?? null,
        label: f.label ?? null,
        metadata: f.metadata ?? null,
      })),
    });

    this.logger.log(`Saved ${features.length} features for plan ${planId}`);
  }

  // ─── Geometry Reconstruction ───────────────────────────────────────────────

  private async reconstructGeometry(
    projectId: string,
    planId: string,
    features: AiEngineFeature[],
  ) {
    this.logger.log(`Reconstructing 3D geometry for project ${projectId}`);

    // Build a simple bounding box from features for demonstration
    // In production this calls the geometry engine
    const holes = features.filter((f) => f.type === 'HOLE' && f.value);
    const slots = features.filter((f) => f.type === 'SLOT' && f.value);

    const estimatedWidth = 100 + (holes.length * 10);
    const estimatedHeight = 50 + (slots.length * 5);
    const estimatedDepth = 20;

    const volume = estimatedWidth * estimatedHeight * estimatedDepth;
    const surfaceArea = 2 * (
      estimatedWidth * estimatedHeight +
      estimatedWidth * estimatedDepth +
      estimatedHeight * estimatedDepth
    );

    await this.prisma.model3D.create({
      data: {
        projectId,
        planId,
        geometryData: {
          type: 'bounding_box_estimate',
          features: features.length,
          note: 'Geometry estimated from detected features. Replace with full CAD engine output.',
        },
        boundingBox: {
          minX: 0, minY: 0, minZ: 0,
          maxX: estimatedWidth,
          maxY: estimatedHeight,
          maxZ: estimatedDepth,
        },
        volume,
        surfaceArea,
        units: 'mm',
      },
    });
  }

  // ─── Machining Operation Generation ───────────────────────────────────────

  private async generateMachiningOperations(
    projectId: string,
    planId: string,
    features: AiEngineFeature[],
  ) {
    this.logger.log(`Generating machining operations for project ${projectId}`);

    const operations: any[] = [];
    let sequence = 1;

    // Center drilling first (always first op)
    const holes = features.filter((f) =>
      ['HOLE', 'THREAD'].includes(f.type) && f.confidence > 0.5,
    );

    if (holes.length > 0) {
      operations.push({
        projectId,
        operationType: 'DRILLING',
        toolType: 'CENTER_DRILL',
        toolDiameter: 3.0,
        depth: 3.0,
        feedRate: 80,
        spindleSpeed: 1500,
        sequence: sequence++,
        estimatedTime: holes.length * 30,
        status: 'pending',
        notes: 'Center drill all hole positions',
      });
    }

    // Hole drilling
    for (const hole of holes) {
      const diameter = hole.value ?? 10;
      const isThread = hole.type === 'THREAD';

      operations.push({
        projectId,
        operationType: isThread ? 'TAPPING' : 'DRILLING',
        toolType: isThread ? 'TAP' : 'DRILL',
        toolDiameter: diameter,
        depth: hole.metadata?.depth ?? diameter * 2.5,
        feedRate: isThread ? (diameter * 1.0) * 300 : 150,  // thread: pitch * rpm
        spindleSpeed: isThread ? 300 : Math.round(25000 / diameter),
        sequence: sequence++,
        estimatedTime: 45,
        status: 'pending',
        notes: `${isThread ? 'Thread' : 'Drill'} Ø${diameter}${hole.unit ?? 'mm'}${
          hole.tolerance ? ` ±${hole.tolerance}` : ''
        }`,
      });
    }

    // Pocket milling
    const pockets = features.filter((f) => f.type === 'POCKET' && f.confidence > 0.5);
    for (const pocket of pockets) {
      operations.push({
        projectId,
        operationType: 'MILLING_POCKET',
        toolType: 'END_MILL',
        toolDiameter: 10,
        depth: pocket.value ?? 5,
        width: pocket.metadata?.width ?? 20,
        feedRate: 300,
        spindleSpeed: 2500,
        stepover: 6,
        stepdown: 2,
        sequence: sequence++,
        estimatedTime: 120,
        status: 'pending',
        notes: `Pocket milling ${pocket.label ?? ''}`,
      });
    }

    // Slot milling
    const slots = features.filter((f) => f.type === 'SLOT' && f.confidence > 0.5);
    for (const slot of slots) {
      const width = slot.value ?? 8;
      operations.push({
        projectId,
        operationType: 'MILLING_SLOT',
        toolType: 'END_MILL',
        toolDiameter: width * 0.8,
        depth: slot.metadata?.depth ?? width,
        width,
        feedRate: 200,
        spindleSpeed: 3000,
        stepdown: width * 0.4,
        sequence: sequence++,
        estimatedTime: 90,
        status: 'pending',
        notes: `Slot ${slot.label ?? ''} W${width}mm`,
      });
    }

    // Face milling (always last for surface finish)
    operations.push({
      projectId,
      operationType: 'MILLING_FACE',
      toolType: 'FACE_MILL',
      toolDiameter: 63,
      depth: 0.5,
      feedRate: 500,
      spindleSpeed: 1200,
      stepover: 50,
      sequence: sequence++,
      estimatedTime: 60,
      status: 'pending',
      notes: 'Finish face milling - top surface',
    });

    if (operations.length > 0) {
      await this.prisma.machiningOperation.createMany({ data: operations });
      this.logger.log(
        `Generated ${operations.length} machining operations for project ${projectId}`,
      );
    }
  }

  // ─── Analysis Result Accessors ─────────────────────────────────────────────

  async getAnalysis(planId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: {
        detectedFeatures: { orderBy: { confidence: 'desc' } },
        project: { select: { id: true, name: true } },
      },
    });

    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    return {
      planId: plan.id,
      projectId: plan.projectId,
      projectName: plan.project.name,
      filename: plan.originalFilename,
      fileType: plan.fileType,
      analysisStatus: plan.analysisStatus,
      analysisProgress: plan.analysisProgress,
      analysisError: plan.analysisError,
      rawOcrData: plan.rawOcrData,
      features: plan.detectedFeatures,
      featureCount: plan.detectedFeatures.length,
      featuresByType: this.groupByType(plan.detectedFeatures),
    };
  }

  async reanalyze(planId: string, _dto: ReanalyzeDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    const uploadDir =
      this.configService.get<string>('upload.destination') || './uploads';
    const filePath = path.join(uploadDir, plan.filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Original file not found for plan ${planId}`);
    }

    // Reset status
    await this.prisma.plan.update({
      where: { id: planId },
      data: { analysisStatus: 'PENDING', analysisProgress: 0, analysisError: null },
    });

    // Fire off async
    this.runAnalysis(planId, filePath).catch((err) =>
      this.logger.error(`Re-analysis failed for plan ${planId}: ${err.message}`),
    );

    return {
      planId,
      message: 'Re-analysis started in background',
      analysisStatus: 'PENDING',
    };
  }

  async updateFeature(featureId: string, dto: UpdateFeatureDto) {
    const feature = await this.prisma.detectedFeature.findUnique({
      where: { id: featureId },
    });

    if (!feature) throw new NotFoundException(`Feature ${featureId} not found`);

    return this.prisma.detectedFeature.update({
      where: { id: featureId },
      data: { ...dto, isVerified: dto.isVerified ?? true },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async updatePlanStatus(
    planId: string,
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
    progress: number,
  ) {
    await this.prisma.plan.update({
      where: { id: planId },
      data: { analysisStatus: status, analysisProgress: progress },
    });
  }

  private async checkAndUpdateProjectStatus(projectId: string) {
    const [totalPlans, pendingOrProcessing] = await this.prisma.$transaction([
      this.prisma.plan.count({ where: { projectId } }),
      this.prisma.plan.count({
        where: { projectId, analysisStatus: { in: ['PENDING', 'PROCESSING'] } },
      }),
    ]);

    if (totalPlans > 0 && pendingOrProcessing === 0) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'ANALYZED' },
      });
    }
  }

  private mapFeatureType(type: string): any {
    const map: Record<string, string> = {
      hole: 'HOLE',
      slot: 'SLOT',
      pocket: 'POCKET',
      boss: 'BOSS',
      thread: 'THREAD',
      chamfer: 'CHAMFER',
      fillet: 'FILLET',
      surface: 'SURFACE',
      contour: 'CONTOUR',
      dimension: 'DIMENSION',
      tolerance: 'TOLERANCE',
      note: 'NOTE',
    };
    return map[type?.toLowerCase()] ?? 'UNKNOWN';
  }

  private mapToleranceType(type: string): any {
    const map: Record<string, string> = {
      linear: 'LINEAR',
      angular: 'ANGULAR',
      geometric: 'GEOMETRIC',
      surface_finish: 'SURFACE_FINISH',
    };
    return map[type?.toLowerCase()] ?? 'LINEAR';
  }

  private groupByType(features: any[]): Record<string, number> {
    return features.reduce((acc, f) => {
      acc[f.type] = (acc[f.type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private mockAiResponse(planId: string): AiEngineResponse {
    return {
      planId,
      processingTimeMs: 1200,
      rawOcrData: {
        text: 'MOCK OCR OUTPUT\nDiameter: Ø12.5 ±0.02\nDepth: 25mm\nThread: M8x1.25',
        confidence: 0.85,
      },
      features: [
        {
          type: 'HOLE',
          value: 12.5,
          unit: 'mm',
          tolerance: 0.02,
          toleranceType: 'LINEAR',
          tolerancePlus: 0.02,
          toleranceMinus: -0.02,
          confidence: 0.92,
          label: 'Main bore Ø12.5',
          position: { x: 120, y: 80, width: 30, height: 30 },
          metadata: { depth: 25, qty: 4 },
        },
        {
          type: 'THREAD',
          value: 8,
          unit: 'mm',
          confidence: 0.88,
          label: 'M8x1.25 thread',
          position: { x: 200, y: 150, width: 20, height: 20 },
          metadata: { pitch: 1.25, depth: 15 },
        },
        {
          type: 'POCKET',
          value: 5,
          unit: 'mm',
          confidence: 0.75,
          label: 'Center pocket',
          position: { x: 60, y: 60, width: 80, height: 60 },
          metadata: { width: 30, length: 50 },
        },
        {
          type: 'DIMENSION',
          value: 100,
          unit: 'mm',
          confidence: 0.98,
          label: 'Overall length',
          position: { x: 10, y: 280, width: 200, height: 10 },
        },
        {
          type: 'DIMENSION',
          value: 60,
          unit: 'mm',
          confidence: 0.97,
          label: 'Overall width',
          position: { x: 220, y: 50, width: 10, height: 150 },
        },
      ],
    };
  }
}
