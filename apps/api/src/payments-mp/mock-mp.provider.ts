import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreateQrPaymentInput,
  CreateQrPaymentResult,
  MercadoPagoProvider,
  MpStatus,
} from './mp-provider.interface';

/** Segundos tras los cuales el mock considera "aprobado" el pago. */
const AUTO_APPROVE_AFTER_MS = 10_000;

interface MockIntent {
  externalId: string;
  orderId: string;
  amount: number;
  createdAt: number; // epoch ms
}

/**
 * Proveedor Mercado Pago simulado (default). Crea una intención con QR
 * ficticio y la marca como `approved` automáticamente ~10 s después de
 * creada. La aprobación se calcula comparando el timestamp de creación
 * con `Date.now()` en cada `getStatus` (NO usa setTimeout, así no se
 * pierde entre polls).
 */
@Injectable()
export class MockMercadoPagoProvider implements MercadoPagoProvider {
  private readonly logger = new Logger(MockMercadoPagoProvider.name);
  private readonly intents = new Map<string, MockIntent>();

  async createQrPayment(input: CreateQrPaymentInput): Promise<CreateQrPaymentResult> {
    const externalId = `MP-${randomUUID()}`;
    this.intents.set(externalId, {
      externalId,
      orderId: input.orderId,
      amount: input.amount,
      createdAt: Date.now(),
    });
    const qrData = `https://mp.mock/checkout/${externalId}?amount=${input.amount}`;
    this.logger.debug(`Intención MP mock creada ${externalId} (orden ${input.orderId})`);
    return { externalId, qrData };
  }

  async getStatus(externalId: string): Promise<MpStatus> {
    const intent = this.intents.get(externalId);
    if (!intent) {
      return 'rejected';
    }
    return Date.now() - intent.createdAt >= AUTO_APPROVE_AFTER_MS ? 'approved' : 'pending';
  }
}
