import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateTableDto } from './dto/create-table.dto';
import { SaveLayoutDto } from './dto/layout.dto';
import { MergeTableDto } from './dto/merge-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

const LAYOUT_FIELDS: (keyof UpdateTableDto)[] = [
  'areaId',
  'name',
  'shape',
  'capacity',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'color',
  'active',
];

type TableWithBranch = Prisma.DiningTableGetPayload<{
  include: { area: { select: { id: true; branchId: true } } };
}>;

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(tenantId: string, dto: CreateTableDto) {
    const area = await this.prisma.area.findFirst({
      where: { id: dto.areaId, branch: { tenantId } },
    });
    if (!area) {
      throw new BadRequestException('El área no pertenece al tenant');
    }
    const table = await this.prisma.diningTable.create({
      data: {
        areaId: dto.areaId,
        name: dto.name,
        shape: dto.shape,
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.x !== undefined ? { x: dto.x } : {}),
        ...(dto.y !== undefined ? { y: dto.y } : {}),
        ...(dto.width !== undefined ? { width: dto.width } : {}),
        ...(dto.height !== undefined ? { height: dto.height } : {}),
        ...(dto.rotation !== undefined ? { rotation: dto.rotation } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
    });
    this.realtime.emit('table.updated', area.branchId, table.id);
    return table;
  }

  /**
   * Layout (posición, forma, área, nombre...) requiere `tables.update`;
   * el cambio puramente operativo de `status` alcanza con `tables.view`.
   */
  async update(tenantId: string, permissions: string[], id: string, dto: UpdateTableDto) {
    const table = await this.findOne(tenantId, id);

    const touchesLayout = LAYOUT_FIELDS.some((f) => dto[f] !== undefined);
    if (touchesLayout && !permissions.includes('tables.update')) {
      throw new ForbiddenException('Permisos faltantes: tables.update');
    }

    let branchId = table.area.branchId;
    if (dto.areaId && dto.areaId !== table.areaId) {
      const area = await this.prisma.area.findFirst({
        where: { id: dto.areaId, branch: { tenantId } },
      });
      if (!area) {
        throw new BadRequestException('El área no pertenece al tenant');
      }
      branchId = area.branchId;
    }

    const updated = await this.prisma.diningTable.update({
      where: { id },
      data: {
        ...(dto.areaId !== undefined ? { areaId: dto.areaId } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.shape !== undefined ? { shape: dto.shape } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.x !== undefined ? { x: dto.x } : {}),
        ...(dto.y !== undefined ? { y: dto.y } : {}),
        ...(dto.width !== undefined ? { width: dto.width } : {}),
        ...(dto.height !== undefined ? { height: dto.height } : {}),
        ...(dto.rotation !== undefined ? { rotation: dto.rotation } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    this.realtime.emit('table.updated', branchId, updated.id);
    return updated;
  }

  async remove(tenantId: string, id: string) {
    const table = await this.findOne(tenantId, id);
    const openOrders = await this.prisma.order.count({
      where: { tableId: id, status: OrderStatus.OPEN },
    });
    if (openOrders > 0) {
      throw new ConflictException('La mesa tiene un pedido abierto');
    }
    await this.prisma.diningTable.delete({ where: { id } });
    this.realtime.emit('table.updated', table.area.branchId, id);
    return { success: true };
  }

  async saveLayout(tenantId: string, dto: SaveLayoutDto) {
    const ids = dto.tables.map((t) => t.id);
    const tables = await this.prisma.diningTable.findMany({
      where: { id: { in: ids }, area: { branch: { tenantId } } },
      include: { area: { select: { id: true, branchId: true } } },
    });
    if (tables.length !== new Set(ids).size) {
      throw new BadRequestException('Una o más mesas no pertenecen al tenant');
    }

    await this.prisma.$transaction(
      dto.tables.map((t) =>
        this.prisma.diningTable.update({
          where: { id: t.id },
          data: {
            ...(t.x !== undefined ? { x: t.x } : {}),
            ...(t.y !== undefined ? { y: t.y } : {}),
            ...(t.width !== undefined ? { width: t.width } : {}),
            ...(t.height !== undefined ? { height: t.height } : {}),
            ...(t.rotation !== undefined ? { rotation: t.rotation } : {}),
          },
        }),
      ),
    );

    const branchIds = new Set(tables.map((t) => t.area.branchId));
    for (const table of tables) {
      this.realtime.emit('table.updated', table.area.branchId, table.id);
    }
    return { success: true, updated: dto.tables.length, branches: branchIds.size };
  }

  async merge(tenantId: string, id: string, dto: MergeTableDto) {
    if (id === dto.intoTableId) {
      throw new BadRequestException('Una mesa no puede unirse a sí misma');
    }
    const [table, target] = await Promise.all([
      this.findOne(tenantId, id),
      this.findOne(tenantId, dto.intoTableId),
    ]);
    if (table.area.branchId !== target.area.branchId) {
      throw new BadRequestException('Las mesas deben pertenecer a la misma sucursal');
    }
    if (target.mergedIntoId) {
      throw new ConflictException('La mesa destino ya está unida a otra mesa');
    }

    const updated = await this.prisma.diningTable.update({
      where: { id },
      data: { mergedIntoId: dto.intoTableId },
      include: { merged: true },
    });
    this.realtime.emit('table.updated', table.area.branchId, id);
    this.realtime.emit('table.updated', table.area.branchId, dto.intoTableId);
    return updated;
  }

  async split(tenantId: string, id: string) {
    const table = await this.findOne(tenantId, id);
    const mergedIntoId = table.mergedIntoId;
    const updated = await this.prisma.diningTable.update({
      where: { id },
      data: { mergedIntoId: null },
    });
    this.realtime.emit('table.updated', table.area.branchId, id);
    if (mergedIntoId) {
      this.realtime.emit('table.updated', table.area.branchId, mergedIntoId);
    }
    return updated;
  }

  async findOne(tenantId: string, id: string): Promise<TableWithBranch> {
    const table = await this.prisma.diningTable.findFirst({
      where: { id, area: { branch: { tenantId } } },
      include: { area: { select: { id: true, branchId: true } } },
    });
    if (!table) {
      throw new NotFoundException('Mesa no encontrada');
    }
    return table;
  }
}
