import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

export enum ReportFormat {
  CSV = 'csv',
  XLSX = 'xlsx',
  PDF = 'pdf',
}

export class QueryReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ApiPropertyOptional({ description: 'Desde (ISO date)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta (ISO date)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'Agrupación (depende del reporte: day|method|type)' })
  @IsOptional()
  @IsString()
  groupBy?: string;

  @ApiPropertyOptional({ enum: ReportFormat, description: 'Sin formato → JSON' })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;
}
