import { Injectable, Logger } from '@nestjs/common';
import type { Namespace } from 'socket.io';

export type RealtimeEvent = 'table.updated' | 'order.updated' | 'kitchen.updated' | 'cash.updated';

/**
 * Emisor de eventos realtime desacoplado del gateway: los servicios
 * de dominio inyectan este servicio (módulo global) y el gateway se
 * registra al inicializarse, evitando dependencias circulares.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Namespace | null = null;

  bindServer(server: Namespace): void {
    this.server = server;
  }

  emit(event: RealtimeEvent, branchId: string, id: string): void {
    if (!this.server) {
      return;
    }
    this.server.to(`branch:${branchId}`).emit(event, { branchId, id });
    this.logger.debug(`${event} -> branch:${branchId} (${id})`);
  }
}
