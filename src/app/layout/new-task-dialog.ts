import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../core/services/projects';
import { SessionService } from '../core/services/session';
import { TaskService } from '../core/services/tasks';
import { NewTaskService, TaskPanelService, ToastService } from '../core/services/ui-state';
import { fromDateInput, isoDaysFromNow, toDateInput } from '../core/utils/dates';
import { Avatar } from '../shared/ui/avatar';
import { Icon } from '../shared/ui/icon';

const QUICK_DATES = [
  { label: 'Hoy', days: 0 },
  { label: 'Mañana', days: 1 },
  { label: 'Próxima semana', days: 7 },
];

/** Crear una tarea desde cualquier pantalla: qué, dónde, quién y cuándo. Nada más. */
@Component({
  selector: 'app-new-task-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Avatar, Icon],
  host: { '(document:keydown.escape)': 'dialog.close()' },
  template: `
    <div class="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-[12vh] backdrop-blur-[2px]" (click)="dialog.close()">
      <form
        class="card w-full max-w-lg p-6 shadow-2xl shadow-ink/15"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-task-title"
        (click)="$event.stopPropagation()"
        (ngSubmit)="create()"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 id="new-task-title" class="card-title text-lg">Nueva tarea</h2>
          <button type="button" class="btn btn-ghost size-8 px-0" aria-label="Cerrar" (click)="dialog.close()">
            <app-icon name="x" />
          </button>
        </div>

        <label class="block">
          <span class="label">¿Qué hay que hacer?</span>
          <input
            #titleField
            class="input h-11 text-base"
            name="title"
            placeholder="p. ej. Enviar presupuesto de iluminación"
            [(ngModel)]="title"
            autocomplete="off"
            required
          />
        </label>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="label">Proyecto</span>
            <select class="input" name="project" [(ngModel)]="projectId" required>
              @for (p of projects.active(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          </label>
          <label class="block">
            <span class="label">Responsable</span>
            <span class="flex items-center gap-2">
              <app-avatar [member]="session.member(assigneeId())" [size]="28" />
              <select class="input" name="assignee" [(ngModel)]="assigneeId">
                <option value="">Sin responsable</option>
                @for (m of team(); track m.id) {
                  <option [value]="m.id">{{ m.id === session.currentUserId() ? m.name + ' (yo)' : m.name }}</option>
                }
              </select>
            </span>
          </label>
        </div>

        <div class="mt-4">
          <span class="label">Fecha límite <span class="font-normal text-ink-faint">(opcional)</span></span>
          <div class="flex flex-wrap items-center gap-2">
            @for (q of quickDates; track q.days) {
              <button type="button" class="chip" [class.chip-active]="due() === dateFor(q.days)" (click)="toggleDue(dateFor(q.days))">
                {{ q.label }}
              </button>
            }
            <input type="date" class="input h-8 w-auto rounded-full" name="due" aria-label="Otra fecha" [(ngModel)]="due" />
          </div>
        </div>

        <div class="mt-6 flex items-center justify-between gap-3">
          <span class="hidden text-xs text-ink-faint sm:inline">Enter para crear · Esc para cancelar</span>
          <div class="ml-auto flex gap-2">
            <button type="button" class="btn btn-ghost" (click)="dialog.close()">Cancelar</button>
            <button type="submit" class="btn btn-primary" [disabled]="!title().trim() || !projectId()">Crear tarea</button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class NewTaskDialog {
  protected readonly dialog = inject(NewTaskService);
  protected readonly projects = inject(ProjectService);
  protected readonly session = inject(SessionService);
  private readonly tasks = inject(TaskService);
  private readonly panel = inject(TaskPanelService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly titleField = viewChild.required<ElementRef<HTMLInputElement>>('titleField');

  protected readonly quickDates = QUICK_DATES;
  protected readonly title = signal('');
  protected readonly due = signal('');

  /** Proyecto por defecto: el que estás viendo o, si no, el primero activo. */
  protected readonly projectId = signal(this.defaultProject());

  protected readonly team = computed(() => {
    const ids = new Set(this.projects.byId(this.projectId())?.memberIds ?? []);
    return this.session.members().filter((m) => ids.has(m.id) && m.role !== 'client' && m.role !== 'guest');
  });

  /** Responsable por defecto: tú, si formas parte del equipo del proyecto. */
  protected readonly assigneeId = linkedSignal(() =>
    this.team().some((m) => m.id === this.session.currentUserId()) ? this.session.currentUserId() : '',
  );

  constructor() {
    afterNextRender(() => this.titleField().nativeElement.focus());
  }

  protected dateFor(days: number): string {
    return toDateInput(isoDaysFromNow(days));
  }

  protected toggleDue(value: string): void {
    this.due.set(this.due() === value ? '' : value);
  }

  protected async create(): Promise<void> {
    const title = this.title().trim();
    const projectId = this.projectId();
    if (!title || !projectId) return;
    const task = await this.tasks.create({
      projectId,
      title,
      assigneeId: this.assigneeId() || undefined,
      dueAt: fromDateInput(this.due()),
    });
    this.dialog.close();
    this.toast.show('Tarea creada', { label: 'Abrir', run: () => this.panel.open(task.id) });
  }

  private defaultProject(): string {
    const fromUrl = this.router.url.match(/^\/proyectos\/([^/?]+)/)?.[1];
    const active = this.projects.active();
    return active.find((p) => p.id === fromUrl)?.id ?? active[0]?.id ?? '';
  }
}
