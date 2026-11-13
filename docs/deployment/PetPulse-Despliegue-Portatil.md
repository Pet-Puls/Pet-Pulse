# PetPulse: despliegue portátil

Guía para recrear PetPulse en proyectos nuevos, separando la interfaz, la API y la base de datos:

| Plataforma | Responsabilidad | Proyecto/recurso |
| --- | --- | --- |
| Vercel | Interfaz React/Vite y archivos estáticos | Proyecto web conectado a este repositorio |
| Render | API Express, autenticación de solicitudes y reglas de permisos | Servicio web definido en `render.yaml` |
| Supabase | PostgreSQL administrado; fuente única de datos de la aplicación | Proyecto Supabase y esquema Drizzle versionado |
| Clerk | Inicio de sesión, registro y sesiones | Instancia Clerk externa, independiente de las cuentas Replit |

Vercel y Render no almacenan copias separadas de los datos. Render lee y escribe en la única base PostgreSQL de Supabase. La aplicación no usa Supabase Auth: conserva Clerk para autenticación y aplica los roles de tutor, proveedor y administrador en la API.

## Qué queda igual

- Se conserva la experiencia visual, las rutas, las interacciones y la demostración local de PetPulse.
- La demo sigue aislada y guarda sus cambios en el navegador. Sus datos simulados no se convierten en datos de producción.
- El despliegue actual de Replit conserva su proxy de Clerk. La API solo cambia al modo externo cuando `CLERK_AUTH_MODE=external`.
- Las cuentas reales, los perfiles de mascotas, los perfiles de proveedores y la revisión administrativa viven en PostgreSQL y usan los permisos del servidor.
- El primer administrador se define mediante una lista de correos verificados en `PETPULSE_ADMIN_EMAILS`; nunca se asigna desde el navegador.

## Archivos de recreación

- `render.yaml`: crea el servicio API en Render y solicita las variables que deben configurarse en cada proyecto.
- `vercel.json`: compila la web desde la raíz del monorepo y publica el directorio estático de Vite.
- `lib/db/src/schema/`: modelos fuente de las tablas.
- `lib/db/drizzle/`: migraciones SQL generadas y versionadas.
- `.env.example`: nombres y formato de variables. Es solo una plantilla; no contiene credenciales reales.

## Requisitos previos

1. Publica el código en un repositorio Git que puedas conectar desde Render y Vercel.
2. Crea un proyecto Supabase y una instancia Clerk externa para el despliegue fuera de Replit.
3. No copies las claves secretas de Clerk ni la contraseña de PostgreSQL al código, al repositorio, a Vercel ni a esta guía.

## 1. Crear Supabase y aplicar el esquema

