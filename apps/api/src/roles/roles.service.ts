import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const ROLE_INCLUDE = {
  rolePermissions: {
    select: { permission: { select: { id: true, code: true, module: true } } },
  },
} as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: { OR: [{ tenantId }, { tenantId: null, isSystem: true }] },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: ROLE_INCLUDE,
    });
    return roles.map((r) => this.shape(r));
  }

  async create(tenantId: string, dto: CreateRoleDto) {
    await this.validatePermissionIds(dto.permissionIds);
    const exists = await this.prisma.role.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (exists) {
      throw new ConflictException('Ya existe un rol con ese nombre en el tenant');
    }
    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name: dto.name,
        rolePermissions: { create: dto.permissionIds.map((permissionId) => ({ permissionId })) },
      },
      include: ROLE_INCLUDE,
    });
    return this.shape(role);
  }

  async update(tenantId: string, id: string, dto: UpdateRoleDto) {
    const role = await this.findTenantRole(tenantId, id);
    if (role.isSystem || role.tenantId === null) {
      throw new ForbiddenException('Los roles de sistema no se pueden modificar');
    }
    if (dto.permissionIds) {
      await this.validatePermissionIds(dto.permissionIds);
    }
    if (dto.name && dto.name !== role.name) {
      const exists = await this.prisma.role.findFirst({
        where: { tenantId, name: dto.name, NOT: { id } },
      });
      if (exists) {
        throw new ConflictException('Ya existe un rol con ese nombre en el tenant');
      }
    }
    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.permissionIds
          ? {
              rolePermissions: {
                deleteMany: {},
                create: dto.permissionIds.map((permissionId) => ({ permissionId })),
              },
            }
          : {}),
      },
      include: ROLE_INCLUDE,
    });
    return this.shape(updated);
  }

  async remove(tenantId: string, id: string) {
    const role = await this.findTenantRole(tenantId, id);
    if (role.isSystem || role.tenantId === null) {
      throw new ForbiddenException('Los roles de sistema no se pueden eliminar');
    }
    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }

  async permissionsCatalog() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
    const grouped: Record<string, { id: string; code: string; description: string }[]> = {};
    for (const p of permissions) {
      grouped[p.module] ??= [];
      grouped[p.module].push({ id: p.id, code: p.code, description: p.description });
    }
    return grouped;
  }

  private async findTenantRole(tenantId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, OR: [{ tenantId }, { tenantId: null, isSystem: true }] },
    });
    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }
    return role;
  }

  private async validatePermissionIds(permissionIds: string[]): Promise<void> {
    if (permissionIds.length === 0) {
      return;
    }
    const count = await this.prisma.permission.count({ where: { id: { in: permissionIds } } });
    if (count !== new Set(permissionIds).size) {
      throw new BadRequestException('Uno o más permisos no existen');
    }
  }

  private shape<
    T extends {
      rolePermissions: { permission: { id: string; code: string; module: string } }[];
    },
  >(role: T) {
    const { rolePermissions, ...rest } = role;
    return { ...rest, permissions: rolePermissions.map((rp) => rp.permission) };
  }
}
