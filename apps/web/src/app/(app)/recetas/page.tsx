"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  ServerOff,
  UtensilsCrossed,
} from "lucide-react";

import { ApiError } from "@/lib/api";
import { getRecipes } from "@/lib/recipes";
import { cn, formatARS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const percentFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
});

/** Verde si > 60 %, ámbar entre 30 y 60, rojo si < 30. */
function marginColor(marginPercent: number): string {
  if (marginPercent > 60) return "text-success";
  if (marginPercent >= 30) return "text-warning";
  return "text-destructive";
}

export default function RecetasPage() {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce de la búsqueda (300 ms) y reset de página.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const recipesQuery = useQuery({
    queryKey: ["recipes", { page, limit: PAGE_SIZE, search }],
    queryFn: () => getRecipes({ page, limit: PAGE_SIZE, search }),
    placeholderData: keepPreviousData,
  });

  const recipes = recipesQuery.data?.data ?? [];
  const total = recipesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const errorMessage =
    recipesQuery.error instanceof ApiError
      ? recipesQuery.error.message
      : "Ocurrió un error al cargar las recetas";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recetas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fichas técnicas con ingredientes, rendimiento, costo unitario y margen
          por producto.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar producto…"
              className="pl-8"
            />
          </div>

          {recipesQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : recipesQuery.isError ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <ServerOff className="size-6 text-destructive" />
              </div>
              <p className="font-medium">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void recipesQuery.refetch()}
              >
                <RefreshCw />
                Reintentar
              </Button>
            </div>
          ) : recipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <UtensilsCrossed className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">
                  {search
                    ? "No encontramos productos para tu búsqueda"
                    : "Todavía no hay productos en el catálogo"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? "Probá con otro término o limpiá la búsqueda."
                    : "Creá productos para empezar a definir sus recetas."}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead>Receta</TableHead>
                      <TableHead className="text-right">
                        Costo unitario
                      </TableHead>
                      <TableHead className="text-right">Margen</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipes.map((recipe) => (
                      <TableRow
                        key={recipe.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/recetas/${recipe.id}`)}
                      >
                        <TableCell className="font-medium">
                          {recipe.name}
                        </TableCell>
                        <TableCell>
                          {recipe.categoryName ? (
                            <Badge variant="secondary">
                              {recipe.categoryName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Sin categoría
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatARS(recipe.price)}
                        </TableCell>
                        <TableCell>
                          {recipe.hasRecipe ? (
                            <Badge variant={recipe.active ? "success" : "outline"}>
                              {recipe.active ? "Activa" : "Inactiva"}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Sin receta
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {recipe.unitCost !== null
                            ? formatARS(recipe.unitCost)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {recipe.marginPercent !== null ? (
                            <span
                              className={cn(
                                "font-medium tabular-nums",
                                marginColor(recipe.marginPercent),
                              )}
                            >
                              {percentFormatter.format(recipe.marginPercent)} %
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <Link
                            href={`/recetas/${recipe.id}`}
                            aria-label={`Editar receta de ${recipe.name}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            <Pencil className="size-4" />
                          </Link>
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
                  productos
                  {recipesQuery.isFetching && (
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
    </div>
  );
}
