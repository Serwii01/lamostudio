import { Injectable, inject } from '@angular/core';
import { ActivityVerb, Id } from '../models';
import { ActivityRepository } from '../data/repositories';
import { SessionService } from './session';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly repo = inject(ActivityRepository);
  private readonly session = inject(SessionService);

  readonly entries = this.repo.entries;

  log(
    verb: ActivityVerb,
    target: { id: Id; label: string },
    context: { projectId?: Id; detail?: string } = {},
  ): void {
    void this.repo.log({
      verb,
      actorId: this.session.currentUserId(),
      targetId: target.id,
      targetLabel: target.label,
      projectId: context.projectId,
      detail: context.detail,
    });
  }
}
