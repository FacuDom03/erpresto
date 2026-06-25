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
  createProduct,
  updateProduct,
  type ProductPayload,
} from "@/lib/products";
import type { Category, Product } from "@/lib/types";
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

const productSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(120, "Máximo 120 caracteres"),
  sku: z
    .string()
    .min(1, "El SKU es obligatorio")
    .max(60, "Máximo 60 caracteres"),
  price: z
    .string()
    .min(1, "El precio es obligatorio")
    .refine((value) => {
      const parsed = Number(value.replace(",", "."));
      return Number.isFinite(parsed) && parsed >= 0;
    }, "Ingresá un precio válido (por ej. 1500 o 1500,50)"),
  categoryId: z.string(),
  description: z.string().max(500, "Máximo 500 caracteres"),
  printStation: z.string().max(60, "Máximo 60 caracteres"),
  // Tri-estado como string: "" hereda de la categoría, "true"/"false" explícito.
  requiresPreparation: z.enum(["", "true", "false"]),
});

const STATION_SUGGESTIONS = ["Cocina", "Barra", "Parrilla", "Postres"];

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Producto a editar; null para crear uno nuevo. */
  product: Product | null;
  categories: Category[];
  categoriesError: boolean;
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  categories,
  categoriesError,
}: ProductDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = product !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      price: "",
      categoryId: "",
      description: "",
      printStation: "",
      requiresPreparation: "",
    },
  });

  // Re-sincroniza el formulario cada vez que se abre el dialog.
  useEffect(() => {
    if (open) {
      reset({
        name: product?.name ?? "",
        sku: product?.sku ?? "",
        price: product != null ? String(product.price) : "",
        categoryId: product?.categoryId ?? product?.category?.id ?? "",
        description: product?.description ?? "",
        printStation: product?.printStation ?? "",
        requiresPreparation:
          product?.requiresPreparation == null
            ? ""
            : product.requiresPreparation
              ? "true"
              : "false",
      });
    }
  }, [open, product, reset]);

  const mutation = useMutation({
    mutationFn: (payload: ProductPayload) =>
      isEditing ? updateProduct(product.id, payload) : createProduct(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        isEditing ? "Producto actualizado" : "Producto creado",
      );
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No se pudo guardar el producto",
      );
    },
  });

  const onSubmit = (values: ProductFormValues) => {
    mutation.mutate({
      name: values.name.trim(),
      sku: values.sku.trim(),
      price: Number(values.price.replace(",", ".")),
      categoryId: values.categoryId || null,
      description: values.description.trim() || null,
      printStation: values.printStation.trim() || null,
      requiresPreparation:
        values.requiresPreparation === ""
          ? undefined
          : values.requiresPreparation === "true",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>
          {isEditing ? "Editar producto" : "Nuevo producto"}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Modificá los datos del producto y guardá los cambios."
            : "Completá los datos para agregar un producto al catálogo."}
        </DialogDescription>
      </DialogHeader>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="product-name">Nombre</Label>
          <Input
            id="product-name"
            placeholder="Milanesa napolitana con papas"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="product-sku">SKU</Label>
            <Input
              id="product-sku"
              placeholder="MILA-NAPO-01"
              {...register("sku")}
            />
            {errors.sku && (
              <p className="text-xs text-destructive">{errors.sku.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-price">Precio (ARS)</Label>
            <Input
              id="product-price"
              inputMode="decimal"
              placeholder="12500"
              {...register("price")}
            />
            {errors.price && (
              <p className="text-xs text-destructive">{errors.price.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="product-category">Categoría</Label>
          <Select id="product-category" {...register("categoryId")}>
            <option value="">Sin categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          {categoriesError && (
            <p className="text-xs text-warning">
              No se pudieron cargar las categorías. Podés guardar sin categoría.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="product-station">Estación</Label>
            <Input
              id="product-station"
              list="product-station-suggestions"
              placeholder="Cocina, Barra, Parrilla…"
              {...register("printStation")}
            />
            <datalist id="product-station-suggestions">
              {STATION_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {errors.printStation && (
              <p className="text-xs text-destructive">
                {errors.printStation.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Si lo dejás vacío se hereda de la categoría.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-requires-prep">
              Requiere preparación
            </Label>
            <Select
              id="product-requires-prep"
              {...register("requiresPreparation")}
            >
              <option value="">Heredar de la categoría</option>
              <option value="true">Sí, pasa por la pantalla</option>
              <option value="false">No (entrega directa)</option>
            </Select>
            <p className="text-xs text-muted-foreground">
              Las bebidas embotelladas no requieren preparación.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="product-description">Descripción</Label>
          <Textarea
            id="product-description"
            placeholder="Descripción opcional para la carta y el POS"
            {...register("description")}
          />
          {errors.description && (
            <p className="text-xs text-destructive">
              {errors.description.message}
            </p>
          )}
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
            {isEditing ? "Guardar cambios" : "Crear producto"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
