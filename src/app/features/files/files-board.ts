import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, linkedSignal, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FileAsset, FileKind } from '../../core/models';
import { FileService } from '../../core/services/files';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { CommandUiService, TaskPanelService, ToastService } from '../../core/services/ui-state';
import { timeAgo } from '../../core/utils/dates';
import { FILE_KIND_META, MAX_UPLOAD_MB, formatBytes } from '../../core/utils/files';
import { normalize } from '../../core/utils/text';
import { Avatar } from '../../shared/ui/avatar';
import { Empty } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';
import { FilePreview } from './file-preview';

type KindFilter = 'all' | 'image' | 'video' | 'audio' | 'docs' | 'link';

const FILTERS: { id: KindFilter; label: string; kinds: FileKind[] }[] = [
  { id: 'all', label: 'Todo', kinds: [] },
  { id: 'image', label: 'Imágenes', kinds: ['image'] },
  { id: 'video', label: 'Vídeo', kinds: ['video'] },
  { id: 'audio', label: 'Audio', kinds: ['audio'] },
  { id: 'docs', label: 'Documentos', kinds: ['pdf', 'document', 'other'] },
  { id: 'link', label: 'Enlaces', kinds: ['link'] },
];

/**
 * Archivos y enlaces. Tres usos:
 * - Biblioteca (/biblioteca): todos los archivos visibles, eligiendo proyecto al subir.
 * - Módulo de proyecto (/proyectos/:id/archivos): los del proyecto.
 * - Compacto dentro del panel de tarea: los adjuntos de esa tarea.
 * Se puede soltar archivos en cualquier punto del componente.
 */
