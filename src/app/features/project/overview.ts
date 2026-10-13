import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { isTaskDone } from '../../core/catalog';
import { FileAsset } from '../../core/models';
import { FileService } from '../../core/services/files';
import { FILE_KIND_META } from '../../core/utils/files';
import { ActivityService } from '../../core/services/activity';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { daysFromToday } from '../../core/utils/dates';
import { ActivityFeed } from '../../shared/activity-feed';
import { TaskQuickAdd } from '../../shared/task-quick-add';
import { TaskRow } from '../../shared/task-row';
import { Avatar } from '../../shared/ui/avatar';
import { Empty } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';
import { Enso } from '../../shared/ui/scribble';

/** Resumen: qué se hace, en qué punto está, qué está bloqueado y qué viene después. */
@Component({
  selector: 'app-project-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ActivityFeed, TaskQuickAdd, TaskRow, Avatar, Empty, Enso, Icon],
  template: `
    @if (project(); as p) {
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <section class="card p-6">
            <div class="flex flex-col gap-6 sm:flex-row sm:items-center">
              <app-enso [value]="stats().progress" [size]="120" class="self-center" />
              <div class="min-w-0 flex-1">
                <p class="hand">{{ stats().done }} de {{ stats().total }} tareas completadas</p>
                @if (p.description) {
                  <p class="mt-2 max-w-prose text-[15px] leading-relaxed text-ink">{{ p.description }}</p>
                }
              </div>
            </div>
            <dl class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div class="rounded-xl bg-ink/[0.04] p-3.5">
                <dt class="text-xs text-ink-soft">Abiertas</dt>
                <dd class="mt-1 font-display text-2xl font-bold">{{ stats().open }}</dd>
              </div>
              <div class="rounded-xl bg-honey-soft p-3.5">
                <dt class="text-xs text-honey">En revisión</dt>
                <dd class="mt-1 font-display text-2xl font-bold text-honey">{{ stats().inReview }}</dd>
              </div>
              <div class="rounded-xl p-3.5" [class]="stats().blocked ? 'bg-coral-soft' : 'bg-ink/[0.04]'">
                <dt class="text-xs" [class]="stats().blocked ? 'text-coral' : 'text-ink-soft'">Bloqueadas</dt>
                <dd class="mt-1 font-display text-2xl font-bold" [class.text-coral]="stats().blocked">{{ stats().blocked }}</dd>
              </div>
              <div class="rounded-xl p-3.5" [class]="stats().overdue ? 'bg-coral-soft' : 'bg-ink/[0.04]'">
                <dt class="text-xs" [class]="stats().overdue ? 'text-coral' : 'text-ink-soft'">Vencidas</dt>
                <dd class="mt-1 font-display text-2xl font-bold" [class.text-coral]="stats().overdue">{{ stats().overdue }}</dd>
              </div>
            </dl>
          </section>

          @if (risks().length) {
            <section class="card overflow-hidden border-coral/30">
              <h2 class="flex items-center gap-2 border-b border-line/60 px-5 py-4 card-title">
                <app-icon name="alert" class="text-coral" /> Bloqueos y riesgos
              </h2>
              <div class="divide-y divide-line/60">
                @for (t of risks(); track t.id) {
                  <app-task-row [task]="t" />
                }
              </div>
            </section>
          }

          <section class="card overflow-hidden">
            <header class="flex items-center justify-between border-b border-line/60 px-5 py-4">
              <h2 class="card-title">Próximas entregas</h2>
              @if (p.moduleIds.includes('tasks')) {
                <a routerLink="../tareas" class="text-xs text-ink-soft hover:text-ink">Todas las tareas →</a>
              }
            </header>
            <div class="divide-y divide-line/60">
              @for (t of upcoming(); track t.id) {
                <app-task-row [task]="t" />
              } @empty {
                @if (projectTasks().length) {
                  <app-empty title="Sin entregas próximas" hint="No hay tareas abiertas con fecha." doodle="mountain" [compact]="true" />
                } @else {
                  <div class="px-5 py-6">
                    <p class="font-display font-bold">Empieza por la primera tarea</p>
                    <p class="hand mb-4 text-sm">Escribe qué hay que hacer y pulsa Enter. Luego podrás asignarla y ponerle fecha.</p>
                    @if (canEdit()) {
                      <app-task-quick-add [projectId]="projectId()" placeholder="p. ej. Reunión de briefing con el cliente" />
                    }
                  </div>
                }
              }
            </div>
          </section>
        </div>

        <div class="space-y-6">
          @if (p.moduleIds.includes('files')) {
            <section class="card p-4">
              <header class="mb-3 flex items-baseline justify-between">
                <h2 class="card-title">Archivos recientes</h2>
                <a routerLink="../archivos" class="text-xs text-ink-soft hover:text-ink">Ver todos →</a>
              </header>
              @if (recentFiles().length) {
                <div class="grid grid-cols-3 gap-2">
                  @for (f of recentFiles(); track f.id) {
                    <a routerLink="../archivos" class="group block" [attr.title]="f.name">
                      <span class="grid aspect-square place-items-center overflow-hidden rounded-xl bg-ink/[0.05] text-ink-faint">
                        @if (f.thumbnail) {
                          <img [src]="f.thumbnail" alt="" class="size-full object-cover" />
                        } @else {
                          <app-icon [name]="fileIcon(f)" [size]="20" />
                        }
                      </span>
                      <span class="mt-1 block truncate text-xs text-ink-soft group-hover:text-ink">{{ f.name }}</span>
                    </a>
                  }
                </div>
              } @else {
                <a routerLink="../archivos" class="flex items-center gap-3 rounded-xl border-[1.5px] border-dashed border-ink/20 px-4 py-4 text-ink-soft hover:border-ink-faint hover:text-ink">
                  <app-icon name="upload" [size]="18" /> Sube referencias o pega enlaces
                </a>
              }
            </section>
          }

          <section class="card p-4">
            <h2 class="mb-3 card-title">Equipo</h2>
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
            <header class="mb-4 flex items-baseline justify-between">
              <h2 class="card-title">Actividad reciente</h2>
              <a routerLink="../actividad" class="text-xs text-ink-soft hover:text-ink">Ver toda →</a>
            </header>
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
  private readonly files = inject(FileService);

  protected readonly project = computed(() => this.projects.byId(this.projectId()));
  protected readonly stats = computed(() => this.projects.statsFor(this.projectId()));
  protected readonly projectTasks = computed(() => this.tasks.byProject(this.projectId()));
  private readonly open = computed(() => this.projectTasks().filter((t) => !isTaskDone(t.status)));

  protected readonly risks = computed(() =>
    this.open().filter((t) => t.blocked || (t.dueAt && daysFromToday(t.dueAt) < 0)),
  );

  protected readonly upcoming = computed(() =>
    this.open()
      .filter((t) => t.dueAt && daysFromToday(t.dueAt) >= 0 && !t.blocked)
      .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
      .slice(0, 6),
  );

  protected readonly recentFiles = computed(() =>
    this.files
      .visible()
      .filter((f) => f.projectId === this.projectId())
      .slice(0, 6),
  );

  protected readonly canEdit = computed(() => this.session.can('task.edit'));

  protected fileIcon(file: FileAsset): string {
    return FILE_KIND_META[file.kind].icon;
  }

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
}
