import {
  ActivityEntry,
  FileAsset,
  ProjectLocation,
  Id,
  Member,
  Priority,
  Project,
  QuickNote,
  Task,
  TaskStatus,
} from '../../models';
import { isoDaysFromNow as day, isoHoursAgo as hoursAgo } from '../../utils/dates';
import type { DbState } from './mock-db';

/**
 * Datos de demostración. Las fechas se calculan respecto a hoy para que siempre haya
 * entregas próximas, tareas vencidas y algo de sobrecarga que enseñar.
 */
export function createSeed(): DbState {
  const ws = 'ws_lamo';

  const members: Member[] = [
    { id: 'u_lucia', name: 'Lucía Romero', role: 'owner', specialty: 'Dirección del estudio', color: '#c8473b', weeklyCapacity: 30 },
    { id: 'u_marcos', name: 'Marcos Vidal', role: 'pm', specialty: 'Producción', color: '#2d4c7c', weeklyCapacity: 35 },
    { id: 'u_irene', name: 'Irene Castro', role: 'collaborator', specialty: 'Diseño gráfico', color: '#694b81', weeklyCapacity: 32 },
    { id: 'u_diego', name: 'Diego Navarro', role: 'collaborator', specialty: 'Edición y color', color: '#4c6a37', weeklyCapacity: 20 },
    { id: 'u_paula', name: 'Paula Ortega', role: 'creative-director', specialty: 'Dirección creativa y foto', color: '#8d5d00', weeklyCapacity: 25 },
    { id: 'u_andres', name: 'Andrés Molina', role: 'client', specialty: 'Sonora Records', color: '#57544e', weeklyCapacity: 0 },
  ];

  const project = (p: Omit<Project, 'workspaceId' | 'createdAt' | 'updatedAt' | 'priority' | 'tags'> & Partial<Project>): Project => ({
    workspaceId: ws,
    priority: 'medium',
    tags: [],
    createdAt: p.startAt ?? day(-30),
    updatedAt: day(-1),
    ...p,
  });

  const projects: Project[] = [
    project({
      id: 'p_mareas',
      name: 'Videoclip «Mareas»',
      description:
        'Videoclip para el single de Nerea Sol. Dos jornadas de rodaje en Sevilla (Triana y Plaza de España) y postproducción completa.',
      client: 'Sonora Records',
      type: 'video',
      status: 'production',
      priority: 'high',
      tags: ['audiovisual', 'música'],
      cover: '#ff3131',
      moduleIds: ['overview', 'tasks', 'kanban', 'calendar', 'map', 'shot-list', 'deliverables', 'notes'],
      memberIds: ['u_lucia', 'u_marcos', 'u_paula', 'u_diego', 'u_irene', 'u_andres'],
      ownerId: 'u_marcos',
      startAt: day(-21),
      dueAt: day(24),
    }),
    project({
      id: 'p_alameda',
      name: 'Identidad visual Café Alameda',
      description: 'Rediseño de marca para una tostadora de especialidad: logotipo, sistema tipográfico, color y packaging.',
      client: 'Café Alameda',
      type: 'branding',
      status: 'review',
      priority: 'high',
      tags: ['branding', 'packaging'],
      cover: '#b9860f',
      moduleIds: ['overview', 'tasks', 'kanban', 'whiteboard', 'files', 'deliverables', 'notes'],
      memberIds: ['u_lucia', 'u_irene', 'u_paula'],
      ownerId: 'u_lucia',
      startAt: day(-35),
      dueAt: day(7),
    }),
    project({
      id: 'p_atlas',
      name: 'Campaña otoño — Librería Atlas',
      description: 'Campaña de redes para la temporada de otoño: novedades, encuentros con autores y club de lectura.',
      client: 'Librería Atlas',
      type: 'campaign',
      status: 'planning',
      tags: ['social', 'editorial'],
      cover: '#2d4c7c',
      moduleIds: ['overview', 'tasks', 'kanban', 'calendar', 'notes', 'files', 'deliverables'],
      memberIds: ['u_lucia', 'u_marcos', 'u_paula', 'u_irene'],
      ownerId: 'u_marcos',
      startAt: day(-5),
      dueAt: day(40),
    }),
    project({
      id: 'p_luz',
      name: 'Festival Luz de Barrio',
      description: 'Ruta de instalaciones lumínicas por el barrio con la asociación vecinal. Tres noches, doce puntos de luz.',
      client: 'Asociación vecinal San Bernardo',
      type: 'event',
      status: 'planning',
      tags: ['evento', 'cultura'],
      cover: '#6b8a4e',
      moduleIds: ['overview', 'tasks', 'kanban', 'calendar', 'map', 'budget', 'files', 'notes'],
      memberIds: ['u_lucia', 'u_marcos', 'u_paula', 'u_irene'],
      ownerId: 'u_marcos',
      startAt: day(-12),
      dueAt: day(55),
    }),
    project({
      id: 'p_web',
      name: 'Web portfolio Lamo',
      description: 'Nueva web del estudio con casos destacados, vídeos de portada y sección de equipo.',
      type: 'web',
      status: 'changes',
      tags: ['interno', 'web'],
      cover: '#1e1d1b',
      moduleIds: ['overview', 'tasks', 'kanban', 'notes', 'files'],
      memberIds: ['u_lucia', 'u_irene', 'u_diego', 'u_marcos'],
      ownerId: 'u_lucia',
      startAt: day(-28),
      dueAt: day(4),
    }),
    project({
      id: 'p_verano',
      name: 'Catálogo de verano — Atlas',
      description: 'Catálogo impreso y digital de lecturas de verano.',
      client: 'Librería Atlas',
      type: 'campaign',
      status: 'closed',
      tags: ['editorial'],
      cover: '#2d4c7c',
      moduleIds: ['overview', 'tasks', 'notes'],
      memberIds: ['u_lucia', 'u_irene'],
      ownerId: 'u_lucia',
      startAt: day(-120),
      dueAt: day(-60),
    }),
  ];

  let sequence = 0;
  const task = (
    projectId: Id,
    title: string,
    status: TaskStatus,
    priority: Priority,
    assigneeId: Id | null,
    due: number | null,
    tags: string[],
    extra: Partial<Task> = {},
  ): Task => {
    sequence += 1;
    return {
      id: `tsk_${sequence}`,
      projectId,
      title,
      status,
      priority,
      assigneeId: assigneeId ?? undefined,
      tags,
      dueAt: due === null ? undefined : day(due),
      estimateHours: 4,
      subtasks: [],
      comments: [],
      order: sequence,
      createdAt: day(-20),
      updatedAt: day(-1),
      ...extra,
    };
  };

  const tasks: Task[] = [
    // Videoclip «Mareas»
    task('p_mareas', 'Cerrar guion técnico', 'done', 'high', 'u_paula', -10, ['preproducción']),
    task('p_mareas', 'Casting de figuración', 'done', 'medium', 'u_marcos', -6, ['preproducción']),
    task('p_mareas', 'Solicitar permiso de rodaje en Plaza de España', 'in-progress', 'urgent', 'u_marcos', 2, ['permisos'], {
      blocked: true,
      blockedReason: 'Esperando respuesta de la oficina de permisos',
      locationId: 'loc_plaza',
      description: 'Pendiente de respuesta de la oficina de permisos del Ayuntamiento. Revisar restricciones de trípode y acceso de vehículo.',
      estimateHours: 3,
      comments: [
        { id: 'c1', authorId: 'u_marcos', body: 'He llamado dos veces; dicen que responden antes del jueves.', createdAt: hoursAgo(20) },
        { id: 'c2', authorId: 'u_lucia', body: 'Si el jueves no hay respuesta, activamos la alternativa del Parque de María Luisa.', createdAt: hoursAgo(6) },
      ],
    }),
    task('p_mareas', 'Scouting de localizaciones en Triana', 'in-progress', 'high', 'u_paula', 1, ['localizaciones'], {
      locationId: 'loc_puente',
      estimateHours: 6,
      subtasks: [
        { id: 's1', title: 'Calle Betis al amanecer', done: true },
        { id: 's2', title: 'Puente de Isabel II', done: true },
        { id: 's3', title: 'Interior del mercado', done: false },
      ],
    }),
    task('p_mareas', 'Plan de rodaje — día 1', 'in-progress', 'high', 'u_marcos', 4, ['rodaje'], { estimateHours: 5 }),
    task('p_mareas', 'Alquiler de óptica y estabilizador', 'todo', 'medium', 'u_marcos', 5, ['material']),
    task('p_mareas', 'Storyboard escenas 3–6', 'review', 'medium', 'u_irene', 0, ['storyboard'], { estimateHours: 6 }),
    task('p_mareas', 'Montaje primera versión', 'todo', 'high', 'u_diego', 18, ['postproducción'], { estimateHours: 16 }),
    task('p_mareas', 'Etalonaje', 'todo', 'medium', 'u_diego', 22, ['postproducción'], { estimateHours: 10 }),

    // Café Alameda
    task('p_alameda', 'Moodboard y referencias', 'done', 'medium', 'u_irene', -14, ['investigación']),
    task('p_alameda', 'Propuestas de logotipo (3 rutas)', 'done', 'high', 'u_irene', -5, ['logotipo'], { estimateHours: 12 }),
    task('p_alameda', 'Sistema tipográfico', 'review', 'high', 'u_irene', 1, ['tipografía'], { estimateHours: 8 }),
    task('p_alameda', 'Paleta de color y accesibilidad', 'in-progress', 'medium', 'u_irene', 2, ['color'], { estimateHours: 6 }),
    task('p_alameda', 'Aplicaciones: packaging de café', 'in-progress', 'high', 'u_irene', 3, ['packaging'], {
      estimateHours: 10,
      comments: [
        { id: 'c3', authorId: 'u_lucia', body: 'El cliente pide más calidez: tostados y crema en lugar del gris.', createdAt: hoursAgo(28) },
      ],
    }),
    task('p_alameda', 'Manual de marca (PDF)', 'todo', 'medium', 'u_lucia', 6, ['entregable'], { estimateHours: 12 }),
    task('p_alameda', 'Presentación final al cliente', 'todo', 'urgent', 'u_lucia', 7, ['reunión'], { estimateHours: 3 }),

    // Librería Atlas
    task('p_atlas', 'Briefing con la librería', 'done', 'medium', 'u_lucia', -3, ['reunión']),
    task('p_atlas', 'Calendario editorial octubre–noviembre', 'in-progress', 'high', 'u_marcos', 3, ['planificación']),
    task('p_atlas', 'Sesión de fotos de novedades', 'todo', 'medium', 'u_paula', 9, ['foto'], { estimateHours: 6 }),
    task('p_atlas', 'Copys para Instagram (12 piezas)', 'todo', 'medium', null, 12, ['copy']),
    task('p_atlas', 'Plantillas de stories', 'todo', 'low', 'u_irene', 15, ['diseño']),

    // Festival Luz de Barrio
    task('p_luz', 'Reunión con la asociación vecinal', 'done', 'medium', 'u_marcos', -8, ['reunión']),
    task('p_luz', 'Presupuesto de iluminación', 'review', 'high', 'u_marcos', 4, ['presupuesto']),
    task('p_luz', 'Mapa de recorrido y puntos de luz', 'in-progress', 'medium', 'u_paula', 10, ['localizaciones']),
    task('p_luz', 'Contratar seguro de responsabilidad civil', 'todo', 'urgent', null, 6, ['permisos'], { estimateHours: 2 }),
    task('p_luz', 'Cartelería y señalética', 'todo', 'medium', 'u_irene', 25, ['diseño'], { estimateHours: 10 }),
    task('p_luz', 'Coordinar voluntariado', 'todo', 'low', null, 30, ['equipo']),

    // Web portfolio
    task('p_web', 'Seleccionar proyectos destacados', 'done', 'medium', 'u_lucia', -12, ['contenido']),
    task('p_web', 'Maquetación de la home', 'in-progress', 'high', 'u_irene', -2, ['diseño'], { estimateHours: 12 }),
    task('p_web', 'Textos de la sección Estudio', 'todo', 'medium', 'u_lucia', -1, ['contenido'], {
      blocked: true,
      blockedReason: 'Faltan las fotos del equipo',
      description: 'Esperando las fotos del equipo para cerrar los textos.',
    }),
    task('p_web', 'Optimizar vídeos de portada', 'todo', 'medium', 'u_diego', 3, ['vídeo'], { estimateHours: 5 }),
    task('p_web', 'Publicar en Vercel', 'todo', 'low', 'u_marcos', 8, ['despliegue'], { estimateHours: 2 }),

    // Catálogo de verano (cerrado)
    task('p_verano', 'Maquetación del catálogo', 'done', 'high', 'u_irene', -70, ['editorial']),
    task('p_verano', 'Envío a imprenta', 'done', 'medium', 'u_lucia', -62, ['producción']),
  ];

  const notes: QuickNote[] = [
    {
      id: 'note_1', workspaceId: ws, projectId: 'p_mareas', authorId: 'u_paula', visibility: 'project', pinned: true,
      title: 'Ideas para la escena del puente',
      content: 'Probar contraluz al atardecer desde el lado de Triana.\nNecesitamos reflector grande y permiso para dron.',
      createdAt: hoursAgo(30), updatedAt: hoursAgo(30),
    },
    {
      id: 'note_2', workspaceId: ws, projectId: 'p_alameda', authorId: 'u_lucia', visibility: 'project', pinned: false,
      title: 'Feedback de la reunión',
      content: 'Les gusta la ruta B, pero piden más calidez en el color. Revisar tostados y crema. Quieren ver el packaging en mockup real.',
      createdAt: hoursAgo(27), updatedAt: hoursAgo(27),
    },
    {
      id: 'note_3', workspaceId: ws, authorId: 'u_lucia', visibility: 'private', pinned: false,
      title: 'Pendientes de la semana',
      content: 'Revisar facturas de septiembre.\nLlamar a la imprenta por los carteles del festival.',
      createdAt: hoursAgo(50), updatedAt: hoursAgo(50),
    },
    {
      id: 'note_4', workspaceId: ws, projectId: 'p_luz', authorId: 'u_marcos', visibility: 'project', pinned: false,
      title: 'Proveedores de iluminación',
      content: 'Lumen Sur: presupuesto antes del viernes. Alternativa: alquiler en Madrid con transporte incluido.',
      createdAt: hoursAgo(70), updatedAt: hoursAgo(70),
    },
    {
      id: 'note_5', workspaceId: ws, authorId: 'u_irene', visibility: 'workspace', pinned: false,
      title: 'Referencia tipográfica',
      content: 'La tipografía de la última campaña de la Bienal es una buena referencia para Atlas.',
      createdAt: hoursAgo(96), updatedAt: hoursAgo(96),
    },
  ];

  const entry = (
    hours: number,
    actorId: Id,
    verb: ActivityEntry['verb'],
    projectId: Id,
    targetId: Id,
    targetLabel: string,
    detail?: string,
  ): ActivityEntry => ({
    id: `act_seed_${hours}_${targetId}`,
    workspaceId: ws,
    projectId,
    actorId,
    verb,
    targetId,
    targetLabel,
    detail,
    createdAt: hoursAgo(hours),
  });

  const activity: ActivityEntry[] = [
    entry(1, 'u_irene', 'task.status', 'p_mareas', 'tsk_7', 'Storyboard escenas 3–6', 'En revisión'),
    entry(6, 'u_lucia', 'task.commented', 'p_mareas', 'tsk_3', 'Solicitar permiso de rodaje en Plaza de España'),
    entry(9, 'u_irene', 'task.status', 'p_alameda', 'tsk_12', 'Sistema tipográfico', 'En revisión'),
    entry(20, 'u_marcos', 'task.blocked', 'p_mareas', 'tsk_3', 'Solicitar permiso de rodaje en Plaza de España', 'bloqueada'),
    entry(26, 'u_lucia', 'project.status', 'p_web', 'p_web', 'Web portfolio Lamo', 'Cambios solicitados'),
    entry(28, 'u_lucia', 'task.commented', 'p_alameda', 'tsk_14', 'Aplicaciones: packaging de café'),
    entry(30, 'u_paula', 'note.created', 'p_mareas', 'note_1', 'Ideas para la escena del puente'),
    entry(48, 'u_marcos', 'task.created', 'p_atlas', 'tsk_19', 'Sesión de fotos de novedades'),
    entry(72, 'u_lucia', 'task.status', 'p_alameda', 'tsk_11', 'Propuestas de logotipo (3 rutas)', 'Hecha'),
    entry(4, 'u_paula', 'file.linked', 'p_mareas', 'file_2', 'Fotos de scouting — Triana'),
    entry(120, 'u_marcos', 'project.created', 'p_atlas', 'p_atlas', 'Campaña otoño — Librería Atlas'),
  ];

  const link = (
    id: Id,
    projectId: Id,
    name: string,
    url: string,
    provider: string,
    uploadedBy: Id,
    hours: number,
    taskId?: Id,
  ): FileAsset => ({
    id, workspaceId: ws, projectId, taskId, name, kind: 'link', url, provider, uploadedBy, createdAt: hoursAgo(hours),
  });

  // Enlaces de ejemplo (direcciones ficticias): los brutos pesados viven fuera de la app.
  const files: FileAsset[] = [
    link('file_1', 'p_mareas', 'Maqueta del single «Mareas»', 'https://drive.google.com/file/d/ejemplo-maqueta', 'Google Drive', 'u_marcos', 60),
    link('file_2', 'p_mareas', 'Fotos de scouting — Triana', 'https://www.dropbox.com/sh/ejemplo-scouting', 'Dropbox', 'u_paula', 4, 'tsk_4'),
    link('file_3', 'p_mareas', 'Referencia de ritmo de montaje', 'https://vimeo.com/000000000', 'Vimeo', 'u_diego', 90),
    link('file_4', 'p_alameda', 'Revisión packaging v2', 'https://app.frame.io/reviews/ejemplo-packaging', 'Frame.io', 'u_irene', 26, 'tsk_14'),
    link('file_5', 'p_alameda', 'Sistema de marca (Figma)', 'https://www.figma.com/file/ejemplo-alameda', 'Figma', 'u_irene', 70),
    link('file_6', 'p_luz', 'Plano del recorrido', 'https://drive.google.com/file/d/ejemplo-recorrido', 'Google Drive', 'u_marcos', 100),
  ];

  const place = (
    id: Id,
    projectId: Id,
    name: string,
    category: ProjectLocation['category'],
    status: ProjectLocation['status'],
    lat: number,
    lng: number,
    extra: Partial<ProjectLocation> = {},
  ): ProjectLocation => ({
    id, workspaceId: ws, projectId, name, category, status, lat, lng, createdBy: 'u_paula', createdAt: hoursAgo(80), updatedAt: hoursAgo(10), ...extra,
  });
  const at = (days: number, hour: number) => {
    const d = new Date(day(days));
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  // Localizaciones reales de Sevilla para los proyectos con mapa.
  const locations: ProjectLocation[] = [
    place('loc_plaza', 'p_mareas', 'Plaza de España', 'shoot', 'permission_pending', 37.37724, -5.98689, {
      address: 'Av. de Isabel la Católica, 41013 Sevilla',
      startAt: at(14, 8), endAt: at(14, 14),
      contactName: 'Oficina de rodajes del Ayuntamiento',
      cost: 450,
      notes: 'Revisar restricciones de trípode y acceso de vehículo. Alternativa si no hay permiso: Parque de María Luisa.',
    }),
    place('loc_puente', 'p_mareas', 'Puente de Isabel II', 'shoot', 'confirmed', 37.38567, -6.00208, {
      address: 'Puente de Triana, 41001 Sevilla',
      startAt: at(15, 19), endAt: at(15, 21),
      notes: 'Contraluz al atardecer desde la orilla de Triana. Reflector grande y permiso de dron.',
    }),
    place('loc_betis', 'p_mareas', 'Calle Betis', 'shoot', 'candidate', 37.38338, -6.00097, {
      address: 'Calle Betis, 41010 Sevilla',
      notes: 'Plano general al amanecer: casi nadie antes de las 8:00.',
    }),
    place('loc_mercado', 'p_mareas', 'Mercado de Triana', 'shoot', 'candidate', 37.38625, -6.00305, {
      address: 'Calle San Jorge 6, 41010 Sevilla',
      notes: 'Interior. Pedir permiso a la gerencia del mercado; solo lunes por la tarde.',
    }),
    place('loc_parking', 'p_mareas', 'Parking Paseo de Colón', 'parking', 'confirmed', 37.38585, -5.99816, {
      address: 'Paseo de Cristóbal Colón, 41001 Sevilla',
      cost: 60,
      notes: 'Furgoneta de material. Plaza reservada para los dos días.',
    }),
    place('loc_sanbernardo', 'p_luz', 'Plaza de San Bernardo', 'event', 'confirmed', 37.38236, -5.98045, {
      address: 'Plaza de San Bernardo, 41018 Sevilla',
      notes: 'Punto de luz 1: inicio del recorrido y punto de encuentro.',
    }),
    place('loc_santorey', 'p_luz', 'Calle Santo Rey', 'event', 'candidate', 37.38145, -5.98195, {
      address: 'Calle Santo Rey, 41018 Sevilla',
      notes: 'Punto de luz 4. Comprobar toma de corriente con los vecinos.',
    }),
    place('loc_asociacion', 'p_luz', 'Sede de la asociación vecinal', 'meeting', 'confirmed', 37.38290, -5.98180, {
      startAt: at(3, 19), endAt: at(3, 20),
      contactName: 'Carmen, presidenta de la asociación',
      notes: 'Reunión semanal de seguimiento.',
    }),
  ];

  return {
    version: 4,
    files,
    locations,
    workspace: { id: ws, name: 'Lamo Studio', cycle: 'Temporada otoño 2026' },
    members,
    projects,
    tasks,
    notes,
    activity,
  };
}
