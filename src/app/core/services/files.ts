import { Injectable, computed, inject } from '@angular/core';
import { FileAsset, Id } from '../models';
import { FileRepository } from '../data/repositories';
import { fileKindOf, linkName, linkProvider, parseLink, validateUpload } from '../utils/files';
import { ActivityService } from './activity';
import { ProjectService } from './projects';
import { SessionService } from './session';
import { ToastService } from './ui-state';
import { PendingDeletes } from './undo';

export interface UploadTarget {
  projectId: Id;
  taskId?: Id;
}

export interface UploadResult {
  uploaded: FileAsset[];
  errors: string[];
}

const THUMB_SIZE = 360;

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly repo = inject(FileRepository);
  private readonly session = inject(SessionService);
  private readonly projects = inject(ProjectService);
  private readonly activity = inject(ActivityService);
  private readonly toast = inject(ToastService);
  private readonly deletes = new PendingDeletes<FileAsset>(this.toast);

  readonly all = this.deletes.filter(this.repo.files);

  /** Archivos de los proyectos que el usuario puede ver, del más reciente al más antiguo. */
  readonly visible = computed(() => {
    const ids = new Set(this.projects.visible().map((p) => p.id));
    return this.all()
      .filter((f) => ids.has(f.projectId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  /** Número de adjuntos por tarea, para mostrar el clip en filas y tarjetas. */
  readonly countByTask = computed(() => {
    const counts = new Map<Id, number>();
    for (const f of this.all()) if (f.taskId) counts.set(f.taskId, (counts.get(f.taskId) ?? 0) + 1);
    return counts;
  });

  canEdit(): boolean {
    return this.session.can('task.edit');
  }

  async upload(files: File[], target: UploadTarget): Promise<UploadResult> {
    const result: UploadResult = { uploaded: [], errors: [] };
    for (const file of files) {
      const error = validateUpload(file);
      if (error) {
        result.errors.push(error);
        continue;
      }
      try {
        const kind = fileKindOf(file.type, file.name);
        const thumbnail = await createThumbnail(file, kind);
        const asset = await this.repo.create(
          {
            projectId: target.projectId,
            taskId: target.taskId,
            name: file.name,
            kind,
            mimeType: file.type || undefined,
            size: file.size,
            thumbnail,
            uploadedBy: this.session.currentUserId(),
          },
          file,
        );
        result.uploaded.push(asset);
        this.activity.log('file.uploaded', { id: asset.id, label: asset.name }, { projectId: asset.projectId });
      } catch {
        result.errors.push(`No se pudo guardar «${file.name}». Puede que el navegador se haya quedado sin espacio.`);
      }
    }
    return result;
  }

  /** Añade un enlace externo. Devuelve un mensaje de error si la dirección no es válida. */
  async addLink(raw: string, name: string, target: UploadTarget): Promise<string | null> {
    const url = parseLink(raw);
    if (!url) return 'Escribe una dirección web completa, por ejemplo https://drive.google.com/…';
    const asset = await this.repo.create({
      projectId: target.projectId,
      taskId: target.taskId,
      name: name.trim() || linkName(url),
      kind: 'link',
      url: url.href,
      provider: linkProvider(url),
      uploadedBy: this.session.currentUserId(),
    });
    this.activity.log('file.linked', { id: asset.id, label: asset.name }, { projectId: asset.projectId });
    return null;
  }

  rename(file: FileAsset, name: string): void {
    const clean = name.trim();
    if (clean && clean !== file.name) void this.repo.update(file.id, { name: clean });
  }

  attachToTask(file: FileAsset, taskId: Id | undefined): void {
    void this.repo.update(file.id, { taskId });
  }

  contentUrl(file: FileAsset): Promise<string | null> {
    return this.repo.contentUrl(file.id);
  }

  async open(file: FileAsset): Promise<void> {
    const url = await this.contentUrl(file);
    if (url) window.open(url, '_blank', 'noopener');
    else this.toast.error('No se encuentra el contenido de este archivo en este navegador.');
  }

  async download(file: FileAsset): Promise<void> {
    if (file.url) return this.open(file);
    const url = await this.contentUrl(file);
    if (!url) {
      this.toast.error('No se encuentra el contenido de este archivo en este navegador.');
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
  }

  remove(file: FileAsset): void {
    const label = file.kind === 'link' ? 'Enlace eliminado' : `«${file.name.slice(0, 40)}» eliminado`;
    this.deletes.remove(file, label, async () => {
      await this.repo.remove(file.id);
      this.activity.log('file.deleted', { id: file.id, label: file.name }, { projectId: file.projectId });
    });
  }
}

/**
 * Miniatura ligera (WebP/JPEG, máx. 360 px) para imágenes y fotogramas de vídeo,
 * así las cuadrículas no cargan los originales. Si falla, el archivo se muestra con icono.
 */
async function createThumbnail(file: File, kind: string): Promise<string | undefined> {
  try {
    if (kind === 'image' && file.type !== 'image/svg+xml') {
      const bitmap = await createImageBitmap(file);
      const result = drawThumbnail(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      return result;
    }
    if (kind === 'video') return await videoFrame(file);
  } catch {
    // Formato no soportado por el navegador: sin miniatura.
  }
  return undefined;
}

function drawThumbnail(source: CanvasImageSource, width: number, height: number): string | undefined {
  if (!width || !height) return undefined;
  const scale = Math.min(1, THUMB_SIZE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL('image/webp', 0.72);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.72);
}

function videoFrame(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const finish = (value?: string) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(), 4000);
    video.muted = true;
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 4);
    };
    video.onseeked = () => finish(drawThumbnail(video, video.videoWidth, video.videoHeight));
    video.onerror = () => finish();
    video.src = url;
  });
}
