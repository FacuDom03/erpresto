import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: QuerySuppliersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.SupplierWhereInput = {
      tenantId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { cuit: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, total };
  }

  async findOne(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }
    return supplier;
  }

  async create(tenantId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        tenantId,
        name: dto.name,
        cuit: dto.cuit,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        deliveryDays: dto.deliveryDays,
        rating: dto.rating,
        notes: dto.notes,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto) {
    await this.findOne(tenantId, id);
    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.cuit !== undefined ? { cuit: dto.cuit } : {}),
        ...(dto.contactName !== undefined ? { contactName: dto.contactName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.deliveryDays !== undefined ? { deliveryDays: dto.deliveryDays } : {}),
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  // Soft delete si tiene órdenes de compra, hard delete si no
  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    const purchaseOrders = await this.prisma.purchaseOrder.count({
      where: { supplierId: id },
    });
    if (purchaseOrders > 0) {
      await this.prisma.supplier.update({ where: { id }, data: { active: false } });
      return { success: true, soft: true };
    }
    await this.prisma.supplier.delete({ where: { id } });
    return { success: true, soft: false };
  }
}
