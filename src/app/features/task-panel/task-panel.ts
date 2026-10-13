import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PRIORITY, PRIORITY_ORDER, TASK_STATUS, TASK_STATUS_ORDER, TONE_FILL } from '../../core/catalog';
import { Task } from '../../core/models';
import { TaskPatch } from '../../core/data/repositories';
import { FileService } from '../../core/services/files';
import { LocationService } from '../../core/services/locations';
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
import { FilesBoard } from '../files/files-board';

/** Panel lateral con el detalle editable de una tarea. */
@Component({
  selector: 'app-task-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Avatar, FilesBoard, Icon, Progress],
  host: { '(document:keydown.escape)': 'panel.close()' },
  template: `
    @if (task(); as t) {
      <div class="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px]" (click)="panel.close()"></div>
      <aside
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-surface shadow-2xl shadow-ink/15 sm:rounded-l-3xl"
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de tarea"
      >
        <header class="flex h-16 shrink-0 items-center gap-2 border-b border-line/60 px-6">
          @if (project(); as p) {
            <a
              [routerLink]="['/proyectos', p.id]"
              class="flex min-w-0 items-center gap-2 text-ink-soft hover:text-ink"
              (click)="panel.close()"
            >
              <span class="size-2.5 shrink-0 rounded-full" [style.background]="p.cover"></span>
              <span class="truncate">{{ p.name }}</span>
            </a>
          }
          <span class="ml-auto hidden items-center gap-1 text-xs whitespace-nowrap sm:inline-flex" aria-live="polite">
            @if (justSaved()) {
              <app-icon name="check-hand" [size]="15" [stroke]="2.4" class="text-moss" /> <span class="text-moss">Guardado</span>
            } @else if (canEdit()) {
              <span class="text-ink-faint">Los cambios se guardan solos</span>
            }
          </span>
          <div class="ml-2 flex items-center gap-1">
            @if (canEdit()) {
              <button class="btn btn-ghost btn-sm hover:text-coral" (click)="remove(t)"><app-icon name="trash" [size]="14" /> Eliminar</button>
            }
            <button class="btn btn-ghost btn-sm" aria-label="Cerrar" (click)="panel.close()"><app-icon name="x" /></button>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-6">
          <textarea
            class="w-full resize-none rounded-md border border-transparent bg-transparent font-display text-2xl leading-tight font-light hover:border-line focus:border-line focus:outline-none disabled:hover:border-transparent"
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

          @if (location(); as loc) {
            <a
              class="mt-1 ml-1 inline-flex items-center gap-1.5 rounded-md bg-ink/[0.05] px-2 py-1 text-xs text-ink-soft hover:text-ink"
              [routerLink]="['/proyectos', loc.projectId, 'mapa']"
              [queryParams]="{ loc: loc.id }"
              (click)="panel.close()"
            >
              <app-icon name="pin" [size]="13" /> {{ loc.name }} · ver en el mapa
            </a>
          }

          <!-- Estado: cuatro botones en lugar de un desplegable -->
          <div class="mt-5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Estado">
            @for (st of statusOrder; track st) {
              <button
                type="button"
                role="radio"
                class="chip h-8 gap-1.5 disabled:cursor-default"
                [class.chip-active]="st === t.status"
                [attr.aria-checked]="st === t.status"
                [disabled]="!canEdit()"
                (click)="update(t, { status: st })"
              >
                <span class="size-2 rounded-full" [class]="st === t.status ? 'bg-surface' : fill[status[st].tone]"></span>
                {{ status[st].label }}
              </button>
            }
          </div>

          @if (t.blocked) {
            <div class="mt-4 rounded-2xl bg-coral-soft p-4">
              <div class="flex items-center gap-2 text-coral">
                <app-icon name="lock" [size]="15" />
                <span class="font-medium">Bloqueada</span>
                @if (canEdit()) {
                  <button class="btn btn-sm ml-auto h-7 bg-surface text-ink hover:bg-paper" (click)="update(t, { blocked: false, blockedReason: undefined })">
                    Desbloquear
                  </button>
                }
              </div>
              <input
                class="mt-2 w-full border-0 bg-transparent p-0 text-sm text-ink placeholder:text-coral/60 focus:outline-none"
                placeholder="¿Qué la bloquea? (opcional)"
                aria-label="Motivo del bloqueo"
                [value]="t.blockedReason ?? ''"
                [disabled]="!canEdit()"
                (change)="update(t, { blockedReason: $any($event.target).value.trim() || undefined })"
              />
            </div>
          }

          <dl class="mt-5 grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-3">
            <dt class="text-ink-soft">Responsable</dt>
            <dd class="flex items-center gap-2">
              <app-avatar [member]="assignee()" [size]="26" />
              <select
                class="input h-9 max-w-60"
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
                class="input h-9 max-w-44"
                [value]="dateValue()"
                [disabled]="!canEdit()"
                (change)="update(t, { dueAt: toIso($any($event.target).value) })"
              />
            </dd>
          </dl>

          <details class="group/more mt-4">
            <summary class="flex cursor-pointer list-none items-center gap-2 text-sm text-ink-soft hover:text-ink">
              <app-icon name="chevron-down" [size]="14" class="transition-transform group-open/more:rotate-180" />
              Más detalles
              <span class="truncate text-xs text-ink-faint">{{ extraSummary() }}</span>
            </summary>
            <dl class="mt-3 grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-3">
              <dt class="text-ink-soft">Prioridad</dt>
              <dd>
                <select class="input h-9 max-w-44" [disabled]="!canEdit()" (change)="update(t, { priority: $any($event.target).value })">
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
                  class="input h-9 w-24"
                  [value]="t.estimateHours ?? ''"
                  [disabled]="!canEdit()"
                  (change)="setEstimate(t, $any($event.target).value)"
                />
                <span class="text-ink-faint">horas</span>
              </dd>

              <dt class="text-ink-soft">Etiquetas</dt>
              <dd>
                <input
                  class="input h-9"
                  placeholder="separadas por comas"
                  [value]="t.tags.join(', ')"
                  [disabled]="!canEdit()"
                  (change)="update(t, { tags: parseTags($any($event.target).value) })"
                />
              </dd>
            </dl>
          </details>

          @if (!t.blocked && canEdit()) {
            <button class="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-sm text-ink-faint hover:text-coral" (click)="update(t, { blocked: true })">
              <app-icon name="lock" [size]="13" /> Marcar como bloqueada
            </button>
          }

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

          @if (project()?.moduleIds?.includes('files') || attachments() > 0) {
            <section class="mt-7">
              <h3 class="eyebrow mb-2">Adjuntos</h3>
              <app-files-board [projectId]="t.projectId" [taskId]="t.id" [compact]="true" />
            </section>
          }

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
                <li class="group flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-ink/[0.03]">
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
  private readonly files = inject(FileService);
  private readonly locations = inject(LocationService);
  private savedTimer?: ReturnType<typeof setTimeout>;

  /** Confirmación visual breve tras cada cambio (no hay botón «Guardar»). */
  protected readonly justSaved = signal(false);

  private flashSaved(): void {
    this.justSaved.set(true);
    clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => this.justSaved.set(false), 1800);
  }

  protected readonly status = TASK_STATUS;
  protected readonly fill = TONE_FILL;
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
  protected readonly location = computed(() => this.locations.byId(this.task()?.locationId));
  protected readonly sourceNote = computed(() => {
    const id = this.task()?.sourceNoteId;
    return id ? this.notes.visible().find((n) => n.id === id) : undefined;
  });
  protected readonly canEdit = computed(() => this.session.can('task.edit'));
  protected readonly dateValue = computed(() => toDateInput(this.task()?.dueAt));
  protected readonly attachments = computed(() => this.files.countByTask().get(this.task()?.id ?? '') ?? 0);
  /** Resumen de los campos plegados, para que no queden «escondidos» si tienen valor. */
  protected readonly extraSummary = computed(() => {
    const t = this.task();
    if (!t) return '';
    const parts: string[] = [];
    if (t.priority !== 'medium') parts.push(`prioridad ${PRIORITY[t.priority].label.toLowerCase()}`);
    if (t.estimateHours) parts.push(`${t.estimateHours} h`);
    if (t.tags.length) parts.push(t.tags.map((tag) => '#' + tag).join(' '));
    return parts.join(' · ');
  });
  protected readonly subtasksDone = computed(() => this.task()?.subtasks.filter((s) => s.done).length ?? 0);

  protected update(task: Task, patch: TaskPatch): void {
    void this.tasks.update(task, patch);
    this.flashSaved();
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
    this.panel.close();
    this.tasks.remove(task);
  }

  protected ago(iso: string): string {
    return timeAgo(iso);
  }
}

