import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SimulationService } from './simulation.service';
import { JwtAuthGuard } from '../auth/auth.guard';

class StartSimulationDto {
  @ApiPropertyOptional({ description: 'Specific CNC program ID to simulate (defaults to latest)' })
  @IsOptional()
  @IsString()
  programId?: string;

  @ApiPropertyOptional({
    description: 'Playback speed multiplier (1 = real-time)',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  speed?: number;

  @ApiPropertyOptional({
    description: 'Mesh resolution for collision detection (1=low, 10=high)',
    default: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  resolution?: number;
}

@ApiTags('simulation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('simulation')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  // ─── POST /simulation/:projectId/start ───────────────────────────────────

  @Post(':projectId/start')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start a new toolpath simulation',
    description:
      'Starts a G-code simulation for the project. Parses toolpath, detects collisions, ' +
      'and tracks material removal. Progress is updated asynchronously.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiBody({ type: StartSimulationDto, required: false })
  @ApiResponse({ status: 202, description: 'Simulation started' })
  @ApiResponse({ status: 404, description: 'Project or program not found' })
  @ApiResponse({ status: 409, description: 'Simulation already running' })
  async start(
    @Param('projectId') projectId: string,
    @Body() dto: StartSimulationDto = {},
  ) {
    return this.simulationService.startSimulation(projectId, dto);
  }

  // ─── GET /simulation/:projectId/state ────────────────────────────────────

  @Get(':projectId/state')
  @ApiOperation({
    summary: 'Get current simulation state',
    description:
      'Polls the simulation progress, status, collision report, and material-removal data.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Simulation state' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getState(@Param('projectId') projectId: string) {
    return this.simulationService.getState(projectId);
  }

  // ─── POST /simulation/:projectId/pause ───────────────────────────────────

  @Post(':projectId/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause the running simulation' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Simulation paused' })
  @ApiResponse({ status: 404, description: 'No running simulation' })
  async pause(@Param('projectId') projectId: string) {
    return this.simulationService.pauseSimulation(projectId);
  }

  // ─── POST /simulation/:projectId/resume ──────────────────────────────────

  @Post(':projectId/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused simulation' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Simulation resumed' })
  @ApiResponse({ status: 404, description: 'No paused simulation' })
  async resume(@Param('projectId') projectId: string) {
    return this.simulationService.resumeSimulation(projectId);
  }

  // ─── POST /simulation/:projectId/stop ────────────────────────────────────

  @Post(':projectId/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop and reset the current simulation' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Simulation stopped' })
  async stop(@Param('projectId') projectId: string) {
    return this.simulationService.stopSimulation(projectId);
  }

  // ─── GET /simulation/:projectId/history ──────────────────────────────────

  @Get(':projectId/history')
  @ApiOperation({ summary: 'List all simulations for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Simulation history' })
  async listSimulations(@Param('projectId') projectId: string) {
    return this.simulationService.listSimulations(projectId);
  }
}
