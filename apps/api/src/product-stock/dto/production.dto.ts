import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ProductionItemDto {
  @ApiProperty()
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ example: 20 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity!: number;
}

export class CreateProductionDto {
  @ApiProperty()
  @IsUUID('4')
  branchId!: string;

  @ApiProperty({ type: [ProductionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductionItemDto)
  items!: ProductionItemDto[];

  @ApiPropertyOptional({
    default: false,
    description:
      'Si true y el producto tiene receta activa, descuenta materia prima. Si no hay receta NO falla: los stocks son independientes.',
  })
  @IsOptional()
  @IsBoolean()
  consumeRawMaterials?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
