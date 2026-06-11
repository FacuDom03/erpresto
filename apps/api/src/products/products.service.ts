import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: QueryProductsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { category: { select: { id: true, name: true } } },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: { select: { id: true, name: true } },
        recipe: { include: { items: { include: { rawMaterial: true } } } },
      },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

  async create(tenantId: string, dto: CreateProductDto) {
    if (dto.categoryId) {
      await this.assertCategory(tenantId, dto.categoryId);
    }
    if (dto.sku) {
      await this.assertSkuUnique(tenantId, dto.sku);
    }
    return this.prisma.product.create({
      data: {
        tenantId,
        name: dto.name,
        sku: dto.sku,
        categoryId: dto.categoryId,
        description: dto.description,
        imageUrl: dto.imageUrl,
        price: new Prisma.Decimal(dto.price),
        ...(dto.taxRate !== undefined ? { taxRate: new Prisma.Decimal(dto.taxRate) } : {}),
        printStation: dto.printStation,
        ...(dto.stockLinkMode !== undefined ? { stockLinkMode: dto.stockLinkMode } : {}),
        ...(dto.trackStock !== undefined ? { trackStock: dto.trackStock } : {}),
        ...(dto.minStock !== undefined ? { minStock: new Prisma.Decimal(dto.minStock) } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    await this.findOne(tenantId, id);
    if (dto.categoryId) {
      await this.assertCategory(tenantId, dto.categoryId);
    }
    if (dto.sku) {
      await this.assertSkuUnique(tenantId, dto.sku, id);
    }
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
        ...(dto.taxRate !== undefined ? { taxRate: new Prisma.Decimal(dto.taxRate) } : {}),
        ...(dto.printStation !== undefined ? { printStation: dto.printStation } : {}),
        ...(dto.stockLinkMode !== undefined ? { stockLinkMode: dto.stockLinkMode } : {}),
        ...(dto.trackStock !== undefined ? { trackStock: dto.trackStock } : {}),
        ...(dto.minStock !== undefined ? { minStock: new Prisma.Decimal(dto.minStock) } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.product.delete({ where: { id } });
    return { success: true };
  }

  private async assertCategory(tenantId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId },
    });
    if (!category) {
      throw new BadRequestException('La categoría no pertenece al tenant');
    }
  }

  private async assertSkuUnique(tenantId: string, sku: string, excludeId?: string): Promise<void> {
    const exists = await this.prisma.product.findFirst({
      where: { tenantId, sku, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
    if (exists) {
      throw new ConflictException(`Ya existe un producto con SKU "${sku}" en el tenant`);
    }
  }
}
