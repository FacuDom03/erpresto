import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  ProductMovementType,
  ProductionStatus,
  RawMovementType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustProductStockDto } from './dto/adjust-product-stock.dto';
import { CreateProductionDto } from './dto/production.dto';
import { QueryProductStockDto } from './dto/query-product-stock.dto';

@Injectable()
export class ProductStockService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------
  // Listado de stock de producción por sucursal
  // ----------------------------------------------------------
  async findAll(tenantId: string, query: QueryProductStockDto) {
    if (query.branchId) {
      await this.assertBranch(tenantId, query.branchId);
    }
    return this.prisma.productStock.findMany({
      where: {
        branch: { tenantId },
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            stockLinkMode: true,
            trackStock: true,
            minStock: true,
          },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { product: { name: 'asc' } },
    });
  }

  // ----------------------------------------------------------
  // Orden de producción: "+20 rabas, +15 milanesas".
  // Suma SIEMPRE al stock de platos. Solo descuenta materia
  // prima si consumeRawMaterials=true Y hay receta activa.
  // La independencia de ambos stocks es regla de negocio:
  // sin receta NO falla, simplemente no descuenta.
  // ----------------------------------------------------------
  async createProduction(tenantId: string, userId: string, dto: CreateProductionDto) {
    await this.assertBranch(tenantId, dto.branchId);

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      include: { recipe: { include: { items: true } } },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Uno o más productos no pertenecen al tenant');
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    const consume = dto.consumeRawMaterials === true;
    let defaultWarehouseId: string | null = null;
    if (consume) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { branchId: dto.branchId, isDefault: true, active: true },
      });
      defaultWarehouseId =
        warehouse?.id ??
        (
          await this.prisma.warehouse.findFirst({
            where: { branchId: dto.branchId, active: true },
          })
        )?.id ??
        null;
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.create({
        data: {
          branchId: dto.branchId,
          status: ProductionStatus.CONFIRMED,
          consumeRawMaterials: consume,
          notes: dto.notes,
          userId,
          items: {
            create: dto.items.map((i) => ({
              productId: i.productId,
              quantity: new Prisma.Decimal(i.quantity),
            })),
          },
        },
        include: { items: true },
      });

      const rawConsumptions: {
        rawMaterialId: string;
        quantity: number;
        productId: string;
      }[] = [];

      for (const item of dto.items) {
        const quantity = new Prisma.Decimal(item.quantity);

        await tx.productStock.upsert({
          where: {
            branchId_productId: { branchId: dto.branchId, productId: item.productId },
          },
          create: { branchId: dto.branchId, productId: item.productId, quantity },
          update: { quantity: { increment: quantity } },
        });

        await tx.productStockMovement.create({
          data: {
            branchId: dto.branchId,
            productId: item.productId,
            type: ProductMovementType.PRODUCTION,
            quantity,
            reference: order.id,
            notes: dto.notes,
            userId,
          },
        });

        // Descuento OPCIONAL de materia prima vía receta
        const product = productById.get(item.productId);
        const recipe = product?.recipe;
        if (consume && defaultWarehouseId && recipe?.active && recipe.items.length > 0) {
          const yieldQty = Number(recipe.yieldQuantity) || 1;
          for (const recipeItem of recipe.items) {
            const consumedQty = (item.quantity * Number(recipeItem.quantity)) / yieldQty;
            if (consumedQty <= 0) {
              continue;
            }
            const consumed = new Prisma.Decimal(consumedQty.toFixed(3));

            await tx.rawStockMovement.create({
              data: {
                warehouseId: defaultWarehouseId,
                rawMaterialId: recipeItem.rawMaterialId,
                type: RawMovementType.PRODUCTION_CONSUME,
                quantity: consumed.negated(),
                reference: order.id,
                userId,
              },
            });

            const batch = await tx.stockBatch.findFirst({
              where: {
                warehouseId: defaultWarehouseId,
                rawMaterialId: recipeItem.rawMaterialId,
              },
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

            rawConsumptions.push({
              rawMaterialId: recipeItem.rawMaterialId,
              quantity: consumedQty,
              productId: item.productId,
            });
          }
        }
      }

      return { ...order, rawConsumptions };
    });
  }

  // ----------------------------------------------------------
  // Ajuste manual de stock de platos (+/-)
  // ----------------------------------------------------------
  async adjust(tenantId: string, userId: string, dto: AdjustProductStockDto) {
    await this.assertBranch(tenantId, dto.branchId);

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId },
    });
    if (!product) {
      throw new BadRequestException('El producto no pertenece al tenant');
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    const type = dto.type ?? ProductMovementType.ADJUSTMENT;

    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.productStock.upsert({
        where: {
          branchId_productId: { branchId: dto.branchId, productId: dto.productId },
        },
        create: { branchId: dto.branchId, productId: dto.productId, quantity },
        update: { quantity: { increment: quantity } },
      });

      const movement = await tx.productStockMovement.create({
        data: {
          branchId: dto.branchId,
          productId: dto.productId,
          type,
          quantity,
          notes: dto.notes,
          userId,
        },
      });

      return { stock, movement };
    });
  }

  private async assertBranch(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) {
      throw new BadRequestException('La sucursal no pertenece al tenant');
    }
  }
}
