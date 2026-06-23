import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, ProjectResponseDto } from './dto/create-project.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // ─── POST /projects ───────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new CAD/CAM project' })
  @ApiResponse({ status: 201, description: 'Project created', type: ProjectResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Request() req: any, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(req.user.id, dto);
  }

  // ─── GET /projects ────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List all projects',
    description: 'Admins see all projects; other roles only see their own.',
  })
  @ApiResponse({ status: 200, description: 'List of projects', type: [ProjectResponseDto] })
  async findAll(@Request() req: any) {
    return this.projectsService.findAll(req.user.id, req.user.role);
  }

  // ─── GET /projects/:id ────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single project with full detail' })
  @ApiParam({ name: 'id', description: 'Project ID (cuid)' })
  @ApiResponse({ status: 200, description: 'Project detail', type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.findOne(id, req.user.id, req.user.role);
  }

  // ─── GET /projects/:id/status ─────────────────────────────────────────────

  @Get(':id/status')
  @ApiOperation({
    summary: 'Get project pipeline status',
    description:
      'Returns an aggregated status summary: how many plans are analyzed, whether G-code is generated, simulation state, etc.',
  })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project status summary' })
  async getStatus(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.getStatus(id, req.user.id, req.user.role);
  }

  // ─── PATCH /projects/:id ──────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update project name, description, or status' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Updated project', type: ProjectResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, req.user.id, req.user.role, dto);
  }

  // ─── DELETE /projects/:id ─────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a project and all its data' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.remove(id, req.user.id, req.user.role);
  }
}
