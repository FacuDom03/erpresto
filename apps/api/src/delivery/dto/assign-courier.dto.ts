import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignCourierDto {
  @ApiProperty({ description: 'Usuario repartidor a asignar' })
  @IsUUID('4')
  courierId!: string;
}
