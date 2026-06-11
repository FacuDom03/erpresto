import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { QueryAreasDto } from './dto/query-areas.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: QueryAreasDto) {
    if (query.branchId) {
      await this.assertBranch(tenantId, query.branchId);
    }
    return this.prisma.area.findMany({
      where: {
        branch: { tenantId },
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      include: {
        tables: {
          where: { active: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(tenantId: string, dto: CreateAreaDto) {
    await this.assertBranch(tenantId, dto.branchId);
    const last = await this.prisma.area.findFirst({
      where: { branchId: dto.branchId },
      orderBy: { sortOrder: 'desc' },
    });
    return this.prisma.area.create({
      data: {
        branchId: dto.branchId,
        name: dto.name,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
      include: { tables: true },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateAreaDto) {
    await this.findOne(tenantId, id);
    return this.prisma.area.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: { tables: true },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    const openOrders = await this.prisma.order.count({
      where: { status: OrderStatus.OPEN, table: { areaId: id } },
    });
    if (openOrders > 0) {
      throw new ConflictException('El área tiene mesas con pedidos abiertos');
    }
    await this.prisma.area.delete({ where: { id } });
    return { success: true };
  }

  async findOne(tenantId: string, id: string) {
    const area = await this.prisma.area.findFirst({
      where: { id, branch: { tenantId } },
    });
    if (!area) {
      throw new NotFoundException('Área no encontrada');
    }
    return area;
  }

  private async assertBranch(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) {
      throw new BadRequestException('La sucursal no pertenece al tenant');
    }
  }
}
