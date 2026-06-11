import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReservationDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty({ example: 'Familia Rodríguez' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: '+54 11 5555-9876' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  partySize!: number;

  @ApiProperty({ example: '2026-06-11T21:00:00.000Z' })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tableId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    enum: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
    default: ReservationStatus.PENDING,
  })
  @IsOptional()
  @IsIn([ReservationStatus.PENDING, ReservationStatus.CONFIRMED])
  status?: ReservationStatus;
}
