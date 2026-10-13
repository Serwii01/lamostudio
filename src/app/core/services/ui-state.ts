import { Injectable, signal } from '@angular/core';
import { Id } from '../models';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
  action?: ToastAction;
}

/** Tiempo para deshacer un borrado antes de hacerlo definitivo. */
export const UNDO_WINDOW_MS = 6000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<Toast[]>([]);

  show(text: string, action?: ToastAction): void {
    this.push({ text, tone: 'info', action }, action ? UNDO_WINDOW_MS : 3200);
  }

  error(text: string): void {
    this.push({ text, tone: 'error' }, 7000);
  }

  runAction(toast: Toast): void {
    toast.action?.run();
    this.dismiss(toast.id);
  }

  private push(toast: Omit<Toast, 'id'>, duration: number): void {
    const id = ++this.nextId;
    this.toasts.update((list) => [...list.slice(-2), { ...toast, id }]);
    setTimeout(() => this.dismiss(id), duration);
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

export type TaskView = 'tareas' | 'tablero';
const TASK_VIEW_KEY = 'lamo-studio:task-view';

/** Vista preferida de las tareas de un proyecto (lista o tablero); se recuerda entre visitas. */
@Injectable({ providedIn: 'root' })
export class TaskViewService {
  readonly view = signal<TaskView>(readTaskView());

  set(view: TaskView): void {
    this.view.set(view);
    try {
      localStorage.setItem(TASK_VIEW_KEY, view);
    } catch {
      // Preferencia solo para esta sesión.
    }
  }
}

function readTaskView(): TaskView {
  try {
    return localStorage.getItem(TASK_VIEW_KEY) === 'tablero' ? 'tablero' : 'tareas';
  } catch {
    return 'tareas';
  }
}

/** Diálogo global «Nueva tarea» (botón de la barra superior o tecla T). */
@Injectable({ providedIn: 'root' })
export class NewTaskService {
  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
