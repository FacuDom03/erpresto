import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReceiveItemDto {
  @ApiProperty({ description: 'Id del item de la orden de compra' })
  @IsUUID()
  itemId!: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Default: el costo unitario de la OC' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ example: 'LOTE-2026-001' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lotCode?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ReceivePurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ type: [ReceiveItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items!: ReceiveItemDto[];
}
