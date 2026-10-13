import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Id } from '../core/models';
import { NoteService } from '../core/services/notes';
import { ProjectService } from '../core/services/projects';
import { TaskService } from '../core/services/tasks';
import { TaskPanelService } from '../core/services/ui-state';
import { normalize } from '../core/utils/text';
import { Icon } from '../shared/ui/icon';

@Component({
  selector: 'app-global-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon],
  host: { class: 'relative block' },
  template: `
    <label class="relative block">
      <span class="sr-only">Buscar</span>
      <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
      <input
        #field
        class="input h-10 rounded-full border-transparent bg-surface/70 pr-10 pl-9 focus:bg-surface"
        placeholder="Buscar proyectos, tareas o notas…"
        [(ngModel)]="query"
        (focus)="focused.set(true)"
        (blur)="focused.set(false)"
        (keydown.escape)="query.set('')"
        autocomplete="off"
      />
      @if (!focused()) {
        <kbd class="kbd pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">/</kbd>
      }
    </label>

    @if (focused() && results(); as r) {
      <div
        class="card absolute top-12 right-0 left-0 z-50 max-h-[70vh] overflow-y-auto p-1.5 shadow-xl shadow-ink/10"
        (mousedown)="$event.preventDefault()"
      >
        @if (r.projects.length) {
          <p class="eyebrow px-2.5 pt-2 pb-1">Proyectos</p>
          @for (p of r.projects; track p.id) {
            <button class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-ink/5" (click)="goProject(p.id)">
              <span class="size-2.5 shrink-0 rounded-full" [style.background]="p.cover"></span>
              <span class="truncate">{{ p.name }}</span>
              @if (p.client) {
                <span class="ml-auto truncate text-xs text-ink-faint">{{ p.client }}</span>
              }
            </button>
          }
        }
        @if (r.tasks.length) {
          <p class="eyebrow px-2.5 pt-2 pb-1">Tareas</p>
          @for (t of r.tasks; track t.id) {
            <button class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-ink/5" (click)="openTask(t.id)">
              <app-icon name="check-square" class="text-ink-faint" />
              <span class="truncate">{{ t.title }}</span>
              <span class="ml-auto truncate text-xs text-ink-faint">{{ projects.byId(t.projectId)?.name }}</span>
            </button>
          }
        }
        @if (r.notes.length) {
          <p class="eyebrow px-2.5 pt-2 pb-1">Notas</p>
          @for (n of r.notes; track n.id) {
            <button class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-ink/5" (click)="goNotes(n.projectId)">
              <app-icon name="note" class="text-ink-faint" />
              <span class="truncate">{{ n.title || n.content }}</span>
            </button>
          }
        }
        @if (!r.projects.length && !r.tasks.length && !r.notes.length) {
          <p class="px-3 py-4 text-ink-faint">Sin resultados para «{{ query() }}».</p>
        }
      </div>
    }
  `,
})
export class GlobalSearch {
  protected readonly projects = inject(ProjectService);
  private readonly tasks = inject(TaskService);
  private readonly notes = inject(NoteService);
  private readonly panel = inject(TaskPanelService);
  private readonly router = inject(Router);

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  protected readonly query = signal('');
  protected readonly focused = signal(false);

  protected readonly results = computed(() => {
    const q = normalize(this.query());
    if (q.length < 2) return null;
    const visible = new Set(this.projects.visible().map((p) => p.id));
    const matches = (...texts: (string | undefined)[]) => texts.some((t) => t && normalize(t).includes(q));
    return {
      projects: this.projects.visible().filter((p) => matches(p.name, p.client, ...p.tags)).slice(0, 5),
      tasks: this.tasks
        .all()
        .filter((t) => visible.has(t.projectId) && matches(t.title, ...t.tags))
        .slice(0, 6),
      notes: this.notes
        .visible()
        .filter((n) => (!n.projectId || visible.has(n.projectId)) && matches(n.title, n.content))
        .slice(0, 4),
    };
  });

  focus(): void {
    this.field().nativeElement.focus();
  }

  protected goProject(id: Id): void {
    this.reset();
    void this.router.navigate(['/proyectos', id]);
  }

  protected openTask(id: Id): void {
    this.reset();
    this.panel.open(id);
  }

  protected goNotes(projectId?: Id): void {
    this.reset();
    const project = this.projects.byId(projectId);
    if (project?.moduleIds.includes('notes')) {
      void this.router.navigate(['/proyectos', project.id, 'notas']);
    } else {
      void this.router.navigate(['/notas']);
    }
  }

  private reset(): void {
    this.query.set('');
    (document.activeElement as HTMLElement | null)?.blur();
  }
}
