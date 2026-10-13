import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Member } from '../../core/models';
import { initials } from '../../core/utils/text';

@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    @if (member(); as m) {
      <span
        class="inline-flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface select-none"
        [style.background]="m.color"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="size() * 0.38"
        [attr.title]="m.name"
        >{{ letters() }}</span
      >
    } @else {
      <span
        class="inline-flex items-center justify-center rounded-full border border-dashed border-ink-faint bg-surface text-ink-faint"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="size() * 0.45"
        title="Sin responsable"
        >?</span
      >
    }
  `,
})
export class Avatar {
  readonly member = input<Member | undefined>();
  readonly size = input(24);
  protected readonly letters = computed(() => initials(this.member()?.name ?? ''));
}

@Component({
  selector: 'app-avatar-stack',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar],
  host: { class: 'inline-flex items-center' },
  template: `
    @for (m of shown(); track m.id) {
      <app-avatar [member]="m" [size]="size()" class="-ml-1 first:ml-0" />
    }
    @if (extra() > 0) {
      <span
        class="-ml-1 inline-flex items-center justify-center rounded-full bg-ink/5 text-[10px] font-semibold text-ink-soft ring-2 ring-surface"
        [style.width.px]="size()"
        [style.height.px]="size()"
        >+{{ extra() }}</span
      >
    }
  `,
})
export class AvatarStack {
  readonly members = input.required<Member[]>();
  readonly max = input(4);
  readonly size = input(24);
  protected readonly shown = computed(() => this.members().slice(0, this.max()));
  protected readonly extra = computed(() => this.members().length - this.shown().length);
}
