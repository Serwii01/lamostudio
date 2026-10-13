import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Permission, ROLE_LABEL } from '../core/catalog';
import { ProjectService } from '../core/services/projects';
import { SessionService } from '../core/services/session';
import { QuickCaptureService, TaskPanelService, ToastService } from '../core/services/ui-state';
import { TaskPanel } from '../features/task-panel/task-panel';
import { Avatar } from '../shared/ui/avatar';
import { Icon } from '../shared/ui/icon';
import { GlobalSearch } from './global-search';
import { QuickCapture } from './quick-capture';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  exact?: boolean;
  soon?: boolean;
  perm?: Permission;
}

const NAV: NavItem[] = [
  { label: 'Inicio', path: '/', icon: 'home', exact: true },
  { label: 'Mis tareas', path: '/mis-tareas', icon: 'check-square' },
  { label: 'Proyectos', path: '/proyectos', icon: 'folder' },
  { label: 'Notas', path: '/notas', icon: 'note' },
  { label: 'Calendario', path: '/calendario', icon: 'calendar', soon: true },
  { label: 'Entregables', path: '/entregables', icon: 'package', soon: true },
  { label: 'Equipo', path: '/equipo', icon: 'users', perm: 'team.viewLoad' },
  { label: 'Biblioteca', path: '/biblioteca', icon: 'image', soon: true },
  { label: 'Clientes', path: '/clientes', icon: 'briefcase', soon: true },
  { label: 'Informes', path: '/informes', icon: 'chart', soon: true },
  { label: 'Configuración', path: '/configuracion', icon: 'settings', perm: 'project.manage' },
];

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, Icon, Avatar, GlobalSearch, QuickCapture, TaskPanel],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <div class="min-h-dvh lg:pl-64">
      <!-- Barra lateral -->
      <aside
        class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-200 lg:translate-x-0"
        [class.-translate-x-full]="!navOpen()"
        aria-label="Navegación principal"
      >
        <a routerLink="/" class="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4" (click)="navOpen.set(false)">
          <img src="favicon.svg" alt="" class="size-7" />
          <span class="leading-tight">
            <span class="block font-display text-[15px] font-semibold">{{ session.workspace().name }}</span>
            <span class="block text-[11px] text-ink-faint">{{ session.workspace().cycle }}</span>
          </span>
        </a>

        <nav class="flex-1 space-y-0.5 overflow-y-auto p-3">
          @for (item of nav(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-line-soft !text-ink font-medium"
              [routerLinkActiveOptions]="{ exact: !!item.exact }"
              class="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-ink-soft hover:bg-line-soft hover:text-ink"
              (click)="navOpen.set(false)"
            >
              <app-icon [name]="item.icon" />
              {{ item.label }}
              @if (item.soon) {
                <span class="ml-auto text-[10px] tracking-wide text-ink-faint uppercase">pronto</span>
              }
            </a>
          }

          @if (activeProjects().length) {
            <p class="eyebrow px-2.5 pt-6 pb-1.5">Proyectos activos</p>
            @for (p of activeProjects(); track p.id) {
              <a
                [routerLink]="['/proyectos', p.id]"
                routerLinkActive="bg-line-soft !text-ink"
                class="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-ink-soft hover:bg-line-soft hover:text-ink"
                (click)="navOpen.set(false)"
              >
                <span class="size-2 shrink-0 rounded-sm" [style.background]="p.cover"></span>
                <span class="truncate">{{ p.name }}</span>
              </a>
            }
          }
        </nav>

        <div class="border-t border-line p-3">
          <label for="current-user" class="label px-1">Viendo la app como</label>
          <div class="flex items-center gap-2">
            <app-avatar [member]="session.currentUser()" [size]="30" />
            <select
              id="current-user"
              class="input h-8 text-xs"
              [ngModel]="session.currentUserId()"
              (ngModelChange)="session.switchUser($event)"
            >
              @for (m of session.members(); track m.id) {
                <option [value]="m.id">{{ m.name }} · {{ roleLabel[m.role] }}</option>
              }
            </select>
          </div>
        </div>
      </aside>

      @if (navOpen()) {
        <div class="fixed inset-0 z-30 bg-ink/30 lg:hidden" (click)="navOpen.set(false)"></div>
      }

      <!-- Barra superior -->
      <header class="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-paper/85 px-4 backdrop-blur lg:px-8">
        <button class="btn btn-ghost px-2 lg:hidden" aria-label="Abrir menú" (click)="navOpen.set(true)">
          <app-icon name="menu" [size]="18" />
        </button>
        <app-global-search class="max-w-md min-w-0 flex-1" />
        <div class="ml-auto flex items-center gap-2">
          @if (session.can('note.create')) {
            <button class="btn btn-outline px-2.5 sm:px-3" title="Nota rápida (N)" (click)="capture.open()">
              <app-icon name="note" />
              <span class="hidden sm:inline">Nota rápida</span>
            </button>
          }
          @if (session.can('project.create')) {
            <a class="btn btn-primary px-2.5 sm:px-3" routerLink="/proyectos/nuevo" title="Nuevo proyecto">
              <app-icon name="plus" />
              <span class="hidden sm:inline">Nuevo proyecto</span>
            </a>
          }
        </div>
      </header>

      <main class="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
        <router-outlet />
      </main>
    </div>

    <app-task-panel />

    @if (capture.isOpen()) {
      <app-quick-capture />
    }

    <div class="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="pointer-events-auto flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-paper shadow-lg">
          <app-icon name="check" class="text-moss-soft" />
          {{ t.text }}
        </div>
      }
    </div>
  `,
})
export class AppShell {
  protected readonly session = inject(SessionService);
  protected readonly capture = inject(QuickCaptureService);
  protected readonly toast = inject(ToastService);
  private readonly projects = inject(ProjectService);
  private readonly panel = inject(TaskPanelService);

  protected readonly nav = computed(() => NAV.filter((item) => !item.perm || this.session.can(item.perm)));
  protected readonly roleLabel = ROLE_LABEL;
  protected readonly navOpen = signal(false);
  protected readonly activeProjects = computed(() => this.projects.active());

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target;
    const typing = target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');
    if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === 'n' && this.session.can('note.create') && !this.panel.openId()) {
      event.preventDefault();
      this.capture.open();
    }
  }
}
