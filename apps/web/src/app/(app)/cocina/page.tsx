"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChefHat,
  Flame,
  Loader2,
  RefreshCw,
  ServerOff,
} from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import { useRealtime } from "@/lib/realtime";
import { getKitchenItems, updateKitchenItemStatus } from "@/lib/kitchen";
import { ORDER_TYPE_LABELS } from "@/lib/orders";
import { STATIONS_QUERY_KEY, getStations } from "@/lib/stations";
import type { KitchenItem, OrderItemStatus } from "@/lib/types";
import { cn, formatElapsed, minutesSince } from "@/lib/utils";
import { BranchRequired } from "@/components/branch-required";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const LATE_MINUTES = 15;

const COLUMNS: {
  status: OrderItemStatus;
  title: string;
  accent: string;
  /** Estado siguiente; READY es terminal en el KDS (la entrega la hace el mozo). */
  nextStatus?: OrderItemStatus;
  nextLabel?: string;
  nextIcon?: typeof Check;
}[] = [
  {
    status: "SENT",
    title: "Pendiente",
    accent: "border-t-amber-500",
    nextStatus: "PREPARING",
    nextLabel: "Preparar",
    nextIcon: Flame,
  },
  {
    status: "PREPARING",
    title: "Preparando",
    accent: "border-t-blue-500",
    nextStatus: "READY",
    nextLabel: "Listo",
    nextIcon: Check,
  },
  {
    status: "READY",
    title: "Listo",
    accent: "border-t-emerald-500",
  },
];

interface OrderGroup {
  orderId: string;
  number?: number;
  type: KitchenItem["order"]["type"];
  tableName: string | null;
  items: KitchenItem[];
  oldestSentAt: string;
}

