# PetPulse

PetPulse es una plataforma web para el cuidado y la identificación de mascotas. Permite registrar perfiles con fotos privadas, generar un código QR de identificación, reportar mascotas perdidas, consultar un directorio de proveedores (veterinarias, peluquerías y similares) y agendar citas con recordatorio por correo.

Es un proyecto académico del programa SENA/ADSO. Usa datos comprobados y está pensado como demostración y ejercicio de ingeniería de software, no como servicio productivo aun.

---

## Tabla de contenido

1. [Estado actual](#estado-actual)
2. [Funcionalidades](#funcionalidades)
3. [Roles de usuario](#roles-de-usuario)
4. [Arquitectura](#arquitectura)
5. [Stack tecnológico](#stack-tecnológico)
6. [Requisitos](#requisitos)
7. [Instalación y ejecución local](#instalación-y-ejecución-local)
8. [Variables de entorno](#variables-de-entorno)
9. [Scripts disponibles](#scripts-disponibles)
10. [Base de datos y migraciones](#base-de-datos-y-migraciones)
11. [Autenticación](#autenticación)
12. [Almacenamiento de fotos](#almacenamiento-de-fotos)
13. [Correo de citas](#correo-de-citas)
14. [Pruebas e integración continua](#pruebas-e-integración-continua)
15. [Despliegue](#despliegue)
16. [Limitaciones y fuera de alcance](#limitaciones-y-fuera-de-alcance)
17. [Documentación](#documentación)
18. [Equipo y organización del trabajo](#equipo-y-organización-del-trabajo)
19. [Licencia](#licencia)

---

## Estado actual

- Los flujos persistentes están desplegados en **staging** y se probaron con datos ficticios.
- Las migraciones 0003 a 0005 se aplicaron y verificaron en staging el 13 de noviembre de 2026. La 0006 está registrada.
- **Producción:** las migraciones 0003 a 0006 todavía no se han aplicado.
- **Correo:** el transporte `gmail-api` es experimental y no se ha probado con Google. Render Free bloquea SMTP, así que el envío real depende de esa alternativa.
- **Mapa:** los lugares externos no están verificados; PetPulse no valida ubicaciones de proveedores.

Estos estados corresponden a la documentación de calidad de noviembre de 2026. Revísalos antes de presentar el proyecto.

---

## Funcionalidades

### Cuentas y acceso
- Registro e inicio de sesión con Clerk.
- Onboarding para completar el perfil de usuario.
- Acceso según rol (usuario, proveedor y administración) comprobado en el servidor.

### Mascotas
- Perfil de mascota con datos básicos y foto.
- Fotos privadas: se guardan en un bucket privado y solo se leen mediante la API.
- Código QR de identificación para la ficha de la mascota.
- Consentimiento explícito para mostrar contacto de emergencia.

### Mascotas perdidas
- Reporte de mascota perdida con ubicación aproximada.
- Mapa con Leaflet para visualizar reportes.
- La ubicación proviene del navegador de la persona usuaria, no de un dispositivo GPS en la mascota.

### Proveedores
- Perfil de proveedor y vínculo entre cuenta y proveedor.
- Recursos del proveedor (servicios y disponibilidad).
- Directorio de proveedores para consulta pública.

### Citas
- Solicitud y programación de citas sobre la disponibilidad del proveedor.
- Control de concurrencia para evitar reservas duplicadas (cubierto por una prueba de concurrencia).
- Recordatorio por correo con cola y worker propio.

### Administración
- Gestión de proveedores y reportes desde un panel administrativo.

### Demostración
- Ruta `/demo` con datos simulados, pensada para presentaciones sin depender del backend.

---

## Roles de usuario

| Rol | Qué puede hacer |
|---|---|
| Usuario | Gestionar sus mascotas, QR, reportes y citas. |
| Proveedor | Mantener su perfil, sus recursos y atender citas. |
| Administrador | Supervisar proveedores y reportes. |

Los roles se aplican en el servidor, no solo en la interfaz.

---

## Arquitectura

El proyecto es un **monorepo** administrado con pnpm. Las aplicaciones van en `artifacts/` y las librerías compartidas en `lib/`. La estructura completa está en [docs/ESTRUCTURA-DEL-REPOSITORIO.md](docs/ESTRUCTURA-DEL-REPOSITORIO.md).

```
PetPulse/
├── artifacts/
│   ├── pet-pulse/          # Aplicación web (SPA, React + Vite)
│   ├── api-server/         # API (Express 5)
│   └── mockup-sandbox/     # Pruebas visuales de componentes
├── lib/
│   ├── db/                 # Esquema Drizzle y migraciones 0000 a 0006
│   ├── api-spec/           # Contrato OpenAPI
│   ├── api-client-react/   # Cliente generado desde el contrato
│   └── api-zod/            # Validaciones generadas desde el contrato
├── docs/                   # Documentación técnica y de despliegue
├── .github/workflows/      # Integración continua
├── .env.example            # Plantilla de variables de entorno
├── package.json
└── pnpm-workspace.yaml
```

No hay carpetas `frontend/` ni `backend/` porque el monorepo separa las aplicaciones en `artifacts/` y el código compartido en `lib/`.

### Flujo de una petición
1. La web (Vercel) llama a la API mediante el contrato OpenAPI y su cliente generado.
2. La API (Render) valida el token de Clerk y comprueba la propiedad del recurso.
3. La API consulta la base de datos (Supabase) con Drizzle.
4. Las fotos se guardan en Supabase Storage y se entregan solo a través de la API.

### Contrato de la API
El archivo OpenAPI de `lib/api-spec` es la fuente de verdad. Desde él se generan el cliente de React y las validaciones con Zod. Si cambia una ruta, se regeneran ambos y el frontend no escribe llamadas HTTP a mano.

---

## Stack tecnológico

### Frontend (`artifacts/pet-pulse`)
- React y Vite
- Wouter (enrutado)
- TanStack Query (estado del servidor)
- Tailwind CSS 4 y Radix UI
- Leaflet (mapas) y qrcode.react (QR)
- Recharts, framer-motion, sonner y date-fns
- react-hook-form y Zod
- Clerk (`@clerk/react`)
- Vitest para pruebas

### Backend (`artifacts/api-server`)
- Express 5
- @clerk/express
- Drizzle ORM y Zod
- Orval (generación de código desde OpenAPI)
- Nodemailer y google-auth-library (correo)
- pino-http (registros), cookie-parser y cors
- http-proxy-middleware
- esbuild para empaquetar
- Vitest para pruebas

### Base de datos (`lib/db`)
- PostgreSQL en Supabase
- Drizzle ORM, Drizzle Kit (migraciones) y drizzle-zod
- Driver `pg`

### Servicios externos
- **Clerk:** identidad y sesiones.
- **Supabase:** base de datos PostgreSQL y Storage para fotos.
- **Vercel:** publicación de la web.
- **Render:** publicación de la API (producción y staging).
- **GitHub Actions:** integración continua.

---

## Requisitos

- **Node.js 22 o superior** (definido en `engines` del `package.json`).
- **pnpm** (el repositorio rechaza `npm install` o `yarn` en el paso `preinstall`). La versión fijada es `pnpm@10.34.9`.
- Cuenta de Clerk y proyecto de Supabase para el modo completo.
- Opcional: cuenta de Google con credenciales OAuth si se usa el transporte `gmail-api`.

---

## Instalación y ejecución local

```bash
# 1. Clonar el repositorio
git clone https://github.com/liney042-alt/monka.git
cd monka

# 2. Instalar dependencias con pnpm
pnpm install

# 3. Crear el archivo de variables de entorno
cp .env.example .env
# Completa los valores en .env (ver sección siguiente)

# 4. Verificar tipos y compilar
pnpm run typecheck
pnpm run build
```

Para trabajar sin cuentas externas puedes usar la ruta `/demo`, que funciona con datos simulados.

---

## Variables de entorno

La plantilla está en `.env.example`. Nunca subas valores reales al repositorio.

| Variable | Valores | Uso |
|---|---|---|
| `CLERK_AUTH_MODE` | `replit` o `external` | Modo de autenticación en la API (`artifacts/api-server/src/app.ts`). |
| `APPOINTMENT_EMAIL_TRANSPORT` | `disabled`, `smtp` o `gmail-api` | Transporte de correo de citas. Por defecto `smtp`. |
| `VITE_*` | Según Clerk y la URL de la API | Variables de la web. Deben configurarse también en Vercel. |

Las variables de Supabase, Clerk y Google se describen en [docs/deployment/CONFIGURACION-PLATAFORMAS.md](docs/deployment/CONFIGURACION-PLATAFORMAS.md).

---

## Scripts disponibles

Definidos en el `package.json` de la raíz:

| Comando | Qué hace |
|---|---|
| `pnpm run typecheck:libs` | Compila las librerías de `lib/` con `tsc --build`. |
| `pnpm run typecheck` | Verifica tipos de las librerías y de las aplicaciones en `artifacts/`. |
| `pnpm run build` | Ejecuta `typecheck` y luego el `build` de cada paquete que lo tenga. |
| `pnpm test` | Ejecuta las pruebas de cada paquete que las tenga (Vitest). |

Los scripts de cada paquete (por ejemplo, de la API o de la base de datos) están en su propio `package.json`.

---

## Base de datos y migraciones

- El esquema está en `lib/db/src/schema/`: perfiles de usuario, mascotas, proveedores, recursos del proveedor, citas y reportes de mascota perdida.
- Las migraciones están en `lib/db/drizzle/` y van de la **0000 a la 0006**.
- Las migraciones se gestionan con Drizzle Kit.
- La rama `main` solo contiene la migración 0000. Las migraciones 0001 a 0006 están en la rama `thomas`.

Antes de aplicar migraciones en producción conviene:
1. Aplicarlas primero en staging y verificar el resultado.
2. Confirmar que el bucket y las variables estén listos.
3. Tener un plan para revertir o corregir.

---

## Autenticación

- La identidad la gestiona **Clerk**.
- `CLERK_AUTH_MODE` define cómo valida la API las sesiones (`replit` o `external`).
- Los middlewares de la API comprueban el rol y la propiedad de cada recurso (por ejemplo, que una mascota pertenezca a quien la consulta).
- Las pruebas de autenticación usan dobles de Clerk; falta una prueba de integración real con Clerk.

---

## Almacenamiento de fotos

- Bucket `pet-photos` en **Supabase Storage**.
- Privado: no hay URLs públicas.
- Límite de 5 MB por archivo.
- Formatos permitidos: JPEG, PNG y WebP.
- La API sube y lee las fotos; el navegador nunca accede al bucket directamente.

La creación del bucket y sus reglas se describen en [docs/deployment/CONFIGURACION-PLATAFORMAS.md](docs/deployment/CONFIGURACION-PLATAFORMAS.md).

---

## Correo de citas

El worker de correo envía recordatorios de citas. Su transporte se elige con `APPOINTMENT_EMAIL_TRANSPORT`:

- **`disabled`:** no envía correos. Útil para pruebas y para staging donde el correo no es parte de lo que se evalúa.
- **`smtp`:** usa Nodemailer con una cuenta de Gmail y contraseña de aplicación. Render Free bloquea SMTP, por lo que en ese plan no funciona.
- **`gmail-api`:** envía con la API de Gmail mediante OAuth. Es experimental y no se ha probado con Google.

Los correos que no se pueden enviar permanecen en cola. Las notificaciones por WhatsApp están aplazadas hasta integrar un proveedor.

---

## Pruebas e integración continua

- **Pruebas unitarias y de integración** con Vitest. La API tiene pruebas en `artifacts/api-server/tests`: smoke de autenticación y roles, concurrencia de citas, transporte de correo y reportes de mascota perdida.
- **Verificación de tipos** con `pnpm run typecheck`.
- **Integración continua** en `.github/workflows/ci.yml`: Node 22 en Ubuntu y Windows.
- **Pendiente:** pruebas de navegador (end-to-end) y pruebas de integración contra Clerk y Supabase reales.

---

## Despliegue

| Parte | Plataforma | Notas |
|---|---|---|
| Web | Vercel | Requiere variables `VITE_*` en producción; sin ellas la compilación falla. |
| API (producción y staging) | Render | Plan gratuito: sin SMTP. |
| Base de datos y fotos | Supabase | Proyecto y bucket `pet-photos`. |
| Identidad | Clerk | Claves y dominios configurados por entorno. |

Pasos generales:
1. Configurar variables en cada plataforma (nombres en `.env.example`).
2. Aplicar migraciones en staging y verificarlas.
3. Desplegar la API y comprobar `/health`.
4. Desplegar la web y probar los flujos principales con datos ficticios.
5. Repetir en producción solo después de validar staging.

Guías detalladas:
- [docs/deployment/CONFIGURACION-PLATAFORMAS.md](docs/deployment/CONFIGURACION-PLATAFORMAS.md)
- [docs/deployment/PetPulse-Despliegue-Portatil.md](docs/deployment/PetPulse-Despliegue-Portatil.md)

---

## Limitaciones y fuera de alcance

- **Pagos:** no incluidos.
- **Telemedicina:** no incluida.
- **Notificaciones por SMS o WhatsApp:** no implementadas.
- **Verificación legal de proveedores:** no realizada. El directorio es informativo.
- **Rastreo GPS:** no hay dispositivos reales.
- **Producción:** migraciones pendientes y pruebas de integración sin cerrar.
- **Secretos:** hubo credenciales visibles en capturas de sesiones de trabajo anteriores. Se recomienda rotarlas (no confirmado).

---

## Documentación

| Documento | Contenido |
|---|---|
| [PetPulse-Documento-Maestro.md](docs/PetPulse-Documento-Maestro.md) | Visión, roles de producto y alcance. |
| [CALIDAD-REQUISITOS-Y-ROADMAP.md](docs/engineering/CALIDAD-REQUISITOS-Y-ROADMAP.md) | Backlog P0 a P3, hallazgos y evidencia de staging. |
| [CONFIGURACION-PLATAFORMAS.md](docs/deployment/CONFIGURACION-PLATAFORMAS.md) | Configuración de Clerk, Supabase, Vercel, Render y Google. |
| [PetPulse-Despliegue-Portatil.md](docs/deployment/PetPulse-Despliegue-Portatil.md) | Despliegue portátil. |
| [ESTRUCTURA-DEL-REPOSITORIO.md](docs/ESTRUCTURA-DEL-REPOSITORIO.md) | Estructura del monorepo y convenciones. |

---

## Equipo y organización del trabajo

| Integrante | Rol | Responsabilidades principales |
|---|---|---|
| Thomas Isaza | Full Stack y Scrum Master | Integración de web, API y base de datos; despliegues y CI; backlog, roadmap y documentación de despliegue. |
| Liney Ricardo | Frontend | Pantallas, mapa, ruta `/demo`, QR y consumo del cliente generado. |
| Durman Vanegas | Backend | Rutas de la API, autenticación, citas, correo, fotos y pruebas de la API. |
| Steven Tobón | Base de datos | Esquema, migraciones 0000 a 0006, bucket de fotos y verificación en staging. |

La asignación se basa en el rol declarado para el proyecto y en las tecnologías de cada área, no en el historial de commits.

---
