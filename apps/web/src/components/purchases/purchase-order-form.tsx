"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { getErrorMessage } from "@/lib/api";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrderItemPayload,
} from "@/lib/purchases";
import { getAllRawMaterials, UNIT_SHORT } from "@/lib/raw-materials";
import { getSuppliers } from "@/lib/suppliers";
import type { PurchaseOrder, RawMaterial } from "@/lib/types";
import { formatARS, parseDecimal } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const itemSchema = z.object({
  rawMaterialId: z.string().min(1, "Elegí un insumo"),
  quantity: z.string().refine((value) => {
    const parsed = parseDecimal(value);
    return parsed !== null && parsed > 0;
  }, "Cantidad inválida"),
  unitCost: z.string().refine((value) => {
    const parsed = parseDecimal(value);
    return parsed !== null && parsed >= 0;
  }, "Costo inválido"),
});

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Elegí un proveedor"),
  expectedAt: z.string(),
  notes: z.string().max(500, "Máximo 500 caracteres"),
  items: z.array(itemSchema).min(1, "Agregá al menos un insumo"),
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

const EMPTY_ITEM = { rawMaterialId: "", quantity: "", unitCost: "" };

/** ISO → valor para <input type="date"> en hora local. */
function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Valor de <input type="date"> → ISO al mediodía local (evita corrimientos). */
function dateInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

interface PurchaseOrderFormProps {
  /** Sucursal activa (requerida para crear). */
  branchId: string;
  /** Orden a editar (solo borrador); null para crear una nueva. */
  order?: PurchaseOrder | null;
}

/**
 * Formulario de orden de compra (alta y edición de borradores): proveedor,
 * fecha esperada, notas e items dinámicos con subtotales y total en vivo.
 */
