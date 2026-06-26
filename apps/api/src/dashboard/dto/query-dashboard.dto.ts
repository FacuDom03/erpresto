import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class QueryDashboardDto {
  @ApiPropertyOptional({ description: 'Si se omite: consolidado de todas las sucursales' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
