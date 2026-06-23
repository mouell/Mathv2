import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { FeatureType, ToleranceType } from '@prisma/client';

export class UpdateFeatureDto {
  @ApiPropertyOptional({ enum: FeatureType, description: 'Override detected feature type' })
  @IsOptional()
  @IsEnum(FeatureType)
  type?: FeatureType;

  @ApiPropertyOptional({ example: 12.5, description: 'Numeric value (e.g. hole diameter in mm)' })
  @IsOptional()
  @IsNumber()
  value?: number;

  @ApiPropertyOptional({ example: 'mm', description: 'Unit string' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 0.05 })
  @IsOptional()
  @IsNumber()
  tolerance?: number;

  @ApiPropertyOptional({ enum: ToleranceType })
  @IsOptional()
  @IsEnum(ToleranceType)
  toleranceType?: ToleranceType;

  @ApiPropertyOptional({ example: 0.02 })
  @IsOptional()
  @IsNumber()
  tolerancePlus?: number;

  @ApiPropertyOptional({ example: -0.02 })
  @IsOptional()
  @IsNumber()
  toleranceMinus?: number;

  @ApiPropertyOptional({
    example: 0.95,
    description: 'Detection confidence (0-1)',
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @ApiPropertyOptional({ description: 'Human-readable label' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Mark feature as manually verified' })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({ description: 'Extra metadata JSON', type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ReanalyzeDto {
  @ApiPropertyOptional({
    description: 'Force re-OCR even if text was already extracted',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceOcr?: boolean;

  @ApiPropertyOptional({
    description: 'AI model to use (fast / accurate / premium)',
    example: 'accurate',
  })
  @IsOptional()
  @IsString()
  model?: string;
}
