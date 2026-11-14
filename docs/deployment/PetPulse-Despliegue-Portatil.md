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

## Aplicación instalable y tema

La web incluye un manifiesto PWA y puede instalarse desde un navegador compatible, sin tienda ni APK. En Android se utiliza el botón de instalación cuando el navegador lo ofrece o su menú; en iPhone se usa **Compartir → Agregar a pantalla de inicio**. La disponibilidad y apariencia dependen del navegador y sistema operativo.

El selector de la parte superior cambia entre tema claro y oscuro, conserva la preferencia en el navegador y actualiza el color sugerido para la barra del navegador compatible. La preferencia es local a cada navegador y dispositivo.

Una sesión activa vuelve al espacio de la cuenta al abrir las rutas de acceso o registro; el botón **Salir** cierra la sesión para usar otra cuenta. Retroceder no cierra sesión, aunque el navegador puede salir de la aplicación y Clerk puede pedir acceso de nuevo si la sesión vence o se revoca. El registro lo gestiona Clerk y, después, PetPulse solicita nombre y rol en la configuración inicial; los métodos y la verificación disponibles dependen de la configuración de esa instancia.

Los formularios integrados de Clerk usan la localización oficial en español con títulos de PetPulse. El portal alojado por Clerk y las etiquetas propias de desarrollo pueden mostrarse en otro idioma.

La aplicación necesita internet para sus operaciones. El service worker guarda únicamente una página estática de aviso sin conexión; no almacena respuestas de la API, sesiones, fotos ni páginas de usuario para uso offline. El aviso requiere que la aplicación se haya abierto con conexión al menos una vez y el service worker se haya instalado. El navegador puede eliminar su caché. El despliegue requiere HTTPS (o localhost para pruebas).

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

**Ensayos parciales de recuperación (14 de noviembre de 2026):** se restauraron por separado, en PostgreSQL 17 local dentro de un contenedor sin red, una copia antigua de `public` de staging y otra actualizada del mismo esquema. Los conteos de las tres tablas de la copia antigua y las ocho tablas de la actualizada coincidieron con sus respectivos archivos. La copia actualizada incluye citas y reportes, pero no objetos de Storage, identidades de Clerk ni el historial de migraciones de Drizzle fuera de `public`; no se ha ensayado una recuperación completa de todos los servicios. No se modificaron staging ni producción. Las copias y el contenedor contienen datos y requieren acceso restringido y una política de retención aprobada.

## Datos y migraciones de cuentas

`migrate` recrea la estructura vacía de PostgreSQL; no inventa usuarios ni copia datos personales. Las cuentas de Clerk y los perfiles de aplicación están relacionados por el identificador Clerk. Al cambiar a una instancia Clerk nueva, las cuentas se registran de nuevo y los identificadores antiguos no se reasignan automáticamente.

Para trasladar una instalación que ya tenga datos reales se necesita una migración de datos separada: exportación/backup de PostgreSQL, estrategia para conservar o mapear IDs de Clerk y restauración controlada. No apuntes `migrate` a una base con datos existentes sin revisar primero su estado.

## Recuperación integral: preparación pendiente

Esta sección es un plan preliminar, no una recuperación certificada ni autorización para crear copias, restaurar, migrar cuentas o cambiar configuración. Definir responsables, destino cifrado con acceso restringido, conservación, frecuencia y objetivos de pérdida de datos (RPO) y tiempo de recuperación (RTO) antes de operar. No guardar datos, contraseñas, tokens, claves ni hashes en el repositorio, tickets o logs compartidos.

