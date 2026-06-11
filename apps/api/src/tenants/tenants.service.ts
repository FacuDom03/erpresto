import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async me(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        cuit: true,
        plan: true,
        settings: true,
        stockMode: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }
    return tenant;
  }

  async update(tenantId: string, dto: UpdateTenantDto) {
    await this.me(tenantId);
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.settings !== undefined
          ? { settings: dto.settings as Prisma.InputJsonValue }
          : {}),
        ...(dto.stockMode !== undefined ? { stockMode: dto.stockMode } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        cuit: true,
        plan: true,
        settings: true,
        stockMode: true,
        active: true,
        updatedAt: true,
      },
    });
  }
}
