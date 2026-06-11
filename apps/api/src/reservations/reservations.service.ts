import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReservationStatus, TableStatus } from '@prisma/client';
import { DEFAULT_TIMEZONE, addDays, startOfDayInTz } from '../common/utils/timezone';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { QueryReservationsDto } from './dto/query-reservations.dto';
import { SeatReservationDto } from './dto/seat-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

type Tx = Prisma.TransactionClient;

const AUTO_BLOCK_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 horas

const ACTIVE_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
];

const FINAL_STATUSES: ReservationStatus[] = [
  ReservationStatus.SEATED,
  ReservationStatus.CANCELLED,
  ReservationStatus.NO_SHOW,
];

const BUSY_TABLE_STATUSES: TableStatus[] = [
  TableStatus.OCCUPIED,
  TableStatus.WAITING_KITCHEN,
  TableStatus.WAITING_BILL,
];

const RESERVATION_INCLUDE = {
  table: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
} satisfies Prisma.ReservationInclude;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async findAll(tenantId: string, query: QueryReservationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Default: hoy (TZ de la sucursal si se filtra por una)
    let from = query.from ? new Date(query.from) : undefined;
    let to = query.to ? new Date(query.to) : undefined;
    if (!query.from && !query.to) {
      let timezone = DEFAULT_TIMEZONE;
      if (query.branchId) {
        const branch = await this.prisma.branch.findFirst({
          where: { id: query.branchId, tenantId },
          select: { timezone: true },
        });
        timezone = branch?.timezone ?? DEFAULT_TIMEZONE;
      }
      from = startOfDayInTz(new Date(), timezone);
      to = startOfDayInTz(addDays(from, 1.5), timezone);
    }

    const where: Prisma.ReservationWhereInput = {
      branch: { tenantId },
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(from || to
        ? { scheduledAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } }
        : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.findMany({
        where,
        include: RESERVATION_INCLUDE,
        orderBy: { scheduledAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data, total };
  }

  async findOne(tenantId: string, id: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, branch: { tenantId } },
      include: RESERVATION_INCLUDE,
    });
    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada');
    }
    return reservation;
  }

  // ----------------------------------------------------------
  // Crear: bloqueo automático de mesa si scheduledAt cae dentro
  // de las próximas 2 horas y la mesa está FREE.
  // ----------------------------------------------------------
  async create(tenantId: string, dto: CreateReservationDto) {
    await this.assertBranch(tenantId, dto.branchId);
    if (dto.tableId) {
      await this.assertTableInBranch(tenantId, dto.tableId, dto.branchId);
    }
    if (dto.customerId) {
      await this.assertCustomer(tenantId, dto.customerId);
    }
    const scheduledAt = new Date(dto.scheduledAt);

    let blockedTableId: string | null = null;
    const reservation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reservation.create({
        data: {
          branchId: dto.branchId,
          tableId: dto.tableId,
          customerId: dto.customerId,
          name: dto.name,
          phone: dto.phone,
          partySize: dto.partySize,
          scheduledAt,
          notes: dto.notes,
          status: dto.status ?? ReservationStatus.PENDING,
        },
        include: RESERVATION_INCLUDE,
      });
      if (dto.tableId && this.isWithinBlockWindow(scheduledAt)) {
        blockedTableId = await this.blockTableIfFree(tx, dto.tableId);
      }
      return created;
    });

    if (blockedTableId) {
      this.realtime.emit('table.updated', dto.branchId, blockedTableId);
    }
    return this.findOne(tenantId, reservation.id);
  }

  // ----------------------------------------------------------
  // Edición + transiciones: PENDING↔CONFIRMED; CANCELLED y
  // NO_SHOW desde cualquier estado no final. Maneja bloqueo y
  // liberación de mesa.
  // ----------------------------------------------------------
  async update(tenantId: string, id: string, dto: UpdateReservationDto) {
    const reservation = await this.findOne(tenantId, id);

    if (FINAL_STATUSES.includes(reservation.status)) {
      throw new ConflictException('La reserva está en un estado final');
    }
    if (dto.status !== undefined) {
      this.assertTransition(reservation.status, dto.status);
    }

    const newTableId = dto.tableId !== undefined ? dto.tableId : reservation.tableId;
    if (newTableId && newTableId !== reservation.tableId) {
      await this.assertTableInBranch(tenantId, newTableId, reservation.branchId);
    }
    if (dto.customerId) {
      await this.assertCustomer(tenantId, dto.customerId);
    }

    const newScheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : reservation.scheduledAt;
    const newStatus = dto.status ?? reservation.status;
    const stillActive = ACTIVE_STATUSES.includes(newStatus);

    const touchedTables: string[] = [];
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.reservation.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.partySize !== undefined ? { partySize: dto.partySize } : {}),
          ...(dto.scheduledAt !== undefined ? { scheduledAt: newScheduledAt } : {}),
          ...(dto.tableId !== undefined ? { tableId: dto.tableId } : {}),
          ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: RESERVATION_INCLUDE,
      });

      // Liberar la mesa anterior si quedó RESERVED por esta reserva
      if (
        reservation.tableId &&
        (reservation.tableId !== newTableId || !stillActive)
      ) {
        const released = await this.releaseTableIfReserved(tx, reservation.tableId, id);
        if (released) {
          touchedTables.push(reservation.tableId);
        }
      }

      // Bloquear la mesa vigente si corresponde
      if (newTableId && stillActive && this.isWithinBlockWindow(newScheduledAt)) {
        const blocked = await this.blockTableIfFree(tx, newTableId);
        if (blocked) {
          touchedTables.push(blocked);
        }
      }
      return row;
    });

    for (const tableId of touchedTables) {
      this.realtime.emit('table.updated', reservation.branchId, tableId);
    }
    return updated;
  }

  // ----------------------------------------------------------
  // Sentar: reserva → SEATED y mesa → OCCUPIED (409 si ocupada)
  // ----------------------------------------------------------
  async seat(tenantId: string, id: string, dto: SeatReservationDto) {
    const reservation = await this.findOne(tenantId, id);
    if (!ACTIVE_STATUSES.includes(reservation.status)) {
      throw new ConflictException('Solo se pueden sentar reservas PENDING o CONFIRMED');
    }
    const tableId = dto.tableId ?? reservation.tableId;
    if (!tableId) {
      throw new BadRequestException('La reserva no tiene mesa asignada: indicá tableId');
    }
    const table = await this.assertTableInBranch(tenantId, tableId, reservation.branchId);
    if (BUSY_TABLE_STATUSES.includes(table.status)) {
      throw new ConflictException('La mesa está ocupada');
    }

    const touchedTables: string[] = [tableId];
    const seated = await this.prisma.$transaction(async (tx) => {
      // Si tenía otra mesa bloqueada, liberarla
      if (reservation.tableId && reservation.tableId !== tableId) {
        const released = await this.releaseTableIfReserved(tx, reservation.tableId, id);
        if (released) {
          touchedTables.push(reservation.tableId);
        }
      }
      await tx.diningTable.update({
        where: { id: tableId },
        data: { status: TableStatus.OCCUPIED },
      });
      return tx.reservation.update({
        where: { id },
        data: { status: ReservationStatus.SEATED, tableId },
        include: RESERVATION_INCLUDE,
      });
    });

    for (const touched of touchedTables) {
      this.realtime.emit('table.updated', reservation.branchId, touched);
    }
    return seated;
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  /** scheduledAt dentro de las próximas 2 horas. */
  private isWithinBlockWindow(scheduledAt: Date): boolean {
    const diff = scheduledAt.getTime() - Date.now();
    return diff >= 0 && diff <= AUTO_BLOCK_WINDOW_MS;
  }

  /** Mesa FREE → RESERVED. Devuelve el id si la bloqueó. */
  private async blockTableIfFree(tx: Tx, tableId: string): Promise<string | null> {
    const result = await tx.diningTable.updateMany({
      where: { id: tableId, status: TableStatus.FREE },
      data: { status: TableStatus.RESERVED },
    });
    return result.count > 0 ? tableId : null;
  }

  /**
   * Mesa RESERVED → FREE, salvo que otra reserva activa dentro de
   * la ventana de bloqueo la siga necesitando.
   */
  private async releaseTableIfReserved(
    tx: Tx,
    tableId: string,
    excludeReservationId: string,
  ): Promise<boolean> {
    const table = await tx.diningTable.findUnique({ where: { id: tableId } });
    if (!table || table.status !== TableStatus.RESERVED) {
      return false;
    }
    const now = new Date();
    const other = await tx.reservation.findFirst({
      where: {
        tableId,
        id: { not: excludeReservationId },
        status: { in: ACTIVE_STATUSES },
        scheduledAt: { gte: now, lte: new Date(now.getTime() + AUTO_BLOCK_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (other) {
      return false;
    }
    await tx.diningTable.update({ where: { id: tableId }, data: { status: TableStatus.FREE } });
    return true;
  }

  private assertTransition(current: ReservationStatus, target: ReservationStatus): void {
    if (current === target) {
      return;
    }
    const allowed: Record<string, ReservationStatus[]> = {
      [ReservationStatus.PENDING]: [
        ReservationStatus.CONFIRMED,
        ReservationStatus.CANCELLED,
        ReservationStatus.NO_SHOW,
      ],
      [ReservationStatus.CONFIRMED]: [
        ReservationStatus.PENDING,
        ReservationStatus.CANCELLED,
        ReservationStatus.NO_SHOW,
      ],
    };
    if (!(allowed[current] ?? []).includes(target)) {
      throw new ConflictException(`Transición de estado inválida: ${current} → ${target}`);
    }
  }

  private async assertBranch(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) {
      throw new BadRequestException('La sucursal no pertenece al tenant');
    }
  }

  private async assertCustomer(tenantId: string, customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!customer) {
      throw new BadRequestException('El cliente no pertenece al tenant');
    }
  }

  private async assertTableInBranch(tenantId: string, tableId: string, branchId: string) {
    const table = await this.prisma.diningTable.findFirst({
      where: { id: tableId, area: { branchId, branch: { tenantId } } },
    });
    if (!table) {
      throw new BadRequestException('La mesa no pertenece a la sucursal de la reserva');
    }
    return table;
  }
}
