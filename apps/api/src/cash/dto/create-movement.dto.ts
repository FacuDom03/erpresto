import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CashMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

const MANUAL_TYPES = [
  CashMovementType.WITHDRAWAL,
  CashMovementType.DEPOSIT,
  CashMovementType.EXPENSE,
  CashMovementType.TIP,
] as const;

export class CreateMovementDto {
  @ApiProperty({ enum: MANUAL_TYPES })
  @IsIn(MANUAL_TYPES)
  type!: (typeof MANUAL_TYPES)[number];

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
