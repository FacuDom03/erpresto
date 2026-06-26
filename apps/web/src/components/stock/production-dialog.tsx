"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { createProduction } from "@/lib/product-stock";
import { getProducts } from "@/lib/products";
import { cn, parseDecimal } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProductionRow {
  /** Key estable para React (las filas se agregan/quitan). */
  key: number;
  productId: string | null;
  quantityInput: string;
}

let nextRowKey = 1;

function emptyRow(): ProductionRow {
  return { key: nextRowKey++, productId: null, quantityInput: "" };
}

/**
 * Combobox de producto con búsqueda server-side (GET /products?search=).
 * Cada fila maneja su propio término de búsqueda con debounce.
 */
function ProductCombobox({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (productId: string) => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const productsQuery = useQuery({
    queryKey: ["products-search", search],
    queryFn: () => getProducts({ page: 1, limit: 20, search }),
    staleTime: 60_000,
  });

  const options = useMemo(
    () =>
      (productsQuery.data?.data ?? []).map((product) => ({
        value: product.id,
        label: product.name,
        description: product.sku,
      })),
    [productsQuery.data],
  );

  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      onSearchChange={setSearchInput}
      loading={productsQuery.isPending}
      placeholder="Elegir producto…"
      searchPlaceholder="Buscar producto…"
      emptyText="No hay productos para esa búsqueda"
    />
  );
}

interface ProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}

export function ProductionDialog({
  open,
  onOpenChange,
  branchId,
}: ProductionDialogProps) {
  const queryClient = useQueryClient();

  const [rows, setRows] = useState<ProductionRow[]>([emptyRow()]);
  const [consumeRawMaterials, setConsumeRawMaterials] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setRows([emptyRow()]);
      setConsumeRawMaterials(false);
      setNotes("");
    }
  }, [open]);

  const updateRow = (key: number, patch: Partial<ProductionRow>) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const stepQuantity = (key: number, delta: number) => {
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const parsed = parseDecimal(row.quantityInput) ?? 0;
        const next = Math.max(0, parsed + delta);
        return { ...row, quantityInput: next > 0 ? String(next) : "" };
      }),
    );
  };

  const removeRow = (key: number) => {
    setRows((current) =>
      current.length > 1 ? current.filter((row) => row.key !== key) : current,
    );
  };

  const mutation = useMutation({
    mutationFn: createProduction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["product-stock"] });
      if (consumeRawMaterials) {
        void queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      }
      toast.success("Producción cargada");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar la producción",
      );
    },
  });

  const validItems = rows
    .map((row) => ({
      productId: row.productId,
      quantity: parseDecimal(row.quantityInput),
    }))
    .filter(
      (item): item is { productId: string; quantity: number } =>
        item.productId !== null && item.quantity !== null && item.quantity > 0,
    );

  // Evita duplicados: si un producto se repite, se suman las cantidades.
  const items = useMemo(() => {
    const byProduct = new Map<string, number>();
    for (const item of validItems) {
      byProduct.set(
        item.productId,
        (byProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }
    return [...byProduct.entries()].map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
  }, [validItems]);

  const canSubmit = items.length > 0 && !mutation.isPending;

  const submit = () => {
    if (!canSubmit) return;
    mutation.mutate({
      branchId,
      consumeRawMaterials,
      notes: notes.trim() || undefined,
      items,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Cargar producción</DialogTitle>
        <DialogDescription>
          Sumá los platos que salieron de cocina. Cada fila es un producto con
          su cantidad producida.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex flex-wrap items-center gap-2 rounded-lg border p-2 sm:flex-nowrap"
          >
            <div className="min-w-0 flex-1 basis-full sm:basis-auto">
              <ProductCombobox
                value={row.productId}
                onChange={(productId) => updateRow(row.key, { productId })}
              />
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={() => stepQuantity(row.key, -1)}
                aria-label="Restar 1"
              >
                <Minus className="size-5" />
              </Button>
              <Input
                inputMode="decimal"
                placeholder="0"
                value={row.quantityInput}
                onChange={(event) =>
                  updateRow(row.key, { quantityInput: event.target.value })
                }
                className="h-12 w-24 text-center text-lg font-medium tabular-nums"
                aria-label="Cantidad producida"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={() => stepQuantity(row.key, 1)}
                aria-label="Sumar 1"
              >
                <Plus className="size-5" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeRow(row.key)}
              disabled={rows.length <= 1}
              aria-label="Quitar fila"
            >
              <Trash2 className="size-5" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          className="h-11 w-full border-dashed"
          onClick={() => setRows((current) => [...current, emptyRow()])}
        >
          <Plus />
          Agregar producto
        </Button>

        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
            consumeRawMaterials && "border-primary/50 bg-primary/5",
          )}
        >
          <input
            type="checkbox"
            checked={consumeRawMaterials}
            onChange={(event) => setConsumeRawMaterials(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium">
              Descontar materia prima según receta
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Solo descuenta insumos de los productos que tengan receta activa;
              el resto simplemente suma stock.
            </span>
          </span>
        </label>

        <div className="space-y-1.5">
          <Label htmlFor="production-notes">Nota (opcional)</Label>
          <Textarea
            id="production-notes"
            placeholder="Producción de la mañana"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          size="lg"
          onClick={() => onOpenChange(false)}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button size="lg" onClick={submit} disabled={!canSubmit}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          Cargar producción
          {items.length > 0 &&
            ` (${items.length} ${items.length === 1 ? "producto" : "productos"})`}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
