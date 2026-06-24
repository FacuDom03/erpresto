import { Injectable, Logger } from '@nestjs/common';
import { ArcaInvoiceInput, ArcaProvider, ArcaResult } from './arca-provider.interface';

/**
 * Proveedor ARCA simulado (default). Genera un CAE de 14 dígitos,
 * con vencimiento a 10 días, y aprueba siempre salvo datos inválidos
 * (montos no coherentes o falta de CUIT del emisor). Útil para demo
 * y desarrollo sin credenciales reales de AFIP/ARCA.
 */
@Injectable()
export class MockArcaProvider implements ArcaProvider {
  private readonly logger = new Logger(MockArcaProvider.name);

  async requestCae(input: ArcaInvoiceInput): Promise<ArcaResult> {
    if (!input.issuerCuit || !/^\d{11}$/.test(input.issuerCuit.replace(/\D/g, ''))) {
      return { approved: false, reason: 'CUIT del emisor inválido o ausente' };
    }
    if (input.totalAmount <= 0) {
      return { approved: false, reason: 'El total del comprobante debe ser mayor a cero' };
    }
    const recomposed = Number((input.netAmount + input.taxAmount).toFixed(2));
    if (Math.abs(recomposed - Number(input.totalAmount.toFixed(2))) > 0.05) {
      return {
        approved: false,
        reason: `Inconsistencia de montos: neto+IVA=${recomposed} != total=${input.totalAmount}`,
      };
    }

    // CAE simulado de 14 dígitos (criterio AFIP: 14 dígitos numéricos).
    const cae = Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join('');
    const caeExpiry = new Date(Date.now() + 10 * 86_400_000);

    this.logger.debug(
      `CAE mock ${cae} para ${input.type} ${input.pointOfSale}-${input.number} total=${input.totalAmount}`,
    );
    return { approved: true, cae, caeExpiry };
  }
}
