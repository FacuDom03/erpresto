import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AddItemDto {
  @ApiProperty()
  @IsUUID('4')
  productId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Tiempo/course del ítem (override del default por categoría)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  course?: number;
}

export class AddItemsDto {
  @ApiProperty({ type: [AddItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AddItemDto)
  items!: AddItemDto[];
}
