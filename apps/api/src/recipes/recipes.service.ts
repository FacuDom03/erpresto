import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryRecipesDto } from './dto/query-recipes.dto';
import { UpsertRecipeDto } from './dto/upsert-recipe.dto';

type RecipeWithItems = Prisma.RecipeGetPayload<{
  include: {
    items: {
      include: {
        rawMaterial: { select: { id: true; name: true; unit: true; avgCost: true } };
      };
    };
  };
}>;

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------
  // GET /recipes — productos del tenant con resumen de costo
  // ----------------------------------------------------------
  async findAll(tenantId: string, query: QueryRecipesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { name: true } },
          recipe: {
            include: {
              items: {
                include: {
                  rawMaterial: { select: { id: true, name: true, unit: true, avgCost: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const data = products.map((p) => {
      const cost = p.recipe ? this.computeCost(p.recipe, p.price) : null;
      return {
        id: p.id,
        name: p.name,
        price: Number(p.price),
        categoryName: p.category?.name ?? null,
        hasRecipe: p.recipe !== null,
        active: p.recipe?.active ?? null,
        unitCost: cost?.unitCost ?? null,
        marginPercent: cost?.marginPercent ?? null,
      };
    });

    return { data, total };
  }

  // ----------------------------------------------------------
  // GET /products/:id/recipe
  // ----------------------------------------------------------
  async findOne(tenantId: string, productId: string) {
    const product = await this.getProduct(tenantId, productId);

    if (!product.recipe) {
      return { recipe: null, cost: null };
    }

    const recipe = product.recipe;
    return {
      recipe: {
        yieldQuantity: Number(recipe.yieldQuantity),
        active: recipe.active,
        items: recipe.items.map((item) => ({
          id: item.id,
          rawMaterialId: item.rawMaterialId,
          quantity: Number(item.quantity),
          wastePercent: Number(item.wastePercent),
          rawMaterial: {
            id: item.rawMaterial.id,
            name: item.rawMaterial.name,
            unit: item.rawMaterial.unit,
            avgCost: Number(item.rawMaterial.avgCost),
          },
        })),
      },
      cost: this.computeCost(recipe, product.price),
    };
  }

  // ----------------------------------------------------------
  // PUT /products/:id/recipe — reemplazo completo, transaccional
  // ----------------------------------------------------------
  async upsert(tenantId: string, productId: string, dto: UpsertRecipeDto) {
    const product = await this.getProduct(tenantId, productId);

    const rawMaterialIds = dto.items.map((i) => i.rawMaterialId);
    if (new Set(rawMaterialIds).size !== rawMaterialIds.length) {
      throw new BadRequestException('La receta tiene insumos repetidos');
    }
    const owned = await this.prisma.rawMaterial.count({
      where: { id: { in: rawMaterialIds }, tenantId },
    });
    if (owned !== rawMaterialIds.length) {
      throw new BadRequestException('Hay insumos que no pertenecen al tenant');
    }

    await this.prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.upsert({
        where: { productId },
        update: {
          yieldQuantity: new Prisma.Decimal(dto.yieldQuantity),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
        create: {
          productId,
          yieldQuantity: new Prisma.Decimal(dto.yieldQuantity),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
        include: { items: true },
      });

      // Elimina items ausentes en el nuevo payload
      await tx.recipeItem.deleteMany({
        where: { recipeId: recipe.id, rawMaterialId: { notIn: rawMaterialIds } },
      });

      // Upsert por insumo (conserva ids de items existentes)
      for (const item of dto.items) {
        const existing = recipe.items.find((i) => i.rawMaterialId === item.rawMaterialId);
        const data = {
          quantity: new Prisma.Decimal(item.quantity),
          wastePercent: new Prisma.Decimal(item.wastePercent ?? 0),
        };
        if (existing) {
          await tx.recipeItem.update({ where: { id: existing.id }, data });
        } else {
          await tx.recipeItem.create({
            data: { recipeId: recipe.id, rawMaterialId: item.rawMaterialId, ...data },
          });
        }
      }
    });

    return this.findOne(tenantId, product.id);
  }

  // ----------------------------------------------------------
  // DELETE /products/:id/recipe
  // ----------------------------------------------------------
  async remove(tenantId: string, productId: string) {
    const product = await this.getProduct(tenantId, productId);
    if (!product.recipe) {
      throw new NotFoundException('El producto no tiene receta');
    }
    await this.prisma.recipe.delete({ where: { productId } });
    return { success: true };
  }

  // ----------------------------------------------------------
  // Cálculo de costos con Decimal de Prisma
  // ----------------------------------------------------------
  private computeCost(recipe: RecipeWithItems, price: Prisma.Decimal) {
    const HUNDRED = new Prisma.Decimal(100);
    const ingredientsCost = recipe.items.reduce(
      (acc, item) =>
        acc.add(
          new Prisma.Decimal(item.quantity)
            .mul(new Prisma.Decimal(1).add(new Prisma.Decimal(item.wastePercent).div(HUNDRED)))
            .mul(new Prisma.Decimal(item.rawMaterial.avgCost)),
        ),
      new Prisma.Decimal(0),
    );
    const yieldQuantity = new Prisma.Decimal(recipe.yieldQuantity);
    const unitCost = yieldQuantity.isZero()
      ? new Prisma.Decimal(0)
      : ingredientsCost.div(yieldQuantity);
    const priceDecimal = new Prisma.Decimal(price);
    const margin = priceDecimal.sub(unitCost);
    const marginPercent = priceDecimal.isZero() ? null : margin.div(priceDecimal).mul(HUNDRED);

    return {
      ingredientsCost: Number(ingredientsCost.toDecimalPlaces(4)),
      unitCost: Number(unitCost.toDecimalPlaces(4)),
      price: Number(priceDecimal),
      margin: Number(margin.toDecimalPlaces(4)),
      marginPercent: marginPercent === null ? null : Number(marginPercent.toDecimalPlaces(2)),
    };
  }

  private async getProduct(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: {
        recipe: {
          include: {
            items: {
              include: {
                rawMaterial: { select: { id: true, name: true, unit: true, avgCost: true } },
              },
            },
          },
        },
      },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }
}
