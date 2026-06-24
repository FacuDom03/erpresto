"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  ChefHat,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ServerOff,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ApiError, getErrorMessage } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import { useRealtime } from "@/lib/realtime";
import {
  addOrderItems,
  addOrderPayment,
  cancelOrder,
  closeOrder,
  deleteOrderItem,
  deleteOrderPayment,
  getOrder,
  ITEM_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  sendOrderToKitchen,
  updateOrder,
  updateOrderItem,
  upsertOrderDelivery,
} from "@/lib/orders";
import { createInvoiceFromOrder } from "@/lib/invoices";
import { MpPayment } from "@/components/pos/mp-payment";
import { getCategories, getProducts } from "@/lib/products";
import { getAreas } from "@/lib/tables";
import type { OrderItem, PaymentMethod } from "@/lib/types";
import { cn, formatARS } from "@/lib/utils";
import type { BadgeProps } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "CARD_DEBIT",
  "CARD_CREDIT",
  "QR",
  "MERCADOPAGO",
  "TRANSFER",
];

const ITEM_STATUS_VARIANT: Record<OrderItem["status"], BadgeProps["variant"]> =
  {
    PENDING: "secondary",
    SENT: "warning",
    PREPARING: "warning",
    READY: "success",
    DELIVERED: "success",
    CANCELLED: "destructive",
  };

