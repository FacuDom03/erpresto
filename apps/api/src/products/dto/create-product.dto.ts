import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockLinkMode } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Milanesa napolitana' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'MILA-NAPO' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ example: 8500.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 21, default: 21 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional({ example: 'cocina' })
  @IsOptional()
  @IsString()
  printStation?: string;

  @ApiPropertyOptional({
    description: 'Requiere preparación (pasa por KDS). Si se omite, hereda de la categoría',
  })
  @IsOptional()
  @IsBoolean()
  requiresPreparation?: boolean;

  @ApiPropertyOptional({ enum: StockLinkMode, default: StockLinkMode.INHERIT })
  @IsOptional()
  @IsEnum(StockLinkMode)
  stockLinkMode?: StockLinkMode;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  minStock?: number;
}
