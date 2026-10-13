import { Routes } from '@angular/router';
import { AppShell } from './layout/app-shell';
import { requireModule } from './features/project/project-shell';

const comingSoon = () => import('./features/workspace/workspace-pages').then((m) => m.ComingSoon);

export const routes: Routes = [
  {
    path: '',
    component: AppShell,
    children: [
      {
        path: '',
        title: 'Inicio · Lamo Studio',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'tareas',
        title: 'Tareas · Lamo Studio',
        loadComponent: () => import('./features/my-tasks/my-tasks').then((m) => m.MyTasks),
      },
      { path: 'mis-tareas', redirectTo: 'tareas' },
      {
        path: 'proyectos',
        title: 'Proyectos · Lamo Studio',
        loadComponent: () => import('./features/projects/project-list').then((m) => m.ProjectList),
      },
      {
        path: 'proyectos/nuevo',
        title: 'Nuevo proyecto · Lamo Studio',
        loadComponent: () => import('./features/projects/new-project').then((m) => m.NewProject),
      },
      {
        path: 'proyectos/:projectId',
        title: 'Proyecto · Lamo Studio',
        loadComponent: () => import('./features/project/project-shell').then((m) => m.ProjectShell),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'resumen' },
          {
            path: 'resumen',
            loadComponent: () => import('./features/project/overview').then((m) => m.ProjectOverview),
          },
          {
            path: 'tareas',
            canActivate: [requireModule('tasks', 'kanban')],
            loadComponent: () => import('./features/project/task-list').then((m) => m.TaskList),
          },
          {
            path: 'tablero',
            canActivate: [requireModule('tasks', 'kanban')],
            loadComponent: () => import('./features/project/kanban').then((m) => m.Kanban),
          },
          {
            path: 'notas',
            canActivate: [requireModule('notes')],
            loadComponent: () => import('./features/notes/notes-board').then((m) => m.NotesBoard),
          },
          {
            path: 'archivos',
            canActivate: [requireModule('files')],
            loadComponent: () => import('./features/files/files-board').then((m) => m.FilesBoard),
          },
          {
            path: 'actividad',
            loadComponent: () => import('./features/project/project-pages').then((m) => m.ProjectActivity),
          },
          {
            path: 'configuracion',
            loadComponent: () => import('./features/project/project-settings').then((m) => m.ProjectSettings),
          },
          {
            path: ':modulePath',
            loadComponent: () => import('./features/project/project-pages').then((m) => m.ModulePlaceholder),
          },
        ],
      },
      {
        path: 'notas',
        title: 'Notas · Lamo Studio',
        loadComponent: () => import('./features/notes/notes-board').then((m) => m.NotesBoard),
      },
      {
        path: 'equipo',
        title: 'Equipo · Lamo Studio',
        loadComponent: () => import('./features/workspace/workspace-pages').then((m) => m.Team),
      },
      {
        path: 'configuracion',
        title: 'Configuración · Lamo Studio',
        loadComponent: () => import('./features/workspace/workspace-pages').then((m) => m.WorkspaceSettings),
      },
      {
        path: 'calendario',
        title: 'Calendario · Lamo Studio',
        loadComponent: comingSoon,
        data: {
          heading: 'Calendario del estudio',
          icon: 'calendar',
          summary: 'Tareas, hitos, rodajes, reuniones y publicaciones de todos los proyectos en un único calendario.',
        },
      },
      {
        path: 'entregables',
        title: 'Entregables · Lamo Studio',
        loadComponent: comingSoon,
        data: {
          heading: 'Entregables',
          icon: 'package',
          summary: 'Versiones, revisiones internas y aprobaciones de cliente de todos los proyectos.',
        },
      },
      {
        path: 'biblioteca',
        title: 'Biblioteca · Lamo Studio',
        loadComponent: () => import('./features/files/files-board').then((m) => m.FilesBoard),
      },
      {
        path: 'clientes',
        title: 'Clientes · Lamo Studio',
        loadComponent: comingSoon,
        data: {
          heading: 'Clientes',
          icon: 'briefcase',
          phase: 'Fase 3',
          summary: 'Fichas de cliente, contactos, proyectos pasados y aprobaciones pendientes.',
        },
      },
      {
        path: 'informes',
        title: 'Informes · Lamo Studio',
        loadComponent: comingSoon,
        data: {
          heading: 'Informes',
          icon: 'chart',
          phase: 'Fase 4',
          summary: 'Cumplimiento de plazos, carga del equipo y tiempos de aprobación exportables.',
        },
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
