import { Directive, computed, inject, input, signal } from '@angular/core';
import { Task } from '../core/models';
import { FileService } from '../core/services/files';
import { ToastService } from '../core/services/ui-state';

/**
 * Soltar archivos del ordenador sobre una tarea (fila de lista o tarjeta del tablero)
 * los adjunta a esa tarea. Solo reacciona a archivos del sistema: arrastrar tarjetas
 * dentro de la app usa el CDK y no pasa por aquí.
 */
@Directive({
  selector: '[appTaskFileDrop]',
  host: {
    '(dragenter)': 'onEnter($event)',
    '(dragover)': 'onOver($event)',
    '(dragleave)': 'onLeave($event)',
    '(drop)': 'onDrop($event)',
    '[class.ring-2]': 'over()',
    '[class.ring-shu]': 'over()',
    '[class.ring-inset]': 'over()',
    '[class.bg-shu/5]': 'over()',
    '[attr.data-file-drop]': 'over() ? "Suelta para adjuntar" : null',
  },
})
export class TaskFileDrop {
  readonly task = input.required<Task>({ alias: 'appTaskFileDrop' });

  private readonly files = inject(FileService);
  private readonly toast = inject(ToastService);
  protected readonly over = signal(false);
  private readonly enabled = computed(() => this.files.canEdit());
  private depth = 0;

  protected onEnter(event: DragEvent): void {
    if (!this.accepts(event)) return;
    event.preventDefault();
    this.depth += 1;
    this.over.set(true);
  }

  protected onOver(event: DragEvent): void {
    if (!this.accepts(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  protected onLeave(event: DragEvent): void {
    if (!this.accepts(event)) return;
    this.depth = Math.max(0, this.depth - 1);
    if (!this.depth) this.over.set(false);
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    if (!this.accepts(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.depth = 0;
    this.over.set(false);
    const task = this.task();
    const result = await this.files.upload([...(event.dataTransfer?.files ?? [])], { projectId: task.projectId, taskId: task.id });
    for (const error of result.errors) this.toast.error(error);
    const n = result.uploaded.length;
    if (n) this.toast.show(`${n === 1 ? '1 archivo adjuntado' : `${n} archivos adjuntados`} a «${task.title.slice(0, 32)}»`);
  }

  private accepts(event: DragEvent): boolean {
    return this.enabled() && !!event.dataTransfer?.types.includes('Files');
  }
}
