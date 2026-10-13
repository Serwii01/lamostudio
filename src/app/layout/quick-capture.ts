import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NoteVisibility } from '../core/models';
import { NoteService } from '../core/services/notes';
import { ProjectService } from '../core/services/projects';
import { QuickCaptureService, ToastService } from '../core/services/ui-state';
import { Icon } from '../shared/ui/icon';

/** Captura de ideas de baja fricción, disponible desde cualquier pantalla. */
@Component({
  selector: 'app-quick-capture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon],
  host: { '(document:keydown.escape)': 'capture.close()' },
  template: `
    <div class="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-[12vh] backdrop-blur-[2px]" (click)="capture.close()">
      <form
        class="card w-full max-w-lg p-6 shadow-2xl shadow-ink/15"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-capture-title"
        (click)="$event.stopPropagation()"
        (ngSubmit)="save()"
      >
        <div class="mb-3 flex items-center justify-between">
          <h2 id="quick-capture-title" class="card-title">Nota rápida</h2>
          <button type="button" class="btn btn-ghost btn-sm" aria-label="Cerrar" (click)="capture.close()">
            <app-icon name="x" />
          </button>
        </div>

        <input class="input mb-2 font-medium" name="title" placeholder="Título (opcional)" [(ngModel)]="title" autocomplete="off" />
        <textarea
          #contentField
          class="input min-h-36 resize-y font-hand text-base"
          name="content"
          placeholder="Escribe una idea, un acuerdo de reunión, un recordatorio…"
          [(ngModel)]="content"
          (keydown.control.enter)="save()"
          (keydown.meta.enter)="save()"
        ></textarea>

        <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label class="flex-1">
            <span class="sr-only">Proyecto</span>
            <select class="input" name="project" [(ngModel)]="projectId">
              <option value="">Sin proyecto</option>
              @for (p of projects.active(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          </label>
          <label class="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" class="size-4 accent-ink" name="private" [(ngModel)]="privateNote" />
            <app-icon name="lock" [size]="13" /> Solo para mí
          </label>
        </div>

        <div class="mt-5 flex items-center justify-between gap-3">
          <span class="hidden text-xs text-ink-faint sm:inline">Ctrl + Enter para guardar</span>
          <div class="ml-auto flex gap-2">
            <button type="button" class="btn btn-ghost" (click)="capture.close()">Cancelar</button>
            <button type="submit" class="btn btn-primary" [disabled]="!content().trim()">Guardar nota</button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class QuickCapture {
  protected readonly capture = inject(QuickCaptureService);
  protected readonly projects = inject(ProjectService);
  private readonly notes = inject(NoteService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  private readonly contentRef = viewChild.required<ElementRef<HTMLTextAreaElement>>('contentField');

  protected readonly title = signal('');
  protected readonly content = signal('');
  /** Si se abre dentro de un proyecto, la nota se asocia a él por defecto. */
  protected readonly projectId = signal(this.router.url.match(/^\/proyectos\/([^/?]+)/)?.[1] ?? '');
  /** Privada por defecto si no hay proyecto; compartida con el equipo si lo hay. */
  protected readonly privateNote = linkedSignal(() => !this.projectId());

  constructor() {
    if (this.projectId() === 'nuevo') this.projectId.set('');
    afterNextRender(() => this.contentRef().nativeElement.focus());
  }

  async save(): Promise<void> {
    const content = this.content().trim();
    if (!content) return;
    const projectId = this.projectId() || undefined;
    const visibility: NoteVisibility = this.privateNote() ? 'private' : projectId ? 'project' : 'workspace';
    await this.notes.create({ content, title: this.title().trim() || undefined, projectId, visibility });
    this.toast.show('Nota guardada');
    this.capture.close();
  }
}
