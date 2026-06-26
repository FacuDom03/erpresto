import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStationsDto } from './dto/update-stations.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

const DEFAULT_STATIONS = ['Cocina', 'Barra'];
const MAX_STATIONS = 50;

function normalizeStations(input: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') {
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
    if (result.length >= MAX_STATIONS) {
      break;
    }
  }
  return result;
}

function readSettingsStations(settings: Prisma.JsonValue | null | undefined): string[] {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return [];
  }
  const value = (settings as Record<string, unknown>).stations;
  if (!Array.isArray(value)) {
    return [];
  }
  return normalizeStations(value.filter((v): v is string => typeof v === 'string'));
}

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

  async getStations(tenantId: string): Promise<{ stations: string[] }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }

    const fromSettings = readSettingsStations(tenant.settings);
    if (fromSettings.length > 0) {
      return { stations: fromSettings };
    }

    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: { tenantId, printStation: { not: null } },
        select: { printStation: true },
        distinct: ['printStation'],
      }),
      this.prisma.category.findMany({
        where: { tenantId, defaultStation: { not: null } },
        select: { defaultStation: true },
        distinct: ['defaultStation'],
      }),
    ]);

    const fromUsage = normalizeStations([
      ...products.map((p) => p.printStation ?? ''),
      ...categories.map((c) => c.defaultStation ?? ''),
    ]);
    if (fromUsage.length > 0) {
      return { stations: fromUsage };
    }

    return { stations: [...DEFAULT_STATIONS] };
  }

  async setStations(
    tenantId: string,
    dto: UpdateStationsDto,
  ): Promise<{ stations: string[] }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }

    const stations = normalizeStations(dto.stations);

    const currentSettings =
      tenant.settings && typeof tenant.settings === 'object' && !Array.isArray(tenant.settings)
        ? (tenant.settings as Record<string, unknown>)
        : {};

    const mergedSettings = { ...currentSettings, stations };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: mergedSettings as Prisma.InputJsonValue },
    });

    return { stations };
  }
}
