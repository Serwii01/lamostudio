import { Signal } from '@angular/core';
import { ActivityEntry, Id, Member, Project, QuickNote, Task, Workspace } from '../models';

export type NewProject = Omit<Project, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>;
export type ProjectPatch = Partial<Omit<Project, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>;

export type NewTask = Pick<Task, 'projectId' | 'title'> &
  Partial<Omit<Task, 'id' | 'projectId' | 'title' | 'createdAt' | 'updatedAt'>>;
export type TaskPatch = Partial<Omit<Task, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>;

export type NewNote = Pick<QuickNote, 'authorId' | 'content'> &
  Partial<Pick<QuickNote, 'projectId' | 'title' | 'visibility' | 'pinned'>>;
export type NotePatch = Partial<Omit<QuickNote, 'id' | 'workspaceId' | 'authorId' | 'createdAt' | 'updatedAt'>>;

export type NewActivity = Omit<ActivityEntry, 'id' | 'workspaceId' | 'createdAt'>;

/*
 * Contratos de acceso a datos.
 *
 * Los servicios y pantallas dependen solo de estas clases abstractas. Hoy se
 * resuelven con implementaciones en memoria (./mock); para pasar a Firebase o a una
 * API Spring Boot basta con escribir otras implementaciones y cambiar los providers
 * en app.config.ts. Las lecturas se exponen como signals para que una fuente en
 * tiempo real (onSnapshot, WebSocket) pueda alimentarlas sin cambiar la UI.
 */

export abstract class WorkspaceRepository {
  abstract readonly workspace: Signal<Workspace>;
  abstract readonly members: Signal<Member[]>;
}

export abstract class ProjectRepository {
  abstract readonly projects: Signal<Project[]>;
  abstract create(input: NewProject): Promise<Project>;
  abstract update(id: Id, patch: ProjectPatch): Promise<void>;
}

export abstract class TaskRepository {
  abstract readonly tasks: Signal<Task[]>;
  abstract create(input: NewTask): Promise<Task>;
  abstract update(id: Id, patch: TaskPatch): Promise<void>;
  /** Actualización atómica de varias tareas (p. ej. reordenar una columna). */
  abstract updateMany(changes: { id: Id; patch: TaskPatch }[]): Promise<void>;
  abstract remove(id: Id): Promise<void>;
}

export abstract class NoteRepository {
  abstract readonly notes: Signal<QuickNote[]>;
  abstract create(input: NewNote): Promise<QuickNote>;
  abstract update(id: Id, patch: NotePatch): Promise<void>;
  abstract remove(id: Id): Promise<void>;
}

export abstract class ActivityRepository {
  abstract readonly entries: Signal<ActivityEntry[]>;
  abstract log(input: NewActivity): Promise<void>;
}

/** Operaciones de mantenimiento del entorno de demostración. */
export abstract class DataAdmin {
  abstract readonly isDemo: boolean;
  abstract reset(): Promise<void>;
}
