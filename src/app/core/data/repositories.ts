import { Signal } from '@angular/core';
import { ActivityEntry, FileAsset, Id, Member, Project, ProjectLocation, QuickNote, Task, Workspace } from '../models';

export type NewProject = Omit<Project, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>;
export type ProjectPatch = Partial<Omit<Project, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>;

export type NewTask = Pick<Task, 'projectId' | 'title'> &
  Partial<Omit<Task, 'id' | 'projectId' | 'title' | 'createdAt' | 'updatedAt'>>;
/** Incluye projectId para poder mover una tarea a otro proyecto. */
export type TaskPatch = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>;

export type NewNote = Pick<QuickNote, 'authorId' | 'content'> &
  Partial<Pick<QuickNote, 'projectId' | 'title' | 'visibility' | 'pinned'>>;
export type NotePatch = Partial<Omit<QuickNote, 'id' | 'workspaceId' | 'authorId' | 'createdAt' | 'updatedAt'>>;

export type NewActivity = Omit<ActivityEntry, 'id' | 'workspaceId' | 'createdAt'>;

export type NewFile = Omit<FileAsset, 'id' | 'workspaceId' | 'createdAt'>;
export type FilePatch = Partial<Pick<FileAsset, 'name' | 'taskId' | 'projectId'>>;

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

export abstract class FileRepository {
  abstract readonly files: Signal<FileAsset[]>;
  /** Guarda los metadatos y, si se pasa, el contenido binario del archivo. */
  abstract create(input: NewFile, content?: Blob): Promise<FileAsset>;
  abstract update(id: Id, patch: FilePatch): Promise<void>;
  abstract remove(id: Id): Promise<void>;
  /** URL para ver o descargar el contenido (enlace externo o URL temporal del binario). */
  abstract contentUrl(id: Id): Promise<string | null>;
}

export type NewLocation = Omit<ProjectLocation, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>;
export type LocationPatch = Partial<Omit<ProjectLocation, 'id' | 'workspaceId' | 'projectId' | 'createdBy' | 'createdAt' | 'updatedAt'>>;

export abstract class LocationRepository {
  abstract readonly locations: Signal<ProjectLocation[]>;
  abstract create(input: NewLocation): Promise<ProjectLocation>;
  abstract update(id: Id, patch: LocationPatch): Promise<void>;
  abstract remove(id: Id): Promise<void>;
}

/** Operaciones de mantenimiento del entorno de demostración. */
export abstract class DataAdmin {
  abstract readonly isDemo: boolean;
  abstract reset(): Promise<void>;
}
