import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductMovementType } from '@prisma/client';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUUID, NotEquals } from 'class-validator';

export class AdjustProductStockDto {
  @ApiProperty()
  @IsUUID('4')
  branchId!: string;

  @ApiProperty()
  @IsUUID('4')
  productId!: string;

  @ApiProperty({
    example: -3,
    description: 'Cantidad del ajuste: positivo suma, negativo descuenta',
  })
  @IsNumber({ maxDecimalPlaces: 3 })
  @NotEquals(0)
  quantity!: number;

  @ApiPropertyOptional({
    enum: [ProductMovementType.MANUAL, ProductMovementType.ADJUSTMENT],
    default: ProductMovementType.ADJUSTMENT,
  })
  @IsOptional()
  @IsEnum(ProductMovementType)
  @IsIn([ProductMovementType.MANUAL, ProductMovementType.ADJUSTMENT])
  type?: ProductMovementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
