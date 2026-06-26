import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Notificación de Mercado Pago. El formato real varía (topic/type +
 * data.id). Aceptamos un cuerpo laxo y resolvemos el externalId desde
 * varios campos posibles.
 */
export class MpWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'externalId de la intención (data.id o id)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: { id?: string };
}
