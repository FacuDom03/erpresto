import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderItemStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class UpdateOrderItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @ApiPropertyOptional({ enum: [OrderItemStatus.CANCELLED] })
  @IsOptional()
  @IsIn([OrderItemStatus.CANCELLED])
  status?: typeof OrderItemStatus.CANCELLED;
}
