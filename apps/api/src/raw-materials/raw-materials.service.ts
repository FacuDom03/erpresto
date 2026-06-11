import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RawMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustRawStockDto } from './dto/adjust-stock.dto';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto';

@Injectable()
export class RawMaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const materials = await this.prisma.rawMaterial.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    if (materials.length === 0) {
      return [];
    }

    const sums = await this.prisma.stockBatch.groupBy({
      by: ['rawMaterialId', 'warehouseId'],
      where: { rawMaterialId: { in: materials.map((m) => m.id) } },
      _sum: { quantity: true },
    });
    const warehouseIds = [...new Set(sums.map((s) => s.warehouseId))];
    const warehouses = await this.prisma.warehouse.findMany({
      where: { id: { in: warehouseIds } },
      select: { id: true, name: true, branchId: true },
    });
    const warehouseById = new Map(warehouses.map((w) => [w.id, w]));

    return materials.map((m) => {
      const rows = sums.filter((s) => s.rawMaterialId === m.id);
      const stockByWarehouse = rows.map((r) => ({
        warehouseId: r.warehouseId,
        warehouseName: warehouseById.get(r.warehouseId)?.name ?? null,
        branchId: warehouseById.get(r.warehouseId)?.branchId ?? null,
        quantity: Number(r._sum.quantity ?? 0),
      }));
      const totalStock = stockByWarehouse.reduce((acc, r) => acc + r.quantity, 0);
      return { ...m, totalStock, stockByWarehouse };
    });
  }

  async findOne(tenantId: string, id: string) {
    const material = await this.prisma.rawMaterial.findFirst({
      where: { id, tenantId },
      include: {
        batches: {
          orderBy: { createdAt: 'asc' },
          include: { warehouse: { select: { id: true, name: true, branchId: true } } },
        },
      },
    });
    if (!material) {
      throw new NotFoundException('Materia prima no encontrada');
    }
    const totalStock = material.batches.reduce((acc, b) => acc + Number(b.quantity), 0);
    return { ...material, totalStock };
  }

  async create(tenantId: string, dto: CreateRawMaterialDto) {
    if (dto.sku) {
      await this.assertSkuUnique(tenantId, dto.sku);
    }
    return this.prisma.rawMaterial.create({
      data: {
        tenantId,
        name: dto.name,
        sku: dto.sku,
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        category: dto.category,
        ...(dto.minStock !== undefined ? { minStock: new Prisma.Decimal(dto.minStock) } : {}),
        ...(dto.avgCost !== undefined ? { avgCost: new Prisma.Decimal(dto.avgCost) } : {}),
        ...(dto.lastCost !== undefined ? { lastCost: new Prisma.Decimal(dto.lastCost) } : {}),
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateRawMaterialDto) {
    await this.assertExists(tenantId, id);
    if (dto.sku) {
      await this.assertSkuUnique(tenantId, dto.sku, id);
    }
    return this.prisma.rawMaterial.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.minStock !== undefined ? { minStock: new Prisma.Decimal(dto.minStock) } : {}),
        ...(dto.avgCost !== undefined ? { avgCost: new Prisma.Decimal(dto.avgCost) } : {}),
        ...(dto.lastCost !== undefined ? { lastCost: new Prisma.Decimal(dto.lastCost) } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.assertExists(tenantId, id);
    await this.prisma.rawMaterial.delete({ where: { id } });
    return { success: true };
  }

  // ----------------------------------------------------------
  // Ajuste manual: crea RawStockMovement + actualiza StockBatch
  // ----------------------------------------------------------
  async adjust(tenantId: string, userId: string, id: string, dto: AdjustRawStockDto) {
    await this.assertExists(tenantId, id);

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, branch: { tenantId } },
    });
    if (!warehouse) {
      throw new BadRequestException('El depósito no pertenece al tenant');
    }

    const quantity = new Prisma.Decimal(dto.quantity);

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.rawStockMovement.create({
        data: {
          warehouseId: dto.warehouseId,
          rawMaterialId: id,
          type: RawMovementType.ADJUSTMENT,
          quantity,
          ...(dto.unitCost !== undefined ? { unitCost: new Prisma.Decimal(dto.unitCost) } : {}),
          notes: dto.notes,
          userId,
        },
      });

      const batch = await tx.stockBatch.findFirst({
        where: { warehouseId: dto.warehouseId, rawMaterialId: id },
        orderBy: { createdAt: 'desc' },
      });

      let resultingBatch;
      if (batch) {
        resultingBatch = await tx.stockBatch.update({
          where: { id: batch.id },
          data: {
            quantity: { increment: quantity },
            ...(dto.unitCost !== undefined
              ? { unitCost: new Prisma.Decimal(dto.unitCost) }
              : {}),
          },
        });
      } else {
        resultingBatch = await tx.stockBatch.create({
          data: {
            warehouseId: dto.warehouseId,
            rawMaterialId: id,
            quantity,
            ...(dto.unitCost !== undefined
              ? { unitCost: new Prisma.Decimal(dto.unitCost) }
              : {}),
          },
        });
      }

      if (dto.unitCost !== undefined) {
        await tx.rawMaterial.update({
          where: { id },
          data: { lastCost: new Prisma.Decimal(dto.unitCost) },
        });
      }

      return { movement, batch: resultingBatch };
    });
  }

  private async assertExists(tenantId: string, id: string): Promise<void> {
    const exists = await this.prisma.rawMaterial.findFirst({ where: { id, tenantId } });
    if (!exists) {
      throw new NotFoundException('Materia prima no encontrada');
    }
  }

  private async assertSkuUnique(tenantId: string, sku: string, excludeId?: string): Promise<void> {
    const exists = await this.prisma.rawMaterial.findFirst({
      where: { tenantId, sku, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
    if (exists) {
      throw new ConflictException(`Ya existe una materia prima con SKU "${sku}" en el tenant`);
    }
  }
}
