import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MODULE_BY_ID, isTaskDone } from '../../core/catalog';
import { ActivityService } from '../../core/services/activity';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { daysFromToday } from '../../core/utils/dates';
import { ActivityFeed } from '../../shared/activity-feed';
import { TaskRow } from '../../shared/task-row';
import { Avatar } from '../../shared/ui/avatar';
import { Empty, Progress } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';

/** Resumen: qué se hace, en qué punto está, qué está bloqueado y qué viene después. */
@Component({
  selector: 'app-project-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ActivityFeed, TaskRow, Avatar, Empty, Icon, Progress],
  template: `
    @if (project(); as p) {
      <div class="grid gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <section class="card p-5">
            @if (p.description) {
              <p class="max-w-prose text-[15px] leading-relaxed text-ink">{{ p.description }}</p>
            }
            <div class="mt-5 flex items-end justify-between gap-4">
              <div>
                <p class="text-ink-soft">Progreso</p>
                <p class="font-display text-4xl font-semibold tabular-nums">{{ pct(stats().progress) }}</p>
              </div>
              <p class="text-right text-ink-soft">{{ stats().done }} de {{ stats().total }} tareas completadas</p>
            </div>
            <app-progress class="mt-3" [value]="stats().progress" [height]="8" />
            <dl class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div class="rounded-lg bg-line-soft/70 p-3">
                <dt class="text-xs text-ink-soft">Abiertas</dt>
                <dd class="mt-1 text-xl font-semibold">{{ stats().open }}</dd>
              </div>
              <div class="rounded-lg bg-honey-soft p-3">
                <dt class="text-xs text-honey">En revisión</dt>
                <dd class="mt-1 text-xl font-semibold text-honey">{{ stats().inReview }}</dd>
              </div>
              <div class="rounded-lg p-3" [class]="stats().blocked ? 'bg-coral-soft' : 'bg-line-soft/70'">
                <dt class="text-xs" [class]="stats().blocked ? 'text-coral' : 'text-ink-soft'">Bloqueadas</dt>
                <dd class="mt-1 text-xl font-semibold" [class.text-coral]="stats().blocked">{{ stats().blocked }}</dd>
              </div>
              <div class="rounded-lg p-3" [class]="stats().overdue ? 'bg-coral-soft' : 'bg-line-soft/70'">
                <dt class="text-xs" [class]="stats().overdue ? 'text-coral' : 'text-ink-soft'">Vencidas</dt>
                <dd class="mt-1 text-xl font-semibold" [class.text-coral]="stats().overdue">{{ stats().overdue }}</dd>
              </div>
            </dl>
          </section>

          @if (risks().length) {
            <section class="card overflow-hidden border-coral/30">
              <h2 class="flex items-center gap-2 border-b border-line px-4 py-3 font-display text-lg font-semibold">
                <app-icon name="alert" class="text-coral" /> Bloqueos y riesgos
              </h2>
              <div class="divide-y divide-line-soft">
                @for (t of risks(); track t.id) {
                  <app-task-row [task]="t" />
                }
              </div>
            </section>
          }

          <section class="card overflow-hidden">
            <header class="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 class="font-display text-lg font-semibold">Próximas entregas</h2>
              @if (p.moduleIds.includes('tasks')) {
                <a routerLink="../tareas" class="text-xs text-ink-soft hover:text-ink">Todas las tareas →</a>
              }
            </header>
            <div class="divide-y divide-line-soft">
              @for (t of upcoming(); track t.id) {
                <app-task-row [task]="t" />
              } @empty {
                <app-empty title="Sin entregas próximas" hint="No hay tareas abiertas con fecha." />
              }
            </div>
          </section>
        </div>

        <div class="space-y-6">
          <section class="card p-4">
            <h2 class="mb-3 font-display text-lg font-semibold">Módulos</h2>
            <div class="grid grid-cols-2 gap-2">
              @for (m of modules(); track m.id) {
                <a
                  [routerLink]="['..', m.path]"
                  class="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 hover:border-ink-faint hover:bg-line-soft/50"
                >
                  <app-icon [name]="m.icon" class="text-ink-soft" />
                  <span class="truncate">{{ m.label }}</span>
                  @if (!m.built) {
                    <span class="ml-auto size-1.5 shrink-0 rounded-full bg-ink-faint" title="Próximamente"></span>
                  }
                </a>
              }
            </div>
          </section>

          <section class="card p-4">
            <h2 class="mb-3 font-display text-lg font-semibold">Equipo</h2>
            <ul class="space-y-3">
              @for (m of team(); track m.member.id) {
                <li class="flex items-center gap-3">
                  <app-avatar [member]="m.member" [size]="30" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium">
                      {{ m.member.name }}
                      @if (m.member.id === p.ownerId) {
                        <span class="ml-1 text-xs font-normal text-ink-faint">responsable</span>
                      }
                    </p>
                    <p class="truncate text-xs text-ink-faint">{{ m.member.specialty }}</p>
                  </div>
                  <span class="text-xs text-ink-soft tabular-nums">{{ m.open }} abiertas</span>
                </li>
              }
            </ul>
          </section>

          <section class="card p-4">
            <h2 class="mb-4 font-display text-lg font-semibold">Actividad reciente</h2>
            <app-activity-feed [entries]="activity()" />
          </section>
        </div>
      </div>
    }
  `,
})
export class ProjectOverview {
  readonly projectId = input.required<string>();

  private readonly projects = inject(ProjectService);
  private readonly tasks = inject(TaskService);
  private readonly session = inject(SessionService);
  private readonly activityService = inject(ActivityService);

  protected readonly project = computed(() => this.projects.byId(this.projectId()));
  protected readonly stats = computed(() => this.projects.statsFor(this.projectId()));
  private readonly projectTasks = computed(() => this.tasks.byProject(this.projectId()));
  private readonly open = computed(() => this.projectTasks().filter((t) => !isTaskDone(t.status)));

  protected readonly risks = computed(() =>
    this.open().filter((t) => t.status === 'blocked' || (t.dueAt && daysFromToday(t.dueAt) < 0)),
  );

  protected readonly upcoming = computed(() =>
    this.open()
      .filter((t) => t.dueAt && daysFromToday(t.dueAt) >= 0 && t.status !== 'blocked')
      .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
      .slice(0, 6),
  );

  protected readonly modules = computed(() =>
    (this.project()?.moduleIds ?? []).filter((id) => id !== 'overview').map((id) => MODULE_BY_ID[id]),
  );

  protected readonly team = computed(() => {
    const project = this.project();
    if (!project) return [];
    return this.session
      .members()
      .filter((m) => project.memberIds.includes(m.id))
      .map((member) => ({ member, open: this.open().filter((t) => t.assigneeId === member.id).length }));
  });

  protected readonly activity = computed(() =>
    this.activityService
      .entries()
      .filter((e) => e.projectId === this.projectId())
      .slice(0, 6),
  );

  protected pct(value: number): string {
    return `${Math.round(value * 100)} %`;
  }
}
