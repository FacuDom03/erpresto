"use client";

import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Cake,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ServerOff,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api";
import { deleteCustomer, getCustomer, getCustomers } from "@/lib/customers";
import type { Customer } from "@/lib/types";
import {
  formatARS,
  formatBirthday,
  formatDateTime,
} from "@/lib/utils";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

export default function ClientesPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Debounce de la búsqueda (300 ms) y reset de página.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const customersQuery = useQuery({
    queryKey: ["customers", { page, limit: PAGE_SIZE, search }],
    queryFn: () => getCustomers({ page, limit: PAGE_SIZE, search }),
    placeholderData: keepPreviousData,
  });

  const detailQuery = useQuery({
    queryKey: ["customers", detailId],
    queryFn: () => getCustomer(detailId as string),
    enabled: detailId !== null,
  });
  const detail = detailQuery.data ?? null;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente eliminado");
      setToDelete(null);
      setDetailId(null);
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo eliminar el cliente"));
    },
  });

  const customers = customersQuery.data?.data ?? [];
  const total = customersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const errorMessage = getErrorMessage(
    customersQuery.error,
    "Ocurrió un error al cargar los clientes",
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Base de clientes con historial de consumo y datos de contacto.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Nuevo cliente
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nombre, teléfono o email…"
              className="pl-8"
            />
          </div>

          {customersQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : customersQuery.isError ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <ServerOff className="size-6 text-destructive" />
              </div>
              <p className="font-medium">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void customersQuery.refetch()}
              >
                <RefreshCw />
                Reintentar
              </Button>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Users className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">
                  {search
                    ? "No encontramos clientes para tu búsqueda"
                    : "Todavía no hay clientes"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? "Probá con otro término o limpiá la búsqueda."
                    : "Agregá el primer cliente de tu negocio."}
                </p>
              </div>
              {!search && (
                <Button size="sm" onClick={openCreate}>
                  <Plus />
                  Nuevo cliente
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Cumpleaños</TableHead>
                      <TableHead className="text-right">Puntos</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer"
                        onClick={() => setDetailId(customer.id)}
                      >
                        <TableCell>
                          <div className="font-medium">{customer.name}</div>
                          {!customer.active && (
                            <Badge variant="outline" className="mt-0.5">
                              Inactivo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {customer.phone ?? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {customer.email ?? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {customer.birthday ? (
                            formatBirthday(customer.birthday)
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Star className="size-3.5 text-warning" />
                            {customer.loyaltyPoints}
                          </span>
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal />
                                <span className="sr-only">
                                  Acciones de {customer.name}
                                </span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEdit(customer)}
                              >
                                <Pencil />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive hover:text-destructive [&_svg]:text-destructive"
                                onClick={() => setToDelete(customer)}
                              >
                                <Trash2 />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <p>
                  Mostrando{" "}
                  <span className="font-medium text-foreground">
                    {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, total)}
                  </span>{" "}
                  de <span className="font-medium text-foreground">{total}</span>{" "}
                  clientes
                  {customersQuery.isFetching && (
                    <Loader2 className="ml-2 inline size-3.5 animate-spin" />
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
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
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={editing}
      />

      {/* Detalle del cliente */}
      <Sheet
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        className="max-w-md"
      >
        <SheetHeader>
          <SheetTitle>{detail?.name ?? "Cliente"}</SheetTitle>
          <SheetDescription>
            Historial de consumo y datos de contacto.
          </SheetDescription>
        </SheetHeader>

        {detailQuery.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : detailQuery.isError || !detail ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
            <p className="text-sm font-medium">
              {getErrorMessage(
                detailQuery.error,
                "No se pudo cargar el cliente",
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void detailQuery.refetch()}
            >
              <RefreshCw />
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-lg font-semibold tabular-nums">
                  {detail.stats?.ordersCount ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Pedidos</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-lg font-semibold tabular-nums">
                  {formatARS(detail.stats?.totalSpent ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total gastado</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-lg font-semibold tabular-nums">
                  {detail.stats?.lastOrderAt
                    ? formatDateTime(detail.stats.lastOrderAt)
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Última visita</p>
              </div>
            </div>

            {!detail.active && (
              <Badge variant="outline">Cliente inactivo</Badge>
            )}

            {/* Datos */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                <span className="tabular-nums">{detail.phone ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <span>{detail.email ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Cake className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  {detail.birthday ? formatBirthday(detail.birthday) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <span>{detail.address ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="size-4 shrink-0 text-warning" />
                <span className="tabular-nums">
                  {detail.loyaltyPoints} puntos
                </span>
              </div>
              {detail.taxId && (
                <p className="text-muted-foreground">
                  CUIT/CUIL:{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {detail.taxId}
                  </code>
                </p>
              )}
              {detail.notes && (
                <div className="rounded-lg bg-muted/50 p-3 text-muted-foreground">
                  {detail.notes}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEdit(detail)}
              >
                <Pencil />
                Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setToDelete(detail)}
              >
                <Trash2 />
                Eliminar
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {/* Confirmación de borrado */}
      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Eliminar cliente</DialogTitle>
          <DialogDescription>
            ¿Seguro que querés eliminar{" "}
            <span className="font-medium text-foreground">
              {toDelete?.name}
            </span>
            ? Si tiene pedidos o reservas asociadas queda inactivo (baja
            lógica) en lugar de borrarse.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setToDelete(null)}
            disabled={deleteMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (toDelete) deleteMutation.mutate(toDelete.id);
            }}
          >
            {deleteMutation.isPending && <Loader2 className="animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
