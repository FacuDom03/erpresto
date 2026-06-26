import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CashSessionStatus, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateMpPaymentDto } from './dto/create-mp-payment.dto';
import {
  MERCADOPAGO_PROVIDER,
  MercadoPagoProvider,
  MpStatus,
} from './mp-provider.interface';

/** Intención MP en memoria (deuda técnica: tabla MpPayment en F4). */
interface MpIntent {
  externalId: string;
  tenantId: string;
  orderId: string;
  branchId: string;
  amount: number;
}

@Injectable()
export class PaymentsMpService {
  private readonly logger = new Logger(PaymentsMpService.name);

  /**
   * Store en memoria de intenciones pendientes: externalId → intención.
   * Suficiente para mock/demo; el provider real reconcilia por webhook.
   */
  private readonly intents = new Map<string, MpIntent>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    @Inject(MERCADOPAGO_PROVIDER) private readonly mp: MercadoPagoProvider,
  ) {}

  // ----------------------------------------------------------
  // Crear intención de pago + QR
  // ----------------------------------------------------------
  async createPayment(tenantId: string, orderId: string, dto: CreateMpPaymentDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, branchId: true, status: true },
    });
    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('No se puede cobrar un pedido cancelado');
    }

    const { externalId, qrData } = await this.mp.createQrPayment({ orderId, amount: dto.amount });
    this.intents.set(externalId, {
      externalId,
      tenantId,
      orderId,
      branchId: order.branchId,
      amount: dto.amount,
    });

    return { externalId, qrData, amount: dto.amount, status: 'pending' as MpStatus };
  }

  // ----------------------------------------------------------
  // Polling de estado: si approved y no registrado, crea el Payment
  // ----------------------------------------------------------
  async getStatus(tenantId: string, externalId: string) {
    const intent = this.intents.get(externalId);
    if (!intent || intent.tenantId !== tenantId) {
      throw new NotFoundException('Intención de pago no encontrada');
    }
    const status = await this.mp.getStatus(externalId);
    if (status === 'approved') {
      await this.registerPaymentIfNeeded(intent);
    }
    return { status };
  }

  // ----------------------------------------------------------
  // Webhook público: idempotente por externalId
  // ----------------------------------------------------------
  async handleWebhook(externalId: string | undefined): Promise<{ received: boolean }> {
    if (!externalId) {
      return { received: true };
    }
    const intent = this.intents.get(externalId);
    if (!intent) {
      // Notificación de una intención desconocida (o ya purgada): se acepta.
      this.logger.debug(`Webhook MP para intención desconocida ${externalId}`);
      return { received: true };
    }
    const status = await this.mp.getStatus(externalId);
    if (status === 'approved') {
      await this.registerPaymentIfNeeded(intent);
    }
    return { received: true };
  }

  // ----------------------------------------------------------
  // Registro idempotente del Payment MERCADOPAGO
  // ----------------------------------------------------------
  private async registerPaymentIfNeeded(intent: MpIntent): Promise<void> {
    // Idempotencia: no duplicar si ya existe un Payment con esta reference.
    const existing = await this.prisma.payment.findFirst({
      where: {
        orderId: intent.orderId,
        method: PaymentMethod.MERCADOPAGO,
        reference: intent.externalId,
      },
      select: { id: true },
    });
    if (existing) {
      return;
    }

    const session = await this.prisma.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN, register: { branchId: intent.branchId } },
      select: { id: true },
    });

    try {
      await this.prisma.payment.create({
        data: {
          orderId: intent.orderId,
          method: PaymentMethod.MERCADOPAGO,
          amount: new Prisma.Decimal(intent.amount),
          reference: intent.externalId,
          cashSessionId: session?.id ?? null,
        },
      });
    } catch (error) {
      // Carrera entre status y webhook: si otro creó el Payment, re-chequear.
      const now = await this.prisma.payment.findFirst({
        where: {
          orderId: intent.orderId,
          method: PaymentMethod.MERCADOPAGO,
          reference: intent.externalId,
        },
        select: { id: true },
      });
      if (!now) {
        throw error;
      }
      return;
    }

    this.realtime.emit('order.updated', intent.branchId, intent.orderId);
    if (session) {
      this.realtime.emit('cash.updated', intent.branchId, session.id);
    }
    this.logger.debug(`Payment MERCADOPAGO registrado para orden ${intent.orderId} (${intent.externalId})`);
  }
}
