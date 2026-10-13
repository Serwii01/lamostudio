import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { isTaskDone } from '../core/catalog';
import { Command, CommandsService } from '../core/services/commands';
import { NoteService } from '../core/services/notes';
import { ProjectService } from '../core/services/projects';
import { TaskService } from '../core/services/tasks';
import { CommandUiService, TaskPanelService } from '../core/services/ui-state';
import { normalize } from '../core/utils/text';
import { Icon } from '../shared/ui/icon';
import { Keys } from '../shared/ui/keys';

/**
 * Paleta de comandos (Ctrl/⌘+K): escribe lo que quieres hacer o lo que buscas.
 * Reúne acciones, navegación y resultados de búsqueda en una sola lista navegable
 * con ↑ ↓ y Enter.
 */
@Component({
  selector: 'app-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon, Keys],
  template: `
    <div class="fixed inset-0 z-[58] flex items-start justify-center bg-ink/30 px-4 pt-[10vh] backdrop-blur-[2px]" (click)="close()">
      <div
        class="card flex max-h-[75vh] w-full max-w-xl flex-col overflow-hidden shadow-2xl shadow-ink/20"
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        (click)="$event.stopPropagation()"
      >
        <label class="flex items-center gap-3 border-b border-line/70 px-5">
          <app-icon name="search" [size]="18" class="text-ink-faint" />
          <span class="sr-only">Comando o búsqueda</span>
          <input
            #field
            class="h-14 flex-1 bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none"
            placeholder="¿Qué quieres hacer?"
            role="combobox"
            aria-controls="palette-list"
            [attr.aria-activedescendant]="items()[active()] ? 'palette-' + active() : null"
            [ngModel]="query()"
            (ngModelChange)="query.set($event); active.set(0)"
            (keydown)="onKeydown($event)"
            autocomplete="off"
          />
          <kbd class="kbd">Esc</kbd>
        </label>

        <ul id="palette-list" class="flex-1 overflow-y-auto p-2" role="listbox">
          @for (item of items(); track item.id; let i = $index) {
            @if (i === 0 || items()[i - 1].group !== item.group) {
              <li class="eyebrow px-3 pt-3 pb-1.5" role="presentation">{{ item.group }}</li>
            }
            <li
              [id]="'palette-' + i"
              role="option"
              [attr.aria-selected]="i === active()"
              class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5"
              [class.bg-ink]="i === active()"
              [class.text-surface]="i === active()"
              (mousemove)="active.set(i)"
              (click)="run(item)"
            >
              <app-icon [name]="item.icon" [size]="16" [class]="i === active() ? 'text-surface/80' : 'text-ink-faint'" />
              <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
              @if (item.keys) {
                <app-keys [keys]="item.keys" [class.opacity-70]="i === active()" />
              }
            </li>
          } @empty {
            <li class="px-4 py-10 text-center">
              <p class="font-display font-bold">Nada con «{{ query() }}»</p>
              <p class="hand mt-1">Prueba «tarea», «tablero» o «subir».</p>
            </li>
          }
        </ul>

        <footer class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/70 px-5 py-2.5 text-xs text-ink-faint">
          <span class="flex items-center gap-1"><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd> moverse</span>
          <span class="flex items-center gap-1"><kbd class="kbd">Enter</kbd> ejecutar</span>
          <span class="ml-auto flex items-center gap-1"><kbd class="kbd">?</kbd> todos los atajos</span>
        </footer>
      </div>
    </div>
  `,
})
export class CommandPalette {
  private readonly ui = inject(CommandUiService);
  private readonly commands = inject(CommandsService);
  private readonly projects = inject(ProjectService);
  private readonly tasks = inject(TaskService);
  private readonly notes = inject(NoteService);
  private readonly panel = inject(TaskPanelService);
  private readonly router = inject(Router);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  protected readonly query = signal('');
  protected readonly active = signal(0);

  protected readonly items = computed<Command[]>(() => {
    const q = normalize(this.query());
    const all = this.commands.commands();
    if (!q) return all;

    const matches = (text: string) => normalize(text).includes(q);
    const visible = new Set(this.projects.visible().map((p) => p.id));
    const found: Command[] = all.filter((c) => matches(`${c.label} ${c.group}`));

    for (const p of this.projects.visible().filter((p) => matches(`${p.name} ${p.client ?? ''}`)).slice(0, 5)) {
      found.push({ id: `project-${p.id}`, group: 'Proyectos', icon: 'folder', label: p.name, run: () => void this.router.navigate(['/proyectos', p.id]) });
    }
    const tasks = this.tasks
      .all()
      .filter((t) => visible.has(t.projectId) && matches(t.title))
      .sort((a, b) => Number(isTaskDone(a.status)) - Number(isTaskDone(b.status)))
      .slice(0, 6);
    for (const t of tasks) {
      found.push({ id: `task-${t.id}`, group: 'Tareas', icon: 'check-square', label: t.title, run: () => this.panel.open(t.id) });
    }
    for (const n of this.notes.visible().filter((n) => matches(`${n.title ?? ''} ${n.content}`)).slice(0, 4)) {
      const project = this.projects.byId(n.projectId);
      const path = project?.moduleIds.includes('notes') ? ['/proyectos', project.id, 'notas'] : ['/notas'];
      found.push({ id: `note-${n.id}`, group: 'Notas', icon: 'note', label: n.title || n.content.slice(0, 60), run: () => void this.router.navigate(path) });
    }
    return found;
  });

  constructor() {
    afterNextRender(() => this.field().nativeElement.focus());
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.items().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!count) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active.set((this.active() + step + count) % count);
      document.getElementById(`palette-${this.active()}`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.items()[this.active()];
      if (item) this.run(item);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  }

  protected run(item: Command): void {
    this.close();
    // Tras cerrar, para que diálogos y foco no compitan con la paleta.
    setTimeout(() => item.run());
  }

  protected close(): void {
    this.ui.paletteOpen.set(false);
  }
}
