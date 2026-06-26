import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryStatus, OrderType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AssignCourierDto } from './dto/assign-courier.dto';
import { QueryDeliveriesDto } from './dto/query-deliveries.dto';
import { UpdateDeliveryStatusDto } from './dto/update-status.dto';
import { UpsertDeliveryDto } from './dto/upsert-delivery.dto';

/** Transiciones válidas del ciclo de delivery. */
const TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  [DeliveryStatus.PENDING]: [DeliveryStatus.ASSIGNED, DeliveryStatus.CANCELLED],
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.IN_TRANSIT, DeliveryStatus.CANCELLED],
  [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED],
  [DeliveryStatus.DELIVERED]: [],
  [DeliveryStatus.CANCELLED]: [],
};

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  // ----------------------------------------------------------
  // PUT /orders/:id/delivery — upsert (solo pedidos DELIVERY)
  // ----------------------------------------------------------
  async upsert(tenantId: string, orderId: string, dto: UpsertDeliveryDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, branchId: true, type: true },
    });
    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }
    if (order.type !== OrderType.DELIVERY) {
      throw new BadRequestException('Solo los pedidos de tipo DELIVERY admiten información de envío');
    }

    const estimatedAt = dto.estimatedAt ? new Date(dto.estimatedAt) : undefined;
    const delivery = await this.prisma.deliveryInfo.upsert({
      where: { orderId },
      create: {
        orderId,
        address: dto.address,
        notes: dto.notes,
        estimatedAt,
      },
      update: {
        address: dto.address,
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(estimatedAt !== undefined ? { estimatedAt } : {}),
      },
    });

    this.realtime.emit('order.updated', order.branchId, orderId);
    return delivery;
  }

  // ----------------------------------------------------------
  // GET /deliveries — tablero
  // ----------------------------------------------------------
  async findAll(tenantId: string, query: QueryDeliveriesDto) {
    const deliveries = await this.prisma.deliveryInfo.findMany({
      where: {
        order: {
          tenantId,
          type: OrderType.DELIVERY,
          ...(query.branchId ? { branchId: query.branchId } : {}),
        },
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        order: {
          select: {
            id: true,
            number: true,
            total: true,
            branchId: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { order: { openedAt: 'desc' } },
    });

    // Resolver datos del courier (User) en una sola consulta.
    const courierIds = [...new Set(deliveries.map((d) => d.courierId).filter((x): x is string => !!x))];
    const couriers = courierIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: courierIds }, tenantId },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const courierById = new Map(
      couriers.map((c) => [c.id, { id: c.id, name: `${c.firstName} ${c.lastName}`.trim() }]),
    );

    const data = deliveries.map((d) => ({
      id: d.orderId,
      orderId: d.orderId,
      address: d.address,
      status: d.status,
      notes: d.notes,
      estimatedAt: d.estimatedAt,
      deliveredAt: d.deliveredAt,
      order: {
        id: d.order.id,
        number: d.order.number,
        total: Number(d.order.total),
      },
      customer: d.order.customer,
      courier: d.courierId ? (courierById.get(d.courierId) ?? { id: d.courierId, name: null }) : null,
    }));
    return { data, total: data.length };
  }

  // ----------------------------------------------------------
  // POST /deliveries/:id/assign — asignar courier
  // ----------------------------------------------------------
  async assign(tenantId: string, orderId: string, dto: AssignCourierDto) {
    const delivery = await this.getDelivery(tenantId, orderId);

    const courier = await this.prisma.user.findFirst({
      where: { id: dto.courierId, tenantId },
      select: { id: true },
    });
    if (!courier) {
      throw new BadRequestException('El repartidor no pertenece al tenant');
    }
    if (delivery.status === DeliveryStatus.DELIVERED || delivery.status === DeliveryStatus.CANCELLED) {
      throw new ConflictException('El envío ya está finalizado');
    }

    const updated = await this.prisma.deliveryInfo.update({
      where: { orderId },
      data: { courierId: dto.courierId, status: DeliveryStatus.ASSIGNED },
    });
    this.realtime.emit('order.updated', delivery.branchId, orderId);
    return updated;
  }

  // ----------------------------------------------------------
  // PATCH /deliveries/:id/status — transición de estado
  // ----------------------------------------------------------
  async updateStatus(tenantId: string, orderId: string, dto: UpdateDeliveryStatusDto) {
    const delivery = await this.getDelivery(tenantId, orderId);

    if (delivery.status === dto.status) {
      return this.prisma.deliveryInfo.findUniqueOrThrow({ where: { orderId } });
    }
    if (!TRANSITIONS[delivery.status].includes(dto.status)) {
      throw new BadRequestException(
        `Transición inválida: ${delivery.status} → ${dto.status}`,
      );
    }
    if (dto.status === DeliveryStatus.ASSIGNED && !delivery.courierId) {
      throw new BadRequestException('Asigná un repartidor antes de pasar a ASSIGNED');
    }

    const updated = await this.prisma.deliveryInfo.update({
      where: { orderId },
      data: {
        status: dto.status,
        ...(dto.status === DeliveryStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
      },
    });
    this.realtime.emit('order.updated', delivery.branchId, orderId);
    return updated;
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------
  private async getDelivery(tenantId: string, orderId: string) {
    const delivery = await this.prisma.deliveryInfo.findFirst({
      where: { orderId, order: { tenantId } },
      include: { order: { select: { branchId: true } } },
    });
    if (!delivery) {
      throw new NotFoundException('Envío no encontrado');
    }
    return { ...delivery, branchId: delivery.order.branchId } as Prisma.DeliveryInfoGetPayload<object> & {
      branchId: string;
    };
  }
}