| Componente | Necesario para recuperación | Estado |
| --- | --- | --- |
| PostgreSQL | Copia consistente de datos y estructura de la aplicación, más el historial de migraciones Drizzle correspondiente y el código de la misma versión. | `public` de staging y, por separado, `public` más historial con datos ficticios restaurados localmente; recuperación integral pendiente. |
| Fotos | Copia independiente de los objetos de `pet-photos`, sus rutas y tipos de contenido; configuración privada y políticas aplicables del bucket. | Bucket privado y restricciones comprobados en staging; ensayo limitado con una imagen ficticia en otro bucket del mismo proyecto. Recuperación integral pendiente. |
| Clerk | Estrategia aprobada para identidades, acceso y correspondencia con `clerk_user_id`; configuración de la instancia y dominios. | Exportación, recuperación y reconciliación no ensayadas. |
| Operación | Configuración de Vercel/Render, orígenes permitidos, variables y secretos de cada entorno; colas de avisos y monitoreo. | Inventario y recuperación operativa pendientes; no guardar valores secretos en esta guía. |

### Ensayo propuesto en un entorno aislado

1. **Preparar:** confirmar origen y destino, autorización, versión de código y responsables. Usar cuentas y fotos ficticias; no conectar la copia a servicios de producción ni activar Gmail o WhatsApp. Registrar fecha, zona horaria, versión y alcance de cada copia sin incluir datos personales.
2. **Base e historial:** respaldar el esquema de aplicación y los datos junto con el historial Drizzle existente, si está presente. Verificar primero su ubicación y estado en el origen: no suponer que un esquema aplicado manualmente tiene historial. Restaurar en una base aislada y comparar estructura, registros y relaciones; contrastar historial y migraciones versionadas antes de ejecutar `migrate`. Una copia que solo contiene `public` no demuestra que sea seguro volver a migrar.
3. **Fotos:** copiar los objetos mediante un mecanismo oficial de Storage a un destino protegido. El backup de PostgreSQL no contiene los archivos. Recrear un bucket privado separado con los límites y políticas revisados y restaurar mediante la API de Storage o la vía soportada por Supabase, no mediante escrituras SQL en `storage`. Conservar la ruta exacta de cada objeto y su tipo de contenido. Comparar el inventario de archivos y sus contenidos, y contrastar las rutas referenciadas por mascotas con los objetos restaurados; investigar referencias sin archivo y archivos sin referencia sin borrarlos automáticamente.
4. **Consistencia temporal:** coordinar una ventana sin escrituras de fotos y datos, o definir otro mecanismo que produzca una copia coherente. La aplicación sobrescribe la foto en la misma ruta al actualizarla: un backup de base más una copia posterior de Storage puede contener una versión diferente. Documentar la ventana y cualquier pérdida entre copias.
5. **Identidad:** para un ensayo con la misma instancia de prueba, verificar la asociación existente por ID y acceso de cuentas ficticias. Para una instancia nueva, diseñar una migración y correspondencia de IDs revisada, verificar identidad por un medio seguro y ensayarla antes de cambiar perfiles; no vincular cuentas solo por un correo coincidente. Clerk indica que no se pueden migrar usuarios de Development a Production. Una exportación de Clerk puede incluir hashes de contraseñas y exige protección reforzada; no realizarla sin autorización y plan de custodia. No asumir que exportar usuarios recupera sesiones o toda la configuración.
6. **Prueba funcional:** con el sistema aislado, comprobar inicio de sesión, propiedad de mascotas, una foto recuperada, denegación de acceso a otra cuenta, citas, reportes y QR/consentimiento. Revisar antes de habilitar tráfico las fechas de expiración, revocaciones y operaciones ocurridas después de la copia: una restauración puede devolver estados anteriores. Revisar la cola de avisos con el envío desactivado; no reenviar automáticamente mensajes que podrían haberse entregado después del respaldo.
7. **Cierre:** registrar resultados, discrepancias, tiempo real y responsables. Una muestra funcional no sustituye la comparación de inventarios. Aprobar un procedimiento de reconciliación y repetir el ensayo hasta que satisfaga los RPO/RTO definidos; únicamente entonces evaluar una recuperación real con autorización específica.

