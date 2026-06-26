import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreditNoteItemDto {
  @ApiPropertyOptional({ description: 'Descripción de la línea original a acreditar' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ description: 'Cantidad a acreditar' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Precio unitario con IVA incluido' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPriceWithTax!: number;

  @ApiPropertyOptional({ description: 'Alícuota de IVA (ej. 21)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxRate!: number;
}

export class CreateCreditNoteDto {
  @ApiPropertyOptional({
    type: [CreditNoteItemDto],
    description: 'Líneas a acreditar (NC parcial). Si se omite, NC total espejando la factura.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreditNoteItemDto)
  items?: CreditNoteItemDto[];
}
