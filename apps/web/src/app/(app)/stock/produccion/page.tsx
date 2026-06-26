"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Factory,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  ServerOff,
} from "lucide-react";

import { ApiError } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import { getProductStock } from "@/lib/product-stock";
import type { ProductStockEntry } from "@/lib/types";
import { formatQuantity } from "@/lib/utils";
import { BranchRequired } from "@/components/branch-required";
import { ProductStockAdjustDialog } from "@/components/stock/product-stock-adjust-dialog";
import { ProductionDialog } from "@/components/stock/production-dialog";
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

export default function ProduccionPage() {
  const { branchId } = useBranch();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [productionOpen, setProductionOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<ProductStockEntry | null>(null);

  // Debounce de la búsqueda (filtrado client-side: la lista ya está en memoria).
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const stockQuery = useQuery({
    queryKey: ["product-stock", branchId],
    queryFn: () => getProductStock(branchId as string),
    enabled: branchId !== null,
  });

  if (branchId === null) {
    return (
      <div className="space-y-6">
        <PageHeading onLoadProduction={null} />
        <BranchRequired />
      </div>
    );
  }

  const entries = stockQuery.data ?? [];
  const term = search.toLowerCase();
  const filtered = term
    ? entries.filter(
        (entry) =>
          entry.product.name.toLowerCase().includes(term) ||
          (entry.product.sku ?? "").toLowerCase().includes(term),
      )
    : entries;

  const errorMessage =
    stockQuery.error instanceof ApiError
      ? stockQuery.error.message
      : "Ocurrió un error al cargar el stock de producción";

  return (
    <div className="space-y-6">
      <PageHeading onLoadProduction={() => setProductionOpen(true)} />

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

          {stockQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : stockQuery.isError ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <ServerOff className="size-6 text-destructive" />
              </div>
              <p className="font-medium">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void stockQuery.refetch()}
              >
                <RefreshCw />
                Reintentar
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Factory className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">
                  {search
                    ? "No encontramos productos para tu búsqueda"
                    : "Todavía no hay stock de platos en esta sucursal"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? "Probá con otro término o limpiá la búsqueda."
                    : "Cargá la primera producción para empezar a controlar el stock."}
                </p>
              </div>
              {!search && (
                <Button size="lg" onClick={() => setProductionOpen(true)}>
                  <Factory />
                  Cargar producción
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">
                      Cantidad actual
                    </TableHead>
                    <TableHead className="w-32 text-right">
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => {
                    const lowStock =
                      entry.product.minStock !== null &&
                      entry.quantity < entry.product.minStock;
                    return (
                      <TableRow key={entry.productId}>
                        <TableCell className="py-3">
                          <div className="font-medium">
                            {entry.product.name}
                          </div>
                          {entry.product.sku && (
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                              {entry.product.sku}
                            </code>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <span className="text-lg font-semibold tabular-nums">
                            {formatQuantity(entry.quantity)}
                          </span>
                          {lowStock && entry.product.minStock !== null && (
                            <Badge variant="destructive" className="ml-2">
                              Bajo mínimo (
                              {formatQuantity(entry.product.minStock)})
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <Button
                            variant="outline"
                            className="h-11 px-4"
                            onClick={() => {
                              setAdjusting(entry);
                              setAdjustOpen(true);
                            }}
                          >
                            <Scale />
                            Ajustar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {stockQuery.isFetching && !stockQuery.isPending && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Actualizando…
            </p>
          )}
        </CardContent>
      </Card>

      <ProductionDialog
        open={productionOpen}
        onOpenChange={setProductionOpen}
        branchId={branchId}
      />

      <ProductStockAdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        entry={adjusting}
        branchId={branchId}
      />
    </div>
  );
}

function PageHeading({
  onLoadProduction,
}: {
  onLoadProduction: (() => void) | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Producción</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stock de platos elaborados, independiente de la materia prima.
        </p>
      </div>
      {onLoadProduction && (
        <Button
          size="lg"
          className="h-12 px-6 text-base"
          onClick={onLoadProduction}
        >
          <Factory className="!size-5" />
          Cargar producción
        </Button>
      )}
    </div>
  );
}
