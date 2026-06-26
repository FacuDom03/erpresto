import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CashSessionStatus,
  OrderItemStatus,
  OrderStatus,
  Prisma,
  ProductMovementType,
  RawMovementType,
  StockConfigMode,
  StockLinkMode,
  TableStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AddItemsDto } from './dto/add-items.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { FireOrderDto } from './dto/fire-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderItemDto } from './dto/update-item.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

type Tx = Prisma.TransactionClient;

// Course por defecto según nombre de categoría (sin match => 1)
const COURSE_BY_CATEGORY: Record<string, number> = {
  Entradas: 1,
  'Platos principales': 2,
  Postres: 3,
  Bebidas: 1,
};

function defaultCourseForCategory(categoryName: string | null | undefined): number {
  if (!categoryName) {
    return 1;
  }
  return COURSE_BY_CATEGORY[categoryName] ?? 1;
}

const ORDER_INCLUDE = {
  items: { include: { product: { select: { id: true, name: true, sku: true } } } },
  payments: true,
  table: { select: { id: true, name: true, status: true } },
  customer: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  // ----------------------------------------------------------
  // Crear pedido: numeración correlativa por sucursal con
  // retry simple ante colisión del unique (branchId, number).
  // ----------------------------------------------------------
  async create(tenantId: string, userId: string, dto: CreateOrderDto) {
    await this.assertBranch(tenantId, dto.branchId);
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, tenantId },
      });
      if (!customer) {
        throw new BadRequestException('El cliente no pertenece al tenant');
      }
    }
    if (dto.tableId) {
      await this.assertTableInBranch(tenantId, dto.tableId, dto.branchId);
    }

    const maxAttempts = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        const order = await this.prisma.$transaction(async (tx) => {
          if (dto.tableId) {
            const existing = await tx.order.findFirst({
              where: { tableId: dto.tableId, status: OrderStatus.OPEN },
              select: { id: true },
            });
            if (existing) {
              throw new ConflictException({
                message: 'La mesa ya tiene un pedido abierto',
                orderId: existing.id,
              });
            }
          }

          const agg = await tx.order.aggregate({
            where: { branchId: dto.branchId },
            _max: { number: true },
          });
          const number = (agg._max.number ?? 0) + 1;

          const created = await tx.order.create({
            data: {
              tenantId,
              branchId: dto.branchId,
              tableId: dto.tableId,
              customerId: dto.customerId,
              type: dto.type,
              number,
              waiterId: userId,
              peopleCount: dto.peopleCount,
            },
            include: ORDER_INCLUDE,
          });

          if (dto.tableId) {
            await tx.diningTable.update({
              where: { id: dto.tableId },
              data: { status: TableStatus.OCCUPIED },
            });
          }
          return created;
        });

        this.realtime.emit('order.updated', order.branchId, order.id);
        if (order.tableId) {
          this.realtime.emit('table.updated', order.branchId, order.tableId);
        }
        return order;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < maxAttempts
        ) {
          continue; // colisión de numeración: reintentar
        }
        throw error;
      }
    }
  }

  async findAll(tenantId: string, query: QueryOrdersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OrderWhereInput = {
      tenantId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.tableId ? { tableId: query.tableId } : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { openedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data, total };
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: ORDER_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }
    return order;
  }

  // ----------------------------------------------------------
  // Editar pedido (descuento, propina, transferencia de mesa)
  // ----------------------------------------------------------
  async update(tenantId: string, id: string, dto: UpdateOrderDto) {
    const order = await this.assertOpenOrder(tenantId, id);

    if (dto.tableId && dto.tableId !== order.tableId) {
      await this.assertTableInBranch(tenantId, dto.tableId, order.branchId);
      const busy = await this.prisma.order.findFirst({
        where: { tableId: dto.tableId, status: OrderStatus.OPEN, NOT: { id } },
        select: { id: true },
      });
      if (busy) {
        throw new ConflictException({
          message: 'La mesa destino ya tiene un pedido abierto',
          orderId: busy.id,
        });
      }
    }
    if (dto.waiterId) {
      const waiter = await this.prisma.user.findFirst({
        where: { id: dto.waiterId, tenantId },
      });
      if (!waiter) {
        throw new BadRequestException('El mozo no pertenece al tenant');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.tableId && dto.tableId !== order.tableId) {
        if (order.tableId) {
          await tx.diningTable.update({
            where: { id: order.tableId },
            data: { status: TableStatus.FREE },
          });
        }
        await tx.diningTable.update({
          where: { id: dto.tableId },
          data: { status: TableStatus.OCCUPIED },
        });
      }
      await tx.order.update({
        where: { id },
        data: {
          ...(dto.discount !== undefined ? { discount: new Prisma.Decimal(dto.discount) } : {}),
          ...(dto.tip !== undefined ? { tip: new Prisma.Decimal(dto.tip) } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.peopleCount !== undefined ? { peopleCount: dto.peopleCount } : {}),
          ...(dto.tableId !== undefined ? { tableId: dto.tableId } : {}),
          ...(dto.waiterId !== undefined ? { waiterId: dto.waiterId } : {}),
        },
      });
      return this.recalcTotals(tx, id);
    });

    this.realtime.emit('order.updated', order.branchId, id);
    if (dto.tableId && dto.tableId !== order.tableId) {
      if (order.tableId) {
        this.realtime.emit('table.updated', order.branchId, order.tableId);
      }
      this.realtime.emit('table.updated', order.branchId, dto.tableId);
    }
    return updated;
  }

  // ----------------------------------------------------------
  // Items
  // ----------------------------------------------------------
  async addItems(tenantId: string, id: string, dto: AddItemsDto) {
    const order = await this.assertOpenOrder(tenantId, id);

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, tenantId, active: true },
      include: {
        category: {
          select: { name: true, defaultStation: true, defaultRequiresPreparation: true },
        },
      },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Uno o más productos no pertenecen al tenant o están inactivos');
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.createMany({
        data: dto.items.map((item) => {
          const product = productById.get(item.productId)!;
          // Snapshot de estación: producto, con fallback a la categoría.
          const station = product.printStation ?? product.category?.defaultStation ?? null;
          // Snapshot de requiresPrep: producto, fallback a categoría, default true.
          const requiresPrep =
            product.requiresPreparation ?? product.category?.defaultRequiresPreparation ?? true;
          // Course: override por ítem, si no default por categoría.
          const course = item.course ?? defaultCourseForCategory(product.category?.name);
          return {
            orderId: id,
            productId: item.productId,
            quantity: new Prisma.Decimal(item.quantity),
            unitPrice: product.price,
            station,
            requiresPrep,
            course,
            notes: item.notes,
            status: OrderItemStatus.PENDING,
          };
        }),
      });
      return this.recalcTotals(tx, id);
    });

    this.realtime.emit('order.updated', order.branchId, id);
    return updated;
  }

  async updateItem(
    tenantId: string,
    userId: string,
    permissions: string[],
    id: string,
    itemId: string,
    dto: UpdateOrderItemDto,
  ) {
    const order = await this.assertOpenOrder(tenantId, id);
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId: id },
      include: { product: { include: { recipe: { include: { items: true } } } } },
    });
    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }
    if (item.status === OrderItemStatus.CANCELLED) {
      throw new BadRequestException('El item ya está cancelado');
    }

    // Anular un ítem ya marchado (no PENDING) revierte su stock.
    const cancellingFired =
      dto.status === OrderItemStatus.CANCELLED && item.status !== OrderItemStatus.PENDING;
    if (dto.status === OrderItemStatus.CANCELLED) {
      if (item.status !== OrderItemStatus.PENDING && !permissions.includes('sales.cancel')) {
        throw new ForbiddenException('Cancelar un item ya enviado requiere sales.cancel');
      }
    } else if (item.status !== OrderItemStatus.PENDING) {
      throw new BadRequestException('Solo se pueden editar items pendientes');
    }

    let tenantStockMode: StockConfigMode | null = null;
    let defaultWarehouseId: string | null = null;
    if (cancellingFired) {
      const tenant = await this.prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { stockMode: true },
      });
      tenantStockMode = tenant.stockMode;
      defaultWarehouseId = await this.findDefaultWarehouseId(order.branchId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          ...(dto.quantity !== undefined ? { quantity: new Prisma.Decimal(dto.quantity) } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      if (cancellingFired && tenantStockMode !== null) {
        await this.revertStockForItem(tx, {
          item,
          branchId: order.branchId,
          orderId: id,
          tenantStockMode,
          defaultWarehouseId,
          userId,
        });
        await tx.auditLog.create({
          data: {
            tenantId,
            userId,
            action: 'sales.cancel',
            entity: 'OrderItem',
            entityId: itemId,
            data: {
              orderId: id,
              productId: item.productId,
              quantity: item.quantity,
              previousStatus: item.status,
              reverted: item.product.trackStock,
            },
          },
        });
      }

      return this.recalcTotals(tx, id);
    });

    this.realtime.emit('order.updated', order.branchId, id);
    if (cancellingFired) {
      this.realtime.emit('kitchen.updated', order.branchId, itemId);
    }
    return updated;
  }

  async removeItem(tenantId: string, id: string, itemId: string) {
    const order = await this.assertOpenOrder(tenantId, id);
    const item = await this.prisma.orderItem.findFirst({ where: { id: itemId, orderId: id } });
    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }
    if (item.status !== OrderItemStatus.PENDING) {
      throw new BadRequestException('Solo se pueden eliminar items pendientes');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({ where: { id: itemId } });
      return this.recalcTotals(tx, id);
    });
    this.realtime.emit('order.updated', order.branchId, id);
    return updated;
  }

  // ----------------------------------------------------------
  // Marchar (reemplaza "enviar a cocina"). Descuenta stock acá.
  // ----------------------------------------------------------
  async fire(tenantId: string, userId: string, id: string, dto: FireOrderDto = {}) {
    const order = await this.assertOpenOrder(tenantId, id);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { stockMode: true },
    });
    const defaultWarehouseId = await this.findDefaultWarehouseId(order.branchId);

    // Ítems PENDING a marchar (todos o de un course concreto).
    const toFire = await this.prisma.orderItem.findMany({
      where: {
        orderId: id,
        status: OrderItemStatus.PENDING,
        ...(dto.course !== undefined ? { course: dto.course } : {}),
      },
      include: { product: { include: { recipe: { include: { items: true } } } } },
    });
    if (toFire.length === 0) {
      throw new BadRequestException(
        dto.course !== undefined
          ? `El pedido no tiene items pendientes en el tiempo ${dto.course}`
          : 'El pedido no tiene items pendientes de marchar',
      );
    }

    const anyPrep = toFire.some((i) => i.requiresPrep);
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of toFire) {
        if (item.requiresPrep) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: { status: OrderItemStatus.SENT, firedAt: now, sentAt: now },
          });
        } else {
          // No pasa por KDS: directo a READY.
          await tx.orderItem.update({
            where: { id: item.id },
            data: { status: OrderItemStatus.READY, firedAt: now, readyAt: now },
          });
        }
        // Descuento de stock AL MARCHAR (idempotente: solo PENDING→…).
        await this.deductStockForItem(tx, {
          item,
          branchId: order.branchId,
          orderId: id,
          tenantStockMode: tenant.stockMode,
          defaultWarehouseId,
          userId,
        });
      }

      // La mesa pasa a WAITING_KITCHEN solo si se marchó algún ítem requiresPrep.
      if (order.tableId && anyPrep) {
        await tx.diningTable.update({
          where: { id: order.tableId },
          data: { status: TableStatus.WAITING_KITCHEN },
        });
      }
      return tx.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
    });

    this.realtime.emit('order.updated', order.branchId, id);
    this.realtime.emit('kitchen.updated', order.branchId, id);
    if (order.tableId && anyPrep) {
      this.realtime.emit('table.updated', order.branchId, order.tableId);
    }
    return updated;
  }

  /** Alias retrocompatible: marcha todo el pedido (sin course). */
  async send(tenantId: string, userId: string, id: string) {
    return this.fire(tenantId, userId, id, {});
  }

  // ----------------------------------------------------------
  // Mozo entrega: READY -> DELIVERED
  // ----------------------------------------------------------
  async deliverItem(tenantId: string, id: string, itemId: string) {
    const order = await this.assertOpenOrder(tenantId, id);
    const item = await this.prisma.orderItem.findFirst({ where: { id: itemId, orderId: id } });
    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }
    if (item.status !== OrderItemStatus.READY) {
      throw new BadRequestException('Solo se pueden entregar items que están listos (READY)');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: itemId },
        data: { status: OrderItemStatus.DELIVERED, deliveredAt: new Date() },
      });
      return tx.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
    });
    this.realtime.emit('order.updated', order.branchId, id);
    return updated;
  }

  async deliverAll(tenantId: string, id: string) {
    const order = await this.assertOpenOrder(tenantId, id);
    const ready = await this.prisma.orderItem.count({
      where: { orderId: id, status: OrderItemStatus.READY },
    });
    if (ready === 0) {
      throw new BadRequestException('El pedido no tiene items listos para entregar');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { orderId: id, status: OrderItemStatus.READY },
        data: { status: OrderItemStatus.DELIVERED, deliveredAt: new Date() },
      });
      return tx.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
    });
    this.realtime.emit('order.updated', order.branchId, id);
    return updated;
  }

  // ----------------------------------------------------------
  // Pedir la cuenta
  // ----------------------------------------------------------
  async requestBill(tenantId: string, id: string) {
    const order = await this.assertOpenOrder(tenantId, id);
    if (!order.tableId) {
      throw new BadRequestException('El pedido no tiene mesa asignada');
    }
    await this.prisma.diningTable.update({
      where: { id: order.tableId },
      data: { status: TableStatus.WAITING_BILL },
    });
    this.realtime.emit('table.updated', order.branchId, order.tableId);
    this.realtime.emit('order.updated', order.branchId, id);
    return this.findOne(tenantId, id);
  }

  async cancelBillRequest(tenantId: string, id: string) {
    const order = await this.assertOpenOrder(tenantId, id);
    if (!order.tableId) {
      throw new BadRequestException('El pedido no tiene mesa asignada');
    }
    const table = await this.prisma.diningTable.findUnique({ where: { id: order.tableId } });
    if (table?.status === TableStatus.WAITING_BILL) {
      await this.prisma.diningTable.update({
        where: { id: order.tableId },
        data: { status: TableStatus.OCCUPIED },
      });
      this.realtime.emit('table.updated', order.branchId, order.tableId);
    }
    this.realtime.emit('order.updated', order.branchId, id);
    return this.findOne(tenantId, id);
  }

  // ----------------------------------------------------------
  // Pagos
  // ----------------------------------------------------------
  async addPayment(tenantId: string, id: string, dto: AddPaymentDto) {
    const order = await this.assertOpenOrder(tenantId, id);
    const session = await this.findOpenSession(order.branchId);

    const payment = await this.prisma.payment.create({
      data: {
        orderId: id,
        method: dto.method,
        amount: new Prisma.Decimal(dto.amount),
        reference: dto.reference,
        cashSessionId: session?.id ?? null,
      },
    });

    this.realtime.emit('order.updated', order.branchId, id);
    if (session) {
      this.realtime.emit('cash.updated', order.branchId, session.id);
    }
    return payment;
  }

  async removePayment(tenantId: string, id: string, paymentId: string) {
    const order = await this.assertOpenOrder(tenantId, id);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, orderId: id },
    });
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }
    await this.prisma.payment.delete({ where: { id: paymentId } });
    this.realtime.emit('order.updated', order.branchId, id);
    return { success: true };
  }

  // ----------------------------------------------------------
  // Cierre: valida pagos, libera mesa, imputa pagos a la
  // sesión de caja abierta y descuenta stock según modo.
  // ----------------------------------------------------------
  async close(tenantId: string, userId: string, id: string) {
    const orderHead = await this.assertOpenOrder(tenantId, id);
    const session = await this.findOpenSession(orderHead.branchId);

    const closed = await this.prisma.$transaction(async (tx) => {
      const totals = await this.recalcTotals(tx, id);

      const payments = await tx.payment.findMany({ where: { orderId: id } });
      const paid = payments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
      if (paid.lessThan(totals.total)) {
        throw new BadRequestException(
          `Pagos insuficientes: pagado ${paid.toFixed(2)} de ${totals.total.toFixed(2)}`,
        );
      }

      // Imputar pagos sin sesión a la sesión abierta de la sucursal
      if (session) {
        await tx.payment.updateMany({
          where: { orderId: id, cashSessionId: null },
          data: { cashSessionId: session.id },
        });
      }

      const order = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CLOSED, closedAt: new Date() },
        include: ORDER_INCLUDE,
      });

      if (order.tableId) {
        await tx.diningTable.update({
          where: { id: order.tableId },
          data: { status: TableStatus.FREE },
        });
      }

      // El stock se descuenta al MARCHAR (fire), no al cerrar.

      return order;
    });

    this.realtime.emit('order.updated', closed.branchId, id);
    if (closed.tableId) {
      this.realtime.emit('table.updated', closed.branchId, closed.tableId);
    }
    if (session) {
      this.realtime.emit('cash.updated', closed.branchId, session.id);
    }
    return this.findOne(tenantId, id);
  }

  // ----------------------------------------------------------
  // Cancelación: libera mesa, NO toca stock, audita.
  // ----------------------------------------------------------
  async cancel(tenantId: string, userId: string, id: string) {
    const order = await this.assertOpenOrder(tenantId, id);

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED, closedAt: new Date() },
        include: ORDER_INCLUDE,
      });
      if (order.tableId) {
        await tx.diningTable.update({
          where: { id: order.tableId },
          data: { status: TableStatus.FREE },
        });
      }
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'sales.cancel',
          entity: 'Order',
          entityId: id,
          data: { number: order.number, branchId: order.branchId, total: order.total },
        },
      });
      return updated;
    });

    this.realtime.emit('order.updated', order.branchId, id);
    this.realtime.emit('kitchen.updated', order.branchId, id);
    if (order.tableId) {
      this.realtime.emit('table.updated', order.branchId, order.tableId);
    }
    return cancelled;
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  /** Totales SIEMPRE recalculados server-side. */
  private async recalcTotals(tx: Tx, orderId: string) {
    const items = await tx.orderItem.findMany({
      where: { orderId, NOT: { status: OrderItemStatus.CANCELLED } },
      select: { quantity: true, unitPrice: true },
    });
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { discount: true, tip: true },
    });
    const subtotal = items.reduce(
      (acc, i) => acc.add(i.quantity.mul(i.unitPrice)),
      new Prisma.Decimal(0),
    );
    const total = subtotal.sub(order.discount).add(order.tip);
    return tx.order.update({
      where: { id: orderId },
      data: { subtotal, total },
      include: ORDER_INCLUDE,
    });
  }

  /**
   * Descuento de stock de UN ítem al marchar (regla central):
   * - NONE o trackStock=false: no descuenta.
   * - INDEPENDENT / LINKED_MANUAL: ProductStock -qty (movimiento SALE).
   * - LINKED_AUTO: ProductStock -qty y, si hay receta activa,
   *   materia prima (SALE_CONSUME) en el depósito default.
   * Sin receta NO falla; el stock puede quedar negativo.
   */
  private async deductStockForItem(
    tx: Tx,
    params: {
      item: Prisma.OrderItemGetPayload<{
        include: { product: { include: { recipe: { include: { items: true } } } } };
      }>;
      branchId: string;
      orderId: string;
      tenantStockMode: StockConfigMode;
      defaultWarehouseId: string | null;
      userId: string;
    },
  ): Promise<void> {
    const { item, branchId, orderId, tenantStockMode, defaultWarehouseId, userId } = params;
    const product = item.product;
    const mode = this.effectiveStockMode(product.stockLinkMode, tenantStockMode);
    if (mode === StockLinkMode.NONE || !product.trackStock) {
      return;
    }

    // Descuento de stock de platos (todos los modos restantes)
    const qty = item.quantity;
    await tx.productStock.upsert({
      where: { branchId_productId: { branchId, productId: product.id } },
      create: { branchId, productId: product.id, quantity: qty.negated() },
      update: { quantity: { decrement: qty } },
    });
    await tx.productStockMovement.create({
      data: {
        branchId,
        productId: product.id,
        type: ProductMovementType.SALE,
        quantity: qty.negated(),
        reference: orderId,
        userId,
      },
    });

    // Descuento de materia prima vía receta (solo LINKED_AUTO)
    const recipe = product.recipe;
    if (
      mode !== StockLinkMode.LINKED_AUTO ||
      !recipe?.active ||
      recipe.items.length === 0 ||
      !defaultWarehouseId
    ) {
      return;
    }
    const yieldQty = Number(recipe.yieldQuantity) || 1;
    for (const recipeItem of recipe.items) {
      const consumedQty = (Number(recipeItem.quantity) * Number(item.quantity)) / yieldQty;
      if (consumedQty <= 0) {
        continue;
      }
      const consumed = new Prisma.Decimal(consumedQty.toFixed(3));

      await tx.rawStockMovement.create({
        data: {
          warehouseId: defaultWarehouseId,
          rawMaterialId: recipeItem.rawMaterialId,
          type: RawMovementType.SALE_CONSUME,
          quantity: consumed.negated(),
          reference: orderId,
          userId,
        },
      });

      // El stock de materia prima vive en lotes: descuenta del
      // más antiguo (puede quedar negativo, nunca bloquea).
      const batch = await tx.stockBatch.findFirst({
        where: { warehouseId: defaultWarehouseId, rawMaterialId: recipeItem.rawMaterialId },
        orderBy: { createdAt: 'asc' },
      });
      if (batch) {
        await tx.stockBatch.update({
          where: { id: batch.id },
          data: { quantity: { decrement: consumed } },
        });
      } else {
        await tx.stockBatch.create({
          data: {
            warehouseId: defaultWarehouseId,
            rawMaterialId: recipeItem.rawMaterialId,
            quantity: consumed.negated(),
          },
        });
      }
    }
  }

  /**
   * Revierte el descuento de stock de un ítem ya marchado (anulación).
   * Crea movimientos inversos (ADJUSTMENT de producción y devolución de
   * materia prima si aplicó) por la cantidad del ítem. Mismas reglas de modo.
   */
  private async revertStockForItem(
    tx: Tx,
    params: {
      item: Prisma.OrderItemGetPayload<{
        include: { product: { include: { recipe: { include: { items: true } } } } };
      }>;
      branchId: string;
      orderId: string;
      tenantStockMode: StockConfigMode;
      defaultWarehouseId: string | null;
      userId: string;
    },
  ): Promise<void> {
    const { item, branchId, orderId, tenantStockMode, defaultWarehouseId, userId } = params;
    const product = item.product;
    const mode = this.effectiveStockMode(product.stockLinkMode, tenantStockMode);
    if (mode === StockLinkMode.NONE || !product.trackStock) {
      return;
    }

    // Devuelve el stock de platos (+qty), movimiento ADJUSTMENT.
    const qty = item.quantity;
    await tx.productStock.upsert({
      where: { branchId_productId: { branchId, productId: product.id } },
      create: { branchId, productId: product.id, quantity: qty },
      update: { quantity: { increment: qty } },
    });
    await tx.productStockMovement.create({
      data: {
        branchId,
        productId: product.id,
        type: ProductMovementType.ADJUSTMENT,
        quantity: qty,
        reference: orderId,
        notes: 'Reverso por anulación de ítem marchado',
        userId,
      },
    });

    // Devuelve materia prima vía receta (solo LINKED_AUTO)
    const recipe = product.recipe;
    if (
      mode !== StockLinkMode.LINKED_AUTO ||
      !recipe?.active ||
      recipe.items.length === 0 ||
      !defaultWarehouseId
    ) {
      return;
    }
    const yieldQty = Number(recipe.yieldQuantity) || 1;
    for (const recipeItem of recipe.items) {
      const consumedQty = (Number(recipeItem.quantity) * Number(item.quantity)) / yieldQty;
      if (consumedQty <= 0) {
        continue;
      }
      const consumed = new Prisma.Decimal(consumedQty.toFixed(3));

      await tx.rawStockMovement.create({
        data: {
          warehouseId: defaultWarehouseId,
          rawMaterialId: recipeItem.rawMaterialId,
          type: RawMovementType.ADJUSTMENT,
          quantity: consumed,
          reference: orderId,
          notes: 'Reverso por anulación de ítem marchado',
          userId,
        },
      });

      const batch = await tx.stockBatch.findFirst({
        where: { warehouseId: defaultWarehouseId, rawMaterialId: recipeItem.rawMaterialId },
        orderBy: { createdAt: 'asc' },
      });
      if (batch) {
        await tx.stockBatch.update({
          where: { id: batch.id },
          data: { quantity: { increment: consumed } },
        });
      } else {
        await tx.stockBatch.create({
          data: {
            warehouseId: defaultWarehouseId,
            rawMaterialId: recipeItem.rawMaterialId,
            quantity: consumed,
          },
        });
      }
    }
  }

  private effectiveStockMode(
    productMode: StockLinkMode,
    tenantMode: StockConfigMode,
  ): StockLinkMode {
    if (productMode !== StockLinkMode.INHERIT) {
      return productMode;
    }
    switch (tenantMode) {
      case StockConfigMode.RAW_ONLY:
      case StockConfigMode.AUTO_CONVERSION:
        return StockLinkMode.LINKED_AUTO;
      case StockConfigMode.MANUAL_ASSISTED:
        return StockLinkMode.LINKED_MANUAL;
      case StockConfigMode.PRODUCTION_ONLY:
      case StockConfigMode.BOTH_INDEPENDENT:
      case StockConfigMode.PER_PRODUCT:
      default:
        return StockLinkMode.INDEPENDENT;
    }
  }

  private async findOpenSession(branchId: string) {
    return this.prisma.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN, register: { branchId } },
    });
  }

  private async findDefaultWarehouseId(branchId: string): Promise<string | null> {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { branchId, isDefault: true, active: true },
    });
    if (warehouse) {
      return warehouse.id;
    }
    const fallback = await this.prisma.warehouse.findFirst({
      where: { branchId, active: true },
    });
    return fallback?.id ?? null;
  }

  private async assertOpenOrder(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, tenantId } });
    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }
    if (order.status !== OrderStatus.OPEN) {
      throw new ConflictException('El pedido no está abierto');
    }
    return order;
  }

  private async assertBranch(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) {
      throw new BadRequestException('La sucursal no pertenece al tenant');
    }
  }

  private async assertTableInBranch(
    tenantId: string,
    tableId: string,
    branchId: string,
  ): Promise<void> {
    const table = await this.prisma.diningTable.findFirst({
      where: { id: tableId, area: { branchId, branch: { tenantId } } },
    });
    if (!table) {
      throw new BadRequestException('La mesa no pertenece a la sucursal del pedido');
    }
  }
}
