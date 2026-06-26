"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ApiError } from "@/lib/api";
import {
  createRawMaterial,
  UNIT_LABELS,
  updateRawMaterial,
  type RawMaterialPayload,
} from "@/lib/raw-materials";
import type { MeasureUnit, RawMaterial } from "@/lib/types";
import { parseDecimal } from "@/lib/utils";
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

const MEASURE_UNITS = Object.keys(UNIT_LABELS) as MeasureUnit[];

const optionalDecimal = (message: string) =>
  z
    .string()
    .refine((value) => {
      if (!value.trim()) return true;
      const parsed = parseDecimal(value);
      return parsed !== null && parsed >= 0;
    }, message);

const rawMaterialSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(160, "Máximo 160 caracteres"),
  sku: z.string().max(64, "Máximo 64 caracteres"),
  unit: z.enum(MEASURE_UNITS as [MeasureUnit, ...MeasureUnit[]]),
  category: z.string().max(80, "Máximo 80 caracteres"),
  minStock: optionalDecimal("Ingresá un stock mínimo válido (por ej. 2,5)"),
  avgCost: optionalDecimal("Ingresá un costo válido (por ej. 7500)"),
});

type RawMaterialFormValues = z.infer<typeof rawMaterialSchema>;

interface RawMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Insumo a editar; null para crear uno nuevo. */
  rawMaterial: RawMaterial | null;
}

export function RawMaterialDialog({
  open,
  onOpenChange,
  rawMaterial,
}: RawMaterialDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = rawMaterial !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RawMaterialFormValues>({
    resolver: zodResolver(rawMaterialSchema),
    defaultValues: {
      name: "",
      sku: "",
      unit: "UNIT",
      category: "",
      minStock: "",
      avgCost: "",
    },
  });

  // Re-sincroniza el formulario cada vez que se abre el dialog.
  useEffect(() => {
    if (open) {
      reset({
        name: rawMaterial?.name ?? "",
        sku: rawMaterial?.sku ?? "",
        unit: rawMaterial?.unit ?? "UNIT",
        category: rawMaterial?.category ?? "",
        minStock:
          rawMaterial?.minStock != null ? String(rawMaterial.minStock) : "",
        avgCost: rawMaterial?.avgCost ? String(rawMaterial.avgCost) : "",
      });
    }
  }, [open, rawMaterial, reset]);

  const mutation = useMutation({
    mutationFn: (payload: RawMaterialPayload) =>
      isEditing
        ? updateRawMaterial(rawMaterial.id, payload)
        : createRawMaterial(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      toast.success(isEditing ? "Insumo actualizado" : "Insumo creado");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo guardar el insumo",
      );
    },
  });

  const onSubmit = (values: RawMaterialFormValues) => {
    mutation.mutate({
      name: values.name.trim(),
      sku: values.sku.trim() || null,
      unit: values.unit,
      category: values.category.trim() || null,
      minStock: parseDecimal(values.minStock),
      avgCost: parseDecimal(values.avgCost),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Editar insumo" : "Nuevo insumo"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Modificá los datos del insumo y guardá los cambios."
            : "Completá los datos para agregar un insumo al inventario."}
        </DialogDescription>
      </DialogHeader>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="rm-name">Nombre</Label>
          <Input id="rm-name" placeholder="Harina 0000" {...register("name")} />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rm-sku">SKU (opcional)</Label>
            <Input id="rm-sku" placeholder="MP-HARINA" {...register("sku")} />
            {errors.sku && (
              <p className="text-xs text-destructive">{errors.sku.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rm-unit">Unidad de medida</Label>
            <Select id="rm-unit" {...register("unit")}>
              {MEASURE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {UNIT_LABELS[unit]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rm-category">Categoría (opcional)</Label>
          <Input
            id="rm-category"
            placeholder="almacén, pescados, verduras…"
            {...register("category")}
          />
          {errors.category && (
            <p className="text-xs text-destructive">{errors.category.message}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rm-min-stock">Stock mínimo (opcional)</Label>
            <Input
              id="rm-min-stock"
              inputMode="decimal"
              placeholder="2"
              {...register("minStock")}
            />
            {errors.minStock && (
              <p className="text-xs text-destructive">
                {errors.minStock.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rm-avg-cost">Costo (ARS, opcional)</Label>
            <Input
              id="rm-avg-cost"
              inputMode="decimal"
              placeholder="7500"
              {...register("avgCost")}
            />
            {errors.avgCost && (
              <p className="text-xs text-destructive">{errors.avgCost.message}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            {isEditing ? "Guardar cambios" : "Crear insumo"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
