"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Armchair,
  Ban,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  ServerOff,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import { useRealtime } from "@/lib/realtime";
import {
  getReservations,
  RESERVATION_STATUS_LABELS,
  seatReservation,
  updateReservation,
} from "@/lib/reservations";
import { getAreas } from "@/lib/tables";
import type { Reservation, ReservationStatus } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { BranchRequired } from "@/components/branch-required";
import { ReservationDialog } from "@/components/reservations/reservation-dialog";
import type { BadgeProps } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<ReservationStatus, BadgeProps["variant"]> = {
  PENDING: "warning",
  CONFIRMED: "default",
  SEATED: "success",
  CANCELLED: "destructive",
  NO_SHOW: "secondary",
};

const STATUSES = Object.keys(
  RESERVATION_STATUS_LABELS,
) as ReservationStatus[];

const dayLabelFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function shiftDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

export default function ReservasPage() {
  const queryClient = useQueryClient();
  const { branchId } = useBranch();
  useRealtime(branchId);

  const [dateStr, setDateStr] = useState(() => toDateInputValue(new Date()));
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "">("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [toSeat, setToSeat] = useState<Reservation | null>(null);
  const [seatTableId, setSeatTableId] = useState<string | null>(null);
  const [toFinalize, setToFinalize] = useState<{
    reservation: Reservation;
    status: "CANCELLED" | "NO_SHOW";
  } | null>(null);

  const isToday = dateStr === toDateInputValue(new Date());

  const range = useMemo(() => {
    const from = new Date(`${dateStr}T00:00:00`);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [dateStr]);

  const reservationsQuery = useQuery({
    queryKey: [
      "reservations",
      { branchId, from: range.from, to: range.to, status: statusFilter },
    ],
    queryFn: () =>
      getReservations({
        branchId: branchId as string,
        from: range.from,
        to: range.to,
        status: statusFilter || undefined,
        page: 1,
        limit: 200,
      }),
    enabled: branchId !== null,
    refetchInterval: 60_000,
  });

  const areasQuery = useQuery({
    queryKey: ["areas", branchId],
    queryFn: () => getAreas(branchId as string),
    enabled: branchId !== null && toSeat !== null,
    staleTime: 60_000,
  });

  const tableOptions = useMemo(() => {
    const options: { value: string; label: string; description?: string }[] =
      [];
    for (const area of areasQuery.data ?? []) {
      for (const table of area.tables) {
        if (table.shape === "DECOR") continue;
        options.push({
          value: table.id,
          label: `${table.name} · ${area.name}`,
          description: `${table.capacity} personas`,
        });
      }
    }
    return options;
  }, [areasQuery.data]);

  const reservations = useMemo(
    () =>
      [...(reservationsQuery.data?.data ?? [])].sort((a, b) =>
        a.scheduledAt.localeCompare(b.scheduledAt),
      ),
    [reservationsQuery.data],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["reservations"] });
    void queryClient.invalidateQueries({ queryKey: ["areas"] });
  };

  const confirmMutation = useMutation({
    mutationFn: (reservation: Reservation) =>
      updateReservation(reservation.id, { status: "CONFIRMED" }),
    onSuccess: () => {
      invalidate();
      toast.success("Reserva confirmada");
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo confirmar la reserva"));
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: (input: { id: string; status: "CANCELLED" | "NO_SHOW" }) =>
      updateReservation(input.id, { status: input.status }),
    onSuccess: (_data, input) => {
      invalidate();
      toast.success(
        input.status === "CANCELLED"
          ? "Reserva cancelada"
          : "Reserva marcada como no-show",
      );
      setToFinalize(null);
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo actualizar la reserva"));
    },
  });

  const seatMutation = useMutation({
    mutationFn: (input: { id: string; tableId?: string }) =>
      seatReservation(input.id, input.tableId),
    onSuccess: () => {
      invalidate();
      toast.success("Cliente sentado", {
        description: "La mesa pasó a estar ocupada.",
      });
      setToSeat(null);
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo sentar la reserva"));
    },
  });

  const onSeat = (reservation: Reservation) => {
    if (reservation.tableId) {
      seatMutation.mutate({ id: reservation.id });
    } else {
      setSeatTableId(null);
      setToSeat(reservation);
    }
  };

  const errorMessage = getErrorMessage(
    reservationsQuery.error,
    "Ocurrió un error al cargar las reservas",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reservas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Agenda del día con confirmación, asignación de mesas y seguimiento.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus />
          Nueva reserva
        </Button>
      </div>

      {branchId === null ? (
        <BranchRequired />
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4 md:p-6">
            {/* Selector de fecha */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDateStr((d) => shiftDate(d, -1))}
                aria-label="Día anterior"
              >
                <ChevronLeft />
              </Button>
              <div className="min-w-48 text-center">
                <p className="font-medium capitalize">
                  {dayLabelFormatter.format(new Date(`${dateStr}T12:00:00`))}
                </p>
                {isToday && <p className="text-xs text-muted-foreground">Hoy</p>}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDateStr((d) => shiftDate(d, 1))}
                aria-label="Día siguiente"
              >
                <ChevronRight />
              </Button>
              {!isToday && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateStr(toDateInputValue(new Date()))}
                >
                  Volver a hoy
                </Button>
              )}
            </div>

            {/* Chips de estado */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setStatusFilter("")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                  statusFilter === ""
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                Todas
              </button>
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setStatusFilter((current) =>
                      current === status ? "" : status,
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                    statusFilter === status
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {RESERVATION_STATUS_LABELS[status]}
                </button>
              ))}
            </div>

            {reservationsQuery.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : reservationsQuery.isError ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <ServerOff className="size-6 text-destructive" />
                </div>
                <p className="font-medium">{errorMessage}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void reservationsQuery.refetch()}
                >
                  <RefreshCw />
                  Reintentar
                </Button>
              </div>
            ) : reservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <CalendarClock className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    {statusFilter
                      ? "No hay reservas con ese estado para el día"
                      : "No hay reservas para este día"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {statusFilter
                      ? "Probá con otro estado o quitá el filtro."
                      : "Agendá la primera reserva del día."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Hora</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead className="text-right">Personas</TableHead>
                      <TableHead>Mesa</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((reservation) => {
                      const actionable =
                        reservation.status === "PENDING" ||
                        reservation.status === "CONFIRMED";
                      return (
                        <TableRow key={reservation.id}>
                          <TableCell className="font-medium tabular-nums">
                            {formatTime(reservation.scheduledAt)}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {reservation.name}
                            </div>
                            {reservation.customer && (
                              <div className="text-xs text-muted-foreground">
                                Cliente registrado
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {reservation.phone ?? (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="inline-flex items-center gap-1">
                              <Users className="size-3.5 text-muted-foreground" />
                              {reservation.partySize}
                            </span>
                          </TableCell>
                          <TableCell>
                            {reservation.table?.name ?? (
                              <span className="text-xs text-muted-foreground">
                                Sin mesa
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[reservation.status]}>
                              {RESERVATION_STATUS_LABELS[reservation.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-48">
                            {reservation.notes ? (
                              <span
                                className="block truncate text-sm text-muted-foreground"
                                title={reservation.notes}
                              >
                                {reservation.notes}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {actionable ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal />
                                    <span className="sr-only">
                                      Acciones de la reserva de{" "}
                                      {reservation.name}
                                    </span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {reservation.status === "PENDING" && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        confirmMutation.mutate(reservation)
                                      }
                                    >
                                      <CheckCircle2 />
                                      Confirmar
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => onSeat(reservation)}
                                  >
                                    <Armchair />
                                    Sentar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditing(reservation);
                                      setDialogOpen(true);
                                    }}
                                  >
                                    <Pencil />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setToFinalize({
                                        reservation,
                                        status: "NO_SHOW",
                                      })
                                    }
                                  >
                                    <CalendarX2 />
                                    No-show
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive hover:text-destructive [&_svg]:text-destructive"
                                    onClick={() =>
                                      setToFinalize({
                                        reservation,
                                        status: "CANCELLED",
                                      })
                                    }
                                  >
                                    <Ban />
                                    Cancelar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {branchId !== null && (
        <ReservationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          branchId={branchId}
          reservation={editing}
          defaultDate={dateStr}
        />
      )}

      {/* Sentar: selector de mesa cuando la reserva no tiene una asignada */}
      <Dialog
        open={toSeat !== null}
        onOpenChange={(open) => {
          if (!open) setToSeat(null);
        }}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Sentar reserva</DialogTitle>
          <DialogDescription>
            La reserva de{" "}
            <span className="font-medium text-foreground">{toSeat?.name}</span>{" "}
            no tiene mesa asignada. Elegí en qué mesa sentarla; la mesa pasa a
            Ocupada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Mesa</Label>
          <Combobox
            options={tableOptions}
            value={seatTableId}
            onChange={setSeatTableId}
            placeholder="Elegí una mesa…"
            searchPlaceholder="Buscar mesa…"
            emptyText="Sin mesas en la sucursal"
            loading={areasQuery.isPending}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setToSeat(null)}
            disabled={seatMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            disabled={seatTableId === null || seatMutation.isPending}
            onClick={() => {
              if (toSeat && seatTableId) {
                seatMutation.mutate({ id: toSeat.id, tableId: seatTableId });
              }
            }}
          >
            {seatMutation.isPending && <Loader2 className="animate-spin" />}
            Sentar
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Confirmación de cancelación / no-show */}
      <Dialog
        open={toFinalize !== null}
        onOpenChange={(open) => {
          if (!open) setToFinalize(null);
        }}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>
            {toFinalize?.status === "CANCELLED"
              ? "Cancelar reserva"
              : "Marcar como no-show"}
          </DialogTitle>
          <DialogDescription>
            ¿Seguro que querés{" "}
            {toFinalize?.status === "CANCELLED"
              ? "cancelar"
              : "marcar como no-show"}{" "}
            la reserva de{" "}
            <span className="font-medium text-foreground">
              {toFinalize?.reservation.name}
            </span>
            ? Si tenía una mesa bloqueada, vuelve a quedar libre.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setToFinalize(null)}
            disabled={finalizeMutation.isPending}
          >
            Volver
          </Button>
          <Button
            variant="destructive"
            disabled={finalizeMutation.isPending}
            onClick={() => {
              if (toFinalize) {
                finalizeMutation.mutate({
                  id: toFinalize.reservation.id,
                  status: toFinalize.status,
                });
              }
            }}
          >
            {finalizeMutation.isPending && <Loader2 className="animate-spin" />}
            {toFinalize?.status === "CANCELLED"
              ? "Cancelar reserva"
              : "Confirmar no-show"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
