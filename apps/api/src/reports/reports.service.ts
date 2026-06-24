import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { DEFAULT_TIMEZONE, formatDateInTz, startOfDayInTz } from '../common/utils/timezone';
import { PrismaService } from '../prisma/prisma.service';
import { QueryReportDto } from './dto/query-report.dto';
import { ReportData } from './report.types';

export type ReportKey =
  | 'sales'
  | 'products'
  | 'waiters'
  | 'cash'
  | 'stock'
  | 'purchases';

interface RangeContext {
  tenantId: string;
  tenantName: string;
  branchId?: string;
  timezone: string;
  /** Inicio del rango (UTC) o null si abierto. */
  fromDate: Date | null;
  /** Fin del rango EXCLUSIVO (UTC) o null si abierto. */
  toDate: Date | null;
  fromLabel: string | null;
  toLabel: string | null;
}

const num = (v: unknown): number => Number(v ?? 0);
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(tenantId: string, key: ReportKey, query: QueryReportDto): Promise<ReportData> {
    const ctx = await this.resolveRange(tenantId, query);
    switch (key) {
      case 'sales':
        return this.salesReport(ctx, query.groupBy ?? 'day');
      case 'products':
        return this.productsReport(ctx);
      case 'waiters':
        return this.waitersReport(ctx);
      case 'cash':
        return this.cashReport(ctx);
      case 'stock':
        return this.stockReport(ctx);
      case 'purchases':
        return this.purchasesReport(ctx);
      default:
        throw new BadRequestException(`Reporte desconocido: ${key}`);
    }
  }

  // ----------------------------------------------------------
  // Resolución de rango/timezone (TZ de la sucursal)
  // ----------------------------------------------------------
  private async resolveRange(tenantId: string, query: QueryReportDto): Promise<RangeContext> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true },
    });

    let timezone = DEFAULT_TIMEZONE;
    if (query.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: query.branchId, tenantId },
        select: { timezone: true },
      });
      if (!branch) {
        throw new NotFoundException('Sucursal no encontrada');
      }
      timezone = branch.timezone;
    }

    // from/to vienen como fechas (YYYY-MM-DD). Interpretamos en TZ de sucursal:
    // from = inicio del día; to = inicio del día siguiente (exclusivo).
    const fromDate = query.from ? startOfDayInTz(new Date(query.from), timezone) : null;
    const toDate = query.to
      ? startOfDayInTz(new Date(new Date(query.to).getTime() + 86_400_000), timezone)
      : null;

    return {
      tenantId,
      tenantName: tenant.name,
      branchId: query.branchId,
      timezone,
      fromDate,
      toDate,
      fromLabel: query.from ?? null,
      toLabel: query.to ?? null,
    };
  }

  private dateFilter(ctx: RangeContext): Prisma.DateTimeFilter | undefined {
    if (!ctx.fromDate && !ctx.toDate) {
      return undefined;
    }
    return {
      ...(ctx.fromDate ? { gte: ctx.fromDate } : {}),
      ...(ctx.toDate ? { lt: ctx.toDate } : {}),
    };
  }

  private meta(ctx: RangeContext, title: string): ReportData['meta'] {
    return { title, tenantName: ctx.tenantName, from: ctx.fromLabel, to: ctx.toLabel };
  }

  // ----------------------------------------------------------
  // 1. Ventas (groupBy day | method | type)
  // ----------------------------------------------------------
  private async salesReport(ctx: RangeContext, groupBy: string): Promise<ReportData> {
    const closedAt = this.dateFilter(ctx);
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: OrderStatus.CLOSED,
        ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
        ...(closedAt ? { closedAt } : {}),
      },
      select: {
        id: true,
        type: true,
        total: true,
        closedAt: true,
        payments: { select: { method: true, amount: true } },
      },
    });

    const buckets = new Map<string, { amount: number; count: number }>();
    const add = (k: string, amount: number, count: number): void => {
      const b = buckets.get(k) ?? { amount: 0, count: 0 };
      b.amount += amount;
      b.count += count;
      buckets.set(k, b);
    };

    if (groupBy === 'method') {
      for (const o of orders) {
        for (const p of o.payments) {
          add(p.method, num(p.amount), 0);
        }
      }
      // contar pedidos no aplica directo por método; contamos pagos
      for (const o of orders) {
        for (const p of o.payments) {
          const b = buckets.get(p.method)!;
          b.count += 1;
        }
      }
    } else if (groupBy === 'type') {
      for (const o of orders) {
        add(o.type, num(o.total), 1);
      }
    } else {
      // day
      for (const o of orders) {
        const day = o.closedAt ? formatDateInTz(o.closedAt, ctx.timezone) : 'sin fecha';
        add(day, num(o.total), 1);
      }
    }

    const groupLabel =
      groupBy === 'method' ? 'Método' : groupBy === 'type' ? 'Tipo' : 'Día';
    const rows = [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ group: k, count: v.count, amount: round2(v.amount) }));

    const totalAmount = round2(rows.reduce((a, r) => a + r.amount, 0));
    const totalCount = rows.reduce((a, r) => a + r.count, 0);

    return {
      columns: [
        { key: 'group', label: groupLabel, type: 'string' },
        { key: 'count', label: 'Cantidad', type: 'number' },
        { key: 'amount', label: 'Total', type: 'currency' },
      ],
      rows,
      totals: { count: totalCount, amount: totalAmount },
      meta: this.meta(ctx, `Ventas por ${groupLabel.toLowerCase()}`),
    };
  }

  // ----------------------------------------------------------
  // 2. Productos vendidos (cantidad, total, margen si hay costo)
  // ----------------------------------------------------------
  private async productsReport(ctx: RangeContext): Promise<ReportData> {
    const closedAt = this.dateFilter(ctx);
    const items = await this.prisma.orderItem.findMany({
      where: {
        NOT: { status: 'CANCELLED' },
        order: {
          tenantId: ctx.tenantId,
          status: OrderStatus.CLOSED,
          ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
          ...(closedAt ? { closedAt } : {}),
        },
      },
      select: {
        quantity: true,
        unitPrice: true,
        product: {
          select: {
            id: true,
            name: true,
            recipe: { select: { items: { select: { quantity: true, rawMaterial: { select: { avgCost: true } } } } } },
          },
        },
      },
    });

    const byProduct = new Map<
      string,
      { name: string; quantity: number; total: number; cost: number }
    >();
    for (const it of items) {
      const p = it.product;
      const qty = num(it.quantity);
      const lineTotal = qty * num(it.unitPrice);
      // costo unitario por receta (si hay)
      const unitCost = (p.recipe?.items ?? []).reduce(
        (a, ri) => a + num(ri.quantity) * num(ri.rawMaterial.avgCost),
        0,
      );
      const b = byProduct.get(p.id) ?? { name: p.name, quantity: 0, total: 0, cost: 0 };
      b.quantity += qty;
      b.total += lineTotal;
      b.cost += unitCost * qty;
      byProduct.set(p.id, b);
    }

    const rows = [...byProduct.values()]
      .sort((a, b) => b.total - a.total)
      .map((v) => ({
        name: v.name,
        quantity: round2(v.quantity),
        total: round2(v.total),
        cost: round2(v.cost),
        margin: round2(v.total - v.cost),
      }));

    const totals = {
      quantity: round2(rows.reduce((a, r) => a + r.quantity, 0)),
      total: round2(rows.reduce((a, r) => a + r.total, 0)),
      cost: round2(rows.reduce((a, r) => a + r.cost, 0)),
      margin: round2(rows.reduce((a, r) => a + r.margin, 0)),
    };

    return {
      columns: [
        { key: 'name', label: 'Producto', type: 'string' },
        { key: 'quantity', label: 'Cantidad', type: 'number' },
        { key: 'total', label: 'Total vendido', type: 'currency' },
        { key: 'cost', label: 'Costo', type: 'currency' },
        { key: 'margin', label: 'Margen', type: 'currency' },
      ],
      rows,
      totals,
      meta: this.meta(ctx, 'Productos vendidos'),
    };
  }

  // ----------------------------------------------------------
  // 3. Ventas por mozo (pedidos, total, ticket promedio)
  // ----------------------------------------------------------
  private async waitersReport(ctx: RangeContext): Promise<ReportData> {
    const closedAt = this.dateFilter(ctx);
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: OrderStatus.CLOSED,
        ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
        ...(closedAt ? { closedAt } : {}),
      },
      select: { waiterId: true, total: true },
    });

    const waiterIds = [...new Set(orders.map((o) => o.waiterId).filter((x): x is string => !!x))];
    const users = waiterIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: waiterIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const nameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    const byWaiter = new Map<string, { name: string; count: number; total: number }>();
    for (const o of orders) {
      const key = o.waiterId ?? 'sin-mozo';
      const name = o.waiterId ? (nameById.get(o.waiterId) ?? 'Desconocido') : 'Sin asignar';
      const b = byWaiter.get(key) ?? { name, count: 0, total: 0 };
      b.count += 1;
      b.total += num(o.total);
      byWaiter.set(key, b);
    }

    const rows = [...byWaiter.values()]
      .sort((a, b) => b.total - a.total)
      .map((v) => ({
        name: v.name,
        count: v.count,
        total: round2(v.total),
        avgTicket: round2(v.count > 0 ? v.total / v.count : 0),
      }));

    const totalCount = rows.reduce((a, r) => a + r.count, 0);
    const totalAmount = round2(rows.reduce((a, r) => a + r.total, 0));

    return {
      columns: [
        { key: 'name', label: 'Mozo', type: 'string' },
        { key: 'count', label: 'Pedidos', type: 'number' },
        { key: 'total', label: 'Total', type: 'currency' },
        { key: 'avgTicket', label: 'Ticket promedio', type: 'currency' },
      ],
      rows,
      totals: {
        count: totalCount,
        total: totalAmount,
        avgTicket: round2(totalCount > 0 ? totalAmount / totalCount : 0),
      },
      meta: this.meta(ctx, 'Ventas por mozo'),
    };
  }

  // ----------------------------------------------------------
  // 4. Sesiones de caja (apertura, ventas, esperado, diferencia)
  // ----------------------------------------------------------
  private async cashReport(ctx: RangeContext): Promise<ReportData> {
    const openedAt = this.dateFilter(ctx);
    const sessions = await this.prisma.cashSession.findMany({
      where: {
        register: { branch: { tenantId: ctx.tenantId, ...(ctx.branchId ? { id: ctx.branchId } : {}) } },
        ...(openedAt ? { openedAt } : {}),
      },
      include: {
        register: { select: { name: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    const rows = sessions.map((s) => {
      const sales = round2(s.payments.reduce((a, p) => a + num(p.amount), 0));
      return {
        register: s.register.name,
        status: s.status,
        openedAt: s.openedAt ? formatDateInTz(s.openedAt, ctx.timezone) : '',
        opening: round2(num(s.openingAmount)),
        sales,
        expected: s.expectedAmount !== null ? round2(num(s.expectedAmount)) : null,
        closing: s.closingAmount !== null ? round2(num(s.closingAmount)) : null,
        difference: s.difference !== null ? round2(num(s.difference)) : null,
      };
    });

    const totals = {
      opening: round2(rows.reduce((a, r) => a + r.opening, 0)),
      sales: round2(rows.reduce((a, r) => a + r.sales, 0)),
      difference: round2(rows.reduce((a, r) => a + (r.difference ?? 0), 0)),
    };

    return {
      columns: [
        { key: 'register', label: 'Caja', type: 'string' },
        { key: 'status', label: 'Estado', type: 'string' },
        { key: 'openedAt', label: 'Apertura', type: 'date' },
        { key: 'opening', label: 'Monto inicial', type: 'currency' },
        { key: 'sales', label: 'Ventas', type: 'currency' },
        { key: 'expected', label: 'Esperado', type: 'currency' },
        { key: 'closing', label: 'Cierre', type: 'currency' },
        { key: 'difference', label: 'Diferencia', type: 'currency' },
      ],
      rows,
      totals,
      meta: this.meta(ctx, 'Sesiones de caja'),
    };
  }

  // ----------------------------------------------------------
  // 5. Stock: existencias actuales (MP + producción) + movimientos del rango
  // ----------------------------------------------------------
  private async stockReport(ctx: RangeContext): Promise<ReportData> {
    const occurredAt = this.dateFilter(ctx);

    // Existencias de materia prima (suma de lotes por depósito de la sucursal)
    const batches = await this.prisma.stockBatch.findMany({
      where: {
        warehouse: { branch: { tenantId: ctx.tenantId, ...(ctx.branchId ? { id: ctx.branchId } : {}) } },
      },
      select: { rawMaterialId: true, quantity: true, rawMaterial: { select: { name: true, unit: true } } },
    });
    const rawByItem = new Map<string, { name: string; unit: string; qty: number }>();
    for (const b of batches) {
      const e = rawByItem.get(b.rawMaterialId) ?? {
        name: b.rawMaterial.name,
        unit: b.rawMaterial.unit,
        qty: 0,
      };
      e.qty += num(b.quantity);
      rawByItem.set(b.rawMaterialId, e);
    }

    // Movimientos de MP del rango
    const rawMoves = await this.prisma.rawStockMovement.groupBy({
      by: ['rawMaterialId'],
      where: {
        warehouse: { branch: { tenantId: ctx.tenantId, ...(ctx.branchId ? { id: ctx.branchId } : {}) } },
        ...(occurredAt ? { occurredAt } : {}),
      },
      _sum: { quantity: true },
    });
    const rawMovesById = new Map(rawMoves.map((m) => [m.rawMaterialId, num(m._sum?.quantity)]));

    // Existencias de producción (platos)
    const productStocks = await this.prisma.productStock.findMany({
      where: {
        branch: { tenantId: ctx.tenantId, ...(ctx.branchId ? { id: ctx.branchId } : {}) },
      },
      select: { productId: true, quantity: true, product: { select: { name: true } } },
    });
    // ProductStockMovement no tiene relación branch; resolvemos los
    // branchId del tenant (o el filtrado) y usamos branchId IN (...).
    const branchIds = ctx.branchId
      ? [ctx.branchId]
      : (
          await this.prisma.branch.findMany({
            where: { tenantId: ctx.tenantId },
            select: { id: true },
          })
        ).map((b) => b.id);
    const prodMoves = await this.prisma.productStockMovement.groupBy({
      by: ['productId'],
      where: {
        branchId: { in: branchIds },
        ...(occurredAt ? { occurredAt } : {}),
      },
      _sum: { quantity: true },
    });
    const prodMovesById = new Map(
      prodMoves.map((m) => [m.productId, num(m._sum?.quantity)]),
    );

    const rows: Record<string, unknown>[] = [];
    for (const [id, e] of rawByItem) {
      rows.push({
        kind: 'Materia prima',
        name: e.name,
        unit: e.unit,
        stock: round2(e.qty),
        movement: round2(rawMovesById.get(id) ?? 0),
      });
    }
    for (const ps of productStocks) {
      rows.push({
        kind: 'Producción',
        name: ps.product.name,
        unit: 'UNIT',
        stock: round2(num(ps.quantity)),
        movement: round2(prodMovesById.get(ps.productId) ?? 0),
      });
    }
    rows.sort((a, b) =>
      String(a.kind).localeCompare(String(b.kind)) || String(a.name).localeCompare(String(b.name)),
    );

    return {
      columns: [
        { key: 'kind', label: 'Tipo', type: 'string' },
        { key: 'name', label: 'Item', type: 'string' },
        { key: 'unit', label: 'Unidad', type: 'string' },
        { key: 'stock', label: 'Existencia actual', type: 'number' },
        { key: 'movement', label: 'Movimiento del rango', type: 'number' },
      ],
      rows,
      totals: {},
      meta: this.meta(ctx, 'Existencias y movimientos de stock'),
    };
  }

  // ----------------------------------------------------------
  // 6. Compras por proveedor (órdenes, total, recibido)
  // ----------------------------------------------------------
  private async purchasesReport(ctx: RangeContext): Promise<ReportData> {
    const createdAt = this.dateFilter(ctx);
    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      select: {
        total: true,
        supplier: { select: { id: true, name: true } },
        items: { select: { quantity: true, receivedQty: true, unitCost: true } },
      },
    });

    const bySupplier = new Map<
      string,
      { name: string; orders: number; total: number; received: number }
    >();
    for (const po of pos) {
      const receivedValue = po.items.reduce((a, it) => a + num(it.receivedQty) * num(it.unitCost), 0);
      const b = bySupplier.get(po.supplier.id) ?? {
        name: po.supplier.name,
        orders: 0,
        total: 0,
        received: 0,
      };
      b.orders += 1;
      b.total += num(po.total);
      b.received += receivedValue;
      bySupplier.set(po.supplier.id, b);
    }

    const rows = [...bySupplier.values()]
      .sort((a, b) => b.total - a.total)
      .map((v) => ({
        supplier: v.name,
        orders: v.orders,
        total: round2(v.total),
        received: round2(v.received),
      }));

    const totals = {
      orders: rows.reduce((a, r) => a + r.orders, 0),
      total: round2(rows.reduce((a, r) => a + r.total, 0)),
      received: round2(rows.reduce((a, r) => a + r.received, 0)),
    };

    return {
      columns: [
        { key: 'supplier', label: 'Proveedor', type: 'string' },
        { key: 'orders', label: 'Órdenes', type: 'number' },
        { key: 'total', label: 'Total comprado', type: 'currency' },
        { key: 'received', label: 'Recibido (valorizado)', type: 'currency' },
      ],
      rows,
      totals,
      meta: this.meta(ctx, 'Compras por proveedor'),
    };
  }
}
