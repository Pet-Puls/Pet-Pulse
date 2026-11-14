# Análisis de calidad, requisitos y roadmap de PetPulse

**Fecha del análisis:** 13 de noviembre de 2026\
**Base revisada:** rama local `thomas`, commit publicado `7dfc5a6` más cambios locales sin commit.\
**Alcance:** lectura del monorepo, configuración de workspace, documentación, rutas API y modelo de datos. Este documento es una evaluación de ingeniería; no es una auditoría de seguridad ni certifica un despliegue productivo.

## 1. Resumen ejecutivo

PetPulse es un monorepo pnpm con una SPA, una API y librerías compartidas de contratos y persistencia. La base actual ya tiene autenticación Clerk, roles, perfiles, mascotas y proveedores con PostgreSQL; el mapa consulta servicios externos. Servicios, disponibilidad y el primer flujo de citas están desplegados y parcialmente probados en staging; la demostración (`/demo`) conserva datos simulados separados de los flujos conectados a la API.

Las fotos privadas y fichas QR revocables se probaron en staging con datos ficticios; el flujo firmado funcionó y el acceso público sin firma falló. El 14 de noviembre de 2026 se inspeccionó el bucket de staging en Supabase: la opción pública estaba desactivada, con límite de 5 MB y tipos JPEG, PNG y WebP. Estas pruebas no certifican producción.

La puerta de privacidad se probó en staging. Las migraciones `0003`–`0006` se aplicaron y verificaron allí el 13 de noviembre de 2026; no se aplicaron en producción. La migración `0006` añade el almacenamiento de reportes de mascotas perdidas y está registrada en el historial de Drizzle.

## 2. Estado actual y arquitectura

| Capa       | Implementado o configurado                                               | Límite conocido                                                                                   |
| ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Web        | React, TypeScript, Vite, Wouter, cliente de API generado                 | Las rutas `/demo` siguen siendo demostrativas; autenticación real necesita las claves del entorno |
| API        | Express, Clerk, validación Zod desde OpenAPI; smoke de rutas con Clerk/DB simulados | Integración real Clerk/DB/Storage y más permisos/rutas requieren pruebas adicionales       |
| Datos      | PostgreSQL, Drizzle; perfiles de usuario, mascotas, proveedores, servicios, disponibilidad, citas y outbox | `0003`–`0006` aplicadas y verificadas en staging; no en producción; faltan validaciones integrales y de recuperación |
| Archivos   | Integración de API con Supabase Storage para fotos     | Flujo firmado y configuración privada del bucket comprobados en staging; faltan pruebas adicionales por cuenta |
| Contratos  | OpenAPI como fuente y clientes/tipos generados                           | Se necesita una comprobación CI de que los artefactos generados estén sincronizados               |
| Mapa       | Leaflet, teselas OpenStreetMap y lugares sugeridos mediante Photon; reporte de correcciones a OSM | Los lugares externos no están verificados por PetPulse; no hay pines de proveedores en el mapa |
| Despliegue | Vercel (web), Render (API), Supabase (datos/archivos), Clerk (identidad) | Staging desplegado y parcialmente probado; no certifica producción ni la puerta completa de salida |
| CI/pruebas | CI en Windows/Linux; pruebas del cliente y smoke API de autenticación/propiedad, typecheck y build | Aún faltan integración real y pruebas de navegador                                    |

### Capacidades reales frente a demostración

- **Base de aplicación:** cuenta, roles, perfiles de mascota y proveedor; revisión administrativa de proveedores.
- **Mascotas:** edición, foto privada, QR limitado, consentimiento y revocación están implementados y se probaron en staging con datos ficticios; la configuración privada del bucket se confirmó en Supabase.
- **Directorio público:** consulta perfiles aprobados, servicios activos y disponibilidad desde la API, con búsqueda, filtro, paginación y enlaces HTTPS opcionales; requiere API y base de datos disponibles.
- **Demostración, no operación real:** la ruta `/demo` conserva alertas de pérdida, métricas y movimientos simulados. El espacio autenticado ya incluye reportes persistentes de mascotas perdidas; el código y la migración están desplegados en staging. Con cuentas QA se verificaron creación, visibilidad desde otro miembro, vencimiento, renovación y cierre de reportes ficticios. Para acelerar la prueba, el 14 de noviembre de 2026 se ajustó manualmente el vencimiento de un reporte a las 11:00 a. m. (Colombia); esto no prueba una espera natural de 72 horas. Los miembros autenticados con perfil ven los reportes activos sin filtro por zona.
- **Mapa:** muestra sugerencias externas de OpenStreetMap/Photon, señaladas como no verificadas y con enlace para reportar correcciones a OSM. Aún no representa ubicaciones de proveedores verificadas por PetPulse. La ubicación del navegador corresponde a la persona usuaria y no rastrea a una mascota.

