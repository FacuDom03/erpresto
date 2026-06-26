import { Injectable, Logger } from '@nestjs/common';
import { InvoiceType } from '@prisma/client';
import { ArcaInvoiceInput, ArcaProvider, ArcaResult } from './arca-provider.interface';

/**
 * Esqueleto del proveedor ARCA real (AFIP WSFEv1).
 *
 * Activado por el factory cuando existen las variables de entorno
 * ARCA_CUIT, ARCA_CERT_PATH y ARCA_KEY_PATH. Implementa el flujo de
 * homologación/producción en dos pasos:
 *
 *   1. WSAA: obtener un Ticket de Acceso (TA) firmando un
 *      Login Ticket Request (LTR) con el certificado X.509 del
 *      contribuyente y llamando a `loginCms`. El TA dura 12 h y se
 *      debe cachear (token + sign) hasta `expirationTime`.
 *   2. WSFEv1 `FECAESolicitar`: enviar el comprobante (FECAEDetRequest)
 *      con el último número autorizado (`FECompUltimoAutorizado`) y
 *      recibir el CAE + vencimiento, o las observaciones/errores.
 *
 * NOTA: esta clase queda como esqueleto deliberado. Para activarla en
 * homologación hay que completar los TODOs (firma CMS, cliente SOAP y
 * mapeo de tipos de comprobante a los códigos AFIP).
 */
@Injectable()
export class WsfeArcaProvider implements ArcaProvider {
  private readonly logger = new Logger(WsfeArcaProvider.name);

  // Cache del Ticket de Acceso WSAA (token + sign + expiración).
  private accessTicket: { token: string; sign: string; expiresAt: Date } | null = null;

  constructor(
    private readonly cuit: string,
    private readonly certPath: string,
    private readonly keyPath: string,
    private readonly production: boolean = false,
  ) {}

  async requestCae(input: ArcaInvoiceInput): Promise<ArcaResult> {
    try {
      await this.ensureAccessTicket();

      // TODO(homologación): construir el FECAEDetRequest a partir de `input`:
      //   - CbteTipo: mapWsfeCbteTipo(input.type)
      //   - PtoVta: input.pointOfSale
      //   - Concepto: 1 (productos)
      //   - DocTipo/DocNro: 80 (CUIT) / 96 (DNI) / 99 (consumidor final)
      //   - ImpNeto / ImpIVA / ImpTotal desde input
      //   - Iva: array de alícuotas agrupadas (Id 5 = 21%, 4 = 10.5%, 3 = 0%)
      //   - CbteDesde/CbteHasta: input.number (consultar FECompUltimoAutorizado)
      // TODO(homologación): invocar WSFEv1.FECAESolicitar vía SOAP y parsear:
      //   - FeCabResp.Resultado === 'A' => { approved: true, cae, caeExpiry }
      //   - 'R' => { approved: false, reason: observaciones }

      this.logger.warn(
        `WsfeArcaProvider es un esqueleto: faltan pasos de homologación (FECAESolicitar). ` +
          `Comprobante ${input.type} ${input.pointOfSale}-${input.number} no emitido.`,
      );
      return {
        approved: false,
        reason: 'WsfeArcaProvider no implementado (esqueleto de homologación). Configure el mock o complete WSFEv1.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return { approved: false, reason: `Error WSFE: ${message}` };
    }
  }

  /** Garantiza un TA WSAA válido (cacheado 12 h). */
  private async ensureAccessTicket(): Promise<void> {
    if (this.accessTicket && this.accessTicket.expiresAt > new Date()) {
      return;
    }
    // TODO(homologación): generar el LoginTicketRequest XML, firmarlo en
    // CMS (PKCS#7) con el certificado (this.certPath) y la clave privada
    // (this.keyPath), y llamar a WSAA.loginCms(cms). Cachear token/sign.
    this.logger.warn(
      `WSAA loginCms no implementado (CUIT ${this.cuit}, cert ${this.certPath}). ` +
        `Provider en modo ${this.production ? 'producción' : 'homologación'}.`,
    );
    throw new Error('WSAA loginCms no implementado (esqueleto)');
  }

  /** Mapea el tipo de comprobante interno al código AFIP (TODO homologación). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private mapWsfeCbteTipo(type: InvoiceType): number {
    switch (type) {
      case InvoiceType.FACTURA_A:
        return 1;
      case InvoiceType.NOTA_CREDITO_A:
        return 3;
      case InvoiceType.FACTURA_B:
        return 6;
      case InvoiceType.NOTA_CREDITO_B:
        return 8;
      case InvoiceType.FACTURA_C:
        return 11;
      case InvoiceType.NOTA_CREDITO_C:
        return 13;
      default:
        return 0;
    }
  }
}
