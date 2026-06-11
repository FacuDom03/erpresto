import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CashMovementType, CashSessionStatus, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CloseSessionDto } from './dto/close-session.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { OpenSessionDto } from './dto/open-session.dto';
import { QueryRegistersDto } from './dto/query-registers.dto';
import { QuerySessionsDto } from './dto/query-sessions.dto';

type SessionWithDetail = Prisma.CashSessionGetPayload<{
  include: {
    register: { select: { id: true; name: true; branchId: true } };
    movements: true;
    payments: true;
  };
}>;

@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  // ----------------------------------------------------------
  // Cajas de la sucursal con su sesión abierta embebida
  // ----------------------------------------------------------
  async findRegisters(tenantId: string, query: QueryRegistersDto) {
    if (query.branchId) {
      await this.assertBranch(tenantId, query.branchId);
    }
    const registers = await this.prisma.cashRegister.findMany({
      where: {
        branch: { tenantId },
        ...(query.branchId ? { branchId: query.branchId } : {}),
        active: true,
      },
      include: {
        sessions: {
          where: { status: CashSessionStatus.OPEN },
          orderBy: { openedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });
    return registers.map(({ sessions, ...register }) => ({
      ...register,
      currentSession: sessions[0] ?? null,
    }));
  }

  // ----------------------------------------------------------
  // Apertura de sesión (409 si ya hay una abierta)
  // ----------------------------------------------------------
  async openSession(tenantId: string, userId: string, dto: OpenSessionDto) {
    const register = await this.prisma.cashRegister.findFirst({
      where: { id: dto.registerId, branch: { tenantId } },
    });
    if (!register) {
      throw new NotFoundException('Caja no encontrada');
    }
    const open = await this.prisma.cashSession.findFirst({
      where: { registerId: dto.registerId, status: CashSessionStatus.OPEN },
    });
    if (open) {
      throw new ConflictException({
        message: 'La caja ya tiene una sesión abierta',
        sessionId: open.id,
      });
    }

    const session = await this.prisma.cashSession.create({
      data: {
        registerId: dto.registerId,
        openedById: userId,
        openingAmount: new Prisma.Decimal(dto.openingAmount),
      },
      include: { register: { select: { id: true, name: true, branchId: true } } },
    });
    this.realtime.emit('cash.updated', register.branchId, session.id);
    return session;
  }

  // ----------------------------------------------------------
  // Detalle + resumen de la sesión
  // ----------------------------------------------------------
  async findSession(tenantId: string, id: string) {
    const session = await this.getSession(tenantId, id);
    return { ...session, summary: this.buildSummary(session) };
  }

  async findSessions(tenantId: string, query: QuerySessionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CashSessionWhereInput = {
      register: { branch: { tenantId } },
      ...(query.registerId ? { registerId: query.registerId } : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.cashSession.count({ where }),
      this.prisma.cashSession.findMany({
        where,
        include: { register: { select: { id: true, name: true, branchId: true } } },
        orderBy: { openedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data, total };
  }

  // ----------------------------------------------------------
  // Movimientos manuales (retiro, depósito, gasto, propina)
  // ----------------------------------------------------------
  async addMovement(tenantId: string, userId: string, id: string, dto: CreateMovementDto) {
    const session = await this.getSession(tenantId, id);
    if (session.status !== CashSessionStatus.OPEN) {
      throw new ConflictException('La sesión de caja está cerrada');
    }
    const movement = await this.prisma.cashMovement.create({
      data: {
        sessionId: id,
        type: dto.type,
        amount: new Prisma.Decimal(dto.amount),
        notes: dto.notes,
        userId,
      },
    });
    this.realtime.emit('cash.updated', session.register.branchId, id);
    return movement;
  }

  // ----------------------------------------------------------
  // Cierre con arqueo: expectedAmount y difference
  // ----------------------------------------------------------
  async closeSession(tenantId: string, userId: string, id: string, dto: CloseSessionDto) {
    const session = await this.getSession(tenantId, id);
    if (session.status !== CashSessionStatus.OPEN) {
      throw new ConflictException('La sesión de caja ya está cerrada');
    }

    const summary = this.buildSummary(session);
    const expectedAmount = new Prisma.Decimal(summary.expectedAmount);
    const closingAmount = new Prisma.Decimal(dto.closingAmount);
    const difference = closingAmount.sub(expectedAmount);

    const closed = await this.prisma.cashSession.update({
      where: { id },
      data: {
        status: CashSessionStatus.CLOSED,
        closedById: userId,
        closingAmount,
        expectedAmount,
        difference,
        closedAt: new Date(),
      },
      include: {
        register: { select: { id: true, name: true, branchId: true } },
        movements: true,
        payments: true,
      },
    });
    this.realtime.emit('cash.updated', session.register.branchId, id);
    return { ...closed, summary };
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  /**
   * expectedAmount = apertura + ventas CASH de la sesión
   *                + depósitos − retiros − gastos.
   */
  private buildSummary(session: SessionWithDetail) {
    const zero = new Prisma.Decimal(0);

    const salesByMethod: Record<string, string> = {};
    let cashSales = zero;
    for (const method of Object.values(PaymentMethod)) {
      const sum = session.payments
        .filter((p) => p.method === method)
        .reduce((acc, p) => acc.add(p.amount), zero);
      if (!sum.isZero()) {
        salesByMethod[method] = sum.toFixed(2);
      }
      if (method === PaymentMethod.CASH) {
        cashSales = sum;
      }
    }
    const totalSales = session.payments.reduce((acc, p) => acc.add(p.amount), zero);

    const sumMovements = (type: CashMovementType) =>
      session.movements
        .filter((m) => m.type === type)
        .reduce((acc, m) => acc.add(m.amount), zero);

    const deposits = sumMovements(CashMovementType.DEPOSIT);
    const withdrawals = sumMovements(CashMovementType.WITHDRAWAL);
    const expenses = sumMovements(CashMovementType.EXPENSE);
    const tips = sumMovements(CashMovementType.TIP);

    const expectedAmount = session.openingAmount
      .add(cashSales)
      .add(deposits)
      .sub(withdrawals)
      .sub(expenses);

    return {
      openingAmount: session.openingAmount.toFixed(2),
      salesByMethod,
      totalSales: totalSales.toFixed(2),
      cashSales: cashSales.toFixed(2),
      deposits: deposits.toFixed(2),
      withdrawals: withdrawals.toFixed(2),
      expenses: expenses.toFixed(2),
      tips: tips.toFixed(2),
      expectedAmount: expectedAmount.toFixed(2),
    };
  }

  private async getSession(tenantId: string, id: string): Promise<SessionWithDetail> {
    const session = await this.prisma.cashSession.findFirst({
      where: { id, register: { branch: { tenantId } } },
      include: {
        register: { select: { id: true, name: true, branchId: true } },
        movements: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) {
      throw new NotFoundException('Sesión de caja no encontrada');
    }
    return session;
  }

  private async assertBranch(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) {
      throw new BadRequestException('La sucursal no pertenece al tenant');
    }
  }
}