@Component({
  selector: 'app-files-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Avatar, Empty, Icon, FilePreview],
  host: {
    class: 'relative block',
    '(dragenter)': 'onDragEnter($event)',
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'onDragLeave($event)',
    '(drop)': 'onDrop($event)',
  },
  template: `
    @if (!projectId() && !compact()) {
      <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="page-title">Biblioteca</h1>
          <p class="hand mt-3 text-base">Todo lo subido, en un sitio.</p>
        </div>
        @if (storage(); as s) {
          <p class="text-xs text-ink-faint">{{ s }}</p>
        }
      </header>
    }

    <input #picker type="file" multiple class="hidden" (change)="onPick($event)" />

    @if (compact()) {
      <!-- Adjuntos de tarea -->
      @if (list().length) {
        <ul class="space-y-1">
          @for (f of list(); track f.id) {
            <li class="group flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-ink/[0.03]">
              <button class="grid size-10 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg bg-ink/[0.05] text-ink-soft" [attr.aria-label]="'Ver ' + f.name" (click)="preview.set(f)">
                @if (f.thumbnail) {
                  <img [src]="f.thumbnail" alt="" class="size-full object-cover" />
                } @else {
                  <app-icon [name]="icon(f)" [size]="17" />
                }
              </button>
              <button class="min-w-0 flex-1 cursor-pointer text-left" (click)="preview.set(f)">
                <span class="block truncate font-medium">{{ f.name }}</span>
                <span class="block text-xs text-ink-faint">{{ meta(f) }}</span>
              </button>
              <button class="btn btn-ghost size-8 px-0" [attr.aria-label]="f.url ? 'Abrir enlace' : 'Descargar'" (click)="f.url ? files.open(f) : files.download(f)">
                <app-icon [name]="f.url ? 'external' : 'download'" [size]="15" />
              </button>
              @if (canEdit()) {
                <button class="btn btn-ghost size-8 px-0 hover:text-coral" aria-label="Quitar adjunto" (click)="files.remove(f)">
                  <app-icon name="trash" [size]="15" />
                </button>
              }
            </li>
          }
        </ul>
      }
      @if (canUpload()) {
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <button class="btn btn-outline btn-sm h-8" (click)="picker.click()"><app-icon name="paperclip" [size]="14" /> Adjuntar archivo</button>
          <button class="btn btn-ghost btn-sm h-8" (click)="linkOpen.set(!linkOpen())"><app-icon name="link" [size]="14" /> Enlace</button>
          @if (!list().length) {
            <span class="text-xs text-ink-faint">o suelta archivos aquí</span>
          }
        </div>
      }
    } @else if (canUpload()) {
      <!-- Zona de subida -->
      <section class="card overflow-hidden">
        <div class="flex flex-col items-center gap-4 px-6 py-7 text-center sm:flex-row sm:text-left">
          <span class="grid size-14 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-ink/30 text-ink-soft">
            <app-icon name="upload" [size]="22" />
          </span>
          <div class="flex-1">
            <p class="font-display font-bold">Arrastra archivos aquí</p>
            <p class="text-sm text-ink-soft">
              Hasta {{ maxMb }} MB. Para brutos pesados, pega un enlace.
            </p>
          </div>
          <div class="flex flex-wrap justify-center gap-2">
            <button class="btn btn-primary" (click)="picker.click()"><app-icon name="upload" /> Elegir archivos</button>
            <button class="btn btn-outline" (click)="linkOpen.set(!linkOpen())"><app-icon name="link" /> Pegar enlace</button>
          </div>
        </div>
        @if (!projectId()) {
          <div class="flex flex-wrap items-center gap-2 border-t border-line/60 px-6 py-3 text-sm">
            <label for="upload-project" class="text-ink-soft">Guardar en</label>
            <select id="upload-project" class="input h-8 w-auto max-w-full rounded-full" [(ngModel)]="targetProject">
              @for (p of projects.active(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          </div>
        }
      </section>
    }

    @if (linkOpen()) {
      <form class="mt-3 flex flex-col gap-2 sm:flex-row" [class.card]="!compact()" [class.p-4]="!compact()" (ngSubmit)="addLink()">
        <input class="input flex-[2]" name="url" placeholder="https://drive.google.com/…  ·  Frame.io  ·  Vimeo…" [(ngModel)]="linkUrl" autocomplete="off" />
        <input class="input flex-1" name="name" placeholder="Nombre (opcional)" [(ngModel)]="linkName" autocomplete="off" />
        <div class="flex gap-2">
          <button class="btn btn-primary" type="submit" [disabled]="!linkUrl().trim()">Añadir</button>
          <button class="btn btn-ghost" type="button" (click)="linkOpen.set(false)">Cancelar</button>
        </div>
      </form>
    }

    @if (uploading().length) {
      <ul class="mt-3 space-y-1.5" aria-live="polite">
        @for (name of uploading(); track $index) {
          <li class="flex items-center gap-2 text-sm text-ink-soft">
            <span class="size-3 animate-spin rounded-full border-2 border-ink/20 border-t-shu"></span>
            Subiendo «{{ name }}»…
          </li>
        }
      </ul>
    }

    @if (!compact()) {
      <div class="mt-6 flex flex-wrap items-center gap-2">
        @for (f of filters; track f.id) {
          <button class="chip" [class.chip-active]="filter() === f.id" (click)="filter.set(f.id)">
            {{ f.label }}
            @if (counts()[f.id]; as n) {
              <span class="opacity-60">{{ n }}</span>
            }
          </button>
        }
        <label class="relative ml-auto w-full sm:w-56">
          <span class="sr-only">Buscar archivos</span>
          <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
          <input class="input h-8 rounded-full pl-9" placeholder="Buscar…" [(ngModel)]="query" />
        </label>
      </div>

      <div class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        @for (f of filtered(); track f.id) {
          <article class="card group flex flex-col overflow-hidden transition-[border-color,box-shadow] hover:border-ink-faint hover:shadow-lg hover:shadow-ink/5">
            <button class="relative block aspect-[4/3] w-full cursor-pointer overflow-hidden bg-ink/[0.04]" [attr.aria-label]="'Ver ' + f.name" (click)="preview.set(f)">
              @if (f.thumbnail) {
                <img [src]="f.thumbnail" alt="" loading="lazy" class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              } @else {
                <span class="flex size-full flex-col items-center justify-center gap-2 text-ink-faint">
                  <app-icon [name]="icon(f)" [size]="30" [stroke]="1.4" />
                  <span class="font-light text-sm">{{ f.provider ?? extension(f) }}</span>
                </span>
              }
              @if (f.kind === 'video') {
                <span class="absolute right-2 bottom-2 grid size-7 place-items-center rounded-full bg-ink/70 text-surface">
                  <app-icon name="play" [size]="12" />
                </span>
              }
            </button>
            <div class="flex flex-1 flex-col gap-1 p-3">
              <p class="truncate font-medium" [attr.title]="f.name">{{ f.name }}</p>
              <p class="truncate text-xs text-ink-faint">{{ meta(f) }}</p>
              <div class="mt-auto flex items-center gap-1.5 pt-2">
                <app-avatar [member]="session.member(f.uploadedBy)" [size]="20" />
                @if (!projectId() && projects.byId(f.projectId); as p) {
                  <a [routerLink]="['/proyectos', p.id, 'archivos']" class="flex min-w-0 items-center gap-1 text-xs text-ink-faint hover:text-ink">
                    <span class="size-2 shrink-0 rounded-full" [style.background]="p.cover"></span>
                    <span class="truncate">{{ p.name }}</span>
                  </a>
                }
                @if (taskTitle(f); as title) {
                  <button class="flex min-w-0 cursor-pointer items-center gap-1 text-xs text-ink-faint hover:text-ink" (click)="panel.open(f.taskId!)">
                    <app-icon name="paperclip" [size]="11" /><span class="truncate">{{ title }}</span>
                  </button>
                }
                <span class="ml-auto flex shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button class="btn btn-ghost size-7 px-0" [attr.aria-label]="f.url ? 'Abrir enlace' : 'Descargar'" (click)="f.url ? files.open(f) : files.download(f)">
                    <app-icon [name]="f.url ? 'external' : 'download'" [size]="14" />
                  </button>
                  @if (canEdit()) {
                    <button class="btn btn-ghost size-7 px-0 hover:text-coral" aria-label="Eliminar" (click)="files.remove(f)">
                      <app-icon name="trash" [size]="14" />
                    </button>
                  }
                </span>
              </div>
            </div>
          </article>
        } @empty {
          <div class="card col-span-full">
            @if (scoped().length) {
              <app-empty title="Nada con ese filtro" hint="Prueba con otro tipo o búsqueda." [compact]="true" />
            } @else {
              <app-empty title="Aún no hay archivos" hint="Arrastra archivos o pega un enlace." doodle="paper" />
            }
          </div>
        }
      </div>
    }

    @if (dragging() && canUpload()) {
      <div
        class="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-shu bg-paper/85 backdrop-blur-[1px]"
        [class.min-h-28]="compact()"
      >
        <p class="flex items-center gap-2 font-display font-bold text-shu">
          <app-icon name="upload" [size]="20" /> Suelta para subir
        </p>
      </div>
    }

    @if (preview(); as f) {
      <app-file-preview [file]="f" (closed)="preview.set(null)" />
    }
  `,
})
export class FilesBoard {
  /** Proyecto (desde la ruta o el panel de tarea). Vacío en la Biblioteca. */
  readonly projectId = input<string>();
  /** Si se indica, solo muestra y adjunta archivos de esa tarea. */
  readonly taskId = input<string>();
  readonly compact = input(false);

