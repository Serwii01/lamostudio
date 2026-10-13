import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { COVER_SWATCHES, MODULES, MODULE_BY_ID, PRIORITY, PRIORITY_ORDER } from '../../core/catalog';
import { Id, Priority, Project, ProjectModuleId } from '../../core/models';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { ToastService } from '../../core/services/ui-state';
import { fromDateInput, toDateInput } from '../../core/utils/dates';
import { Avatar } from '../../shared/ui/avatar';
import { Empty } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';

interface Draft {
  name: string;
  client: string;
  description: string;
  priority: Priority;
  startAt: string;
  dueAt: string;
  cover: string;
}

function toDraft(project: Project | undefined): Draft {
  return {
    name: project?.name ?? '',
    client: project?.client ?? '',
    description: project?.description ?? '',
    priority: project?.priority ?? 'medium',
    startAt: toDateInput(project?.startAt),
    dueAt: toDateInput(project?.dueAt),
    cover: project?.cover ?? COVER_SWATCHES[0],
  };
}

@Component({
  selector: 'app-project-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Avatar, Empty, Icon],
  template: `
    @if (!session.can('project.manage')) {
      <div class="card"><app-empty title="Sin permisos" hint="Solo producción, dirección o administración pueden configurar el proyecto." /></div>
    } @else if (project(); as p) {
      <div class="grid gap-6 lg:grid-cols-5">
        <form class="card space-y-4 p-5 lg:col-span-3" (ngSubmit)="save(p)">
          <h2 class="font-display text-lg font-semibold">Datos generales</h2>
          <label class="block">
            <span class="label">Nombre</span>
            <input class="input" name="name" required [(ngModel)]="draft().name" />
          </label>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="label">Cliente</span>
              <input class="input" name="client" [(ngModel)]="draft().client" />
            </label>
            <label class="block">
              <span class="label">Prioridad</span>
              <select class="input" name="priority" [(ngModel)]="draft().priority">
                @for (pr of priorityOrder; track pr) {
                  <option [value]="pr">{{ priority[pr].label }}</option>
                }
              </select>
            </label>
          </div>
          <label class="block">
            <span class="label">Descripción</span>
            <textarea class="input min-h-24" name="description" [(ngModel)]="draft().description"></textarea>
          </label>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="label">Inicio</span>
              <input type="date" class="input" name="startAt" [(ngModel)]="draft().startAt" />
            </label>
            <label class="block">
              <span class="label">Entrega</span>
              <input type="date" class="input" name="dueAt" [(ngModel)]="draft().dueAt" />
            </label>
          </div>
          <div>
            <span class="label">Color de portada</span>
            <div class="flex gap-2">
              @for (c of swatches; track c) {
                <button
                  type="button"
                  class="size-7 cursor-pointer rounded-full ring-offset-2 ring-offset-surface"
                  [class.ring-2]="draft().cover === c"
                  [class.ring-ink]="draft().cover === c"
                  [style.background]="c"
                  [attr.aria-label]="'Color ' + c"
                  (click)="setCover(c)"
                ></button>
              }
            </div>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
            <button type="button" class="btn btn-danger" (click)="archive(p)">
              <app-icon name="bookmark" [size]="14" /> {{ p.status === 'archived' ? 'Desarchivar' : 'Archivar proyecto' }}
            </button>
            <button type="submit" class="btn btn-primary" [disabled]="!draft().name.trim()">Guardar cambios</button>
          </div>
        </form>

        <div class="space-y-6 lg:col-span-2">
          <section class="card p-5">
            <h2 class="font-display text-lg font-semibold">Módulos</h2>
            <p class="mt-1 mb-3 text-ink-soft">Activa, oculta y ordena las pestañas del proyecto.</p>
            <ul class="space-y-1">
              @for (id of p.moduleIds; track id; let i = $index, last = $last) {
                <li class="flex items-center gap-2 rounded-lg bg-line-soft/60 px-2 py-1.5">
                  <app-icon [name]="moduleById[id].icon" class="text-ink-soft" />
                  <span class="flex-1">{{ moduleById[id].label }}</span>
                  @if (id !== 'overview') {
                    <button type="button" class="btn btn-ghost btn-sm px-1.5" aria-label="Subir" [disabled]="i <= 1" (click)="moveModule(p, i, -1)">
                      <app-icon name="arrow-up" [size]="13" />
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm px-1.5" aria-label="Bajar" [disabled]="last" (click)="moveModule(p, i, 1)">
                      <app-icon name="arrow-down" [size]="13" />
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm px-1.5" aria-label="Desactivar" (click)="toggleModule(p, id)">
                      <app-icon name="x" [size]="13" />
                    </button>
                  } @else {
                    <span class="pr-1.5 text-xs text-ink-faint">fijo</span>
                  }
                </li>
              }
            </ul>
            @if (available().length) {
              <p class="eyebrow mt-4 mb-2">Disponibles</p>
              <div class="flex flex-wrap gap-2">
                @for (m of available(); track m.id) {
                  <button type="button" class="chip" (click)="toggleModule(p, m.id)">
                    <app-icon name="plus" [size]="12" /> {{ m.label }}
                  </button>
                }
              </div>
            }
          </section>

          <section class="card p-5">
            <h2 class="font-display text-lg font-semibold">Miembros</h2>
            <ul class="mt-3 space-y-2">
              @for (m of session.members(); track m.id) {
                <li>
                  <label class="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      class="size-4 accent-ink"
                      [checked]="p.memberIds.includes(m.id)"
                      [disabled]="m.id === p.ownerId"
                      (change)="toggleMember(p, m.id)"
                    />
                    <app-avatar [member]="m" [size]="26" />
                    <span class="flex-1">{{ m.name }}</span>
                    <span class="text-xs text-ink-faint">{{ m.id === p.ownerId ? 'responsable' : m.specialty }}</span>
                  </label>
                </li>
              }
            </ul>
          </section>
        </div>
      </div>
    }
  `,
})
export class ProjectSettings {
  readonly projectId = input.required<string>();

