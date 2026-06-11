import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class QueryProductStockDto {
  @ApiPropertyOptional({ description: 'Filtrar por sucursal' })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;
}
