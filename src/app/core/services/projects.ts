import { Injectable, computed, inject } from '@angular/core';
import { INACTIVE_PROJECT_STATUSES, PROJECT_STATUS, isTaskDone } from '../catalog';
import { Id, IsoDate, Project } from '../models';
import { NewProject, ProjectPatch, ProjectRepository, TaskRepository } from '../data/repositories';
import { daysFromToday } from '../utils/dates';
import { ActivityService } from './activity';
import { SessionService } from './session';

export interface ProjectStats {
  total: number;
  done: number;
  open: number;
  overdue: number;
  blocked: number;
  inReview: number;
  /** 0–1, calculado desde las tareas. */
  progress: number;
  nextDue?: IsoDate;
}

const EMPTY_STATS: ProjectStats = { total: 0, done: 0, open: 0, overdue: 0, blocked: 0, inReview: 0, progress: 0 };

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly repo = inject(ProjectRepository);
  private readonly taskRepo = inject(TaskRepository);
  private readonly session = inject(SessionService);
  private readonly activity = inject(ActivityService);

  readonly all = this.repo.projects;

  /** Proyectos que el usuario actual puede ver según su rol y pertenencia. */
  readonly visible = computed(() => {
    const user = this.session.currentUser();
    const seeAll = this.session.can('project.viewAll');
    return this.all().filter((p) => seeAll || p.memberIds.includes(user.id));
  });

  readonly active = computed(() =>
    this.visible().filter((p) => !INACTIVE_PROJECT_STATUSES.includes(p.status)),
  );

  readonly stats = computed(() => {
    const map = new Map<Id, ProjectStats>();
    for (const task of this.taskRepo.tasks()) {
      const s = map.get(task.projectId) ?? { ...EMPTY_STATS };
      s.total += 1;
      if (isTaskDone(task.status)) {
        s.done += 1;
      } else {
        s.open += 1;
        if (task.status === 'blocked') s.blocked += 1;
        if (task.status === 'review') s.inReview += 1;
        if (task.dueAt) {
          if (daysFromToday(task.dueAt) < 0) s.overdue += 1;
          if (!s.nextDue || task.dueAt < s.nextDue) s.nextDue = task.dueAt;
        }
      }
      map.set(task.projectId, s);
    }
    for (const s of map.values()) s.progress = s.total ? s.done / s.total : 0;
    return map;
  });

  statsFor(id: Id): ProjectStats {
    return this.stats().get(id) ?? EMPTY_STATS;
  }

  byId(id: Id | undefined): Project | undefined {
    return id ? this.all().find((p) => p.id === id) : undefined;
  }

  async create(input: NewProject): Promise<Project> {
    const project = await this.repo.create(input);
    this.activity.log('project.created', { id: project.id, label: project.name }, { projectId: project.id });
    return project;
  }

  async update(project: Project, patch: ProjectPatch): Promise<void> {
    await this.repo.update(project.id, patch);
    const target = { id: project.id, label: patch.name ?? project.name };
    if (patch.status && patch.status !== project.status) {
      this.activity.log('project.status', target, { projectId: project.id, detail: PROJECT_STATUS[patch.status].label });
    } else if (patch.moduleIds) {
      this.activity.log('project.modules', target, { projectId: project.id });
    } else {
      this.activity.log('project.updated', target, { projectId: project.id });
    }
  }
}
