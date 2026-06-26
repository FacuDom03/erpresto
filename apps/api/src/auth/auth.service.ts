import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { JwtPayload, RefreshPayload } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ----------------------------------------------------------
  // Registro: Tenant + Branch + Warehouse + Caja + Dueño
  // ----------------------------------------------------------
  async register(dto: RegisterDto, meta: RequestMeta) {
    const slug = await this.generateUniqueSlug(dto.tenantName);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName, slug },
      });

      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: dto.branchName,
          warehouses: { create: { name: 'Depósito principal', isDefault: true } },
          cashRegisters: { create: { name: 'Caja principal' } },
        },
      });

      // Rol Dueño: usa el rol de sistema si existe; si no, crea uno
      // propio del tenant con todos los permisos del catálogo.
      let ownerRoleId: string;
      const systemOwner = await tx.role.findFirst({
        where: { tenantId: null, isSystem: true, code: 'owner' },
      });
      if (systemOwner) {
        ownerRoleId = systemOwner.id;
      } else {
        const allPermissions = await tx.permission.findMany({ select: { id: true } });
        const ownerRole = await tx.role.create({
          data: {
            tenantId: tenant.id,
            name: 'Dueño',
            code: 'owner',
            rolePermissions: {
              create: allPermissions.map((p) => ({ permissionId: p.id })),
            },
          },
        });
        ownerRoleId = ownerRole.id;
      }

      return tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          userRoles: { create: { roleId: ownerRoleId } },
          userBranches: { create: { branchId: branch.id } },
        },
      });
    });

    return this.issueTokensForUser(user.id, meta);
  }

  // ----------------------------------------------------------
  // Login
  // ----------------------------------------------------------
  async login(dto: LoginDto, meta: RequestMeta) {
    const users = await this.prisma.user.findMany({
      where: {
        email: dto.email.toLowerCase(),
        active: true,
        tenant: { active: true, ...(dto.tenantSlug ? { slug: dto.tenantSlug } : {}) },
      },
      include: { tenant: { select: { slug: true, name: true } } },
    });

    if (users.length === 0) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (users.length > 1) {
      throw new BadRequestException(
        'El email existe en varios tenants: indicá tenantSlug para elegir uno',
      );
    }

    const user = users[0];
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.issueTokensForUser(user.id, meta);
  }

  // ----------------------------------------------------------
  // Refresh con rotación de sesión
  // ----------------------------------------------------------
  async refresh(refreshToken: string, meta: RequestMeta) {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const hash = this.sha256(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
        refreshTokenHash: hash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) {
      throw new UnauthorizedException('Sesión revocada o inexistente');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokensForUser(payload.sub, meta);
  }

  // ----------------------------------------------------------
  // Logout: revoca la sesión del refresh token
  // ----------------------------------------------------------
  async logout(userId: string, refreshToken: string) {
    const hash = this.sha256(refreshToken);
    await this.prisma.session.updateMany({
      where: { userId, refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  // ----------------------------------------------------------
  // Perfil y sesiones
  // ----------------------------------------------------------
  async me(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        active: true,
        createdAt: true,
        tenant: { select: { id: true, name: true, slug: true, plan: true, stockMode: true } },
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
                code: true,
                isSystem: true,
                rolePermissions: {
                  select: { permission: { select: { code: true, module: true } } },
                },
              },
            },
          },
        },
        userBranches: { select: { branch: { select: { id: true, name: true } } } },
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)),
      ),
    ].sort();

    const { userRoles, userBranches, ...rest } = user;
    return {
      ...rest,
      roles: userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        code: ur.role.code,
        isSystem: ur.role.isSystem,
      })),
      branches: userBranches.map((ub) => ub.branch),
      permissions,
    };
  }

  async sessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        ip: true,
        device: true,
        browser: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
  }

  // ----------------------------------------------------------
  // Internos
  // ----------------------------------------------------------
  private async issueTokensForUser(userId: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
        userBranches: { select: { branchId: true } },
      },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)),
      ),
    ].sort();
    const branchIds = user.userBranches.map((ub) => ub.branchId);

    const tokens = await this.createSessionWithTokens(
      { sub: user.id, tenantId: user.tenantId, email: user.email, permissions, branchIds },
      meta,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenant: user.tenant,
        roles: user.userRoles.map((ur) => ({ id: ur.role.id, name: ur.role.name })),
        permissions,
        branchIds,
      },
    };
  }

  private async createSessionWithTokens(
    payload: JwtPayload,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const accessExpiration = this.config.get<string>('JWT_ACCESS_EXPIRATION') ?? '15m';
    const refreshExpiration = this.config.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d';

    const sessionId = crypto.randomUUID();
    const accessToken = await this.jwt.signAsync(
      { ...payload },
      {
        secret: this.config.get<string>('JWT_SECRET') ?? 'change-me-in-production',
        expiresIn: accessExpiration as JwtSignOptions['expiresIn'],
      },
    );
    const refreshPayload: RefreshPayload = {
      sub: payload.sub,
      sessionId,
      tenantId: payload.tenantId,
    };
    const refreshToken = await this.jwt.signAsync(
      { ...refreshPayload },
      {
        secret: this.refreshSecret(),
        expiresIn: refreshExpiration as JwtSignOptions['expiresIn'],
      },
    );

    const { device, browser } = this.parseUserAgent(meta.userAgent);
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: payload.sub,
        refreshTokenHash: this.sha256(refreshToken),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        device,
        browser,
        expiresAt: this.expirationToDate(refreshExpiration),
      },
    });

    return { accessToken, refreshToken };
  }

  private parseUserAgent(ua?: string): { device: string | null; browser: string | null } {
    if (!ua) {
      return { device: null, browser: null };
    }
    let device = 'Desktop';
    if (/mobile|iphone|android.*mobile/i.test(ua)) device = 'Mobile';
    else if (/ipad|tablet|android/i.test(ua)) device = 'Tablet';
    else if (/postman|curl|insomnia|httpie/i.test(ua)) device = 'API client';

    let browser: string | null = null;
    if (/edg\//i.test(ua)) browser = 'Edge';
    else if (/opr\//i.test(ua)) browser = 'Opera';
    else if (/chrome\//i.test(ua)) browser = 'Chrome';
    else if (/safari\//i.test(ua) && /version\//i.test(ua)) browser = 'Safari';
    else if (/firefox\//i.test(ua)) browser = 'Firefox';
    else if (/postman/i.test(ua)) browser = 'Postman';
    else if (/curl/i.test(ua)) browser = 'curl';

    return { device, browser };
  }

  private expirationToDate(expiration: string): Date {
    const match = /^(\d+)([smhd])$/.exec(expiration.trim());
    let ms = 7 * 24 * 60 * 60 * 1000; // default 7d
    if (match) {
      const value = Number(match[1]);
      const unit = match[2];
      const factors: Record<string, number> = {
        s: 1000,
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000,
      };
      ms = value * factors[unit];
    }
    return new Date(Date.now() + ms);
  }

  private refreshSecret(): string {
    return this.config.get<string>('JWT_REFRESH_SECRET') ?? 'change-me-too-in-production';
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'tenant';

    let slug = base;
    for (let i = 0; i < 50; i += 1) {
      const exists = await this.prisma.tenant.findUnique({ where: { slug } });
      if (!exists) {
        return slug;
      }
      slug = `${base}-${i + 2}`;
    }
    throw new ConflictException('No se pudo generar un slug único para el tenant');
  }
}
