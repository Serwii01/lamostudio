import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Marca de Lamo: dos lazos apilados con un punto, redibujada en SVG a partir del
 * logo original para que se vea nítida a cualquier tamaño. Usa currentColor.
 */
@Component({
  selector: 'app-logo-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <svg viewBox="146 62 160 282" [attr.height]="size()" [attr.width]="(size() * 160) / 282" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="253" cy="82" r="15" fill="currentColor" stroke="none" />
      <circle cx="208" cy="160" r="45.5" stroke-width="25.5" />
      <path d="M208 114 H272 A19 19 0 0 1 291 133 A19 19 0 0 1 272 152 C263 152 252 146 244 140" stroke-width="25" stroke-linecap="round" />
      <circle cx="210.5" cy="280" r="46" stroke-width="27" />
    </svg>
  `,
})
export class LogoMark {
  readonly size = input(32);
}
