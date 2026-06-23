import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        userId,
      },
      include: this.defaultInclude(),
    });

    this.logger.log(`Project created: ${project.id} by user ${userId}`);
    return project;
  }

  async findAll(userId: string, userRole: string) {
    // Admins see all projects; others only see their own
    const where = userRole === 'ADMIN' ? {} : { userId };

    return this.prisma.project.findMany({
      where,
      include: this.defaultInclude(),
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        ...this.defaultInclude(),
        plans: {
          include: {
            detectedFeatures: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        operations: {
          orderBy: { sequence: 'asc' },
        },
        programs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        simulations: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    this.assertAccess(project.userId, userId, userRole);
    return project;
  }

  async update(id: string, userId: string, userRole: string, dto: UpdateProjectDto) {
    const project = await this.findOneRaw(id);
    this.assertAccess(project.userId, userId, userRole);

    return this.prisma.project.update({
      where: { id },
      data: dto,
      include: this.defaultInclude(),
    });
  }

  async remove(id: string, userId: string, userRole: string) {
    const project = await this.findOneRaw(id);
    this.assertAccess(project.userId, userId, userRole);

    await this.prisma.project.delete({ where: { id } });
    this.logger.log(`Project deleted: ${id}`);
    return { deleted: true, id };
  }

  async getStatus(id: string, userId: string, userRole: string) {
    const project = await this.findOneRaw(id);
    this.assertAccess(project.userId, userId, userRole);

    // Aggregate status across sub-resources
    const [plansCount, analyzedPlans, operationsCount, programsCount, simulationsCount] =
      await this.prisma.$transaction([
        this.prisma.plan.count({ where: { projectId: id } }),
        this.prisma.plan.count({ where: { projectId: id, analysisStatus: 'COMPLETED' } }),
        this.prisma.machiningOperation.count({ where: { projectId: id } }),
        this.prisma.cNCProgram.count({ where: { projectId: id } }),
        this.prisma.simulation.count({ where: { projectId: id } }),
      ]);

    const latestSimulation = await this.prisma.simulation.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      select: { status: true, progress: true, createdAt: true },
    });

    return {
      projectId: id,
      status: project.status,
      plans: { total: plansCount, analyzed: analyzedPlans },
      operationsGenerated: operationsCount,
      programsGenerated: programsCount,
      simulations: simulationsCount,
      latestSimulation,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async findOneRaw(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  private assertAccess(ownerId: string, requesterId: string, requesterRole: string) {
    if (requesterRole === 'ADMIN') return;
    if (ownerId !== requesterId) {
      throw new ForbiddenException('You do not have access to this project');
    }
  }

  private defaultInclude() {
    return {
      user: {
        select: { id: true, email: true, name: true },
      },
      _count: {
        select: {
          plans: true,
          models: true,
          operations: true,
          programs: true,
          simulations: true,
        },
      },
    };
  }
}