Los perfiles de proveedor aceptan sitio web, Instagram, Facebook y WhatsApp opcionales. Se exige HTTPS y se valida que los enlaces sociales correspondan al dominio de su red. Los cambios al perfil regresan al estado pendiente de revisión; el directorio público solo lista perfiles aprobados. La migración `0002_provider_social_links.sql` se aplicó en staging. Servicios y disponibilidad permiten configuración aunque el proveedor esté pendiente, pero solo se publican para perfiles aprobados.

La API desplegada en staging rechaza el nombre de la cuenta, el nombre y la especie de mascota y el nombre comercial y barrio del proveedor si contienen únicamente espacios; se recortan antes de guardarse. La revisión de los demás campos sigue pendiente y las pruebas con datos simulados no sustituyen la comprobación en staging.

El 14 de noviembre de 2026 se comprobó en staging la configuración de registro público de Clerk con verificación de correo; el usuario confirmó que registró una cuenta, verificó su correo y abrió su espacio. En la PWA de Android también confirmó navegación, retroceso y reapertura de sesión. El despliegue de la API se verificó en Render para el commit `60f20c6`. Estos ensayos no sustituyen pruebas completas por rol ni la preparación de una instancia de producción.

La validación local de reportes exige una fecha y hora existentes en formato ISO 8601 con zona horaria al crear o renovar; rechaza valores nulos, numéricos o fechas imposibles antes de guardarlos. Se mantiene la comprobación de que la fecha no sea futura.

El esquema local ya incluye catálogo de servicios, disponibilidad semanal/excepciones, citas, preferencias de WhatsApp y outbox. Las migraciones `0003_provider_services_and_availability.sql`, `0004_gorgeous_luminals.sql` y `0005_worried_hellcat.sql` se aplicaron y verificaron en staging el 13 de noviembre de 2026; no se han aplicado en producción. Los avisos automáticos de WhatsApp se retiraron del alcance; los registros diferidos anteriores se conservan sin envío y no se crean nuevos. Los enlaces de contacto de proveedores permanecen disponibles. El correo necesita una alternativa compatible con Render Free, que bloquea SMTP.

## 3. Hallazgos de ingeniería y acciones

| Prioridad                | Hallazgo                                                                                                                             | Efecto                                                                                        | Acción                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| P0, corregido localmente | `preinstall` invocaba `sh`, y los overrides excluían los paquetes nativos de Windows para Rollup, esbuild, Lightning CSS y Tailwind. | La instalación/build en Windows fallaba, incluido el caso reportado de Rollup.                | El `preinstall` ahora usa Node portable y se conservan los binarios de Windows; el workflow valida Windows y Linux.  |
| P0, corregido localmente | El build de `mockup-sandbox` exigía `PORT` y `BASE_PATH` aunque no se proporcionaran.                                                | El build general fallaba en un checkout sin variables específicas de Replit.                  | Se añadieron valores predeterminados seguros para desarrollo/build y se conserva la validación del puerto explícito. |
| P0, nuevo                | No existía un workflow CI.                                                                                                           | Los cambios podían mezclarse sin comprobar instalación, tipos o compilación.                  | Se añade `.github/workflows/ci.yml`; su ejecución remota empieza al publicar la rama o crear un PR.                  |
| P1                       | La cobertura automatizada aún no alcanza todas las rutas, operaciones QR/foto ni recorridos de navegador.                           | El smoke HTTP usa Clerk y consultas de datos simulados; no valida servicios reales, Storage ni todos los controles de acceso. | Ampliar por etapas con pruebas de rutas, integración aislada y E2E; no reportar el build como sustituto.           |
| P1                       | Faltan snapshots de Drizzle para las migraciones 0001 y 0002.                                                                          | La generación de 0003 repitió columnas anteriores y requirió retirar del SQL los cambios ya migrados. | Establecer una línea base y ensayar migración desde base vacía y desde una versión existente.                   |
| P1                       | El entorno real requiere credenciales y servicios externos, que no están disponibles en CI.                                          | No se han verificado Clerk, Supabase Storage ni aislamiento de staging de extremo a extremo.  | Mantener CI sin secretos y hacer pruebas de integración solo en staging aislado.                                     |
| P2                       | La demo y las métricas administrativas siguen siendo simuladas; servicios y citas tienen validación parcial en staging.            | Algunas vistas continúan fuera de los flujos persistentes y las pruebas no certifican producción.             | Mantener separada la demo y completar las pruebas de integración pendientes antes de producción.               |
| P2                       | El mapa depende de servicios públicos de teselas/geocodificación/lugares.                                                            | Disponibilidad, límites y condiciones de uso pueden impedir una operación confiable a escala. | Revisar políticas, límites y proveedor antes de lanzamiento con tráfico relevante.                                   |
| P3                       | No existe todavía un caso de uso de ciencia de datos/ML implementado.                                                                | Métricas simuladas no equivalen a analítica real ni justifican entrenamiento de modelos.      | Priorizar calidad, consentimiento y métricas agregadas; evaluar ML solo con una necesidad demostrada.                |

