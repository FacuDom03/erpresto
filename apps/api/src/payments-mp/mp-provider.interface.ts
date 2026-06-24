export type MpStatus = 'pending' | 'approved' | 'rejected';

export interface CreateQrPaymentInput {
  orderId: string;
  amount: number;
}

export interface CreateQrPaymentResult {
  externalId: string;
  qrData: string; // string a renderizar como QR
}

/**
 * Puerto de cobro por QR dinámico de Mercado Pago. El servicio depende
 * de esta abstracción; el factory inyecta el mock por defecto o el real
 * si hay MERCADOPAGO_ACCESS_TOKEN en env.
 */
export interface MercadoPagoProvider {
  createQrPayment(input: CreateQrPaymentInput): Promise<CreateQrPaymentResult>;
  getStatus(externalId: string): Promise<MpStatus>;
}

export const MERCADOPAGO_PROVIDER = 'MERCADOPAGO_PROVIDER';
