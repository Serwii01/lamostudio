import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PROJECT_STATUS, Tone, isTaskDone } from '../../core/catalog';
import { ProjectStatus } from '../../core/models';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { daysFromToday, formatLongDate, relativeDue } from '../../core/utils/dates';
import { firstName } from '../../core/utils/text';
import { IS_MAC } from '../../core/shortcuts';
import { TaskRow } from '../../shared/task-row';
import { Empty } from '../../shared/ui/badge';

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
  imports: [RouterLink, TaskRow, Empty],
  template: `
    <header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h1 class="page-title">{{ greeting() }}</h1>
        <p class="hand mt-3 text-base">{{ summary() }}</p>
      </div>
      <p class="eyebrow pb-2">{{ today }}</p>
    </header>

    @if (showWelcome()) {
      <section class="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl bg-ink px-6 py-5 text-surface">
        <p class="text-xl font-light">Hola. Tres teclas y listo:</p>
        <ul class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li><kbd class="kbd">T</kbd> nueva tarea</li>
          <li><kbd class="kbd">N</kbd> apuntar una idea</li>
          <li><kbd class="kbd">{{ modKey }}</kbd> <kbd class="kbd">K</kbd> todo lo demás</li>
        </ul>
        <button class="btn btn-sm ml-auto bg-surface text-ink hover:bg-paper" (click)="dismissWelcome()">Entendido</button>
      </section>
    }

    <!-- Cifras: una franja, sin cajas -->
    <section class="mt-8 grid grid-cols-2 border-y border-line lg:grid-cols-4" aria-label="Resumen">
      <a routerLink="/proyectos" class="metric">
        <span class="metric-n">{{ projects.active().length }}</span>
        <span class="metric-l">proyectos en marcha</span>
      </a>
      <a routerLink="/tareas" [queryParams]="{ de: 'equipo', filtro: 'revision' }" class="metric border-l border-line">
        <span class="metric-n" [class.text-honey]="metrics().review">{{ metrics().review }}</span>
        <span class="metric-l">para revisar</span>
      </a>
      <a routerLink="/tareas" [queryParams]="{ de: 'equipo', filtro: 'retraso' }" class="metric border-line max-lg:border-t lg:border-l">
        <span class="metric-n" [class.text-coral]="metrics().overdue">{{ metrics().overdue }}</span>
        <span class="metric-l">con retraso{{ metrics().blocked ? ' · ' + metrics().blocked + ' bloqueadas' : '' }}</span>
      </a>
      @if (session.can('team.viewLoad')) {
        <a routerLink="/equipo" class="metric border-l border-line max-lg:border-t">
          <span class="metric-n" [class.text-coral]="metrics().load > 1">{{ percent(metrics().load) }}</span>
          <span class="metric-l">de carga del equipo</span>
        </a>
      } @else {
        <div class="metric border-l border-line max-lg:border-t">
          <span class="metric-n">{{ percent(metrics().completion) }}</span>
          <span class="metric-l">completado</span>
        </div>
      }
    </section>

    <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section class="card overflow-hidden lg:col-span-2">
        <header class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
          <h2 class="card-title">Lo próximo</h2>
          <div class="flex gap-1" role="group" aria-label="De quién">
            <button class="chip h-7" [class.chip-active]="scope() === 'mine'" [attr.aria-pressed]="scope() === 'mine'" (click)="scope.set('mine')">Mías</button>
            <button class="chip h-7" [class.chip-active]="scope() === 'team'" [attr.aria-pressed]="scope() === 'team'" (click)="scope.set('team')">Equipo</button>
          </div>
        </header>
        <div class="divide-y divide-line/60 border-t border-line/60">
          @for (t of upcoming(); track t.id) {
            <app-task-row [task]="t" [showProject]="true" />
          } @empty {
            <app-empty title="Nada urgente" hint="Dos semanas tranquilas." doodle="mountain" [compact]="true" />
          }
        </div>
        @if (scope() === 'mine' && upcoming().length) {
          <a routerLink="/tareas" class="block border-t border-line/60 px-5 py-3 text-xs text-ink-soft hover:text-ink">Ver todas →</a>
        }
      </section>

      <section class="card overflow-hidden">
        <header class="flex items-baseline gap-3 px-5 pt-5 pb-3">
          <h2 class="card-title">Ojo con</h2>
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
            <li><app-empty title="Todo en calma" doodle="mountain" [compact]="true" /></li>
          }
        </ul>
      </section>
    </div>

    <!-- Proyectos: bloques de color -->
    <section class="mt-10">
      <header class="mb-4 flex items-baseline justify-between">
        <h2 class="card-title">Proyectos</h2>
        <a routerLink="/proyectos" class="text-xs text-ink-soft hover:text-ink">Todos →</a>
      </header>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        @for (p of projects.active(); track p.id) {
          <a [routerLink]="['/proyectos', p.id]" class="card lift flex flex-col overflow-hidden">
            <span class="relative flex h-24 items-end justify-between px-4 pb-2" [style.background]="p.cover" aria-hidden="true">
              <span class="text-[64px] leading-[0.8] font-light tracking-[-0.05em] text-white/90">{{ p.name.charAt(0) }}</span>
              <span class="mb-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] text-ink tabular-nums">{{ percent(projects.statsFor(p.id).progress) }}</span>
            </span>
            <span class="flex flex-1 flex-col gap-1 p-4">
              <span class="leading-snug">{{ p.name }}</span>
              <span class="mt-auto text-xs text-ink-faint">
                @if (projects.statsFor(p.id).nextDue; as next) {
                  <span [class.text-coral]="isPast(next)">{{ relative(next) }}</span>
                } @else {
                  {{ statusOf(p.status).label }}
                }
              </span>
            </span>
          </a>
        } @empty {
          <div class="card col-span-full">
            <app-empty title="Sin proyectos en marcha" hint="Crea uno con el «+» de la barra lateral." />
          </div>
        }
      </div>
    </section>
  `,
})
export class Dashboard {
  protected readonly session = inject(SessionService);
  protected readonly projects = inject(ProjectService);
  private readonly tasks = inject(TaskService);

  protected readonly today = formatLongDate();
  protected readonly modKey = IS_MAC ? '⌘' : 'Ctrl';
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
    if (!mine.length) return 'Nada a tu nombre. Buen momento para pensar.';
    const parts = [];
    if (late) parts.push(`${late} con retraso`);
    if (today) parts.push(`${today} para hoy`);
    return parts.length ? `${capitalize(parts.join(' y '))}. Paso a paso.` : 'Nada vence hoy.';
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
          text: `${p.name} · ${s.overdue} con retraso`,
          link: ['/proyectos', p.id, 'tareas'],
        });
      }
      if (s.blocked) {
        alerts.push({
          tone: 'honey',
          text: `${p.name} · ${s.blocked} ${s.blocked === 1 ? 'bloqueada' : 'bloqueadas'}`,
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
          text: `${firstName(m.name)} va a tope · ${hours} h de ${m.weeklyCapacity} h`,
          link: ['/equipo'],
        });
      }
    }
    return alerts;
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

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
