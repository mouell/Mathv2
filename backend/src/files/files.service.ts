import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisService } from '../analysis/analysis.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly analysisService: AnalysisService,
  ) {}

  /**
   * Persists the uploaded file metadata in the database as a Plan,
   * then fires off asynchronous AI analysis.
   */
  async saveUploadedFile(
    projectId: string,
    file: Express.Multer.File,
  ) {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      // Remove the uploaded file to avoid orphans
      this.safeDeleteFile(file.path);
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const fileType = this.detectFileType(file.originalname, file.mimetype);
    const fileUrl = this.buildFileUrl(file.filename);

    const plan = await this.prisma.plan.create({
      data: {
        projectId,
        filename: file.filename,
        originalFilename: file.originalname,
        fileType,
        fileUrl,
        fileSizeBytes: file.size,
        analysisStatus: 'PENDING',
        analysisProgress: 0,
      },
    });

    this.logger.log(`Plan ${plan.id} created for project ${projectId} (${file.originalname})`);

    // Update project status to ANALYZING
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'ANALYZING' },
    });

    // Fire off analysis asynchronously — don't await
    this.analysisService
      .runAnalysis(plan.id, file.path)
      .catch((err) =>
        this.logger.error(`Async analysis failed for plan ${plan.id}: ${err.message}`),
      );

    return {
      planId: plan.id,
      filename: plan.originalFilename,
      fileType: plan.fileType,
      fileUrl: plan.fileUrl,
      fileSizeBytes: plan.fileSizeBytes,
      analysisStatus: plan.analysisStatus,
      message: 'File uploaded successfully. Analysis started in background.',
    };
  }

  async findPlanById(planId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: {
        detectedFeatures: {
          orderBy: { createdAt: 'asc' },
        },
        project: {
          select: { id: true, name: true, userId: true },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }

    return plan;
  }

  async streamFile(planId: string): Promise<{ filePath: string; plan: any }> {
    const plan = await this.findPlanById(planId);
    const uploadDir = this.configService.get<string>('upload.destination');
    const filePath = path.join(uploadDir, plan.filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`File not found on server for plan ${planId}`);
    }

    return { filePath, plan };
  }

  async listProjectPlans(projectId: string) {
    return this.prisma.plan.findMany({
      where: { projectId },
      include: {
        _count: { select: { detectedFeatures: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private detectFileType(originalName: string, mimetype: string): string {
    const ext = path.extname(originalName).toLowerCase().replace('.', '');
    const mimeMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/svg+xml': 'svg',
      'image/tiff': 'tiff',
    };

    if (ext && ['pdf', 'dxf', 'dwg', 'jpg', 'jpeg', 'png', 'svg', 'tiff'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }

    return mimeMap[mimetype] ?? ext ?? 'unknown';
  }

  private buildFileUrl(filename: string): string {
    const baseUrl =
      process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    return `${baseUrl}/files/serve/${filename}`;
  }

  private safeDeleteFile(filePath: string) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      this.logger.warn(`Could not delete file at ${filePath}: ${e.message}`);
    }
  }
}
