import { Injectable, signal } from '@angular/core';
import { Id } from '../models';

export interface Toast {
  id: number;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<Toast[]>([]);

  show(text: string): void {
    const id = ++this.nextId;
    this.toasts.update((list) => [...list, { id, text }]);
    setTimeout(() => this.dismiss(id), 3200);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}

/** Estado del panel lateral de detalle de tarea, accesible desde cualquier vista. */
@Injectable({ providedIn: 'root' })
export class TaskPanelService {
  readonly openId = signal<Id | null>(null);

  open(id: Id): void {
    this.openId.set(id);
  }

  close(): void {
    this.openId.set(null);
  }
}

/** Apertura del diálogo de nota rápida (botón de la barra superior o tecla N). */
@Injectable({ providedIn: 'root' })
export class QuickCaptureService {
  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
