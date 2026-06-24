import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceType } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';

const FACTURA_TYPES: InvoiceType[] = [
  InvoiceType.FACTURA_A,
  InvoiceType.FACTURA_B,
  InvoiceType.FACTURA_C,
];

export class CreateInvoiceFromOrderDto {
  @ApiPropertyOptional({ description: 'Override del cliente a facturar' })
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @ApiPropertyOptional({ enum: FACTURA_TYPES, description: 'Override del tipo de factura (A/B/C)' })
  @IsOptional()
  @IsEnum(InvoiceType)
  @IsIn(FACTURA_TYPES, { message: 'type debe ser FACTURA_A, FACTURA_B o FACTURA_C' })
  type?: InvoiceType;
}
