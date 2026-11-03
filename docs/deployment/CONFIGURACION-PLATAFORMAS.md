# Configuración de despliegue: Supabase, Render y Vercel

Este documento describe qué configurar en cada plataforma, con los valores que
el proyecto espera. Los archivos de referencia son `render.yaml`, `vercel.json`
y `.env.example`. Ningún secreto debe guardarse en el repositorio.

## Orden de creación

Supabase → Clerk → Render → Vercel → volver a Render (CORS) y Clerk (dominios).

La URL de Render se necesita en Vercel, y el dominio de Vercel se necesita en
Render. Por eso Render se crea primero y su `ALLOWED_WEB_ORIGINS` se completa al
final.

## 1. Supabase (PostgreSQL)

1. Crear el proyecto en la misma región que el servicio de Render.
2. Desactivar la Data API (Project Settings → API). La API de Express es la
   única puerta de entrada a los datos.
3. Copiar la cadena del **Session pooler** (puerto 5432). La conexión directa
   usa IPv6 y no funciona bien desde Render.
4. Aplicar el esquema desde tu equipo:

   ```bash
   export DATABASE_URL="postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
   export DATABASE_SSL=true
   pnpm --filter @workspace/db run migrate
   ```

   Debe terminar con `migrations applied successfully!`. Repetirlo no debe
   cambiar nada.

5. Verificar en Table Editor que existen `petpulse_user_profiles`,
   `petpulse_pets` y `petpulse_provider_profiles`.

Notas:
- Las contraseñas con caracteres especiales (`@`, `#`, `%`, `/`) deben
  codificarse en formato URL.
- El plan gratuito se pausa tras una semana sin actividad y no tiene copias de
  seguridad automáticas.

## 2. Clerk (autenticación)

- Usar una instancia de **desarrollo** para pruebas (`pk_test_` / `sk_test_`).
- Activar la verificación de correo. El acceso de administrador depende de un
  correo verificado.
- Copiar la publishable key y la secret key de la **misma** instancia.
- Para producción, Clerk exige un dominio propio. Las claves pasan a `pk_live_`
  y `sk_live_`, y deben cambiarse en Render y en Vercel a la vez.

## 3. Render (API)

Crear un **Blueprint** desde el repositorio de GitHub. Render leerá
`render.yaml`. Estas variables se completan en el panel de Render:

| Variable | Valor | Secreta |
| --- | --- | --- |
| `DATABASE_URL` | Session pooler de Supabase | Sí |
| `DATABASE_SSL_CA` | Certificado de la CA de Supabase (opcional, recomendado) | Sí |
| `CLERK_PUBLISHABLE_KEY` | `pk_test_...` o `pk_live_...` | No |
| `CLERK_SECRET_KEY` | `sk_test_...` o `sk_live_...` | Sí |
| `ALLOWED_WEB_ORIGINS` | Dominio exacto de Vercel, sin barra final | No |
| `PETPULSE_ADMIN_EMAILS` | Correo de administrador, verificado en Clerk | No |

Ya están fijadas en el manifiesto: `NODE_ENV=production`, `NODE_VERSION=22`,
`CLERK_AUTH_MODE=external`, `DATABASE_SSL=true` y `DATABASE_POOL_MAX=5`.

Sobre SSL:
- `DATABASE_SSL=true` sin `DATABASE_SSL_CA` cifra la conexión pero no verifica
  el certificado. Es el mínimo que suele requerir Supabase.
- Con `DATABASE_SSL_CA` la conexión se cifra y se verifica. Es la opción
  recomendada en producción.

Verificación:

```bash
curl https://pet-pulse-api.onrender.com/api/healthz      # {"status":"ok"}
curl -i https://pet-pulse-api.onrender.com/api/me        # 401 sin sesión
```

## 4. Vercel (web)

Importar el repositorio con **Root Directory** en `.`. `vercel.json` define el
instalador, el build y la carpeta de salida. En *Settings → General* fijar
**Node.js 22.x**.

Variables de entorno (Production y Preview):

| Variable | Valor |
| --- | --- |
| `VITE_API_BASE_URL` | URL de Render sin barra final |
| `VITE_CLERK_PUBLISHABLE_KEY` | La misma publishable key que Render |

Estas variables se incrustan en el build. Si cambian, hay que volver a
desplegar.

Si `VITE_API_BASE_URL` falta en un build de producción, la aplicación muestra
un error explícito. Sin esta comprobación, `vercel.json` enviaría las llamadas
a `/api` a `index.html`.

## 5. Cerrar la conexión

1. En Render, poner en `ALLOWED_WEB_ORIGINS` el dominio de Vercel y redesplegar.
2. En Clerk, añadir ese dominio a los dominios permitidos.
3. Probar el flujo completo: registro, onboarding, mascota, administrador.

## Límites de los planes gratuitos

- Render gratuito se duerme tras inactividad. La primera petición puede tardar
  entre 30 y 60 segundos.
- Supabase gratuito se pausa tras una semana sin actividad.
- Clerk de desarrollo tiene límites de usuarios y muestra un aviso visible.
- Vercel Hobby está pensado para uso no comercial.
