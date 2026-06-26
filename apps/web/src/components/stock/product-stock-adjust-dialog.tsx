"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import {
  adjustProductStock,
  PRODUCT_ADJUST_TYPE_LABELS,
} from "@/lib/product-stock";
import type { ProductAdjustType, ProductStockEntry } from "@/lib/types";
import { cn, formatQuantity, parseDecimal } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";

const ADJUST_TYPES = Object.keys(
  PRODUCT_ADJUST_TYPE_LABELS,
) as ProductAdjustType[];

interface ProductStockAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: ProductStockEntry | null;
  branchId: string;
}

export function ProductStockAdjustDialog({
  open,
  onOpenChange,
  entry,
  branchId,
}: ProductStockAdjustDialogProps) {
  const queryClient = useQueryClient();

  const [type, setType] = useState<ProductAdjustType>("ADJUSTMENT");
  const [sign, setSign] = useState<1 | -1>(1);
  const [quantityInput, setQuantityInput] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setType("ADJUSTMENT");
      setSign(1);
      setQuantityInput("");
      setNotes("");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: adjustProductStock,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["product-stock"] });
      toast.success("Stock ajustado");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo ajustar el stock",
      );
    },
  });

  const quantity = parseDecimal(quantityInput);
  const canSubmit =
    entry !== null && quantity !== null && quantity > 0 && !mutation.isPending;

  const submit = () => {
    if (!canSubmit || !entry) return;
    mutation.mutate({
      branchId,
      productId: entry.productId,
      quantity: sign * (quantity as number),
      type,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogHeader>
        <DialogTitle>Ajustar stock de plato</DialogTitle>
        <DialogDescription>
          {entry ? (
            <>
              <span className="font-medium text-foreground">
                {entry.product.name}
              </span>{" "}
              — stock actual:{" "}
              <span className="tabular-nums">
                {formatQuantity(entry.quantity)}
              </span>
            </>
          ) : (
            "Elegí un producto para ajustar."
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ps-adjust-type">Tipo de ajuste</Label>
          <Select
            id="ps-adjust-type"
            value={type}
            onChange={(event) =>
              setType(event.target.value as ProductAdjustType)
            }
          >
            {ADJUST_TYPES.map((value) => (
              <option key={value} value={value}>
                {PRODUCT_ADJUST_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ps-adjust-quantity">Cantidad</Label>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border">
              <button
                type="button"
                onClick={() => setSign(1)}
                className={cn(
                  "flex h-12 w-12 items-center justify-center transition-colors cursor-pointer",
                  sign === 1
                    ? "bg-success/15 text-success"
                    : "text-muted-foreground hover:bg-accent",
                )}
                aria-pressed={sign === 1}
                title="Sumar stock"
              >
                <Plus className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => setSign(-1)}
                className={cn(
                  "flex h-12 w-12 items-center justify-center border-l transition-colors cursor-pointer",
                  sign === -1
                    ? "bg-destructive/15 text-destructive"
                    : "text-muted-foreground hover:bg-accent",
                )}
                aria-pressed={sign === -1}
                title="Descontar stock"
              >
                <Minus className="size-5" />
              </button>
            </div>
            <Input
              id="ps-adjust-quantity"
              inputMode="decimal"
              placeholder="0"
              value={quantityInput}
              onChange={(event) => setQuantityInput(event.target.value)}
              className="h-12 text-center text-lg font-medium tabular-nums"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {sign === 1 ? "Se sumará" : "Se descontará"} la cantidad ingresada
            al stock del plato.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ps-adjust-notes">Nota (opcional)</Label>
          <Textarea
            id="ps-adjust-notes"
            placeholder="Motivo del ajuste"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          Ajustar stock
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
