import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

export function formatARS(value: number): string {
  return arsFormatter.format(value);
}

/**
 * Convierte montos que la API puede devolver como string (Decimal serializado)
 * o number a number. `null`/`undefined`/NaN → 0.
 */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

const quantityFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 3,
});

/** Cantidad con hasta 3 decimales en formato es-AR (1.234,5). */
export function formatQuantity(value: number): string {
  return quantityFormatter.format(value);
}

/**
 * Parsea un número ingresado por el usuario (acepta coma decimal).
 * Devuelve null si está vacío o no es un número válido.
 */
export function parseDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Hora local corta (HH:mm). */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return timeFormatter.format(date);
}

/** Fecha y hora local corta (dd/mm HH:mm). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

/** Tiempo transcurrido en formato mm:ss (puede superar los 60 minutos). */
export function formatElapsed(fromIso: string, now: number): string {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return "--:--";
  const totalSeconds = Math.max(0, Math.floor((now - from) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Minutos transcurridos desde un ISO date. */
export function minutesSince(fromIso: string, now: number): number {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return 0;
  return Math.max(0, Math.floor((now - from) / 60_000));
}

