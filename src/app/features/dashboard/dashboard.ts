import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PROJECT_STATUS, Tone, isTaskDone } from '../../core/catalog';
import { ActivityService } from '../../core/services/activity';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { daysFromToday, formatLongDate, formatShortDate, relativeDue } from '../../core/utils/dates';
import { firstName } from '../../core/utils/text';
import { ActivityFeed } from '../../shared/activity-feed';
import { TaskRow } from '../../shared/task-row';
import { Avatar } from '../../shared/ui/avatar';
import { Badge, Empty, Progress } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';

type Period = 'week' | 'month' | 'all';

const PERIODS: { id: Period; label: string; days: number }[] = [
  { id: 'week', label: 'Esta semana', days: 7 },
  { id: 'month', label: 'Este mes', days: 30 },
  { id: 'all', label: 'Todo', days: Infinity },
];

interface Alert {
  tone: Tone;
  icon: string;
  text: string;
  link: unknown[];
}

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ActivityFeed, TaskRow, Avatar, Badge, Empty, Icon, Progress],
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">{{ session.workspace().cycle }} · {{ today }}</p>
        <h1 class="page-title mt-1">{{ greeting() }}</h1>
      </div>
      <div class="flex gap-1.5" role="group" aria-label="Periodo">
        @for (p of periods; track p.id) {
          <button class="chip" [class.chip-active]="period() === p.id" (click)="period.set(p.id)">{{ p.label }}</button>
        }
      </div>
    </header>

    <!-- Métricas -->
    <section class="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <div class="card p-4">
        <p class="text-ink-soft">Proyectos activos</p>
        <p class="mt-2 font-display text-3xl font-semibold">{{ projects.active().length }}</p>
        <p class="mt-1 text-xs text-ink-faint">{{ projects.visible().length }} en total</p>
      </div>
      <div class="card p-4">
        <p class="text-ink-soft">Pendiente de revisión</p>
        <p class="mt-2 font-display text-3xl font-semibold text-honey">{{ metrics().review }}</p>
        <p class="mt-1 text-xs text-ink-faint">tareas esperando feedback</p>
      </div>
      <div class="card p-4">
        <p class="text-ink-soft">Vencidas</p>
        <p class="mt-2 font-display text-3xl font-semibold" [class.text-coral]="metrics().overdue > 0">{{ metrics().overdue }}</p>
        <p class="mt-1 text-xs text-ink-faint">{{ metrics().blocked }} {{ metrics().blocked === 1 ? 'bloqueada' : 'bloqueadas' }}</p>
      </div>
      @if (session.can('team.viewLoad')) {
        <div class="card p-4">
          <p class="text-ink-soft">Carga del equipo</p>
          <p class="mt-2 font-display text-3xl font-semibold" [class.text-coral]="metrics().load > 1">
            {{ percent(metrics().load) }}
          </p>
          <app-progress class="mt-2" [value]="metrics().load" [tone]="metrics().load > 1 ? 'coral' : metrics().load > 0.8 ? 'honey' : 'moss'" />
          <p class="mt-1.5 text-xs text-ink-faint">{{ metrics().hours }} h de {{ metrics().capacity }} h esta semana</p>
        </div>
      }
      <div class="card p-4" [class]="session.can('team.viewLoad') ? 'col-span-2 md:col-span-1' : ''">
        <p class="text-ink-soft">Cumplimiento</p>
        <p class="mt-2 font-display text-3xl font-semibold">{{ percent(metrics().completion) }}</p>
        <app-progress class="mt-2" [value]="metrics().completion" />
        <p class="mt-1.5 text-xs text-ink-faint">tareas completadas</p>
      </div>
    </section>

    <div class="mt-6 grid gap-6 lg:grid-cols-3">
      <!-- Entregas críticas -->
      <section class="card overflow-hidden lg:col-span-2">
        <header class="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 class="font-display text-lg font-semibold">Entregas críticas</h2>
          <a routerLink="/mis-tareas" class="text-xs text-ink-soft hover:text-ink">Mis tareas →</a>
        </header>
        <div class="divide-y divide-line-soft">
          @for (t of critical(); track t.id) {
            <app-task-row [task]="t" [showProject]="true" />
          } @empty {
            <app-empty title="Nada urgente en este periodo" hint="No hay tareas abiertas con fecha en el rango seleccionado." />
          }
        </div>
      </section>

      <!-- Alertas -->
      <section class="card">
        <header class="border-b border-line px-4 py-3">
          <h2 class="font-display text-lg font-semibold">Alertas</h2>
        </header>
        <ul class="divide-y divide-line-soft">
          @for (a of alerts(); track a.text) {
            <li>
              <a [routerLink]="a.link" class="flex items-start gap-3 px-4 py-3 hover:bg-line-soft/60">
                <span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg" [class]="alertClass(a.tone)">
                  <app-icon [name]="a.icon" [size]="14" />
                </span>
                <span class="leading-snug">{{ a.text }}</span>
              </a>
            </li>
          } @empty {
            <li><app-empty title="Todo en orden" hint="Sin retrasos, bloqueos ni sobrecargas." /></li>
          }
        </ul>
      </section>
    </div>

    <!-- Tabla de proyectos -->
    <section class="card mt-6 overflow-hidden">
      <header class="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 class="font-display text-lg font-semibold">Proyectos</h2>
        <a routerLink="/proyectos" class="text-xs text-ink-soft hover:text-ink">Ver todos →</a>
      </header>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[720px] text-left">
          <thead class="text-xs text-ink-faint">
            <tr class="border-b border-line-soft">
              <th class="px-4 py-2.5 font-medium">Proyecto</th>
              <th class="px-4 py-2.5 font-medium">Estado</th>
              <th class="px-4 py-2.5 font-medium">Progreso</th>
              <th class="px-4 py-2.5 font-medium">Responsable</th>
              <th class="px-4 py-2.5 font-medium">Próxima fecha</th>
              <th class="px-4 py-2.5 font-medium">Entrega</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line-soft">
            @for (p of projects.active(); track p.id) {
              <tr class="hover:bg-line-soft/50">
                <td class="px-4 py-3">
                  <a [routerLink]="['/proyectos', p.id]" class="flex items-center gap-2.5">
                    <span class="size-2.5 shrink-0 rounded-sm" [style.background]="p.cover"></span>
                    <span>
                      <span class="block font-medium hover:underline">{{ p.name }}</span>
                      <span class="block text-xs text-ink-faint">{{ p.client ?? 'Interno' }}</span>
                    </span>
                  </a>
                </td>
                <td class="px-4 py-3">
                  <app-badge [tone]="statusOf(p.status).tone">{{ statusOf(p.status).label }}</app-badge>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2.5">
                    <app-progress class="w-24" [value]="projects.statsFor(p.id).progress" />
                    <span class="text-xs text-ink-soft tabular-nums">{{ percent(projects.statsFor(p.id).progress) }}</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span class="flex items-center gap-2">
                    <app-avatar [member]="session.member(p.ownerId)" [size]="22" />
                    <span class="text-ink-soft">{{ session.member(p.ownerId)?.name }}</span>
                  </span>
                </td>
                <td class="px-4 py-3 text-ink-soft" [class.!text-coral]="isPast(projects.statsFor(p.id).nextDue)">
                  {{ relative(projects.statsFor(p.id).nextDue) }}
                </td>
                <td class="px-4 py-3 text-ink-soft">{{ short(p.dueAt) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="card mt-6 p-4">
      <h2 class="mb-4 font-display text-lg font-semibold">Actividad reciente</h2>
      <app-activity-feed [entries]="recentActivity()" [showProject]="true" />
    </section>
  `,
})
export class Dashboard {
  protected readonly session = inject(SessionService);
  protected readonly projects = inject(ProjectService);
  private readonly tasks = inject(TaskService);
  private readonly activity = inject(ActivityService);

  protected readonly periods = PERIODS;
  protected readonly period = signal<Period>('week');
  protected readonly today = formatLongDate();

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const salute = hour < 13 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches';
    return `${salute}, ${firstName(this.session.currentUser().name)}`;
  });

  private readonly visibleTasks = computed(() => {
    const ids = new Set(this.projects.active().map((p) => p.id));
    return this.tasks.all().filter((t) => ids.has(t.projectId));
  });

  private readonly openTasks = computed(() => this.visibleTasks().filter((t) => !isTaskDone(t.status)));

  protected readonly metrics = computed(() => {
    const open = this.openTasks();
    const team = this.session.members().filter((m) => m.weeklyCapacity > 0);
    const load = this.tasks.weeklyLoad();
    const hours = team.reduce((sum, m) => sum + (load.get(m.id) ?? 0), 0);
    const capacity = team.reduce((sum, m) => sum + m.weeklyCapacity, 0);
    const all = this.visibleTasks();
    return {
      review: open.filter((t) => t.status === 'review').length,
      overdue: open.filter((t) => t.dueAt && daysFromToday(t.dueAt) < 0).length,
      blocked: open.filter((t) => t.status === 'blocked').length,
      hours,
      capacity,
      load: capacity ? hours / capacity : 0,
      completion: all.length ? (all.length - open.length) / all.length : 0,
    };
  });

  protected readonly critical = computed(() => {
    const horizon = PERIODS.find((p) => p.id === this.period())!.days;
    return this.openTasks()
      .filter((t) => t.dueAt && daysFromToday(t.dueAt) < horizon)
      .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
      .slice(0, 8);
  });

  protected readonly alerts = computed<Alert[]>(() => {
    const alerts: Alert[] = [];
    for (const p of this.projects.active()) {
      const s = this.projects.statsFor(p.id);
      if (s.overdue) {
        alerts.push({
          tone: 'coral',
          icon: 'alert',
          text: `${s.overdue} ${s.overdue === 1 ? 'tarea vencida' : 'tareas vencidas'} en ${p.name}`,
          link: ['/proyectos', p.id, 'tareas'],
        });
      }
      if (s.blocked) {
        alerts.push({
          tone: 'honey',
          icon: 'lock',
          text: `${s.blocked} ${s.blocked === 1 ? 'tarea bloqueada' : 'tareas bloqueadas'} en ${p.name}`,
          link: ['/proyectos', p.id, 'tareas'],
        });
      }
    }
    // La carga interna del estudio no se muestra a clientes ni invitados.
    if (!this.session.can('team.viewLoad')) return alerts;
    const load = this.tasks.weeklyLoad();
    for (const m of this.session.members()) {
      const hours = load.get(m.id) ?? 0;
      if (m.weeklyCapacity > 0 && hours > m.weeklyCapacity) {
        alerts.push({
          tone: 'plum',
          icon: 'users',
          text: `${m.name} tiene ${hours} h planificadas esta semana para ${m.weeklyCapacity} h disponibles`,
          link: ['/equipo'],
        });
      }
    }
    return alerts;
  });

  protected readonly recentActivity = computed(() => {
    const ids = new Set(this.projects.visible().map((p) => p.id));
    return this.activity
      .entries()
      .filter((e) => !e.projectId || ids.has(e.projectId))
      .slice(0, 8);
  });

  protected statusOf(status: keyof typeof PROJECT_STATUS) {
    return PROJECT_STATUS[status];
  }

  protected alertClass(tone: Tone): string {
    return { coral: 'bg-coral-soft text-coral', honey: 'bg-honey-soft text-honey', plum: 'bg-plum-soft text-plum' }[
      tone as 'coral' | 'honey' | 'plum'
    ];
  }

  protected percent(value: number): string {
    return `${Math.round(value * 100)} %`;
  }

  protected relative(iso?: string): string {
    return relativeDue(iso);
  }

  protected short(iso?: string): string {
    return formatShortDate(iso);
  }

  protected isPast(iso?: string): boolean {
    return !!iso && daysFromToday(iso) < 0;
  }
}
