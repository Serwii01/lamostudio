import { Injectable, effect, signal } from '@angular/core';
import { ActivityEntry, FileAsset, Member, Project, QuickNote, Task, Workspace } from '../../models';
import { createSeed } from './mock-seed';

export interface DbState {
  version: 3;
  workspace: Workspace;
  members: Member[];
  projects: Project[];
  tasks: Task[];
  notes: QuickNote[];
  activity: ActivityEntry[];
  /** Metadatos de archivos; el contenido binario vive en blob-store (IndexedDB). */
  files: FileAsset[];
}

const STORAGE_KEY = 'lamo-studio:db';

/**
 * Base de datos en memoria para la fase de prototipo. Se persiste en localStorage
 * para que los cambios sobrevivan a una recarga; si el almacenamiento no está
 * disponible, la app sigue funcionando solo en memoria.
 */
@Injectable({ providedIn: 'root' })
export class MockDb {
  readonly state = signal<DbState>(loadState());

  constructor() {
    effect(() => {
      const snapshot = this.state();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Sin almacenamiento disponible: se trabaja solo en memoria.
      }
    });
  }

  patch<K extends keyof Omit<DbState, 'version'>>(key: K, fn: (current: DbState[K]) => DbState[K]): void {
    this.state.update((state) => ({ ...state, [key]: fn(state[key]) }));
  }

  reset(): void {
    this.state.set(createSeed());
  }
}

function loadState(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DbState;
      if (parsed.version === 3) return parsed;
    }
  } catch {
    // Datos corruptos o almacenamiento bloqueado: se vuelve a la semilla.
  }
  return createSeed();
}
