import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderItemStatus, OrderStatus, TableStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { QueryKitchenItemsDto } from './dto/query-kitchen-items.dto';
import { UpdateKitchenItemStatusDto } from './dto/update-item-status.dto';

// Orden de la cadena de preparación: solo se avanza hacia adelante.
const FLOW: OrderItemStatus[] = [
  OrderItemStatus.SENT,
  OrderItemStatus.PREPARING,
  OrderItemStatus.READY,
  OrderItemStatus.DELIVERED,
];

const DEFAULT_STATUSES: OrderItemStatus[] = [
  OrderItemStatus.SENT,
  OrderItemStatus.PREPARING,
  OrderItemStatus.READY,
];

@Injectable()
export class KitchenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async findItems(tenantId: string, query: QueryKitchenItemsDto) {
    const statuses = query.statuses?.length ? query.statuses : DEFAULT_STATUSES;
    return this.prisma.orderItem.findMany({
      where: {
        status: { in: statuses },
        ...(query.station ? { station: query.station } : {}),
        order: {
          tenantId,
          status: OrderStatus.OPEN,
          ...(query.branchId ? { branchId: query.branchId } : {}),
        },
      },
      select: {
        id: true,
        status: true,
        quantity: true,
        notes: true,
        station: true,
        sentAt: true,
        readyAt: true,
        product: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            number: true,
            type: true,
            table: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ sentAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async updateStatus(
    tenantId: string,
    permissions: string[],
    itemId: string,
    dto: UpdateKitchenItemStatusDto,
  ) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, order: { tenantId } },
      include: {
        order: { select: { id: true, branchId: true, tableId: true, status: true } },
      },
    });
    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }
    if (item.order.status !== OrderStatus.OPEN) {
      throw new BadRequestException('El pedido no está abierto');
    }

    if (dto.status === OrderItemStatus.CANCELLED) {
      if (!permissions.includes('sales.cancel')) {
        throw new ForbiddenException('Cancelar un item requiere sales.cancel');
      }
      if (item.status === OrderItemStatus.CANCELLED) {
        throw new BadRequestException('El item ya está cancelado');
      }
    } else {
      const from = FLOW.indexOf(item.status);
      const to = FLOW.indexOf(dto.status);
      if (from === -1 || to === -1 || to <= from) {
        throw new BadRequestException(
          `Transición inválida: ${item.status} -> ${dto.status} (flujo SENT -> PREPARING -> READY -> DELIVERED)`,
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.orderItem.update({
        where: { id: itemId },
        data: {
          status: dto.status,
          ...(dto.status === OrderItemStatus.READY ? { readyAt: new Date() } : {}),
        },
      });

      // Si todos los items activos del pedido están listos (>= READY)
      // y la mesa esperaba cocina, vuelve a OCCUPIED.
      let tableUpdated = false;
      if (item.order.tableId) {
        const pendingCount = await tx.orderItem.count({
          where: {
            orderId: item.order.id,
            status: {
              in: [OrderItemStatus.PENDING, OrderItemStatus.SENT, OrderItemStatus.PREPARING],
            },
          },
        });
        if (pendingCount === 0) {
          const table = await tx.diningTable.findUnique({ where: { id: item.order.tableId } });
          if (table?.status === TableStatus.WAITING_KITCHEN) {
            await tx.diningTable.update({
              where: { id: table.id },
              data: { status: TableStatus.OCCUPIED },
            });
            tableUpdated = true;
          }
        }
      }
      return { updated, tableUpdated };
    });

    const branchId = item.order.branchId;
    this.realtime.emit('kitchen.updated', branchId, itemId);
    this.realtime.emit('order.updated', branchId, item.order.id);
    if (result.tableUpdated && item.order.tableId) {
      this.realtime.emit('table.updated', branchId, item.order.tableId);
    }
    return result.updated;
  }
}
