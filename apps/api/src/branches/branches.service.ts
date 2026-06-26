import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: {
        warehouses: { select: { id: true, name: true, isDefault: true, active: true } },
        cashRegisters: { select: { id: true, name: true, active: true } },
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
      include: {
        warehouses: { select: { id: true, name: true, isDefault: true, active: true } },
        cashRegisters: { select: { id: true, name: true, active: true } },
      },
    });
    if (!branch) {
      throw new NotFoundException('Sucursal no encontrada');
    }
    return branch;
  }

  create(tenantId: string, dto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: {
        tenantId,
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.settings ? { settings: dto.settings as Prisma.InputJsonValue } : {}),
        warehouses: { create: { name: 'Depósito principal', isDefault: true } },
        cashRegisters: { create: { name: 'Caja principal' } },
      },
      include: {
        warehouses: true,
        cashRegisters: true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateBranchDto) {
    await this.findOne(tenantId, id);
    return this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.settings !== undefined
          ? { settings: dto.settings as Prisma.InputJsonValue }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.branch.delete({ where: { id } });
    return { success: true };
  }
}
