import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, PurchaseStatus, RawMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto, CreatePurchaseOrderItemDto } from './dto/create-purchase-order.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

type Tx = Prisma.TransactionClient;

const PO_DETAIL_INCLUDE = {
  supplier: { select: { id: true, name: true, cuit: true } },
  branch: { select: { id: true, name: true } },
  items: {
    include: { rawMaterial: { select: { id: true, name: true, unit: true } } },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.PurchaseOrderInclude;

type PoDetail = Prisma.PurchaseOrderGetPayload<{ include: typeof PO_DETAIL_INCLUDE }>;

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------
  // Crear OC: numeración correlativa por tenant con retry ante
  // colisión del unique (tenantId, number), total server-side.
  // ----------------------------------------------------------
  async create(tenantId: string, userId: string, dto: CreatePurchaseOrderDto) {
    await this.assertBranch(tenantId, dto.branchId);
    await this.assertSupplier(tenantId, dto.supplierId);
    await this.assertRawMaterials(tenantId, dto.items);

    const total = this.computeTotal(dto.items);
    const maxAttempts = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const agg = await tx.purchaseOrder.aggregate({
            where: { tenantId },
            _max: { number: true },
          });
          const number = (agg._max.number ?? 0) + 1;
          return tx.purchaseOrder.create({
            data: {
              tenantId,
              branchId: dto.branchId,
              supplierId: dto.supplierId,
              number,
              notes: dto.notes,
              expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : undefined,
              total,
              userId,
              items: {
                create: dto.items.map((item) => ({
                  rawMaterialId: item.rawMaterialId,
                  quantity: new Prisma.Decimal(item.quantity),
                  unitCost: new Prisma.Decimal(item.unitCost),
                })),
              },
            },
            include: PO_DETAIL_INCLUDE,
          });
        });
        return this.mapDetail(created);
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

  async findAll(tenantId: string, query: QueryPurchaseOrdersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const searchNumber = Number(query.search);
    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.search
        ? {
            OR: [
              { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
              ...(Number.isInteger(searchNumber) && searchNumber > 0
                ? [{ number: searchNumber }]
                : []),
            ],
          }
        : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data: data.map(({ _count, total: poTotal, ...po }) => ({
        ...po,
        total: Number(poTotal),
        itemsCount: _count.items,
      })),
      total,
    };
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: PO_DETAIL_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException('Orden de compra no encontrada');
    }
    return this.mapDetail(order);
  }

  // ----------------------------------------------------------
  // Edición: solo DRAFT; items (si vienen) reemplazan todo.
  // ----------------------------------------------------------
  async update(tenantId: string, id: string, dto: UpdatePurchaseOrderDto) {
    const order = await this.getOrder(tenantId, id);
    if (order.status !== PurchaseStatus.DRAFT) {
      throw new ConflictException('Solo se pueden editar órdenes en estado DRAFT');
    }
    if (dto.supplierId) {
      await this.assertSupplier(tenantId, dto.supplierId);
    }
    if (dto.items) {
      await this.assertRawMaterials(tenantId, dto.items);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
        await tx.purchaseOrderItem.createMany({
          data: dto.items.map((item) => ({
            purchaseOrderId: id,
            rawMaterialId: item.rawMaterialId,
            quantity: new Prisma.Decimal(item.quantity),
            unitCost: new Prisma.Decimal(item.unitCost),
          })),
        });
      }
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
          ...(dto.expectedAt !== undefined ? { expectedAt: new Date(dto.expectedAt) } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.items ? { total: this.computeTotal(dto.items) } : {}),
        },
        include: PO_DETAIL_INCLUDE,
      });
    });
    return this.mapDetail(updated);
  }

  async send(tenantId: string, id: string) {
    const order = await this.getOrder(tenantId, id);
    if (order.status !== PurchaseStatus.DRAFT) {
      throw new ConflictException('Solo se pueden enviar órdenes en estado DRAFT');
    }
    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseStatus.SENT },
      include: PO_DETAIL_INCLUDE,
    });
    return this.mapDetail(updated);
  }

  async cancel(tenantId: string, id: string) {
    const order = await this.getOrder(tenantId, id);
    if (order.status !== PurchaseStatus.DRAFT && order.status !== PurchaseStatus.SENT) {
      throw new ConflictException('Solo se pueden cancelar órdenes DRAFT o SENT');
    }
    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseStatus.CANCELLED },
      include: PO_DETAIL_INCLUDE,
    });
    return this.mapDetail(updated);
  }

  // ----------------------------------------------------------
  // Recepción parcial o total (transaccional). Por cada item:
  // StockBatch + RawStockMovement PURCHASE + receivedQty, y
  // actualización de lastCost / avgCost por promedio ponderado:
  //   avgCost' = (stockTotal*avgCost + qty*unitCost) / (stockTotal+qty)
  //   (si stockTotal <= 0 => avgCost' = unitCost)
  // donde stockTotal = stock total del insumo en el tenant ANTES
  // de la recepción (suma de todos sus StockBatch).
  // ----------------------------------------------------------
  async receive(tenantId: string, userId: string, id: string, dto: ReceivePurchaseOrderDto) {
    const received = await this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findFirst({
        where: { id, tenantId },
        include: { items: { include: { rawMaterial: { select: { name: true } } } } },
      });
      if (!order) {
        throw new NotFoundException('Orden de compra no encontrada');
      }
      if (
        order.status !== PurchaseStatus.SENT &&
        order.status !== PurchaseStatus.PARTIALLY_RECEIVED
      ) {
        throw new ConflictException(
          'Solo se pueden recibir órdenes en estado SENT o PARTIALLY_RECEIVED',
        );
      }

      const warehouse = await tx.warehouse.findFirst({
        where: { id: dto.warehouseId, branch: { tenantId } },
      });
      if (!warehouse) {
        throw new BadRequestException('El depósito no pertenece al tenant');
      }
      if (warehouse.branchId !== order.branchId) {
        throw new BadRequestException('El depósito no pertenece a la sucursal de la orden');
      }

      const itemById = new Map(order.items.map((i) => [i.id, i]));
      // receivedQty acumulado en memoria para soportar el mismo
      // item repetido dentro de la misma recepción.
      const runningReceived = new Map(order.items.map((i) => [i.id, i.receivedQty]));

      for (const recv of dto.items) {
        const item = itemById.get(recv.itemId);
        if (!item) {
          throw new BadRequestException(`El item ${recv.itemId} no pertenece a la orden`);
        }
        const qty = new Prisma.Decimal(recv.quantity);
        const pending = item.quantity.sub(runningReceived.get(item.id)!);
        if (qty.greaterThan(pending)) {
          throw new UnprocessableEntityException(
            `La cantidad recibida (${qty.toString()}) de "${item.rawMaterial.name}" excede lo pendiente (${pending.toString()})`,
          );
        }
        const unitCost =
          recv.unitCost !== undefined ? new Prisma.Decimal(recv.unitCost) : item.unitCost;

        // Stock total del insumo en el tenant ANTES de esta recepción
        const stockAgg = await tx.stockBatch.aggregate({
          where: { rawMaterialId: item.rawMaterialId, warehouse: { branch: { tenantId } } },
          _sum: { quantity: true },
        });
        const stockTotal = stockAgg._sum.quantity ?? new Prisma.Decimal(0);
        const material = await tx.rawMaterial.findUniqueOrThrow({
          where: { id: item.rawMaterialId },
          select: { avgCost: true },
        });
        const newAvgCost = stockTotal.lessThanOrEqualTo(0)
          ? unitCost
          : stockTotal
              .mul(material.avgCost)
              .add(qty.mul(unitCost))
              .div(stockTotal.add(qty))
              .toDecimalPlaces(4);

        await tx.stockBatch.create({
          data: {
            warehouseId: dto.warehouseId,
            rawMaterialId: item.rawMaterialId,
            lotCode: recv.lotCode,
            quantity: qty,
            unitCost,
            expiresAt: recv.expiresAt ? new Date(recv.expiresAt) : undefined,
          },
        });
        await tx.rawStockMovement.create({
          data: {
            warehouseId: dto.warehouseId,
            rawMaterialId: item.rawMaterialId,
            type: RawMovementType.PURCHASE,
            quantity: qty,
            unitCost,
            reference: order.id,
            userId,
          },
        });
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQty: { increment: qty } },
        });
        await tx.rawMaterial.update({
          where: { id: item.rawMaterialId },
          data: { lastCost: unitCost, avgCost: newAvgCost },
        });
        runningReceived.set(item.id, runningReceived.get(item.id)!.add(qty));
      }

      const allComplete = order.items.every((i) =>
        runningReceived.get(i.id)!.greaterThanOrEqualTo(i.quantity),
      );
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          status: allComplete ? PurchaseStatus.RECEIVED : PurchaseStatus.PARTIALLY_RECEIVED,
        },
        include: PO_DETAIL_INCLUDE,
      });
    });
    return this.mapDetail(received);
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private computeTotal(items: CreatePurchaseOrderItemDto[]): Prisma.Decimal {
    return items
      .reduce(
        (acc, i) => acc.add(new Prisma.Decimal(i.quantity).mul(new Prisma.Decimal(i.unitCost))),
        new Prisma.Decimal(0),
      )
      .toDecimalPlaces(2);
  }

  /** Decimals como números en las respuestas. */
  private mapDetail(order: PoDetail) {
    return {
      ...order,
      total: Number(order.total),
      items: order.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        receivedQty: Number(item.receivedQty),
        unitCost: Number(item.unitCost),
      })),
    };
  }

  private async getOrder(tenantId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!order) {
      throw new NotFoundException('Orden de compra no encontrada');
    }
    return order;
  }

  private async assertBranch(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) {
      throw new BadRequestException('La sucursal no pertenece al tenant');
    }
  }

  private async assertSupplier(tenantId: string, supplierId: string): Promise<void> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });
    if (!supplier) {
      throw new BadRequestException('El proveedor no pertenece al tenant');
    }
  }

  private async assertRawMaterials(
    tenantId: string,
    items: CreatePurchaseOrderItemDto[],
  ): Promise<void> {
    const ids = [...new Set(items.map((i) => i.rawMaterialId))];
    const count = await this.prisma.rawMaterial.count({
      where: { id: { in: ids }, tenantId },
    });
    if (count !== ids.length) {
      throw new BadRequestException('Una o más materias primas no pertenecen al tenant');
    }
  }
}
