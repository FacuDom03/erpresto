import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateRawMaterialDto } from './create-raw-material.dto';

export class UpdateRawMaterialDto extends PartialType(CreateRawMaterialDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
