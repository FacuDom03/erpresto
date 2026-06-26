import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Platos principales' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ description: 'Categoría padre (árbol)' })
  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @ApiPropertyOptional({ example: '#FF5733' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: 'Cocina', description: 'Estación por defecto para los productos' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  defaultStation?: string;

  @ApiPropertyOptional({ default: true, description: 'Requiere preparación por defecto' })
  @IsOptional()
  @IsBoolean()
  defaultRequiresPreparation?: boolean;
}
