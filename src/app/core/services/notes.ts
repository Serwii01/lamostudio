import { Injectable, computed, inject } from '@angular/core';
import { Id, NoteVisibility, QuickNote, Task } from '../models';
import { NotePatch, NoteRepository, TaskRepository } from '../data/repositories';
import { firstLine } from '../utils/text';
import { ActivityService } from './activity';
import { SessionService } from './session';

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

  /** Notas visibles para el usuario actual: fijadas primero, luego las más recientes. */
  readonly visible = computed(() => {
    const userId = this.session.currentUserId();
    return this.repo
      .notes()
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

  remove(note: QuickNote): Promise<void> {
    return this.repo.remove(note.id);
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
