import { FileKind } from '../models';

/** Tamaño máximo por archivo. Los brutos pesados van como enlace externo. */
export const MAX_UPLOAD_MB = 25;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Extensiones que nunca se aceptan: ejecutables y scripts. */
const BLOCKED_EXTENSIONS = new Set(['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'vbs', 'sh', 'jar', 'dll', 'apk']);

const DOCUMENT_EXTENSIONS = new Set([
  'doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'pages',
  'xls', 'xlsx', 'ods', 'csv', 'numbers',
  'ppt', 'pptx', 'odp', 'key',
  'psd', 'ai', 'indd', 'fig', 'sketch', 'xd', 'zip',
]);

export const FILE_KIND_META: Record<FileKind, { label: string; icon: string }> = {
  image: { label: 'Imagen', icon: 'image' },
  video: { label: 'Vídeo', icon: 'film' },
  audio: { label: 'Audio', icon: 'music' },
  pdf: { label: 'PDF', icon: 'file' },
  document: { label: 'Documento', icon: 'file' },
  link: { label: 'Enlace', icon: 'link' },
  other: { label: 'Archivo', icon: 'paperclip' },
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function fileKindOf(mimeType: string, name: string): FileKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  const ext = extensionOf(name);
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (DOCUMENT_EXTENSIONS.has(ext)) return 'document';
  return 'other';
}

/** Devuelve un mensaje de error en español o null si el archivo se puede subir. */
export function validateUpload(file: { name: string; size: number }): string | null {
  if (BLOCKED_EXTENSIONS.has(extensionOf(file.name))) {
    return `«${file.name}» es un ejecutable y no se puede subir.`;
  }
  if (file.size === 0) {
    return `«${file.name}» está vacío.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `«${file.name}» pesa ${formatBytes(file.size)}; el máximo es ${MAX_UPLOAD_MB} MB. Para brutos pesados, añade un enlace a Drive o Frame.io.`;
  }
  return null;
}

const PROVIDERS: [RegExp, string][] = [
  [/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/, 'Google Drive'],
  [/(^|\.)dropbox\.com$/, 'Dropbox'],
  [/(^|\.)frame\.io$|(^|\.)f\.io$/, 'Frame.io'],
  [/(^|\.)vimeo\.com$/, 'Vimeo'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, 'YouTube'],
  [/(^|\.)figma\.com$/, 'Figma'],
  [/(^|\.)wetransfer\.com$|(^|\.)we\.tl$/, 'WeTransfer'],
  [/(^|\.)notion\.so$|(^|\.)notion\.site$/, 'Notion'],
  [/(^|\.)onedrive\.live\.com$|(^|\.)sharepoint\.com$|(^|\.)1drv\.ms$/, 'OneDrive'],
];

/** Normaliza una dirección escrita por el usuario; null si no es http(s). */
export function parseLink(raw: string): URL | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function linkProvider(url: URL): string {
  const host = url.hostname.toLowerCase();
  return PROVIDERS.find(([pattern]) => pattern.test(host))?.[1] ?? host.replace(/^www\./, '');
}

/** Nombre legible para un enlace cuando el usuario no escribe uno. */
export function linkName(url: URL): string {
  const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
  // Solo se usa el final de la ruta si parece un nombre de archivo (moodboard.pdf).
  return /^.{1,60}\.[a-z0-9]{2,5}$/i.test(last) ? last : `Enlace de ${linkProvider(url)}`;
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`;
}