## 4. Integración continua propuesta

El workflow ejecuta en cada `push`, `pull_request` y manualmente:

1. Instala pnpm 10.34.9 y Node.js 22.
2. Instala con `pnpm install --frozen-lockfile`.
3. Ejecuta `pnpm run test` para las suites unitarias declaradas en cada paquete.
4. Ejecuta `pnpm run build`, que primero ejecuta el typecheck de librerías y paquetes y luego compila los paquetes del workspace.
5. Repite el proceso en Ubuntu y Windows para detectar incompatibilidades por sistema operativo.

No necesita secretos, no publica artefactos y tiene permiso de solo lectura al repositorio. Las suites cubren serialización/validación/errores del directorio y smoke HTTP de 401/403/200 para autenticación, onboarding y roles, promoción administrativa con correo verificado, además de aislamiento del listado de mascotas por propietario. Clerk y las consultas de datos son dobles de prueba, no servicios reales. El workflow solo tendrá resultados visibles en GitHub después de que una persona con permiso publique estos cambios.

## 5. Plan de pruebas y casos de uso

### Niveles recomendados

1. **Contrato y unidad:** validaciones, transformaciones, límites, token QR y compatibilidad OpenAPI.
2. **Integración API/DB/Storage:** rutas, identidad, propiedad de recursos, migraciones y errores de proveedores externos.
3. **E2E web:** recorridos por rol en un entorno de prueba, sin datos reales.
4. **No funcionales:** accesibilidad, tamaños de pantalla, rendimiento, recuperación y observabilidad.
5. **CI actual:** typecheck/build en Windows y Linux; ampliar la compuerta a las suites anteriores cuando existan.

### Casos mínimos de aceptación

| ID    | Caso                                                                                    | Resultado esperado                                                                                               | Prioridad |
| ----- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| TC-01 | Tutor crea, consulta y edita su mascota                                                 | La API persiste los cambios y la lista refleja el perfil actualizado                                             | P1        |
| TC-02 | Una cuenta intenta consultar/modificar una mascota ajena                                | Respuesta denegada/no encontrada; ningún dato del otro tutor se filtra                                           | P0        |
| TC-03 | Subir una foto JPEG, PNG o WebP válida; intentar MIME/firma inválida o superar 5 MB     | La imagen válida queda privada y se obtiene URL temporal; entradas inválidas se rechazan con error claro         | P0        |
| TC-04 | Generar, abrir y revocar un QR                                                          | El token es opaco; el perfil público solo contiene campos permitidos; el enlace deja de funcionar tras revocarlo | P0        |
| TC-05 | Consentimiento de contacto desactivado y activado                                       | El teléfono nunca se muestra sin consentimiento y solo se publica al activarlo explícitamente                    | P0        |
| TC-06 | Proveedor o tutor llama a una acción administrativa                                     | Solo el rol administrador autorizado puede completarla                                                           | P0        |
| TC-07 | Aplicar migraciones en una base vacía y repetirlas en la ya migrada                     | Esquema esperado y proceso repetible sin pérdida de datos                                                        | P0        |
| TC-08 | Registro/inicio de sesión Clerk y onboarding por rol en staging                         | La sesión llega a la API; el rol y propiedad se aplican en servidor                                              | P0        |
| TC-09 | Ubicación del navegador denegada, dirección manual y proveedor de lugares no disponible | La búsqueda manual funciona; no se finge GPS de mascota y se informa el fallo externo                            | P1        |
| TC-10 | Navegación con teclado y pantalla móvil                                                 | Foco visible, etiquetas, errores comprensibles y controles utilizables                                           | P1        |
| TC-11 | `pnpm install --frozen-lockfile` y build en Windows/Linux                               | Ambas plataformas instalan dependencias y compilan con lockfile sin cambios                                      | P0        |
| TC-12 | Solicitud concurrente, propuesta/aceptación de cambio, cancelación y avisos de cita     | Una sola reserva por intervalo; solo participantes ejecutan transiciones permitidas; email queda trazable y no se generan avisos automáticos de WhatsApp | P0 |

