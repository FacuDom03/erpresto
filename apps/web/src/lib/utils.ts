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

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Fecha local corta (dd/mm/aaaa). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

const MONTH_NAMES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Cumpleaños como "12 de mayo". Toma día y mes de la parte de fecha del ISO
 * (sin convertir zona horaria, para no correr el día).
 */
export function formatBirthday(iso: string | null | undefined): string {
  if (!iso) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return "—";
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "—";
  return `${day} de ${MONTH_NAMES_ES[month - 1]}`;
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

/** Fecha local en formato YYYY-MM-DD (para inputs date y queries de reportes). */
export function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