export function PurchaseOrderForm({ branchId, order }: PurchaseOrderFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = order != null;

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", { page: 1, limit: 500, search: "" }],
    queryFn: () => getSuppliers({ page: 1, limit: 500 }),
    staleTime: 60_000,
  });
  const rawMaterialsQuery = useQuery({
    queryKey: ["raw-materials", "all"],
    queryFn: getAllRawMaterials,
    staleTime: 60_000,
  });

  const rawMaterials = useMemo(
    () => rawMaterialsQuery.data ?? [],
    [rawMaterialsQuery.data],
  );
  const rawMaterialById = useMemo(() => {
    const map = new Map<string, RawMaterial>();
    for (const material of rawMaterials) map.set(material.id, material);
    return map;
  }, [rawMaterials]);

  const supplierOptions = useMemo(
    () =>
      (suppliersQuery.data?.data ?? [])
        .filter((s) => s.active)
        .map((s) => ({ value: s.id, label: s.name })),
    [suppliersQuery.data],
  );

  const rawMaterialOptions = useMemo(
    () =>
      rawMaterials.map((material) => ({
        value: material.id,
        label: material.name,
        description: `Último costo: ${formatARS(material.lastCost)} por ${UNIT_SHORT[material.unit]}`,
      })),
    [rawMaterials],
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplierId: order?.supplierId ?? order?.supplier?.id ?? "",
      expectedAt: isoToDateInput(order?.expectedAt),
      notes: order?.notes ?? "",
      items: order?.items.length
        ? order.items.map((item) => ({
            rawMaterialId: item.rawMaterialId,
            quantity: String(item.quantity),
            unitCost: String(item.unitCost),
          }))
        : [{ ...EMPTY_ITEM }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");

  const lineSubtotal = (index: number): number => {
    const item = watchedItems[index];
    if (!item) return 0;
    const quantity = parseDecimal(item.quantity) ?? 0;
    const unitCost = parseDecimal(item.unitCost) ?? 0;
    return quantity > 0 && unitCost >= 0 ? quantity * unitCost : 0;
  };

  const total = watchedItems.reduce((sum, _item, i) => sum + lineSubtotal(i), 0);

  const mutation = useMutation({
    mutationFn: (values: PurchaseOrderFormValues) => {
      const items: PurchaseOrderItemPayload[] = values.items.map((item) => ({
        rawMaterialId: item.rawMaterialId,
        quantity: parseDecimal(item.quantity) ?? 0,
        unitCost: parseDecimal(item.unitCost) ?? 0,
      }));
      if (isEditing) {
        return updatePurchaseOrder(order.id, {
          supplierId: values.supplierId,
          expectedAt: dateInputToIso(values.expectedAt) ?? null,
          notes: values.notes.trim() || null,
          items,
        });
      }
      return createPurchaseOrder({
        branchId,
        supplierId: values.supplierId,
        expectedAt: dateInputToIso(values.expectedAt),
        notes: values.notes.trim() || undefined,
        items,
      });
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success(
        isEditing
          ? "Orden de compra actualizada"
          : "Orden de compra creada en borrador",
      );
      router.push(`/compras/${saved.id}`);
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo guardar la orden de compra"));
    },
  });

  const onSelectRawMaterial = (index: number, rawMaterialId: string) => {
    setValue(`items.${index}.rawMaterialId`, rawMaterialId, {
      shouldValidate: true,
    });
    // Sugerimos el último costo de compra si el campo está vacío.
    const material = rawMaterialById.get(rawMaterialId);
    const currentCost = getValues(`items.${index}.unitCost`);
    if (material && material.lastCost > 0 && !currentCost.trim()) {
      setValue(`items.${index}.unitCost`, String(material.lastCost), {
        shouldValidate: true,
      });
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <Card>
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Controller
                control={control}
                name="supplierId"
                render={({ field }) => (
                  <Combobox
                    options={supplierOptions}
                    value={field.value || null}
                    onChange={field.onChange}
                    placeholder="Elegí un proveedor…"
                    searchPlaceholder="Buscar proveedor…"
                    emptyText="Sin proveedores"
                    loading={suppliersQuery.isPending}
                  />
                )}
              />
              {errors.supplierId && (
                <p className="text-xs text-destructive">
                  {errors.supplierId.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="po-expected">Fecha esperada</Label>
              <Input id="po-expected" type="date" {...register("expectedAt")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="po-notes">Notas</Label>
            <Textarea
              id="po-notes"
              placeholder="Condiciones, horario de entrega…"
              {...register("notes")}
            />
            {errors.notes && (
              <p className="text-xs text-destructive">{errors.notes.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4 md:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Insumos</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ ...EMPTY_ITEM })}
            >
              <Plus />
              Agregar insumo
            </Button>
          </div>

          {errors.items?.message && (
            <p className="text-xs text-destructive">{errors.items.message}</p>
          )}

          <div className="space-y-3">
            {fields.map((field, index) => {
              const itemErrors = errors.items?.[index];
              const material = rawMaterialById.get(
                watchedItems[index]?.rawMaterialId ?? "",
              );
              return (
                <div
                  key={field.id}
                  className="grid items-start gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_8rem_9rem_8rem_auto]"
                >
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Insumo
                    </Label>
                    <Controller
                      control={control}
                      name={`items.${index}.rawMaterialId`}
                      render={({ field: rmField }) => (
                        <Combobox
                          options={rawMaterialOptions}
                          value={rmField.value || null}
                          onChange={(value) =>
                            onSelectRawMaterial(index, value)
                          }
                          placeholder="Elegí un insumo…"
                          searchPlaceholder="Buscar insumo…"
                          emptyText="Sin insumos"
                          loading={rawMaterialsQuery.isPending}
                        />
                      )}
                    />
                    {itemErrors?.rawMaterialId && (
                      <p className="text-xs text-destructive">
                        {itemErrors.rawMaterialId.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Cantidad{material ? ` (${UNIT_SHORT[material.unit]})` : ""}
                    </Label>
                    <Input
                      inputMode="decimal"
                      placeholder="0"
                      className="tabular-nums"
                      {...register(`items.${index}.quantity`)}
                    />
                    {itemErrors?.quantity && (
                      <p className="text-xs text-destructive">
                        {itemErrors.quantity.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Costo unitario
                    </Label>
                    <Input
                      inputMode="decimal"
                      placeholder="0,00"
                      className="tabular-nums"
                      {...register(`items.${index}.unitCost`)}
                    />
                    {itemErrors?.unitCost && (
                      <p className="text-xs text-destructive">
                        {itemErrors.unitCost.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Subtotal
                    </Label>
                    <p className="flex h-9 items-center text-sm font-medium tabular-nums">
                      {formatARS(lineSubtotal(index))}
                    </p>
                  </div>

                  <div className="flex h-full items-start pt-5 md:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      title="Quitar insumo"
                    >
                      <Trash2 />
                      <span className="sr-only">Quitar insumo</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 border-t pt-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-xl font-semibold tabular-nums">
              {formatARS(total)}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          {isEditing ? "Guardar cambios" : "Crear orden (borrador)"}
        </Button>
      </div>
    </form>
  );
}
