"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, ServerOff } from "lucide-react";

import { getErrorMessage } from "@/lib/api";
import { getPurchaseOrder } from "@/lib/purchases";
import { PurchaseOrderForm } from "@/components/purchases/purchase-order-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditarOrdenCompraPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const orderQuery = useQuery({
    queryKey: ["purchase-orders", id],
    queryFn: () => getPurchaseOrder(id),
    enabled: Boolean(id),
  });
  const order = orderQuery.data ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/compras/${id}`)}
        >
          <ArrowLeft />
          Volver al detalle
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Editar orden de compra
          {order?.number != null ? ` #${order.number}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Solo se pueden editar órdenes en borrador. Los insumos reemplazan a
          los actuales.
        </p>
      </div>

      {orderQuery.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : orderQuery.isError || !order ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ServerOff className="size-6 text-destructive" />
            </div>
            <p className="font-medium">
              {getErrorMessage(
                orderQuery.error,
                "No se pudo cargar la orden de compra",
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void orderQuery.refetch()}
            >
              <RefreshCw />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : order.status !== "DRAFT" ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="font-medium">
              Esta orden ya no está en borrador y no se puede editar.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/compras/${id}`)}
            >
              Ver detalle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PurchaseOrderForm
          branchId={order.branchId ?? order.branch?.id ?? ""}
          order={order}
        />
      )}
    </div>
  );
}
