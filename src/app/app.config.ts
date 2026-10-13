import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';

import { routes } from './app.routes';
import { provideMockData } from './core/data/mock/mock-repositories';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      // Parámetros de ruta y `data` llegan como inputs de los componentes.
      withComponentInputBinding(),
      // Las rutas hijas de /proyectos/:projectId también reciben projectId.
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    // Capa de datos: hoy en memoria; para Firebase, sustituir por provideFirebaseData().
    ...provideMockData(),
  ],
};
