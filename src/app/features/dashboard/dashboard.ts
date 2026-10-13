import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PROJECT_STATUS, Tone, isTaskDone } from '../../core/catalog';
import { ProjectStatus } from '../../core/models';
import { ActivityService } from '../../core/services/activity';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { daysFromToday, formatLongDate, relativeDue } from '../../core/utils/dates';
import { firstName } from '../../core/utils/text';
import { ActivityFeed } from '../../shared/activity-feed';
import { TaskRow } from '../../shared/task-row';
import { Badge, Empty, Progress } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';
import { Enso } from '../../shared/ui/scribble';

/** Las «próximas tareas» del inicio: vencidas y las de las dos próximas semanas. */
const HORIZON_DAYS = 14;
const WELCOME_KEY = 'lamo-studio:welcome-dismissed';

type Scope = 'mine' | 'team';

interface Alert {
  tone: Tone;
  text: string;
  link: unknown[];
}

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ActivityFeed, TaskRow, Badge, Empty, Enso, Icon, Progress],
  template: `
    <header>
      <p class="eyebrow">{{ today }}</p>
      <h1 class="page-title mt-2">{{ greeting() }}</h1>
      <p class="hand mt-2 text-base">{{ summary() }}</p>
    </header>

    @if (showWelcome()) {
      <section class="card relative mt-8 overflow-hidden p-6 sm:p-7">
        <button class="btn btn-ghost absolute top-3 right-3 size-8 px-0" aria-label="Cerrar guía" (click)="dismissWelcome()">
          <app-icon name="x" />
        </button>
        <p class="hand text-base">Te damos la bienvenida a Lamo ✿</p>
        <h2 class="mt-1 font-display text-xl font-bold">Tres gestos y ya sabes usarlo</h2>
        <ol class="mt-5 grid gap-5 sm:grid-cols-3">
          <li class="flex gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-full border-2 border-shu font-hand text-lg font-semibold text-shu">1</span>
            <span>
              <span class="block font-medium">Crea un proyecto</span>
              <span class="text-ink-soft">Elige una plantilla y se activan solo las pestañas que necesitas.</span>
            </span>
          </li>
          <li class="flex gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-full border-2 border-shu font-hand text-lg font-semibold text-shu">2</span>
            <span>
              <span class="block font-medium">Apunta y sube</span>
              <span class="text-ink-soft">Pulsa <kbd class="kbd">N</kbd> para una nota o arrastra archivos a cualquier proyecto.</span>
            </span>
          </li>
          <li class="flex gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-full border-2 border-shu font-hand text-lg font-semibold text-shu">3</span>
            <span>
              <span class="block font-medium">Arrastra en el tablero</span>
              <span class="text-ink-soft">Mueve tarjetas entre columnas para cambiar su estado.</span>
            </span>
          </li>
        </ol>
        <div class="mt-6 flex flex-wrap gap-2">
          @if (session.can('project.create')) {
            <a routerLink="/proyectos/nuevo" class="btn btn-accent"><app-icon name="plus" /> Crear un proyecto</a>
          }
          <button class="btn btn-ghost" (click)="dismissWelcome()">Entendido</button>
        </div>
      </section>
    }

    <!-- Métricas -->
    <section class="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen">
      <a routerLink="/proyectos" class="card p-5 transition-colors hover:border-ink-faint">
        <p class="text-ink-soft">Proyectos activos</p>
        <p class="mt-3 font-display text-4xl font-bold">{{ projects.active().length }}</p>
      </a>
      <div class="card p-5">
        <p class="text-ink-soft">Para revisar</p>
        <p class="mt-3 font-display text-4xl font-bold" [class.text-honey]="metrics().review">{{ metrics().review }}</p>
      </div>
      <div class="card p-5">
        <p class="text-ink-soft">Con retraso</p>
        <p class="mt-3 font-display text-4xl font-bold" [class.text-coral]="metrics().overdue">{{ metrics().overdue }}</p>
        @if (metrics().blocked) {
          <p class="mt-1 text-xs text-ink-faint">y {{ metrics().blocked }} {{ metrics().blocked === 1 ? 'bloqueada' : 'bloqueadas' }}</p>
        }
      </div>
      @if (session.can('team.viewLoad')) {
        <a routerLink="/equipo" class="card p-5 transition-colors hover:border-ink-faint">
          <p class="text-ink-soft">Carga del equipo</p>
          <p class="mt-3 font-display text-4xl font-bold" [class.text-coral]="metrics().load > 1">{{ percent(metrics().load) }}</p>
          <app-progress class="mt-2" [value]="metrics().load" [tone]="metrics().load > 1 ? 'coral' : metrics().load > 0.8 ? 'honey' : 'moss'" [height]="4" />
        </a>
      } @else {
        <div class="card flex items-center gap-4 p-5">
          <app-enso [value]="metrics().completion" [size]="64" />
          <p class="text-ink-soft">Completado</p>
        </div>
      }
    </section>

    <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Próximas tareas -->
      <section class="card overflow-hidden lg:col-span-2">
        <header class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
          <h2 class="card-title">Próximas tareas</h2>
          <div class="flex gap-1" role="group" aria-label="De quién">
            <button class="chip h-7" [class.chip-active]="scope() === 'mine'" [attr.aria-pressed]="scope() === 'mine'" (click)="scope.set('mine')">Mías</button>
            <button class="chip h-7" [class.chip-active]="scope() === 'team'" [attr.aria-pressed]="scope() === 'team'" (click)="scope.set('team')">Todo el equipo</button>
          </div>
        </header>
        <div class="divide-y divide-line/60 border-t border-line/60">
          @for (t of upcoming(); track t.id) {
            <app-task-row [task]="t" [showProject]="true" />
          } @empty {
            <app-empty
              [title]="scope() === 'mine' ? 'Nada a tu nombre estas dos semanas' : 'Nada urgente en el equipo'"
              hint="Respira. Cuando haya entregas cerca aparecerán aquí."
              doodle="mountain"
            />
          }
        </div>
        @if (scope() === 'mine') {
          <a routerLink="/mis-tareas" class="block border-t border-line/60 px-5 py-3 text-xs text-ink-soft hover:text-ink">Ver todas mis tareas →</a>
        }
      </section>

      <!-- Atención -->
      <section class="card overflow-hidden">
        <header class="flex items-baseline gap-3 px-5 pt-5 pb-3">
          <h2 class="card-title">Atención</h2>
          @if (alerts().length) {
            <span class="count">{{ alerts().length }}</span>
          }
        </header>
        <ul class="divide-y divide-line/60 border-t border-line/60">
          @for (a of alerts(); track a.text) {
            <li>
              <a [routerLink]="a.link" class="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-ink/[0.03]">
                <span class="mt-1.5 size-2 shrink-0 rounded-full" [class]="dotClass(a.tone)"></span>
                <span class="leading-snug">{{ a.text }}</span>
              </a>
            </li>
          } @empty {
            <li><app-empty title="Todo en calma" hint="Sin retrasos, bloqueos ni sobrecargas." doodle="mountain" [compact]="true" /></li>
          }
        </ul>
      </section>
    </div>

    <!-- Proyectos -->
    <section class="mt-10">
      <header class="mb-4 flex items-baseline justify-between">
        <h2 class="card-title">Proyectos en marcha</h2>
        <a routerLink="/proyectos" class="text-xs text-ink-soft hover:text-ink">Ver todos →</a>
      </header>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        @for (p of projects.active(); track p.id) {
          <a [routerLink]="['/proyectos', p.id]" class="card flex items-center gap-4 p-4 transition-colors hover:border-ink-faint">
            <app-enso [value]="projects.statsFor(p.id).progress" [size]="48" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span class="size-2 shrink-0 rounded-full" [style.background]="p.cover"></span>
                <span class="truncate font-medium">{{ p.name }}</span>
              </span>
              <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                <app-badge [tone]="statusOf(p.status).tone" [dot]="false">{{ statusOf(p.status).label }}</app-badge>
                @if (projects.statsFor(p.id).nextDue; as next) {
                  <span [class.text-coral]="isPast(next)">próxima: {{ relative(next).toLowerCase() }}</span>
                }
              </span>
            </span>
          </a>
        } @empty {
          <div class="card sm:col-span-2 xl:col-span-3">
            <app-empty title="Aún no hay proyectos en marcha" hint="Crea el primero desde el botón «Nuevo proyecto»." />
          </div>
        }
      </div>
    </section>

    <section class="card mt-10 p-5">
      <h2 class="card-title mb-5">Qué ha pasado</h2>
      <app-activity-feed [entries]="recentActivity()" [showProject]="true" />
    </section>
  `,
})
export class Dashboard {
  protected readonly session = inject(SessionService);
  protected readonly projects = inject(ProjectService);
  private readonly tasks = inject(TaskService);
  private readonly activity = inject(ActivityService);

