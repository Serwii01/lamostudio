import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MODULES } from '../../core/catalog';
import { ActivityService } from '../../core/services/activity';
import { ProjectService } from '../../core/services/projects';
import { ActivityFeed } from '../../shared/activity-feed';
import { Empty } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-project-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActivityFeed],
  template: `
    <section class="card max-w-3xl p-5">
      <h2 class="mb-5 font-display text-lg font-semibold">Actividad del proyecto</h2>
      <app-activity-feed [entries]="entries()" />
    </section>
  `,
})
export class ProjectActivity {
  readonly projectId = input.required<string>();
  private readonly activity = inject(ActivityService);
  protected readonly entries = computed(() =>
    this.activity
      .entries()
      .filter((e) => e.projectId === this.projectId())
      .slice(0, 100),
  );
}

/** Pantalla para los módulos aún no construidos: explica qué hará y en qué fase llega. */
@Component({
  selector: 'app-module-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Empty, Icon],
  template: `
    @if (module(); as m) {
      <section class="card mx-auto max-w-2xl p-8 text-center">
        <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-line-soft text-ink-soft">
          <app-icon [name]="m.icon" [size]="26" />
        </span>
        <p class="eyebrow mt-5">{{ m.phase }} · Próximamente</p>
        <h2 class="mt-1 font-display text-2xl font-semibold">{{ m.label }}</h2>
        <p class="mx-auto mt-2 max-w-md text-ink-soft">{{ m.description }}</p>
        @if (!enabled()) {
          <p class="mt-4 rounded-lg bg-honey-soft px-3 py-2 text-honey">Este módulo no está activado en el proyecto.</p>
        }
        @if (m.planned.length) {
          <ul class="mx-auto mt-6 max-w-sm space-y-2 text-left">
            @for (item of m.planned; track item) {
              <li class="flex items-start gap-2.5">
                <app-icon name="check" class="mt-0.5 text-moss" />
                <span>{{ item }}</span>
              </li>
            }
          </ul>
        }
        <div class="mt-7 flex justify-center gap-2">
          <a routerLink="../resumen" class="btn btn-outline">Volver al resumen</a>
          <a routerLink="../notas" class="btn btn-ghost">Mientras tanto, usa Notas</a>
        </div>
      </section>
    } @else {
      <div class="card"><app-empty title="Módulo desconocido" /></div>
    }
  `,
})
export class ModulePlaceholder {
  readonly projectId = input.required<string>();
  readonly modulePath = input.required<string>();
  private readonly projects = inject(ProjectService);

  protected readonly module = computed(() => MODULES.find((m) => m.path === this.modulePath()));
  protected readonly enabled = computed(() => {
    const id = this.module()?.id;
    return !!id && !!this.projects.byId(this.projectId())?.moduleIds.includes(id);
  });
}
