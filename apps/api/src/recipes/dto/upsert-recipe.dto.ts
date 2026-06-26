import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpsertRecipeItemDto {
  @ApiProperty({ description: 'Materia prima del tenant' })
  @IsUUID('4')
  rawMaterialId!: string;

  @ApiProperty({ example: 0.2, description: 'Cantidad de insumo por receta' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional({ example: 10, default: 0, description: 'Merma %' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  wastePercent?: number;
}

export class UpsertRecipeDto {
  @ApiProperty({ example: 1, description: 'Porciones que rinde la receta' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  yieldQuantity!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({ type: [UpsertRecipeItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertRecipeItemDto)
  items!: UpsertRecipeItemDto[];
}
