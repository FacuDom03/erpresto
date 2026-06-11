export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

/** Offset (ms) de la zona horaria respecto de UTC en un instante dado. */
function tzOffsetMs(timezone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const hour = get('hour') === 24 ? 0 : get('hour');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return asUtc - date.getTime();
}

/** Fecha (YYYY-MM-DD) que corresponde a un instante en una zona horaria. */
export function formatDateInTz(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Instante UTC de la medianoche local (inicio del día) en la zona dada. */
export function startOfDayInTz(date: Date, timezone: string): Date {
  const [y, m, d] = formatDateInTz(date, timezone).split('-').map(Number);
  let ts = Date.UTC(y, m - 1, d);
  // Doble corrección para converger en bordes de DST
  for (let i = 0; i < 2; i++) {
    ts = Date.UTC(y, m - 1, d) - tzOffsetMs(timezone, new Date(ts));
  }
  return new Date(ts);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
