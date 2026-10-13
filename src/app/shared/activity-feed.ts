import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { ACTIVITY_PHRASE } from '../core/catalog';
import { ActivityEntry } from '../core/models';
import { ProjectService } from '../core/services/projects';
import { SessionService } from '../core/services/session';
import { TaskService } from '../core/services/tasks';
import { TaskPanelService } from '../core/services/ui-state';
import { timeAgo } from '../core/utils/dates';
import { Avatar } from './ui/avatar';

@Component({
  selector: 'app-activity-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar],
  host: { class: 'block' },
  template: `
    <ol class="space-y-4">
      @for (e of entries(); track e.id) {
        <li class="flex gap-3">
          <app-avatar [member]="session.member(e.actorId)" [size]="26" />
          <div class="min-w-0 flex-1 leading-snug">
            <p class="text-ink-soft">
              <span class="font-medium text-ink">{{ session.member(e.actorId)?.name ?? 'Alguien' }}</span>
              {{ phrase(e) }}
              @if (canOpen(e)) {
                <button type="button" class="cursor-pointer text-left font-medium text-ink hover:underline" (click)="open(e)">
                  {{ e.targetLabel }}
                </button>
              } @else {
                <span class="font-medium text-ink">{{ e.targetLabel }}</span>
              }
            </p>
            <p class="mt-0.5 text-xs text-ink-faint">
              {{ ago(e.createdAt) }}
              @if (showProject() && projects.byId(e.projectId); as p) {
                · {{ p.name }}
              }
            </p>
          </div>
        </li>
      } @empty {
        <li class="text-ink-faint">Todavía no hay actividad.</li>
      }
    </ol>
  `,
})
export class ActivityFeed {
  readonly entries = input.required<ActivityEntry[]>();
  readonly showProject = input(false);

  protected readonly session = inject(SessionService);
  protected readonly projects = inject(ProjectService);
  private readonly tasks = inject(TaskService);
  private readonly panel = inject(TaskPanelService);
  private readonly router = inject(Router);

  protected phrase(e: ActivityEntry): string {
    return ACTIVITY_PHRASE[e.verb](e.detail);
  }

  protected ago(iso: string): string {
    return timeAgo(iso);
  }

  protected canOpen(e: ActivityEntry): boolean {
    if (e.verb.startsWith('project.')) return !!this.projects.byId(e.targetId);
    if (e.verb.startsWith('task.') || e.verb === 'note.converted') return !!this.tasks.byId(e.targetId);
    return false;
  }

  protected open(e: ActivityEntry): void {
    if (e.verb.startsWith('project.')) {
      void this.router.navigate(['/proyectos', e.targetId]);
    } else {
      this.panel.open(e.targetId);
    }
  }
}