No ejecutar TC-07 ni otras pruebas destructivas contra producción. Usar bases de datos efímeras o staging aislado.

### Evidencia de humo local (13 de noviembre de 2026)

- Se añadieron **3 pruebas unitarias** del cliente del directorio y se ejecutaron con `pnpm run test`: serialización de filtros, omisión del token en consultas públicas, rechazo de respuestas inválidas y propagación de errores HTTP. El flujo CI ahora las ejecuta antes del build.
- Se añadieron **7 pruebas HTTP de API** con dobles de prueba: ausencia de sesión, onboarding incompleto, rol incorrecto, acceso owner permitido, listado limitado a las mascotas del tutor, y promoción a admin solo con correo configurado y verificado (incluida denegación si no está verificado).
- La suite del API suma **19 pruebas** con dobles de prueba: incluye permisos y propiedad para servicios, rechazo de horarios superpuestos, persistencia de varios tramos y excepciones, y publicación de servicios/horarios solo para perfiles aprobados. Esto cubre regresiones locales, pero no sustituye la integración real con Clerk, PostgreSQL ni Storage.
- En el preview de producción local, la búsqueda del directorio consultó el endpoint mediante respuestas de API simuladas. El resultado filtrado apareció en **314 ms** desde que se ingresó el término; esto verifica el debounce y el renderizado de la interfaz, no la latencia real de API, base de datos o red.
- También se comprobó el estado sin resultados, el filtro por categoría, la paginación (13 elementos, 12 por página) y la recuperación tras dos respuestas `503`: se mostró el error con la acción **Reintentar** y la tercera solicitud simulada cargó el resultado.
- En una pantalla de **390 × 844**, la ficha pública mostró el estado perdido cuando correspondía, ocultó el contacto si no se había autorizado/proporcionado y mostró el contacto cuando la respuesta lo incluía. No se observó desbordamiento horizontal.
- Estas pruebas no validan autenticación real, permisos, persistencia, Storage ni revocación del QR. Clerk no pudo cargar sin la configuración de entorno; esos flujos siguen requiriendo staging aislado.
- La medición es una comprobación manual de laboratorio, no Core Web Vitals de usuarios reales. No hay RUM ni evidencia de rendimiento en producción.
- La guía de despliegue incluye una puerta de salida de staging con pasos de migración, aislamiento de fotos, roles, QR, proveedores, observabilidad y restauración. En ese momento se había verificado el respaldo lógico de `public` y las migraciones `0003`–`0005`; posteriormente se desplegó el código, se aplicó `0006`, se probaron parcialmente los flujos y se confirmó la configuración del bucket. La restauración de `public` se ensayó en local; falta cubrir los demás servicios e historial de migraciones.

### Evidencia de staging (13–14 de noviembre de 2026)