  protected readonly session = inject(SessionService);
  private readonly projects = inject(ProjectService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly priority = PRIORITY;
  protected readonly priorityOrder = PRIORITY_ORDER;
  protected readonly swatches = COVER_SWATCHES;
  protected readonly moduleById = MODULE_BY_ID;

  protected readonly project = computed(() => this.projects.byId(this.projectId()));
  /** Borrador del formulario; solo se reinicia al cambiar de proyecto. */
  protected readonly draft = linkedSignal({
    source: this.projectId,
    computation: (id) => toDraft(this.projects.byId(id)),
  });
  protected readonly available = computed(() =>
    MODULES.filter((m) => !this.project()?.moduleIds.includes(m.id)),
  );

  protected setCover(cover: string): void {
    this.draft.update((d) => ({ ...d, cover }));
  }

  protected save(project: Project): void {
    const d = this.draft();
    void this.projects.update(project, {
      name: d.name.trim(),
      client: d.client.trim() || undefined,
      description: d.description.trim() || undefined,
      priority: d.priority,
      startAt: fromDateInput(d.startAt),
      dueAt: fromDateInput(d.dueAt),
      cover: d.cover,
    });
    this.toast.show('Cambios guardados');
  }

  protected toggleModule(project: Project, id: ProjectModuleId): void {
    const moduleIds = project.moduleIds.includes(id)
      ? project.moduleIds.filter((m) => m !== id)
      : [...project.moduleIds, id];
    void this.projects.update(project, { moduleIds });
  }

  protected moveModule(project: Project, index: number, delta: number): void {
    const moduleIds = [...project.moduleIds];
    const [moved] = moduleIds.splice(index, 1);
    moduleIds.splice(index + delta, 0, moved);
    void this.projects.update(project, { moduleIds });
  }

  protected toggleMember(project: Project, id: Id): void {
    const memberIds = project.memberIds.includes(id)
      ? project.memberIds.filter((m) => m !== id)
      : [...project.memberIds, id];
    void this.projects.update(project, { memberIds });
  }

  protected archive(project: Project): void {
    const archiving = project.status !== 'archived';
    if (archiving && !confirm(`¿Archivar «${project.name}»? Dejará de aparecer entre los proyectos activos.`)) return;
    void this.projects.update(project, { status: archiving ? 'archived' : 'planning' });
    if (archiving) void this.router.navigate(['/proyectos']);
  }
}
