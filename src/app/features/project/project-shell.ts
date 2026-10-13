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
      <div class="-mx-4 -mt-6 mb-6 border-b border-line bg-surface lg:-mx-8 lg:-mt-8">
        <div class="h-1.5" [style.background]="p.cover"></div>
        <div class="px-4 pt-5 lg:px-8">
          <a routerLink="/proyectos" class="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
            <app-icon name="chevron-left" [size]="14" /> Proyectos
          </a>
          <div class="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div class="min-w-0 flex-1">
              <p class="text-xs text-ink-soft">{{ typeLabel[p.type] }} · {{ p.client ?? 'Proyecto interno' }}</p>
              <h1 class="page-title mt-0.5">{{ p.name }}</h1>
            </div>
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
              @if (canManage()) {
                <label class="sr-only" for="project-status">Estado del proyecto</label>
                <select
                  id="project-status"
                  class="h-7 cursor-pointer rounded-full border-0 px-3 text-xs font-medium"
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

          <nav class="-mb-px mt-5 flex gap-1 overflow-x-auto" aria-label="Módulos del proyecto">
            @for (m of tabs(); track m.path) {
              <a
                [routerLink]="m.path"
                routerLinkActive="!border-ink !text-ink"
                class="inline-flex h-10 items-center gap-1.5 border-b-2 border-transparent px-3 whitespace-nowrap text-ink-soft hover:text-ink"
              >
                <app-icon [name]="m.icon" [size]="15" />
                {{ m.label }}
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
    const modules = (this.project()?.moduleIds ?? []).map((id) => MODULE_BY_ID[id]).filter(Boolean);
    return [
      ...modules,
      { path: 'actividad', label: 'Actividad', icon: 'activity' },
      ...(this.canManage() ? [{ path: 'configuracion', label: 'Configuración', icon: 'settings' }] : []),
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
