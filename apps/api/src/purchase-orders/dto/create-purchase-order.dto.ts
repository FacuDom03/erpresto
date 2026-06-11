import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePurchaseOrderItemDto {
  @ApiProperty()
  @IsUUID()
  rawMaterialId!: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @ApiProperty({ example: 8500.5 })
  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty()
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional({ example: '2026-06-15T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expectedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreatePurchaseOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items!: CreatePurchaseOrderItemDto[];
}
