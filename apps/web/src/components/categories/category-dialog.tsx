"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ApiError } from "@/lib/api";
import {
  createCategory,
  updateCategory,
  type CategoryPayload,
} from "@/lib/categories";
import { STATIONS_QUERY_KEY, getStations } from "@/lib/stations";
import type { Category } from "@/lib/types";
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

const DEFAULT_COLOR = "#f97316";

const categorySchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(80, "Máximo 80 caracteres"),
  color: z.string(),
  sortOrder: z.string().refine((value) => {
    if (!value.trim()) return true;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0;
  }, "Ingresá un orden válido (entero ≥ 0)"),
  defaultStation: z.string().max(60, "Máximo 60 caracteres"),
  defaultRequiresPreparation: z.enum(["true", "false"]),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Categoría a editar; null para crear una nueva. */
  category: Category | null;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
}: CategoryDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = category !== null;

  const stationsQuery = useQuery({
    queryKey: STATIONS_QUERY_KEY,
    queryFn: getStations,
  });

  // Si la categoría ya tiene una estación fuera del catálogo, la conservamos.
  const stationOptions = useMemo(() => {
    const list = [...(stationsQuery.data ?? [])];
    const current = category?.defaultStation;
    if (
      current &&
      !list.some((s) => s.toLowerCase() === current.toLowerCase())
    ) {
      list.push(current);
    }
    return list;
  }, [stationsQuery.data, category?.defaultStation]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      color: DEFAULT_COLOR,
      sortOrder: "",
      defaultStation: "",
      defaultRequiresPreparation: "true",
    },
  });

  // Re-sincroniza el formulario cada vez que se abre el dialog.
  useEffect(() => {
    if (open) {
      reset({
        name: category?.name ?? "",
        color: category?.color ?? DEFAULT_COLOR,
        sortOrder:
          category?.sortOrder != null ? String(category.sortOrder) : "",
        defaultStation: category?.defaultStation ?? "",
        defaultRequiresPreparation:
          category?.defaultRequiresPreparation === false ? "false" : "true",
      });
    }
  }, [open, category, reset]);

  const mutation = useMutation({
    mutationFn: (payload: CategoryPayload) =>
      isEditing ? updateCategory(category.id, payload) : createCategory(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(isEditing ? "Categoría actualizada" : "Categoría creada");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No se pudo guardar la categoría",
      );
    },
  });

  const onSubmit = (values: CategoryFormValues) => {
    mutation.mutate({
      name: values.name.trim(),
      color: values.color,
      sortOrder: values.sortOrder.trim() ? Number(values.sortOrder) : 0,
      defaultStation: values.defaultStation.trim() || null,
      defaultRequiresPreparation: values.defaultRequiresPreparation === "true",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogHeader>
        <DialogTitle>
          {isEditing ? "Editar categoría" : "Nueva categoría"}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Modificá los datos de la categoría y guardá los cambios."
            : "Completá los datos para crear una categoría del catálogo."}
        </DialogDescription>
      </DialogHeader>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="category-name">Nombre</Label>
          <Input
            id="category-name"
            placeholder="Platos principales"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="category-color">Color</Label>
            <input
              id="category-color"
              type="color"
              className="h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-1 py-1 shadow-sm"
              {...register("color")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category-sort">Orden</Label>
            <Input
              id="category-sort"
              inputMode="numeric"
              placeholder="0"
              {...register("sortOrder")}
            />
            {errors.sortOrder && (
              <p className="text-xs text-destructive">
                {errors.sortOrder.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="category-station">Estación por defecto</Label>
            <Select id="category-station" {...register("defaultStation")}>
              <option value="">Sin definir</option>
              {stationOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            {errors.defaultStation && (
              <p className="text-xs text-destructive">
                {errors.defaultStation.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category-requires-prep">
              Requiere preparación
            </Label>
            <Select
              id="category-requires-prep"
              {...register("defaultRequiresPreparation")}
            >
              <option value="true">Sí, pasa por la pantalla</option>
              <option value="false">No (entrega directa)</option>
            </Select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Los productos heredan estos valores cuando no definen una estación o
          el modo de preparación propio.
        </p>

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
            {isEditing ? "Guardar cambios" : "Crear categoría"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