function groupByOrder(items: KitchenItem[]): OrderGroup[] {
  const map = new Map<string, OrderGroup>();
  for (const item of items) {
    const key = item.order.id || item.id;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      if (item.sentAt < existing.oldestSentAt) {
        existing.oldestSentAt = item.sentAt;
      }
    } else {
      map.set(key, {
        orderId: key,
        number: item.order.number,
        type: item.order.type,
        tableName: item.order.table?.name ?? null,
        items: [item],
        oldestSentAt: item.sentAt,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.oldestSentAt.localeCompare(b.oldestSentAt),
  );
}

const STATION_STORAGE_PREFIX = "erpresto.kds.station.";

function CocinaScreen() {
  const queryClient = useQueryClient();
  const { branchId } = useBranch();
  useRealtime(branchId);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const stationsQuery = useQuery({
    queryKey: STATIONS_QUERY_KEY,
    queryFn: getStations,
  });

  // Estación inicial: ?station= de la URL → localStorage por sucursal → "" (Todas).
  // Se resuelve una sola vez en cliente para no romper la hidratación.
  const [station, setStationState] = useState("");
  const [stationReady, setStationReady] = useState(false);

  useEffect(() => {
    if (stationReady) return;
    const fromUrl = searchParams.get("station");
    if (fromUrl != null) {
      setStationState(fromUrl);
      setStationReady(true);
      return;
    }
    let fromStorage: string | null = null;
    if (typeof window !== "undefined" && branchId) {
      fromStorage = window.localStorage.getItem(
        `${STATION_STORAGE_PREFIX}${branchId}`,
      );
    }
    setStationState(fromStorage ?? "");
    setStationReady(true);
  }, [stationReady, searchParams, branchId]);

  // Cambio de estación: persistir en URL (replace, sin recargar) y localStorage.
  const setStation = useCallback(
    (value: string) => {
      setStationState(value);
      if (typeof window !== "undefined" && branchId) {
        const key = `${STATION_STORAGE_PREFIX}${branchId}`;
        if (value) {
          window.localStorage.setItem(key, value);
        } else {
          window.localStorage.removeItem(key);
        }
      }
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("station", value);
      } else {
        params.delete("station");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [branchId, pathname, router, searchParams],
  );

  // Tick por segundo para los timers mm:ss.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const itemsQuery = useQuery({
    queryKey: ["kitchen", branchId, station],
    queryFn: () =>
      getKitchenItems({
        branchId: branchId as string,
        station: station || undefined,
      }),
    enabled: Boolean(branchId),
    refetchInterval: 10_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({
      itemId,
      status,
    }: {
      itemId: string;
      status: OrderItemStatus;
    }) => updateKitchenItemStatus(itemId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["areas"] });
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo actualizar el ítem"));
      void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
    },
  });

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);

  // Estaciones del catálogo central + la seleccionada (por si quedó fuera del
  // catálogo vía URL bookmarkeada), preservando el orden configurado.
  const stations = useMemo(() => {
    const list = [...(stationsQuery.data ?? [])];
    if (
      station &&
      !list.some((s) => s.toLowerCase() === station.toLowerCase())
    ) {
      list.push(station);
    }
    return list;
  }, [stationsQuery.data, station]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Cocina (KDS)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pedidos en vivo. Los timers pasan a rojo después de {LATE_MINUTES}{" "}
            minutos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={station}
            onChange={(event) => setStation(event.target.value)}
            className="w-44"
            aria-label="Filtrar por estación"
          >
            <option value="">Todas las estaciones</option>
            {stations.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          {itemsQuery.isFetching && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {!branchId ? (
        <BranchRequired />
      ) : itemsQuery.isPending ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : itemsQuery.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ServerOff className="size-6 text-destructive" />
            </div>
            <p className="font-medium">
              {getErrorMessage(
                itemsQuery.error,
                "No se pudieron cargar los pedidos de cocina",
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void itemsQuery.refetch()}
            >
              <RefreshCw />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <ChefHat className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Cocina al día</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No hay ítems pendientes, en preparación ni listos.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {COLUMNS.map((column) => {
            const groups = groupByOrder(
              items.filter((item) => item.status === column.status),
            );
            return (
              <div key={column.status} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {column.title}
                  </h2>
                  <Badge variant="secondary">
                    {groups.reduce((sum, g) => sum + g.items.length, 0)}
                  </Badge>
                </div>
                {groups.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    Sin ítems
                  </p>
                ) : (
                  groups.map((group) => {
                    const late =
                      minutesSince(group.oldestSentAt, now) >= LATE_MINUTES;
                    return (
                      <Card
                        key={group.orderId}
                        className={cn("border-t-4", column.accent)}
                      >
                        <CardContent className="space-y-2.5 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">
                              {group.number != null
                                ? `#${group.number}`
                                : "Pedido"}
                            </span>
                            <Badge variant="outline">
                              {group.tableName ??
                                ORDER_TYPE_LABELS[group.type]}
                            </Badge>
                            <span
                              className={cn(
                                "ml-auto font-mono text-sm tabular-nums",
                                late
                                  ? "font-semibold text-destructive"
                                  : "text-muted-foreground",
                              )}
                            >
                              {formatElapsed(group.oldestSentAt, now)}
                            </span>
                          </div>
                          <ul className="space-y-2">
                            {group.items.map((item) => {
                              const NextIcon = column.nextIcon;
                              return (
                                <li
                                  key={item.id}
                                  className="flex items-start justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-2"
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium">
                                      <span className="tabular-nums">
                                        {item.quantity}×
                                      </span>{" "}
                                      {item.product.name}
                                    </p>
                                    {item.notes && (
                                      <p className="mt-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                                        {item.notes}
                                      </p>
                                    )}
                                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                      {item.station && !station && (
                                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                          {item.station}
                                        </span>
                                      )}
                                      {item.course != null && (
                                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                          Tiempo {item.course}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {column.nextStatus && NextIcon && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="shrink-0"
                                      disabled={statusMutation.isPending}
                                      onClick={() =>
                                        statusMutation.mutate({
                                          itemId: item.id,
                                          status: column.nextStatus!,
                                        })
                                      }
                                    >
                                      <NextIcon />
                                      {column.nextLabel}
                                    </Button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CocinaPage() {
  // useSearchParams requiere un límite de Suspense para el build de Next.
  return (
    <Suspense fallback={null}>
      <CocinaScreen />
    </Suspense>
  );
}
