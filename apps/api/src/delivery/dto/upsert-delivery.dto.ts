import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertDeliveryDto {
  @ApiProperty({ description: 'Dirección de entrega' })
  @IsString()
  @MinLength(3)
  address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Horario estimado de entrega (ISO)' })
  @IsOptional()
  @IsISO8601()
  estimatedAt?: string;
}
