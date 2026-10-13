import { IsoDate } from '../models';

const DAY_MS = 86_400_000;

export function startOfDay(date = new Date()): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Días naturales entre hoy y la fecha (negativo = en el pasado). */
export function daysFromToday(iso: IsoDate): number {
  return Math.round((startOfDay(new Date(iso)).getTime() - startOfDay().getTime()) / DAY_MS);
}

export function isOverdue(iso?: IsoDate): boolean {
  return !!iso && daysFromToday(iso) < 0;
}

export function isoDaysFromNow(days: number, hour = 18): IsoDate {
  const date = startOfDay();
  date.setDate(date.getDate() + days);
  date.setHours(hour);
  return date.toISOString();
}

export function isoHoursAgo(hours: number): IsoDate {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

const shortFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const longFormat = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

export function formatShortDate(iso?: IsoDate): string {
  return iso ? shortFormat.format(new Date(iso)) : '—';
}

export function formatLongDate(date = new Date()): string {
  const text = longFormat.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «Hoy», «Mañana», «Hace 3 días», «En 4 días» o fecha corta. */
export function relativeDue(iso?: IsoDate): string {
  if (!iso) return 'Sin fecha';
  const days = daysFromToday(iso);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days === -1) return 'Ayer';
  if (days < 0) return `Hace ${-days} días`;
  if (days < 7) return `En ${days} días`;
  return formatShortDate(iso);
}

export function timeAgo(iso: IsoDate): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return formatShortDate(iso);
}

/** ISO → valor de <input type="date"> en hora local. */
export function toDateInput(iso?: IsoDate): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Valor de <input type="date"> → ISO a las 18:00 locales. */
export function fromDateInput(value: string): IsoDate | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 18).toISOString();
}

/** ISO → valor de <input type="datetime-local"> en hora local. */
export function toDateTimeInput(iso?: IsoDate): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${toDateInput(iso)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> → ISO. */
export function fromDateTimeInput(value: string): IsoDate | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

const scheduleFormat = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const timeFormat = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

/** «mar, 27 oct, 08:00–14:00». */
export function formatSchedule(start?: IsoDate, end?: IsoDate): string {
  if (!start) return '';
  const from = scheduleFormat.format(new Date(start));
  return end ? `${from}–${timeFormat.format(new Date(end))}` : from;
}
