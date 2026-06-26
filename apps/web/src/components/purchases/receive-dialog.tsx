"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api";
import {
  receivePurchaseOrder,
  type ReceiveItemPayload,
} from "@/lib/purchases";
import { getWarehouses, UNIT_SHORT } from "@/lib/raw-materials";
import type { PurchaseOrder } from "@/lib/types";
import { formatQuantity, parseDecimal } from "@/lib/utils";
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

interface ReceiveLine {
  itemId: string;
  quantity: string;
  unitCost: string;
  lotCode: string;
  expiresAt: string;
}

interface ReceiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrder;
}

/** Valor de <input type="date"> → ISO al mediodía local. */
function dateInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/**
 * Recepción de mercadería (total o parcial): por cada línea pendiente permite
 * indicar cantidad recibida (default lo pendiente; 0 = no recibir), costo
 * unitario (default el de la OC), lote y vencimiento opcionales.
 */
export function ReceiveDialog({ open, onOpenChange, order }: ReceiveDialogProps) {
  const queryClient = useQueryClient();

  const pendingItems = order.items.filter(
    (item) => item.quantity - item.receivedQty > 0,
  );

  const [warehouseId, setWarehouseId] = useState("");
  const [lines, setLines] = useState<ReceiveLine[]>([]);

  const branchId = order.branchId ?? order.branch?.id ?? null;

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", branchId],
    queryFn: () => getWarehouses(branchId as string),
    enabled: open && branchId !== null,
    staleTime: 5 * 60_000,
  });
  const warehouses = warehousesQuery.data ?? [];

  // Reset al abrir: una línea por item pendiente con defaults de la OC.
  useEffect(() => {
    if (open) {
      setLines(
        pendingItems.map((item) => ({
          itemId: item.id,
          quantity: String(item.quantity - item.receivedQty),
          unitCost: String(item.unitCost),
          lotCode: "",
          expiresAt: "",
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.id]);

  useEffect(() => {
    if (!open || warehouses.length === 0) return;
    setWarehouseId((current) =>
      current && warehouses.some((w) => w.id === current)
        ? current
        : (warehouses.find((w) => w.isDefault) ?? warehouses[0]).id,
    );
  }, [open, warehouses]);

  const mutation = useMutation({
    mutationFn: (items: ReceiveItemPayload[]) =>
      receivePurchaseOrder(order.id, { warehouseId, items }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      toast.success("Mercadería recibida", {
        description:
          "Se sumó el stock en el depósito y se actualizaron el último costo y el costo promedio de los insumos.",
      });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo registrar la recepción"));
    },
  });

  const updateLine = (index: number, patch: Partial<ReceiveLine>) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  // Validación por línea: cantidad numérica entre 0 y lo pendiente.
  const lineProblems = lines.map((line, index) => {
    const item = pendingItems[index];
    if (!item) return null;
    const pending = item.quantity - item.receivedQty;
    const quantity = parseDecimal(line.quantity);
    if (quantity === null || quantity < 0) return "Cantidad inválida";
    if (quantity > pending)
      return `Máximo pendiente: ${formatQuantity(pending)}`;
    if (quantity > 0) {
      const cost = parseDecimal(line.unitCost);
      if (cost === null || cost < 0) return "Costo inválido";
    }
    return null;
  });

  const itemsToReceive = lines.filter(
    (line) => (parseDecimal(line.quantity) ?? 0) > 0,
  );
  const canSubmit =
    warehouseId !== "" &&
    itemsToReceive.length > 0 &&
    lineProblems.every((problem) => problem === null) &&
    !mutation.isPending;

  const submit = () => {
    if (!canSubmit) return;
    const payload: ReceiveItemPayload[] = itemsToReceive.map((line) => ({
      itemId: line.itemId,
      quantity: parseDecimal(line.quantity) as number,
      unitCost: parseDecimal(line.unitCost) ?? undefined,
      lotCode: line.lotCode.trim() || undefined,
      expiresAt: dateInputToIso(line.expiresAt),
    }));
    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>Recibir mercadería</DialogTitle>
        <DialogDescription>
          Orden #{order.number ?? "—"} · Dejá en 0 las líneas que no llegaron
          para registrar una recepción parcial. Al confirmar se suma el stock y
          se actualizan los costos de los insumos.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="receive-warehouse">Depósito de destino</Label>
          <Select
            id="receive-warehouse"
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

        <div className="space-y-3">
          {pendingItems.map((item, index) => {
            const line = lines[index];
            if (!line) return null;
            const pending = item.quantity - item.receivedQty;
            const unit = item.rawMaterial
              ? UNIT_SHORT[item.rawMaterial.unit]
              : "";
            return (
              <div key={item.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {item.rawMaterial?.name ?? "Insumo"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pendiente:{" "}
                    <span className="tabular-nums">
                      {formatQuantity(pending)} {unit}
                    </span>
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Cantidad a recibir
                    </Label>
                    <Input
                      inputMode="decimal"
                      className="tabular-nums"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(index, { quantity: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Costo unitario
                    </Label>
                    <Input
                      inputMode="decimal"
                      className="tabular-nums"
                      value={line.unitCost}
                      onChange={(event) =>
                        updateLine(index, { unitCost: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Lote (opcional)
                    </Label>
                    <Input
                      value={line.lotCode}
                      placeholder="L-0001"
                      onChange={(event) =>
                        updateLine(index, { lotCode: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Vencimiento (opcional)
                    </Label>
                    <Input
                      type="date"
                      value={line.expiresAt}
                      onChange={(event) =>
                        updateLine(index, { expiresAt: event.target.value })
                      }
                    />
                  </div>
                </div>
                {lineProblems[index] && (
                  <p className="text-xs text-destructive">
                    {lineProblems[index]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {itemsToReceive.length === 0 && (
          <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
            Ingresá al menos una cantidad mayor a 0 para registrar la recepción.
          </p>
        )}
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
          {mutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <PackageCheck />
          )}
          Confirmar recepción
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
