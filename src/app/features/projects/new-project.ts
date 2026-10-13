import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { COVER_SWATCHES, MODULES, PROJECT_TEMPLATES, ProjectTemplate } from '../../core/catalog';
import { Id, ProjectModuleId } from '../../core/models';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { ToastService } from '../../core/services/ui-state';
import { fromDateInput, toDateInput } from '../../core/utils/dates';
import { Avatar } from '../../shared/ui/avatar';
import { Empty } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-new-project',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Avatar, Empty, Icon],
  template: `
    <a routerLink="/proyectos" class="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
      <app-icon name="chevron-left" [size]="14" /> Proyectos
    </a>
    <h1 class="page-title mt-2">Nuevo proyecto</h1>

    @if (!session.can('project.create')) {
      <div class="card mt-6">
        <app-empty title="No tienes permiso para crear proyectos" hint="Pide a producción que lo cree y te invite." />
      </div>
    } @else {
      <section class="mt-6">
        <h2 class="eyebrow mb-3">1 · Elige una plantilla</h2>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          @for (t of templates; track t.type) {
            <button
              type="button"
              class="card flex cursor-pointer items-start gap-3 p-4 text-left transition-colors hover:border-ink-faint"
              [class.!border-ink]="template()?.type === t.type"
              [class.ring-1]="template()?.type === t.type"
              [class.ring-ink]="template()?.type === t.type"
              [attr.aria-pressed]="template()?.type === t.type"
              (click)="choose(t)"
            >
              <span class="grid size-9 shrink-0 place-items-center rounded-lg text-white" [style.background]="t.cover">
                <app-icon [name]="t.icon" />
              </span>
              <span>
                <span class="block font-medium">{{ t.name }}</span>
                <span class="mt-0.5 block text-ink-soft">{{ t.description }}</span>
              </span>
            </button>
          }
        </div>
      </section>

      @if (template()) {
        <form class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3" (ngSubmit)="create()">
          <section class="card space-y-4 p-5 lg:col-span-2">
            <h2 class="eyebrow">2 · Datos del proyecto</h2>
            <label class="block">
              <span class="label">Nombre *</span>
              <input class="input" name="name" required [(ngModel)]="name" placeholder="p. ej. Videoclip «Mareas»" />
            </label>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="label">Cliente</span>
                <input class="input" name="client" [(ngModel)]="client" placeholder="Opcional" />
              </label>
              <label class="block">
                <span class="label">Responsable principal</span>
                <select class="input" name="owner" [(ngModel)]="ownerId">
                  @for (m of staff(); track m.id) {
                    <option [value]="m.id">{{ m.name }}</option>
                  }
                </select>
              </label>
            </div>
            <label class="block">
              <span class="label">Descripción</span>
              <textarea class="input min-h-20" name="description" [(ngModel)]="description" placeholder="Qué se hace y para quién"></textarea>
            </label>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="label">Inicio</span>
                <input type="date" class="input" name="start" [(ngModel)]="startAt" />
              </label>
              <label class="block">
                <span class="label">Entrega</span>
                <input type="date" class="input" name="due" [(ngModel)]="dueAt" />
              </label>
            </div>
            <div>
              <span class="label">Color de portada</span>
              <div class="flex gap-2">
                @for (c of swatches; track c) {
                  <button
                    type="button"
                    class="size-7 cursor-pointer rounded-full ring-offset-2 ring-offset-surface"
                    [class.ring-2]="cover() === c"
                    [class.ring-ink]="cover() === c"
                    [style.background]="c"
                    [attr.aria-label]="'Color ' + c"
                    (click)="cover.set(c)"
                  ></button>
                }
              </div>
            </div>
            <div>
              <span class="label">Miembros</span>
              <div class="flex flex-wrap gap-2">
                @for (m of session.members(); track m.id) {
                  <button
                    type="button"
                    class="chip gap-2 pl-1"
                    [class.chip-active]="memberIds().includes(m.id)"
                    (click)="toggleMember(m.id)"
                  >
                    <app-avatar [member]="m" [size]="20" /> {{ m.name }}
                  </button>
                }
              </div>
            </div>
          </section>

          <section class="card p-5">
            <h2 class="eyebrow">3 · Módulos</h2>
            <p class="mt-1 mb-3 text-ink-soft">La plantilla sugiere estos módulos; podrás cambiarlos después.</p>
            <ul class="space-y-1">
              @for (m of modules; track m.id) {
                <li>
                  <label class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink/[0.03]">
                    <input
                      type="checkbox"
                      class="size-4 accent-ink"
                      [checked]="moduleIds().includes(m.id)"
                      [disabled]="m.id === 'overview'"
                      (change)="toggleModule(m.id)"
                    />
                    <app-icon [name]="m.icon" class="text-ink-soft" />
                    <span class="flex-1">{{ m.label }}</span>
                    @if (!m.built) {
                      <span class="text-[10px] tracking-wide text-ink-faint uppercase">{{ m.phase }}</span>
                    }
                  </label>
                </li>
              }
            </ul>
            <button type="submit" class="btn btn-primary mt-5 w-full" [disabled]="!name().trim()">Crear proyecto</button>
          </section>
        </form>
      }
    }
  `,
})
export class NewProject {
  protected readonly session = inject(SessionService);
  private readonly projects = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly templates = PROJECT_TEMPLATES;
  protected readonly modules = MODULES;
  protected readonly swatches = COVER_SWATCHES;

  protected readonly template = signal<ProjectTemplate | null>(null);
  protected readonly name = signal('');
  protected readonly client = signal('');
  protected readonly description = signal('');
  protected readonly ownerId = signal<Id>(this.session.currentUserId());
  protected readonly startAt = signal(toDateInput(new Date().toISOString()));
  protected readonly dueAt = signal('');
  protected readonly cover = signal(COVER_SWATCHES[0]);
  protected readonly memberIds = signal<Id[]>([this.session.currentUserId()]);
  protected readonly moduleIds = signal<ProjectModuleId[]>([]);

  protected readonly staff = computed(() => this.session.members().filter((m) => m.role !== 'client' && m.role !== 'guest'));

  protected choose(template: ProjectTemplate): void {
    this.template.set(template);
    this.moduleIds.set([...template.modules]);
    this.cover.set(template.cover);
  }

  protected toggleMember(id: Id): void {
    this.memberIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  protected toggleModule(id: ProjectModuleId): void {
    this.moduleIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async create(): Promise<void> {
    const template = this.template();
    const name = this.name().trim();
    if (!template || !name) return;
    const memberIds = [...new Set([...this.memberIds(), this.ownerId()])];
    // Se respeta el orden del catálogo para las pestañas, con Resumen siempre primero.
    const moduleIds = MODULES.map((m) => m.id).filter((id) => id === 'overview' || this.moduleIds().includes(id));
    const project = await this.projects.create({
      name,
      client: this.client().trim() || undefined,
      description: this.description().trim() || undefined,
      type: template.type,
      status: 'planning',
      priority: 'medium',
      tags: [],
      cover: this.cover(),
      moduleIds,
      memberIds,
      ownerId: this.ownerId(),
      startAt: fromDateInput(this.startAt()),
      dueAt: fromDateInput(this.dueAt()),
    });
    this.toast.show('Proyecto creado');
    void this.router.navigate(['/proyectos', project.id]);
  }
}
