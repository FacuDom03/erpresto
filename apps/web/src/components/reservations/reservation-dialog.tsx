"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Loader2, Minus, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { getErrorMessage } from "@/lib/api";
import { getCustomers } from "@/lib/customers";
import { createReservation, updateReservation } from "@/lib/reservations";
import { getAreas } from "@/lib/tables";
import type { Reservation } from "@/lib/types";
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

const reservationSchema = z.object({
  customerId: z.string(),
  name: z.string().min(1, "El nombre es obligatorio").max(120, "Máximo 120 caracteres"),
  phone: z.string().max(40, "Máximo 40 caracteres"),
  partySize: z.number().int().min(1, "Mínimo 1 persona").max(99),
  date: z.string().min(1, "Elegí la fecha"),
  time: z.string().min(1, "Elegí la hora"),
  tableId: z.string(),
  notes: z.string().max(500, "Máximo 500 caracteres"),
});

type ReservationFormValues = z.infer<typeof reservationSchema>;

const WALK_IN = "__walk_in__";

function isoToDateInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function isoToTimeInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

interface ReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  /** Reserva a editar; null para crear una nueva. */
  reservation: Reservation | null;
  /** Fecha por defecto (aaaa-mm-dd) al crear. */
  defaultDate?: string;
}

/**
 * Alta/edición de reservas: cliente existente (búsqueda server-side) u
 * opción "sin registrar", datos de contacto, personas, fecha/hora, mesa
 * opcional y notas.
 */
