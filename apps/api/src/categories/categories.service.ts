import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async findOne(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId },
      include: { children: true },
    });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }
    return category;
  }

  async create(tenantId: string, dto: CreateCategoryDto) {
    if (dto.parentId) {
      await this.assertParent(tenantId, dto.parentId);
    }
    return this.prisma.category.create({
      data: {
        tenantId,
        name: dto.name,
        parentId: dto.parentId,
        color: dto.color,
        sortOrder: dto.sortOrder ?? 0,
        ...(dto.defaultStation !== undefined ? { defaultStation: dto.defaultStation } : {}),
        ...(dto.defaultRequiresPreparation !== undefined
          ? { defaultRequiresPreparation: dto.defaultRequiresPreparation }
          : {}),
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOne(tenantId, id);
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('Una categoría no puede ser su propio padre');
      }
      await this.assertParent(tenantId, dto.parentId);
    }
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.defaultStation !== undefined ? { defaultStation: dto.defaultStation } : {}),
        ...(dto.defaultRequiresPreparation !== undefined
          ? { defaultRequiresPreparation: dto.defaultRequiresPreparation }
          : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.category.delete({ where: { id } });
    return { success: true };
  }

  private async assertParent(tenantId: string, parentId: string): Promise<void> {
    const parent = await this.prisma.category.findFirst({ where: { id: parentId, tenantId } });
    if (!parent) {
      throw new BadRequestException('La categoría padre no pertenece al tenant');
    }
  }
}
