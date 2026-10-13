import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Permission, ROLE_LABEL, ROLE_PERMISSIONS, isTaskDone } from '../../core/catalog';
import { DataAdmin } from '../../core/data/repositories';
import { MemberRole } from '../../core/models';
import { ProjectService } from '../../core/services/projects';
import { SessionService } from '../../core/services/session';
import { TaskService } from '../../core/services/tasks';
import { ToastService } from '../../core/services/ui-state';
import { Avatar } from '../../shared/ui/avatar';
import { Progress } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';

/** Equipo y capacidad: horas planificadas esta semana frente a disponibilidad. */
@Component({
  selector: 'app-team',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Progress],
  template: `
    <header>
      <p class="eyebrow">{{ session.workspace().name }}</p>
      <h1 class="page-title mt-2">Equipo</h1>
      <p class="hand mt-2 text-base">Carga calculada con las horas estimadas de tareas abiertas que vencen en los próximos 7 días.</p>
    </header>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      @for (row of rows(); track row.member.id) {
        <article class="card p-5">
          <div class="flex items-center gap-3">
            <app-avatar [member]="row.member" [size]="40" />
            <div class="min-w-0">
              <h2 class="truncate font-medium">{{ row.member.name }}</h2>
              <p class="truncate text-xs text-ink-faint">{{ roleLabel[row.member.role] }} · {{ row.member.specialty }}</p>
            </div>
          </div>
          @if (row.member.weeklyCapacity > 0) {
            <div class="mt-5 flex items-baseline justify-between">
              <span class="text-ink-soft">Esta semana</span>
              <span class="tabular-nums" [class]="row.ratio > 1 ? 'font-semibold text-coral' : 'text-ink'">
                {{ row.hours }} / {{ row.member.weeklyCapacity }} h
              </span>
            </div>
            <app-progress class="mt-2" [value]="row.ratio" [tone]="row.ratio > 1 ? 'coral' : row.ratio > 0.8 ? 'honey' : 'moss'" />
            @if (row.ratio > 1) {
              <p class="mt-2 text-xs text-coral">Sobrecarga de {{ row.hours - row.member.weeklyCapacity }} h: conviene redistribuir o mover fechas.</p>
            }
          } @else {
            <p class="mt-5 text-ink-faint">Colaborador externo: sin capacidad planificable.</p>
          }
          <dl class="mt-4 grid grid-cols-2 gap-2 text-center">
            <div class="rounded-lg bg-ink/[0.04] py-2">
              <dt class="text-xs text-ink-soft">Tareas abiertas</dt>
              <dd class="font-semibold">{{ row.open }}</dd>
            </div>
            <div class="rounded-lg bg-ink/[0.04] py-2">
              <dt class="text-xs text-ink-soft">Proyectos</dt>
              <dd class="font-semibold">{{ row.projects }}</dd>
            </div>
          </dl>
        </article>
      }
    </div>
  `,
})
export class Team {
  protected readonly session = inject(SessionService);
  private readonly tasks = inject(TaskService);
  private readonly projects = inject(ProjectService);

  protected readonly roleLabel = ROLE_LABEL;

  protected readonly rows = computed(() => {
    const load = this.tasks.weeklyLoad();
    const active = this.projects.active();
    return this.session.members().map((member) => {
      const hours = load.get(member.id) ?? 0;
      return {
        member,
        hours,
        ratio: member.weeklyCapacity ? hours / member.weeklyCapacity : 0,
        open: this.tasks.all().filter((t) => t.assigneeId === member.id && !isTaskDone(t.status)).length,
        projects: active.filter((p) => p.memberIds.includes(member.id)).length,
      };
    });
  });
}

const SHOWN_PERMISSIONS: Permission[] = ['project.create', 'task.edit', 'task.comment'];

@Component({
  selector: 'app-workspace-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <header>
      <p class="eyebrow">{{ session.workspace().name }}</p>
      <h1 class="page-title mt-2">Configuración</h1>
    </header>

    <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section class="card p-5">
        <h2 class="card-title">Roles y permisos</h2>
        <p class="mt-1 text-ink-soft">Permisos simples de la Fase 1. Cambia de usuario en la barra lateral para ver la app con cada rol.</p>
        <table class="mt-4 w-full text-left">
          <thead class="text-xs text-ink-faint">
            <tr class="border-b border-line/60">
              <th class="py-2 font-medium">Rol</th>
              <th class="py-2 text-center font-medium">Crear proyectos</th>
              <th class="py-2 text-center font-medium">Editar tareas</th>
              <th class="py-2 text-center font-medium">Comentar</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line/60">
            @for (role of roles; track role) {
              <tr>
                <td class="py-2.5">{{ roleLabel[role] }}</td>
                @for (perm of perms; track perm) {
                  <td class="py-2.5 text-center">
                    @if (has(role, perm)) {
                      <app-icon name="check" class="text-moss" />
                    } @else {
                      <span class="text-ink-faint">—</span>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </section>

      <section class="card p-5">
        <h2 class="card-title">Datos</h2>
        @if (admin.isDemo) {
          <p class="mt-1 text-ink-soft">
            Estás usando datos de demostración guardados en este navegador. Cuando se conecte Firebase, este apartado
            gestionará el espacio de trabajo real.
          </p>
          <button class="btn btn-outline mt-4" (click)="reset()"><app-icon name="refresh" /> Restablecer datos de demostración</button>
        }
      </section>
    </div>
  `,
})
export class WorkspaceSettings {
  protected readonly session = inject(SessionService);
  protected readonly admin = inject(DataAdmin);
  private readonly toast = inject(ToastService);

  protected readonly roleLabel = ROLE_LABEL;
  protected readonly roles = Object.keys(ROLE_LABEL) as MemberRole[];
  protected readonly perms = SHOWN_PERMISSIONS;

  protected has(role: MemberRole, perm: Permission): boolean {
    return ROLE_PERMISSIONS[role].includes(perm);
  }

  protected async reset(): Promise<void> {
    if (!confirm('Se perderán los cambios hechos en la demo. ¿Continuar?')) return;
    await this.admin.reset();
    this.toast.show('Datos restablecidos');
  }
}

/** Secciones globales planificadas para fases posteriores. */
@Component({
  selector: 'app-coming-soon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <section class="card mx-auto mt-4 max-w-2xl p-8 text-center">
      <span class="mx-auto grid size-16 place-items-center rounded-full border-[1.5px] border-dashed border-ink/25 text-ink-soft">
        <app-icon [name]="icon()" [size]="26" />
      </span>
      <p class="hand mt-5">{{ phase() }} · en camino</p>
      <h1 class="mt-1 font-display text-2xl font-light">{{ heading() }}</h1>
      <p class="mx-auto mt-2 max-w-md text-ink-soft">{{ summary() }}</p>
      <a routerLink="/" class="btn btn-outline mt-6">Volver al inicio</a>
    </section>
  `,
})
export class ComingSoon {
  readonly heading = input('Próximamente');
  readonly summary = input('');
  readonly phase = input('Fase 2');
  readonly icon = input('grid');
}
