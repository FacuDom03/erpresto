"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ApiError } from "@/lib/api";
import {
  createSupplier,
  updateSupplier,
  type SupplierPayload,
} from "@/lib/suppliers";
import type { Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";

const supplierSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(160, "Máximo 160 caracteres"),
  cuit: z.string().max(20, "Máximo 20 caracteres"),
  contactName: z.string().max(120, "Máximo 120 caracteres"),
  phone: z.string().max(40, "Máximo 40 caracteres"),
  email: z
    .string()
    .refine(
      (value) => !value.trim() || z.string().email().safeParse(value).success,
      "Ingresá un email válido",
    ),
  address: z.string().max(200, "Máximo 200 caracteres"),
  deliveryDays: z.string().refine((value) => {
    if (!value.trim()) return true;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0;
  }, "Ingresá una cantidad de días válida"),
  rating: z.number().min(0).max(5),
  notes: z.string().max(500, "Máximo 500 caracteres"),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Proveedor a editar; null para crear uno nuevo. */
  supplier: Supplier | null;
}

export function SupplierDialog({
  open,
  onOpenChange,
  supplier,
}: SupplierDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = supplier !== null;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      cuit: "",
      contactName: "",
      phone: "",
      email: "",
      address: "",
      deliveryDays: "",
      rating: 0,
      notes: "",
    },
  });

  // Re-sincroniza el formulario cada vez que se abre el dialog.
  useEffect(() => {
    if (open) {
      reset({
        name: supplier?.name ?? "",
        cuit: supplier?.cuit ?? "",
        contactName: supplier?.contactName ?? "",
        phone: supplier?.phone ?? "",
        email: supplier?.email ?? "",
        address: supplier?.address ?? "",
        deliveryDays:
          supplier?.deliveryDays != null ? String(supplier.deliveryDays) : "",
        rating: supplier?.rating ?? 0,
        notes: supplier?.notes ?? "",
      });
    }
  }, [open, supplier, reset]);

  const mutation = useMutation({
    mutationFn: (payload: SupplierPayload) =>
      isEditing ? updateSupplier(supplier.id, payload) : createSupplier(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(isEditing ? "Proveedor actualizado" : "Proveedor creado");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No se pudo guardar el proveedor",
      );
    },
  });

  const onSubmit = (values: SupplierFormValues) => {
    mutation.mutate({
      name: values.name.trim(),
      cuit: values.cuit.trim() || null,
      contactName: values.contactName.trim() || null,
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      address: values.address.trim() || null,
      deliveryDays: values.deliveryDays.trim()
        ? Number(values.deliveryDays)
        : null,
      rating: values.rating > 0 ? values.rating : null,
      notes: values.notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-xl">
      <DialogHeader>
        <DialogTitle>
          {isEditing ? "Editar proveedor" : "Nuevo proveedor"}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Modificá los datos del proveedor y guardá los cambios."
            : "Completá los datos para agregar un proveedor."}
        </DialogDescription>
      </DialogHeader>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="supplier-name">Nombre</Label>
            <Input
              id="supplier-name"
              placeholder="Distribuidora Sur SRL"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supplier-cuit">CUIT</Label>
            <Input
              id="supplier-cuit"
              placeholder="30-12345678-9"
              {...register("cuit")}
            />
            {errors.cuit && (
              <p className="text-xs text-destructive">{errors.cuit.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="supplier-contact">Contacto</Label>
            <Input
              id="supplier-contact"
              placeholder="Juan Pérez"
              {...register("contactName")}
            />
            {errors.contactName && (
              <p className="text-xs text-destructive">
                {errors.contactName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supplier-phone">Teléfono</Label>
            <Input
              id="supplier-phone"
              placeholder="11 5555-5555"
              {...register("phone")}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="supplier-email">Email</Label>
            <Input
              id="supplier-email"
              type="email"
              placeholder="ventas@proveedor.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supplier-delivery">Entrega (días)</Label>
            <Input
              id="supplier-delivery"
              inputMode="numeric"
              placeholder="2"
              {...register("deliveryDays")}
            />
            {errors.deliveryDays && (
              <p className="text-xs text-destructive">
                {errors.deliveryDays.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="supplier-address">Dirección</Label>
          <Input
            id="supplier-address"
            placeholder="Av. Siempreviva 742, CABA"
            {...register("address")}
          />
          {errors.address && (
            <p className="text-xs text-destructive">{errors.address.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Calificación</Label>
          <Controller
            control={control}
            name="rating"
            render={({ field }) => (
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() =>
                      field.onChange(field.value === star ? 0 : star)
                    }
                    className="rounded-sm p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                    aria-label={`${star} ${star === 1 ? "estrella" : "estrellas"}`}
                  >
                    <Star
                      className={cn(
                        "size-6",
                        star <= field.value
                          ? "fill-warning text-warning"
                          : "text-muted-foreground/40",
                      )}
                    />
                  </button>
                ))}
                {field.value > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    {field.value} / 5
                  </span>
                )}
              </div>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="supplier-notes">Notas</Label>
          <Textarea
            id="supplier-notes"
            placeholder="Condiciones de pago, horarios de entrega…"
            {...register("notes")}
          />
          {errors.notes && (
            <p className="text-xs text-destructive">{errors.notes.message}</p>
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
            {isEditing ? "Guardar cambios" : "Crear proveedor"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
