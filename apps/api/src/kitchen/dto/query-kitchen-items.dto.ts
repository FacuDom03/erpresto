import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderItemStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryKitchenItemsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ApiPropertyOptional({ description: 'Estación de preparación (cocina, barra...)' })
  @IsOptional()
  @IsString()
  station?: string;

  @ApiPropertyOptional({
    description: 'Lista separada por comas, ej: SENT,PREPARING,READY',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value,
  )
  @IsArray()
  @IsEnum(OrderItemStatus, { each: true })
  statuses?: OrderItemStatus[];
}
