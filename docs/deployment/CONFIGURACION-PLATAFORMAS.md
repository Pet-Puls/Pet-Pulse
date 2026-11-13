# Configuración de despliegue: Supabase, Render y Vercel

Este documento describe qué configurar en cada plataforma, con los valores que
el proyecto espera. Los archivos de referencia son `render.yaml`, `vercel.json`
y `.env.example`. Ningún secreto debe guardarse en el repositorio.

## Separación de staging y producción

Mantener dos entornos aislados antes de probar cambios con usuarios:

| Recurso | Staging | Producción |
| --- | --- | --- |
| Rama API de Render | `thomas` | `main` |
| Base de datos Supabase | Proyecto independiente de pruebas | Proyecto productivo |
| Clerk | Instancia de desarrollo y claves `pk_test_` / `sk_test_` | Instancia productiva y claves `pk_live_` / `sk_live_` |
| Web de Vercel | Entorno Preview | Entorno Production |
| `VITE_API_BASE_URL` | URL del servicio `pet-pulse-api-staging` | URL de `pet-pulse-api` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clave de la instancia de staging | Clave de la instancia de producción |

El Blueprint de `render.yaml` declara ambos servicios. Las variables `sync: false`
se completan por separado en cada servicio de Render. En Vercel, configurar las
variables de staging exclusivamente para **Preview** y las productivas
exclusivamente para **Production**. No reutilizar la base de datos de producción
en staging ni copiar datos personales reales a las pruebas.

La rama `thomas` se usa como origen inicial del staging. Al completar la
integración de funcionalidades, cambiar la rama del servicio de staging a
`desarrollo` desde Render para que las previsualizaciones sigan la rama de
integración.

## Orden de creación

Supabase de staging → Clerk de desarrollo → Render → Vercel Preview → volver a Render (CORS) y Clerk (dominios).

La URL de Render se necesita en Vercel, y el dominio de Vercel se necesita en
Render. Por eso Render se crea primero y su `ALLOWED_WEB_ORIGINS` se completa al
final.

## 1. Supabase (PostgreSQL y fotos)

1. Crear un proyecto Supabase **separado para staging**, en la misma región
   que el servicio de Render. No conectar staging a la base productiva.
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

5. El repositorio incluye la migración `0001_pet_photos_and_qr.sql`, que añade
   rutas de fotos, tokens revocables de QR y el consentimiento para compartir
   contactos. Las migraciones `0000`–`0002` están registradas en staging.
6. Las migraciones locales `0003_provider_services_and_availability.sql`,
   `0004_gorgeous_luminals.sql` y `0005_worried_hellcat.sql` agregan servicios,
   disponibilidad, citas, outbox y preferencias de WhatsApp. Se aplicaron y
   verificaron en staging el 13 de noviembre de 2026 tras validar un respaldo
   lógico del esquema `public`. No se han aplicado en producción. La API/web con
   estos cambios aún no se han desplegado ni se han validado sus flujos en staging.
   No usar credenciales de producción para estas pruebas.
7. En **Storage**, crear el bucket privado `pet-photos` y configurar un límite
   de archivo de 5 MB y tipos permitidos `image/jpeg`, `image/png` e
   `image/webp`. No habilitar acceso público: la API valida la propiedad,
   sube los archivos y genera enlaces firmados de corta duración.
8. Copiar `SUPABASE_URL` y la clave `service_role` del proyecto. La clave
   `service_role` es secreta, omite las políticas RLS y solo se configura en
   Render; nunca en Vercel ni en el navegador.
9. Verificar en Table Editor que existen `petpulse_user_profiles`,
   `petpulse_pets`, `petpulse_provider_profiles`, `petpulse_provider_services`,
   `petpulse_provider_availability`, `petpulse_appointments` y
   `petpulse_appointment_notifications`.

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
| `DATABASE_URL` | Session pooler del proyecto correspondiente a este entorno | Sí |
| `DATABASE_SSL_CA` | Certificado de la CA de Supabase (opcional, recomendado) | Sí |
| `CLERK_PUBLISHABLE_KEY` | `pk_test_...` o `pk_live_...` | No |
| `CLERK_SECRET_KEY` | `sk_test_...` o `sk_live_...` | Sí |
| `ALLOWED_WEB_ORIGINS` | Dominio exacto de Vercel, sin barra final | No |
| `PETPULSE_ADMIN_EMAILS` | Correo de administrador, verificado en Clerk | No |
| `SUPABASE_URL` | URL del proyecto Supabase del mismo entorno | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave `service_role` del mismo proyecto | Sí |
| `SUPABASE_PET_PHOTOS_BUCKET` | `pet-photos` | No |
| `GMAIL_SMTP_USER` | Cuenta Gmail que enviará los avisos | Sí |
| `GMAIL_SMTP_APP_PASSWORD` | Contraseña de aplicación de esa cuenta Gmail | Sí |
| `GMAIL_FROM_NAME` | Nombre visible, por ejemplo `Monka` | No |

El envío de email usa Gmail SMTP solo cuando ambas variables secretas están
configuradas; sin ellas, los avisos quedan en la outbox. WhatsApp no se envía:
los avisos con teléfono y consentimiento explícito permanecen diferidos hasta
integrar un proveedor. No colocar contraseñas de aplicación en el repositorio ni
en el navegador.

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

Variables de entorno por scope:

| Variable | Preview (staging) | Production |
| --- | --- |
| `VITE_API_BASE_URL` | URL de `pet-pulse-api-staging` | URL de `pet-pulse-api` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Publishable key de Clerk de desarrollo | Publishable key de Clerk de producción |

Estas variables se incrustan en el build. Si cambian, hay que volver a
desplegar.

Si `VITE_API_BASE_URL` falta en un build de producción, la aplicación muestra
un error explícito. Sin esta comprobación, `vercel.json` enviaría las llamadas
a `/api` a `index.html`.

## 5. Cerrar la conexión

1. En Render, poner en `ALLOWED_WEB_ORIGINS` el dominio de Vercel y redesplegar.
2. En Clerk, añadir ese dominio a los dominios permitidos.
3. Probar registro, onboarding, roles, edición y foto de mascota, QR público
   con contacto desactivado y activado, revocación del QR, administración,
   directorio y flujo de citas con solicitudes simultáneas.

## Límites de los planes gratuitos

- Render gratuito se duerme tras inactividad. La primera petición puede tardar
  entre 30 y 60 segundos.
- Supabase gratuito se pausa tras una semana sin actividad.
- Clerk de desarrollo tiene límites de usuarios y muestra un aviso visible.
- Vercel Hobby está pensado para uso no comercial.
