import { Injectable, Provider, computed, inject } from '@angular/core';
import { Id, IsoDate, Project, QuickNote, Task } from '../../models';
import { newId } from '../../utils/text';
import {
  ActivityRepository,
  DataAdmin,
  NewActivity,
  NewNote,
  NewProject,
  NewTask,
  NotePatch,
  NoteRepository,
  ProjectPatch,
  ProjectRepository,
  TaskPatch,
  TaskRepository,
  WorkspaceRepository,
} from '../repositories';
import { MockDb } from './mock-db';

const now = (): IsoDate => new Date().toISOString();
const MAX_ACTIVITY = 500;

@Injectable()
export class MockWorkspaceRepository extends WorkspaceRepository {
  private readonly db = inject(MockDb);
  readonly workspace = computed(() => this.db.state().workspace);
  readonly members = computed(() => this.db.state().members);
}

@Injectable()
export class MockProjectRepository extends ProjectRepository {
  private readonly db = inject(MockDb);
  readonly projects = computed(() => this.db.state().projects);

  async create(input: NewProject): Promise<Project> {
    const project: Project = {
      ...input,
      id: newId('prj'),
      workspaceId: this.db.state().workspace.id,
      createdAt: now(),
      updatedAt: now(),
    };
    this.db.patch('projects', (list) => [...list, project]);
    return project;
  }

  async update(id: Id, patch: ProjectPatch): Promise<void> {
    this.db.patch('projects', (list) =>
      list.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now() } : p)),
    );
  }
}

@Injectable()
export class MockTaskRepository extends TaskRepository {
  private readonly db = inject(MockDb);
  readonly tasks = computed(() => this.db.state().tasks);

  async create(input: NewTask): Promise<Task> {
    const status = input.status ?? 'todo';
    const siblings = this.tasks().filter((t) => t.projectId === input.projectId && t.status === status);
    const task: Task = {
      priority: 'medium',
      tags: [],
      subtasks: [],
      comments: [],
      order: siblings.reduce((max, t) => Math.max(max, t.order), -1) + 1,
      ...input,
      status,
      id: newId('tsk'),
      createdAt: now(),
      updatedAt: now(),
    };
    this.db.patch('tasks', (list) => [...list, task]);
    return task;
  }

  async update(id: Id, patch: TaskPatch): Promise<void> {
    return this.updateMany([{ id, patch }]);
  }

  async updateMany(changes: { id: Id; patch: TaskPatch }[]): Promise<void> {
    const byId = new Map(changes.map((c) => [c.id, c.patch]));
    this.db.patch('tasks', (list) =>
      list.map((t) => {
        const patch = byId.get(t.id);
        return patch ? { ...t, ...patch, updatedAt: now() } : t;
      }),
    );
  }

  async remove(id: Id): Promise<void> {
    this.db.patch('tasks', (list) => list.filter((t) => t.id !== id));
  }
}

@Injectable()
export class MockNoteRepository extends NoteRepository {
  private readonly db = inject(MockDb);
  readonly notes = computed(() => this.db.state().notes);

  async create(input: NewNote): Promise<QuickNote> {
    const note: QuickNote = {
      visibility: input.projectId ? 'project' : 'private',
      pinned: false,
      ...input,
      id: newId('note'),
      workspaceId: this.db.state().workspace.id,
      createdAt: now(),
      updatedAt: now(),
    };
    this.db.patch('notes', (list) => [note, ...list]);
    return note;
  }

  async update(id: Id, patch: NotePatch): Promise<void> {
    this.db.patch('notes', (list) =>
      list.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now() } : n)),
    );
  }

  async remove(id: Id): Promise<void> {
    this.db.patch('notes', (list) => list.filter((n) => n.id !== id));
  }
}

@Injectable()
export class MockActivityRepository extends ActivityRepository {
  private readonly db = inject(MockDb);
  readonly entries = computed(() => this.db.state().activity);

  async log(input: NewActivity): Promise<void> {
    const entry = {
      ...input,
      id: newId('act'),
      workspaceId: this.db.state().workspace.id,
      createdAt: now(),
    };
    this.db.patch('activity', (list) => [entry, ...list].slice(0, MAX_ACTIVITY));
  }
}

@Injectable()
export class MockDataAdmin extends DataAdmin {
  private readonly db = inject(MockDb);
  readonly isDemo = true;

  async reset(): Promise<void> {
    this.db.reset();
  }
}

export function provideMockData(): Provider[] {
  return [
    { provide: WorkspaceRepository, useClass: MockWorkspaceRepository },
    { provide: ProjectRepository, useClass: MockProjectRepository },
    { provide: TaskRepository, useClass: MockTaskRepository },
    { provide: NoteRepository, useClass: MockNoteRepository },
    { provide: ActivityRepository, useClass: MockActivityRepository },
    { provide: DataAdmin, useClass: MockDataAdmin },
  ];
}
