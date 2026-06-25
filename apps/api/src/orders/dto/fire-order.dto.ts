import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class FireOrderDto {
  @ApiPropertyOptional({
    description: 'Si se indica, marcha solo los ítems pendientes de ese tiempo/course',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  course?: number;
}
