# TaskPulse

Gestor de tareas personal con una matriz de prioridades estilo Eisenhower, calendario, estadísticas y recordatorios. React + Vite en el cliente, Firebase (Auth + Firestore) para cuentas y datos — no hay servidor propio en el camino de la petición.

En producción: **https://manager-de-tareas.web.app**

## Desarrollo

```
npm install
npm run dev       # servidor de desarrollo (puerto 5173)
npm run build     # build de producción
npm run preview   # sirve el build (puerto 4173) — necesario para probar el service worker/PWA
npm run lint      # oxlint
npm run test      # pruebas de src/taskUtils.test.js
```

## Publicar

Desde la raíz del repositorio (no desde `client/`):

```
firebase deploy --only hosting          # publica client/dist
firebase deploy --only firestore:rules  # publica firestore.rules
```

Ver `CLAUDE.md` para el detalle de arquitectura, modelo de datos y decisiones del proyecto.