  protected readonly files = inject(FileService);
  protected readonly projects = inject(ProjectService);
  protected readonly session = inject(SessionService);
  protected readonly panel = inject(TaskPanelService);
  private readonly tasks = inject(TaskService);
  private readonly toast = inject(ToastService);

  protected readonly filters = FILTERS;
  protected readonly maxMb = MAX_UPLOAD_MB;
  protected readonly filter = signal<KindFilter>('all');
  protected readonly query = signal('');
  protected readonly linkOpen = signal(false);
  protected readonly linkUrl = signal('');
  protected readonly linkName = signal('');
  protected readonly uploading = signal<string[]>([]);
  protected readonly dragging = signal(false);
  protected readonly preview = signal<FileAsset | null>(null);
  protected readonly storage = signal<string | null>(null);
  private dragDepth = 0;

  /** Proyecto de destino en la Biblioteca: el primero activo hasta que el usuario elija. */
  protected readonly targetProject = linkedSignal(() => this.projects.active()[0]?.id ?? '');

  protected readonly canEdit = computed(() => this.files.canEdit());
  protected readonly canUpload = computed(() => this.canEdit() && !!(this.projectId() || this.targetProject()));

  /** Archivos del ámbito actual (biblioteca, proyecto o tarea), sin filtros de la UI. */
  protected readonly scoped = computed(() => {
    const projectId = this.projectId();
    const taskId = this.taskId();
    return this.files
      .visible()
      .filter((f) => (!projectId || f.projectId === projectId) && (!taskId || f.taskId === taskId));
  });

