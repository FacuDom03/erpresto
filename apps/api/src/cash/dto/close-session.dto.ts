import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class CloseSessionDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  closingAmount!: number;
}
