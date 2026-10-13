import {
  ActivityVerb,
  MemberRole,
  Priority,
  ProjectModuleId,
  ProjectStatus,
  ProjectType,
  LocationCategory,
  LocationStatus,
  TaskStatus,
} from './models';

// ---------------------------------------------------------------------------
// Tonos visuales
// ---------------------------------------------------------------------------

export type Tone = 'neutral' | 'ocean' | 'coral' | 'honey' | 'moss' | 'plum' | 'ink';

export const TONE_BADGE: Record<Tone, string> = {
  neutral: 'bg-ink/5 text-ink-soft',
  ocean: 'bg-ocean-soft text-ocean',
  coral: 'bg-coral-soft text-coral',
  honey: 'bg-honey-soft text-honey',
  moss: 'bg-moss-soft text-moss',
  plum: 'bg-plum-soft text-plum',
  ink: 'bg-ink text-paper',
};

export const TONE_FILL: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  ocean: 'bg-ocean',
  coral: 'bg-coral',
  honey: 'bg-honey',
  moss: 'bg-moss',
  plum: 'bg-plum',
  ink: 'bg-ink',
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink-faint',
  ocean: 'text-ocean',
  coral: 'text-coral',
  honey: 'text-honey',
  moss: 'text-moss',
  plum: 'text-plum',
  ink: 'text-ink',
};

interface Labeled {
  label: string;
  tone: Tone;
}

// ---------------------------------------------------------------------------
// Estados y prioridades
// ---------------------------------------------------------------------------

export const PROJECT_STATUS: Record<ProjectStatus, Labeled> = {
  draft: { label: 'Borrador', tone: 'neutral' },
  planning: { label: 'Planificación', tone: 'ocean' },
  production: { label: 'En producción', tone: 'plum' },
  review: { label: 'En revisión', tone: 'honey' },
  'client-pending': { label: 'Pendiente de cliente', tone: 'honey' },
  changes: { label: 'Cambios solicitados', tone: 'coral' },
  approved: { label: 'Aprobado', tone: 'moss' },
  closed: { label: 'Cerrado', tone: 'neutral' },
  archived: { label: 'Archivado', tone: 'neutral' },
};
export const PROJECT_STATUS_ORDER = Object.keys(PROJECT_STATUS) as ProjectStatus[];
export const INACTIVE_PROJECT_STATUSES: ProjectStatus[] = ['draft', 'closed', 'archived'];

export const TASK_STATUS: Record<TaskStatus, Labeled> = {
  todo: { label: 'Por hacer', tone: 'neutral' },
  'in-progress': { label: 'En curso', tone: 'ocean' },
  review: { label: 'En revisión', tone: 'honey' },
  done: { label: 'Hecha', tone: 'moss' },
};
export const TASK_STATUS_ORDER = Object.keys(TASK_STATUS) as TaskStatus[];
export const isTaskDone = (status: TaskStatus) => status === 'done';

export const PRIORITY: Record<Priority, Labeled & { rank: number }> = {
  low: { label: 'Baja', tone: 'neutral', rank: 0 },
  medium: { label: 'Media', tone: 'ocean', rank: 1 },
  high: { label: 'Alta', tone: 'honey', rank: 2 },
  urgent: { label: 'Urgente', tone: 'coral', rank: 3 },
};
export const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low'];

// ---------------------------------------------------------------------------
// Roles y permisos
// ---------------------------------------------------------------------------

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Propietaria/o',
  admin: 'Administración',
  pm: 'Producción / PM',
  'creative-director': 'Dirección creativa',
  collaborator: 'Colaborador/a',
  client: 'Cliente',
  guest: 'Invitado/a',
};

export type Permission =
  | 'project.create'
  | 'project.manage'
  | 'project.viewAll'
  | 'task.edit'
  | 'task.comment'
  | 'note.create'
  | 'team.viewLoad';

const MANAGER: Permission[] = ['project.create', 'project.manage', 'task.edit', 'task.comment', 'note.create', 'team.viewLoad'];

/**
 * Permisos simples de la Fase 1. La UI los usa para ocultar acciones; cuando exista
 * backend, las mismas reglas deben validarse en la capa de datos (reglas de Firestore).
 */
export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  owner: [...MANAGER, 'project.viewAll'],
  admin: [...MANAGER, 'project.viewAll'],
  pm: MANAGER,
  'creative-director': MANAGER,
  collaborator: ['task.edit', 'task.comment', 'note.create', 'team.viewLoad'],
  client: ['task.comment', 'note.create'],
  guest: [],
};

// ---------------------------------------------------------------------------
// Módulos y plantillas
// ---------------------------------------------------------------------------

export interface ModuleDef {
  id: ProjectModuleId;
  label: string;
  /** Segmento de ruta dentro de /proyectos/:id */
  path: string;
  icon: string;
  built: boolean;
  phase: string;
  description: string;
  planned: string[];
}

