import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PRIORITY, PRIORITY_ORDER, TASK_STATUS, TASK_STATUS_ORDER, TONE_BADGE } from '../../core/catalog';
import { Task } from '../../core/models';
import { TaskPatch } from '../../core/data/repositories';
import { NoteService } from '../../core/services/notes';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { TaskPanelService } from '../../core/services/ui-state';
import { fromDateInput, timeAgo, toDateInput } from '../../core/utils/dates';
import { newId, parseTags } from '../../core/utils/text';
import { Avatar } from '../../shared/ui/avatar';
import { Progress } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';

/** Panel lateral con el detalle editable de una tarea. */
@Component({
  selector: 'app-task-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Avatar, Icon, Progress],
  host: { '(document:keydown.escape)': 'panel.close()' },
  template: `
    @if (task(); as t) {
      <div class="fixed inset-0 z-50 bg-ink/20" (click)="panel.close()"></div>
      <aside
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-surface shadow-2xl shadow-ink/10"
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de tarea"
      >
        <header class="flex h-14 shrink-0 items-center gap-2 border-b border-line px-5">
          @if (project(); as p) {
            <a
              [routerLink]="['/proyectos', p.id]"
              class="flex min-w-0 items-center gap-2 text-ink-soft hover:text-ink"
              (click)="panel.close()"
            >
              <span class="size-2.5 shrink-0 rounded-sm" [style.background]="p.cover"></span>
              <span class="truncate">{{ p.name }}</span>
            </a>
          }
          <div class="ml-auto flex items-center gap-1">
            @if (canEdit()) {
              <button class="btn btn-danger btn-sm" (click)="remove(t)"><app-icon name="trash" [size]="14" /> Eliminar</button>
            }
            <button class="btn btn-ghost btn-sm" aria-label="Cerrar" (click)="panel.close()"><app-icon name="x" /></button>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-5">
          <textarea
            class="w-full resize-none rounded-md border border-transparent bg-transparent font-display text-2xl leading-tight font-semibold hover:border-line focus:border-line focus:outline-none disabled:hover:border-transparent"
            rows="2"
            aria-label="Título"
            [value]="t.title"
            [disabled]="!canEdit()"
            (change)="setTitle(t, $any($event.target).value)"
            (keydown.enter)="$any($event.target).blur(); $event.preventDefault()"
          ></textarea>

          @if (sourceNote(); as note) {
            <p class="mt-1 inline-flex items-center gap-1.5 rounded-md bg-honey-soft px-2 py-1 text-xs text-honey">
              <app-icon name="note" [size]="13" /> Creada desde la nota «{{ note.title || note.content.slice(0, 40) }}»
            </p>
          }

          <dl class="mt-5 grid grid-cols-[7.5rem_1fr] items-center gap-x-3 gap-y-2.5">
            <dt class="text-ink-soft">Estado</dt>
            <dd>
              <select
                class="h-8 cursor-pointer rounded-full border-0 px-3 text-xs font-medium"
                [class]="statusClass()"
                [disabled]="!canEdit()"
                (change)="update(t, { status: $any($event.target).value })"
              >
                @for (s of statusOrder; track s) {
                  <option [value]="s" [selected]="s === t.status">{{ status[s].label }}</option>
                }
              </select>
            </dd>

            <dt class="text-ink-soft">Responsable</dt>
            <dd class="flex items-center gap-2">
              <app-avatar [member]="assignee()" [size]="24" />
              <select
                class="input h-8 max-w-60"
                [disabled]="!canEdit()"
                (change)="update(t, { assigneeId: $any($event.target).value || undefined })"
              >
                <option value="" [selected]="!t.assigneeId">Sin responsable</option>
                @for (m of team(); track m.id) {
                  <option [value]="m.id" [selected]="m.id === t.assigneeId">{{ m.name }}</option>
                }
              </select>
            </dd>

            <dt class="text-ink-soft">Fecha límite</dt>
            <dd>
              <input
                type="date"
                class="input h-8 max-w-44"
                [value]="dateValue()"
                [disabled]="!canEdit()"
                (change)="update(t, { dueAt: toIso($any($event.target).value) })"
              />
            </dd>

            <dt class="text-ink-soft">Prioridad</dt>
            <dd>
              <select
                class="input h-8 max-w-44"
                [disabled]="!canEdit()"
                (change)="update(t, { priority: $any($event.target).value })"
              >
                @for (p of priorityOrder; track p) {
                  <option [value]="p" [selected]="p === t.priority">{{ priority[p].label }}</option>
                }
              </select>
            </dd>

            <dt class="text-ink-soft">Estimación</dt>
            <dd class="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.5"
                class="input h-8 w-24"
                [value]="t.estimateHours ?? ''"
                [disabled]="!canEdit()"
                (change)="setEstimate(t, $any($event.target).value)"
              />
              <span class="text-ink-faint">horas</span>
            </dd>

            <dt class="text-ink-soft">Etiquetas</dt>
            <dd>
              <input
                class="input h-8"
                placeholder="separadas por comas"
                [value]="t.tags.join(', ')"
                [disabled]="!canEdit()"
                (change)="update(t, { tags: parseTags($any($event.target).value) })"
              />
            </dd>
          </dl>

          <section class="mt-7">
            <h3 class="eyebrow mb-2">Descripción</h3>
            <textarea
              class="input min-h-24 resize-y"
              placeholder="Contexto, criterios de aceptación, enlaces…"
              [value]="t.description ?? ''"
              [disabled]="!canEdit()"
              (change)="update(t, { description: $any($event.target).value })"
            ></textarea>
          </section>

          <section class="mt-7">
            <div class="mb-2 flex items-center gap-3">
              <h3 class="eyebrow">Subtareas</h3>
              @if (t.subtasks.length) {
                <span class="text-xs text-ink-faint">{{ subtasksDone() }}/{{ t.subtasks.length }}</span>
                <app-progress class="max-w-32 flex-1" [value]="subtasksDone() / t.subtasks.length" tone="moss" [height]="4" />
              }
            </div>
            <ul class="space-y-1">
              @for (s of t.subtasks; track s.id) {
                <li class="group flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-line-soft/60">
                  <input
                    type="checkbox"
                    class="size-4 cursor-pointer accent-moss"
                    [checked]="s.done"
                    [disabled]="!canEdit()"
                    (change)="toggleSubtask(t, s.id)"
                  />
                  <span class="flex-1" [class.line-through]="s.done" [class.text-ink-faint]="s.done">{{ s.title }}</span>
                  @if (canEdit()) {
                    <button
                      class="btn btn-ghost btn-sm opacity-0 group-hover:opacity-100 focus:opacity-100"
                      aria-label="Eliminar subtarea"
                      (click)="removeSubtask(t, s.id)"
                    >
                      <app-icon name="x" [size]="13" />
                    </button>
                  }
                </li>
              }
            </ul>
            @if (canEdit()) {
              <form class="mt-2 flex gap-2" (ngSubmit)="addSubtask(t)">
                <input class="input h-8" name="subtask" placeholder="Añadir subtarea…" [(ngModel)]="newSubtask" autocomplete="off" />
                <button class="btn btn-outline btn-sm h-8" type="submit" [disabled]="!newSubtask().trim()">Añadir</button>
              </form>
            }
          </section>

          <section class="mt-7">
            <h3 class="eyebrow mb-3">Comentarios ({{ t.comments.length }})</h3>
            <ul class="space-y-4">
              @for (c of t.comments; track c.id) {
                <li class="flex gap-3">
                  <app-avatar [member]="session.member(c.authorId)" [size]="28" />
                  <div class="min-w-0 flex-1">
                    <p class="text-xs">
                      <span class="font-medium text-ink">{{ session.member(c.authorId)?.name }}</span>
                      <span class="text-ink-faint"> · {{ ago(c.createdAt) }}</span>
                    </p>
                    <p class="mt-1 whitespace-pre-line text-ink">{{ c.body }}</p>
                  </div>
                </li>
              }
            </ul>
            @if (session.can('task.comment')) {
              <form class="mt-4 flex gap-3" (ngSubmit)="comment(t)">
                <app-avatar [member]="session.currentUser()" [size]="28" />
                <div class="flex-1">
                  <textarea
                    class="input min-h-16"
                    name="comment"
                    placeholder="Escribe un comentario…"
                    [(ngModel)]="newComment"
                    (keydown.control.enter)="comment(t)"
                  ></textarea>
                  <div class="mt-2 flex justify-end">
                    <button class="btn btn-primary btn-sm" type="submit" [disabled]="!newComment().trim()">Comentar</button>
                  </div>
                </div>
              </form>
            }
          </section>
        </div>
      </aside>
    }
  `,
})
export class TaskPanel {
  protected readonly panel = inject(TaskPanelService);
  protected readonly session = inject(SessionService);
  private readonly tasks = inject(TaskService);
  private readonly projects = inject(ProjectService);
  private readonly notes = inject(NoteService);

