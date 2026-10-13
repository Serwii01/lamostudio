import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Id, TaskStatus } from '../core/models';
import { TaskService } from '../core/services/tasks';
import { Icon } from './ui/icon';

@Component({
  selector: 'app-task-quick-add',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon],
  host: { class: 'block' },
  template: `
    <form class="flex items-center gap-2" (ngSubmit)="add()">
      <label class="relative flex-1">
        <span class="sr-only">Nueva tarea</span>
        <app-icon name="plus" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
        <input class="input pl-9" name="title" [placeholder]="placeholder()" [(ngModel)]="title" autocomplete="off" />
      </label>
      <button class="btn btn-primary" type="submit" [disabled]="!title().trim()">Añadir</button>
    </form>
  `,
})
export class TaskQuickAdd {
  readonly projectId = input.required<Id>();
  readonly status = input<TaskStatus>('todo');
  readonly assigneeId = input<Id>();
  readonly placeholder = input('Añadir tarea y pulsar Enter…');

  private readonly tasks = inject(TaskService);
  protected readonly title = signal('');

  async add(): Promise<void> {
    const title = this.title().trim();
    if (!title) return;
    this.title.set('');
    await this.tasks.create({
      projectId: this.projectId(),
      title,
      status: this.status(),
      assigneeId: this.assigneeId(),
    });
  }
}
