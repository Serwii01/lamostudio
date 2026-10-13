import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PRIORITY, TASK_STATUS, TONE_TEXT, isTaskDone } from '../core/catalog';
import { Task } from '../core/models';
import { ProjectService } from '../core/services/projects';
import { SessionService } from '../core/services/session';
import { TaskService } from '../core/services/tasks';
import { TaskPanelService } from '../core/services/ui-state';
import { daysFromToday, relativeDue } from '../core/utils/dates';
import { Avatar } from './ui/avatar';
import { Badge } from './ui/badge';
import { Icon } from './ui/icon';

@Component({
  selector: 'app-task-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge, Icon],
  host: { class: 'block' },
  template: `
    <div
      class="group flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-line-soft/60"
      role="button"
      tabindex="0"
      (click)="panel.open(task().id)"
      (keydown.enter)="panel.open(task().id)"
    >
      <button
        type="button"
        class="grid size-5 shrink-0 cursor-pointer place-items-center rounded-md border transition-colors disabled:cursor-default"
        [class]="done() ? 'border-moss bg-moss text-white' : 'border-line text-transparent hover:border-ink-faint hover:text-ink-faint'"
        [disabled]="!canEdit()"
        [attr.aria-label]="done() ? 'Marcar como pendiente' : 'Marcar como hecha'"
        (click)="$event.stopPropagation(); tasks.toggleDone(task())"
      >
        <app-icon name="check" [size]="13" [stroke]="2.5" />
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          @if (task().priority === 'urgent' || task().priority === 'high') {
            <app-icon name="flag" [size]="13" [class]="priorityClass()" [attr.title]="'Prioridad ' + priorityLabel()" />
          }
          <span class="truncate" [class.line-through]="done()" [class.text-ink-faint]="done()">{{ task().title }}</span>
          @if (task().status === 'blocked') {
            <app-icon name="lock" [size]="13" class="text-coral" />
          }
        </div>
        @if (showProject() && project(); as p) {
          <div class="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
            <span class="size-2 rounded-sm" [style.background]="p.cover"></span>{{ p.name }}
          </div>
        }
      </div>

      <div class="hidden items-center gap-1 lg:flex">
        @for (tag of task().tags.slice(0, 2); track tag) {
          <span class="rounded bg-line-soft px-1.5 py-0.5 text-[11px] text-ink-soft">{{ tag }}</span>
        }
      </div>
      @if (task().comments.length) {
        <span class="hidden items-center gap-1 text-xs text-ink-faint sm:inline-flex">
          <app-icon name="message" [size]="13" />{{ task().comments.length }}
        </span>
      }
      <span class="hidden sm:inline-flex"><app-badge [tone]="statusMeta().tone">{{ statusMeta().label }}</app-badge></span>
      <span class="w-20 text-right text-xs whitespace-nowrap" [class]="dueClass()">{{ due() }}</span>
      <app-avatar [member]="assignee()" [size]="24" />
    </div>
  `,
})
export class TaskRow {
  readonly task = input.required<Task>();
  readonly showProject = input(false);

  protected readonly tasks = inject(TaskService);
  protected readonly panel = inject(TaskPanelService);
  private readonly projects = inject(ProjectService);
  private readonly session = inject(SessionService);

  protected readonly done = computed(() => isTaskDone(this.task().status));
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