- Un proveedor QA creó un servicio y un horario semanal, visibles en el directorio. Un tutor solicitó citas: se rechazaron un solapamiento (HTTP 409) y un horario fuera de disponibilidad (HTTP 400); el proveedor confirmó una cita y rechazó otra, propuso un cambio que el tutor aceptó y luego la cita se canceló. No se verificó concurrencia real ni entrega de avisos.
- Con la mascota QA se creó y cerró un reporte ficticio. Se creó otro y se confirmó que otra cuenta lo veía como reporte comunitario, sin controles de administración. Tras adelantar manualmente su vencimiento a las 11:00 a. m., dejó de mostrarse a la otra cuenta, apareció como vencido al tutor y se renovó con nuevo consentimiento y vencimiento de 72 horas mostrado. Después se cerró y se comprobó su estado tras recargar. No se esperaron 72 horas naturales.
- Tras publicar la corrección, una cuenta tutora de staging sin mascotas mostró el estado «Primero agrega una mascota» y los reportes de la comunidad, sin el `0` suelto.
- En el panel de Supabase de `petpulse-staging` se comprobó que `pet-photos` no es público, tiene un límite de 5 MB y admite JPEG, PNG y WebP; no se modificó su configuración.
- En un bucket privado separado del mismo proyecto de staging se subió y descargó una imagen ficticia, se volvió a subir con otro nombre y se descargó de nuevo: los hashes SHA-256 coincidieron y su URL pública rechazó acceso anónimo. No se ensayó la recuperación de fotos existentes, rutas originales ni integración de la aplicación.
- Se restauraron copias antigua y actualizada de `public` de staging en bases PostgreSQL 17 locales y aisladas; los conteos de sus tres y ocho tablas, respectivamente, coincidieron con los archivos. La copia actual incluye citas y reportes, pero no Storage, Clerk ni el historial Drizzle fuera de `public`; falta ensayar la recuperación completa de todos los servicios.
- En PostgreSQL 17 local se aplicaron las siete migraciones desde una base vacía y se repitió el comando sin duplicar registros. En otra base local se aplicaron primero `0000`–`0002`, se insertaron un perfil y una mascota ficticios y se migró hasta `0006`; ambos registros se conservaron. No se modificó producción.
- Se comprobó en solo lectura que los siete registros Drizzle de staging coinciden en fecha y hash con las migraciones versionadas. Con datos ficticios, una restauración local conjunta de `public` y `drizzle` conservó el historial, un perfil y una mascota; repetir `migrate` no duplicó registros. El primer intento falló porque `public` ya existía en el destino y se repitió en otra base nueva excluyendo su creación duplicada. El historial real de staging no se restauró.
- Una prueba de integración local envió dos solicitudes simultáneas al mismo horario contra PostgreSQL real: ambas esperaron el bloqueo del proveedor y recibieron HTTP 201 y 409; quedó una sola cita. Clerk se simuló y no se probaron notificaciones externas ni concurrencia en staging. La prueba requiere una base local `petpulse_test` y la variable explícita `PETPULSE_INTEGRATION_DATABASE_URL`; sin ella se omite.

## 6. Requisitos funcionales (RF)

El documento maestro contiene una especificación de producto más amplia. Esta tabla separa lo que la base soporta de lo proyectado.

| ID    | Requisito                                                                | Estado                                                                |
| ----- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| RF-01 | Autenticar cuentas mediante Clerk y asociar un perfil interno            | Base implementada; verificar inicio de sesión con entorno configurado |
| RF-02 | Aplicar roles y propiedad de datos en el servidor                        | Implementado en rutas existentes; falta suite de pruebas sistemática  |
| RF-03 | Crear, listar y editar perfiles de mascota                               | API implementada                                                      |
| RF-04 | Cargar foto privada con formatos y límite definidos                      | Implementado; flujo y configuración privada del bucket verificados en staging con datos ficticios |
| RF-05 | Generar/revocar QR limitado y compartir contacto solo con consentimiento | Implementado y probado en staging con datos ficticios; sin certificación de producción |
| RF-06 | Crear perfil de proveedor, incluir enlaces HTTPS opcionales y permitir revisión administrativa | Implementado y probado; migración de enlaces aplicada en staging |
| RF-07 | Consultar lugares cercanos y zona en el mapa                             | Implementado con datos externos claramente indicados como no verificados; permite reportar en OSM |
| RF-08 | Gestionar servicios y disponibilidad de proveedor                        | Desplegado en staging; servicio y horario semanal probados con datos ficticios; faltan otras variantes del flujo |
| RF-09 | Solicitar y gestionar citas con prevención de dobles reservas            | Desplegado y parcialmente probado en staging; concurrencia con PostgreSQL real probada en local; faltan más escenarios integrados y avisos |
| RF-10 | Reportar y cerrar una mascota perdida con ubicación compartida temporal  | Desplegado y probado en staging con datos ficticios; vencimiento adelantado manualmente para probar renovación y cierre, sin esperar 72 horas naturales |
| RF-11 | Registrar historial de salud y recordatorios                             | Pendiente; no debe interpretarse como diagnóstico                     |
| RF-12 | Gestionar notificaciones y estado de entrega                             | Correo pendiente de integración compatible con Render Free; avisos automáticos de WhatsApp fuera del alcance |
| RF-13 | Eliminar/exportar cuenta y aplicar retención definida                    | Gestión manual supervisada elegida para el lanzamiento inicial; faltan política, responsables y ensayo en staging |
| RF-14 | Mostrar analítica administrativa calculada de datos reales y agregados   | Pendiente; las métricas actuales de demo no son analítica operativa   |

