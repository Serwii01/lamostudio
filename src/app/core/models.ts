/**
 * Modelo de dominio: workspace → project → modules.
 * Las fechas se guardan como ISO 8601 para que el mismo modelo sirva con el mock,
 * con Firestore (convirtiendo Timestamp) o con una API REST.
 */
export type Id = string;
export type IsoDate = string;

export interface Workspace {
  id: Id;
  name: string;
  cycle: string;
}

export type MemberRole =
  | 'owner'
  | 'admin'
  | 'pm'
  | 'creative-director'
  | 'collaborator'
  | 'client'
  | 'guest';

export interface Member {
  id: Id;
  name: string;
  role: MemberRole;
  specialty: string;
  color: string;
  /** Horas disponibles por semana. 0 para clientes e invitados. */
  weeklyCapacity: number;
}

export type ProjectStatus =
  | 'draft'
  | 'planning'
  | 'production'
  | 'review'
  | 'client-pending'
  | 'changes'
  | 'approved'
  | 'closed'
  | 'archived';

export type ProjectType = 'branding' | 'video' | 'campaign' | 'event' | 'web' | 'custom';

export type ProjectModuleId =
  | 'overview'
  | 'tasks'
  | 'kanban'
  | 'calendar'
  | 'notes'
  | 'whiteboard'
  | 'map'
  | 'files'
  | 'deliverables'
  | 'time'
  | 'budget'
  | 'shot-list';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Project {
  id: Id;
  workspaceId: Id;
  name: string;
  description?: string;
  client?: string;
  type: ProjectType;
  status: ProjectStatus;
  priority: Priority;
  tags: string[];
  cover: string;
  /** Módulos activos, en el orden en que se muestran como pestañas. */
  moduleIds: ProjectModuleId[];
  memberIds: Id[];
  ownerId: Id;
  startAt?: IsoDate;
  dueAt?: IsoDate;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export type TaskStatus =
  | 'todo'
  | 'in-progress'
  | 'blocked'
  | 'review'
  | 'changes'
  | 'approved'
  | 'done';

export interface Subtask {
  id: Id;
  title: string;
  done: boolean;
}

export interface TaskComment {
  id: Id;
  authorId: Id;
  body: string;
  createdAt: IsoDate;
}

export interface Task {
  id: Id;
  projectId: Id;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId?: Id;
  tags: string[];
  dueAt?: IsoDate;
  estimateHours?: number;
  subtasks: Subtask[];
  comments: TaskComment[];
  /** Posición dentro de su columna de estado. */
  order: number;
  /** Nota rápida de la que procede, si se creó por conversión. */
  sourceNoteId?: Id;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export type NoteVisibility = 'private' | 'project' | 'workspace';

export interface QuickNote {
  id: Id;
  workspaceId: Id;
  projectId?: Id;
  authorId: Id;
  title?: string;
  content: string;
  visibility: NoteVisibility;
  pinned: boolean;
  linkedTaskId?: Id;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export type ActivityVerb =
  | 'project.created'
  | 'project.updated'
  | 'project.status'
  | 'project.modules'
  | 'task.created'
  | 'task.updated'
  | 'task.status'
  | 'task.assigned'
  | 'task.commented'
  | 'task.deleted'
  | 'note.created'
  | 'note.converted';

export interface ActivityEntry {
  id: Id;
  workspaceId: Id;
  projectId?: Id;
  actorId: Id;
  verb: ActivityVerb;
  targetId: Id;
  targetLabel: string;
  detail?: string;
  createdAt: IsoDate;
}
