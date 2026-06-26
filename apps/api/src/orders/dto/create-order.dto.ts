import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID('4')
  branchId!: string;

  @ApiProperty({ enum: OrderType })
  @IsEnum(OrderType)
  type!: OrderType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  tableId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  peopleCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  customerId?: string;
}
