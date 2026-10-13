import { Injectable, computed, inject } from '@angular/core';
import { Id, NoteVisibility, QuickNote, Task } from '../models';
import { NotePatch, NoteRepository, TaskRepository } from '../data/repositories';
import { firstLine } from '../utils/text';
import { ActivityService } from './activity';
import { SessionService } from './session';
import { ToastService } from './ui-state';
import { PendingDeletes } from './undo';

export interface NoteDraft {
  content: string;
  title?: string;
  projectId?: Id;
  visibility: NoteVisibility;
}

@Injectable({ providedIn: 'root' })
export class NoteService {
  private readonly repo = inject(NoteRepository);
  private readonly taskRepo = inject(TaskRepository);
  private readonly session = inject(SessionService);
  private readonly activity = inject(ActivityService);
  private readonly toast = inject(ToastService);
  private readonly deletes = new PendingDeletes<QuickNote>(this.toast);
  private readonly notes = this.deletes.filter(this.repo.notes);

  /** Notas visibles para el usuario actual: fijadas primero, luego las más recientes. */
  readonly visible = computed(() => {
    const userId = this.session.currentUserId();
    return this.notes()
      .filter((n) => n.visibility !== 'private' || n.authorId === userId)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  });

  async create(draft: NoteDraft): Promise<QuickNote> {
    const note = await this.repo.create({ ...draft, authorId: this.session.currentUserId() });
    if (note.projectId && note.visibility !== 'private') {
      this.activity.log('note.created', { id: note.id, label: note.title || firstLine(note.content, 60) }, {
        projectId: note.projectId,
      });
    }
    return note;
  }

  update(note: QuickNote, patch: NotePatch): Promise<void> {
    return this.repo.update(note.id, patch);
  }

  /** Asigna la nota a otro proyecto (al arrastrarla a la barra lateral); se puede deshacer. */
  moveToProject(note: QuickNote, projectId: Id, projectName: string): void {
    if (note.projectId === projectId) return;
    const before = { projectId: note.projectId, visibility: note.visibility };
    void this.repo.update(note.id, { projectId, visibility: note.visibility === 'private' ? 'private' : 'project' });
    this.toast.show(`Nota movida a ${projectName}`, { label: 'Deshacer', run: () => void this.repo.update(note.id, before) });
  }

  /** Oculta la nota y la borra pasados unos segundos si no se deshace. */
  remove(note: QuickNote): void {
    this.deletes.remove(note, 'Nota eliminada', () => this.repo.remove(note.id));
  }

  /** Nota → Tarea: crea la tarea con enlace de origen y vincula la nota a ella. */
  async convertToTask(note: QuickNote, projectId: Id): Promise<Task> {
    const task = await this.taskRepo.create({
      projectId,
      title: note.title?.trim() || firstLine(note.content),
      description: note.content,
      sourceNoteId: note.id,
      assigneeId: this.session.currentUserId(),
    });
    await this.repo.update(note.id, { linkedTaskId: task.id, projectId: note.projectId ?? projectId });
    this.activity.log('note.converted', { id: task.id, label: task.title }, { projectId });
    return task;
  }
}
