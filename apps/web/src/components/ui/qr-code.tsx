"use client";

import * as React from "react";
import QRCode from "qrcode";

import { cn } from "@/lib/utils";

interface QrCodeProps {
  /** Texto a codificar (URL o payload de pago). */
  value: string;
  /** Lado del QR en px. */
  size?: number;
  className?: string;
}

/**
 * Renderiza un QR a partir de `value` usando el paquete `qrcode` (genera un
 * data-URL que se muestra en un <img>). Sin dependencias de React extra.
 */
export function QrCode({ value, size = 220, className }: QrCodeProps) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setError(false);
    setDataUrl(null);
    if (!value) return;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed text-center text-xs text-muted-foreground",
          className,
        )}
        style={{ width: size, height: size }}
      >
        No se pudo generar el QR
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={cn("animate-pulse rounded-lg bg-muted", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="Código QR de pago"
      width={size}
      height={size}
      className={cn("rounded-lg border bg-white p-2", className)}
    />
  );
}
