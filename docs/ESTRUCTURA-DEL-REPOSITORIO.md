# Estructura del repositorio PetPulse

Este documento explica qué contiene cada carpeta y archivo del repositorio, cómo se relacionan entre sí y dónde viven el frontend, el backend y la base de datos.

## 1. Resumen general

PetPulse es un **monorepo** administrado con **pnpm workspaces**. Un monorepo guarda varias aplicaciones y librerías en un mismo repositorio Git, compartiendo dependencias y configuración.

El proyecto tiene tres bloques principales:

| Bloque | Carpeta | Qué es |
| --- | --- | --- |
| Frontend (web de PetPulse) | `artifacts/pet-pulse/` | Aplicación React + Vite que usan dueños, proveedores y administradores |
| Backend (API) | `artifacts/api-server/` | Servidor Express + TypeScript que atiende las peticiones de la web |
| Base de datos y contratos compartidos | `lib/` | Esquema de base de datos, contrato OpenAPI, cliente HTTP y validaciones generadas |

Además hay un prototipo (`artifacts/mockup-sandbox/`), documentación (`docs/`) y archivos de configuración de despliegue en la raíz.

## 2. Por qué no hay carpetas llamadas `frontend/` y `backend/`

La organización actual usa `artifacts/` para las aplicaciones y `lib/` para las librerías compartidas. Esta convención viene de las plantillas de Replit, donde cada aplicación desplegable es un "artifact". Por eso el frontend y el backend no están en la raíz con esos nombres: están dentro de `artifacts/`.

Esto es funcional, pero no es la convención más común. Muchos proyectos usan:

- `apps/` para aplicaciones desplegables (frontend y backend)
- `packages/` para librerías compartidas

Renombrar a `apps/` y `packages/` sería una mejora de legibilidad, pero implica cambiar rutas en `pnpm-workspace.yaml`, `package.json`, `vercel.json`, `render.yaml`, `.github/workflows/ci.yml` y en la documentación. Es un cambio que conviene hacer en una rama aparte y validar el build antes de unirlo a `main`.

### Origen del término "artifacts"

La palabra "artifact" es común en ingeniería de software con otro sentido: las salidas de un build, como un paquete npm o una imagen Docker. Como nombre de la carpeta que agrupa las aplicaciones, es poco habitual. Viene de la plantilla de Replit, que organiza cada aplicación desplegable como un "artifact" con su carpeta `.replit-artifact/`. Las convenciones más extendidas en monorepos son `apps/` y `packages/` (Turborepo, Nx y muchos proyectos con pnpm).

Forma recomendada de explicarlo:

> "El proyecto se generó con la plantilla de Replit, que agrupa las aplicaciones desplegables en `artifacts/`. Mantuve esa estructura porque cambiarla implica ajustar el workspace, los despliegues en Vercel y Render, el CI y la documentación. Reconozco que `apps/` y `packages/` es la convención más común, y es el siguiente paso que propongo."

## 3. Árbol de carpetas (simplificado)

```text
monka/
├── artifacts/                  Aplicaciones
│   ├── pet-pulse/              Frontend (React + Vite)
│   ├── api-server/             Backend (Express + TypeScript)
│   └── mockup-sandbox/         Prototipo de interfaz (no se despliega)
├── lib/                        Librerías compartidas
│   ├── db/                     Base de datos (Drizzle ORM + migraciones)
│   ├── api-spec/               Contrato de la API (OpenAPI)
│   ├── api-zod/                Validaciones generadas desde el contrato
│   └── api-client-react/       Cliente HTTP generado para React
├── docs/                       Documentación del proyecto
├── .github/workflows/          Integración continua (CI)
├── package.json                Scripts globales (build, test, typecheck)
├── pnpm-workspace.yaml         Lista de paquetes del monorepo
├── pnpm-lock.yaml              Versiones exactas de dependencias
├── tsconfig.base.json          Configuración TypeScript compartida
├── tsconfig.json               Referencias de compilación TypeScript
├── vercel.json                 Configuración de despliegue del frontend (Vercel)
├── render.yaml                 Configuración de despliegue de la API (Render)
├── .env.example                Plantilla de variables de entorno (sin secretos)
├── .npmrc                      Configuración de pnpm
├── .gitignore                  Archivos que Git no versiona
├── README.md                   Readme general
└── README-PetPulse.md          Readme específico de PetPulse
```

## 4. Componentes en detalle

### 4.1 `artifacts/pet-pulse/` (frontend)

Aplicación web hecha con React, TypeScript y Vite. Es la que se publica en Vercel.

