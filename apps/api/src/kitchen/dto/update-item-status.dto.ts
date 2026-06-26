import { ApiProperty } from '@nestjs/swagger';
import { OrderItemStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateKitchenItemStatusDto {
  @ApiProperty({ enum: OrderItemStatus })
  @IsEnum(OrderItemStatus)
  status!: OrderItemStatus;
}
