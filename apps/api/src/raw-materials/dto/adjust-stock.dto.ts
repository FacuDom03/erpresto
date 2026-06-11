import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, NotEquals } from 'class-validator';

export class AdjustRawStockDto {
  @ApiProperty({ description: 'Depósito donde se ajusta el stock' })
  @IsUUID('4')
  warehouseId!: string;

  @ApiProperty({
    example: 5.5,
    description: 'Cantidad del ajuste: positivo suma, negativo descuenta',
  })
  @IsNumber({ maxDecimalPlaces: 3 })
  @NotEquals(0)
  quantity!: number;

  @ApiPropertyOptional({ example: 7800 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
