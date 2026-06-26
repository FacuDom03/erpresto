"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  RefreshCw,
  ServerOff,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import { useRealtime } from "@/lib/realtime";
import {
  addCashMovement,
  closeCashSession,
  getCashRegisters,
  getCashSession,
  getCashSessions,
  MOVEMENT_TYPE_LABELS,
  openCashSession,
} from "@/lib/cash";
import { PAYMENT_METHOD_LABELS } from "@/lib/orders";
import type { CashMovementType, PaymentMethod } from "@/lib/types";
import { cn, formatARS, formatDateTime } from "@/lib/utils";
import { BranchRequired } from "@/components/branch-required";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const HISTORY_PAGE_SIZE = 10;

const MOVEMENT_TYPES: CashMovementType[] = [
  "WITHDRAWAL",
  "DEPOSIT",
  "EXPENSE",
  "TIP",
];

export default function CajaPage() {
  const queryClient = useQueryClient();
  const { branchId } = useBranch();
  useRealtime(branchId);

  const [registerId, setRegisterId] = useState<string | null>(null);
  const [openingAmount, setOpeningAmount] = useState("");
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [movementType, setMovementType] =
    useState<CashMovementType>("WITHDRAWAL");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingAmount, setClosingAmount] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const registersQuery = useQuery({
    queryKey: ["cash", "registers", branchId],
    queryFn: () => getCashRegisters(branchId as string),
    enabled: Boolean(branchId),
    refetchInterval: 15_000,
  });

  const registers = useMemo(
    () => registersQuery.data ?? [],
    [registersQuery.data],
  );

  useEffect(() => {
    if (registers.length === 0) return;
    if (!registerId || !registers.some((r) => r.id === registerId)) {
      setRegisterId(registers[0].id);
      setHistoryPage(1);
    }
  }, [registers, registerId]);

  const register = registers.find((r) => r.id === registerId) ?? null;
  const currentSessionId = register?.currentSession?.id ?? null;

  const sessionQuery = useQuery({
    queryKey: ["cash", "session", currentSessionId],
    queryFn: () => getCashSession(currentSessionId as string),
    enabled: Boolean(currentSessionId),
    refetchInterval: 15_000,
  });

  const historyQuery = useQuery({
    queryKey: ["cash", "sessions", registerId, historyPage],
    queryFn: () =>
      getCashSessions({
        registerId: registerId as string,
        page: historyPage,
        limit: HISTORY_PAGE_SIZE,
      }),
    enabled: Boolean(registerId),
  });

  const invalidateCash = () => {
    void queryClient.invalidateQueries({ queryKey: ["cash"] });
  };

  const openMutation = useMutation({
    mutationFn: () =>
      openCashSession({
        registerId: registerId as string,
        openingAmount: Number(openingAmount) || 0,
      }),
    onSuccess: () => {
      toast.success("Caja abierta");
      setOpeningAmount("");
      invalidateCash();
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo abrir la caja"));
      invalidateCash();
    },
  });

  const movementMutation = useMutation({
    mutationFn: () =>
      addCashMovement(currentSessionId as string, {
        type: movementType,
        amount: Number(movementAmount),
        notes: movementNotes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Movimiento registrado");
      setMovementDialogOpen(false);
      setMovementAmount("");
      setMovementNotes("");
      invalidateCash();
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo registrar el movimiento"));
    },
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      closeCashSession(currentSessionId as string, Number(closingAmount) || 0),
    onSuccess: () => {
      toast.success("Caja cerrada");
      setCloseDialogOpen(false);
      setClosingAmount("");
      invalidateCash();
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo cerrar la caja"));
    },
  });

  const session = sessionQuery.data ?? null;
  const expected = session?.expectedAmount ?? null;
  const closingDiff =
    expected != null && closingAmount !== ""
      ? (Number(closingAmount) || 0) - expected
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Caja</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Apertura, movimientos y cierre de la caja de la sucursal.
          </p>
        </div>
        {registers.length > 1 && (
          <Select
            value={registerId ?? ""}
            onChange={(event) => setRegisterId(event.target.value)}
            className="w-48"
            aria-label="Elegir caja"
          >
            {registers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {!branchId ? (
        <BranchRequired />
      ) : registersQuery.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : registersQuery.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ServerOff className="size-6 text-destructive" />
            </div>
            <p className="font-medium">
              {getErrorMessage(
                registersQuery.error,
                "No se pudo cargar el estado de la caja",
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void registersQuery.refetch()}
            >
              <RefreshCw />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : registers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Wallet className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No hay cajas configuradas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Creá una caja registradora para esta sucursal desde la
                configuración.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : !currentSessionId ? (
        /* Sin sesión abierta → abrir caja */
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Abrir caja</CardTitle>
            <CardDescription>
              {register?.name}: no hay una sesión abierta. Ingresá el monto
              inicial en efectivo para empezar a operar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="opening-amount">Monto inicial</Label>
              <Input
                id="opening-amount"
                type="number"
                min={0}
                step="0.01"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
                placeholder="0,00"
                className="tabular-nums"
              />
            </div>
            <Button
              className="w-full"
              disabled={openingAmount === "" || openMutation.isPending}
              onClick={() => openMutation.mutate()}
            >
              {openMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Wallet />
              )}
              Abrir caja
            </Button>
          </CardContent>
        </Card>
      ) : sessionQuery.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : sessionQuery.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="font-medium">
              {getErrorMessage(
                sessionQuery.error,
                "No se pudo cargar la sesión de caja",
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void sessionQuery.refetch()}
            >
              <RefreshCw />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : (
        session && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">Caja abierta</Badge>
              {session.openedAt && (
                <span className="text-sm text-muted-foreground">
                  desde {formatDateTime(session.openedAt)}
                </span>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMovementDialogOpen(true)}
                >
                  <ArrowUpFromLine />
                  Movimiento
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setClosingAmount("");
                    setCloseDialogOpen(true);
                  }}
                >
                  <Lock />
                  Cerrar caja
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Apertura"
                value={formatARS(session.openingAmount)}
              />
              <SummaryCard
                title="Esperado en efectivo"
                value={expected != null ? formatARS(expected) : "—"}
                highlight
              />
              <Card className="sm:col-span-2">
                <CardHeader className="pb-2">
                  <CardDescription>Ventas por método</CardDescription>
                </CardHeader>
                <CardContent>
                  {session.salesByMethod &&
                  Object.keys(session.salesByMethod).length > 0 ? (
                    <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      {Object.entries(session.salesByMethod).map(
                        ([method, amount]) => (
                          <li
                            key={method}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="text-muted-foreground">
                              {PAYMENT_METHOD_LABELS[
                                method as PaymentMethod
                              ] ?? method}
                            </span>
                            <span className="font-medium tabular-nums">
                              {formatARS(amount ?? 0)}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sin ventas registradas en esta sesión.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Movimientos de la sesión</CardDescription>
              </CardHeader>
              <CardContent>
                {session.movements && session.movements.length > 0 ? (
                  <ul className="divide-y text-sm">
                    {session.movements.map((movement) => {
                      const negative =
                        movement.type === "WITHDRAWAL" ||
                        movement.type === "EXPENSE";
                      return (
                        <li
                          key={movement.id}
                          className="flex items-center gap-3 py-2"
                        >
                          {negative ? (
                            <ArrowUpFromLine className="size-4 text-destructive" />
                          ) : (
                            <ArrowDownToLine className="size-4 text-success" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium">
                              {MOVEMENT_TYPE_LABELS[movement.type]}
                            </p>
                            {movement.notes && (
                              <p className="truncate text-xs text-muted-foreground">
                                {movement.notes}
                              </p>
                            )}
                          </div>
                          <div className="ml-auto text-right">
                            <p
                              className={cn(
                                "font-medium tabular-nums",
                                negative ? "text-destructive" : "text-success",
                              )}
                            >
                              {negative ? "−" : "+"}
                              {formatARS(movement.amount)}
                            </p>
                            {movement.createdAt && (
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(movement.createdAt)}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin movimientos en esta sesión.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )
      )}

      {/* Historial de sesiones */}
      {branchId && registerId && registers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Historial de sesiones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {historyQuery.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : historyQuery.isError ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {getErrorMessage(
                  historyQuery.error,
                  "No se pudo cargar el historial",
                )}
              </p>
            ) : (historyQuery.data?.data.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Todavía no hay sesiones de caja registradas.
              </p>
            ) : (
              <>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Apertura</TableHead>
                        <TableHead>Cierre</TableHead>
                        <TableHead className="text-right">Inicial</TableHead>
                        <TableHead className="text-right">Esperado</TableHead>
                        <TableHead className="text-right">Contado</TableHead>
                        <TableHead className="text-right">Diferencia</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(historyQuery.data?.data ?? []).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{formatDateTime(s.openedAt)}</TableCell>
                          <TableCell>{formatDateTime(s.closedAt)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatARS(s.openingAmount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.expectedAmount != null
                              ? formatARS(s.expectedAmount)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.closingAmount != null
                              ? formatARS(s.closingAmount)
                              : "—"}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right tabular-nums",
                              s.difference != null &&
                                s.difference !== 0 &&
                                "font-medium text-destructive",
                              s.difference === 0 && "text-success",
                            )}
                          >
                            {s.difference != null
                              ? formatARS(s.difference)
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                s.status === "OPEN" ? "success" : "secondary"
                              }
                            >
                              {s.status === "OPEN" ? "Abierta" : "Cerrada"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <HistoryPagination
                  page={historyPage}
                  total={historyQuery.data?.total ?? 0}
                  onChange={setHistoryPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog: agregar movimiento */}
      <Dialog
        open={movementDialogOpen}
        onOpenChange={setMovementDialogOpen}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Nuevo movimiento de caja</DialogTitle>
          <DialogDescription>
            Retiros y gastos restan del efectivo esperado; depósitos suman.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mov-type">Tipo</Label>
            <Select
              id="mov-type"
              value={movementType}
              onChange={(event) =>
                setMovementType(event.target.value as CashMovementType)
              }
            >
              {MOVEMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {MOVEMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-amount">Monto</Label>
            <Input
              id="mov-amount"
              type="number"
              min={0}
              step="0.01"
              value={movementAmount}
              onChange={(event) => setMovementAmount(event.target.value)}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-notes">Nota (opcional)</Label>
            <Input
              id="mov-notes"
              value={movementNotes}
              onChange={(event) => setMovementNotes(event.target.value)}
              placeholder="Por ej. pago a proveedor"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setMovementDialogOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            disabled={
              !(Number(movementAmount) > 0) || movementMutation.isPending
            }
            onClick={() => movementMutation.mutate()}
          >
            {movementMutation.isPending && (
              <Loader2 className="animate-spin" />
            )}
            Registrar
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog: cerrar caja */}
      <Dialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Cerrar caja</DialogTitle>
          <DialogDescription>
            Contá el efectivo de la caja e ingresá el monto. Se compara contra
            el esperado para calcular la diferencia.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="closing-amount">Monto contado</Label>
            <Input
              id="closing-amount"
              type="number"
              min={0}
              step="0.01"
              value={closingAmount}
              onChange={(event) => setClosingAmount(event.target.value)}
              className="tabular-nums"
              autoFocus
            />
          </div>
          <div className="space-y-1 rounded-md bg-muted/60 px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Esperado</span>
              <span className="tabular-nums">
                {expected != null ? formatARS(expected) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between font-medium">
              <span>Diferencia</span>
              <span
                className={cn(
                  "tabular-nums",
                  closingDiff == null
                    ? "text-muted-foreground"
                    : closingDiff === 0
                      ? "text-success"
                      : "text-destructive",
                )}
              >
                {closingDiff != null ? formatARS(closingDiff) : "—"}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={closingAmount === "" || closeMutation.isPending}
            onClick={() => closeMutation.mutate()}
          >
            {closeMutation.isPending && <Loader2 className="animate-spin" />}
            Confirmar cierre
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            highlight && "text-success",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function HistoryPagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft />
        Anterior
      </Button>
      <span className="tabular-nums">
        {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Siguiente
        <ChevronRight />
      </Button>
    </div>
  );
}
