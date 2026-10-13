import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DRAG_TIPS, SHORTCUT_GROUPS } from '../core/shortcuts';
import { CommandUiService } from '../core/services/ui-state';
import { Icon } from '../shared/ui/icon';
import { Keys } from '../shared/ui/keys';

/** Chuleta de atajos de teclado y gestos de arrastrar («?»). */
@Component({
  selector: 'app-shortcuts-help',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Keys],
  host: { '(document:keydown.escape)': 'ui.helpOpen.set(false)' },
  template: `
    <div class="fixed inset-0 z-[58] flex items-start justify-center overflow-y-auto bg-ink/30 px-4 py-[6vh] backdrop-blur-[2px]" (click)="ui.helpOpen.set(false)">
      <section
        class="card w-full max-w-4xl p-6 shadow-2xl shadow-ink/20 sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        (click)="$event.stopPropagation()"
      >
        <header class="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id="shortcuts-title" class="page-title">Atajos y gestos</h2>
            <p class="hand mt-2">Las teclas solas no hacen nada mientras escribes en un campo.</p>
          </div>
          <button class="btn btn-ghost size-9 px-0" aria-label="Cerrar" (click)="ui.helpOpen.set(false)">
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <div class="grid gap-x-10 gap-y-7 md:grid-cols-2">
          @for (group of groups; track group.title) {
            <section>
              <h3 class="eyebrow mb-2">{{ group.title }}</h3>
              <ul class="divide-y divide-line/60">
                @for (item of group.items; track item.label) {
                  <li class="flex items-center justify-between gap-4 py-2">
                    <span class="text-ink-soft">{{ item.label }}</span>
                    <app-keys [keys]="item.keys" />
                  </li>
                }
              </ul>
            </section>
          }
          <section class="md:col-span-2">
            <h3 class="eyebrow mb-2">Arrastrar y soltar</h3>
            <ul class="grid gap-2 sm:grid-cols-2">
              @for (tip of dragTips; track tip) {
                <li class="flex items-start gap-2.5 rounded-xl bg-ink/[0.04] px-3.5 py-3 text-ink-soft">
                  <app-icon name="grid" [size]="15" class="mt-0.5 shrink-0 text-shu" />
                  {{ tip }}
                </li>
              }
            </ul>
          </section>
        </div>
      </section>
    </div>
  `,
})
export class ShortcutsHelp {
  protected readonly ui = inject(CommandUiService);
  protected readonly groups = SHORTCUT_GROUPS;
  protected readonly dragTips = DRAG_TIPS;
}
