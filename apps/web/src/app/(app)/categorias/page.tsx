"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  ServerOff,
  Tags,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { deleteCategory, getCategories } from "@/lib/categories";
import type { Category } from "@/lib/types";
import { CategoryDialog } from "@/components/categories/category-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function CategoriasPage() {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoría eliminada");
      setToDelete(null);
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No se pudo eliminar la categoría",
      );
    },
  });

  const categories = useMemo(
    () =>
      [...(categoriesQuery.data ?? [])].sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          a.name.localeCompare(b.name, "es"),
      ),
    [categoriesQuery.data],
  );

  const errorMessage =
    categoriesQuery.error instanceof ApiError
      ? categoriesQuery.error.message
      : "Ocurrió un error al cargar las categorías";

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organizá el catálogo para la carta y el POS.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Nueva categoría
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 md:p-6">
          {categoriesQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : categoriesQuery.isError ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <ServerOff className="size-6 text-destructive" />
              </div>
              <p className="font-medium">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void categoriesQuery.refetch()}
              >
                <RefreshCw />
                Reintentar
              </Button>
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Tags className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Todavía no hay categorías</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Creá la primera categoría para organizar el catálogo.
                </p>
              </div>
              <Button size="sm" onClick={openCreate}>
                <Plus />
                Nueva categoría
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead className="text-right">Orden</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">
                        {category.name}
                      </TableCell>
                      <TableCell>
                        {category.color ? (
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden
                              className="inline-block size-5 rounded-md border"
                              style={{ backgroundColor: category.color }}
                            />
                            <code className="text-xs text-muted-foreground">
                              {category.color}
                            </code>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin color
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {category.sortOrder ?? 0}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal />
                              <span className="sr-only">
                                Acciones de {category.name}
                              </span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEdit(category)}
                            >
                              <Pencil />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive hover:text-destructive [&_svg]:text-destructive"
                              onClick={() => setToDelete(category)}
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
          )}
        </CardContent>
      </Card>

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
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
          <DialogTitle>Eliminar categoría</DialogTitle>
          <DialogDescription>
            ¿Seguro que querés eliminar{" "}
            <span className="font-medium text-foreground">
              {toDelete?.name}
            </span>
            ? Los productos asociados quedan sin categoría.
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
