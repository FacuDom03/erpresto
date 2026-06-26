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
  Scale,
  Search,
  ServerOff,
  Trash2,
  Wheat,
} from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import {
  deleteRawMaterial,
  getRawMaterials,
  UNIT_SHORT,
} from "@/lib/raw-materials";
import type { RawMaterial } from "@/lib/types";
import { formatARS, formatQuantity } from "@/lib/utils";
import { RawMaterialAdjustDialog } from "@/components/stock/raw-material-adjust-dialog";
import { RawMaterialDialog } from "@/components/stock/raw-material-dialog";
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

export default function MateriaPrimaPage() {
  const queryClient = useQueryClient();
  const { branchId } = useBranch();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<RawMaterial | null>(null);
  const [toDelete, setToDelete] = useState<RawMaterial | null>(null);

  // Debounce de la búsqueda (300 ms) y reset de página.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const materialsQuery = useQuery({
    queryKey: ["raw-materials", { page, limit: PAGE_SIZE, search }],
    queryFn: () => getRawMaterials({ page, limit: PAGE_SIZE, search }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRawMaterial(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      toast.success("Insumo eliminado");
      setToDelete(null);
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo eliminar el insumo",
      );
    },
  });

  const materials = materialsQuery.data?.data ?? [];
  const total = materialsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const errorMessage =
    materialsQuery.error instanceof ApiError
      ? materialsQuery.error.message
      : "Ocurrió un error al cargar los insumos";

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (material: RawMaterial) => {
    setEditing(material);
    setDialogOpen(true);
  };

  const openAdjust = (material: RawMaterial) => {
    setAdjusting(material);
    setAdjustOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Materia Prima
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inventario de insumos con stock mínimo, mermas y costos.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Nuevo insumo
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nombre, SKU o categoría…"
              className="pl-8"
            />
          </div>

          {materialsQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : materialsQuery.isError ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <ServerOff className="size-6 text-destructive" />
              </div>
              <p className="font-medium">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void materialsQuery.refetch()}
              >
                <RefreshCw />
                Reintentar
              </Button>
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Wheat className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">
                  {search
                    ? "No encontramos insumos para tu búsqueda"
                    : "Todavía no hay insumos cargados"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? "Probá con otro término o limpiá la búsqueda."
                    : "Creá el primer insumo de tu inventario."}
                </p>
              </div>
              {!search && (
                <Button size="sm" onClick={openCreate}>
                  <Plus />
                  Nuevo insumo
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
                      <TableHead>Categoría</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">Stock total</TableHead>
                      <TableHead className="text-right">
                        Costo promedio
                      </TableHead>
                      <TableHead className="text-right">Costo último</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((material) => {
                      const lowStock =
                        material.minStock !== null &&
                        material.totalStock < material.minStock;
                      return (
                        <TableRow key={material.id}>
                          <TableCell>
                            <div className="font-medium">{material.name}</div>
                            {material.sku && (
                              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                {material.sku}
                              </code>
                            )}
                          </TableCell>
                          <TableCell>
                            {material.category ? (
                              <Badge variant="secondary">
                                {material.category}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Sin categoría
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {UNIT_SHORT[material.unit]}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {lowStock ? (
                              <Badge variant="destructive">
                                {formatQuantity(material.totalStock)}{" "}
                                {UNIT_SHORT[material.unit]}
                              </Badge>
                            ) : (
                              <>
                                {formatQuantity(material.totalStock)}{" "}
                                <span className="text-xs text-muted-foreground">
                                  {UNIT_SHORT[material.unit]}
                                </span>
                              </>
                            )}
                            {lowStock && material.minStock !== null && (
                              <p className="mt-0.5 text-[11px] text-destructive">
                                mín. {formatQuantity(material.minStock)}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatARS(material.avgCost)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatARS(material.lastCost)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal />
                                  <span className="sr-only">
                                    Acciones de {material.name}
                                  </span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => openAdjust(material)}
                                >
                                  <Scale />
                                  Ajustar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openEdit(material)}
                                >
                                  <Pencil />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive hover:text-destructive [&_svg]:text-destructive"
                                  onClick={() => setToDelete(material)}
                                >
                                  <Trash2 />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
                  insumos
                  {materialsQuery.isFetching && (
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

      <RawMaterialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rawMaterial={editing}
      />

      <RawMaterialAdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        rawMaterial={adjusting}
        branchId={branchId}
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
          <DialogTitle>Eliminar insumo</DialogTitle>
          <DialogDescription>
            ¿Seguro que querés eliminar{" "}
            <span className="font-medium text-foreground">
              {toDelete?.name}
            </span>
            ? Se pierde el historial de stock asociado y esta acción no se puede
            deshacer.
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
