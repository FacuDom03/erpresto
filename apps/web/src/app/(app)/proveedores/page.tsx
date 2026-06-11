"use client";

import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ServerOff,
  Star,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { deleteSupplier, getSuppliers } from "@/lib/suppliers";
import type { Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SupplierDialog } from "@/components/suppliers/supplier-dialog";
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

function RatingStars({ rating }: { rating: number | null | undefined }) {
  if (rating == null || rating <= 0) {
    return <span className="text-xs text-muted-foreground">Sin calificar</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${rating} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "size-4",
            star <= rating
              ? "fill-warning text-warning"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

export default function ProveedoresPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [toDelete, setToDelete] = useState<Supplier | null>(null);

  // Debounce de la búsqueda (300 ms) y reset de página.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", { page, limit: PAGE_SIZE, search }],
    queryFn: () => getSuppliers({ page, limit: PAGE_SIZE, search }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Proveedor eliminado");
      setToDelete(null);
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No se pudo eliminar el proveedor",
      );
    },
  });

  const suppliers = suppliersQuery.data?.data ?? [];
  const total = suppliersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const errorMessage =
    suppliersQuery.error instanceof ApiError
      ? suppliersQuery.error.message
      : "Ocurrió un error al cargar los proveedores";

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Directorio de proveedores con contacto, plazos de entrega y
            calificación.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Nuevo proveedor
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nombre o CUIT…"
              className="pl-8"
            />
          </div>

          {suppliersQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : suppliersQuery.isError ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <ServerOff className="size-6 text-destructive" />
              </div>
              <p className="font-medium">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void suppliersQuery.refetch()}
              >
                <RefreshCw />
                Reintentar
              </Button>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Truck className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">
                  {search
                    ? "No encontramos proveedores para tu búsqueda"
                    : "Todavía no hay proveedores"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? "Probá con otro término o limpiá la búsqueda."
                    : "Agregá el primer proveedor de tu negocio."}
                </p>
              </div>
              {!search && (
                <Button size="sm" onClick={openCreate}>
                  <Plus />
                  Nuevo proveedor
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
                      <TableHead>CUIT</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead className="text-right">Entrega</TableHead>
                      <TableHead>Calificación</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell>
                          <div className="font-medium">{supplier.name}</div>
                          {!supplier.active && (
                            <Badge variant="outline" className="mt-0.5">
                              Inactivo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.cuit ? (
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                              {supplier.cuit}
                            </code>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.contactName ?? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {supplier.phone ?? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {supplier.deliveryDays != null ? (
                            `${supplier.deliveryDays} ${
                              supplier.deliveryDays === 1 ? "día" : "días"
                            }`
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <RatingStars rating={supplier.rating} />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal />
                                <span className="sr-only">
                                  Acciones de {supplier.name}
                                </span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEdit(supplier)}
                              >
                                <Pencil />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive hover:text-destructive [&_svg]:text-destructive"
                                onClick={() => setToDelete(supplier)}
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
                  proveedores
                  {suppliersQuery.isFetching && (
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

      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editing}
      />

      {/* Confirmación de borrado */}
      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Eliminar proveedor</DialogTitle>
          <DialogDescription>
            ¿Seguro que querés eliminar{" "}
            <span className="font-medium text-foreground">
              {toDelete?.name}
            </span>
            ? Si tiene órdenes de compra asociadas queda inactivo en lugar de
            borrarse.
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
