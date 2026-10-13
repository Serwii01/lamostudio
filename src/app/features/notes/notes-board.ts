import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Id, NoteVisibility, QuickNote } from '../../core/models';
import { NoteService } from '../../core/services/notes';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskPanelService, ToastService } from '../../core/services/ui-state';
import { timeAgo } from '../../core/utils/dates';
import { normalize } from '../../core/utils/text';
import { Avatar } from '../../shared/ui/avatar';
import { Empty } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';

type Filter = 'all' | 'mine' | 'pinned';

const VISIBILITY_LABEL: Record<NoteVisibility, string> = {
  private: 'Solo yo',
  project: 'Equipo del proyecto',
  workspace: 'Todo el estudio',
};

/**
 * Notas rápidas. Se usa tanto como página global (/notas) como módulo de proyecto,
 * en cuyo caso recibe projectId desde la ruta.
 */
@Component({
  selector: 'app-notes-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Avatar, Empty, Icon],
  template: `
    @if (!projectId()) {
      <header class="mb-6">
        <p class="eyebrow">Captura sin fricción</p>
        <h1 class="page-title mt-1">Notas</h1>
        <p class="mt-1 text-ink-soft">Ideas, actas y recordatorios. Pulsa <kbd class="rounded border border-line bg-surface px-1.5 text-xs">N</kbd> en cualquier pantalla para crear una.</p>
      </header>
    }

    <div class="grid gap-6 lg:grid-cols-[20rem_1fr]">
      @if (session.can('note.create')) {
        <form class="card h-fit space-y-3 p-4 lg:sticky lg:top-20" (ngSubmit)="create()">
          <h2 class="font-medium">Nueva nota</h2>
          <input class="input" name="title" placeholder="Título (opcional)" [(ngModel)]="title" autocomplete="off" />
          <textarea class="input min-h-28" name="content" placeholder="Escribe aquí…" [(ngModel)]="content"></textarea>
          @if (!projectId()) {
            <select class="input" name="project" aria-label="Proyecto" [(ngModel)]="targetProject">
              <option value="">Sin proyecto</option>
              @for (p of projects.active(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          }
          <select class="input" name="visibility" aria-label="Visibilidad" [(ngModel)]="visibility">
            <option value="private">Solo yo</option>
            <option value="project" [disabled]="!projectId() && !targetProject()">Equipo del proyecto</option>
            <option value="workspace">Todo el estudio</option>
          </select>
          <button class="btn btn-primary w-full" type="submit" [disabled]="!content().trim()">Guardar nota</button>
        </form>
      }

      <div class="min-w-0">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <button class="chip" [class.chip-active]="filter() === 'all'" (click)="filter.set('all')">Todas</button>
          <button class="chip" [class.chip-active]="filter() === 'mine'" (click)="filter.set('mine')">Mías</button>
          <button class="chip" [class.chip-active]="filter() === 'pinned'" (click)="filter.set('pinned')">Fijadas</button>
          <label class="relative ml-auto w-full sm:w-56">
            <span class="sr-only">Buscar notas</span>
            <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
            <input class="input h-8 pl-9" placeholder="Buscar…" [(ngModel)]="query" />
          </label>
        </div>

        <div class="columns-1 gap-4 md:columns-2 2xl:columns-3">
          @for (n of filtered(); track n.id) {
            <article class="card mb-4 break-inside-avoid p-4" [class.!border-honey]="n.pinned" [class.bg-honey-soft/30]="n.pinned">
              <div class="flex items-start gap-2">
                <h3 class="flex-1 font-medium leading-snug">{{ n.title || 'Sin título' }}</h3>
                @if (canEdit(n)) {
                  <button
                    class="btn btn-ghost btn-sm px-1.5"
                    [class.!text-honey]="n.pinned"
                    [attr.aria-label]="n.pinned ? 'Desfijar' : 'Fijar'"
                    (click)="notes.update(n, { pinned: !n.pinned })"
                  >
                    <app-icon name="bookmark" [size]="14" />
                  </button>
                }
              </div>

              @if (editingId() === n.id) {
                <textarea class="input mt-2 min-h-28" [value]="n.content" #editor></textarea>
                <div class="mt-2 flex justify-end gap-2">
                  <button class="btn btn-ghost btn-sm" (click)="editingId.set(null)">Cancelar</button>
                  <button class="btn btn-primary btn-sm" (click)="saveEdit(n, editor.value)">Guardar</button>
                </div>
              } @else {
                <p class="mt-1.5 whitespace-pre-line text-ink-soft">{{ n.content }}</p>
              }

              <div class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                <app-avatar [member]="session.member(n.authorId)" [size]="18" />
                <span>{{ session.member(n.authorId)?.name }}</span>
                <span>·</span>
                <span>{{ ago(n.updatedAt) }}</span>
                <span>·</span>
                <span class="inline-flex items-center gap-1"><app-icon [name]="n.visibility === 'private' ? 'lock' : 'eye'" [size]="12" />{{ visibilityLabel[n.visibility] }}</span>
                @if (!projectId() && projects.byId(n.projectId); as p) {
                  <a [routerLink]="['/proyectos', p.id]" class="inline-flex items-center gap-1 hover:text-ink">
                    <span class="size-2 rounded-sm" [style.background]="p.cover"></span>{{ p.name }}
                  </a>
                }
              </div>

              @if (n.linkedTaskId) {
                <button class="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-moss-soft px-2 py-1 text-xs text-moss hover:underline" (click)="panel.open(n.linkedTaskId!)">
                  <app-icon name="check-square" [size]="12" /> Convertida en tarea
                </button>
              }

              @if (canEdit(n) && editingId() !== n.id) {
                <div class="mt-3 flex flex-wrap items-center gap-1 border-t border-line-soft pt-2.5">
                  @if (!n.linkedTaskId && session.can('task.edit')) {
                    @if (convertingId() === n.id) {
                      <select class="input h-7 flex-1 text-xs" aria-label="Proyecto de destino" #target>
                        @for (p of projects.active(); track p.id) {
                          <option [value]="p.id">{{ p.name }}</option>
                        }
                      </select>
                      <button class="btn btn-primary btn-sm" (click)="convert(n, target.value)">Crear</button>
                      <button class="btn btn-ghost btn-sm" (click)="convertingId.set(null)">Cancelar</button>
                    } @else {
                      <button class="btn btn-ghost btn-sm" (click)="startConvert(n)"><app-icon name="bolt" [size]="13" /> Convertir en tarea</button>
                    }
                  }
                  @if (convertingId() !== n.id) {
                    <button class="btn btn-ghost btn-sm" (click)="editingId.set(n.id)"><app-icon name="pen" [size]="13" /> Editar</button>
                    <button class="btn btn-danger btn-sm ml-auto px-1.5" aria-label="Eliminar nota" (click)="remove(n)"><app-icon name="trash" [size]="13" /></button>
                  }
                </div>
              }
            </article>
          } @empty {
            <div class="card">
              <app-empty title="No hay notas" hint="Las ideas que captures aparecerán aquí." />
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class NotesBoard {
  /** Si se indica, el tablero muestra solo las notas de ese proyecto. */
  readonly projectId = input<string>();

  protected readonly session = inject(SessionService);
  protected readonly projects = inject(ProjectService);
  protected readonly notes = inject(NoteService);
  protected readonly panel = inject(TaskPanelService);
  private readonly toast = inject(ToastService);

  protected readonly visibilityLabel = VISIBILITY_LABEL;
  protected readonly filter = signal<Filter>('all');
  protected readonly query = signal('');
  protected readonly title = signal('');
  protected readonly content = signal('');
  protected readonly targetProject = signal('');
  protected readonly visibility = signal<NoteVisibility>('project');
  protected readonly editingId = signal<Id | null>(null);
  protected readonly convertingId = signal<Id | null>(null);

  protected readonly filtered = computed(() => {
    const projectId = this.projectId();
    const userId = this.session.currentUserId();
    const visibleProjects = new Set(this.projects.visible().map((p) => p.id));
    const q = normalize(this.query());
    return this.notes.visible().filter((n) => {
      if (projectId ? n.projectId !== projectId : n.projectId && !visibleProjects.has(n.projectId)) return false;
      if (this.filter() === 'mine' && n.authorId !== userId) return false;
      if (this.filter() === 'pinned' && !n.pinned) return false;
      return !q || normalize(`${n.title ?? ''} ${n.content}`).includes(q);
    });
  });

  protected canEdit(note: QuickNote): boolean {
    return note.authorId === this.session.currentUserId() || this.session.can('project.manage');
  }

  protected async create(): Promise<void> {
    const content = this.content().trim();
    if (!content) return;
    const projectId = this.projectId() || this.targetProject() || undefined;
    const visibility = !projectId && this.visibility() === 'project' ? 'private' : this.visibility();
    await this.notes.create({ content, title: this.title().trim() || undefined, projectId, visibility });
    this.title.set('');
    this.content.set('');
  }

  protected startConvert(note: QuickNote): void {
    const projectId = note.projectId ?? this.projectId();
    if (projectId) {
      void this.convert(note, projectId);
    } else {
      this.convertingId.set(note.id);
    }
  }

  protected async convert(note: QuickNote, projectId: string): Promise<void> {
    if (!projectId) return;
    this.convertingId.set(null);
    const task = await this.notes.convertToTask(note, projectId);
    this.toast.show('Tarea creada desde la nota');
    this.panel.open(task.id);
  }

  protected saveEdit(note: QuickNote, value: string): void {
    const content = value.trim();
    if (content) void this.notes.update(note, { content });
    this.editingId.set(null);
  }

  protected remove(note: QuickNote): void {
    if (confirm('¿Eliminar esta nota?')) void this.notes.remove(note);
  }

  protected ago(iso: string): string {
    return timeAgo(iso);
  }
}
