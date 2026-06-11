import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MeasureUnit } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRawMaterialDto {
  @ApiProperty({ example: 'Calamar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'MP-CALAMAR' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @ApiPropertyOptional({ enum: MeasureUnit, default: MeasureUnit.UNIT })
  @IsOptional()
  @IsEnum(MeasureUnit)
  unit?: MeasureUnit;

  @ApiPropertyOptional({ example: 'pescados' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({ example: 7500 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  avgCost?: number;

  @ApiPropertyOptional({ example: 8000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  lastCost?: number;
}
