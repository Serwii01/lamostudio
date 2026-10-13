import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Permission, ROLE_LABEL } from '../core/catalog';
import { ProjectService } from '../core/services/projects';
import { SessionService } from '../core/services/session';
import { QuickCaptureService, TaskPanelService, ToastService } from '../core/services/ui-state';
import { TaskPanel } from '../features/task-panel/task-panel';
import { Avatar } from '../shared/ui/avatar';
import { Icon } from '../shared/ui/icon';
import { LogoMark } from '../shared/ui/logo';
import { GlobalSearch } from './global-search';
import { QuickCapture } from './quick-capture';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  exact?: boolean;
  perm?: Permission;
}

/** Secciones que ya funcionan. */
const NAV: NavItem[] = [
  { label: 'Inicio', path: '/', icon: 'home', exact: true },
  { label: 'Mis tareas', path: '/mis-tareas', icon: 'check-square' },
  { label: 'Proyectos', path: '/proyectos', icon: 'folder' },
  { label: 'Notas', path: '/notas', icon: 'note' },
  { label: 'Biblioteca', path: '/biblioteca', icon: 'image' },
  { label: 'Equipo', path: '/equipo', icon: 'users', perm: 'team.viewLoad' },
];

/** Secciones planificadas: agrupadas aparte para no confundir con las que ya funcionan. */
const NAV_SOON: NavItem[] = [
  { label: 'Calendario', path: '/calendario', icon: 'calendar' },
  { label: 'Entregables', path: '/entregables', icon: 'package' },
  { label: 'Clientes', path: '/clientes', icon: 'briefcase' },
  { label: 'Informes', path: '/informes', icon: 'chart' },
];

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Avatar, LogoMark, GlobalSearch, QuickCapture, TaskPanel],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <div class="min-h-dvh lg:pl-64">
      <!-- Barra lateral -->
      <aside
        class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line/70 bg-paper transition-transform duration-300 lg:translate-x-0"
        [class.-translate-x-full]="!navOpen()"
        aria-label="Navegación principal"
      >
        <a routerLink="/" class="flex shrink-0 items-center gap-3 px-6 pt-7 pb-6" (click)="navOpen.set(false)">
          <app-logo-mark [size]="40" class="text-shu" />
          <span class="leading-none">
            <span class="block text-lg font-bold tracking-[0.12em] text-shu">LAMO</span>
            <span class="hand mt-1 block text-sm">{{ session.workspace().cycle }}</span>
          </span>
        </a>

        <nav class="flex-1 overflow-y-auto px-3 pb-4">
          <ul class="space-y-0.5">
            @for (item of nav(); track item.path) {
              <li>
                <a
                  [routerLink]="item.path"
                  routerLinkActive="is-active"
                  [routerLinkActiveOptions]="{ exact: !!item.exact }"
                  class="group flex h-10 items-center gap-3 rounded-full px-3 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink [&.is-active]:font-medium [&.is-active]:text-ink"
                  (click)="navOpen.set(false)"
                >
                  <app-icon [name]="item.icon" [size]="17" />
                  <span class="flex-1">{{ item.label }}</span>
                  <span class="size-2 rounded-full bg-shu opacity-0 transition-opacity group-[.is-active]:opacity-100"></span>
                </a>
              </li>
            }
          </ul>

          @if (activeProjects().length) {
            <p class="eyebrow px-3 pt-7 pb-2">Proyectos activos</p>
            <ul class="space-y-0.5">
              @for (p of activeProjects(); track p.id) {
                <li>
                  <a
                    [routerLink]="['/proyectos', p.id]"
                    routerLinkActive="is-active"
                    class="flex h-8 items-center gap-3 rounded-full px-3 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink [&.is-active]:bg-ink/5 [&.is-active]:text-ink"
                    (click)="navOpen.set(false)"
                  >
                    <span class="size-2.5 shrink-0 rounded-full" [style.background]="p.cover"></span>
                    <span class="truncate">{{ p.name }}</span>
                  </a>
                </li>
              }
            </ul>
          }

          <details class="group/soon mt-7">
            <summary class="eyebrow flex cursor-pointer list-none items-center gap-1.5 px-3 py-1 hover:text-ink">
              En camino
              <app-icon name="chevron-down" [size]="12" class="transition-transform group-open/soon:rotate-180" />
            </summary>
            <ul class="mt-1 space-y-0.5">
              @for (item of soon; track item.path) {
                <li>
                  <a
                    [routerLink]="item.path"
                    routerLinkActive="!text-ink"
                    class="flex h-8 items-center gap-3 rounded-full px-3 text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink-soft"
                    (click)="navOpen.set(false)"
                  >
                    <app-icon [name]="item.icon" [size]="15" />
                    {{ item.label }}
                  </a>
                </li>
              }
            </ul>
          </details>
        </nav>

        <div class="space-y-3 border-t border-line/70 px-4 py-4">
          <p class="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-ink-faint">
            <span><kbd class="kbd">N</kbd> nota</span>
            <span><kbd class="kbd">/</kbd> buscar</span>
            <span><kbd class="kbd">Esc</kbd> cerrar</span>
          </p>
          <div class="flex items-center gap-2">
            <details class="group/user relative min-w-0 flex-1" #userMenu>
              <summary class="flex cursor-pointer list-none items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-ink/5" title="Cambiar de usuario (modo demo)">
                <app-avatar [member]="session.currentUser()" [size]="32" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ session.currentUser().name }}</span>
                  <span class="block truncate text-xs text-ink-faint">{{ roleLabel[session.currentUser().role] }}</span>
                </span>
                <app-icon name="chevron-down" [size]="13" class="text-ink-faint transition-transform group-open/user:rotate-180" />
              </summary>
              <div class="card absolute bottom-full left-0 z-50 mb-2 w-60 p-1.5 shadow-xl shadow-ink/10">
                <p class="px-2.5 pt-1.5 pb-1 text-xs text-ink-faint">Modo demo · ver la app como</p>
                @for (m of session.members(); track m.id) {
                  <button
                    class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left hover:bg-ink/5"
                    [class.bg-ink/5]="m.id === session.currentUserId()"
                    (click)="switchUser(m.id, userMenu)"
                  >
                    <app-avatar [member]="m" [size]="24" />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate">{{ m.name }}</span>
                      <span class="block truncate text-xs text-ink-faint">{{ roleLabel[m.role] }}</span>
                    </span>
                  </button>
                }
              </div>
            </details>
            @if (session.can('project.manage')) {
              <a routerLink="/configuracion" class="btn btn-ghost size-8 px-0" title="Configuración" aria-label="Configuración" (click)="navOpen.set(false)">
                <app-icon name="settings" />
              </a>
            }
          </div>
        </div>
      </aside>

      @if (navOpen()) {
        <div class="fixed inset-0 z-30 bg-ink/25 lg:hidden" (click)="navOpen.set(false)"></div>
      }

      <!-- Barra superior -->
      <header class="sticky top-0 z-20 flex h-16 items-center gap-2 bg-paper/80 px-4 backdrop-blur-md lg:px-10">
        <button class="btn btn-ghost size-9 px-0 lg:hidden" aria-label="Abrir menú" (click)="navOpen.set(true)">
          <app-icon name="menu" [size]="18" />
        </button>
        <app-global-search class="max-w-md min-w-0 flex-1" />
        <div class="ml-auto flex items-center gap-2">
          @if (session.can('note.create')) {
            <button class="btn btn-outline px-3 sm:px-4" title="Nota rápida (N)" (click)="capture.open()">
              <app-icon name="pen" />
              <span class="hidden sm:inline">Nota rápida</span>
            </button>
          }
          @if (session.can('project.create')) {
            <a class="btn btn-primary px-3 sm:px-4" routerLink="/proyectos/nuevo" title="Nuevo proyecto">
              <app-icon name="plus" />
              <span class="hidden sm:inline">Nuevo proyecto</span>
            </a>
          }
        </div>
      </header>

      <main class="mx-auto max-w-[1360px] px-4 pt-4 pb-16 lg:px-10 lg:pt-6">
        <router-outlet />
      </main>
    </div>

    <app-task-panel />

    @if (capture.isOpen()) {
      <app-quick-capture />
    }

    <div class="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="pointer-events-auto flex max-w-[92vw] items-center gap-2 rounded-full bg-ink py-2 pr-2 pl-4 text-surface shadow-lg shadow-ink/20" [class.pr-5]="!t.action">
          <app-icon [name]="t.tone === 'error' ? 'alert' : 'check-hand'" [size]="18" [stroke]="t.tone === 'error' ? 1.8 : 2.4" class="shrink-0 text-shu" />
          <span class="min-w-0">{{ t.text }}</span>
          @if (t.action; as action) {
            <button class="btn btn-sm h-8 shrink-0 bg-surface text-ink hover:bg-paper" (click)="toast.runAction(t)">{{ action.label }}</button>
          }
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
  private readonly search = viewChild.required(GlobalSearch);

  protected readonly nav = computed(() => NAV.filter((item) => !item.perm || this.session.can(item.perm)));
  protected readonly soon = NAV_SOON;
  protected readonly roleLabel = ROLE_LABEL;
  protected readonly navOpen = signal(false);
  protected readonly activeProjects = computed(() => this.projects.active());

  protected switchUser(id: string, menu: HTMLDetailsElement): void {
    this.session.switchUser(id);
    menu.open = false;
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target;
    const typing = target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');
    if (typing || event.ctrlKey || event.metaKey || event.altKey || this.panel.openId() || this.capture.isOpen()) return;
    if (event.key.toLowerCase() === 'n' && this.session.can('note.create')) {
      event.preventDefault();
      this.capture.open();
    } else if (event.key === '/') {
      event.preventDefault();
      this.search().focus();
    }
  }
}
