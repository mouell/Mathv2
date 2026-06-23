import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/auth.guard';

// Allowed file extensions and mimetypes
const ALLOWED_EXTENSIONS = ['.pdf', '.dxf', '.dwg', '.jpg', '.jpeg', '.png', '.svg', '.tiff'];
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/tiff',
  'application/octet-stream', // DXF/DWG often come as octet-stream
  'application/acad',
  'application/x-acad',
  'application/autocad_dwg',
  'image/x-dwg',
  'application/dwg',
  'application/x-dwg',
];

function multerFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_MIMETYPES.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new BadRequestException(
        `File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      ),
      false,
    );
  }
}

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly configService: ConfigService,
  ) {}

  // ─── POST /files/upload ───────────────────────────────────────────────────

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload a CAD plan file',
    description:
      'Accepts PDF, DXF, DWG, PNG, JPG, SVG, TIFF. ' +
      'File is persisted and AI analysis is triggered automatically.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'projectId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        projectId: { type: 'string', description: 'Target project ID' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded and analysis started' })
  @ApiResponse({ status: 400, description: 'Invalid file or missing projectId' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = process.env.UPLOAD_DESTINATION || './uploads';
          const fs = require('fs');
          fs.mkdirSync(uploadDir, { recursive: true });
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: multerFileFilter,
      limits: {
        fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 50) * 1024 * 1024,
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const projectId: string = req.body?.projectId;

    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }

    if (!projectId) {
      throw new BadRequestException('projectId is required in the form body');
    }

    return this.filesService.saveUploadedFile(projectId, file);
  }

  // ─── GET /files/:id ───────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get plan metadata by plan ID' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({ status: 200, description: 'Plan metadata with detected features' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async findOne(@Param('id') id: string) {
    return this.filesService.findPlanById(id);
  }

  // ─── GET /files/project/:projectId ────────────────────────────────────────

  @Get('project/:projectId')
  @ApiOperation({ summary: 'List all plans for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'List of plans' })
  async listProjectPlans(@Param('projectId') projectId: string) {
    return this.filesService.listProjectPlans(projectId);
  }

  // ─── GET /files/serve/:filename ───────────────────────────────────────────

  @Get('serve/:filename')
  @ApiOperation({ summary: 'Download / serve the raw file by filename' })
  @ApiParam({ name: 'filename', description: 'Stored filename (as returned in fileUrl)' })
  @ApiResponse({ status: 200, description: 'File binary content' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const uploadDir = this.configService.get<string>('upload.destination') || './uploads';
    const filePath = path.join(uploadDir, filename);

    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(path.resolve(filePath));
  }
}
