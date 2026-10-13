import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaskView, TaskViewService } from '../core/services/ui-state';
import { Icon } from './ui/icon';

/** Conmutador Lista / Tablero: dos formas de ver las mismas tareas del proyecto. */
@Component({
  selector: 'app-task-view-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  host: { class: 'inline-flex' },
  template: `
    <div class="inline-flex rounded-full border border-line bg-surface p-0.5" role="group" aria-label="Cómo ver las tareas">
      @for (v of views; track v.id) {
        <a
          [routerLink]="['..', v.id]"
          class="inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors"
          [class]="current() === v.id ? 'bg-ink text-surface' : 'text-ink-soft hover:text-ink'"
          [attr.aria-current]="current() === v.id ? 'page' : null"
          (click)="prefs.set(v.id)"
        >
          <app-icon [name]="v.icon" [size]="14" />
          {{ v.label }}
        </a>
      }
    </div>
  `,
})
export class TaskViewSwitch {
  readonly current = input.required<TaskView>();
  protected readonly prefs = inject(TaskViewService);
  protected readonly views: { id: TaskView; label: string; icon: string }[] = [
    { id: 'tareas', label: 'Lista', icon: 'list' },
    { id: 'tablero', label: 'Tablero', icon: 'kanban' },
  ];
}