  protected readonly status = TASK_STATUS;
  protected readonly statusOrder = TASK_STATUS_ORDER;
  protected readonly priority = PRIORITY;
  protected readonly priorityOrder = PRIORITY_ORDER;
  protected readonly parseTags = parseTags;
  protected readonly toIso = fromDateInput;

  protected readonly newSubtask = signal('');
  protected readonly newComment = signal('');

  protected readonly task = computed(() => this.tasks.byId(this.panel.openId()));
  protected readonly project = computed(() => this.projects.byId(this.task()?.projectId));
  protected readonly assignee = computed(() => this.session.member(this.task()?.assigneeId));
  protected readonly team = computed(() => {
    const ids = new Set(this.project()?.memberIds ?? []);
    return this.session.members().filter((m) => ids.has(m.id) && m.role !== 'client');
  });
  protected readonly sourceNote = computed(() => {
    const id = this.task()?.sourceNoteId;
    return id ? this.notes.visible().find((n) => n.id === id) : undefined;
  });
  protected readonly canEdit = computed(() => this.session.can('task.edit'));
  protected readonly statusClass = computed(() => TONE_BADGE[TASK_STATUS[this.task()?.status ?? 'todo'].tone]);
  protected readonly dateValue = computed(() => toDateInput(this.task()?.dueAt));
  protected readonly subtasksDone = computed(() => this.task()?.subtasks.filter((s) => s.done).length ?? 0);