1. Crea un proyecto PostgreSQL nuevo en Supabase.
2. En **API Settings**, desactiva la Data API de Supabase: PetPulse accede a PostgreSQL solo desde la API Express y no necesita exponer tablas por REST. Si decides dejarla activa, configura y verifica RLS y permisos antes de guardar datos reales; el esquema actual está pensado para acceso exclusivo del servidor.
3. En **Connect**, copia la cadena de conexión de **Session pooler** y úsala como `DATABASE_URL` del servidor Render. El pooler de sesión es la opción compatible con una API Node persistente en redes IPv4 como Render.
4. Para aplicar el esquema inicial a una base vacía, desde una copia local del repositorio configura `DATABASE_URL` en un archivo `.env` local (ignorado por Git) y ejecuta:

   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter @workspace/db run migrate
   ```

   También puedes configurar `DATABASE_URL` en el entorno seguro de tu terminal antes de ejecutar el comando. No pegues la cadena real en archivos versionados ni en el frontend.
5. Comprueba en Supabase que aparecieron las tablas de perfiles, mascotas y proveedores.

El esquema se define en Drizzle y las migraciones se versionan en el repositorio. Para un cambio de estructura futuro:

```bash
pnpm --filter @workspace/db run generate
```

Revisa y versiona los SQL generados antes de desplegar; aplica las migraciones a la base objetivo con `pnpm --filter @workspace/db run migrate`. No uses `push-force` contra una base con información real.

## 2. Crear la instancia externa de Clerk

La instancia de Clerk administrada por Replit sigue siendo válida para el despliegue actual, pero no debe asumirse disponible en Render o Vercel. Crea una instancia Clerk propia para los despliegues externos y registra allí:

- el dominio de producción de Vercel;
- los dominios de vista previa de Vercel que realmente quieras autorizar;
- los dominios de retorno/redirección de inicio de sesión y registro que indique Clerk.

Usa la publishable key en Vercel y Render. La secret key va únicamente en los secretos del servicio Render. En ese servicio configura `CLERK_AUTH_MODE=external`. El cliente envía el token de sesión en `Authorization: Bearer ...`; la API valida la firma y el origen autorizado.

No añadas `VITE_CLERK_PROXY_URL` al proyecto Vercel. Ese proxy pertenece al despliegue gestionado en Replit.

## 3. Crear el proyecto Vercel

1. Importa el repositorio en Vercel y deja **Root Directory** en la raíz del repositorio (`.`), no en `artifacts/pet-pulse`. El comando de compilación necesita el workspace pnpm y los paquetes compartidos del monorepo.
2. Configura para Production y Preview la variable pública:

   | Variable | Valor |
   | --- | --- |
   | `VITE_CLERK_PUBLISHABLE_KEY` | Publishable key de tu instancia Clerk externa |

3. Haz un primer despliegue y copia el dominio de producción de Vercel. No pongas ninguna clave secreta en Vercel.

`vercel.json` ya define el comando de build, el directorio estático y el fallback de rutas SPA.

## 4. Crear el servicio Render

1. En Render crea un **Blueprint** conectado al mismo repositorio y acepta el servicio declarado en `render.yaml`.
2. Completa los campos solicitados con los valores de tus proyectos:

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | URI de Supabase Session pooler |
   | `CLERK_PUBLISHABLE_KEY` | Publishable key de la instancia Clerk externa |
   | `CLERK_SECRET_KEY` | Secret key de Clerk; guárdala como secreto de Render |
   | `ALLOWED_WEB_ORIGINS` | Orígenes exactos de Vercel, separados por coma, por ejemplo `https://pet-pulse.vercel.app` |
   | `PETPULSE_ADMIN_EMAILS` | Correos que deben tener acceso administrador, separados por coma; deben estar verificados en Clerk |

3. Copia la URL pública del servicio API. El endpoint de salud es `/api/healthz`.

El CORS y `authorizedParties` se limitan a los orígenes exactos de `ALLOWED_WEB_ORIGINS`; no uses `*`. Si cambias o agregas un dominio de Vercel, actualiza este valor en Render y vuelve a desplegar.

## 5. Conectar Vercel con Render

En la configuración de Vercel añade:

| Variable | Valor |
| --- | --- |
| `VITE_API_BASE_URL` | Origen de Render, sin `/api` al final, por ejemplo `https://pet-pulse-api.onrender.com` |

Vuelve a desplegar Vercel. La web antepone ese origen a las rutas `/api/...` y solicita un token Clerk cuando llama a la API entre dominios.

## 6. Verificación posterior al despliegue

- Abre `https://<api-render>/api/healthz`: debe responder `{"status":"ok"}`.
- Abre la web Vercel y prueba registro/inicio de sesión con Clerk externo.
- Completa el alta de una cuenta tutora y comprueba que pueda crear, editar y borrar su propia mascota.
- Comprueba que una cuenta proveedora no pueda acceder a administración y que sus cambios queden pendientes de aprobación.
- Comprueba el panel administrativo con uno de los correos verificados de `PETPULSE_ADMIN_EMAILS`.
- Confirma que rutas como `/map` y `/demo` conservan la demostración aislada.
- En las herramientas de red, comprueba que las llamadas a la API van a Render y llevan el token de sesión; no deben incluir claves secretas.

## 7. Puerta de salida de staging

