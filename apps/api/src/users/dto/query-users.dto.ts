import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryUsersDto {
  @ApiPropertyOptional({ description: 'Filtrar por code de rol de sistema (ej. courier)' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'Filtrar por sucursal asignada' })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;
}
