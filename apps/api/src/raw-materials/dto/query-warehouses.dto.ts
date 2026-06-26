import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class QueryWarehousesDto {
  @ApiProperty({ description: 'Sucursal de la que se listan los depósitos' })
  @IsUUID('4')
  branchId!: string;
}
