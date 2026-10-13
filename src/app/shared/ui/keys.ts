import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { parseKeys } from '../../core/shortcuts';

/** Muestra un atajo como teclas: «Mod+K» → [Ctrl][K]; «G P» → [G] luego [P]. */
@Component({
  selector: 'app-keys',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0 items-center gap-1 whitespace-nowrap' },
  template: `
    @for (combo of sequence(); track $index; let last = $last) {
      @for (key of combo; track $index) {
        <kbd class="kbd">{{ key }}</kbd>
      }
      @if (!last) {
        <span class="text-[10px] text-ink-faint">{{ separator() }}</span>
      }
    }
  `,
})
export class Keys {
  readonly keys = input.required<string>();
  protected readonly sequence = computed(() => parseKeys(this.keys()));
  /** «G P» es una secuencia; «Shift+← Shift+→» son alternativas. */
  protected readonly separator = computed(() => (this.keys().split(' ').every((k) => k.includes('+')) ? 'o' : 'luego'));
}
