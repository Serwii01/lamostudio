import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { INACTIVE_PROJECT_STATUSES, PROJECT_STATUS, PROJECT_TYPE_LABEL } from '../../core/catalog';
import { Project } from '../../core/models';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { formatShortDate } from '../../core/utils/dates';
import { normalize } from '../../core/utils/text';
import { AvatarStack } from '../../shared/ui/avatar';
import { Badge, Empty } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';
import { Enso } from '../../shared/ui/scribble';

type Filter = 'active' | 'closed' | 'all';

@Component({
  selector: 'app-project-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, AvatarStack, Badge, Empty, Enso, Icon],
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">{{ session.workspace().name }}</p>
        <h1 class="page-title mt-2">Proyectos</h1>
        <p class="hand mt-2 text-base">Cada proyecto, solo con las piezas que necesita.</p>
      </div>
      @if (session.can('project.create')) {
        <a routerLink="/proyectos/nuevo" class="btn btn-primary"><app-icon name="plus" /> Nuevo proyecto</a>
      }
    </header>

    <div class="mt-6 flex flex-wrap items-center gap-2">
      <button class="chip" [class.chip-active]="filter() === 'active'" (click)="filter.set('active')">Activos</button>
      <button class="chip" [class.chip-active]="filter() === 'closed'" (click)="filter.set('closed')">Cerrados</button>
      <button class="chip" [class.chip-active]="filter() === 'all'" (click)="filter.set('all')">Todos</button>
      <label class="relative ml-auto w-full sm:w-64">
        <span class="sr-only">Filtrar proyectos</span>
        <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
        <input class="input rounded-full pl-9" placeholder="Filtrar por nombre o cliente" [(ngModel)]="query" />
      </label>
    </div>

    <div class="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      @for (p of filtered(); track p.id) {
        <a
          [routerLink]="['/proyectos', p.id]"
          class="card group flex flex-col transition-[border-color,box-shadow,translate] duration-300 hover:-translate-y-0.5 hover:border-ink-faint hover:shadow-xl hover:shadow-ink/5"
        >
          <div class="flex flex-1 flex-col p-5">
            <div class="flex items-center justify-between gap-3">
              <p class="flex items-center gap-2 text-xs text-ink-faint">
                <span class="size-2.5 rounded-full" [style.background]="p.cover"></span>{{ typeLabel[p.type] }}
              </p>
              <app-badge [tone]="status[p.status].tone">{{ status[p.status].label }}</app-badge>
            </div>
            <h2 class="mt-1.5 font-display text-xl leading-snug font-bold group-hover:underline">{{ p.name }}</h2>
            <p class="mt-0.5 text-ink-soft">{{ p.client ?? 'Proyecto interno' }}</p>

            <div class="mt-auto pt-6">
              <div class="flex items-center gap-3">
                <app-enso [value]="projects.statsFor(p.id).progress" [size]="44" />
                <span class="hand text-xs">{{ projects.statsFor(p.id).done }} de {{ projects.statsFor(p.id).total }} tareas</span>
              </div>
              <div class="mt-4 flex items-center justify-between border-t border-line/60 pt-4">
                <app-avatar-stack [members]="membersOf(p)" />
                <span class="flex items-center gap-1.5 text-xs text-ink-soft">
                  <app-icon name="calendar" [size]="13" /> {{ short(p.dueAt) }}
                </span>
              </div>
            </div>
          </div>
        </a>
      } @empty {
        <div class="card sm:col-span-2 xl:col-span-3">
          <app-empty title="No hay proyectos que mostrar" hint="Prueba con otro filtro o crea un proyecto nuevo." />
        </div>
      }
    </div>
  `,
})
export class ProjectList {
  protected readonly session = inject(SessionService);
  protected readonly projects = inject(ProjectService);

  protected readonly status = PROJECT_STATUS;
  protected readonly typeLabel = PROJECT_TYPE_LABEL;
  protected readonly filter = signal<Filter>('active');
  protected readonly query = signal('');

  protected readonly filtered = computed(() => {
    const q = normalize(this.query());
    return this.projects.visible().filter((p) => {
      const inactive = INACTIVE_PROJECT_STATUSES.includes(p.status) && p.status !== 'draft';
      if (this.filter() === 'active' && inactive) return false;
      if (this.filter() === 'closed' && !inactive) return false;
      return !q || normalize(`${p.name} ${p.client ?? ''}`).includes(q);
    });
  });

  protected membersOf(project: Project) {
    return this.session.members().filter((m) => project.memberIds.includes(m.id));
  }

  protected short(iso?: string): string {
    return formatShortDate(iso);
  }
}
