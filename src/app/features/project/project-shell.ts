import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CanActivateFn, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MODULE_BY_ID, PROJECT_STATUS, PROJECT_STATUS_ORDER, PROJECT_TYPE_LABEL, TONE_BADGE } from '../../core/catalog';
import { Project, ProjectModuleId, ProjectStatus } from '../../core/models';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { formatShortDate } from '../../core/utils/dates';
import { AvatarStack } from '../../shared/ui/avatar';
import { Badge, Empty } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';

/** Impide abrir la ruta de un módulo que el proyecto no tiene activado. */
export function requireModule(moduleId: ProjectModuleId): CanActivateFn {
  return (route) => {
    const projects = inject(ProjectService);
    const router = inject(Router);
    const id = route.paramMap.get('projectId') ?? '';
    const project = projects.byId(id);
    if (!project) return router.createUrlTree(['/proyectos']);
    return project.moduleIds.includes(moduleId) || router.createUrlTree(['/proyectos', id, 'resumen']);
  };
}

@Component({
  selector: 'app-project-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AvatarStack, Badge, Empty, Icon],
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
            </div>
          </div>

          <nav class="mt-6 flex gap-1 overflow-x-auto border-b border-line/70" aria-label="Módulos del proyecto">
            @for (m of tabs(); track m.path) {
              <a
                [routerLink]="m.path"
                routerLinkActive="is-active"
                class="group relative -mb-px inline-flex h-11 items-center gap-1.5 px-3.5 whitespace-nowrap transition-colors hover:text-ink [&.is-active]:font-medium [&.is-active]:text-ink"
                [class]="m.soon ? 'text-ink-faint/70' : 'text-ink-soft'"
                [attr.title]="m.soon ? m.label + ' · próximamente' : null"
              >
                <app-icon [name]="m.icon" [size]="15" />
                {{ m.label }}
                @if (m.soon) {
                  <span class="font-hand text-[10px]">pronto</span>
                }
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
        <app-empty title="Proyecto no encontrado" hint="Puede que se haya eliminado o que no tengas acceso.">
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

  /** Pestañas = módulos activos en el orden del proyecto + Actividad y Configuración. */
  protected readonly tabs = computed(() => {
    const modules = (this.project()?.moduleIds ?? [])
      .map((id) => MODULE_BY_ID[id])
      .filter(Boolean)
      .map((m) => ({ path: m.path, label: m.label, icon: m.icon, soon: !m.built }));
    return [
      ...modules,
      { path: 'actividad', label: 'Actividad', icon: 'activity', soon: false },
      ...(this.canManage() ? [{ path: 'configuracion', label: 'Configuración', icon: 'settings', soon: false }] : []),
    ];
  });

  protected readonly statusClass = computed(() => TONE_BADGE[PROJECT_STATUS[this.project()?.status ?? 'draft'].tone]);

  protected setStatus(project: Project, status: ProjectStatus): void {
    void this.projects.update(project, { status });
  }

  protected short(iso?: string): string {
    return formatShortDate(iso);
  }
}
