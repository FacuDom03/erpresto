import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MergeTableDto {
  @ApiProperty({ description: 'Mesa principal a la que se une esta mesa' })
  @IsUUID('4')
  intoTableId!: string;
}
