import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CashMovementType,
  CashSessionStatus,
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  Prisma,
  ReservationStatus,
  TableShape,
  TableStatus,
} from '@prisma/client';
import {
  addDays,
  DEFAULT_TIMEZONE,
  formatDateInTz,
  startOfDayInTz,
} from '../common/utils/timezone';
import { PrismaService } from '../prisma/prisma.service';

const OCCUPIED_STATUSES: TableStatus[] = [
  TableStatus.OCCUPIED,
  TableStatus.WAITING_KITCHEN,
  TableStatus.WAITING_BILL,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string, branchId?: string) {
    let timezone = DEFAULT_TIMEZONE;
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
      if (!branch) {
        throw new BadRequestException('La sucursal no pertenece al tenant');
      }
      timezone = branch.timezone;
    }

    const now = new Date();
    const startToday = startOfDayInTz(now, timezone);
    const weekStart = startOfDayInTz(addDays(now, -6), timezone);
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const branchFilter = branchId ? { branchId } : {};
    const closedWhere: Prisma.OrderWhereInput = {
      tenantId,
      ...branchFilter,
      status: OrderStatus.CLOSED,
    };
    const tableWhere: Prisma.DiningTableWhereInput = {
      active: true,
      NOT: { shape: TableShape.DECOR },
      area: { branch: { tenantId, ...(branchId ? { id: branchId } : {}) } },
    };

    const [
      todayAgg,
      paymentsByMethod,
      weekOrders,
      weekItems,
      openOrders,
      tablesTotal,
      tablesOccupied,
      openSessions,
      rawMaterialsWithMin,
      rawStockSums,
      productStocks,
      upcomingReservations,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: { ...closedWhere, closedAt: { gte: startToday } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { order: { ...closedWhere, closedAt: { gte: startToday } } },
        _sum: { amount: true },
      }),
      this.prisma.order.findMany({
        where: { ...closedWhere, closedAt: { gte: weekStart } },
        select: { closedAt: true, total: true },
      }),
      this.prisma.orderItem.findMany({
        where: {
          order: { ...closedWhere, closedAt: { gte: weekStart } },
          NOT: { status: OrderItemStatus.CANCELLED },
        },
        select: { productId: true, quantity: true, unitPrice: true },
      }),
      this.prisma.order.count({
        where: { tenantId, ...branchFilter, status: OrderStatus.OPEN },
      }),
      this.prisma.diningTable.count({ where: tableWhere }),
      this.prisma.diningTable.count({
        where: { ...tableWhere, status: { in: OCCUPIED_STATUSES } },
      }),
      this.prisma.cashSession.findMany({
        where: {
          status: CashSessionStatus.OPEN,
          register: { branch: { tenantId, ...(branchId ? { id: branchId } : {}) } },
        },
        include: { payments: true, movements: true },
      }),
      this.prisma.rawMaterial.findMany({
        where: { tenantId, active: true, minStock: { not: null } },
        select: { id: true, name: true, unit: true, minStock: true },
      }),
      this.prisma.stockBatch.groupBy({
        by: ['rawMaterialId'],
        where: {
          rawMaterial: { tenantId, active: true, minStock: { not: null } },
          warehouse: { branch: { tenantId, ...(branchId ? { id: branchId } : {}) } },
        },
        _sum: { quantity: true },
      }),
      this.prisma.productStock.findMany({
        where: {
          ...branchFilter,
          branch: { tenantId },
          product: { tenantId, active: true, minStock: { not: null } },
        },
        select: {
          quantity: true,
          product: { select: { name: true, minStock: true } },
        },
      }),
      this.prisma.reservation.count({
        where: {
          branch: { tenantId },
          ...branchFilter,
          scheduledAt: { gte: now, lt: in24h },
          NOT: { status: ReservationStatus.CANCELLED },
        },
      }),
    ]);

    // --- Ventas de hoy ---
    const salesTodayTotal = Number(todayAgg._sum.total ?? 0);
    const salesTodayCount = todayAgg._count;
    const salesToday = {
      total: this.round2(salesTodayTotal),
      count: salesTodayCount,
      avgTicket: salesTodayCount > 0 ? this.round2(salesTodayTotal / salesTodayCount) : 0,
    };

    const salesByMethod = paymentsByMethod.map((p) => ({
      method: p.method as PaymentMethod,
      total: this.round2(Number(p._sum.amount ?? 0)),
    }));

    // --- Ventas de los últimos 7 días (incl. hoy) ---
    const weekTotals = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      weekTotals.set(formatDateInTz(addDays(now, -i), timezone), 0);
    }
    for (const order of weekOrders) {
      if (!order.closedAt) {
        continue;
      }
      const date = formatDateInTz(order.closedAt, timezone);
      if (weekTotals.has(date)) {
        weekTotals.set(date, weekTotals.get(date)! + Number(order.total));
      }
    }
    const weekSales = [...weekTotals.entries()].map(([date, total]) => ({
      date,
      total: this.round2(total),
    }));

    // --- Top 5 productos últimos 7 días ---
    const byProduct = new Map<string, { quantity: number; total: number }>();
    for (const item of weekItems) {
      const acc = byProduct.get(item.productId) ?? { quantity: 0, total: 0 };
      const qty = Number(item.quantity);
      acc.quantity += qty;
      acc.total += qty * Number(item.unitPrice);
      byProduct.set(item.productId, acc);
    }
    const topEntries = [...byProduct.entries()]
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 5);
    const topProductRows = await this.prisma.product.findMany({
      where: { id: { in: topEntries.map(([id]) => id) } },
      select: { id: true, name: true },
    });
    const productNameById = new Map(topProductRows.map((p) => [p.id, p.name]));
    const topProducts = topEntries.map(([productId, agg]) => ({
      name: productNameById.get(productId) ?? productId,
      quantity: this.round3(agg.quantity),
      total: this.round2(agg.total),
    }));

    // --- Caja: sesiones abiertas (consolidado: sumadas) ---
    let cash: { open: boolean; expectedAmount: number } | null = null;
    if (openSessions.length > 0) {
      const expected = openSessions.reduce((acc, session) => {
        const cashSales = session.payments
          .filter((p) => p.method === PaymentMethod.CASH)
          .reduce((s, p) => s + Number(p.amount), 0);
        const movements = session.movements.reduce((s, m) => {
          switch (m.type) {
            case CashMovementType.DEPOSIT:
              return s + Number(m.amount);
            case CashMovementType.WITHDRAWAL:
            case CashMovementType.EXPENSE:
              return s - Number(m.amount);
            default:
              return s;
          }
        }, 0);
        return acc + Number(session.openingAmount) + cashSales + movements;
      }, 0);
      cash = { open: true, expectedAmount: this.round2(expected) };
    }

    // --- Materias primas críticas (stock total < minStock) ---
    const rawStockById = new Map(
      rawStockSums.map((row) => [row.rawMaterialId, Number(row._sum.quantity ?? 0)]),
    );
    const criticalRaw = rawMaterialsWithMin
      .map((m) => ({
        name: m.name,
        unit: m.unit,
        minStock: Number(m.minStock),
        totalStock: this.round3(rawStockById.get(m.id) ?? 0),
      }))
      .filter((m) => m.totalStock < m.minStock)
      .sort((a, b) => a.totalStock - a.minStock - (b.totalStock - b.minStock));

    // --- Productos críticos (ProductStock.quantity < product.minStock) ---
    const criticalProd = productStocks
      .map((s) => ({
        name: s.product.name,
        quantity: this.round3(Number(s.quantity)),
        minStock: Number(s.product.minStock),
      }))
      .filter((s) => s.quantity < s.minStock)
      .sort((a, b) => a.quantity - a.minStock - (b.quantity - b.minStock));

    return {
      salesToday,
      salesByMethod,
      weekSales,
      topProducts,
      openOrders,
      tables: { occupied: tablesOccupied, total: tablesTotal },
      cash,
      criticalRawMaterials: { count: criticalRaw.length, items: criticalRaw.slice(0, 5) },
      criticalProducts: { count: criticalProd.length, items: criticalProd.slice(0, 5) },
      upcomingReservations,
    };
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private round3(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}
