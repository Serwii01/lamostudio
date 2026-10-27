# CreaFlow / Lamo Studio

Plataforma de gestión de proyectos creativos («sistema operativo de producción» para estudios, productoras, agencias y freelancers). Organiza el trabajo como **espacio de trabajo → proyecto → módulos**; cada proyecto activa solo los módulos que necesita. La carpeta se llama CreaFlow, pero el producto y el repo (`lamostudio`) se llaman Lamo Studio. Detalle de funciones y roadmap en `README.md`.

## Stack
- Angular 21 (standalone, signals, sin zone.js) + Tailwind, tests con Vitest.
- Sin backend todavía: datos de demostración en `localStorage` y archivos en IndexedDB.
- Mapa con Leaflet + OpenStreetMap.
- Backend previsto: Firebase Auth + Firestore (fase 1b).

## Estructura
- `src/app/` — `core/` (servicios/estado), `features/` (pantallas y módulos), `layout/`, `shared/`.
- `docs/design-system/` — sistema de diseño de Lamo Studio.

## Comandos
```bash
npm start      # http://localhost:4200 (Node ≥ 22.12)
npm run build
npm test
```

## Convenciones
- Interfaz en español.
- Estética japonesa minimalista con trazo a mano; tipografía solo Helvetica y Helvetica Light. Seguir `docs/design-system/`.
- Roles simulables desde el selector «Viendo la app como» de la barra lateral.

> El estado del trabajo (qué se hizo, qué falta) está en `STATUS.md`.