  protected readonly today = formatLongDate();
  protected readonly showWelcome = signal(!readFlag(WELCOME_KEY));
  protected readonly scope = signal<Scope>('mine');

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
    const total = this.visibleTasks().length;
    return {
      review: open.filter((t) => t.status === 'review').length,
      overdue: open.filter((t) => t.dueAt && daysFromToday(t.dueAt) < 0).length,
      blocked: open.filter((t) => t.blocked).length,
      load: capacity ? hours / capacity : 0,
      completion: total ? (total - open.length) / total : 0,
    };
  });

  /** Frase a mano que resume el día del usuario actual. */
  protected readonly summary = computed(() => {
    const mine = this.openTasks().filter((t) => t.assigneeId === this.session.currentUserId() && t.dueAt);
    const today = mine.filter((t) => daysFromToday(t.dueAt!) === 0).length;
    const late = mine.filter((t) => daysFromToday(t.dueAt!) < 0).length;
    if (!mine.length) return 'Hoy no tienes entregas asignadas. Buen momento para pensar.';
    const parts = [];
    if (late) parts.push(`${late} con retraso`);
    if (today) parts.push(`${today} para hoy`);
    return parts.length ? `Tienes ${parts.join(' y ')}. Paso a paso.` : 'Nada vence hoy. Ritmo tranquilo.';
  });

  protected readonly upcoming = computed(() => {
    const userId = this.session.currentUserId();
    return this.openTasks()
      .filter((t) => (this.scope() === 'team' || t.assigneeId === userId) && t.dueAt && daysFromToday(t.dueAt) < HORIZON_DAYS)
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
          text: `${s.overdue} ${s.overdue === 1 ? 'tarea con retraso' : 'tareas con retraso'} en ${p.name}`,
          link: ['/proyectos', p.id, 'tareas'],
        });
      }
      if (s.blocked) {
        alerts.push({
          tone: 'honey',
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
          text: `${firstName(m.name)} tiene ${hours} h planificadas para ${m.weeklyCapacity} h disponibles`,
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
      .slice(0, 5);
  });

  protected dismissWelcome(): void {
    this.showWelcome.set(false);
    try {
      localStorage.setItem(WELCOME_KEY, '1');
    } catch {
      // Solo se oculta durante esta sesión.
    }
  }

  protected statusOf(status: ProjectStatus) {
    return PROJECT_STATUS[status];
  }

  protected dotClass(tone: Tone): string {
    return { coral: 'bg-shu', honey: 'bg-honey', plum: 'bg-plum' }[tone as 'coral' | 'honey' | 'plum'];
  }

  protected percent(value: number): string {
    return `${Math.round(value * 100)} %`;
  }

  protected relative(iso: string): string {
    return relativeDue(iso);
  }

  protected isPast(iso: string): boolean {
    return daysFromToday(iso) < 0;
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
