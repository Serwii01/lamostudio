import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PRIORITY, TASK_STATUS, TONE_TEXT, isTaskDone } from '../core/catalog';
import { Task } from '../core/models';
import { FileService } from '../core/services/files';
import { ProjectService } from '../core/services/projects';
import { SessionService } from '../core/services/session';
import { TaskService } from '../core/services/tasks';
import { TaskPanelService } from '../core/services/ui-state';
import { daysFromToday, relativeDue } from '../core/utils/dates';
import { Avatar } from './ui/avatar';
import { Badge } from './ui/badge';
import { TaskFileDrop } from './task-file-drop';
import { Icon } from './ui/icon';

const REDUCED_MOTION = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

@Component({
  selector: 'app-task-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge, Icon, TaskFileDrop],
  host: { class: 'block' },
  template: `
    <div
      class="group relative flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-ink/[0.03] focus-visible:bg-shu/[0.06] focus-visible:outline-offset-[-2px]"
      role="button"
      tabindex="0"
      [attr.data-task-id]="task().id"
      [appTaskFileDrop]="task()"
      (click)="panel.open(task().id)"
      (keydown.enter)="panel.open(task().id)"
    >
      @if (draggable()) {
        <span class="absolute top-1/2 left-1 -translate-y-1/2 text-ink-faint/60 opacity-0 transition-opacity group-hover:opacity-100" title="Arrastra para moverla" aria-hidden="true">
          <app-icon name="grip" [size]="14" [stroke]="3" />
        </span>
      }
      <button
        type="button"
        class="grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-full border-[1.5px] transition-colors disabled:cursor-default"
        [class]="done() ? 'pop border-ink/30 text-shu' : 'border-ink/30 text-transparent hover:border-ink hover:text-ink/30'"
        [disabled]="!canEdit()"
        [attr.aria-label]="done() ? 'Marcar como pendiente' : 'Marcar como hecha'"
        (click)="$event.stopPropagation(); toggle()"
      >
        @if (done()) {
          <!-- El check se dibuja (y el círculo salta) al completar la tarea. -->
          <svg viewBox="0 0 24 24" width="20" height="20" class="draw -mt-1 ml-1" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
            <path pathLength="1" d="M4.5 12.8c1.7.9 3.2 2.6 4.6 5 2.5-5.4 6-9.6 10.6-12.8" />
          </svg>
        } @else {
          <app-icon name="check-hand" [size]="20" [stroke]="2.6" class="-mt-1 ml-1" />
        }
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          @if (task().priority === 'urgent' || task().priority === 'high') {
            <app-icon name="flag" [size]="13" [class]="priorityClass()" [attr.title]="'Prioridad ' + priorityLabel()" />
          }
          <span class="truncate" [class.line-through]="done()" [class.text-ink-faint]="done()">{{ task().title }}</span>
          @if (task().blocked) {
            <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-coral-soft px-1.5 py-px text-[11px] font-medium text-coral" [attr.title]="task().blockedReason ?? 'Bloqueada'">
              <app-icon name="lock" [size]="11" /> bloqueada
            </span>
          }
        </div>
        @if (showProject() && project(); as p) {
          <div class="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
            <span class="size-2 rounded-full" [style.background]="p.cover"></span>{{ p.name }}
          </div>
        }
      </div>

      <div class="hidden items-center gap-1 lg:flex">
        @for (tag of task().tags.slice(0, 2); track tag) {
          <span class="text-xs text-ink-faint">#{{ tag }}</span>
        }
      </div>
      @if (attachments()) {
        <span class="hidden items-center gap-1 text-xs text-ink-faint sm:inline-flex" title="Adjuntos">
          <app-icon name="paperclip" [size]="13" />{{ attachments() }}
        </span>
      }
      @if (task().comments.length) {
        <span class="hidden items-center gap-1 text-xs text-ink-faint sm:inline-flex">
          <app-icon name="message" [size]="13" />{{ task().comments.length }}
        </span>
      }
      @if (showStatus()) {
        <span class="hidden sm:inline-flex"><app-badge [tone]="statusMeta().tone">{{ statusMeta().label }}</app-badge></span>
      }
      <span class="w-20 text-right text-xs whitespace-nowrap" [class]="dueClass()">{{ due() }}</span>
      <app-avatar [member]="assignee()" [size]="24" />
    </div>
  `,
})
export class TaskRow {
  readonly task = input.required<Task>();
  readonly showProject = input(false);
  /** Se oculta cuando la lista ya está agrupada por estado. */
  readonly showStatus = input(true);
  /** Muestra el asa de arrastre al pasar el ratón (cuando la fila se puede arrastrar). */
  readonly draggable = input(false);

  protected readonly tasks = inject(TaskService);
  protected readonly panel = inject(TaskPanelService);
  private readonly projects = inject(ProjectService);
  private readonly session = inject(SessionService);
  private readonly files = inject(FileService);

  protected readonly attachments = computed(() => this.files.countByTask().get(this.task().id) ?? 0);
  /** Mientras se completa, el check ya se ve dibujado aunque la tarea aún no haya cambiado. */
  private readonly completing = signal(false);
  protected readonly done = computed(() => this.completing() || isTaskDone(this.task().status));

  /**
   * Al completar, primero se dibuja el check y después la tarea cambia de estado (y
   * suele desaparecer de la lista): así se ve el gesto. Al reabrir, es inmediato.
   */
  protected toggle(): void {
    const task = this.task();
    if (isTaskDone(task.status) || this.completing()) {
      void this.tasks.toggleDone(task);
      return;
    }
    this.completing.set(true);
    setTimeout(() => {
      void this.tasks.toggleDone(task).finally(() => this.completing.set(false));
    }, REDUCED_MOTION ? 0 : 450);
  }
  protected readonly statusMeta = computed(() => TASK_STATUS[this.task().status]);
  protected readonly priorityLabel = computed(() => PRIORITY[this.task().priority].label);
  protected readonly priorityClass = computed(() => TONE_TEXT[PRIORITY[this.task().priority].tone]);
  protected readonly project = computed(() => this.projects.byId(this.task().projectId));
  protected readonly assignee = computed(() => this.session.member(this.task().assigneeId));
  protected readonly canEdit = computed(() => this.session.can('task.edit'));
  protected readonly due = computed(() => (this.task().dueAt ? relativeDue(this.task().dueAt) : ''));
  protected readonly dueClass = computed(() => {
    const dueAt = this.task().dueAt;
    if (!dueAt || this.done()) return 'text-ink-faint';
    const days = daysFromToday(dueAt);
    if (days < 0) return 'font-medium text-coral';
    if (days === 0) return 'font-medium text-honey';
    return 'text-ink-soft';
  });
}