  protected readonly list = this.scoped;

  protected readonly counts = computed(() => {
    const counts: Partial<Record<KindFilter, number>> = {};
    for (const f of FILTERS) {
      counts[f.id] = f.id === 'all' ? this.scoped().length : this.scoped().filter((x) => f.kinds.includes(x.kind)).length;
    }
    return counts;
  });

  protected readonly filtered = computed(() => {
    const kinds = FILTERS.find((f) => f.id === this.filter())!.kinds;
    const q = normalize(this.query());
    return this.scoped().filter(
      (f) => (!kinds.length || kinds.includes(f.kind)) && (!q || normalize(`${f.name} ${f.provider ?? ''}`).includes(q)),
    );
  });

  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  constructor() {
    // «U» (o «Subir archivos» en la paleta): abre el selector del tablero completo, no del compacto.
    const ui = inject(CommandUiService);
    const initial = ui.pickFiles();
    effect(() => {
      const request = ui.pickFiles();
      if (request !== initial && !this.compact() && untracked(() => this.canUpload())) {
        this.picker().nativeElement.click();
      }
    });

    void navigator.storage?.estimate?.().then(({ usage }) => {
      if (usage) this.storage.set(`${formatBytes(usage)} usados en este navegador`);
    });
  }

  protected icon(file: FileAsset): string {
    return FILE_KIND_META[file.kind].icon;
  }

  protected extension(file: FileAsset): string {
    const dot = file.name.lastIndexOf('.');
    return dot > 0 ? file.name.slice(dot + 1).toUpperCase() : FILE_KIND_META[file.kind].label;
  }

  protected meta(file: FileAsset): string {
    const kind = file.provider ?? FILE_KIND_META[file.kind].label;
    return [kind, formatBytes(file.size), timeAgo(file.createdAt)].filter(Boolean).join(' · ');
  }

  protected taskTitle(file: FileAsset): string | undefined {
    return this.taskId() ? undefined : this.tasks.byId(file.taskId)?.title;
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.upload([...(input.files ?? [])]);
    input.value = '';
  }

  protected async addLink(): Promise<void> {
    const projectId = this.projectId() || this.targetProject();
    if (!projectId) return;
    const error = await this.files.addLink(this.linkUrl(), this.linkName(), { projectId, taskId: this.taskId() });
    if (error) {
      this.toast.error(error);
      return;
    }
    this.linkUrl.set('');
    this.linkName.set('');
    this.linkOpen.set(false);
    this.toast.show('Enlace añadido');
  }

  // --- Arrastrar y soltar --------------------------------------------------

  protected onDragEnter(event: DragEvent): void {
    if (!hasFiles(event) || !this.canUpload()) return;
    event.preventDefault();
    this.dragDepth += 1;
    this.dragging.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (!hasFiles(event) || !this.canUpload()) return;
    event.preventDefault();
    // Evita que el panel de tarea y un tablero de fondo reciban el mismo archivo.
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  protected onDragLeave(event: DragEvent): void {
    if (!hasFiles(event)) return;
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (!this.dragDepth) this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth = 0;
    this.dragging.set(false);
    if (this.canUpload()) void this.upload([...(event.dataTransfer?.files ?? [])]);
  }

  private async upload(selected: File[]): Promise<void> {
    const projectId = this.projectId() || this.targetProject();
    if (!selected.length || !projectId) return;
    this.uploading.update((list) => [...list, ...selected.map((f) => f.name)]);
    const result = await this.files.upload(selected, { projectId, taskId: this.taskId() });
    this.uploading.update((list) => list.slice(selected.length));
    for (const error of result.errors) this.toast.error(error);
    const n = result.uploaded.length;
    if (n) this.toast.show(n === 1 ? `«${result.uploaded[0].name}» subido` : `${n} archivos subidos`);
  }
}

function hasFiles(event: DragEvent): boolean {
  return !!event.dataTransfer?.types.includes('Files');
}

