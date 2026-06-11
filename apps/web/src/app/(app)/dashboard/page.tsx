"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Armchair,
  CalendarClock,
  ClipboardList,
  DollarSign,
  RefreshCw,
  ServerOff,
  Trophy,
  Wallet,
} from "lucide-react";

import { useBranch } from "@/lib/branch";
import { getDashboardSummary } from "@/lib/dashboard";
import { PAYMENT_METHOD_LABELS } from "@/lib/orders";
import { UNIT_SHORT } from "@/lib/raw-materials";
import { formatARS, formatQuantity } from "@/lib/utils";
import { BranchRequired } from "@/components/branch-required";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const weekdayFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "short" });

/** "2026-06-05" → "vie" (sin corrimiento de zona horaria). */
function weekdayLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  const label = weekdayFormatter.format(parsed);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function DashboardPage() {
  const { branchId, branches } = useBranch();
  const [allBranches, setAllBranches] = useState(false);

  const showToggle = branches.length > 1;
  const consolidated = showToggle && allBranches;
  const effectiveBranchId = consolidated ? null : branchId;

  const summaryQuery = useQuery({
    queryKey: ["dashboard", effectiveBranchId ?? "all"],
    queryFn: () => getDashboardSummary(effectiveBranchId),
    enabled: consolidated || branchId !== null,
    refetchInterval: 60_000,
  });

  const summary = summaryQuery.data;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      {showToggle && (
        <div className="flex items-center rounded-lg border p-0.5">
          <Button
            variant={allBranches ? "ghost" : "secondary"}
            size="sm"
            onClick={() => setAllBranches(false)}
          >
            {branches.find((b) => b.id === branchId)?.name ?? "Sucursal activa"}
          </Button>
          <Button
            variant={allBranches ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setAllBranches(true)}
          >
            Todas las sucursales
          </Button>
        </div>
      )}
    </div>
  );

  if (!consolidated && branchId === null) {
    return (
      <div className="space-y-6">
        {header}
        <BranchRequired />
      </div>
    );
  }

  if (summaryQuery.isPending || (!summary && !summaryQuery.isError)) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (summaryQuery.isError || !summary) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ServerOff className="size-6 text-destructive" />
            </div>
            <p className="font-medium">
              No se pudo cargar el resumen del dashboard
            </p>
            <p className="text-sm text-muted-foreground">
              Verificá la conexión con el servidor y reintentá.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void summaryQuery.refetch()}
            >
              <RefreshCw />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { salesToday, tables, cash } = summary;
  const maxWeek = Math.max(1, ...summary.weekSales.map((d) => d.total));
  const criticalTotal =
    summary.criticalRawMaterials.count + summary.criticalProducts.count;

  const kpis = [
    {
      title: "Ventas de hoy",
      value: formatARS(salesToday.total),
      detail: `${salesToday.count} ${salesToday.count === 1 ? "ticket" : "tickets"} · promedio ${formatARS(salesToday.avgTicket)}`,
      icon: DollarSign,
    },
    {
      title: "Pedidos abiertos",
      value: String(summary.openOrders),
      detail: "En salón, mostrador y delivery",
      icon: ClipboardList,
    },
    {
      title: "Mesas ocupadas",
      value: `${tables.occupied} / ${tables.total}`,
      detail:
        tables.total > 0
          ? `${Math.round((tables.occupied / tables.total) * 100)}% de ocupación`
          : "Sin mesas configuradas",
      icon: Armchair,
    },
    {
      title: "Caja",
      value: cash?.open ? formatARS(cash.expectedAmount) : "Cerrada",
      detail: cash?.open
        ? "Monto esperado de la sesión abierta"
        : "No hay sesiones de caja abiertas",
      icon: Wallet,
    },
    {
      title: "Stock crítico",
      value: `${criticalTotal} ${criticalTotal === 1 ? "ítem" : "ítems"}`,
      detail: `${summary.criticalRawMaterials.count} insumos · ${summary.criticalProducts.count} platos bajo mínimo`,
      icon: AlertTriangle,
    },
    {
      title: "Reservas próximas",
      value: String(summary.upcomingReservations),
      detail: "En las próximas 24 horas",
      icon: CalendarClock,
    },
  ];

  return (
    <div className="space-y-6">
      {header}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{kpi.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{kpi.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Ventas de la semana: barras CSS, sin lib de charts */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Ventas de la semana</CardTitle>
            <CardDescription>
              Facturación diaria de los últimos 7 días
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.weekSales.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Sin ventas registradas en la última semana.
              </p>
            ) : (
              <div className="flex h-44 items-end gap-3">
                {summary.weekSales.map((d) => (
                  <div
                    key={d.date}
                    className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                    title={`${weekdayLabel(d.date)}: ${formatARS(d.total)}`}
                  >
                    <span className="text-[10px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      {Math.round(d.total / 1000)}k
                    </span>
                    <div
                      className="w-full rounded-t-sm bg-primary/80 transition-colors group-hover:bg-primary"
                      style={{
                        height: `${Math.max(2, (d.total / maxWeek) * 100)}%`,
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {weekdayLabel(d.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ventas por método (hoy) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ventas por método</CardTitle>
            <CardDescription>Cobros de hoy por medio de pago</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.salesByMethod.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Todavía no hay cobros hoy.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {summary.salesByMethod.map((entry) => (
                  <li
                    key={entry.method}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>
                      {PAYMENT_METHOD_LABELS[entry.method] ?? entry.method}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatARS(entry.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top productos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-warning" />
              Top productos
            </CardTitle>
            <CardDescription>
              Los más vendidos de los últimos 7 días
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.topProducts.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Sin ventas en los últimos 7 días.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {summary.topProducts.map((product, index) => (
                  <li
                    key={`${product.name}-${index}`}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {product.name}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatQuantity(product.quantity)} u.
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatARS(product.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Stock crítico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-destructive" />
              Stock crítico
            </CardTitle>
            <CardDescription>
              Insumos y platos por debajo del mínimo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.criticalRawMaterials.items.length === 0 &&
            summary.criticalProducts.items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Todo el stock está por encima del mínimo.
              </p>
            ) : (
              <>
                {summary.criticalRawMaterials.items.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Insumos ({summary.criticalRawMaterials.count})
                    </p>
                    <ul className="space-y-1.5">
                      {summary.criticalRawMaterials.items.map((item, index) => (
                        <li
                          key={`${item.name}-${index}`}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="min-w-0 truncate">{item.name}</span>
                          <span className="shrink-0 tabular-nums text-destructive">
                            {formatQuantity(item.totalStock)}{" "}
                            {UNIT_SHORT[item.unit]}
                            <span className="text-muted-foreground">
                              {" "}
                              / mín. {formatQuantity(item.minStock)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary.criticalProducts.items.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Platos ({summary.criticalProducts.count})
                    </p>
                    <ul className="space-y-1.5">
                      {summary.criticalProducts.items.map((item, index) => (
                        <li
                          key={`${item.name}-${index}`}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="min-w-0 truncate">{item.name}</span>
                          <span className="shrink-0 tabular-nums text-destructive">
                            {formatQuantity(item.quantity)} u.
                            <span className="text-muted-foreground">
                              {" "}
                              / mín. {formatQuantity(item.minStock)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
