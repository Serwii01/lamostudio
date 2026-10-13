import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CanActivateFn, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MODULE_BY_ID, PROJECT_STATUS, PROJECT_STATUS_ORDER, PROJECT_TYPE_LABEL, TONE_BADGE } from '../../core/catalog';
import { Project, ProjectModuleId, ProjectStatus } from '../../core/models';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { ProjectContextService, TaskViewService } from '../../core/services/ui-state';
import { formatShortDate } from '../../core/utils/dates';
import { AvatarStack } from '../../shared/ui/avatar';
import { Badge, Empty } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';

/** Impide abrir la ruta de un módulo que el proyecto no tiene activado (basta con uno de los indicados). */
export function requireModule(...moduleIds: ProjectModuleId[]): CanActivateFn {
  return (route) => {
    const projects = inject(ProjectService);
    const router = inject(Router);
    const id = route.paramMap.get('projectId') ?? '';
    const project = projects.byId(id);
    if (!project) return router.createUrlTree(['/proyectos']);
    return moduleIds.some((id) => project.moduleIds.includes(id)) || router.createUrlTree(['/proyectos', id, 'resumen']);
  };
}

@Component({
  selector: 'app-project-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, AvatarStack, Badge, Empty, Icon],
  template: `
    @if (project(); as p) {
      <div class="mb-8">
        <div>
          <a routerLink="/proyectos" class="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
            <app-icon name="chevron-left" [size]="14" /> Proyectos
          </a>
          <div class="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div class="min-w-0 flex-1">
              <p class="flex items-center gap-2 text-xs text-ink-soft">
                <span class="size-2.5 rounded-full" [style.background]="p.cover"></span>
                {{ typeLabel[p.type] }} · {{ p.client ?? 'Proyecto interno' }}
              </p>
              <h1 class="page-title mt-1.5">{{ p.name }}</h1>
            </div>
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
              @if (canManage()) {
                <label class="sr-only" for="project-status">Estado del proyecto</label>
                <select
                  id="project-status"
                  class="h-8 cursor-pointer rounded-full border-0 px-3.5 text-xs font-medium"
                  title="Cambiar estado del proyecto"
                  [class]="statusClass()"
                  (change)="setStatus(p, $any($event.target).value)"
                >
                  @for (s of statusOrder; track s) {
                    <option [value]="s" [selected]="s === p.status">{{ status[s].label }}</option>
                  }
                </select>
              } @else {
                <app-badge [tone]="status[p.status].tone">{{ status[p.status].label }}</app-badge>
              }
              <span class="flex items-center gap-1.5 text-ink-soft">
                <app-icon name="calendar" [size]="14" />
                {{ short(p.startAt) }} → <span class="font-medium text-ink">{{ short(p.dueAt) }}</span>
              </span>
              <app-avatar-stack [members]="members()" [max]="5" [size]="26" />
              @if (canManage()) {
                <a routerLink="configuracion" class="btn btn-outline h-8 px-3 text-xs" title="Ajustes del proyecto: datos, pestañas y miembros">
                  <app-icon name="settings" [size]="14" /> Ajustes
                </a>
              }
            </div>
          </div>

          <nav class="mt-6 flex gap-1 overflow-x-auto border-b border-line/70" aria-label="Módulos del proyecto">
            @for (m of tabs(); track m.key) {
              <a
                [routerLink]="m.path"
                [class.is-active]="m.match.includes(section())"
                [attr.aria-current]="m.match.includes(section()) ? 'page' : null"
                [attr.title]="m.label + ' · tecla ' + ($index + 1)"
                class="group relative -mb-px inline-flex h-11 items-center gap-1.5 px-3.5 whitespace-nowrap text-ink-soft transition-colors hover:text-ink [&.is-active]:font-medium [&.is-active]:text-ink"
              >
                <app-icon [name]="m.icon" [size]="15" />
                {{ m.label }}
                <svg class="absolute inset-x-2 -bottom-px h-1.5 opacity-0 group-[.is-active]:opacity-100" viewBox="0 0 60 6" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 4c10-3 18 1 28-1s18-2 28 0" fill="none" class="stroke-shu" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke" />
                </svg>
              </a>
            }
          </nav>
        </div>
      </div>
      <router-outlet />
    } @else {
      <div class="card">
        <app-empty title="Proyecto no encontrado" hint="Puede que se borrara o que no tengas acceso.">
          <a routerLink="/proyectos" class="btn btn-outline">Volver a proyectos</a>
        </app-empty>
      </div>
    }
  `,
})
export class ProjectShell {
  readonly projectId = input.required<string>();

  private readonly projects = inject(ProjectService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly taskView = inject(TaskViewService);

  protected readonly status = PROJECT_STATUS;
  protected readonly statusOrder = PROJECT_STATUS_ORDER;
  protected readonly typeLabel = PROJECT_TYPE_LABEL;

  protected readonly project = computed(() => {
    const project = this.projects.byId(this.projectId());
    const visible = project && this.projects.visible().some((p) => p.id === project.id);
    return visible ? project : undefined;
  });

  protected readonly members = computed(() => {
    const ids = this.project()?.memberIds ?? [];
    return this.session.members().filter((m) => ids.includes(m.id));
  });

  protected readonly canManage = computed(() => this.session.can('project.manage'));

  /** Sección actual (último segmento de la URL), para marcar la pestaña activa. */
  protected readonly section = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => currentSection(this.router.url)),
    ),
    { initialValue: currentSection(this.router.url) },
  );

  /**
   * Pocas pestañas y claras: Resumen · Tareas · Archivos · Notas.
   * - «Tareas» reúne lista y tablero (dos vistas de lo mismo) y abre la última usada.
   * - Solo aparecen módulos activos y ya construidos; los futuros saldrán solos.
   * - Actividad vive en el Resumen y los ajustes en el botón de la cabecera.
   */
  protected readonly tabs = computed(() => {
    const ids = this.project()?.moduleIds ?? [];
    const tabs: { key: string; path: string; label: string; icon: string; match: string[] }[] = [];
    let tasksAdded = false;
    for (const id of ids) {
      if (id === 'tasks' || id === 'kanban') {
        if (!tasksAdded) tabs.push({ key: 'tasks', path: this.taskView.view(), label: 'Tareas', icon: 'check-square', match: ['tareas', 'tablero'] });
        tasksAdded = true;
        continue;
      }
      const m = MODULE_BY_ID[id];
      if (m?.built) tabs.push({ key: m.id, path: m.path, label: m.label, icon: m.icon, match: [m.path] });
    }
    return tabs;
  });

  constructor() {
    const context = inject(ProjectContextService);
    effect(() => {
      context.projectId.set(this.project()?.id ?? null);
      context.tabs.set(this.tabs().map((t) => ({ label: t.label, path: t.path })));
      context.section.set(this.section());
    });
    inject(DestroyRef).onDestroy(() => {
      context.projectId.set(null);
      context.tabs.set([]);
      context.section.set('');
    });
  }

  protected readonly statusClass = computed(() => TONE_BADGE[PROJECT_STATUS[this.project()?.status ?? 'draft'].tone]);

  protected setStatus(project: Project, status: ProjectStatus): void {
    void this.projects.update(project, { status });
  }

  protected short(iso?: string): string {
    return formatShortDate(iso);
  }
}

function currentSection(url: string): string {
  return url.split(/[?#]/)[0].split('/').filter(Boolean)[2] ?? 'resumen';
}
