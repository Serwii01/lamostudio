import { Injectable, computed, inject, signal } from '@angular/core';
import { Permission, ROLE_PERMISSIONS } from '../catalog';
import { Id, Member } from '../models';
import { WorkspaceRepository } from '../data/repositories';

const USER_KEY = 'lamo-studio:user';

/**
 * Usuario actual. Mientras no haya autenticación real, se puede cambiar de usuario
 * desde la barra lateral para probar cómo ve la app cada rol.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly workspaceRepo = inject(WorkspaceRepository);

  readonly workspace = this.workspaceRepo.workspace;
  readonly members = this.workspaceRepo.members;
  readonly currentUserId = signal<Id>(readStoredUser() ?? 'u_lucia');

  readonly currentUser = computed<Member>(
    () => this.members().find((m) => m.id === this.currentUserId()) ?? this.members()[0],
  );

  private readonly permissions = computed(() => new Set(ROLE_PERMISSIONS[this.currentUser().role]));

  can(permission: Permission): boolean {
    return this.permissions().has(permission);
  }

  member(id: Id | undefined): Member | undefined {
    return id ? this.members().find((m) => m.id === id) : undefined;
  }

  switchUser(id: Id): void {
    this.currentUserId.set(id);
    try {
      localStorage.setItem(USER_KEY, id);
    } catch {
      // Preferencia no persistida; no afecta al funcionamiento.
    }
  }
}

function readStoredUser(): Id | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}
