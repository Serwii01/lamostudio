# Lamo Studio

Plataforma de gestión de proyectos creativos: un sistema operativo de producción para estudios,
productoras, agencias y freelancers. Organiza el trabajo como **espacio de trabajo → proyecto →
módulos**, de modo que cada proyecto activa solo las pantallas que necesita (tareas, tablero, notas,
mapa, pizarra, entregables…).

Estado actual: **Fase 0 + MVP con datos de demostración** (sin backend todavía).

## Arrancar

Requisitos: Node 22.12 o superior (Angular 22 exigirá Node ≥ 22.22.3).

```bash
npm install
npm start
```

Abre http://localhost:4200. Los datos de demostración se guardan en el `localStorage` del navegador;
se pueden restablecer desde **Configuración → Restablecer datos de demostración**.

Para ver la app con otro rol (producción, colaborador, cliente…), cambia de usuario en el selector
«Viendo la app como» de la barra lateral.

## Qué incluye

- **Dashboard**: métricas (proyectos activos, revisiones, vencidas, carga del equipo, cumplimiento),
  entregas críticas por periodo, alertas de retraso, bloqueo y sobrecarga, tabla de proyectos y actividad.
- **Proyectos** con 6 plantillas (branding, vídeo, campaña, web, evento, libre) que preactivan módulos.
- **Resumen de proyecto**: progreso calculado desde las tareas, riesgos, próximas entregas, equipo y actividad.
- **Tareas**: lista agrupada por estado con vistas «Mías», «Esta semana», «Sin responsable», «Bloqueadas»;
  panel lateral con estado, responsable, fecha, prioridad, estimación, etiquetas, descripción, subtareas y comentarios.
- **Tablero Kanban** con arrastrar y soltar (cambia estado y orden).
- **Notas rápidas** (tecla `N` en cualquier pantalla), privadas o compartidas, convertibles en tarea.
- **Actividad** registrada para cada acción relevante.
- **Equipo** con capacidad semanal frente a horas planificadas.
- **Búsqueda global** de proyectos, tareas y notas.
- **Roles simples** (propietaria, administración, producción, dirección creativa, colaborador, cliente):
  el cliente solo ve sus proyectos y no ve la carga interna.
- Módulos de fases posteriores (calendario, mapa, pizarra, archivos, entregables, tiempo, presupuesto,
  shot list) visibles como «Próximamente» con su descripción.

## Diseño

Estética japonesa minimalista con trazo a mano, construida a partir del logo:

- **Paleta**: papel washi `#E4E2DD` (fondo del logo), tinta sumi y un único acento rojo `#FF3131`.
  Estados con tonos tradicionales: matcha (aprobado), kincha (revisión), ai (en curso), fuji (cambios).
- **Tipografía**: Zen Maru Gothic (títulos, redondeada como el logo), Zen Kaku Gothic New (texto) y
  Klee One (anotaciones y notas, como escritas a lápiz).
- **Garabatos**: subrayado a mano en los títulos, enso de pincel para el progreso, check dibujado,
  doodles en los estados vacíos. Componentes en `shared/ui/scribble.ts`; la marca en `shared/ui/logo.ts`.
- Tokens de diseño en `src/styles.css` (`@theme`).

## Arquitectura

```
src/app/
  core/
    models.ts              Modelo de dominio
    catalog.ts             Estados, roles y permisos, módulos, plantillas
    data/repositories.ts   Contratos abstractos de acceso a datos
    data/mock/             Implementación en memoria + semilla de demostración
    services/              Lógica de aplicación (proyectos, tareas, notas, actividad, sesión)
  layout/                  Shell: barra lateral, barra superior, búsqueda, nota rápida
  shared/                  Componentes reutilizables (fila de tarea, actividad, iconos, avatares…)
  features/                Pantallas, cargadas de forma diferida por ruta
```

Las pantallas solo dependen de los servicios, y los servicios solo de las clases abstractas de
`core/data/repositories.ts`. Las lecturas se exponen como *signals*, así que una fuente en tiempo real
(Firestore `onSnapshot`, WebSocket) puede alimentarlas sin tocar la UI.

### Pasar a Firebase (o a una API Spring Boot)

1. Crear `core/data/firebase/` con implementaciones de `WorkspaceRepository`, `ProjectRepository`,
   `TaskRepository`, `NoteRepository` y `ActivityRepository`.
2. Exponer un `provideFirebaseData()` equivalente a `provideMockData()`.
3. Cambiar la línea correspondiente en `app.config.ts`.
4. Sustituir el selector de usuario por Firebase Authentication en `SessionService`.
5. Replicar los permisos de `ROLE_PERMISSIONS` en las reglas de seguridad de Firestore
   (denegar por defecto y verificar pertenencia al espacio en cada subcolección).

## Roadmap

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Design tokens, layout, rutas, datos mock | Hecho |
| 1 | Proyectos, plantillas, módulos, tareas, Kanban, notas, actividad, dashboard, roles simples | Hecho (sin backend) |
| 1b | Firebase Auth + Firestore + reglas de seguridad, invitaciones a miembros | Siguiente |
| 2 | Calendario, entregables con versiones y aprobación, archivos/enlaces, mapa (Leaflet + OSM), pizarra individual | Pendiente |
| 3 | Pizarra en tiempo real (Yjs), registro de horas, presupuesto, shot list y call sheet, permisos granulares | Pendiente |
| 4 | Integraciones (Google Calendar, Drive, Frame.io, Slack), informes, portal de cliente | Pendiente |

## Stack

Angular 21 sin zone.js (detección de cambios zoneless, componentes standalone, signals, control flow),
Tailwind CSS 4, Angular CDK (drag & drop) y Vitest para tests unitarios (`npm test`).
