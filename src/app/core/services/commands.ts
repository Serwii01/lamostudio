import { Injectable, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TASK_STATUS, TASK_STATUS_ORDER } from '../catalog';
import { Id, Task, TaskStatus } from '../models';
import { ProjectService } from './projects';
import { SessionService } from './session';
import { TaskService } from './tasks';
import {
  CommandUiService,
  NewTaskService,
  ProjectContextService,
  QuickCaptureService,
  TaskPanelService,
  TaskViewService,
} from './ui-state';

export interface Command {
  id: string;
  label: string;
  group: string;
  icon: string;
  /** Atajo en el formato de core/shortcuts.ts, para mostrarlo como pista. */
  keys?: string;
  run: () => void;
}

/** Secciones a las que se llega con «G + letra». */
export const GO_TO: Record<string, { path: string; label: string; icon: string }> = {
  i: { path: '/', label: 'Inicio', icon: 'home' },
  t: { path: '/tareas', label: 'Tareas', icon: 'check-square' },
  p: { path: '/proyectos', label: 'Proyectos', icon: 'folder' },
  n: { path: '/notas', label: 'Notas', icon: 'note' },
  b: { path: '/biblioteca', label: 'Biblioteca', icon: 'image' },
  e: { path: '/equipo', label: 'Equipo', icon: 'users' },
};

/**
 * Todas las acciones que se pueden lanzar desde el teclado o la paleta de comandos.
 * Tenerlas en un solo sitio garantiza que un atajo y su entrada en la paleta hagan
 * exactamente lo mismo.
 */
@Injectable({ providedIn: 'root' })
export class CommandsService {
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly projects = inject(ProjectService);
  private readonly tasks = inject(TaskService);
  private readonly panel = inject(TaskPanelService);
  private readonly newTaskDialog = inject(NewTaskService);
  private readonly capture = inject(QuickCaptureService);
  private readonly ui = inject(CommandUiService);
  private readonly context = inject(ProjectContextService);
  private readonly taskView = inject(TaskViewService);

  // --- Crear y navegar -------------------------------------------------------

  newTask(): void {
    if (this.session.can('task.edit') && this.projects.active().length) this.newTaskDialog.open();
  }

  newNote(): void {
    if (this.session.can('note.create')) this.capture.open();
  }

  newProject(): void {
    if (this.session.can('project.create')) void this.router.navigate(['/proyectos/nuevo']);
  }

  search(): void {
    this.ui.focusSearch.update((n) => n + 1);
  }

  help(): void {
    this.ui.helpOpen.set(true);
  }

  goTo(path: string): void {
    void this.router.navigate([path]);
  }

  /** «U»: abre el selector de archivos donde tenga sentido, o lleva a donde se pueda subir. */
  uploadFiles(): void {
    if (!this.session.can('task.edit')) return;
    const projectId = this.context.projectId();
    const onFilesPage = this.router.url.startsWith('/biblioteca') || this.context.section() === 'archivos';
    if (onFilesPage) {
      this.ui.pickFiles.update((n) => n + 1);
    } else if (projectId && this.projects.byId(projectId)?.moduleIds.includes('files')) {
      void this.router.navigate(['/proyectos', projectId, 'archivos']).then(() => this.ui.pickFiles.update((n) => n + 1));
    } else {
      void this.router.navigate(['/biblioteca']).then(() => this.ui.pickFiles.update((n) => n + 1));
    }
  }

  projectTab(index: number): void {
    const projectId = this.context.projectId();
    const tab = this.context.tabs()[index];
    if (projectId && tab) void this.router.navigate(['/proyectos', projectId, tab.path]);
  }

  toggleTaskView(): void {
    const projectId = this.context.projectId();
    if (!projectId) return;
    const section = this.context.section();
    const next = section === 'tareas' ? 'tablero' : section === 'tablero' ? 'tareas' : this.taskView.view();
    void this.router.navigate(['/proyectos', projectId, next]);
  }

  // --- Tareas ---------------------------------------------------------------

  /** Tarea abierta en el panel o, si no hay, la seleccionada con el foco. */
  targetTask(): Task | undefined {
    return this.tasks.byId(this.panel.openId()) ?? this.tasks.byId(focusedTaskId());
  }

  setStatus(task: Task, status: TaskStatus): void {
    if (this.session.can('task.edit') && task.status !== status) void this.tasks.update(task, { status });
  }

  toggleDone(task: Task): void {
    if (this.session.can('task.edit')) void this.tasks.toggleDone(task);
  }

  toggleBlocked(task: Task): void {
    if (this.session.can('task.edit')) void this.tasks.update(task, { blocked: !task.blocked });
  }

  assignToMe(task: Task): void {
    if (this.session.can('task.edit')) void this.tasks.update(task, { assigneeId: this.session.currentUserId() });
  }

  remove(task: Task): void {
    if (!this.session.can('task.edit')) return;
    if (this.panel.openId() === task.id) this.panel.close();
    this.tasks.remove(task);
  }

