import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Contorno de círculo hecho a mano, ligeramente irregular, que empieza arriba y gira a la derecha. */
const HAND_CIRCLE = 'M50 9 C73 8 92 27 91 50 C90 74 72 92 50 91 C27 90 9 73 9 50 C9 28 27 10 50 9';

const ENSO_TONE = {
  shu: 'text-shu',
  moss: 'text-moss',
  ink: 'text-ink',
  honey: 'text-honey',
} as const;

/**
 * Enso: círculo zen trazado a pincel que se completa con el progreso (0–1).
 * Con progreso 0 queda un solo punto, como el del logo.
 */
@Component({
  selector: 'app-enso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative inline-grid shrink-0 place-items-center' },
  template: `
    <svg
      viewBox="0 0 100 100"
      [attr.width]="size()"
      [attr.height]="size()"
      fill="none"
      stroke-linecap="round"
      role="img"
      [attr.aria-label]="'Progreso ' + percent() + ' %'"
      style="transform: rotate(-6deg)"
    >
      <path [attr.d]="circle" stroke="currentColor" class="text-ink/15" stroke-width="1.6" stroke-dasharray="1.5 4.5" />
      <path
        [attr.d]="circle"
        stroke="currentColor"
        [class]="toneClass()"
        [attr.stroke-width]="weight()"
        pathLength="100"
        [attr.stroke-dasharray]="dash()"
        class="transition-[stroke-dasharray] duration-700"
      />
      <path
        [attr.d]="circle"
        stroke="currentColor"
        [class]="toneClass()"
        stroke-width="2"
        opacity="0.35"
        pathLength="100"
        [attr.stroke-dasharray]="dash()"
        transform="translate(50 50) scale(0.9) translate(-50 -50)"
      />
    </svg>
    @if (showLabel()) {
      <span class="absolute font-light tabular-nums" [style.font-size.px]="size() * 0.24">{{ percent() }}%</span>
    }
  `,
})
export class Enso {
  readonly value = input.required<number>();
  readonly size = input(56);
  readonly tone = input<keyof typeof ENSO_TONE>('shu');
  readonly showLabel = input(true);

  protected readonly circle = HAND_CIRCLE;
  protected readonly percent = computed(() => Math.round(Math.min(1, Math.max(0, this.value())) * 100));
  /** Trazo más grueso en tamaños pequeños para que siga leyéndose como pincel. */
  protected readonly weight = computed(() => (this.size() < 48 ? 9 : 7));
  protected readonly dash = computed(() => `${Math.max(0.01, this.percent() * 0.97)} 100`);
  protected readonly toneClass = computed(() => ENSO_TONE[this.tone()]);
}

const DOODLES: Record<string, { lines: string[]; dot: [number, number, number] }> = {
  circle: {
    lines: ['M58 20C38 19 24 33 25 50C26 67 44 76 62 73C80 70 92 56 89 40C87 29 78 22 66 21'],
    dot: [90, 18, 5],
  },
  mountain: {
    lines: [
      'M14 72C30 58 40 44 52 30C56 34 59 37 61 35C64 32 66 30 68 32C80 46 92 60 106 72',
      'M10 79C40 76 70 81 112 77',
    ],
    dot: [92, 20, 7],
  },
  paper: {
    lines: [
      'M34 16L84 14C86 34 86 56 84 76L36 78C34 58 33 36 34 16Z',
      'M44 32C55 31 64 33 74 31',
      'M44 44C52 43 62 45 72 43',
      'M44 56C50 55 56 57 62 55',
    ],
    dot: [85, 13, 5],
  },
};

/** Pequeños dibujos a mano alzada para estados vacíos. */
@Component({
  selector: 'app-doodle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <svg viewBox="0 0 120 90" [attr.width]="size()" [attr.height]="size() * 0.75" fill="none" aria-hidden="true">
      @for (d of art().lines; track $index) {
        <path [attr.d]="d" stroke="currentColor" class="text-ink/45" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      }
      <circle [attr.cx]="art().dot[0]" [attr.cy]="art().dot[1]" [attr.r]="art().dot[2]" class="fill-shu" />
    </svg>
  `,
})
export class Doodle {
  readonly name = input('circle');
  readonly size = input(96);
  protected readonly art = computed(() => DOODLES[this.name()] ?? DOODLES['circle']);
}
