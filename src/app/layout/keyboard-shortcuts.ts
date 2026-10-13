import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TASK_STATUS_ORDER } from '../core/catalog';
import { CommandsService, GO_TO } from '../core/services/commands';
import { SessionService } from '../core/services/session';
import {
  CommandUiService,
  NewTaskService,
  ProjectContextService,
  QuickCaptureService,
  TaskPanelService,
  ToastService,
} from '../core/services/ui-state';

const CHORD_TIMEOUT_MS = 1500;

/**
 * Escucha el teclado de toda la app y traduce cada atajo en una acción de
 * CommandsService. Las teclas solas no actúan mientras escribes en un campo.
 * Muestra en pantalla la primera tecla de una secuencia («G…») mientras espera la segunda.
 */
@Component({
  selector: 'app-keyboard-shortcuts',
  changeDetection: ChangeDetectionStrategy.OnPush,

  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    @if (ui.pendingChord(); as chord) {
      <div class="pointer-events-none fixed bottom-6 left-6 z-[60] flex items-center gap-2 rounded-full bg-ink py-2 pr-4 pl-3 text-sm text-surface shadow-lg" aria-live="polite">
        <kbd class="kbd border-surface/30 bg-transparent text-surface">{{ chord }}</kbd>
        <span class="text-surface/80">Ir a… I inicio · T tareas · P proyectos · N notas · B biblioteca · E equipo</span>
      </div>
    }
  `,
})
export class KeyboardShortcuts {
  protected readonly ui = inject(CommandUiService);
  private readonly commands = inject(CommandsService);
  private readonly session = inject(SessionService);
  private readonly panel = inject(TaskPanelService);
  private readonly capture = inject(QuickCaptureService);
  private readonly newTask = inject(NewTaskService);
  private readonly context = inject(ProjectContextService);
  private readonly toast = inject(ToastService);
  private chordTimer?: ReturnType<typeof setTimeout>;

  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing) return;
    const key = event.key.toLowerCase();
    const mod = event.ctrlKey || event.metaKey;

    // Ctrl/⌘+K funciona siempre, también escribiendo.
    if (mod && !event.shiftKey && key === 'k') {
      event.preventDefault();
      this.ui.paletteOpen.update((open) => !open);
      return;
    }
    if (this.ui.paletteOpen() || this.ui.helpOpen()) return;

    const typing = isTyping(event.target);
    if (mod && !event.shiftKey && key === 'z' && !typing) {
      if (this.toast.undoLast()) event.preventDefault();
      return;
    }
    if (mod || event.altKey || typing) return;
    if (this.capture.isOpen() || this.newTask.isOpen() || document.querySelector('app-file-preview')) return;

    // Secuencias «G + letra».
    if (this.ui.pendingChord()) {
      this.clearChord();
      const target = GO_TO[key];
      if (target && (target.path !== '/equipo' || this.session.can('team.viewLoad'))) {
        event.preventDefault();
        this.commands.goTo(target.path);
      }
      return;
    }
    if (key === 'g' && !event.shiftKey) {
      event.preventDefault();
      this.ui.pendingChord.set('G');
      this.chordTimer = setTimeout(() => this.clearChord(), CHORD_TIMEOUT_MS);
      return;
    }

    if (event.key === '?') {
      event.preventDefault();
      this.commands.help();
      return;
    }

    if (this.panel.openId()) {
      this.handleOpenTask(event, key);
      return;
    }

    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= 9 && this.context.projectId()) {
      event.preventDefault();
      this.commands.projectTab(digit - 1);
      return;
    }

    const focused = this.commands.targetTask();
    if (focused && event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      this.commands.moveColumn(focused, event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (event.shiftKey) return;

    const actions: Record<string, () => void> = {
      t: () => this.commands.newTask(),
      n: () => this.commands.newNote(),
      p: () => this.commands.newProject(),
      u: () => this.commands.uploadFiles(),
      v: () => this.commands.toggleTaskView(),
      '/': () => this.commands.search(),
      j: () => this.commands.step(1),
      k: () => this.commands.step(-1),
      x: () => focused && this.commands.toggleDone(focused),
      delete: () => focused && this.commands.remove(focused),
    };
    const action = actions[key];
    if (action) {
      event.preventDefault();
      action();
    }
  }

  /** Con el panel de una tarea abierto, las teclas actúan sobre esa tarea. */
  private handleOpenTask(event: KeyboardEvent, key: string): void {
    const task = this.commands.targetTask();
    if (!task || event.shiftKey) return;
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= TASK_STATUS_ORDER.length) {
      event.preventDefault();
      this.commands.setStatus(task, TASK_STATUS_ORDER[digit - 1]);
      return;
    }
    const actions: Record<string, () => void> = {
      b: () => this.commands.toggleBlocked(task),
      m: () => this.commands.assignToMe(task),
      j: () => this.commands.step(1),
      k: () => this.commands.step(-1),
      delete: () => this.commands.remove(task),
    };
    const action = actions[key];
    if (action) {
      event.preventDefault();
      action();
    }
  }

  private clearChord(): void {
    clearTimeout(this.chordTimer);
    this.ui.pendingChord.set(null);
  }
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');
}