## 7. Historias de usuario (HU) y backlog de issues proyectados

Los siguientes issues son propuestas para crear en GitHub cuando haya acceso. **No han sido creados**. Orden sugerido:

### P0 — Bloqueantes para integrar y desplegar con seguridad

**ISSUE-01 — Mantener instalación y compilación reproducibles en Windows y Linux**\
**HU:** Como integrante del equipo, quiero instalar y compilar en mi sistema operativo para contribuir sin pasos manuales específicos.\
**RF/RNF:** RF-01–RF-07; RNF-01 portabilidad, RNF-02 reproducibilidad.\
**Criterios:** pnpm con lockfile; `preinstall` portable; CI verde en Ubuntu y Windows. El código local ya aborda este issue; falta resultado remoto.

**ISSUE-02 — Validar staging aislado para perfiles, foto y QR**\
**HU:** Como tutor de pruebas, quiero verificar mis datos en un entorno separado para que una prueba no afecte producción.\
**RF/RNF:** RF-03–RF-05; RNF-03 aislamiento y privacidad.\
**Criterios:** Supabase y Clerk de desarrollo independientes; migración aplicada a staging; bucket privado con formatos/tamaño restringidos; operaciones de foto, consentimiento, token y revocación verificadas; no se comparte ninguna clave secreta con el navegador.

**ISSUE-03 — Probar autorización y aislamiento entre roles y propietarios**\
**HU:** Como usuario, quiero que solo personas autorizadas vean o cambien mis recursos.\
**RF/RNF:** RF-02, RF-06; RNF-03 seguridad.\
**Criterios:** pruebas para tutor, proveedor, administrador, usuario anónimo y propietario distinto; se verifican respuestas y ausencia de filtración de datos.

**ISSUE-04 — Establecer línea base y ensayo de migraciones de base de datos**\
**HU:** Como responsable de despliegue, quiero migraciones revisables y repetibles para actualizar ambientes sin perder datos.\
**RF/RNF:** RF-03–RF-06; RNF-02 y RNF-04 fiabilidad.\
**Criterios:** definir baseline Drizzle; aplicar desde base vacía y desde la versión vigente en una DB efímera; documentar rollback/recuperación y nunca aplicar automáticamente a producción desde CI.

### P1 — Calidad funcional y preparación operativa

**ISSUE-05 — Añadir pruebas de contrato y API para mascotas, proveedores y QR**\
**HU:** Como equipo, queremos detectar regresiones en permisos, validación y privacidad antes de integrar.\
**RF/RNF:** RF-01–RF-06; RNF-03 seguridad, RNF-05 mantenibilidad.\
**Criterios:** cubrir TC-01 a TC-08; ejecutar en CI sin secretos de producción.

**ISSUE-06 — Comprobar que los clientes generados coincidan con OpenAPI**\
**HU:** Como integrante del equipo, quiero detectar contratos o clientes generados desactualizados antes de integrar cambios de API.\
**RF/RNF:** RF-01–RF-07; RNF-02 mantenibilidad y RNF-05 calidad.\
**Criterios:** ejecutar la generación desde el contrato OpenAPI en CI y fallar si deja cambios sin confirmar en los artefactos generados; documentar un comando reproducible para actualizar dichos artefactos.

**ISSUE-07 — Añadir recorridos E2E de web por rol**\
**HU:** Como tutor/proveedor/administrador, quiero completar mis recorridos principales de extremo a extremo.\
**RF/RNF:** RF-01–RF-07; RNF-06 usabilidad/accesibilidad.\
**Criterios:** datos de prueba aislados; flujos de onboarding, mascotas, consentimiento y QR; captura útil de fallos; no depender de usuarios personales.