- `src/main.tsx`: punto de entrada de la aplicación.
- `src/App.tsx`: define las rutas y la estructura principal.
- `src/DemoApp.tsx` y `src/demo-main.tsx`: versión de demostración sin autenticación real, usada para presentaciones locales.
- `src/pages/`: una página por pantalla. Incluye `PetsPage` (mascotas), `ProviderPage` (proveedor), `AppointmentsPage` (citas), `AdminPage` (administración), `LostPetsPage` (mascotas perdidas), `DirectoryPage` (directorio), `PublicPetPage` (página pública con QR), `PublicHomePage` (inicio público), `WorkspaceHomePage` (inicio tras iniciar sesión), `OnboardingPage` (primer ingreso), `AuthPages` (ingreso y registro), `ProviderResourcesPanels` (paneles de recursos del proveedor) y `not-found` (página 404).
- `src/features/`: lógica de funcionalidades concretas. Hoy contiene `map/` (servicio y tipos del mapa) y `providers.ts`.
- `src/components/`: componentes reutilizables. Incluye `ui/` con componentes base de interfaz.
- `src/hooks/`: hooks personalizados de React.
- `src/lib/`: utilidades generales.
- `src/app/`: configuración de la aplicación. Por ejemplo, `config.ts` valida las variables `VITE_*` en producción.
- `src/index.css`: estilos globales y ajustes responsivos.
- `public/`: archivos estáticos (íconos, imágenes).
- `index.html`: página HTML base que carga la aplicación.
- `demo-local.html`: página para correr la demostración sin servidor.
- `tests/`: pruebas del frontend.
- `vite.config.ts`: configuración de Vite. Incluye plugins de Replit que solo aplican en ese entorno.
- `components.json`: configuración de componentes de interfaz (shadcn/ui).
- `.replit-artifact/artifact.toml`: configuración de Replit. Ver sección 5.

### 4.2 `artifacts/api-server/` (backend)

Servidor Express con TypeScript. Atiende las peticiones de la web, se conecta a la base de datos y envía correos.

- `src/index.ts`: arranca el servidor HTTP.
- `src/app.ts`: configura Express, CORS, autenticación y rutas.
- `src/routes/`: un archivo por recurso de la API:
  - `health.ts`: estado del servicio (`/api/healthz`, usado por Render).
  - `me.ts`: datos del usuario autenticado.
  - `pets.ts`: mascotas.
  - `appointments.ts` y `appointmentScheduling.ts`: citas y disponibilidad.
  - `providerProfile.ts` y `providerResources.ts`: perfil y recursos de proveedores.
  - `lostPetReports.ts`: reportes de mascotas perdidas.
  - `notificationPreferences.ts`: preferencias de aviso.
  - `admin.ts`: funciones de administración.
  - `index.ts`: une todas las rutas.
- `src/lib/`: lógica de negocio y servicios externos:
  - `appointmentEmailWorker.ts`: envía los avisos de citas en segundo plano.
  - `gmailApiTransport.ts`: transporte de correo por la API de Gmail.
  - `petPhotoStorage.ts`: almacenamiento de fotos en Supabase Storage.
  - `providerLinks.ts` y `lostPetReports.ts`: reglas de negocio de esas funciones.
  - `logger.ts`: registro de eventos.
- `src/middlewares/`: `auth.ts` valida la sesión y `clerkProxyMiddleware.ts` gestiona el acceso de Clerk.
- `src/types/`: tipos de TypeScript propios de Express.
- `tests/`: pruebas de la API.
- `build.mjs`: script que compila el servidor para producción.

### 4.3 `artifacts/mockup-sandbox/` (prototipo)

Entorno aislado para diseñar pantallas sin conectar a la base de datos. No lo usan Vercel ni Render. Puede eliminarse sin afectar la aplicación, pero hoy no tiene dependencias del resto del monorepo más allá de sus propios paquetes.

### 4.4 `lib/db/` (base de datos)

- `src/schema/`: definición de tablas con Drizzle ORM. Hay una tabla por archivo: `pets.ts`, `appointments.ts`, `providerProfiles.ts`, `providerResources.ts`, `userProfiles.ts`, `lostPetReports.ts`.
- `src/index.ts`: conexión a la base de datos y exportación de las tablas.
- `drizzle/`: migraciones SQL numeradas, de `0000` a `0006`, con sus snapshots JSON. Cada migración corresponde a un cambio de esquema.
- `drizzle.config.ts`: configuración de Drizzle para generar y aplicar migraciones.

### 4.5 `lib/api-spec/` (contrato de la API)

- `openapi.yaml`: describe todos los endpoints, sus parámetros y respuestas. Es la fuente de verdad del contrato entre frontend y backend.
- `orval.config.ts`: genera automáticamente el cliente y las validaciones a partir de `openapi.yaml`.