  /** Shift+←/→ en el tablero: pasa la tarjeta a la columna vecina y conserva el foco. */
  moveColumn(task: Task, direction: -1 | 1): void {
    if (!this.session.can('task.edit')) return;
    const index = TASK_STATUS_ORDER.indexOf(task.status) + direction;
    const status = TASK_STATUS_ORDER[index];
    if (!status) return;
    const ids = this.tasks
      .byProject(task.projectId)
      .filter((t) => t.status === status && t.id !== task.id)
      .map((t) => t.id);
    void this.tasks.move(task, status, [...ids, task.id]).then(() => refocusTask(task.id));
  }

  /** J/K: mueve la selección (o, con el panel abierto, la tarea abierta) por la página. */
  step(direction: -1 | 1): void {
    const items = visibleTaskElements();
    if (!items.length) return;
    const openId = this.panel.openId();
    const currentId = openId ?? focusedTaskId();
    const index = items.findIndex((el) => el.dataset['taskId'] === currentId);
    const next = items[index < 0 ? (direction > 0 ? 0 : items.length - 1) : index + direction];
    if (!next) return;
    if (openId) {
      this.panel.open(next.dataset['taskId']!);
    } else {
      next.focus();
      next.scrollIntoView({ block: 'nearest' });
    }
  }

  // --- Lista para la paleta -----------------------------------------------------

  readonly commands = computed<Command[]>(() => {
    const list: Command[] = [];
    const can = (p: Parameters<SessionService['can']>[0]) => this.session.can(p);

    const open = this.tasks.byId(this.panel.openId());
    if (open) {
      const group = `Tarea: ${open.title.slice(0, 40)}`;
      TASK_STATUS_ORDER.forEach((status, i) => {
        if (status !== open.status && can('task.edit')) {
          list.push({ id: `status-${status}`, group, icon: 'check-square', keys: String(i + 1), label: `Mover a «${TASK_STATUS[status].label}»`, run: () => this.setStatus(open, status) });
        }
      });
      if (can('task.edit')) {
        list.push(
          { id: 'block', group, icon: 'lock', keys: 'B', label: open.blocked ? 'Desbloquear' : 'Marcar como bloqueada', run: () => this.toggleBlocked(open) },
          { id: 'assign-me', group, icon: 'users', keys: 'M', label: 'Asignármela', run: () => this.assignToMe(open) },
          { id: 'delete', group, icon: 'trash', keys: 'Supr', label: 'Eliminar tarea', run: () => this.remove(open) },
        );
      }
    }

    const projectId = this.context.projectId();
    const project = this.projects.byId(projectId ?? undefined);
    if (project) {
      const group = `Proyecto: ${project.name}`;
      this.context.tabs().forEach((tab, i) =>
        list.push({ id: `tab-${tab.path}`, group, icon: 'arrow-right', keys: String(i + 1), label: `Ir a ${tab.label}`, run: () => this.projectTab(i) }),
      );
      if (project.moduleIds.includes('tasks') || project.moduleIds.includes('kanban')) {
        list.push({ id: 'toggle-view', group, icon: 'kanban', keys: 'V', label: 'Alternar Lista y Tablero', run: () => this.toggleTaskView() });
      }
      if (can('project.manage')) {
        list.push({ id: 'project-settings', group, icon: 'settings', label: 'Ajustes del proyecto', run: () => void this.router.navigate(['/proyectos', project.id, 'configuracion']) });
      }
    }

    const create = 'Crear';
    if (can('task.edit')) list.push({ id: 'new-task', group: create, icon: 'plus', keys: 'T', label: 'Nueva tarea', run: () => this.newTask() });
    if (can('note.create')) list.push({ id: 'new-note', group: create, icon: 'pen', keys: 'N', label: 'Nota rápida', run: () => this.newNote() });
    if (can('project.create')) list.push({ id: 'new-project', group: create, icon: 'folder', keys: 'P', label: 'Nuevo proyecto', run: () => this.newProject() });
    if (can('task.edit')) list.push({ id: 'upload', group: create, icon: 'upload', keys: 'U', label: 'Subir archivos', run: () => this.uploadFiles() });

    for (const [key, target] of Object.entries(GO_TO)) {
      if (target.path === '/equipo' && !can('team.viewLoad')) continue;
      list.push({ id: `go-${key}`, group: 'Ir a', icon: target.icon, keys: `G ${key.toUpperCase()}`, label: target.label, run: () => this.goTo(target.path) });
    }
    if (can('project.manage')) list.push({ id: 'go-settings', group: 'Ir a', icon: 'settings', label: 'Configuración del estudio', run: () => this.goTo('/configuracion') });

    list.push(
      { id: 'search', group: 'Ayuda', icon: 'search', keys: '/', label: 'Buscar proyectos, tareas o notas', run: () => this.search() },
      { id: 'help', group: 'Ayuda', icon: 'bolt', keys: '?', label: 'Ver todos los atajos de teclado', run: () => this.help() },
    );
    return list;
  });
}

// --- Utilidades de foco ---------------------------------------------------------

/** Filas y tarjetas de tareas visibles en la página, en orden de lectura. */
export function visibleTaskElements(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('main [data-task-id]')].filter((el) => el.offsetParent !== null);
}

export function focusedTaskId(): Id | undefined {
  const el = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>('[data-task-id]') : null;
  return el?.dataset['taskId'];
}

function refocusTask(id: Id): void {
  setTimeout(() => document.querySelector<HTMLElement>(`main [data-task-id="${CSS.escape(id)}"]`)?.focus(), 60);
}

