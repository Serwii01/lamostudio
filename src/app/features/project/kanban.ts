import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PRIORITY, TASK_STATUS, TASK_STATUS_ORDER, TONE_FILL, TONE_TEXT } from '../../core/catalog';
import { Task, TaskStatus } from '../../core/models';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { TaskPanelService } from '../../core/services/ui-state';
import { daysFromToday, relativeDue } from '../../core/utils/dates';
import { TaskQuickAdd } from '../../shared/task-quick-add';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-kanban',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder, TaskQuickAdd, Avatar, Icon],
  template: `
    <div cdkDropListGroup class="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8">
      @for (col of columns(); track col.status) {
        <section class="flex w-72 shrink-0 flex-col rounded-xl border border-line bg-line-soft/60">
          <header class="flex h-11 items-center gap-2 px-3">
            <span class="size-2 rounded-full" [class]="fill[status[col.status].tone]"></span>
            <h2 class="font-medium">{{ status[col.status].label }}</h2>
            <span class="text-xs text-ink-faint">{{ col.tasks.length }}</span>
            @if (canEdit()) {
              <button
                class="btn btn-ghost btn-sm ml-auto px-1.5"
                [attr.aria-label]="'Añadir tarea en ' + status[col.status].label"
                (click)="addingTo.set(addingTo() === col.status ? null : col.status)"
              >
                <app-icon name="plus" [size]="14" />
              </button>
            }
          </header>

          @if (addingTo() === col.status) {
            <div class="px-2 pb-2">
              <app-task-quick-add [projectId]="projectId()" [status]="col.status" placeholder="Título…" />
            </div>
          }

          <div
            cdkDropList
            [id]="'col-' + col.status"
            [cdkDropListData]="col.status"
            [cdkDropListDisabled]="!canEdit()"
            (cdkDropListDropped)="drop($event)"
            class="flex min-h-28 flex-1 flex-col gap-2 px-2 pb-2"
          >
            @for (t of col.tasks; track t.id) {
              <article
                cdkDrag
                [cdkDragData]="t"
                class="card cursor-grab p-3 shadow-sm shadow-ink/[0.03] hover:border-ink-faint active:cursor-grabbing"
                [class.border-l-4]="t.status === 'blocked'"
                [class.!border-l-coral]="t.status === 'blocked'"
                tabindex="0"
                (click)="panel.open(t.id)"
                (keydown.enter)="panel.open(t.id)"
              >
                <div *cdkDragPlaceholder class="h-20 rounded-xl border-2 border-dashed border-line bg-surface/50"></div>
                @if (t.tags.length) {
                  <div class="mb-2 flex flex-wrap gap-1">
                    @for (tag of t.tags.slice(0, 2); track tag) {
                      <span class="rounded bg-line-soft px-1.5 py-0.5 text-[11px] text-ink-soft">{{ tag }}</span>
                    }
                  </div>
                }
                <p class="leading-snug font-medium">{{ t.title }}</p>
                <div class="mt-3 flex items-center gap-2.5 text-xs text-ink-faint">
                  @if (t.priority === 'urgent' || t.priority === 'high') {
                    <span class="inline-flex items-center gap-1" [class]="priorityText(t)">
                      <app-icon name="flag" [size]="12" />{{ priority[t.priority].label }}
                    </span>
                  }
                  @if (t.status === 'blocked') {
                    <app-icon name="lock" [size]="12" class="text-coral" />
                  }
                  @if (t.dueAt) {
                    <span [class]="dueClass(t)">{{ relative(t.dueAt) }}</span>
                  }
                  @if (t.subtasks.length) {
                    <span class="inline-flex items-center gap-1">
                      <app-icon name="check-square" [size]="12" />{{ doneSubtasks(t) }}/{{ t.subtasks.length }}
                    </span>
                  }
                  @if (t.comments.length) {
                    <span class="inline-flex items-center gap-1"><app-icon name="message" [size]="12" />{{ t.comments.length }}</span>
                  }
                  <app-avatar class="ml-auto" [member]="session.member(t.assigneeId)" [size]="22" />
                </div>
              </article>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class Kanban {
  readonly projectId = input.required<string>();

  protected readonly session = inject(SessionService);
  protected readonly panel = inject(TaskPanelService);
  private readonly tasks = inject(TaskService);

  protected readonly status = TASK_STATUS;
  protected readonly priority = PRIORITY;
  protected readonly fill = TONE_FILL;
  protected readonly addingTo = signal<TaskStatus | null>(null);
  protected readonly canEdit = computed(() => this.session.can('task.edit'));

  protected readonly columns = computed(() => {
    const tasks = this.tasks.byProject(this.projectId());
    return TASK_STATUS_ORDER.map((status) => ({ status, tasks: tasks.filter((t) => t.status === status) }));
  });

  protected drop(event: CdkDragDrop<TaskStatus>): void {
    const task = event.item.data as Task;
    const target = event.container.data;
    const column = this.columns().find((c) => c.status === target);
    if (!column) return;
    const ids = column.tasks.map((t) => t.id).filter((id) => id !== task.id);
    ids.splice(event.currentIndex, 0, task.id);
    void this.tasks.move(task, target, ids);
  }

  protected relative(iso: string): string {
    return relativeDue(iso);
  }

  protected dueClass(task: Task): string {
    const days = daysFromToday(task.dueAt!);
    if (days < 0) return 'font-medium text-coral';
    if (days === 0) return 'font-medium text-honey';
    return '';
  }

  protected priorityText(task: Task): string {
    return TONE_TEXT[PRIORITY[task.priority].tone];
  }

  protected doneSubtasks(task: Task): number {
    return task.subtasks.filter((s) => s.done).length;
  }
}
