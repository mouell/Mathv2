import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { GcodeService } from './gcode.service';
import { JwtAuthGuard } from '../auth/auth.guard';

type ControllerType =
  | 'FANUC'
  | 'SIEMENS'
  | 'HEIDENHAIN'
  | 'HAAS'
  | 'MITSUBISHI'
  | 'OKUMA'
  | 'MAZAK';

@ApiTags('gcode')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gcode')
export class GcodeController {
  constructor(private readonly gcodeService: GcodeService) {}

  // ─── GET /gcode/:projectId ────────────────────────────────────────────────

  @Get(':projectId')
  @ApiOperation({
    summary: 'Get or generate G-code for a project',
    description:
      'Returns the most recently generated G-code for the given controller dialect. ' +
      'If no program exists yet, generates one on demand from the machining operations.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({
    name: 'controller',
    required: false,
    enum: ['FANUC', 'SIEMENS', 'HEIDENHAIN', 'HAAS', 'MITSUBISHI', 'OKUMA', 'MAZAK'],
    description: 'CNC controller dialect (default: FANUC)',
  })
  @ApiResponse({ status: 200, description: 'CNC program with G-code' })
  @ApiResponse({ status: 404, description: 'Project or operations not found' })
  async getOrGenerate(
    @Param('projectId') projectId: string,
    @Query('controller') controller: ControllerType = 'FANUC',
  ) {
    return this.gcodeService.getOrGenerate(projectId, controller);
  }

  // ─── GET /gcode/:projectId/download ──────────────────────────────────────

  @Get(':projectId/download')
  @ApiOperation({
    summary: 'Download G-code as a .nc / .txt file',
    description: 'Returns the G-code as a downloadable file attachment.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({
    name: 'controller',
    required: false,
    enum: ['FANUC', 'SIEMENS', 'HEIDENHAIN', 'HAAS', 'MITSUBISHI', 'OKUMA', 'MAZAK'],
  })
  @ApiResponse({ status: 200, description: 'G-code file download' })
  async download(
    @Param('projectId') projectId: string,
    @Query('controller') controller: ControllerType = 'FANUC',
    @Res() res: Response,
  ) {
    const program = await this.gcodeService.getOrGenerate(projectId, controller);
    const filename = `${projectId}_${controller}.nc`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(program.gcode);
  }

  // ─── GET /gcode/:projectId/programs ───────────────────────────────────────

  @Get(':projectId/programs')
  @ApiOperation({ summary: 'List all generated programs for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'List of CNC programs (without gcode text)' })
  async listPrograms(@Param('projectId') projectId: string) {
    return this.gcodeService.listPrograms(projectId);
  }

  // ─── POST /gcode/:projectId/regenerate ────────────────────────────────────

  @Post(':projectId/regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Regenerate G-code for a project',
    description:
      'Deletes the existing program for the given controller and generates a fresh one. ' +
      'Use after modifying machining operations.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({
    name: 'controller',
    required: false,
    enum: ['FANUC', 'SIEMENS', 'HEIDENHAIN', 'HAAS', 'MITSUBISHI', 'OKUMA', 'MAZAK'],
  })
  @ApiResponse({ status: 200, description: 'Newly generated CNC program' })
  async regenerate(
    @Param('projectId') projectId: string,
    @Query('controller') controller: ControllerType = 'FANUC',
  ) {
    return this.gcodeService.regenerate(projectId, controller);
  }
}