### 4.6 `lib/api-zod/` y `lib/api-client-react/` (código generado)

- `api-zod/src/generated/`: esquemas de validación generados desde el contrato. No se editan a mano.
- `api-zod/src/pet-fields.ts`: campos de mascota compartidos entre validaciones.
- `api-client-react/src/generated/`: funciones y hooks generados para llamar a la API desde React.
- `api-client-react/src/custom-fetch.ts`: cliente `fetch` personalizado (token, errores, URL base).
- `api-client-react/src/public-providers.ts`: proveedores públicos para el cliente.

Regla importante: si cambias `openapi.yaml`, hay que regenerar estos paquetes. No conviene editar las carpetas `generated/`.

### 4.7 `docs/` (documentación)

- `PetPulse-Documento-Maestro.md`: documento principal del proyecto.
- `deployment/CONFIGURACION-PLATAFORMAS.md`: variables y pasos por plataforma (Supabase, Clerk, Render, Vercel).
- `deployment/PetPulse-Despliegue-Portatil.md`: despliegue en un equipo nuevo.
- `engineering/CALIDAD-REQUISITOS-Y-ROADMAP.md`: requisitos, calidad y hoja de ruta.
- `PetPulse-Guia-Evaluacion-y-Produccion.md`: guía de evaluación y producción (aún sin confirmar en Git).
- Este mismo archivo.

### 4.8 Archivos de la raíz

| Archivo | Función |
| --- | --- |
| `package.json` | Scripts globales. `build` compila todo, `test` ejecuta las pruebas, `typecheck` revisa tipos. Obliga a usar pnpm. |
| `pnpm-workspace.yaml` | Lista los paquetes del monorepo y reglas de seguridad de instalación (edad mínima de paquetes npm). |
| `pnpm-lock.yaml` | Versiones exactas instaladas. Debe mantenerse sincronizado con `package.json`. |
| `tsconfig.base.json` | Opciones de TypeScript que comparten todos los paquetes. |
| `tsconfig.json` | Referencias para compilar todo el monorepo en orden. |
| `vercel.json` | Comando de build, carpeta publicada (`artifacts/pet-pulse/dist/public`) y reescrituras a `index.html`. |
| `render.yaml` | Define los servicios de Render: `pet-pulse-api` (producción, rama `main`) y `pet-pulse-api-staging` (rama `thomas`). |
| `.env.example` | Lista de variables necesarias, sin valores reales. |
| `.env.local` | Variables locales. No debe subirse a Git. |
| `.npmrc` | Configuración de pnpm. |
| `.gitignore` | Excluye `node_modules`, `dist`, archivos de entorno y otros archivos locales. |
| `.github/workflows/ci.yml` | Pipeline de integración continua: instala, compila, revisa tipos y ejecuta pruebas. |
| `README.md` y `README-PetPulse.md` | Instrucciones de uso. |

## 5. Archivos de Replit

Existen dos archivos `.replit-artifact/artifact.toml`, uno en `artifacts/pet-pulse/` y otro en `artifacts/mockup-sandbox/`. Definen cómo Replit ejecuta cada aplicación. Vercel y Render no los usan, así que son opcionales si el proyecto ya no se abre en Replit.

Además, el código tiene referencias a Replit: plugins en `vite.config.ts`, dependencias `@replit/*` en `package.json` y `pnpm-workspace.yaml`, y el valor por defecto `CLERK_AUTH_MODE="replit"` en `artifacts/api-server/src/app.ts`. Quitarlas es un cambio de dependencias que debe validarse con build y pruebas.

## 6. Flujo de despliegue

1. **Base de datos**: Supabase, con migraciones de `lib/db/drizzle/`.
2. **API**: Render, con `render.yaml` y variables configuradas en el panel.
3. **Frontend**: Vercel, con `vercel.json`. Las variables `VITE_*` se incrustan en el build, así que cambiarlas requiere un nuevo despliegue.
4. **Autenticación**: Clerk. Su clave pública debe coincidir entre frontend y backend.

## 7. Dónde está cada cosa (guía rápida)

| Si necesitas... | Ve a... |
| --- | --- |
| Cambiar una pantalla | `artifacts/pet-pulse/src/pages/` |
| Cambiar un endpoint | `artifacts/api-server/src/routes/` y `lib/api-spec/openapi.yaml` |
| Cambiar una tabla | `lib/db/src/schema/` y una nueva migración en `lib/db/drizzle/` |
| Cambiar variables de despliegue | `render.yaml`, `vercel.json` y `docs/deployment/` |
| Entender el flujo de despliegue | `docs/deployment/CONFIGURACION-PLATAFORMAS.md` |