**ISSUE-08 — Definir eliminación, retención, exportación y restauración de cuentas**\
**HU:** Como usuario, quiero controlar y recuperar mis datos según reglas transparentes.\
**RF/RNF:** RF-13; RNF-03 privacidad y RNF-04 continuidad.\
**Criterios:** política aprobada; eliminación/anonimización documentada; backup y restauración probados en entorno no productivo. Para el lanzamiento inicial se eligió un proceso manual supervisado; su guía preliminar no autoriza eliminar datos y requiere aprobar política y ensayar el procedimiento.

**ISSUE-09 — Completar accesibilidad, estados de error y funcionamiento móvil**\
**HU:** Como persona que usa teclado o móvil, quiero completar tareas sin barreras.\
**RF/RNF:** RF-01–RF-07; RNF-06 accesibilidad/usabilidad.\
**Criterios:** teclado, foco, etiquetas, contraste y estados de carga/error revisados; TC-10 automatizado donde sea viable y validado manualmente.

### P2 — Funcionalidades centrales y validación pendiente

**ISSUE-10 — Validar en staging catálogo de servicios y disponibilidad de proveedores**\
**HU:** Como proveedor aprobado, quiero publicar servicios, horarios y excepciones para recibir solicitudes válidas.\
**RF/RNF:** RF-08; RNF-03 propiedad por proveedor.\
**Criterios:** migración probada; CRUD autorizado; tramos no superpuestos y excepciones validadas; servicios/horarios solo visibles para perfiles aprobados. Se crearon un servicio y un horario semanal en staging y se verificó su presencia en el directorio; faltan las demás variantes E2E.

**ISSUE-11 — Implementar flujo de citas sin dobles reservas**\
**HU:** Como tutor, quiero solicitar una cita para mi mascota; como proveedor, quiero confirmarla o proponer otro horario.\
**RF/RNF:** RF-09, RF-12; RNF-04 consistencia y RNF-07 notificación.\
**Criterios:** solicitudes pendientes, confirmación/rechazo, cancelación antes del inicio, propuestas de cambio con aceptación/rechazo, validación por zona horaria, bloqueo transaccional contra dobles reservas y avisos en outbox. Desplegado y parcialmente probado en staging; concurrencia frente a PostgreSQL real probada en local; faltan otros escenarios integrados y entrega de avisos.

**ISSUE-12 — Implementar reportes de mascota perdida con divulgación temporal**\
**HU:** Como tutor, quiero avisar que mi mascota se perdió y controlar qué ubicación y contacto compartir.\
**RF/RNF:** RF-10, RF-12; RNF-03 privacidad y RNF-04 fiabilidad.\
**Criterios:** activar/actualizar/cerrar reporte; solo miembros autenticados ven el barrio/sector aproximado; consentimiento explícito y vencimiento a las 72 horas; renovar requiere confirmar de nuevo; el QR público no muestra el reporte; ubicación no se presenta como GPS si no existe fuente real. El código está desplegado y la migración 0006 está aplicada en staging; con cuentas QA se verificaron creación, visibilidad, vencimiento con fecha adelantada, renovación con consentimiento y cierre. No se esperaron 72 horas naturales.

**ISSUE-13 — Implementar historial de salud básico y recordatorios**\
**HU:** Como tutor, quiero organizar vacunas y cuidados con fecha y fuente.\
**RF/RNF:** RF-11, RF-12; RNF-03 privacidad e integridad.\
**Criterios:** acceso solo autorizado, historial auditable, recordatorios configurables y aviso explícito de que no son diagnóstico.

**ISSUE-14 — Integrar notificaciones y preferencias de comunicación**\
**HU:** Como usuario, quiero enterarme de cambios importantes por canales que autoricé.\
**RF/RNF:** RF-12; RNF-07 entrega y privacidad.\
**Criterios:** correo al email verificado con reintentos y estado persistido; evaluar una alternativa compatible con Render Free y guardar las credenciales únicamente como secretos. Los avisos automáticos de WhatsApp están fuera del alcance; los registros anteriores se conservan sin envío. Revisar la cola antes de habilitar correo.

### P3 — Operación y ciencia de datos responsable

