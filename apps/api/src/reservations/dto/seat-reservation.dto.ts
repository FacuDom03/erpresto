import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SeatReservationDto {
  @ApiPropertyOptional({ description: 'Default: la mesa de la reserva' })
  @IsOptional()
  @IsUUID()
  tableId?: string;
}
