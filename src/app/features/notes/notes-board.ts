import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Id, NoteVisibility, QuickNote } from '../../core/models';
import { NoteService } from '../../core/services/notes';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskPanelService, ToastService, projectDropId } from '../../core/services/ui-state';
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
  imports: [FormsModule, CdkDropList, CdkDrag, RouterLink, Avatar, Empty, Icon],
  template: `
    @if (!projectId()) {
      <header class="mb-6">
        <h1 class="page-title mt-2">Notas</h1>
        <p class="hand mt-3 text-base">Pulsa <kbd class="kbd">N</kbd> en cualquier sitio para apuntar algo.</p>
      </header>
    }

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_1fr]">
      @if (session.can('note.create')) {
        <form class="card h-fit space-y-3 p-4 lg:sticky lg:top-20" (ngSubmit)="create()">
          <h2 class="font-medium">Nueva nota</h2>
          <input class="input" name="title" placeholder="Título (opcional)" [(ngModel)]="title" autocomplete="off" />
          <textarea class="input min-h-28 font-light text-[15px]" name="content" placeholder="Escribe aquí…" [(ngModel)]="content"></textarea>
          @if (!projectId()) {
            <select class="input" name="project" aria-label="Proyecto" [(ngModel)]="targetProject">
              <option value="">Sin proyecto</option>
              @for (p of projects.active(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          }
          <label class="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" class="size-4 accent-ink" name="private" [(ngModel)]="privateNote" />
            <app-icon name="lock" [size]="13" /> Solo para mí
            <span class="ml-auto text-xs text-ink-faint">{{ privateNote() ? '' : (projectId() || targetProject() ? 'la verá el equipo' : 'la verá el estudio') }}</span>
          </label>
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

        <div
          class="columns-1 gap-4 md:columns-2 2xl:columns-3"
          cdkDropList
          [cdkDropListSortingDisabled]="true"
          [cdkDropListConnectedTo]="sidebarDrops()"
        >
          @for (n of filtered(); track n.id) {
            <article
              cdkDrag
              [cdkDragData]="n"
              [cdkDragDisabled]="!canEdit(n) || editingId() === n.id"
              class="group relative mb-5 break-inside-avoid rounded-2xl p-5 shadow-[0_6px_16px_-10px_rgb(30_29_27/0.35)] transition-[rotate,translate,box-shadow] duration-200 rotate-(--tilt) hover:-translate-y-1 hover:rotate-0 hover:shadow-[0_14px_26px_-12px_rgb(30_29_27/0.35)]"
              [class]="sticky(n).bg"
              [style.--tilt]="sticky(n).tilt"
              [class.cursor-grab]="canEdit(n) && editingId() !== n.id"
              [attr.title]="canEdit(n) ? 'Arrastra la nota a un proyecto de la izquierda para moverla' : null"
            >
              @if (n.pinned) {
                <span class="absolute -top-1.5 left-6 size-3 rounded-full bg-shu ring-4 ring-paper" title="Fijada"></span>
              }
              <div class="flex items-start gap-2">
                <h3 class="flex-1 font-display leading-snug font-bold">{{ n.title || 'Sin título' }}</h3>
                @if (canEdit(n)) {
                  <button
                    class="btn btn-ghost btn-sm px-1.5"
                    [class.!text-shu]="n.pinned"
                    [attr.aria-label]="n.pinned ? 'Desfijar' : 'Fijar'"
                    (click)="notes.update(n, { pinned: !n.pinned })"
                  >
                    <app-icon name="bookmark" [size]="14" />
                  </button>
                }
              </div>

              @if (editingId() === n.id) {
                <textarea class="input mt-2 min-h-28 font-light text-[15px]" [value]="n.content" #editor></textarea>
                <div class="mt-2 flex justify-end gap-2">
                  <button class="btn btn-ghost btn-sm" (click)="editingId.set(null)">Cancelar</button>
                  <button class="btn btn-primary btn-sm" (click)="saveEdit(n, editor.value)">Guardar</button>
                </div>
              } @else {
                <p class="mt-2 font-light text-[15px] leading-relaxed whitespace-pre-line text-ink">{{ n.content }}</p>
              }

              <div class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                <app-avatar [member]="session.member(n.authorId)" [size]="18" />
                <span>{{ session.member(n.authorId)?.name }}</span>
                <span>·</span>
                <span>{{ ago(n.updatedAt) }}</span>
                @if (n.visibility === 'private') {
                  <span>·</span>
                  <span class="inline-flex items-center gap-1"><app-icon name="lock" [size]="12" />{{ visibilityLabel[n.visibility] }}</span>
                }
                @if (!projectId() && projects.byId(n.projectId); as p) {
                  <a [routerLink]="['/proyectos', p.id]" class="inline-flex items-center gap-1 hover:text-ink">
                    <span class="size-2 rounded-full" [style.background]="p.cover"></span>{{ p.name }}
                  </a>
                }
              </div>

              @if (n.linkedTaskId) {
                <button class="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-moss-soft px-2 py-1 text-xs text-moss hover:underline" (click)="panel.open(n.linkedTaskId!)">
                  <app-icon name="check-square" [size]="12" /> Convertida en tarea
                </button>
              }

              @if (canEdit(n) && editingId() !== n.id) {
                <div class="mt-3 flex flex-wrap items-center gap-1 border-t border-ink/10 pt-2.5 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100">
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
              <app-empty title="No hay notas" hint="Las ideas que captures aparecerán aquí." doodle="paper" />
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
  /** Soltar una nota sobre un proyecto de la barra lateral la asigna a ese proyecto. */
  protected readonly sidebarDrops = computed(() => this.projects.active().map((p) => projectDropId(p.id)));
  protected readonly notes = inject(NoteService);
  protected readonly panel = inject(TaskPanelService);
  private readonly toast = inject(ToastService);

  protected readonly visibilityLabel = VISIBILITY_LABEL;
  protected readonly filter = signal<Filter>('all');
  protected readonly query = signal('');
  protected readonly title = signal('');
  protected readonly content = signal('');
  protected readonly targetProject = signal('');
  /** Privada por defecto si no hay proyecto; compartida con el equipo si lo hay. */
  protected readonly privateNote = linkedSignal(() => !this.projectId() && !this.targetProject());
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

  /** Cada nota es un pósit: un tono suave de la paleta y una inclinación leve, estables por nota. */
  protected sticky(note: QuickNote): { bg: string; tilt: string } {
    let hash = 0;
    for (const ch of note.id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    const tints = ['bg-honey-soft', 'bg-ocean-soft', 'bg-moss-soft', 'bg-plum-soft', 'bg-coral-soft', 'bg-surface'];
    const tilts = ['-1deg', '0.7deg', '-0.4deg', '1deg', '0.3deg'];
    const h = Math.abs(hash);
    return { bg: tints[h % tints.length], tilt: tilts[h % tilts.length] };
  }

  protected canEdit(note: QuickNote): boolean {
    return note.authorId === this.session.currentUserId() || this.session.can('project.manage');
  }

  protected async create(): Promise<void> {
    const content = this.content().trim();
    if (!content) return;
    const projectId = this.projectId() || this.targetProject() || undefined;
    const visibility: NoteVisibility = this.privateNote() ? 'private' : projectId ? 'project' : 'workspace';
    await this.notes.create({ content, title: this.title().trim() || undefined, projectId, visibility });
    this.title.set('');
    this.content.set('');
    this.toast.show('Nota guardada');
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
    this.notes.remove(note);
  }

  protected ago(iso: string): string {
    return timeAgo(iso);
  }
}
