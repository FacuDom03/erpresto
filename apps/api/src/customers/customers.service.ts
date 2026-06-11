import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: QueryCustomersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CustomerWhereInput = {
      tenantId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data, total };
  }

  // ----------------------------------------------------------
  // Detalle con stats de pedidos CLOSED
  // ----------------------------------------------------------
  async findOne(tenantId: string, id: string) {
    const customer = await this.getCustomer(tenantId, id);
    const agg = await this.prisma.order.aggregate({
      where: { tenantId, customerId: id, status: OrderStatus.CLOSED },
      _count: true,
      _sum: { total: true },
      _max: { closedAt: true },
    });
    return {
      ...customer,
      stats: {
        ordersCount: agg._count,
        totalSpent: Number(agg._sum.total ?? 0),
        lastOrderAt: agg._max.closedAt,
      },
    };
  }

  async create(tenantId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        taxId: dto.taxId,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
        address: dto.address,
        notes: dto.notes,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    await this.getCustomer(tenantId, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId } : {}),
        ...(dto.birthday !== undefined ? { birthday: new Date(dto.birthday) } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  // Soft delete si tiene pedidos o reservas, hard delete si no
  async remove(tenantId: string, id: string) {
    await this.getCustomer(tenantId, id);
    const [orders, reservations] = await this.prisma.$transaction([
      this.prisma.order.count({ where: { customerId: id } }),
      this.prisma.reservation.count({ where: { customerId: id } }),
    ]);
    if (orders > 0 || reservations > 0) {
      await this.prisma.customer.update({ where: { id }, data: { active: false } });
      return { success: true, soft: true };
    }
    await this.prisma.customer.delete({ where: { id } });
    return { success: true, soft: false };
  }

  private async getCustomer(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return customer;
  }
}
