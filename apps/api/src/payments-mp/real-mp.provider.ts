import { Injectable, Logger } from '@nestjs/common';
import {
  CreateQrPaymentInput,
  CreateQrPaymentResult,
  MercadoPagoProvider,
  MpStatus,
} from './mp-provider.interface';

/**
 * Esqueleto del proveedor Mercado Pago real (activado por
 * MERCADOPAGO_ACCESS_TOKEN). Usa la API de pagos QR / Orders.
 *
 * Flujo de homologación a completar:
 *   - createQrPayment: crear una orden (`POST /v1/orders` o
 *     `/instore/orders/qr/...`) y devolver el `qr_data` y el `id`.
 *   - getStatus: consultar `GET /v1/payments/:id` o la orden y mapear
 *     el estado de MP (`approved` | `pending` | `rejected`).
 *   - El webhook real reconcilia por `external_reference`/`id`.
 */
@Injectable()
export class RealMercadoPagoProvider implements MercadoPagoProvider {
  private readonly logger = new Logger(RealMercadoPagoProvider.name);

  constructor(private readonly accessToken: string) {}

  async createQrPayment(input: CreateQrPaymentInput): Promise<CreateQrPaymentResult> {
    // TODO(homologación): llamar a la API de Mercado Pago con this.accessToken
    // para crear una orden QR y devolver { externalId, qrData } reales.
    this.logger.warn(
      `RealMercadoPagoProvider.createQrPayment no implementado (orden ${input.orderId}).`,
    );
    throw new Error('RealMercadoPagoProvider no implementado (esqueleto de homologación)');
  }

  async getStatus(externalId: string): Promise<MpStatus> {
    // TODO(homologación): consultar el estado real del pago/orden.
    this.logger.warn(`RealMercadoPagoProvider.getStatus no implementado (${externalId}).`);
    throw new Error('RealMercadoPagoProvider no implementado (esqueleto de homologación)');
  }
}
