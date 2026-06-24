"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileMinus,
  Loader2,
  RefreshCw,
  ServerOff,
} from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api";
import {
  createCreditNote,
  formatInvoiceNumber,
  getInvoice,
  INVOICE_TYPE_LABELS,
  isCreditNote,
} from "@/lib/invoices";
import { formatARS, formatDate, formatQuantity } from "@/lib/utils";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function FacturaDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id;

  const [creditNoteOpen, setCreditNoteOpen] = useState(false);

  const invoiceQuery = useQuery({
    queryKey: ["invoices", id],
    queryFn: () => getInvoice(id),
    enabled: Boolean(id),
  });

  const creditNoteMutation = useMutation({
    mutationFn: () => createCreditNote(id),
    onSuccess: (nc) => {
      toast.success(
        `Nota de crédito ${formatInvoiceNumber(nc.pointOfSale, nc.number)} emitida`,
      );
      setCreditNoteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      router.push(`/facturacion/${nc.id}`);
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo emitir la nota de crédito"));
    },
  });

  if (invoiceQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[480px] w-full" />
      </div>
    );
  }

  if (invoiceQuery.isError || !invoiceQuery.data) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/facturacion")}
        >
          <ArrowLeft />
          Facturación
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ServerOff className="size-6 text-destructive" />
            </div>
            <p className="font-medium">
              {getErrorMessage(
                invoiceQuery.error,
                "No se pudo cargar el comprobante",
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void invoiceQuery.refetch()}
            >
              <RefreshCw />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoice = invoiceQuery.data;
  const canCreditNote =
    invoice.status === "ISSUED" && !isCreditNote(invoice.type);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/facturacion")}
        >
          <ArrowLeft />
          Facturación
        </Button>
        <h1 className="text-xl font-semibold tracking-tight tabular-nums">
          {invoice.formattedNumber}
        </h1>
        <Badge variant="secondary">{INVOICE_TYPE_LABELS[invoice.type]}</Badge>
        <InvoiceStatusBadge status={invoice.status} />
        {invoice.isMock && <Badge variant="outline">Simulado (mock)</Badge>}
        {invoice.orderId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/pos/${invoice.orderId}`)}
          >
            Ver pedido{invoice.orderNumber != null && ` #${invoice.orderNumber}`}
          </Button>
        )}
        {canCreditNote && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setCreditNoteOpen(true)}
          >
            <FileMinus />
            Emitir nota de crédito
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Líneas */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Detalle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">P. unit.</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        El comprobante no tiene líneas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoice.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">
                          {line.description}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatQuantity(line.quantity)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatARS(line.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatQuantity(line.taxRate)}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatARS(line.netAmount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatARS(line.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Neto gravado</span>
                <span className="tabular-nums">
                  {formatARS(invoice.netAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA</span>
                <span className="tabular-nums">
                  {formatARS(invoice.taxAmount)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatARS(invoice.totalAmount)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Datos fiscales y CAE */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Datos fiscales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Cliente" value={invoice.customerName ?? "Consumidor final"} />
              <Field label="CUIT / DNI" value={invoice.customerTaxId ?? "—"} />
              {invoice.customerIvaCondition && (
                <Field
                  label="Condición IVA"
                  value={invoice.customerIvaCondition}
                />
              )}
              <Field
                label="Punto de venta"
                value={String(invoice.pointOfSale).padStart(4, "0")}
              />
              <Field
                label="Fecha de emisión"
                value={formatDate(invoice.issuedAt ?? invoice.createdAt)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CAE</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {invoice.cae ? (
                <>
                  <Field label="CAE" value={invoice.cae} mono />
                  <Field
                    label="Vencimiento CAE"
                    value={formatDate(invoice.caeExpiry)}
                  />
                  {invoice.isMock && (
                    <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                      Comprobante simulado por el proveedor mock: el CAE no es
                      válido ante AFIP.
                    </p>
                  )}
                </>
              ) : invoice.status === "REJECTED" ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
                  El comprobante fue rechazado y no obtuvo CAE.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Sin CAE asignado todavía.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog de confirmación de NC */}
      <Dialog
        open={creditNoteOpen}
        onOpenChange={setCreditNoteOpen}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Emitir nota de crédito</DialogTitle>
          <DialogDescription>
            Se va a generar una nota de crédito total por{" "}
            {formatARS(invoice.totalAmount)} que anula el comprobante{" "}
            {invoice.formattedNumber}. Se solicitará su propio CAE. Esta acción
            no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreditNoteOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={creditNoteMutation.isPending}
            onClick={() => creditNoteMutation.mutate()}
          >
            {creditNoteMutation.isPending && (
              <Loader2 className="animate-spin" />
            )}
            Emitir nota de crédito
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "tabular-nums font-medium" : "text-right font-medium"}>
        {value}
      </span>
    </div>
  );
}
