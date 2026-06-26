import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateStationsDto {
  @ApiProperty({
    type: [String],
    description: 'Catálogo de estaciones de preparación del tenant',
    example: ['Cocina', 'Barra'],
  })
  @IsArray()
  @IsString({ each: true })
  stations!: string[];
}
