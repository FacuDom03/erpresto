import { apiFetch } from "@/lib/api";

/**
 * Catálogo central de estaciones de preparación (Tenant.settings.stations).
 *
 * GET /stations  → { stations: string[] }
 * PUT /stations  → { stations: string[] } (requiere permiso settings.manage)
 *
 * El backend nunca devuelve vacío: si no hay configuradas, infiere de los
 * productos/categorías en uso o cae a ["Cocina", "Barra"].
 */

/** Clave de query compartida para el catálogo de estaciones. */
export const STATIONS_QUERY_KEY = ["stations"] as const;

function normalizeStations(raw: unknown): string[] {
  const stations = (raw as { stations?: unknown })?.stations;
  if (!Array.isArray(stations)) return [];
  return stations.filter((s): s is string => typeof s === "string");
}

export async function getStations(): Promise<string[]> {
  const raw = await apiFetch<unknown>("/stations");
  return normalizeStations(raw);
}

export async function updateStations(stations: string[]): Promise<string[]> {
  const raw = await apiFetch<unknown>("/stations", {
    method: "PUT",
    body: { stations },
  });
  return normalizeStations(raw);
}
