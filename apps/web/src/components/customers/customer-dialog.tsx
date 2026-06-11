"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { getErrorMessage } from "@/lib/api";
import {
  createCustomer,
  updateCustomer,
  type CustomerPayload,
} from "@/lib/customers";
import type { Customer } from "@/lib/types";
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

const customerSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(120, "Máximo 120 caracteres"),
  email: z
    .string()
    .refine(
      (value) => !value.trim() || z.string().email().safeParse(value).success,
      "Ingresá un email válido",
    ),
  phone: z.string().max(40, "Máximo 40 caracteres"),
  taxId: z.string().max(20, "Máximo 20 caracteres"),
  birthday: z.string(),
  address: z.string().max(200, "Máximo 200 caracteres"),
  notes: z.string().max(500, "Máximo 500 caracteres"),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

/** ISO (o fecha sola) → valor para <input type="date">. */
function birthdayToInput(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : "";
}

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cliente a editar; null para crear uno nuevo. */
  customer: Customer | null;
}

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
}: CustomerDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = customer !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      taxId: "",
      birthday: "",
      address: "",
      notes: "",
    },
  });

  // Re-sincroniza el formulario cada vez que se abre el dialog.
  useEffect(() => {
    if (open) {
      reset({
        name: customer?.name ?? "",
        email: customer?.email ?? "",
        phone: customer?.phone ?? "",
        taxId: customer?.taxId ?? "",
        birthday: birthdayToInput(customer?.birthday),
        address: customer?.address ?? "",
        notes: customer?.notes ?? "",
      });
    }
  }, [open, customer, reset]);

  const mutation = useMutation({
    mutationFn: (payload: CustomerPayload) =>
      isEditing ? updateCustomer(customer.id, payload) : createCustomer(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(isEditing ? "Cliente actualizado" : "Cliente creado");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo guardar el cliente"));
    },
  });

  const onSubmit = (values: CustomerFormValues) => {
    mutation.mutate({
      name: values.name.trim(),
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      taxId: values.taxId.trim() || null,
      birthday: values.birthday || null,
      address: values.address.trim() || null,
      notes: values.notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-xl">
      <DialogHeader>
        <DialogTitle>
          {isEditing ? "Editar cliente" : "Nuevo cliente"}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Modificá los datos del cliente y guardá los cambios."
            : "Completá los datos para agregar un cliente."}
        </DialogDescription>
      </DialogHeader>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="customer-name">Nombre</Label>
            <Input
              id="customer-name"
              placeholder="María González"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-phone">Teléfono</Label>
            <Input
              id="customer-phone"
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
            <Label htmlFor="customer-email">Email</Label>
            <Input
              id="customer-email"
              type="email"
              placeholder="maria@mail.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-taxid">CUIT / CUIL</Label>
            <Input
              id="customer-taxid"
              placeholder="27-12345678-9"
              {...register("taxId")}
            />
            {errors.taxId && (
              <p className="text-xs text-destructive">{errors.taxId.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="customer-birthday">Cumpleaños</Label>
            <Input
              id="customer-birthday"
              type="date"
              {...register("birthday")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-address">Dirección</Label>
            <Input
              id="customer-address"
              placeholder="Av. Siempreviva 742, CABA"
              {...register("address")}
            />
            {errors.address && (
              <p className="text-xs text-destructive">
                {errors.address.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="customer-notes">Notas</Label>
          <Textarea
            id="customer-notes"
            placeholder="Preferencias, alergias, mesa favorita…"
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
            {isEditing ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
