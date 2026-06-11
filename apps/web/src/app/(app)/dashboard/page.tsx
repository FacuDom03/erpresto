import {
  AlertTriangle,
  Armchair,
  ClipboardList,
  DollarSign,
  Receipt,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { formatARS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Kpi {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}

const KPIS: Kpi[] = [
  {
    title: "Ventas de hoy",
    value: formatARS(486500),
    detail: "+12,4% vs. ayer",
    icon: DollarSign,
  },
  {
    title: "Ticket promedio",
    value: formatARS(18250),
    detail: "32 tickets emitidos",
    icon: Receipt,
  },
  {
    title: "Mesas ocupadas",
    value: "14 / 20",
    detail: "70% de ocupación",
    icon: Armchair,
  },
  {
    title: "Stock crítico",
    value: "5 insumos",
    detail: "Reponer antes del viernes",
    icon: AlertTriangle,
  },
  {
    title: "Caja actual",
    value: formatARS(132800),
    detail: "Apertura 09:00 · turno mañana",
    icon: Wallet,
  },
  {
    title: "Pedidos abiertos",
    value: "8",
    detail: "3 en cocina · 5 por cobrar",
    icon: ClipboardList,
  },
];

const WEEK_SALES = [
  { day: "Lun", amount: 312000 },
  { day: "Mar", amount: 284500 },
  { day: "Mié", amount: 351200 },
  { day: "Jue", amount: 402800 },
  { day: "Vie", amount: 568900 },
  { day: "Sáb", amount: 645300 },
  { day: "Dom", amount: 486500 },
];

const LAST_ORDERS = [
  { id: "#1248", mesa: "Mesa 7", items: 4, total: 24600, estado: "En cocina", hora: "21:42" },
  { id: "#1247", mesa: "Mostrador", items: 2, total: 9800, estado: "Por cobrar", hora: "21:35" },
  { id: "#1246", mesa: "Mesa 12", items: 6, total: 41200, estado: "Servido", hora: "21:21" },
  { id: "#1245", mesa: "Delivery", items: 3, total: 17450, estado: "Cobrado", hora: "21:10" },
  { id: "#1244", mesa: "Mesa 3", items: 5, total: 32900, estado: "Cobrado", hora: "20:58" },
];

function estadoBadge(estado: string) {
  switch (estado) {
    case "En cocina":
      return <Badge variant="warning">{estado}</Badge>;
    case "Por cobrar":
      return <Badge variant="destructive">{estado}</Badge>;
    case "Servido":
      return <Badge variant="secondary">{estado}</Badge>;
    default:
      return <Badge variant="success">{estado}</Badge>;
  }
}

export default function DashboardPage() {
  const maxWeek = Math.max(...WEEK_SALES.map((d) => d.amount));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Badge variant="secondary">datos de ejemplo</Badge>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KPIS.map((kpi) => (
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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ventas de la semana</CardTitle>
            <CardDescription>Facturación diaria de los últimos 7 días</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-44 items-end gap-3">
              {WEEK_SALES.map((d) => (
                <div
                  key={d.day}
                  className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                  title={`${d.day}: ${formatARS(d.amount)}`}
                >
                  <span className="text-[10px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {Math.round(d.amount / 1000)}k
                  </span>
                  <div
                    className="w-full rounded-t-sm bg-primary/80 transition-colors group-hover:bg-primary"
                    style={{ height: `${(d.amount / maxWeek) * 100}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Últimos pedidos */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Últimos pedidos</CardTitle>
            <CardDescription>Actividad reciente del salón y delivery</CardDescription>
          </CardHeader>
          <CardContent className="px-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-right">Ítems</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {LAST_ORDERS.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.mesa}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {order.items}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatARS(order.total)}
                    </TableCell>
                    <TableCell>{estadoBadge(order.estado)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {order.hora}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
