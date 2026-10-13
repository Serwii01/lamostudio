import { Signal, computed, signal } from '@angular/core';
import { Id } from '../models';
import { ToastService, UNDO_WINDOW_MS } from './ui-state';

/**
 * Borrado con posibilidad de deshacer: el elemento se oculta al momento y solo se
 * borra de verdad cuando pasa el plazo sin que el usuario pulse «Deshacer».
 * Sustituye a los confirm() del navegador, que interrumpen y casi nadie lee.
 */
export class PendingDeletes<T extends { id: Id }> {
  private readonly pending = signal<ReadonlySet<Id>>(new Set());

  constructor(private readonly toast: ToastService) {}

  /** Lista sin los elementos pendientes de borrar. */
  filter(source: Signal<T[]>): Signal<T[]> {
    return computed(() => {
      const pending = this.pending();
      return pending.size ? source().filter((item) => !pending.has(item.id)) : source();
    });
  }

  remove(item: T, message: string, commit: () => void | Promise<void>): void {
    this.pending.update((set) => new Set(set).add(item.id));
    this.toast.show(message, { label: 'Deshacer', run: () => this.release(item.id) });
    setTimeout(() => {
      if (!this.pending().has(item.id)) return;
      void commit();
      this.release(item.id);
    }, UNDO_WINDOW_MS);
  }

  private release(id: Id): void {
    this.pending.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }
}
