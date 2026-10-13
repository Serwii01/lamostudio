import { Injectable, computed, inject } from '@angular/core';
import { LOCATION_CATEGORY, LOCATION_STATUS } from '../catalog';
import { Id, LocationCategory, ProjectLocation, Task } from '../models';
import { LocationPatch, LocationRepository } from '../data/repositories';
import { daysFromToday } from '../utils/dates';
import { ActivityService } from './activity';
import { SessionService } from './session';
import { TaskService } from './tasks';
import { TaskPanelService, ToastService } from './ui-state';
import { PendingDeletes } from './undo';

export interface NewLocationDraft {
  projectId: Id;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  category?: LocationCategory;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly repo = inject(LocationRepository);
  private readonly session = inject(SessionService);
  private readonly activity = inject(ActivityService);
  private readonly tasks = inject(TaskService);
  private readonly panel = inject(TaskPanelService);
  private readonly toast = inject(ToastService);
  private readonly deletes = new PendingDeletes<ProjectLocation>(this.toast);

  readonly all = this.deletes.filter(this.repo.locations);

  /** Tareas enlazadas a cada localización. */
  readonly tasksByLocation = computed(() => {
    const map = new Map<Id, Task[]>();
    for (const t of this.tasks.all()) {
      if (t.locationId) map.set(t.locationId, [...(map.get(t.locationId) ?? []), t]);
    }
    return map;
  });

  byProject(projectId: Id): ProjectLocation[] {
    return this.all().filter((l) => l.projectId === projectId);
  }

  byId(id: Id | null | undefined): ProjectLocation | undefined {
    return id ? this.all().find((l) => l.id === id) : undefined;
  }

  canEdit(): boolean {
    return this.session.can('task.edit');
  }

  async create(draft: NewLocationDraft): Promise<ProjectLocation> {
    const location = await this.repo.create({
      projectId: draft.projectId,
      name: draft.name,
      lat: round(draft.lat),
      lng: round(draft.lng),
      address: draft.address,
      category: draft.category ?? 'shoot',
      status: 'candidate',
      createdBy: this.session.currentUserId(),
    });
    this.activity.log('location.created', { id: location.id, label: location.name }, { projectId: location.projectId });
    return location;
  }

  update(location: ProjectLocation, patch: LocationPatch): void {
    const clean = { ...patch };
    if (clean.lat !== undefined) clean.lat = round(clean.lat);
    if (clean.lng !== undefined) clean.lng = round(clean.lng);
    void this.repo.update(location.id, clean);
    if (patch.status && patch.status !== location.status) {
      this.activity.log('location.status', { id: location.id, label: location.name }, {
        projectId: location.projectId,
        detail: LOCATION_STATUS[patch.status].label,
      });
    }
  }

  remove(location: ProjectLocation): void {
    this.deletes.remove(location, `«${location.name}» quitada del mapa`, () => this.repo.remove(location.id));
  }

  /**
   * «Programar visita»: crea una tarea enlazada a la localización, con la fecha
   * prevista si es futura, asignada a quien la programa.
   */
  async scheduleVisit(location: ProjectLocation): Promise<Task> {
    const kind = location.category === 'shoot' ? 'Visita de scouting' : `Visita · ${LOCATION_CATEGORY[location.category].label.toLowerCase()}`;
    const future = location.startAt && daysFromToday(location.startAt) >= 0 ? location.startAt : undefined;
    const task = await this.tasks.create({
      projectId: location.projectId,
      title: `${kind}: ${location.name}`,
      description: [location.address, location.notes].filter(Boolean).join('\n\n') || undefined,
      locationId: location.id,
      dueAt: future,
      assigneeId: this.session.currentUserId(),
      tags: ['localizaciones'],
    });
    this.toast.show('Visita programada', { label: 'Abrir', run: () => this.panel.open(task.id) });
    return task;
  }
}

/** 6 decimales ≈ 10 cm: suficiente y evita ruido en los datos. */
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