**ISSUE-15 — Crear métricas administrativas reproducibles y gobernadas**\
**HU:** Como administrador, quiero métricas reales para comprender el uso y la operación.\
**RF/RNF:** RF-14; RNF-08 calidad de datos y privacidad.\
**Criterios:** definiciones, ventanas de tiempo, zona horaria, agregación y permisos documentados; resultados reconciliables con datos de origen; no exponer identificadores personales innecesarios.

**ISSUE-16 — Evaluar si existe un caso de uso válido para ciencia de datos/ML**\
**HU:** Como responsable de producto, quiero decidir con evidencia si un modelo aporta valor sin perjudicar a usuarios o mascotas.\
**RF/RNF:** RF-14; RNF-08 gobernanza, consentimiento, minimización y evaluación.\
**Criterios:** primero documentar pregunta, beneficio, datos necesarios, sesgos, riesgos, métricas y alternativa no-ML; no entrenar ni desplegar un modelo mientras no haya justificación, volumen/calidad de datos, autorización y plan de monitoreo.

## 8. Requisitos no funcionales (RNF)

| ID                              | Requisito verificable                                                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| RNF-01 Portabilidad             | Instalación/build deterministas con Node 22 y pnpm fijado; soportar Windows y Linux para desarrollo/CI                                         |
| RNF-02 Mantenibilidad           | Contratos compartidos generados desde OpenAPI, migraciones versionadas y documentación de estado actualizado                                   |
| RNF-03 Seguridad/privacidad     | Autorización en servidor, propiedad por recurso, secretos fuera del frontend, bucket privado, consentimiento explícito y minimización de datos |
| RNF-04 Fiabilidad               | Errores visibles, migraciones repetibles, backups/restauración probados antes de producción                                                    |
| RNF-05 Calidad                  | Cada cambio pasa typecheck/build; pruebas de unidad, API y E2E se agregan progresivamente en CI                                                |
| RNF-06 Usabilidad/accesibilidad | Diseño responsive, navegación por teclado, foco/labels/contraste y estados de carga/error                                                      |
| RNF-07 Integridad operacional   | Estado real y de demostración claramente distinguido; eventos de cita/notificación consistentes y trazables                                    |
| RNF-08 Gobernanza de datos      | Métricas definidas y agregadas, finalidad/retención documentadas, acceso limitado; modelos solo con justificación y evaluación                 |

## 9. Ciencia de datos: recomendación

El estado actual no muestra un pipeline analítico ni un problema de ML definido. El mapa consume datos públicos de lugares; los perfiles y demás flujos no constituyen por sí mismos un conjunto de entrenamiento. Las métricas de muestra del panel no deben tratarse como datos observados.

La secuencia responsable es:

1. Definir objetivos operativos simples (por ejemplo, solicitudes por estado y tiempos de respuesta) y sus definiciones.
2. Asegurar consentimiento/base legal, minimización, calidad, retención y datos agregados.
3. Construir reportes descriptivos y comprobar que la decisión que apoyan es útil.
4. Solo entonces evaluar un modelo concreto contra una alternativa simple, medir sesgo y error, documentar límites y monitorear deriva.

No usar salud, ubicación precisa, contactos o datos identificables para analítica o entrenamiento sin finalidad justificada, autorización y controles aprobados.

## 10. Orden de ejecución recomendado

1. Completar las pruebas pendientes de mascotas perdidas y los recorridos con cuentas ficticias; no tocar producción.
2. Fortalecer las pruebas automatizadas API y E2E de las funciones del lanzamiento inicial y revisar CI en Windows y Linux.
3. Definir políticas de privacidad, eliminación/exportación y retención; ensayar migraciones y restauración en entornos aislados.
4. Mantener Gmail pausado hasta evaluar una alternativa compatible y revisar la cola. Los avisos automáticos de WhatsApp están fuera del alcance; la configuración de secretos y los envíos de prueba requieren autorización.
5. Publicar en staging únicamente los cambios aprobados y verificar los flujos desplegados. El bucket privado ya se confirmó en staging.
6. Dejar historial de salud y analítica administrativa para una etapa posterior al lanzamiento inicial.
7. Promover a producción únicamente tras aprobación, migraciones ensayadas, secretos separados, monitoreo y recuperación comprobados.

La documentación no crea issues en GitHub ni aplica migraciones. Esas acciones requieren acceso al repositorio y confirmación del entorno destino.
