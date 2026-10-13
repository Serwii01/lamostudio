import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { isTaskDone } from '../../core/catalog';
import { Task } from '../../core/models';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { NewTaskService } from '../../core/services/ui-state';
import { daysFromToday } from '../../core/utils/dates';
import { TaskRow } from '../../shared/task-row';
import { Empty } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';

interface Group {
  id: string;
  label: string;
  tasks: Task[];
}

type Filter = 'todas' | 'retraso' | 'revision' | 'bloqueadas' | 'sin-responsable';

const FILTERS: { id: Filter; label: string; test: (t: Task) => boolean }[] = [
  { id: 'todas', label: 'Todas', test: () => true },
  { id: 'retraso', label: 'Con retraso', test: (t) => !!t.dueAt && daysFromToday(t.dueAt) < 0 },
  { id: 'revision', label: 'Para revisar', test: (t) => t.status === 'review' },
  { id: 'bloqueadas', label: 'Bloqueadas', test: (t) => !!t.blocked },
  { id: 'sin-responsable', label: 'Sin responsable', test: (t) => !t.assigneeId },
];

/**
 * Todas las tareas de todos los proyectos, agrupadas por fecha.
 * «de» y «filtro» llegan como parámetros de la URL (?de=equipo&filtro=retraso),
 * así cualquier enlace (por ejemplo, las métricas del inicio) abre la vista exacta.
 */
@Component({
  selector: 'app-my-tasks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TaskRow, Empty, Icon],
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">Todos los proyectos</p>
        <h1 class="page-title mt-2">Tareas</h1>
        <p class="hand mt-2 text-base">{{ subtitle() }}</p>
      </div>
      <div class="inline-flex rounded-full border border-line bg-surface p-0.5" role="group" aria-label="De quién">
        <a
          routerLink="."
          [queryParams]="{ de: null }"
          queryParamsHandling="merge"
          class="inline-flex h-8 items-center rounded-full px-4 text-xs font-medium transition-colors"
          [class]="scope() === 'mias' ? 'bg-ink text-surface' : 'text-ink-soft hover:text-ink'"
          >Mías</a
        >
        <a
          routerLink="."
          [queryParams]="{ de: 'equipo' }"
          queryParamsHandling="merge"
          class="inline-flex h-8 items-center rounded-full px-4 text-xs font-medium transition-colors"
          [class]="scope() === 'equipo' ? 'bg-ink text-surface' : 'text-ink-soft hover:text-ink'"
          >Todo el equipo</a
        >
      </div>
    </header>

    <div class="mt-6 flex flex-wrap items-center gap-2">
      @for (f of filters; track f.id) {
        @if (f.id !== 'sin-responsable' || scope() === 'equipo') {
          <a
            routerLink="."
            [queryParams]="{ filtro: f.id === 'todas' ? null : f.id }"
            queryParamsHandling="merge"
            class="chip"
            [class.chip-active]="filter() === f.id"
          >
            {{ f.label }}
            @if (f.id !== 'todas' && counts()[f.id]; as n) {
              <span class="opacity-60">{{ n }}</span>
            }
          </a>
        }
      }
      <label class="ml-auto flex cursor-pointer items-center gap-2 text-ink-soft">
        <input type="checkbox" class="size-4 accent-ink" [checked]="showDone()" (change)="showDone.set(!showDone())" />
        Ver hechas
      </label>
    </div>

    <div class="mt-6 space-y-6">
      @for (g of groups(); track g.id) {
        <section class="card overflow-hidden">
          <h2 class="flex items-center gap-2 border-b border-line/60 px-5 py-3.5 font-display font-bold" [class.text-coral]="g.id === 'overdue'">
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
          @if (filter() !== 'todas') {
            <app-empty title="Nada por aquí" hint="No hay tareas con este filtro. Buena señal." doodle="mountain">
              <a routerLink="." [queryParams]="{ filtro: null }" queryParamsHandling="merge" class="btn btn-outline">Ver todas</a>
            </app-empty>
          } @else {
            <app-empty
              [title]="scope() === 'mias' ? 'No tienes tareas pendientes' : 'El equipo no tiene tareas pendientes'"
              hint="Cuando haya trabajo aparecerá aquí, ordenado por fecha."
              doodle="mountain"
            >
              @if (session.can('task.edit')) {
                <button class="btn btn-primary" (click)="newTask.open()"><app-icon name="plus" /> Nueva tarea</button>
              }
            </app-empty>
          }
        </div>
      }
    </div>
  `,
})
export class MyTasks {
  /** Parámetro de URL: «equipo» para ver las de todos; vacío para las mías. */
  readonly de = input<string>();
  /** Parámetro de URL con el filtro activo. */
  readonly filtro = input<string>();

  protected readonly session = inject(SessionService);
  protected readonly newTask = inject(NewTaskService);
  private readonly tasks = inject(TaskService);
  private readonly projects = inject(ProjectService);

  protected readonly filters = FILTERS;
  protected readonly showDone = signal(false);

  protected readonly scope = computed(() => (this.de() === 'equipo' ? 'equipo' : 'mias'));
  protected readonly filter = computed<Filter>(() => FILTERS.find((f) => f.id === this.filtro())?.id ?? 'todas');

  /** Tareas abiertas del ámbito elegido, antes de aplicar el filtro. */
  private readonly scoped = computed(() => {
    const userId = this.session.currentUserId();
    const visible = new Set(this.projects.visible().map((p) => p.id));
    return this.tasks
      .all()
      .filter((t) => visible.has(t.projectId) && (this.scope() === 'equipo' || t.assigneeId === userId))
      .sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'));
  });

  protected readonly counts = computed(() => {
    const open = this.scoped().filter((t) => !isTaskDone(t.status));
    return Object.fromEntries(FILTERS.map((f) => [f.id, open.filter(f.test).length])) as Record<Filter, number>;
  });

  protected readonly subtitle = computed(() => {
    const n = this.counts().todas;
    const who = this.scope() === 'mias' ? 'a tu nombre' : 'en el equipo';
    return n === 1 ? `1 tarea pendiente ${who}.` : `${n} tareas pendientes ${who}, ordenadas por fecha.`;
  });

  protected readonly groups = computed<Group[]>(() => {
    const test = FILTERS.find((f) => f.id === this.filter())!.test;
    const buckets: Group[] = [
      { id: 'overdue', label: 'Con retraso', tasks: [] },
      { id: 'today', label: 'Hoy', tasks: [] },
      { id: 'week', label: 'Próximos 7 días', tasks: [] },
      { id: 'later', label: 'Más adelante', tasks: [] },
      { id: 'none', label: 'Sin fecha', tasks: [] },
      { id: 'done', label: 'Hechas', tasks: [] },
    ];
    const [overdue, today, week, later, none, done] = buckets;
    for (const t of this.scoped()) {
      if (!test(t)) continue;
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
