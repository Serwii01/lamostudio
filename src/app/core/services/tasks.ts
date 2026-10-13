import { Injectable, computed, inject } from '@angular/core';
import { TASK_STATUS, isTaskDone } from '../catalog';
import { Id, Task, TaskStatus } from '../models';
import { NewTask, TaskPatch, TaskRepository } from '../data/repositories';
import { daysFromToday } from '../utils/dates';
import { newId } from '../utils/text';
import { ActivityService } from './activity';
import { SessionService } from './session';

/** Horizonte (días) con el que se calcula la carga semanal. */
const LOAD_HORIZON_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly repo = inject(TaskRepository);
  private readonly activity = inject(ActivityService);
  private readonly session = inject(SessionService);

  readonly all = this.repo.tasks;

  /**
   * Horas estimadas de tareas abiertas que vencen en los próximos 7 días (o ya
   * vencidas), por persona. Sirve para detectar sobrecarga frente a su capacidad.
   */
  readonly weeklyLoad = computed(() => {
    const load = new Map<Id, number>();
    for (const task of this.all()) {
      if (!task.assigneeId || !task.dueAt || isTaskDone(task.status)) continue;
      if (daysFromToday(task.dueAt) >= LOAD_HORIZON_DAYS) continue;
      load.set(task.assigneeId, (load.get(task.assigneeId) ?? 0) + (task.estimateHours ?? 0));
    }
    return load;
  });

  byId(id: Id | null | undefined): Task | undefined {
    return id ? this.all().find((t) => t.id === id) : undefined;
  }

  byProject(projectId: Id): Task[] {
    return this.all()
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  }

  async create(input: NewTask): Promise<Task> {
    const task = await this.repo.create(input);
    this.activity.log('task.created', { id: task.id, label: task.title }, { projectId: task.projectId });
    return task;
  }

  async update(task: Task, patch: TaskPatch): Promise<void> {
    await this.repo.update(task.id, patch);
    const target = { id: task.id, label: patch.title ?? task.title };
    const context = { projectId: task.projectId };
    if (patch.status && patch.status !== task.status) {
      this.activity.log('task.status', target, { ...context, detail: TASK_STATUS[patch.status].label });
    } else if ('assigneeId' in patch && patch.assigneeId !== task.assigneeId) {
      const name = this.session.member(patch.assigneeId)?.name ?? 'nadie';
      this.activity.log('task.assigned', target, { ...context, detail: name });
    } else if (
      (patch.title && patch.title !== task.title) ||
      (patch.priority && patch.priority !== task.priority) ||
      ('dueAt' in patch && patch.dueAt !== task.dueAt)
    ) {
      // Solo se registran los cambios relevantes; descripción, etiquetas o
      // subtareas no generan ruido en la actividad.
      this.activity.log('task.updated', target, context);
    }
  }

  /** Mueve una tarea a una columna y fija el nuevo orden de esa columna. */
  async move(task: Task, status: TaskStatus, orderedIds: Id[]): Promise<void> {
    await this.repo.updateMany(
      orderedIds.map((id, order) => ({ id, patch: id === task.id ? { order, status } : { order } })),
    );
    if (status !== task.status) {
      this.activity.log('task.status', { id: task.id, label: task.title }, {
        projectId: task.projectId,
        detail: TASK_STATUS[status].label,
      });
    }
  }

  toggleDone(task: Task): Promise<void> {
    return this.update(task, { status: isTaskDone(task.status) ? 'todo' : 'done' });
  }

  async comment(task: Task, body: string): Promise<void> {
    const comment = {
      id: newId('cmt'),
      authorId: this.session.currentUserId(),
      body,
      createdAt: new Date().toISOString(),
    };
    await this.repo.update(task.id, { comments: [...task.comments, comment] });
    this.activity.log('task.commented', { id: task.id, label: task.title }, { projectId: task.projectId });
  }

  async remove(task: Task): Promise<void> {
    await this.repo.remove(task.id);
    this.activity.log('task.deleted', { id: task.id, label: task.title }, { projectId: task.projectId });
  }
}