Completa esta validación en proyectos de Clerk, Supabase, Render y Vercel separados de producción, con cuentas y datos ficticios. No pegues secretos en tickets, consola compartida ni archivos versionados.

1. **Base de datos:** confirma el proyecto y la rama antes de ejecutar migraciones. En una base aislada vacía, ejecuta `pnpm --filter @workspace/db run migrate` y comprueba perfiles, mascotas y proveedores. Repite el comando para verificar que Drizzle no vuelve a aplicar migraciones registradas. En un segundo staging con el esquema previo, aplica las migraciones pendientes y comprueba que los datos de prueba existentes siguen disponibles. No uses `push-force`.
2. **Fotos:** crea `pet-photos` como bucket privado. Sube y consulta una imagen válida; intenta abrir el objeto sin autorización y con otra cuenta, y confirma que se deniega. Verifica también rechazo de formato inválido y archivos de más de 5 MB.
3. **Identidad y permisos:** prueba alta e inicio de sesión con Clerk, onboarding de tutor y proveedor, acceso administrativo solo desde correo verificado autorizado, y denegación de rutas al rol incorrecto.
4. **Datos de mascotas:** con dos tutores, confirma que cada uno solo puede consultar, editar y borrar sus mascotas. Genera un QR, comprueba los campos públicos y el consentimiento de contacto, revócalo y verifica que el enlace deje de responder.
5. **Proveedores:** guarda enlaces HTTPS válidos, intenta dominios sociales incorrectos, y confirma que cualquier edición vuelve a pendiente. El directorio debe mostrar solo perfiles aprobados y sus enlaces.
6. **Web y operación:** confirma CORS solo para los dominios previstos, rutas directas de la SPA, mensajes de error/reintento, logs sin tokens ni datos personales innecesarios, y alertas para errores 5xx o falta de salud.
7. **Recuperación y aprobación:** realiza un backup de staging y ensaya su restauración en otra base aislada. Registra evidencia y responsable para cada paso; solo promueve a producción cuando todos los P0 pasan y se aprueban el plan, los costos, la privacidad y la recuperación.

El comando de migración se ejecuta manualmente contra el destino confirmado; este documento no autoriza ni ejecuta cambios remotos. Las pruebas automatizadas locales usan dobles de Clerk y base de datos, por lo que no reemplazan esta puerta de salida.

## Datos y migraciones de cuentas

`migrate` recrea la estructura vacía de PostgreSQL; no inventa usuarios ni copia datos personales. Las cuentas de Clerk y los perfiles de aplicación están relacionados por el identificador Clerk. Al cambiar a una instancia Clerk nueva, las cuentas se registran de nuevo y los identificadores antiguos no se reasignan automáticamente.

Para trasladar una instalación que ya tenga datos reales se necesita una migración de datos separada: exportación/backup de PostgreSQL, estrategia para conservar o mapear IDs de Clerk y restauración controlada. No apuntes `migrate` a una base con datos existentes sin revisar primero su estado.

## Costos y límites

El manifiesto Render usa el plan gratuito para evitar crear recursos pagos por sorpresa. Los servicios gratuitos pueden suspenderse tras inactividad; para una API siempre activa, elige un plan Render de pago al crear o editar el servicio y revisa su precio antes de confirmar. Supabase y Vercel también aplican límites propios por plan.

## Fuentes oficiales consultadas

- [Render Blueprints](https://render.com/docs/blueprint-spec)
- [Render y monorepos](https://render.com/tutorials/advanced-blueprint-patterns/monorepos-and-build-filters)
- [Vercel: monorepos](https://vercel.com/docs/monorepos)
- [Vercel: Vite](https://vercel.com/docs/frameworks/frontend/vite)
- [Supabase: conexiones PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: Drizzle](https://supabase.com/docs/guides/database/drizzle)
- [Clerk: solicitudes autenticadas entre orígenes](https://clerk.com/docs/guides/development/making-requests)
- [Clerk Express: `clerkMiddleware`](https://clerk.com/docs/expressjs/reference/clerk-middleware)