Las guías oficiales distinguen restauración de base y migración de objetos. Antes de usarlas, revisar permisos, plan, costos y alcance del entorno. No ejecutar una restauración sobre staging o producción como parte de este ensayo.

**Ensayo del historial Drizzle (14 de noviembre de 2026):** una consulta de solo lectura en staging encontró siete registros en `drizzle.__drizzle_migrations`; sus fechas y hashes coincidieron con las siete migraciones versionadas. En PostgreSQL 17 local se respaldaron y restauraron juntos `public` y `drizzle` desde una base con un perfil y una mascota ficticios. El primer intento se detuvo porque la base destino ya tenía el esquema `public`; en una segunda base nueva se excluyó solo la creación duplicada de ese esquema y la restauración terminó sin errores. Después de ejecutar `migrate` en la copia restaurada, quedaron siete registros de historial, un perfil y una mascota; el resumen de IDs, hashes y fechas del historial coincidió con el origen ficticio. Se conservaron ambas bases locales y el contenedor quedó detenido. No se restauró el historial real de staging ni se verificó la recuperación integral.

**Ensayo limitado de Storage (14 de noviembre de 2026):** con autorización se creó en `petpulse-staging` el bucket separado `pet-photos-recovery-qa-20261114`, privado y con límite de 5 MB y tipos JPEG, PNG y WebP. Se subió un PNG ficticio de un píxel, se descargó desde el panel y se volvió a subir al mismo bucket con otro nombre; el archivo recuperado se descargó de nuevo y sus bytes coincidieron con el original mediante SHA-256. Una solicitud anónima a su URL pública fue rechazada. Se conservaron el bucket y los archivos de prueba. No se copiaron fotos existentes ni se verificaron rutas originales, integración con la aplicación, otro proyecto o recuperación integral; esta prueba no sustituye un respaldo externo coordinado ni una restauración completa.

### Preparación específica para recuperar identidades Clerk

**Pendiente de decisión y ensayo:** una restauración de PostgreSQL no restaura cuentas Clerk. Distinguir la recuperación de la base con la instancia original disponible de una pérdida o sustitución de esa instancia. En el primer caso, comprobar que el ID de Clerk sigue correspondiendo al perfil correcto. En el segundo, consultar con Clerk las opciones efectivamente disponibles para la instancia y plan contratado; no asumir que se pueden recuperar identificadores, sesiones, métodos de acceso o configuración.

La API busca `petpulse_user_profiles.clerk_user_id` y `/api/me` crea un perfil nuevo cuando no encuentra ese ID. Por tanto, si una identidad vuelve con otro ID, iniciar sesión antes de reconciliar puede crear un perfil adicional y no recuperar las mascotas o citas anteriores. Antes de habilitar tráfico, preparar una correspondencia uno a uno revisada entre el ID antiguo, el nuevo y el perfil interno; detenerse ante duplicados, ausencias o identidad no verificada. No enlazar solo por correo ni modificar perfiles sin autorización, respaldo y un procedimiento ensayado.

Para un ensayo posterior, usar una instancia y una base **de pruebas aisladas**, cuentas y datos ficticios y avisos desactivados. Verificar inicio de sesión, propiedad de datos y denegación entre cuentas, configuración de roles y administración, y cómo se tratan contraseñas, proveedores externos y sesiones. Revisar también solicitudes de eliminación o revocaciones posteriores al respaldo para no reactivar cuentas o permisos indebidamente. Registrar resultados y limitaciones antes de diseñar una recuperación real.

**Simulación local (14 de noviembre de 2026):** pruebas de la API con Clerk y base de datos simulados comprobaron que el mismo ID reutiliza el perfil y que un ID nuevo con el mismo correo crea otro perfil, sin acceder a las mascotas del anterior. No se conectaron cuentas reales, no se ensayó la recuperación de Clerk ni se probó una reconciliación de identidades.

