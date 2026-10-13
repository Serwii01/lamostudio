import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TONE_BADGE, TONE_FILL, Tone } from '../../core/catalog';

@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      [class]="toneClass()"
    >
      @if (dot()) {
        <span class="size-1.5 rounded-full" [class]="dotClass()"></span>
      }
      <ng-content />
    </span>
  `,
})
export class Badge {
  readonly tone = input<Tone>('neutral');
  readonly dot = input(true);
  protected readonly toneClass = computed(() => TONE_BADGE[this.tone()]);
  protected readonly dotClass = computed(() => (this.tone() === 'ink' ? 'bg-paper' : TONE_FILL[this.tone()]));
}

@Component({
  selector: 'app-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="w-full overflow-hidden rounded-full bg-line-soft"
      [style.height.px]="height()"
      role="progressbar"
      [attr.aria-valuenow]="percent()"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="h-full rounded-full transition-[width] duration-500" [class]="fillClass()" [style.width.%]="percent()"></div>
    </div>
  `,
})
export class Progress {
  /** Valor entre 0 y 1 (se recorta si lo supera). */
  readonly value = input.required<number>();
  readonly tone = input<Tone>('ink');
  readonly height = input(6);
  protected readonly percent = computed(() => Math.round(Math.min(1, Math.max(0, this.value())) * 100));
  protected readonly fillClass = computed(() => TONE_FILL[this.tone()]);
}

@Component({
  selector: 'app-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-col items-center justify-center gap-1 px-6 py-10 text-center">
      <p class="font-medium text-ink">{{ title() }}</p>
      @if (hint()) {
        <p class="max-w-sm text-ink-soft">{{ hint() }}</p>
      }
      <div class="mt-3 empty:hidden"><ng-content /></div>
    </div>
  `,
})
export class Empty {
  readonly title = input.required<string>();
  readonly hint = input<string>();
}
