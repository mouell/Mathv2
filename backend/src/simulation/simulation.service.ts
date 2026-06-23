import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface SimulationOptions {
  programId?: string;
  speed?: number;      // playback speed multiplier (1 = realtime)
  resolution?: number; // mesh resolution 1-10
}

@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);

  // In-memory store of running simulation timers (projectId -> timer handle)
  private readonly runningSimulations = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Start ────────────────────────────────────────────────────────────────

  async startSimulation(projectId: string, options: SimulationOptions = {}) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    // Check if already running
    const activeSimulation = await this.prisma.simulation.findFirst({
      where: { projectId, status: 'RUNNING' },
    });

    if (activeSimulation) {
      throw new ConflictException(
        `A simulation is already running for project ${projectId} (id: ${activeSimulation.id})`,
      );
    }

    // Resolve program
    let programId = options.programId;
    if (!programId) {
      const latestProgram = await this.prisma.cNCProgram.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });
      if (!latestProgram) {
        throw new NotFoundException(
          `No G-code program found for project ${projectId}. Generate G-code first.`,
        );
      }
      programId = latestProgram.id;
    }

    const program = await this.prisma.cNCProgram.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException(`Program ${programId} not found`);

    // Parse toolpath from the G-code
    const toolpathData = this.parseToolpath(program.gcode);

    const simulation = await this.prisma.simulation.create({
      data: {
        projectId,
        programId,
        status: 'RUNNING',
        toolpathData,
        progress: 0,
      },
    });

    this.logger.log(`Simulation ${simulation.id} started for project ${projectId}`);

    // Simulate progress asynchronously
    this.simulateProgress(simulation.id, toolpathData.segments?.length ?? 100, options.speed ?? 1);

    return {
      simulationId: simulation.id,
      projectId,
      programId,
      status: 'RUNNING',
      message: 'Simulation started',
      segmentCount: toolpathData.segments?.length ?? 0,
    };
  }

  // ─── State ────────────────────────────────────────────────────────────────

  async getState(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const simulation = await this.prisma.simulation.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        program: {
          select: {
            id: true,
            controller: true,
            estimatedTime: true,
            toolCount: true,
            lineCount: true,
          },
        },
      },
    });

    if (!simulation) {
      return {
        projectId,
        status: 'IDLE',
        message: 'No simulation has been run for this project yet',
      };
    }

    return {
      simulationId: simulation.id,
      projectId,
      status: simulation.status,
      progress: simulation.progress,
      toolpathSegments: simulation.toolpathData
        ? (simulation.toolpathData as any).segments?.length ?? 0
        : 0,
      collisions: simulation.collisions,
      materialRemoved: simulation.materialRemoved,
      errorMessage: simulation.errorMessage,
      program: simulation.program,
      createdAt: simulation.createdAt,
      updatedAt: simulation.updatedAt,
    };
  }

  // ─── Pause / Resume / Stop ────────────────────────────────────────────────

  async pauseSimulation(projectId: string) {
    const simulation = await this.prisma.simulation.findFirst({
      where: { projectId, status: 'RUNNING' },
    });

    if (!simulation) {
      throw new NotFoundException(`No running simulation found for project ${projectId}`);
    }

    // Cancel async timer
    const timer = this.runningSimulations.get(simulation.id);
    if (timer) {
      clearInterval(timer);
      this.runningSimulations.delete(simulation.id);
    }

    return this.prisma.simulation.update({
      where: { id: simulation.id },
      data: { status: 'PAUSED' },
    });
  }

  async resumeSimulation(projectId: string) {
    const simulation = await this.prisma.simulation.findFirst({
      where: { projectId, status: 'PAUSED' },
      include: { program: true },
    });

    if (!simulation) {
      throw new NotFoundException(`No paused simulation found for project ${projectId}`);
    }

    await this.prisma.simulation.update({
      where: { id: simulation.id },
      data: { status: 'RUNNING' },
    });

    const remaining = 100 - simulation.progress;
    this.simulateProgress(simulation.id, remaining, 1);

    return { simulationId: simulation.id, status: 'RUNNING', progress: simulation.progress };
  }

  async stopSimulation(projectId: string) {
    const simulation = await this.prisma.simulation.findFirst({
      where: { projectId, status: { in: ['RUNNING', 'PAUSED'] } },
    });

    if (!simulation) {
      throw new NotFoundException(`No active simulation found for project ${projectId}`);
    }

    const timer = this.runningSimulations.get(simulation.id);
    if (timer) {
      clearInterval(timer);
      this.runningSimulations.delete(simulation.id);
    }

    return this.prisma.simulation.update({
      where: { id: simulation.id },
      data: { status: 'IDLE', progress: 0 },
    });
  }

  async listSimulations(projectId: string) {
    return this.prisma.simulation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        program: {
          select: { id: true, controller: true },
        },
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Parse G-code into a series of toolpath segments for 3D visualization.
   * In production, this calls a dedicated geometry kernel; here we produce
   * a structured representation from the G-code text.
   */
  private parseToolpath(gcode: string): any {
    const lines = gcode.split('\n').filter((l) => l.trim() && !l.startsWith('('));
    const segments: any[] = [];

    let x = 0, y = 0, z = 50;
    let feedRate = 0;
    let isRapid = false;

    for (const line of lines) {
      const upperLine = line.toUpperCase();

      if (upperLine.includes('G00')) isRapid = true;
      else if (upperLine.includes('G01') || upperLine.includes('G02') || upperLine.includes('G03')) {
        isRapid = false;
      }

      const xMatch = upperLine.match(/X(-?\d+\.?\d*)/);
      const yMatch = upperLine.match(/Y(-?\d+\.?\d*)/);
      const zMatch = upperLine.match(/Z(-?\d+\.?\d*)/);
      const fMatch = upperLine.match(/F(\d+\.?\d*)/);

      if (fMatch) feedRate = parseFloat(fMatch[1]);

      const newX = xMatch ? parseFloat(xMatch[1]) : x;
      const newY = yMatch ? parseFloat(yMatch[1]) : y;
      const newZ = zMatch ? parseFloat(zMatch[1]) : z;

      if (newX !== x || newY !== y || newZ !== z) {
        segments.push({
          from: { x, y, z },
          to: { x: newX, y: newY, z: newZ },
          type: isRapid ? 'rapid' : 'cut',
          feedRate,
        });
        x = newX;
        y = newY;
        z = newZ;
      }
    }

    return {
      segments,
      totalDistance: segments.reduce((acc, s) => {
        const dx = s.to.x - s.from.x;
        const dy = s.to.y - s.from.y;
        const dz = s.to.z - s.from.z;
        return acc + Math.sqrt(dx * dx + dy * dy + dz * dz);
      }, 0),
      cutDistance: segments
        .filter((s) => s.type === 'cut')
        .reduce((acc, s) => {
          const dx = s.to.x - s.from.x;
          const dy = s.to.y - s.from.y;
          const dz = s.to.z - s.from.z;
          return acc + Math.sqrt(dx * dx + dy * dy + dz * dz);
        }, 0),
    };
  }

  /**
   * Simulate progress in the background, updating DB every few steps.
   */
  private simulateProgress(
    simulationId: string,
    totalSteps: number,
    speed: number,
  ) {
    let currentProgress = 0;
    const intervalMs = Math.max(500, 2000 / speed);

    const timer = setInterval(async () => {
      currentProgress = Math.min(currentProgress + Math.ceil(100 / totalSteps) * speed, 100);

      try {
        if (currentProgress >= 100) {
          clearInterval(timer);
          this.runningSimulations.delete(simulationId);

          await this.prisma.simulation.update({
            where: { id: simulationId },
            data: {
              status: 'COMPLETED',
              progress: 100,
              materialRemoved: Math.random() * 5000 + 1000, // mock
            },
          });

          this.logger.log(`Simulation ${simulationId} completed`);
        } else {
          await this.prisma.simulation.update({
            where: { id: simulationId },
            data: { progress: currentProgress },
          });
        }
      } catch (err) {
        this.logger.error(`Simulation progress update failed: ${err.message}`);
        clearInterval(timer);
        this.runningSimulations.delete(simulationId);
      }
    }, intervalMs);

    this.runningSimulations.set(simulationId, timer);
  }
}
