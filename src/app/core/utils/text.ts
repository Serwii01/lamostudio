import { Id } from '../models';

export const newId = (prefix: string): Id => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

/** Minúsculas y sin tildes, para búsquedas tolerantes. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

export function firstLine(text: string, max = 80): string {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function parseTags(value: string): string[] {
  return [...new Set(value.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}
