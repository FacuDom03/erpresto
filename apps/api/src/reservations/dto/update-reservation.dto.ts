import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateReservationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  partySize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'null para desasignar la mesa' })
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsUUID()
  tableId?: string | null;

  @ApiPropertyOptional({ description: 'null para desasociar el cliente' })
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    enum: [
      ReservationStatus.PENDING,
      ReservationStatus.CONFIRMED,
      ReservationStatus.CANCELLED,
      ReservationStatus.NO_SHOW,
    ],
    description: 'PENDING↔CONFIRMED; CANCELLED/NO_SHOW desde cualquier estado no final',
  })
  @IsOptional()
  @IsIn([
    ReservationStatus.PENDING,
    ReservationStatus.CONFIRMED,
    ReservationStatus.CANCELLED,
    ReservationStatus.NO_SHOW,
  ])
  status?: ReservationStatus;
}
