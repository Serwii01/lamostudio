import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TASK_STATUS, TASK_STATUS_ORDER, TONE_FILL, isTaskDone } from '../../core/catalog';
import { Task, TaskStatus } from '../../core/models';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { daysFromToday } from '../../core/utils/dates';
import { normalize } from '../../core/utils/text';
import { TaskQuickAdd } from '../../shared/task-quick-add';
import { TaskRow } from '../../shared/task-row';
import { Empty } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';

type View = 'all' | 'mine' | 'week' | 'unassigned' | 'blocked';

/** Vistas guardadas de la especificación: mis tareas, esta semana, sin responsable, bloqueadas. */
const VIEWS: { id: View; label: string; test: (t: Task, userId: string) => boolean }[] = [
  { id: 'all', label: 'Todas', test: () => true },
  { id: 'mine', label: 'Mías', test: (t, userId) => t.assigneeId === userId },
  { id: 'week', label: 'Esta semana', test: (t) => !!t.dueAt && daysFromToday(t.dueAt) < 7 },
  { id: 'unassigned', label: 'Sin responsable', test: (t) => !t.assigneeId },
  { id: 'blocked', label: 'Bloqueadas', test: (t) => t.status === 'blocked' },
];

@Component({
  selector: 'app-task-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TaskQuickAdd, TaskRow, Empty, Icon],
  template: `
    @if (session.can('task.edit')) {
      <app-task-quick-add [projectId]="projectId()" />
    }

    <div class="mt-4 flex flex-wrap items-center gap-2">
      @for (v of views; track v.id) {
        <button class="chip" [class.chip-active]="view() === v.id" (click)="view.set(v.id)">{{ v.label }}</button>
      }
      <label class="ml-auto flex cursor-pointer items-center gap-2 text-ink-soft">
        <input type="checkbox" class="size-4 accent-ink" [checked]="showDone()" (change)="showDone.set(!showDone())" />
        Completadas
      </label>
      <label class="relative w-full sm:w-56">
        <span class="sr-only">Buscar en tareas</span>
        <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
        <input class="input h-8 pl-9" placeholder="Buscar…" [(ngModel)]="query" />
      </label>
    </div>

    <div class="mt-4 space-y-4">
      @for (g of groups(); track g.status) {
        <section class="card overflow-hidden">
          <h2 class="flex items-center gap-2 border-b border-line px-4 py-2.5 font-medium">
            <span class="size-2 rounded-full" [class]="fill[status[g.status].tone]"></span>
            {{ status[g.status].label }}
            <span class="rounded-full bg-line-soft px-2 text-xs text-ink-soft">{{ g.tasks.length }}</span>
          </h2>
          <div class="divide-y divide-line-soft">
            @for (t of g.tasks; track t.id) {
              <app-task-row [task]="t" />
            }
          </div>
        </section>
      } @empty {
        <div class="card">
          <app-empty title="No hay tareas en esta vista" hint="Cambia el filtro o añade una tarea nueva arriba." />
        </div>
      }
    </div>
  `,
})
export class TaskList {
  readonly projectId = input.required<string>();

  protected readonly session = inject(SessionService);
  private readonly tasks = inject(TaskService);

  protected readonly views = VIEWS;
  protected readonly status = TASK_STATUS;
  protected readonly fill = TONE_FILL;
  protected readonly view = signal<View>('all');
  protected readonly showDone = signal(false);
  protected readonly query = signal('');

  protected readonly groups = computed(() => {
    const view = VIEWS.find((v) => v.id === this.view())!;
    const userId = this.session.currentUserId();
    const q = normalize(this.query());
    const visible = this.tasks
      .byProject(this.projectId())
      .filter((t) => (this.showDone() || !isTaskDone(t.status)) && view.test(t, userId))
      .filter((t) => !q || normalize(`${t.title} ${t.tags.join(' ')}`).includes(q));
    return TASK_STATUS_ORDER.map((status: TaskStatus) => ({
      status,
      tasks: visible.filter((t) => t.status === status),
    })).filter((g) => g.tasks.length);
  });
}
