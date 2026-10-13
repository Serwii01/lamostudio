import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { isTaskDone } from '../../core/catalog';
import { Task } from '../../core/models';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { daysFromToday } from '../../core/utils/dates';
import { TaskRow } from '../../shared/task-row';
import { Empty } from '../../shared/ui/badge';

interface Group {
  id: string;
  label: string;
  tasks: Task[];
}

@Component({
  selector: 'app-my-tasks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TaskRow, Empty],
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">Todos los proyectos</p>
        <h1 class="page-title mt-2">Mis tareas</h1>
        <p class="hand mt-2 text-base">{{ openCount() }} abiertas a tu nombre, ordenadas por fecha.</p>
      </div>
      <label class="flex cursor-pointer items-center gap-2 text-ink-soft">
        <input type="checkbox" class="size-4 accent-ink" [checked]="showDone()" (change)="showDone.set(!showDone())" />
        Mostrar completadas
      </label>
    </header>

    <div class="mt-6 space-y-6">
      @for (g of groups(); track g.id) {
        <section class="card overflow-hidden">
          <h2 class="flex items-center gap-2 border-b border-line/60 px-5 py-3.5 font-display font-bold">
            {{ g.label }}
            <span class="count">{{ g.tasks.length }}</span>
          </h2>
          <div class="divide-y divide-line/60">
            @for (t of g.tasks; track t.id) {
              <app-task-row [task]="t" [showProject]="true" />
            }
          </div>
        </section>
      } @empty {
        <div class="card">
          <app-empty title="No tienes tareas asignadas" hint="Cuando alguien te asigne una tarea aparecerá aquí, agrupada por fecha." doodle="mountain" />
        </div>
      }
    </div>
  `,
})
export class MyTasks {
  protected readonly session = inject(SessionService);
  private readonly tasks = inject(TaskService);
  private readonly projects = inject(ProjectService);

  protected readonly showDone = signal(false);

  private readonly mine = computed(() => {
    const userId = this.session.currentUserId();
    const visible = new Set(this.projects.visible().map((p) => p.id));
    return this.tasks
      .all()
      .filter((t) => t.assigneeId === userId && visible.has(t.projectId))
      .sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'));
  });

  protected readonly openCount = computed(() => this.mine().filter((t) => !isTaskDone(t.status)).length);

  protected readonly groups = computed<Group[]>(() => {
    const buckets: Group[] = [
      { id: 'overdue', label: 'Vencidas', tasks: [] },
      { id: 'today', label: 'Hoy', tasks: [] },
      { id: 'week', label: 'Próximos 7 días', tasks: [] },
      { id: 'later', label: 'Más adelante', tasks: [] },
      { id: 'none', label: 'Sin fecha', tasks: [] },
      { id: 'done', label: 'Completadas', tasks: [] },
    ];
    const [overdue, today, week, later, none, done] = buckets;
    for (const t of this.mine()) {
      if (isTaskDone(t.status)) {
        if (this.showDone()) done.tasks.push(t);
        continue;
      }
      if (!t.dueAt) {
        none.tasks.push(t);
        continue;
      }
      const days = daysFromToday(t.dueAt);
      (days < 0 ? overdue : days === 0 ? today : days < 7 ? week : later).tasks.push(t);
    }
    return buckets.filter((b) => b.tasks.length);
  });
}