export const MODULES: ModuleDef[] = [
  {
    id: 'overview',
    label: 'Resumen',
    path: 'resumen',
    icon: 'grid',
    built: true,
    phase: 'Fase 1',
    description: 'Qué se hace, en qué punto está, qué está bloqueado y qué viene después.',
    planned: [],
  },
  {
    id: 'tasks',
    label: 'Tareas',
    path: 'tareas',
    icon: 'list',
    built: true,
    phase: 'Fase 1',
    description: 'Tareas con responsables, estados, prioridades, subtareas y comentarios.',
    planned: [],
  },
  {
    id: 'kanban',
    label: 'Tablero',
    path: 'tablero',
    icon: 'kanban',
    built: true,
    phase: 'Fase 1',
    description: 'Columnas por estado: arrastra tarjetas para cambiar su estado y orden.',
    planned: [],
  },
  {
    id: 'notes',
    label: 'Notas',
    path: 'notas',
    icon: 'note',
    built: true,
    phase: 'Fase 1',
    description: 'Ideas, actas y apuntes rápidos que se pueden convertir en tareas.',
    planned: [],
  },
  {
    id: 'calendar',
    label: 'Calendario',
    path: 'calendario',
    icon: 'calendar',
    built: false,
    phase: 'Fase 2',
    description: 'Un único calendario con tareas, hitos, reuniones, rodajes y publicaciones.',
    planned: [
      'Vistas de día, semana, mes y agenda',
      'Fechas de tareas sin duplicar datos',
      'Eventos vinculados a localizaciones y entregables',
      'Exportación iCalendar de solo lectura',
    ],
  },
  {
    id: 'whiteboard',
    label: 'Pizarra',
    path: 'pizarra',
    icon: 'pen',
    built: false,
    phase: 'Fase 2',
    description: 'Lienzo visual para moodboards, storyboards y lluvias de ideas.',
    planned: [
      'Notas adhesivas, formas, flechas y dibujo libre',
      'Imágenes, enlaces y PDFs con previsualización',
      'Tarjetas enlazadas a tareas y entregables',
      'Edición simultánea con Yjs (Fase 3)',
    ],
  },
  {
    id: 'map',
    label: 'Mapa',
    path: 'mapa',
    icon: 'pin',
    built: true,
    phase: 'Fase 2',
    description: 'Localizaciones de rodaje, eventos, proveedores y scouting.',
    planned: [
      'Pines sobre OpenStreetMap + Leaflet',
      'Fichas con fotos, permisos, contactos y horarios',
      'Vista de lista además del mapa',
      'Programar visitas en el calendario',
    ],
  },
  {
    id: 'files',
    label: 'Archivos',
    path: 'archivos',
    icon: 'paperclip',
    built: true,
    phase: 'Fase 2',
    description: 'Documentos, previews y enlaces a Drive, Dropbox o Frame.io.',
    planned: [
      'Imágenes, PDFs y documentos ligeros',
      'Enlaces externos para brutos pesados',
      'Miniaturas, etiquetas y versiones básicas',
    ],
  },
  {
    id: 'deliverables',
    label: 'Entregables',
    path: 'entregables',
    icon: 'package',
    built: false,
    phase: 'Fase 2',
    description: 'Versiones, revisores y decisión de aprobación de cada entrega.',
    planned: [
      'Versiones subidas o enlazadas',
      'Solicitud de aprobación al cliente',
      'Enlace de revisión con caducidad',
    ],
  },
  {
    id: 'time',
    label: 'Tiempo',
    path: 'tiempo',
    icon: 'clock',
    built: false,
    phase: 'Fase 3',
    description: 'Horas estimadas frente a registradas y capacidad del equipo.',
    planned: ['Parte de horas por tarea', 'Vista semanal de capacidad', 'Detección de sobrecarga'],
  },
  {
    id: 'budget',
    label: 'Presupuesto',
    path: 'presupuesto',
    icon: 'wallet',
    built: false,
    phase: 'Fase 3',
    description: 'Partidas, proveedores y desviaciones, con visibilidad por rol.',
    planned: ['Coste estimado, aprobado y real', 'Proveedores y contactos', 'Alertas de desviación'],
  },
  {
    id: 'shot-list',
    label: 'Shot list',
    path: 'shot-list',
    icon: 'film',
    built: false,
    phase: 'Fase 3',
    description: 'Escenas, planos y call sheets para producciones audiovisuales.',
    planned: ['Escena, plano, cámara, lente y movimiento', 'Relación con storyboard y localización', 'Call sheet por jornada'],
  },
];

export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m])) as Record<
  ProjectModuleId,
  ModuleDef
>;

