import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
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
  ApiBody,
} from '@nestjs/swagger';
import { AnalysisService } from './analysis.service';
import { UpdateFeatureDto, ReanalyzeDto } from './dto/update-feature.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@ApiTags('analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  // ─── GET /analysis/:planId ────────────────────────────────────────────────

  @Get(':planId')
  @ApiOperation({
    summary: 'Get analysis results for a plan',
    description:
      'Returns OCR data, detected features grouped by type, analysis status and progress.',
  })
  @ApiParam({ name: 'planId', description: 'Plan (uploaded file) ID' })
  @ApiResponse({ status: 200, description: 'Analysis results with all detected features' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async getAnalysis(@Param('planId') planId: string) {
    return this.analysisService.getAnalysis(planId);
  }

  // ─── POST /analysis/:planId/reanalyze ─────────────────────────────────────

  @Post(':planId/reanalyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger re-analysis of a plan',
    description:
      'Resets analysis status and fires off a fresh analysis using the originally uploaded file. ' +
      'Useful after manual feature corrections.',
  })
  @ApiParam({ name: 'planId', description: 'Plan ID' })
  @ApiBody({ type: ReanalyzeDto, required: false })
  @ApiResponse({ status: 202, description: 'Re-analysis started' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async reanalyze(
    @Param('planId') planId: string,
    @Body() dto: ReanalyzeDto = {},
  ) {
    return this.analysisService.reanalyze(planId, dto);
  }

  // ─── PATCH /analysis/feature/:featureId ──────────────────────────────────

  @Patch('feature/:featureId')
  @ApiOperation({
    summary: 'Update a detected feature',
    description:
      'Allows manual correction of an auto-detected feature — type, value, tolerance, etc. ' +
      'Setting isVerified=true locks the feature from being overwritten by re-analysis.',
  })
  @ApiParam({ name: 'featureId', description: 'DetectedFeature ID' })
  @ApiBody({ type: UpdateFeatureDto })
  @ApiResponse({ status: 200, description: 'Feature updated' })
  @ApiResponse({ status: 404, description: 'Feature not found' })
  async updateFeature(
    @Param('featureId') featureId: string,
    @Body() dto: UpdateFeatureDto,
  ) {
    return this.analysisService.updateFeature(featureId, dto);
  }
}