**Ensayo aislado con Clerk real (14 de noviembre de 2026):** se creó la aplicación separada `PetPulse QA Recuperacion` en el espacio Hobby, con una instancia de desarrollo y dos usuarios ficticios con direcciones `+clerk_test@example.com`. Se confirmó el modo de prueba; según [Clerk](https://clerk.com/docs/guides/development/testing/test-emails-and-phones), esas direcciones no reciben mensajes en ese modo. La web y API locales se conectaron a esta instancia y a la base aislada `petpulse_clerk_qa`, sin Storage ni avisos configurados. La API rechazó una petición anónima con 401. Una cuenta inició sesión, completó su perfil y creó una mascota ficticia; tras cerrar sesión y volver a entrar, aparecieron el mismo perfil y mascota, sin duplicados. La segunda cuenta, con otro ID y otro correo, completó su perfil: su listado de mascotas respondió 200 con cero elementos y un intento de modificar la mascota ajena respondió 404. La mascota original permaneció intacta.

Se respaldaron `public` y `drizzle` de esa base ficticia y se restauraron en otra base local nueva. En origen y destino se comprobaron dos perfiles con IDs Clerk distintos, una mascota vinculada al perfil original y siete migraciones con el mismo resumen de hashes y fechas. La aplicación no se conectó a la copia restaurada, por lo que este ensayo no demuestra inicio de sesión sobre ella. Tampoco prueba recuperación o reconciliación de otra instancia Clerk, correos coincidentes reales, sesiones, fotos o recuperación integral. Se conservaron las dos bases, el respaldo y las cuentas ficticias; no usar sus correos verificados como prueba de propiedad.

La creación de usuarios mediante la API de Clerk verifica automáticamente correos y teléfonos por defecto; no considerar una importación como prueba de control del correo. En PetPulse, un correo principal verificado que coincida con `PETPULSE_ADMIN_EMAILS` puede obtener acceso administrador: restringir esa configuración y probar la recuperación con privilegios mínimos. Una exportación puede contener hashes y datos personales, por lo que su creación, custodia, acceso y eliminación requieren aprobación y controles específicos; no compartir ni versionar el archivo.

## Solicitudes manuales de datos y cuenta

Para el lanzamiento inicial se eligió una gestión manual supervisada de exportación y eliminación. **Todavía no está lista para producción:** antes deben aprobarse la política de privacidad, la jurisdicción, las obligaciones de conservación, los plazos, el canal de solicitud, los responsables y un procedimiento ensayado en staging. No hay autoservicio implementado y esta guía no autoriza eliminar datos.

1. Recibir la solicitud por el canal aprobado, verificar la identidad y el alcance sin pedir contraseñas ni códigos, y registrar un caso con acceso restringido. No prometer plazos ni eliminación inmediata antes de aprobar la política aplicable.
2. Confirmar expresamente el entorno y relacionar el identificador de Clerk con el perfil interno correcto. Inventariar, según el rol y la solicitud: perfil y preferencias, mascotas y contacto de emergencia, fotos en Storage, QR, reportes de pérdida, perfil y recursos de proveedor, citas y avisos. Revisar también Clerk, registros, respaldos y proveedores externos cuando corresponda.
3. Para una exportación, preparar únicamente los datos autorizados de la persona solicitante; revisar las citas compartidas para evitar revelar información de terceros. Excluir secretos, tokens QR y enlaces firmados activos. Acordar un medio de entrega seguro y la eliminación de copias temporales según la política aprobada.
4. Antes de eliminar o anonimizar, revisar citas pendientes, comunicaciones en cola, datos compartidos y obligaciones de conservación. Definir qué hacer con cada conjunto de datos y obtener la aprobación del responsable; detener el proceso si no está claro. Las referencias en la base incluyen eliminaciones en cascada que pueden afectar citas y avisos de otros participantes: no borrar un perfil sin evaluar ese impacto.
5. Ensayar el procedimiento aprobado con datos ficticios en un entorno aislado y verificar una restauración de respaldo. Diseñar y verificar por separado el tratamiento de los objetos de Storage, la identidad de Clerk y los datos de PostgreSQL: una transacción de base de datos no cubre todos esos servicios. Considerar copias de seguridad, registros y servicios externos sin afirmar su eliminación inmediata.
6. Tras la ejecución autorizada, verificar cada sistema, documentar excepciones o fallos y comunicar el resultado por el canal seguro. Conservar solo la evidencia mínima conforme a la política aprobada.

### Inventario preliminar para definir la política

| Datos | Ubicación y consideración | Decisión pendiente |
| --- | --- | --- |
| Identidad, correo, teléfono y preferencias | Clerk y `petpulse_user_profiles`; el perfil interno referencia el ID de Clerk. | Finalidad, acceso, retención y tratamiento de ambas copias. |
| Mascotas, contacto y QR | `petpulse_pets` y fotos privadas en Storage; QR y enlaces firmados son credenciales de acceso, no adjuntos para exportación. | Alcance de exportación, revocación y tratamiento de archivos y respaldos. |
| Reportes de pérdida | `petpulse_lost_pet_reports`: descripción de ubicación, notas, consentimiento, estado y vencimiento. El vencimiento no equivale por sí solo a eliminación. | Plazo y tratamiento de reportes cerrados o vencidos y de su información de ubicación. |
| Proveedores | `petpulse_provider_profiles`, servicios y disponibilidad; pueden contener datos de contacto y ubicación. | Tratamiento de información publicada y conservación tras solicitudes de cuenta. |
| Citas y avisos | `petpulse_appointments` y `petpulse_appointment_notifications`; pueden involucrar a varias personas y contener destinos y mensajes. | Protección de terceros, citas futuras, obligaciones de conservación y tratamiento de mensajes en cola. |
| Respaldos y registros | Copias de PostgreSQL, objetos, exportaciones de identidad y logs de plataformas. | Acceso, cifrado, plazos, restauración y tratamiento de solicitudes sin prometer borrado inmediato de cada copia. |

Para cada fila debe aprobarse una finalidad, responsable, base aplicable, período o criterio de retención, procedimiento de acceso/exportación y tratamiento de solicitudes y excepciones. El equipo responsable debe validar jurisdicción y obligaciones legales; esta tabla no sustituye asesoría jurídica ni una política pública.

## Costos y límites

El manifiesto Render usa el plan gratuito para evitar crear recursos pagos por sorpresa. Los servicios gratuitos pueden suspenderse tras inactividad; para una API siempre activa, elige un plan Render de pago al crear o editar el servicio y revisa su precio antes de confirmar. Supabase y Vercel también aplican límites propios por plan.

## Fuentes oficiales consultadas

- [Render Blueprints](https://render.com/docs/blueprint-spec)
- [Render y monorepos](https://render.com/tutorials/advanced-blueprint-patterns/monorepos-and-build-filters)
- [Vercel: monorepos](https://vercel.com/docs/monorepos)
- [Vercel: Vite](https://vercel.com/docs/frameworks/frontend/vite)
- [Supabase: conexiones PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: Drizzle](https://supabase.com/docs/guides/database/drizzle)
- [Supabase: respaldos y límites de Storage](https://supabase.com/docs/guides/platform/backups)
- [Supabase: descarga de objetos](https://supabase.com/docs/guides/storage/management/download-objects)
- [Supabase: esquema de Storage](https://supabase.com/docs/guides/storage/schema/design)
- [Clerk: migración y exportación de usuarios](https://clerk.com/docs/guides/development/migrating/overview)
- [Clerk: creación de usuarios y estado de verificación](https://clerk.com/docs/reference/backend/user/create-user)
- [Clerk: solicitudes autenticadas entre orígenes](https://clerk.com/docs/guides/development/making-requests)
- [Clerk Express: `clerkMiddleware`](https://clerk.com/docs/expressjs/reference/clerk-middleware)
