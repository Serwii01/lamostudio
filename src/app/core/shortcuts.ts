/**
 * Catálogo de atajos de teclado. Es la única fuente para la chuleta («?») y para las
 * pistas de la paleta de comandos; la lógica que los ejecuta está en
 * layout/keyboard-shortcuts.ts.
 *
 * Formato de las teclas: «Mod+K» es una combinación (Mod = Ctrl, o ⌘ en Mac) y
 * «G P» una secuencia (pulsa G y después P).
 */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function keyLabel(key: string): string {
  if (key === 'Mod') return IS_MAC ? '⌘' : 'Ctrl';
  if (key === 'Shift') return IS_MAC ? '⇧' : 'Shift';
  return key;
}

/** «Mod+K» → [['Ctrl','K']]; «G P» → [['G'],['P']]. */
export function parseKeys(keys: string): string[][] {
  if (keys.includes('…')) return [[keys]];
  return keys.split(' ').map((combo) => combo.split('+').map(keyLabel));
}

export interface ShortcutItem {
  keys: string;
  label: string;
}

export interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'General',
    items: [
      { keys: 'Mod+K', label: 'Paleta de comandos: haz cualquier cosa escribiendo' },
      { keys: '?', label: 'Ver esta lista de atajos' },
      { keys: '/', label: 'Buscar' },
      { keys: 'Mod+Z', label: 'Deshacer el último borrado o movimiento' },
      { keys: 'Esc', label: 'Cerrar el panel o diálogo abierto' },
    ],
  },
  {
    title: 'Crear',
    items: [
      { keys: 'T', label: 'Nueva tarea' },
      { keys: 'N', label: 'Nota rápida' },
      { keys: 'P', label: 'Nuevo proyecto' },
      { keys: 'U', label: 'Subir archivos' },
    ],
  },
  {
    title: 'Ir a',
    items: [
      { keys: 'G I', label: 'Inicio' },
      { keys: 'G T', label: 'Tareas' },
      { keys: 'G P', label: 'Proyectos' },
      { keys: 'G N', label: 'Notas' },
      { keys: 'G B', label: 'Biblioteca' },
      { keys: 'G E', label: 'Equipo' },
    ],
  },
  {
    title: 'Dentro de un proyecto',
    items: [
      { keys: '1 … 4', label: 'Cambiar de pestaña (Resumen, Tareas, Archivos, Notas)' },
      { keys: 'V', label: 'Alternar Lista y Tablero' },
    ],
  },
  {
    title: 'Listas y tablero',
    items: [
      { keys: 'J', label: 'Seleccionar la tarea siguiente' },
      { keys: 'K', label: 'Seleccionar la tarea anterior' },
      { keys: 'Enter', label: 'Abrir la tarea seleccionada' },
      { keys: 'X', label: 'Marcar como hecha o pendiente' },
      { keys: 'Shift+← Shift+→', label: 'Mover la tarjeta a la columna anterior o siguiente' },
      { keys: 'Supr', label: 'Eliminar (se puede deshacer)' },
    ],
  },
  {
    title: 'Con una tarea abierta',
    items: [
      { keys: '1 … 4', label: 'Por hacer · En curso · En revisión · Hecha' },
      { keys: 'B', label: 'Bloquear o desbloquear' },
      { keys: 'M', label: 'Asignármela' },
      { keys: 'J', label: 'Abrir la tarea siguiente' },
      { keys: 'K', label: 'Abrir la tarea anterior' },
      { keys: 'Mod+Enter', label: 'Enviar el comentario' },
      { keys: 'Supr', label: 'Eliminar (se puede deshacer)' },
    ],
  },
];

/** Gestos de arrastrar, para que la chuleta también los enseñe. */
export const DRAG_TIPS: string[] = [
  'Arrastra tareas entre columnas del tablero o entre grupos de la lista para cambiar su estado.',
  'Arrastra una tarea o una nota sobre un proyecto de la barra lateral para moverla allí.',
  'Suelta archivos de tu ordenador sobre una tarea para adjuntarlos al momento.',
  'Suelta archivos en Archivos, la Biblioteca o el panel de una tarea para subirlos.',
  'En Ajustes del proyecto, arrastra las pestañas para cambiar su orden.',
];