  protected update(task: Task, patch: TaskPatch): void {
    void this.tasks.update(task, patch);
  }

  protected setTitle(task: Task, value: string): void {
    const title = value.trim();
    if (title && title !== task.title) this.update(task, { title });
  }

  protected setEstimate(task: Task, value: string): void {
    const hours = Number(value);
    this.update(task, { estimateHours: value === '' || Number.isNaN(hours) ? undefined : Math.max(0, hours) });
  }

  protected addSubtask(task: Task): void {
    const title = this.newSubtask().trim();
    if (!title) return;
    this.newSubtask.set('');
    this.update(task, { subtasks: [...task.subtasks, { id: newId('sub'), title, done: false }] });
  }

  protected toggleSubtask(task: Task, id: string): void {
    this.update(task, { subtasks: task.subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) });
  }

  protected removeSubtask(task: Task, id: string): void {
    this.update(task, { subtasks: task.subtasks.filter((s) => s.id !== id) });
  }

  protected comment(task: Task): void {
    const body = this.newComment().trim();
    if (!body) return;
    this.newComment.set('');
    void this.tasks.comment(task, body);
  }

  protected remove(task: Task): void {
    if (!confirm(`¿Eliminar la tarea «${task.title}»?`)) return;
    this.panel.close();
    void this.tasks.remove(task);
  }

  protected ago(iso: string): string {
    return timeAgo(iso);
  }
}

