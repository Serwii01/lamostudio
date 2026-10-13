import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { FileAsset } from '../../core/models';
import { FileService } from '../../core/services/files';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { TaskPanelService } from '../../core/services/ui-state';
import { formatShortDate } from '../../core/utils/dates';
import { FILE_KIND_META, formatBytes } from '../../core/utils/files';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';

/** Visor a pantalla completa: imagen, vídeo, audio y PDF dentro de la app; el resto, descarga. */
@Component({
  selector: 'app-file-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, Avatar, Icon],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="fixed inset-0 z-[55] flex flex-col bg-ink/80 backdrop-blur-sm" role="dialog" aria-modal="true" [attr.aria-label]="file().name">
      <header class="flex flex-wrap items-center gap-3 px-4 py-3 text-surface sm:px-6">
        <app-icon [name]="meta().icon" class="text-surface/70" />
        <div class="min-w-0 flex-1">
          @if (canEdit()) {
            <input
              class="w-full truncate rounded-md bg-transparent px-1 font-medium text-surface hover:bg-white/10 focus:bg-white/10 focus:outline-none"
              aria-label="Nombre del archivo"
              [value]="file().name"
              (change)="files.rename(file(), $any($event.target).value)"
              (keydown.enter)="$any($event.target).blur()"
            />
          } @else {
            <p class="truncate px-1 font-medium">{{ file().name }}</p>
          }
          <p class="px-1 text-xs text-surface/60">
            {{ file().provider ?? meta().label }}
            @if (file().size) { · {{ size() }} }
            · {{ date() }}
            @if (project(); as p) { · {{ p.name }} }
          </p>
        </div>
        <div class="flex items-center gap-1">
          @if (file().url) {
            <button class="btn btn-sm h-8 bg-surface text-ink hover:bg-paper" (click)="files.open(file())">
              <app-icon name="external" [size]="14" /> Abrir en {{ file().provider }}
            </button>
          } @else {
            <button class="btn btn-sm h-8 bg-surface text-ink hover:bg-paper" (click)="files.download(file())">
              <app-icon name="download" [size]="14" /> Descargar
            </button>
          }
          @if (canEdit()) {
            <button class="btn btn-sm h-8 text-surface/80 hover:bg-white/10 hover:text-surface" (click)="remove()">
              <app-icon name="trash" [size]="14" /> Eliminar
            </button>
          }
          <button class="btn h-9 w-9 px-0 text-surface hover:bg-white/10" aria-label="Cerrar" (click)="closed.emit()">
            <app-icon name="x" [size]="18" />
          </button>
        </div>
      </header>

      <div class="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8" (click)="closed.emit()">
        <div class="flex max-h-full max-w-full items-center justify-center" (click)="$event.stopPropagation()">
          @switch (file().kind) {
            @case ('image') {
              @if (url(); as src) {
                <img [src]="src" [alt]="file().name" class="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl" />
              } @else {
                <ng-container [ngTemplateOutlet]="loading" />
              }
            }
            @case ('video') {
              @if (url(); as src) {
                <video [src]="src" controls autoplay class="max-h-[80vh] max-w-full rounded-lg bg-black shadow-2xl"></video>
              } @else {
                <ng-container [ngTemplateOutlet]="loading" />
              }
            }
            @case ('audio') {
              <div class="card flex w-[min(28rem,90vw)] flex-col items-center gap-4 p-8">
                <app-icon name="music" [size]="40" class="text-shu" />
                @if (url(); as src) {
                  <audio [src]="src" controls autoplay class="w-full"></audio>
                }
              </div>
            }
            @case ('pdf') {
              @if (frameUrl(); as src) {
                <iframe [src]="src" title="Vista previa del PDF" class="h-[80vh] w-[min(60rem,92vw)] rounded-lg bg-surface shadow-2xl"></iframe>
              } @else {
                <ng-container [ngTemplateOutlet]="loading" />
              }
            }
            @default {
              <div class="card flex w-[min(26rem,90vw)] flex-col items-center gap-3 p-8 text-center">
                <span class="grid size-16 place-items-center rounded-full border-[1.5px] border-dashed border-ink/25 text-ink-soft">
                  <app-icon [name]="meta().icon" [size]="26" />
                </span>
                <p class="font-display font-bold break-all">{{ file().name }}</p>
                @if (file().url) {
                  <p class="text-sm text-ink-soft break-all">{{ file().url }}</p>
                  <button class="btn btn-primary mt-2" (click)="files.open(file())">
                    <app-icon name="external" [size]="14" /> Abrir en {{ file().provider }}
                  </button>
                } @else {
                  <p class="hand">Este tipo de archivo no se puede previsualizar.</p>
                  <button class="btn btn-primary mt-2" (click)="files.download(file())">
                    <app-icon name="download" [size]="14" /> Descargar
                  </button>
                }
              </div>
            }
          }
        </div>
      </div>

      <footer class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-4 text-xs text-surface/70">
        <span class="flex items-center gap-1.5">
          <app-avatar [member]="session.member(file().uploadedBy)" [size]="18" />
          {{ session.member(file().uploadedBy)?.name }}
        </span>
        @if (task(); as t) {
          <button class="flex items-center gap-1 hover:text-surface" (click)="openTask(t.id)">
            <app-icon name="paperclip" [size]="12" /> Adjunto a «{{ t.title }}»
          </button>
        }
        @if (project(); as p) {
          <a [routerLink]="['/proyectos', p.id, 'archivos']" class="hover:text-surface" (click)="closed.emit()">Ver archivos del proyecto</a>
        }
      </footer>
    </div>

    <ng-template #loading>
      <p class="hand text-surface/80">Cargando…</p>
    </ng-template>
  `,
})
export class FilePreview {
  readonly file = input.required<FileAsset>();
  readonly closed = output<void>();

  protected readonly files = inject(FileService);
  protected readonly session = inject(SessionService);
  private readonly projects = inject(ProjectService);
  private readonly tasks = inject(TaskService);
  private readonly panel = inject(TaskPanelService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly url = signal<string | null>(null);
  protected readonly meta = computed(() => FILE_KIND_META[this.file().kind]);
  protected readonly size = computed(() => formatBytes(this.file().size));
  protected readonly date = computed(() => formatShortDate(this.file().createdAt));
  protected readonly project = computed(() => this.projects.byId(this.file().projectId));
  protected readonly task = computed(() => this.tasks.byId(this.file().taskId));
  protected readonly canEdit = computed(() => this.files.canEdit());

  /** Solo se confía en URLs blob: creadas por la propia app para el iframe del PDF. */
  protected readonly frameUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.url();
    return url?.startsWith('blob:') ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  constructor() {
    effect(() => {
      const file = this.file();
      this.url.set(null);
      if (file.kind !== 'link') void this.files.contentUrl(file).then((url) => this.url.set(url));
    });
  }

  protected remove(): void {
    this.files.remove(this.file());
    this.closed.emit();
  }

  protected openTask(id: string): void {
    this.closed.emit();
    this.panel.open(id);
  }
}