export default function PosOrderPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { branchId } = useBranch();
  useRealtime(branchId);

  // ---------------------------------------------------------------------
  // Datos
  // ---------------------------------------------------------------------

  const orderQuery = useQuery({
    queryKey: ["orders", "detail", orderId],
    queryFn: () => getOrder(orderId),
    refetchInterval: 15_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    staleTime: 5 * 60_000,
  });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const productsQuery = useQuery({
    queryKey: ["products", "pos", { search, categoryId }],
    queryFn: () =>
      getProducts({
        page: 1,
        limit: 200,
        search: search || undefined,
        categoryId: categoryId || undefined,
      }),
  });

  const order = orderQuery.data ?? null;
  const isOpen = order?.status === "OPEN";

  // Descuento / propina editables (commit al salir del input)
  const [discountInput, setDiscountInput] = useState("");
  const [tipInput, setTipInput] = useState("");
  const orderDiscount = order?.discount;
  const orderTip = order?.tip;
  useEffect(() => {
    if (orderDiscount !== undefined) setDiscountInput(String(orderDiscount));
    if (orderTip !== undefined) setTipInput(String(orderTip));
  }, [orderDiscount, orderTip]);

  // Prefill de los datos de delivery al abrir el dialog.
  const openDeliveryDialog = () => {
    const info = order?.delivery;
    setDeliveryAddress(info?.address ?? "");
    setDeliveryNotes(info?.notes ?? "");
    setDeliveryEstimated(info?.estimatedAt ? info.estimatedAt.slice(0, 16) : "");
    setDeliveryDialogOpen(true);
  };

  // Dialogs
  const [noteDialog, setNoteDialog] = useState<{
    item: OrderItem;
    value: string;
  } | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTableId, setTransferTableId] = useState("");
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryEstimated, setDeliveryEstimated] = useState("");

  // Pago
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
  const [payAmount, setPayAmount] = useState("");

  const paid = useMemo(
    () => (order?.payments ?? []).reduce((sum, p) => sum + p.amount, 0),
    [order?.payments],
  );
  const remaining = Math.max(0, (order?.total ?? 0) - paid);
  const canClose = order != null && paid >= order.total - 0.009;

  const areasQuery = useQuery({
    queryKey: ["areas", branchId],
    queryFn: () => getAreas(branchId as string),
    enabled: Boolean(branchId) && transferDialogOpen,
  });

  // ---------------------------------------------------------------------
  // Mutaciones
  // ---------------------------------------------------------------------

  const invalidateOrder = () => {
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
    void queryClient.invalidateQueries({ queryKey: ["areas"] });
  };

  const onError = (fallback: string) => (err: unknown) => {
    toast.error(getErrorMessage(err, fallback));
    invalidateOrder();
  };

  const addItemMutation = useMutation({
    mutationFn: (productId: string) =>
      addOrderItems(orderId, [{ productId, quantity: 1 }]),
    onSuccess: invalidateOrder,
    onError: onError("No se pudo agregar el producto"),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({
      itemId,
      ...payload
    }: {
      itemId: string;
      quantity?: number;
      notes?: string;
    }) => updateOrderItem(orderId, itemId, payload),
    onSuccess: () => {
      invalidateOrder();
      setNoteDialog(null);
    },
    onError: onError("No se pudo actualizar el ítem"),
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => deleteOrderItem(orderId, itemId),
    onSuccess: invalidateOrder,
    onError: onError("No se pudo quitar el ítem"),
  });

  const patchOrderMutation = useMutation({
    mutationFn: (payload: { discount?: number; tip?: number; tableId?: string }) =>
      updateOrder(orderId, payload),
    onSuccess: () => {
      invalidateOrder();
      setTransferDialogOpen(false);
      setTransferTableId("");
    },
    onError: onError("No se pudo actualizar el pedido"),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendOrderToKitchen(orderId),
    onSuccess: () => {
      toast.success("Pedido enviado a cocina");
      invalidateOrder();
      void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
    },
    onError: onError("No se pudo enviar a cocina"),
  });

  const addPaymentMutation = useMutation({
    mutationFn: (payload: { method: PaymentMethod; amount: number }) =>
      addOrderPayment(orderId, payload),
    onSuccess: () => {
      invalidateOrder();
      void queryClient.invalidateQueries({ queryKey: ["cash"] });
      setPayAmount("");
    },
    onError: onError("No se pudo registrar el pago"),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => deleteOrderPayment(orderId, paymentId),
    onSuccess: invalidateOrder,
    onError: onError("No se pudo eliminar el pago"),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeOrder(orderId),
    onSuccess: () => {
      toast.success("Pedido cerrado");
      invalidateOrder();
      void queryClient.invalidateQueries({ queryKey: ["cash"] });
      router.push("/pos");
    },
    onError: onError("No se pudo cerrar el pedido"),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: () => {
      toast.success("Pedido cancelado");
      invalidateOrder();
      router.push("/pos");
    },
    onError: onError("No se pudo cancelar el pedido"),
  });

  const deliveryMutation = useMutation({
    mutationFn: (payload: {
      address: string;
      notes?: string;
      estimatedAt?: string;
    }) => upsertOrderDelivery(orderId, payload),
    onSuccess: () => {
      toast.success("Datos de delivery guardados");
      invalidateOrder();
      void queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      setDeliveryDialogOpen(false);
    },
    onError: onError("No se pudieron guardar los datos de delivery"),
  });

  const invoiceMutation = useMutation({
    mutationFn: () => createInvoiceFromOrder(orderId),
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(
        `Comprobante ${invoice.formattedNumber} emitido${invoice.cae ? ` · CAE ${invoice.cae}` : ""}`,
        {
          action: {
            label: "Ver factura",
            onClick: () => router.push(`/facturacion/${invoice.id}`),
          },
        },
      );
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Este pedido ya tiene una factura emitida.");
        return;
      }
      toast.error(getErrorMessage(err, "No se pudo facturar el pedido"));
    },
  });

  const commitAmount = (field: "discount" | "tip", raw: string) => {
    if (!order || !isOpen) return;
    const value = Math.max(0, Number(raw) || 0);
    if (value === order[field]) return;
    patchOrderMutation.mutate({ [field]: value });
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  if (orderQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-[480px] w-full" />
          <Skeleton className="h-[480px] w-full" />
        </div>
      </div>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/pos")}>
          <ArrowLeft />
          Volver al POS
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ServerOff className="size-6 text-destructive" />
            </div>
            <p className="font-medium">
              {getErrorMessage(orderQuery.error, "No se pudo cargar el pedido")}
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
      </div>
    );
  }

  const pendingCount = order.items.filter((i) => i.status === "PENDING").length;
  const visibleItems = order.items.filter((i) => i.status !== "CANCELLED");
  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/pos")}>
          <ArrowLeft />
          POS
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">
          {order.number != null ? `Pedido #${order.number}` : "Pedido"}
        </h1>
        <Badge variant="secondary">{ORDER_TYPE_LABELS[order.type]}</Badge>
        {order.table && <Badge variant="outline">{order.table.name}</Badge>}
        {!isOpen && (
          <Badge
            variant={order.status === "CLOSED" ? "success" : "destructive"}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        )}
        {isOpen && order.type === "DINE_IN" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTransferDialogOpen(true)}
          >
            <ArrowRightLeft />
            Transferir mesa
          </Button>
        )}
        {order.type === "DELIVERY" && (
          <Button
            variant="outline"
            size="sm"
            onClick={openDeliveryDialog}
            disabled={!isOpen && !order.delivery}
          >
            <MapPin />
            {order.delivery?.address ? "Editar dirección" : "Cargar dirección"}
          </Button>
        )}
      </div>

      {!isOpen && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Este pedido está {ORDER_STATUS_LABELS[order.status].toLowerCase()}:
          solo lectura.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Panel izquierdo: catálogo */}
        <Card className="min-w-0">
          <CardContent className="space-y-3 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar producto…"
                className="pl-8"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <CategoryChip
                active={categoryId === ""}
                onClick={() => setCategoryId("")}
              >
                Todas
              </CategoryChip>
              {categories.map((category) => (
                <CategoryChip
                  key={category.id}
                  active={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                </CategoryChip>
              ))}
            </div>

            {productsQuery.isPending ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : productsQuery.isError ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
                <p className="text-sm font-medium">
                  {getErrorMessage(
                    productsQuery.error,
                    "No se pudieron cargar los productos",
                  )}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void productsQuery.refetch()}
                >
                  <RefreshCw />
                  Reintentar
                </Button>
              </div>
            ) : products.length === 0 ? (
              <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                No hay productos para mostrar.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    disabled={!isOpen || addItemMutation.isPending}
                    onClick={() => addItemMutation.mutate(product.id)}
                    className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border bg-card p-2 text-center shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  >
                    <span className="line-clamp-2 text-sm font-medium leading-tight">
                      {product.name}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatARS(product.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel derecho: ticket */}
        <Card className="h-fit">
          <CardContent className="space-y-4 p-4">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Ticket
            </p>

            {order.type === "DELIVERY" && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    {order.delivery?.address ? (
                      <span className="font-medium">
                        {order.delivery.address}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Sin dirección cargada
                      </span>
                    )}
                    {order.delivery?.notes && (
                      <span className="block text-xs text-muted-foreground">
                        {order.delivery.notes}
                      </span>
                    )}
                  </span>
                </p>
              </div>
            )}

            {visibleItems.length === 0 ? (
              <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                Todavía no hay productos en el pedido.
              </p>
            ) : (
              <ul className="divide-y">
                {visibleItems.map((item) => {
                  const isPendingItem = item.status === "PENDING";
                  return (
                    <li key={item.id} className="space-y-1.5 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {item.product?.name ?? "Producto"}
                          </p>
                          {item.notes && (
                            <p className="truncate text-xs text-amber-600 dark:text-amber-400">
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-sm font-medium tabular-nums">
                          {formatARS(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isPendingItem && isOpen ? (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-7"
                              disabled={
                                item.quantity <= 1 ||
                                updateItemMutation.isPending
                              }
                              onClick={() =>
                                updateItemMutation.mutate({
                                  itemId: item.id,
                                  quantity: item.quantity - 1,
                                })
                              }
                            >
                              <Minus />
                            </Button>
                            <span className="w-7 text-center text-sm tabular-nums">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-7"
                              disabled={updateItemMutation.isPending}
                              onClick={() =>
                                updateItemMutation.mutate({
                                  itemId: item.id,
                                  quantity: item.quantity + 1,
                                })
                              }
                            >
                              <Plus />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title="Notas del ítem"
                              onClick={() =>
                                setNoteDialog({
                                  item,
                                  value: item.notes ?? "",
                                })
                              }
                            >
                              <StickyNote />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              title="Quitar ítem"
                              disabled={removeItemMutation.isPending}
                              onClick={() => removeItemMutation.mutate(item.id)}
                            >
                              <Trash2 />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            x{item.quantity}
                          </span>
                        )}
                        <Badge
                          variant={ITEM_STATUS_VARIANT[item.status]}
                          className="ml-auto"
                        >
                          {ITEM_STATUS_LABELS[item.status]}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Totales */}
            <div className="space-y-2 border-t pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatARS(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label
                  htmlFor="order-discount"
                  className="font-normal text-muted-foreground"
                >
                  Descuento
                </Label>
                <Input
                  id="order-discount"
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-8 w-28 text-right tabular-nums"
                  value={discountInput}
                  disabled={!isOpen}
                  onChange={(event) => setDiscountInput(event.target.value)}
                  onBlur={() => commitAmount("discount", discountInput)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label
                  htmlFor="order-tip"
                  className="font-normal text-muted-foreground"
                >
                  Propina
                </Label>
                <Input
                  id="order-tip"
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-8 w-28 text-right tabular-nums"
                  value={tipInput}
                  disabled={!isOpen}
                  onChange={(event) => setTipInput(event.target.value)}
                  onBlur={() => commitAmount("tip", tipInput)}
                />
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatARS(order.total)}</span>
              </div>
              {paid > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Pagado</span>
                  <span className="tabular-nums">
                    {formatARS(paid)} · restan {formatARS(remaining)}
                  </span>
                </div>
              )}
            </div>

            {/* Acciones */}
            {isOpen && (
              <div className="space-y-2">
                <Button
                  className="h-12 w-full text-base"
                  disabled={pendingCount === 0 || sendMutation.isPending}
                  onClick={() => sendMutation.mutate()}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ChefHat />
                  )}
                  Enviar a cocina
                  {pendingCount > 0 && ` (${pendingCount})`}
                </Button>
                <Button
                  variant="secondary"
                  className="h-12 w-full text-base"
                  disabled={visibleItems.length === 0}
                  onClick={() => {
                    setPayAmount(remaining > 0 ? String(remaining) : "");
                    setPayDialogOpen(true);
                  }}
                >
                  <CreditCard />
                  Cobrar
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setCancelDialogOpen(true)}
                >
                  <Ban />
                  Cancelar pedido
                </Button>
              </div>
            )}

            {order.status === "CLOSED" && (
              <Button
                className="h-12 w-full text-base"
                disabled={invoiceMutation.isPending}
                onClick={() => invoiceMutation.mutate()}
              >
                {invoiceMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileText />
                )}
                Facturar
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de notas */}
      <Dialog
        open={noteDialog !== null}
        onOpenChange={(open) => {
          if (!open) setNoteDialog(null);
        }}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Notas del ítem</DialogTitle>
          <DialogDescription>
            {noteDialog?.item.product?.name ?? "Producto"} — observaciones para
            cocina.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={noteDialog?.value ?? ""}
          onChange={(event) =>
            setNoteDialog((d) => (d ? { ...d, value: event.target.value } : d))
          }
          placeholder="Por ej. sin sal, punto jugoso…"
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setNoteDialog(null)}>
            Cancelar
          </Button>
          <Button
            disabled={updateItemMutation.isPending}
            onClick={() => {
              if (noteDialog) {
                updateItemMutation.mutate({
                  itemId: noteDialog.item.id,
                  notes: noteDialog.value.trim(),
                });
              }
            }}
          >
            {updateItemMutation.isPending && (
              <Loader2 className="animate-spin" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog de cobro */}
      <Dialog
        open={payDialogOpen}
        onOpenChange={setPayDialogOpen}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Cobrar pedido</DialogTitle>
          <DialogDescription>
            Total {formatARS(order.total)} · Pagado {formatARS(paid)} · Restan{" "}
            {formatARS(remaining)}
          </DialogDescription>
        </DialogHeader>

        {order.payments.length > 0 && (
          <ul className="space-y-1.5">
            {order.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span>{PAYMENT_METHOD_LABELS[payment.method]}</span>
                <span className="ml-auto font-medium tabular-nums">
                  {formatARS(payment.amount)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-destructive hover:text-destructive"
                  title="Eliminar pago"
                  disabled={deletePaymentMutation.isPending}
                  onClick={() => deletePaymentMutation.mutate(payment.id)}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pay-method">Método de pago</Label>
            <Select
              id="pay-method"
              value={payMethod}
              onChange={(event) =>
                setPayMethod(event.target.value as PaymentMethod)
              }
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Monto</Label>
            <div className="flex gap-2">
              <Input
                id="pay-amount"
                type="number"
                min={0}
                step="0.01"
                value={payAmount}
                onChange={(event) => setPayAmount(event.target.value)}
                className="tabular-nums"
              />
              <Button
                variant="outline"
                disabled={remaining <= 0}
                onClick={() => setPayAmount(String(remaining))}
              >
                Resto
              </Button>
            </div>
          </div>
          {payMethod === "MERCADOPAGO" ? (
            <MpPayment
              orderId={orderId}
              amount={Number(payAmount) || 0}
              onApproved={() => {
                invalidateOrder();
                void queryClient.invalidateQueries({ queryKey: ["cash"] });
                toast.success("Pago de Mercado Pago acreditado");
              }}
            />
          ) : (
            <Button
              className="w-full"
              disabled={addPaymentMutation.isPending || !(Number(payAmount) > 0)}
              onClick={() =>
                addPaymentMutation.mutate({
                  method: payMethod,
                  amount: Number(payAmount),
                })
              }
            >
              {addPaymentMutation.isPending && (
                <Loader2 className="animate-spin" />
              )}
              Agregar pago
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
            Seguir después
          </Button>
          <Button
            disabled={!canClose || closeMutation.isPending}
            onClick={() => closeMutation.mutate()}
          >
            {closeMutation.isPending && <Loader2 className="animate-spin" />}
            Cerrar pedido
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog de cancelación */}
      <Dialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Cancelar pedido</DialogTitle>
          <DialogDescription>
            ¿Seguro que querés cancelar este pedido? La mesa quedará libre y no
            se descuenta stock. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
            Volver
          </Button>
          <Button
            variant="destructive"
            disabled={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            {cancelMutation.isPending && <Loader2 className="animate-spin" />}
            Cancelar pedido
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog de transferencia de mesa */}
      <Dialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Transferir mesa</DialogTitle>
          <DialogDescription>
            La mesa actual ({order.table?.name ?? "—"}) quedará libre y la
            nueva pasará a ocupada.
          </DialogDescription>
        </DialogHeader>
        {areasQuery.isPending ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select
            value={transferTableId}
            onChange={(event) => setTransferTableId(event.target.value)}
          >
            <option value="">Elegir mesa destino…</option>
            {(areasQuery.data ?? []).map((area) =>
              area.tables
                .filter(
                  (t) =>
                    t.shape !== "DECOR" &&
                    t.id !== order.tableId &&
                    t.status === "FREE",
                )
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {area.name} — {t.name}
                  </option>
                )),
            )}
          </Select>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setTransferDialogOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            disabled={!transferTableId || patchOrderMutation.isPending}
            onClick={() =>
              patchOrderMutation.mutate({ tableId: transferTableId })
            }
          >
            {patchOrderMutation.isPending && (
              <Loader2 className="animate-spin" />
            )}
            Transferir
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog de datos de delivery */}
      <Dialog
        open={deliveryDialogOpen}
        onOpenChange={setDeliveryDialogOpen}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Datos de delivery</DialogTitle>
          <DialogDescription>
            Dirección de entrega y datos para el repartidor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="delivery-address">Dirección</Label>
            <Input
              id="delivery-address"
              value={deliveryAddress}
              onChange={(event) => setDeliveryAddress(event.target.value)}
              placeholder="Calle 123, piso/depto, barrio"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delivery-notes">Notas (opcional)</Label>
            <Textarea
              id="delivery-notes"
              value={deliveryNotes}
              onChange={(event) => setDeliveryNotes(event.target.value)}
              placeholder="Timbre, referencias, indicaciones…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delivery-estimated">
              Horario estimado (opcional)
            </Label>
            <Input
              id="delivery-estimated"
              type="datetime-local"
              value={deliveryEstimated}
              onChange={(event) => setDeliveryEstimated(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDeliveryDialogOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            disabled={!deliveryAddress.trim() || deliveryMutation.isPending}
            onClick={() =>
              deliveryMutation.mutate({
                address: deliveryAddress.trim(),
                notes: deliveryNotes.trim() || undefined,
                estimatedAt: deliveryEstimated
                  ? new Date(deliveryEstimated).toISOString()
                  : undefined,
              })
            }
          >
            {deliveryMutation.isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
