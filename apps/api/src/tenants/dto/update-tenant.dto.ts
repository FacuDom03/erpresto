import { ApiPropertyOptional } from '@nestjs/swagger';
import { StockConfigMode } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTenantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Configuración flexible del tenant (JSON)' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: StockConfigMode })
  @IsOptional()
  @IsEnum(StockConfigMode)
  stockMode?: StockConfigMode;
}
