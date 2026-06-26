"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import {
  adjustRawMaterialStock,
  getWarehouses,
  RAW_ADJUST_TYPE_LABELS,
  UNIT_SHORT,
} from "@/lib/raw-materials";
import type { RawAdjustType, RawMaterial } from "@/lib/types";
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

const ADJUST_TYPES = Object.keys(RAW_ADJUST_TYPE_LABELS) as RawAdjustType[];

interface RawMaterialAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawMaterial: RawMaterial | null;
  /** Sucursal activa (sus depósitos). null si no hay sucursal elegida. */
  branchId: string | null;
}

export function RawMaterialAdjustDialog({
  open,
  onOpenChange,
  rawMaterial,
  branchId,
}: RawMaterialAdjustDialogProps) {
  const queryClient = useQueryClient();

  const [warehouseId, setWarehouseId] = useState("");
  const [type, setType] = useState<RawAdjustType>("ADJUSTMENT");
  const [sign, setSign] = useState<1 | -1>(1);
  const [quantityInput, setQuantityInput] = useState("");
  const [notes, setNotes] = useState("");

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", branchId],
    queryFn: () => getWarehouses(branchId as string),
    enabled: open && branchId !== null,
    staleTime: 5 * 60_000,
  });
  const warehouses = warehousesQuery.data ?? [];

  // Reset al abrir + preselección del depósito por defecto.
  useEffect(() => {
    if (open) {
      setType("ADJUSTMENT");
      setSign(1);
      setQuantityInput("");
      setNotes("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || warehouses.length === 0) return;
    setWarehouseId((current) =>
      current && warehouses.some((w) => w.id === current)
        ? current
        : (warehouses.find((w) => w.isDefault) ?? warehouses[0]).id,
    );
  }, [open, warehouses]);

  const mutation = useMutation({
    mutationFn: (payload: {
      warehouseId: string;
      quantity: number;
      type: RawAdjustType;
      notes?: string;
    }) => adjustRawMaterialStock((rawMaterial as RawMaterial).id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
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
    warehouseId !== "" && quantity !== null && quantity > 0 && !mutation.isPending;

  const submit = () => {
    if (!canSubmit || !rawMaterial) return;
    mutation.mutate({
      warehouseId,
      quantity: sign * (quantity as number),
      type,
      notes: notes.trim() || undefined,
    });
  };

  const unitShort = rawMaterial ? UNIT_SHORT[rawMaterial.unit] : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogHeader>
        <DialogTitle>Ajustar stock</DialogTitle>
        <DialogDescription>
          {rawMaterial ? (
            <>
              <span className="font-medium text-foreground">
                {rawMaterial.name}
              </span>{" "}
              — stock actual:{" "}
              <span className="tabular-nums">
                {formatQuantity(rawMaterial.totalStock)} {unitShort}
              </span>
            </>
          ) : (
            "Elegí un insumo para ajustar."
          )}
        </DialogDescription>
      </DialogHeader>

      {branchId === null ? (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          Elegí una sucursal desde el selector del header para ajustar stock en
          sus depósitos.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="adjust-warehouse">Depósito</Label>
            <Select
              id="adjust-warehouse"
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              disabled={warehousesQuery.isPending}
            >
              {warehousesQuery.isPending && <option value="">Cargando…</option>}
              {!warehousesQuery.isPending && warehouses.length === 0 && (
                <option value="">Sin depósitos en la sucursal</option>
              )}
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                  {warehouse.isDefault ? " (principal)" : ""}
                </option>
              ))}
            </Select>
            {warehousesQuery.isError && (
              <p className="text-xs text-destructive">
                No se pudieron cargar los depósitos.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-type">Tipo de ajuste</Label>
            <Select
              id="adjust-type"
              value={type}
              onChange={(event) => setType(event.target.value as RawAdjustType)}
            >
              {ADJUST_TYPES.map((value) => (
                <option key={value} value={value}>
                  {RAW_ADJUST_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-quantity">Cantidad</Label>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-md border">
                <button
                  type="button"
                  onClick={() => setSign(1)}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center transition-colors cursor-pointer",
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
                    "flex h-11 w-11 items-center justify-center border-l transition-colors cursor-pointer",
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
                id="adjust-quantity"
                inputMode="decimal"
                placeholder="0"
                value={quantityInput}
                onChange={(event) => setQuantityInput(event.target.value)}
                className="h-11 text-base tabular-nums"
              />
              {unitShort && (
                <span className="shrink-0 text-sm text-muted-foreground">
                  {unitShort}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {sign === 1 ? "Se sumará" : "Se descontará"} la cantidad ingresada
              en el depósito elegido.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-notes">Nota (opcional)</Label>
            <Textarea
              id="adjust-notes"
              placeholder="Motivo del ajuste"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
      )}

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button onClick={submit} disabled={!canSubmit || branchId === null}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          Ajustar stock
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
