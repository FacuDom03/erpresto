"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";

import { API_URL, getAccessToken } from "@/lib/api";

/**
 * Mapeo evento → prefijos de queryKey a invalidar.
 * Los eventos llegan con payload mínimo {branchId, id}; el cliente solo
 * invalida y deja que TanStack Query refetchee lo que esté montado.
 */
const EVENT_QUERY_PREFIXES: Record<string, string[]> = {
  "table.updated": ["areas"],
  "order.updated": ["orders", "areas", "deliveries"],
  "kitchen.updated": ["kitchen", "orders"],
  "cash.updated": ["cash"],
};

/**
 * Conecta al namespace /realtime (socket.io) y se une a la room de la
 * sucursal. Ante cada evento invalida las queries correspondientes.
 * Si el socket falla no rompe nada: las pantallas operativas mantienen
 * polling (refetchInterval) como red de seguridad.
 */
export function useRealtime(branchId: string | null | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!branchId) return;

    let socket: Socket | null = null;
    try {
      socket = io(`${API_URL}/realtime`, {
        auth: { token: getAccessToken() },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15_000,
      });

      socket.on("connect", () => {
        socket?.emit("join", { branchId });
      });

      for (const [event, prefixes] of Object.entries(EVENT_QUERY_PREFIXES)) {
        socket.on(event, () => {
          for (const prefix of prefixes) {
            void queryClient.invalidateQueries({ queryKey: [prefix] });
          }
        });
      }

      // Silenciamos errores de conexión: el polling cubre la operación.
      socket.on("connect_error", () => {});
    } catch {
      // io() no debería tirar, pero ante cualquier falla seguimos sin realtime.
    }

    return () => {
      socket?.disconnect();
    };
  }, [branchId, queryClient]);
}