export interface ProjectTemplate {
  type: ProjectType;
  name: string;
  description: string;
  icon: string;
  cover: string;
  modules: ProjectModuleId[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    type: 'branding',
    name: 'Branding / identidad',
    description: 'Moodboard, rutas creativas, revisiones y manual de marca.',
    icon: 'pen',
    cover: '#8a6aa3',
    modules: ['overview', 'tasks', 'kanban', 'whiteboard', 'files', 'deliverables', 'notes'],
  },
  {
    type: 'video',
    name: 'Vídeo / videoclip',
    description: 'Preproducción, localizaciones, rodaje, shot list y postproducción.',
    icon: 'film',
    cover: '#ff3131',
    modules: ['overview', 'tasks', 'kanban', 'calendar', 'map', 'shot-list', 'deliverables', 'notes'],
  },
  {
    type: 'campaign',
    name: 'Campaña social',
    description: 'Calendario editorial, piezas, copys y aprobaciones.',
    icon: 'calendar',
    cover: '#2d4c7c',
    modules: ['overview', 'tasks', 'calendar', 'notes', 'files', 'deliverables'],
  },
  {
    type: 'web',
    name: 'Web / producto digital',
    description: 'Backlog, tablero, documentación e hitos.',
    icon: 'kanban',
    cover: '#1e1d1b',
    modules: ['overview', 'tasks', 'kanban', 'notes', 'files'],
  },
  {
    type: 'event',
    name: 'Evento cultural',
    description: 'Calendario, mapa, equipo, proveedores y presupuesto.',
    icon: 'pin',
    cover: '#6b8a4e',
    modules: ['overview', 'tasks', 'calendar', 'map', 'budget', 'files', 'notes'],
  },
  {
    type: 'custom',
    name: 'Proyecto libre',
    description: 'Empieza con lo básico y activa los módulos que necesites.',
    icon: 'plus',
    cover: '#b9860f',
    modules: ['overview', 'tasks', 'notes'],
  },
];

export const PROJECT_TYPE_LABEL = Object.fromEntries(
  PROJECT_TEMPLATES.map((t) => [t.type, t.name]),
) as Record<ProjectType, string>;

/** Portadas: shu (rojo del logo), kincha, matcha, ai, fuji y sumi. */
export const COVER_SWATCHES = ['#ff3131', '#b9860f', '#6b8a4e', '#2d4c7c', '#8a6aa3', '#1e1d1b'];

// ---------------------------------------------------------------------------
// Actividad
// ---------------------------------------------------------------------------

export const ACTIVITY_PHRASE: Record<ActivityVerb, (detail?: string) => string> = {
  'project.created': () => 'creó el proyecto',
  'project.updated': () => 'actualizó el proyecto',
  'project.status': (d) => `cambió a «${d}» el proyecto`,
  'project.modules': () => 'reorganizó los módulos de',
  'task.created': () => 'creó la tarea',
  'task.updated': () => 'editó la tarea',
  'task.status': (d) => `movió a «${d}» la tarea`,
  'task.assigned': (d) => `asignó a ${d} la tarea`,
  'task.commented': () => 'comentó en',
  'task.deleted': () => 'eliminó la tarea',
  'task.blocked': (d) => `marcó como ${d} la tarea`,
  'note.created': () => 'añadió la nota',
  'note.converted': () => 'convirtió una nota en la tarea',
  'file.uploaded': () => 'subió',
  'file.linked': () => 'enlazó',
  'file.deleted': () => 'eliminó el archivo',
  'task.moved': (d) => `llevó al proyecto «${d}» la tarea`,
  'location.created': () => 'añadió al mapa',
  'location.status': (d) => `marcó como «${d}» la localización`,
};

// ---------------------------------------------------------------------------
// Localizaciones (módulo Mapa)
// ---------------------------------------------------------------------------

/** Tipo de localización: etiqueta, icono y color del pin (tokens de la paleta). */
export const LOCATION_CATEGORY: Record<LocationCategory, { label: string; icon: string; color: string }> = {
  shoot: { label: 'Rodaje', icon: 'film', color: '#ff3131' },
  meeting: { label: 'Reunión', icon: 'users', color: '#2d4c7c' },
  event: { label: 'Evento', icon: 'sparkle', color: '#694b81' },
  supplier: { label: 'Proveedor', icon: 'package', color: '#8d5d00' },
  accommodation: { label: 'Alojamiento', icon: 'home', color: '#4c6a37' },
  parking: { label: 'Parking', icon: 'flag', color: '#57544e' },
  other: { label: 'Otro', icon: 'pin', color: '#1e1d1b' },
};
export const LOCATION_CATEGORY_ORDER = Object.keys(LOCATION_CATEGORY) as LocationCategory[];

export const LOCATION_STATUS: Record<LocationStatus, Labeled> = {
  candidate: { label: 'Candidata', tone: 'ocean' },
  permission_pending: { label: 'Falta permiso', tone: 'honey' },
  confirmed: { label: 'Confirmada', tone: 'moss' },
  discarded: { label: 'Descartada', tone: 'neutral' },
};
export const LOCATION_STATUS_ORDER = Object.keys(LOCATION_STATUS) as LocationStatus[];
