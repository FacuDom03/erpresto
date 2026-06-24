import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 10;

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  userRoles: {
    select: { role: { select: { id: true, name: true, code: true, isSystem: true } } },
  },
  userBranches: { select: { branch: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: QueryUsersDto = {}) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        ...(query.role
          ? { userRoles: { some: { role: { code: query.role } } } }
          : {}),
        ...(query.branchId
          ? { userBranches: { some: { branchId: query.branchId } } }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: USER_SELECT,
    });
    return users.map((u) => this.shape(u));
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.shape(user);
  }

  async create(tenantId: string, dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (exists) {
      throw new ConflictException('Ya existe un usuario con ese email en el tenant');
    }

    await this.validateRoleIds(tenantId, dto.roleIds);
    await this.validateBranchIds(tenantId, dto.branchIds ?? []);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        userRoles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
        userBranches: { create: (dto.branchIds ?? []).map((branchId) => ({ branchId })) },
      },
      select: USER_SELECT,
    });
    return this.shape(user);
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    await this.findOne(tenantId, id);

    if (dto.roleIds) {
      await this.validateRoleIds(tenantId, dto.roleIds);
    }
    if (dto.branchIds) {
      await this.validateBranchIds(tenantId, dto.branchIds);
    }
    if (dto.email) {
      const email = dto.email.toLowerCase();
      const exists = await this.prisma.user.findFirst({
        where: { tenantId, email, NOT: { id } },
      });
      if (exists) {
        throw new ConflictException('Ya existe un usuario con ese email en el tenant');
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.password
          ? { passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS) }
          : {}),
        ...(dto.roleIds
          ? {
              userRoles: {
                deleteMany: {},
                create: dto.roleIds.map((roleId) => ({ roleId })),
              },
            }
          : {}),
        ...(dto.branchIds
          ? {
              userBranches: {
                deleteMany: {},
                create: dto.branchIds.map((branchId) => ({ branchId })),
              },
            }
          : {}),
      },
      select: USER_SELECT,
    });
    return this.shape(user);
  }

  async assignRoles(tenantId: string, id: string, dto: AssignRolesDto) {
    await this.findOne(tenantId, id);
    await this.validateRoleIds(tenantId, dto.roleIds);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        userRoles: {
          deleteMany: {},
          create: dto.roleIds.map((roleId) => ({ roleId })),
        },
      },
      select: USER_SELECT,
    });
    return this.shape(user);
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  private async validateRoleIds(tenantId: string, roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) {
      return;
    }
    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: roleIds },
        OR: [{ tenantId }, { tenantId: null, isSystem: true }],
      },
      select: { id: true },
    });
    if (roles.length !== new Set(roleIds).size) {
      throw new BadRequestException('Uno o más roles no existen o no pertenecen al tenant');
    }
  }

  private async validateBranchIds(tenantId: string, branchIds: string[]): Promise<void> {
    if (branchIds.length === 0) {
      return;
    }
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: branchIds }, tenantId },
      select: { id: true },
    });
    if (branches.length !== new Set(branchIds).size) {
      throw new BadRequestException('Una o más sucursales no pertenecen al tenant');
    }
  }

  private shape<
    T extends {
      userRoles: { role: { id: string; name: string; code: string | null; isSystem: boolean } }[];
      userBranches: { branch: { id: string; name: string } }[];
    },
  >(user: T) {
    const { userRoles, userBranches, ...rest } = user;
    return {
      ...rest,
      roles: userRoles.map((ur) => ur.role),
      branches: userBranches.map((ub) => ub.branch),
    };
  }
}
