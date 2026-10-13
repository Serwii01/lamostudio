import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TASK_STATUS, TASK_STATUS_ORDER, TONE_FILL, isTaskDone } from '../../core/catalog';
import { Task, TaskStatus } from '../../core/models';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { TaskViewService, projectDropId } from '../../core/services/ui-state';
import { daysFromToday } from '../../core/utils/dates';
import { normalize } from '../../core/utils/text';
import { TaskQuickAdd } from '../../shared/task-quick-add';
import { TaskRow } from '../../shared/task-row';
import { TaskViewSwitch } from '../../shared/task-view-switch';
import { Icon } from '../../shared/ui/icon';

type View = 'all' | 'mine' | 'week' | 'unassigned' | 'blocked';

/** Vistas guardadas de la especificación: mis tareas, esta semana, sin responsable, bloqueadas. */
const VIEWS: { id: View; label: string; test: (t: Task, userId: string) => boolean }[] = [
  { id: 'all', label: 'Todas', test: () => true },
  { id: 'mine', label: 'Mías', test: (t, userId) => t.assigneeId === userId },
  { id: 'week', label: 'Esta semana', test: (t) => !!t.dueAt && daysFromToday(t.dueAt) < 7 },
  { id: 'unassigned', label: 'Sin responsable', test: (t) => !t.assigneeId },
  { id: 'blocked', label: 'Bloqueadas', test: (t) => !!t.blocked },
];

/**
 * Lista de tareas agrupada por estado. Las filas se arrastran entre grupos (cambia
 * el estado, como en el tablero) o sobre un proyecto de la barra lateral (se mueve).
 * Los cuatro grupos están siempre presentes para poder soltar en cualquiera.
 */
@Component({
  selector: 'app-task-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder, TaskQuickAdd, TaskRow, TaskViewSwitch, Icon],
  template: `
    <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
      @if (canEdit()) {
        <app-task-quick-add class="flex-1" [projectId]="projectId()" />
      } @else {
        <span class="flex-1"></span>
      }
      <app-task-view-switch current="tareas" />
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-2">
      @for (v of views; track v.id) {
        <button class="chip" [class.chip-active]="view() === v.id" (click)="view.set(v.id)">{{ v.label }}</button>
      }
      <label class="relative ml-auto w-full sm:w-56">
        <span class="sr-only">Buscar en tareas</span>
        <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
        <input class="input h-8 rounded-full pl-9" placeholder="Buscar…" [(ngModel)]="query" />
      </label>
    </div>

    @if (canEdit()) {
      <p class="hand mt-4 text-sm">
        Arrastra una fila a otro grupo para cambiar su estado<span class="hidden lg:inline">, o a un proyecto de la izquierda para moverla</span>.
      </p>
    }

    <div class="mt-3 space-y-4" cdkDropListGroup>
      @for (g of groups(); track g.status) {
        <section class="card overflow-hidden">
          <h2 class="flex items-center gap-2 border-b border-line/60 px-5 py-3.5 font-display font-bold">
            <span class="size-2 rounded-full" [class]="fill[status[g.status].tone]"></span>
            {{ status[g.status].label }}
            <span class="count">{{ g.count }}</span>
            @if (g.status === 'done') {
              <button class="ml-auto cursor-pointer font-sans text-xs font-normal text-ink-soft hover:text-ink" (click)="showDone.set(!showDone())">
                {{ showDone() ? 'Ocultar' : 'Mostrar' }}
              </button>
            }
          </h2>
          <div
            cdkDropList
            [cdkDropListData]="g.status"
            [cdkDropListConnectedTo]="sidebarDrops()"
            [cdkDropListDisabled]="!canEdit()"
            (cdkDropListDropped)="drop($event)"
            class="min-h-12 divide-y divide-line/60"
          >
            @for (t of g.tasks; track t.id) {
              <app-task-row
                cdkDrag
                [cdkDragData]="t"
                [cdkDragDisabled]="!canEdit()"
                [task]="t"
                [showStatus]="false"
                [draggable]="canEdit()"
                class="bg-surface"
              >
                <div *cdkDragPlaceholder class="h-12 border-y-[1.5px] border-dashed border-shu/50 bg-shu/5"></div>
              </app-task-row>
            } @empty {
              <p class="hand px-5 py-3 text-sm text-ink-faint">
                {{ g.status === 'done' && g.count ? 'Ocultas · suelta aquí para completarla' : 'Nada aquí · suelta tareas para moverlas' }}
              </p>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class TaskList {
  readonly projectId = input.required<string>();

  constructor() {
    inject(TaskViewService).set('tareas');
  }

  protected readonly session = inject(SessionService);
  private readonly tasks = inject(TaskService);
  private readonly projects = inject(ProjectService);

  protected readonly views = VIEWS;
  protected readonly status = TASK_STATUS;
  protected readonly fill = TONE_FILL;
  protected readonly view = signal<View>('all');
  protected readonly showDone = signal(false);
  protected readonly query = signal('');
  protected readonly canEdit = computed(() => this.session.can('task.edit'));

  /** Zonas de la barra lateral donde soltar para mover la tarea a otro proyecto. */
  protected readonly sidebarDrops = computed(() =>
    this.projects
      .active()
      .filter((p) => p.id !== this.projectId())
      .map((p) => projectDropId(p.id)),
  );

  protected readonly groups = computed(() => {
    const view = VIEWS.find((v) => v.id === this.view())!;
    const userId = this.session.currentUserId();
    const q = normalize(this.query());
    const matching = this.tasks
      .byProject(this.projectId())
      .filter((t) => view.test(t, userId) && (!q || normalize(`${t.title} ${t.tags.join(' ')}`).includes(q)));
    return TASK_STATUS_ORDER.map((status: TaskStatus) => {
      const all = matching.filter((t) => t.status === status);
      const hidden = isTaskDone(status) && !this.showDone();
      return { status, count: all.length, tasks: hidden ? [] : all };
    });
  });

  protected drop(event: CdkDragDrop<TaskStatus>): void {
    const task = event.item.data as Task;
    const target = event.container.data;
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) return;
    const visible = this.groups().find((g) => g.status === target)!.tasks.map((t) => t.id).filter((id) => id !== task.id);
    visible.splice(event.currentIndex, 0, task.id);
    // Las tareas ocultas por el filtro conservan su orden relativo, detrás de las visibles.
    const hidden = this.tasks
      .byProject(this.projectId())
      .filter((t) => t.status === target && !visible.includes(t.id))
      .map((t) => t.id);
    void this.tasks.move(task, target, [...visible, ...hidden]);
  }
}
