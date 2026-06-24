"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, QrCode as QrIcon } from "lucide-react";

import { getErrorMessage } from "@/lib/api";
import {
  createMpPayment,
  getMpPaymentStatus,
} from "@/lib/orders";
import type { MpPaymentIntent, MpPaymentStatus } from "@/lib/types";
import { formatARS } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/ui/qr-code";

interface MpPaymentProps {
  orderId: string;
  amount: number;
  /** Se invoca al detectar el pago aprobado (refresca el pedido). */
  onApproved: () => void;
}

const POLL_INTERVAL = 2000;

/**
 * Flujo de cobro con QR de Mercado Pago: genera la intención (POST
 * /orders/:id/mp-payment), muestra el QR y hace polling del estado cada 2s
 * hasta `approved`. El backend registra el Payment al aprobarse.
 */
export function MpPayment({ orderId, amount, onApproved }: MpPaymentProps) {
  const [intent, setIntent] = useState<MpPaymentIntent | null>(null);
  const [status, setStatus] = useState<MpPaymentStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approvedRef = useRef(false);

  // Polling del estado mientras esté pendiente.
  useEffect(() => {
    if (!intent || status === "approved" || status === "rejected") return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const next = await getMpPaymentStatus(intent.externalId);
        if (cancelled) return;
        setStatus(next);
        if (next === "approved" && !approvedRef.current) {
          approvedRef.current = true;
          onApproved();
        }
      } catch {
        // Silencioso: reintenta en el próximo tick.
      }
    }, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intent, status, onApproved]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    approvedRef.current = false;
    try {
      const created = await createMpPayment(orderId, amount);
      setIntent(created);
      setStatus(created.status);
      if (created.status === "approved") {
        approvedRef.current = true;
        onApproved();
      }
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo generar el QR"));
    } finally {
      setGenerating(false);
    }
  };

  if (!intent) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={generating || !(amount > 0)}
          onClick={() => void generate()}
        >
          {generating ? <Loader2 className="animate-spin" /> : <QrIcon />}
          Generar QR ({formatARS(amount)})
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
      {status === "approved" ? (
        <>
          <CheckCircle2 className="size-12 text-success" />
          <p className="font-medium text-success">Pago aprobado</p>
          <p className="text-xs text-muted-foreground">
            El pago de {formatARS(intent.amount)} se registró en el pedido.
          </p>
        </>
      ) : status === "rejected" ? (
        <>
          <p className="font-medium text-destructive">Pago rechazado</p>
          <Button variant="outline" size="sm" onClick={() => void generate()}>
            Generar otro QR
          </Button>
        </>
      ) : (
        <>
          <QrCode value={intent.qrData} size={200} />
          <p className="text-sm font-medium">
            Escaneá para pagar {formatARS(intent.amount)}
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Esperando confirmación del pago…
          </p>
        </>
      )}
    </div>
  );
}
