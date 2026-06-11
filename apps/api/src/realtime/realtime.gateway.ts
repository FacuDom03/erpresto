import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from './realtime.service';

interface JoinPayload {
  branchId?: string;
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Namespace): void {
    this.realtimeService.bindServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = (client.handshake.auth as { token?: string } | undefined)?.token;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET') ?? 'change-me-in-production',
      });
      client.data.user = payload;
    } catch {
      this.logger.warn('Conexión realtime rechazada: token inválido');
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinPayload,
  ): Promise<{ ok: boolean; error?: string }> {
    const user = client.data.user as JwtPayload | undefined;
    const branchId = body?.branchId;
    if (!user || !branchId) {
      return { ok: false, error: 'branchId requerido' };
    }

    const branchIds = user.branchIds ?? [];
    if (branchIds.length > 0) {
      if (!branchIds.includes(branchId)) {
        return { ok: false, error: 'Sucursal no autorizada' };
      }
    } else {
      // Sin sucursales en el token => acceso a todas las del tenant
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!branch) {
        return { ok: false, error: 'Sucursal no autorizada' };
      }
    }

    await client.join(`branch:${branchId}`);
    return { ok: true };
  }
}