export function ReservationDialog({
  open,
  onOpenChange,
  branchId,
  reservation,
  defaultDate,
}: ReservationDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = reservation !== null;

  const [customerSearchInput, setCustomerSearchInput] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(
      () => setCustomerSearch(customerSearchInput.trim()),
      300,
    );
    return () => clearTimeout(timeout);
  }, [customerSearchInput]);

  const customersQuery = useQuery({
    queryKey: ["customers", { page: 1, limit: 20, search: customerSearch }],
    queryFn: () => getCustomers({ page: 1, limit: 20, search: customerSearch }),
    enabled: open,
    staleTime: 30_000,
  });

  const areasQuery = useQuery({
    queryKey: ["areas", branchId],
    queryFn: () => getAreas(branchId),
    enabled: open,
    staleTime: 60_000,
  });

  const customerOptions = useMemo(() => {
    const fetched = customersQuery.data?.data ?? [];
    const options = [
      {
        value: WALK_IN,
        label: "Sin registrar",
        description: "Solo nombre y teléfono",
      },
      ...fetched.map((customer) => ({
        value: customer.id,
        label: customer.name,
        description: customer.phone ?? undefined,
      })),
    ];
    // El cliente de la reserva editada puede no estar en la primera página.
    if (
      reservation?.customerId &&
      reservation.customer &&
      !fetched.some((c) => c.id === reservation.customerId)
    ) {
      options.splice(1, 0, {
        value: reservation.customerId,
        label: reservation.customer.name,
        description: undefined,
      });
    }
    return options;
  }, [customersQuery.data, reservation]);

  const tableOptions = useMemo(() => {
    const areas = areasQuery.data ?? [];
    const options = [{ value: "", label: "Sin mesa asignada" }];
    for (const area of areas) {
      for (const table of area.tables) {
        if (table.shape === "DECOR") continue;
        options.push({
          value: table.id,
          label: `${table.name} · ${area.name}`,
          description: `${table.capacity} personas`,
        } as { value: string; label: string });
      }
    }
    return options;
  }, [areasQuery.data]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      customerId: WALK_IN,
      name: "",
      phone: "",
      partySize: 2,
      date: defaultDate ?? "",
      time: "20:00",
      tableId: "",
      notes: "",
    },
  });

  // Re-sincroniza el formulario cada vez que se abre el dialog.
  useEffect(() => {
    if (open) {
      reset({
        customerId: reservation?.customerId ?? WALK_IN,
        name: reservation?.name ?? "",
        phone: reservation?.phone ?? "",
        partySize: reservation?.partySize ?? 2,
        date: reservation
          ? isoToDateInput(reservation.scheduledAt)
          : (defaultDate ?? isoToDateInput(new Date().toISOString())),
        time: reservation ? isoToTimeInput(reservation.scheduledAt) : "20:00",
        tableId: reservation?.tableId ?? "",
        notes: reservation?.notes ?? "",
      });
      setCustomerSearchInput("");
    }
  }, [open, reservation, defaultDate, reset]);

  const mutation = useMutation({
    mutationFn: (values: ReservationFormValues) => {
      const scheduledAt = new Date(
        `${values.date}T${values.time}`,
      ).toISOString();
      if (isEditing) {
        return updateReservation(reservation.id, {
          name: values.name.trim(),
          phone: values.phone.trim() || null,
          partySize: values.partySize,
          scheduledAt,
          tableId: values.tableId || null,
          customerId:
            values.customerId === WALK_IN ? null : values.customerId,
          notes: values.notes.trim() || null,
        });
      }
      return createReservation({
        branchId,
        name: values.name.trim(),
        phone: values.phone.trim() || undefined,
        partySize: values.partySize,
        scheduledAt,
        tableId: values.tableId || undefined,
        customerId:
          values.customerId === WALK_IN ? undefined : values.customerId,
        notes: values.notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["areas"] });
      toast.success(isEditing ? "Reserva actualizada" : "Reserva creada");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo guardar la reserva"));
    },
  });

  const tableId = watch("tableId");
  const date = watch("date");
  const time = watch("time");

  // Aviso: una mesa asignada con horario dentro de las próximas 2 h se bloquea.
  const withinTwoHours = (() => {
    if (!tableId || !date || !time) return false;
    const scheduled = new Date(`${date}T${time}`).getTime();
    if (Number.isNaN(scheduled)) return false;
    const now = Date.now();
    return scheduled >= now - 60_000 && scheduled - now <= 2 * 60 * 60_000;
  })();

  const onSelectCustomer = (value: string) => {
    setValue("customerId", value);
    if (value === WALK_IN) return;
    const customer = customersQuery.data?.data.find((c) => c.id === value);
    if (customer) {
      setValue("name", customer.name, { shouldValidate: true });
      if (customer.phone) setValue("phone", customer.phone);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-xl">
      <DialogHeader>
        <DialogTitle>{isEditing ? "Editar reserva" : "Nueva reserva"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Modificá los datos de la reserva y guardá los cambios."
            : "Completá los datos para agendar la reserva."}
        </DialogDescription>
      </DialogHeader>

      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <div className="space-y-1.5">
          <Label>Cliente</Label>
          <Controller
            control={control}
            name="customerId"
            render={({ field }) => (
              <Combobox
                options={customerOptions}
                value={field.value}
                onChange={onSelectCustomer}
                onSearchChange={setCustomerSearchInput}
                placeholder="Sin registrar"
                searchPlaceholder="Buscar cliente…"
                emptyText="Sin clientes para esa búsqueda"
                loading={customersQuery.isPending}
              />
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="res-name">Nombre</Label>
            <Input
              id="res-name"
              placeholder="María González"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-phone">Teléfono</Label>
            <Input
              id="res-phone"
              placeholder="11 5555-5555"
              {...register("phone")}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Personas</Label>
            <Controller
              control={control}
              name="partySize"
              render={({ field }) => (
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => field.onChange(Math.max(1, field.value - 1))}
                    aria-label="Una persona menos"
                  >
                    <Minus />
                  </Button>
                  <span className="w-10 text-center text-sm font-medium tabular-nums">
                    {field.value}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => field.onChange(Math.min(99, field.value + 1))}
                    aria-label="Una persona más"
                  >
                    <Plus />
                  </Button>
                </div>
              )}
            />
            {errors.partySize && (
              <p className="text-xs text-destructive">
                {errors.partySize.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-date">Fecha</Label>
            <Input id="res-date" type="date" {...register("date")} />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-time">Hora</Label>
            <Input id="res-time" type="time" {...register("time")} />
            {errors.time && (
              <p className="text-xs text-destructive">{errors.time.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Mesa (opcional)</Label>
          <Controller
            control={control}
            name="tableId"
            render={({ field }) => (
              <Combobox
                options={tableOptions}
                value={field.value}
                onChange={field.onChange}
                placeholder="Sin mesa asignada"
                searchPlaceholder="Buscar mesa…"
                emptyText="Sin mesas en la sucursal"
                loading={areasQuery.isPending}
              />
            )}
          />
          {withinTwoHours && (
            <p className="flex items-start gap-1.5 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              La reserva es dentro de las próximas 2 horas: al guardarla, la
              mesa elegida se bloquea como Reservada hasta que llegue el
              cliente.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="res-notes">Notas</Label>
          <Textarea
            id="res-notes"
            placeholder="Cumpleaños, silla alta, ubicación preferida…"
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
            {isEditing ? "Guardar cambios" : "Crear reserva"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
