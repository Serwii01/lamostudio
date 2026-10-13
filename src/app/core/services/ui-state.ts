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

  /** Ctrl+Z: ejecuta el «Deshacer» del aviso más reciente que lo tenga. */
  undoLast(): boolean {
    const toast = [...this.toasts()].reverse().find((t) => t.action?.label === 'Deshacer');
    if (!toast) return false;
    this.runAction(toast);
    return true;
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

/** Id de la zona de soltar de cada proyecto en la barra lateral (arrastrar tareas y notas). */
export const projectDropId = (projectId: Id) => `drop-project-${projectId}`;

/**
 * Estado compartido de la «capa de mando»: paleta de comandos, chuleta de atajos y
 * peticiones que el teclado hace a componentes concretos (enfocar la búsqueda, abrir
 * el selector de archivos). Las peticiones son contadores: cada incremento es una orden.
 */
@Injectable({ providedIn: 'root' })
export class CommandUiService {
  readonly paletteOpen = signal(false);
  readonly helpOpen = signal(false);
  readonly focusSearch = signal(0);
  readonly pickFiles = signal(0);
  /** Primera tecla de una combinación en curso (p. ej. «G»), para mostrarla en pantalla. */
  readonly pendingChord = signal<string | null>(null);
}

export interface ProjectTab {
  label: string;
  path: string;
}

/** Pestañas del proyecto abierto, para los atajos 1–4 y la paleta de comandos. */
@Injectable({ providedIn: 'root' })
export class ProjectContextService {
  readonly projectId = signal<Id | null>(null);
  readonly tabs = signal<ProjectTab[]>([]);
  readonly section = signal<string>('');
}
