# PetPulse
## Documento maestro de intención, alcance y requisitos

**Versión:** 1.0  
**Fecha de visión:** 26 de octubre de 2026<br>
**Estado actualizado:** 27 de octubre de 2026<br>
**Estado:** visión de producto y especificación; la etapa A ya tiene una primera base implementada<br>
**Naturaleza del producto actual:** prototipo ampliado con cuentas, permisos y persistencia; aún no es una versión de producción

---

## 1. Resumen ejecutivo

PetPulse es una plataforma digital para el cuidado, identificación y seguridad de mascotas, conectada con una red de profesionales y organizaciones locales. Busca reunir en un solo lugar los perfiles de las mascotas, la información básica importante para su cuidado, la ubicación autorizada, la búsqueda de servicios y la coordinación ante una pérdida.

La solución se dirige a tres grupos:

1. **Personas tutoras**, que gestionan la información y el cuidado de sus mascotas.
2. **Asociados o proveedores**, como veterinarias, paseadores, guarderías, refugios y tiendas.
3. **Administradores**, que supervisan la operación, los perfiles y las alertas de la plataforma.

PetPulse conserva una demostración interactiva con datos simulados y también incluye cuentas, roles y persistencia en servidor para perfiles de mascotas y proveedores. Los perfiles reales permiten editar sus datos y cargar fotos privadas; sus QR públicos muestran una ficha limitada, son revocables y solo comparten el contacto de emergencia con consentimiento expreso. El directorio, los servicios y la disponibilidad de proveedores, y una primera versión persistente de citas ya están conectados localmente. Las migraciones `0003`–`0005` se aplicaron y verificaron en staging, pero no en producción; el código correspondiente aún no se ha desplegado ni validado allí. El envío por Gmail requiere configurar secretos y WhatsApp permanece diferido hasta integrar un proveedor. La demostración sigue aislada de las cuentas reales. Este documento distingue la base ya implementada de las capacidades todavía previstas.

## 2. Intención del proyecto

### 2.1 Necesidad que atiende

La información y las gestiones del cuidado de una mascota suelen estar dispersas: datos de identificación en un lugar, citas en otro, datos médicos en documentos separados y contactos de servicios en buscadores o redes sociales. Si la mascota se pierde, la persona tutora necesita comunicar la información correcta con rapidez y coordinar ayuda.

Los proveedores locales, por su parte, necesitan presentar sus servicios de forma clara y recibir solicitudes organizadas. La plataforma puede facilitar el encuentro entre la demanda de cuidado y la oferta local, sin prometer servicios que no haya verificado.

### 2.2 Propuesta de valor

**Para las personas tutoras:** mantener la información esencial de sus mascotas a mano, encontrar opciones de cuidado y contar con un flujo claro para activar una alerta.

**Para los proveedores:** presentar su negocio y servicios, gestionar solicitudes y tener una agenda centralizada.

**Para la administración:** supervisar la actividad de la red, moderar perfiles y dar seguimiento a alertas, con permisos y trazabilidad adecuados.

### 2.3 Visión

Crear una red de cuidado animal confiable, útil en la vida diaria y preparada para ayudar a una comunidad a responder cuando una mascota necesita atención o se pierde.

## 3. Objetivos y límites

### 3.1 Objetivos del producto

- Dar a cada mascota un perfil organizado con identificación y contactos importantes.
- Facilitar el descubrimiento de servicios relacionados con mascotas en una zona definida.
- Permitir que una persona tutora solicite y gestione citas.
- Ofrecer a los proveedores una presencia comercial y herramientas básicas de agenda.
- Proporcionar un proceso visible y responsable para reportar y resolver una pérdida.
- Permitir el seguimiento de ubicación únicamente cuando exista una fuente real configurada y la persona tutora lo autorice.
- Mantener información y permisos separados por cuenta y rol.

### 3.2 Lo que el producto no debe prometer

- No sustituye la atención veterinaria ni ofrece diagnósticos médicos.
- Un mapa no significa que exista un dispositivo GPS conectado.
- Una ficha con un patrón visual no es un código QR válido hasta que se genere y pruebe uno real.
- Una solicitud de cita no significa que el proveedor la haya aceptado.
- Un perfil publicado no equivale a una verificación comercial, salvo que se implemente y explique un proceso real de verificación.

### 3.3 Fuera del alcance de este prototipo

- Cobros, suscripciones, comisiones y reembolsos.
- Telemedicina o consejo clínico automatizado.
- Rastreo real de un collar GPS o de un teléfono.
- Mensajes SMS, correo, notificaciones push o llamadas automatizadas.
- Verificación legal o comercial de proveedores.
- Aplicación móvil nativa.
- Moderación automatizada de contenido.

Estas capacidades podrían evaluarse después, pero requieren decisiones de negocio, proveedores, privacidad y operación.

## 4. Usuarios y roles

### 4.1 Persona tutora

Necesita crear y mantener los perfiles de sus mascotas, encontrar cuidado local, reservar servicios y compartir de forma controlada información útil si ocurre una emergencia.

### 4.2 Asociado o proveedor

Puede ser una veterinaria, guardería, paseador, refugio, tienda u otro servicio aprobado. Necesita administrar su perfil, describir servicios y disponibilidad, y gestionar solicitudes de cita.

### 4.3 Administrador de plataforma

Supervisa usuarios y asociados, revisa reportes, resuelve casos de operación y accede a métricas agregadas. Las acciones administrativas deben quedar registradas.

### 4.4 Permisos objetivo

| Capacidad | Tutora | Proveedor | Administrador |
|---|---|---|---|
| Gestionar sus propios datos de cuenta | Sí | Sí | Según necesidad operativa |
| Crear y modificar perfiles de sus mascotas | Sí | No, salvo permiso explícito | Solo con razón y auditoría |
| Ver ubicación de la mascota | Solo con autorización vigente | No por defecto | No por defecto |
| Crear o administrar perfil comercial | No | Sí, el suyo | Revisar, aprobar o suspender |
| Gestionar servicios y agenda | No | Sí, de su negocio | Supervisión excepcional |
| Solicitar una cita | Sí | No | No |
| Reportar o resolver una pérdida | Sí, sobre su mascota | Ayudar según permisos | Supervisar y moderar |
| Administrar cuentas y reportes globales | No | No | Sí, con auditoría |

En el prototipo se cambia entre tres vistas mediante un selector. Esto sirve para demostrar la experiencia; **no es autenticación ni autorización**. En producción, el servidor debe validar cada permiso.

## 5. Alcance funcional

### 5.1 Funciones disponibles en el prototipo actual

- Navegación SPA en las vistas Inicio, Mapa, Mis mascotas, Directorio, Servicios y Panel de control.
- Selector de vista para persona tutora, proveedor y administración.
- Perfiles de muestra para mascotas y proveedores.
- Alta local de una mascota y de un servicio.
- Simulación del movimiento de mascotas en el mapa ilustrativo.
- Activación y resolución de alertas de pérdida con banner global y aviso en pantalla.
- Búsqueda y filtros del directorio.
- Solicitud de cita de demostración.
- Ficha de emergencia y simulación visual de QR.
- Métricas de muestra para administración.
- Persistencia local en el navegador mediante `localStorage`.
- Diseño adaptable a escritorio y móvil.

### 5.2 Funciones que faltan para una aplicación real

- Recuperación de cuenta y políticas de retención/eliminación.
- Ampliar el aislamiento y la propiedad de datos para organizaciones y equipos.
- Archivo, validación y recuperación de registros en flujos que aún no están cubiertos.
- Historial médico básico y recordatorios.
- Perfiles comerciales editables, disponibilidad y gestión real de citas.
- GPS o seguimiento real de mascotas, alertas conectadas a ubicación y publicación de ubicaciones compartidas.
- Coordenadas verificadas para los perfiles comerciales de PetPulse y un proveedor de mapas/lugares con capacidad operativa adecuada para producción.
- Canales de comunicación reales y controles de entrega.
- Verificación y moderación de proveedores.
- Registro de auditoría, copias de seguridad, monitorización y recuperación.
- Revisión legal, operativa y de seguridad antes del lanzamiento.

## 6. Mapa de vistas propuesto

Las rutas actuales son rutas del prototipo, no una decisión definitiva de navegación de producción.

| Vista | Propósito | Estado |
|---|---|---|
| `/` Inicio | Resumen para el rol seleccionado y accesos a tareas frecuentes | Prototipo disponible |
| `/map` Mapa | Explorar lugares cercanos y buscar otra zona | Mapa externo integrado; ubicación del usuario solo bajo permiso, sin GPS de mascotas |
| `/workspace/pets` Mascotas | Ver, añadir y editar perfiles, cargar fotos y gestionar su QR público revocable | Integrado con API; revisar el bucket en staging y aplicar las migraciones en producción |
| `/directory` Directorio | Buscar y filtrar proveedores por categoría, zona y servicio | Prototipo disponible; proveedores ficticios |
| `/services` Servicios | Ver citas y agregar un servicio desde la vista de proveedor | Prototipo disponible; sin sincronización ni confirmación real |
| `/admin` Operaciones | Ver métricas de muestra y resolver alertas simuladas | Prototipo disponible; sin control administrativo real |

La versión final puede incorporar páginas públicas de presentación, alta de cuentas, perfil, ajustes, ayuda, estados vacíos, error, privacidad y preferencias de notificación.

## 7. Requisitos funcionales objetivo

### 7.1 Cuentas y perfiles

- **RF-01:** Permitir el registro, autenticación y recuperación de cuenta con un proveedor de identidad adecuado al entorno de despliegue.
- **RF-02:** Asociar cada cuenta a uno o más roles autorizados.
- **RF-03:** Permitir que una persona tenga varias mascotas y que un negocio tenga varios servicios y miembros autorizados.
- **RF-04:** Permitir actualizar datos de perfil y preferencias; confirmar cambios sensibles.
- **RF-05:** Permitir desactivar o solicitar eliminación de cuenta conforme a las reglas de retención definidas.

### 7.2 Mascotas e información de cuidado

- **RF-06:** Crear, ver, editar y eliminar o archivar perfiles de mascotas.
- **RF-07:** Guardar nombre, especie, raza, fecha de nacimiento o edad aproximada, sexo si es relevante, fotografía, identificador interno y estado.
- **RF-08:** Guardar contactos de emergencia con consentimiento y permitir elegir qué datos se muestran en una ficha compartida.
- **RF-09:** Mantener un historial básico de vacunas, consultas, alergias, medicación y notas, indicando quién agregó cada dato y cuándo.
- **RF-10:** Permitir recordatorios configurables, dejando claro que no reemplazan recomendaciones veterinarias.
- **RF-11:** Generar una ficha QR real con un identificador opaco. El QR no debe exponer datos privados innecesarios.
- **RF-12:** Permitir cambiar, regenerar o desactivar el QR si se pierde o se divulga.

### 7.3 Localización y seguridad

- **RF-13:** Mostrar ubicación solo cuando exista una fuente activa, válida y autorizada.
- **RF-14:** Indicar la fecha y hora de última actualización, precisión aproximada y estado de conexión de la fuente.
- **RF-15:** Permitir iniciar, pausar y detener el seguimiento y retirar el consentimiento.
- **RF-16:** Distinguir ubicación real, ubicación aproximada y ubicación no disponible.
- **RF-17:** Permitir crear un reporte de pérdida con mascota, última ubicación conocida, momento, descripción y datos de contacto que la persona tutora elija compartir.
- **RF-18:** Permitir actualizar el reporte, marcar una mascota como encontrada y cerrar la alerta.
- **RF-19:** Compartir la ubicación con terceros solo mediante reglas explícitas y temporales; registrar accesos relevantes.

### 7.4 Directorio y proveedores

- **RF-20:** Permitir buscar por nombre, categoría, servicio y ubicación.
- **RF-21:** Mostrar información comercial, horarios, servicios, zona de atención, contacto, disponibilidad y estado de verificación.
- **RF-22:** Permitir que un proveedor gestione únicamente su perfil y sus servicios.
- **RF-23:** Permitir que un proveedor configure horas disponibles, excepciones y capacidad de atención.
- **RF-24:** Evitar presentar reseñas, calificaciones o verificaciones como reales si no existen datos confiables y una política de moderación.

### 7.5 Citas y solicitudes

- **RF-25:** Permitir que una persona tutora solicite una cita para una mascota, servicio, proveedor, fecha y hora.
- **RF-26:** Mostrar estados claros: solicitada, confirmada, rechazada, cancelada, completada y no asistida, según el flujo acordado.
- **RF-27:** Permitir al proveedor aceptar, proponer otro horario o rechazar con una razón opcional.
- **RF-28:** Evitar dobles reservas mediante validación de disponibilidad en el servidor.
- **RF-29:** Notificar a las partes cuando cambie una solicitud, según sus preferencias y los canales disponibles.

### 7.6 Administración y operación

- **RF-30:** Mostrar métricas calculadas desde datos reales y con rangos de fecha explícitos.
- **RF-31:** Permitir revisar, aprobar, suspender o reactivar proveedores con motivo y auditoría.
- **RF-32:** Gestionar reportes de pérdida y otros reportes con estados, responsable y registro de acciones.
- **RF-33:** Limitar el acceso administrativo al mínimo necesario y auditar lecturas o modificaciones sensibles.

### 7.7 Notificaciones y preferencias

- **RF-34:** Mantener un centro de notificaciones dentro de la aplicación.
- **RF-35:** Permitir elegir eventos y canales autorizados para cada cuenta.
- **RF-36:** Evitar mostrar información sensible en notificaciones visibles en la pantalla de bloqueo.
- **RF-37:** Registrar estado de entrega cuando el proveedor del canal lo permita y ofrecer reintento o alternativa ante fallos.

## 8. Flujos principales

### 8.1 Registrar una mascota

1. La persona tutora inicia sesión.
2. Completa los datos mínimos y un contacto de emergencia.
3. Revisa qué datos quedarán privados y cuáles podrían compartirse.
4. Guarda el perfil y lo ve inmediatamente en su lista.
5. Puede completar información de salud y generar una ficha QR.

### 8.2 Encontrar y solicitar un servicio

1. Busca por zona, categoría o necesidad.
2. Revisa el perfil, horario y estado del proveedor.
3. Selecciona mascota, servicio y hora disponible.
4. Envía la solicitud y recibe un estado pendiente.
5. El proveedor responde; ambas partes ven el resultado y reciben notificación.

### 8.3 Reportar una mascota perdida

1. La persona tutora elige la mascota y activa el reporte.
2. Indica cuándo la vio por última vez y el barrio o sector aproximado, sin dirección exacta ni rastreo GPS.
3. El sistema explica que los datos serán visibles solo para miembros con sesión iniciada durante 72 horas y solicita consentimiento explícito.
4. Los miembros pueden consultar el reporte mientras esté vigente; no se envían avisos por correo mientras esa integración esté pausada.
5. La persona tutora puede cerrar el reporte al encontrarla o renovarlo por 72 horas, confirmando de nuevo el consentimiento.

### 8.4 Gestionar servicios como proveedor

1. El proveedor inicia sesión en su cuenta aprobada.
2. Actualiza su perfil, servicios, zona y disponibilidad.
3. Recibe una solicitud y la acepta, rechaza o propone otra hora.
4. Consulta su agenda y el historial de solicitudes.
5. Los cambios quedan asociados a su negocio y registrados.

### 8.5 Operación administrativa

1. El administrador revisa indicadores agregados.
2. Abre un caso o perfil que requiere atención.
3. Ejecuta una acción autorizada, registra el motivo y notifica cuando corresponda.
4. Revisa el estado del caso y mantiene un registro de auditoría.

## 9. Reglas de negocio y privacidad

- La persona tutora conserva el control de los datos del perfil de su mascota, sujeto a requisitos legales y operativos.
- La ubicación es información sensible: recopilar lo mínimo, limitar la retención y compartirla solo con autorización.
- La geolocalización del navegador representa el teléfono que la solicita; **no rastrea automáticamente a una mascota ni a un collar**.
- La integración con un collar requiere compatibilidad, autorización de su cuenta y una fuente de datos real.
- Un QR público no debe contener directamente teléfono, domicilio, credenciales ni historial médico completo. Debe resolver a una vista controlada y revocable.
- El reporte de mascota perdida comparte solo barrio/sector aproximado con miembros autenticados; vence a las 72 horas, puede cerrarse antes y exige nuevo consentimiento para renovarse. El QR público no indica que exista un reporte ni revela su ubicación.
- Los datos de salud deben tener acceso limitado y su uso debe explicarse con claridad.
- Los proveedores deben declarar información veraz; cualquier insignia de verificación requiere un proceso verificable.
- Las calificaciones públicas necesitan reglas contra fraude, represalias y divulgación de información personal.
- La aplicación debe declarar que los registros médicos son informativos y no un diagnóstico.
- Antes de operar en una ciudad o país, definir jurisdicción, idioma, zona horaria, formato de teléfono, políticas de privacidad, consentimiento y retención aplicables.

## 10. Requisitos no funcionales

### Seguridad

- Autorización en servidor para cada recurso y acción; ocultar un botón no es control de seguridad.
- Validación de entradas y límites de tamaño y frecuencia.
- Protección contra acceso a registros de otra cuenta, negocio o rol.
- Secretos en el gestor de secretos del entorno, nunca en el código ni en el ZIP.
- HTTPS en despliegues, gestión segura de sesión y protección de acciones sensibles.
- Registro de auditoría para administración y operaciones con información sensible.
- Revisión periódica de dependencias y respuesta a vulnerabilidades.

### Privacidad

- Consentimiento informado para ubicación y datos compartidos.
- Controles visibles para pausar, revocar y revisar permisos.
- Minimización de datos, plazos de retención y proceso de eliminación.
- Explicar qué ve cada rol y cada destinatario de una alerta.
- Diseñar datos de demostración que no sean datos personales reales.

### Usabilidad y accesibilidad

- Interfaz adaptable a móvil, tablet y escritorio.
- Navegación por teclado, foco visible, etiquetas en formularios y mensajes de error comprensibles.
- Contraste suficiente y estado expresado con texto, no solo por color.
- Cargas, errores, confirmaciones y estados vacíos explícitos.
- Evitar acciones irreversibles sin confirmación y permitir corregir entradas.

### Fiabilidad y rendimiento

- Persistencia y consistencia de datos en el servidor.
- Copias de seguridad y procedimiento de restauración.
- Métricas, registros y alertas técnicas para fallos.
- Comportamiento útil con conectividad lenta o intermitente, especialmente en alertas.
- Pruebas de permisos, flujos críticos, formularios, errores y compatibilidad móvil.

## 11. Modelo de datos conceptual

El diseño final debe validarse antes de migrar. Entidades iniciales sugeridas:

- **Cuenta:** identidad externa, estado, preferencias y fechas de creación.
- **Membresía/Rol:** cuenta, organización, rol y permisos.
- **Mascota:** propietario, nombre, especie, raza, fecha o edad, foto, estado y datos de identificación.
- **Contacto de emergencia:** mascota, nombre, canal de contacto, prioridad y permiso de divulgación.
- **Registro de salud:** mascota, tipo, fecha, notas, profesional o fuente y adjunto opcional.
- **Proveedor/Negocio:** propietario, nombre, categoría, descripción, ubicación comercial, horarios, estado y verificación.
- **Servicio:** proveedor, nombre, categoría, descripción, duración, precio si se decide, capacidad y disponibilidad.
- **Cita/Solicitud:** mascota, persona tutora, proveedor, servicio, fecha, estado, notas y eventos de estado.
- **Ubicación:** mascota o dispositivo, coordenadas, precisión, hora de lectura, fuente, consentimiento y expiración.
- **Alerta de pérdida:** mascota, creador, hora, última ubicación compartida, estado, visibilidad y expiración.
- **Notificación:** destinatario, evento, canal, contenido seguro, entrega y lectura.
- **Registro de auditoría:** actor, acción, recurso, fecha, motivo y resultado.
- **Token QR:** identificador opaco, alcance de datos, caducidad o estado de revocación.

No almacenar fotos o documentos en columnas de texto/base64 si existe almacenamiento de archivos apropiado. Guardar en la base de datos solo la referencia y los metadatos necesarios.

## 12. Tecnología actual y arquitectura a futuro

### 12.1 Lo que usa el prototipo PetPulse

- **Lenguajes:** TypeScript y TSX para la interfaz; CSS para estilos; HTML para el documento de entrada. El espacio de trabajo incluye configuraciones JSON/YAML y scripts JavaScript de herramientas.
- **Interfaz:** React y Vite.
- **Estilos:** Tailwind CSS 4 está configurado; la apariencia actual combina CSS propio y variables de tema.
- **Rutas:** Wouter.
- **Iconos:** Lucide React.
- **Estado de demostración:** React state y `localStorage`.
- **Gestor de paquetes:** pnpm en un workspace.
- **Tipografías:** Manrope y DM Sans mediante Google Fonts.
- **Navegación adaptable:** menú lateral en escritorio y barra inferior en móvil.

### 12.2 Base de aplicación implementada

PetPulse ya usa Express 5, contratos OpenAPI con cliente/hooks generados, PostgreSQL con Drizzle y Clerk para autenticación. La API protege el perfil de cuenta, la configuración inicial, las mascotas, el perfil comercial y la administración de proveedores. La autoridad de roles y propiedad de datos está en el servidor; la lista de administradores se configura con correos verificados. El estado del proveedor se mantiene pendiente hasta una decisión administrativa.

La web mantiene rutas separadas para la experiencia de cuenta y para la demostración local. El mapa de cuenta inicia centrado en Medellín, Antioquia, y consulta con Photon lugares cercanos catalogados en OpenStreetMap, como veterinarias, tiendas para mascotas, parques, espacios culturales y de eventos, restaurantes y cafés. Permite consultar la ubicación del dispositivo solo tras una acción y permiso explícitos, o buscar una dirección manualmente. Esa ubicación no se guarda en PetPulse ni representa la posición de una mascota. Los espacios culturales/de eventos son lugares, no una agenda de eventos actuales. La demostración sigue usando sus propios datos simulados; no incluye GPS de mascotas ni reemplaza el directorio real. Las citas de cuenta permiten solicitar, confirmar, rechazar, cancelar y proponer cambios de horario; aún falta validarlas en staging. El email depende de la configuración segura de Gmail SMTP y WhatsApp no se envía hasta integrar un proveedor.

La primera versión del mapa usa teselas de OpenStreetMap y Photon para geocodificación y búsqueda cercana filtrada por categorías de OpenStreetMap. Las coordenadas consultadas se envían a Photon; la ubicación no se persiste en PetPulse. Los servicios son públicos y no ofrecen una garantía de disponibilidad adecuada para producción; antes de un lanzamiento con tráfico relevante se deben revisar sus políticas y límites y, si el uso lo requiere, contratar o desplegar servicios con capacidad y nivel de disponibilidad adecuados.

Los perfiles reales de mascota admiten fotos mediante un bucket privado de Supabase Storage. Cada persona tutora puede crear o revocar un QR que abre `/pet/{token}`; esa ficha no publica edad, dirección ni datos de cuenta, y el contacto de emergencia permanece oculto salvo consentimiento expreso. La clave `service_role` solo se configura en Render. Las migraciones están aplicadas en staging; aún falta verificar allí la privacidad del bucket y aplicar/configurar cada entorno productivo por separado.

Para recrear el despliegue en servicios externos se añadieron configuraciones separadas: Vercel para la interfaz, Render para la API, Supabase para PostgreSQL y Storage, y Clerk externo para las cuentas. El servicio de API staging y el proyecto Supabase de staging existen; antes de validar los flujos falta publicar el código, confirmar las variables de conexión/Clerk y configurar los secretos de Gmail. La guía paso a paso está en `docs/deployment/CONFIGURACION-PLATAFORMAS.md`.

### 12.3 Arquitectura objetivo para las etapas restantes

- Mantener una SPA React + TypeScript como cliente.
- Definir primero los contratos de API y generar los tipos y hooks desde OpenAPI.
- Extender los endpoints Express y el esquema PostgreSQL con validación, propiedad y permisos.
- Usar almacenamiento privado de archivos para fotografías y documentos; las fotos de mascotas ya usan Supabase Storage.
- Integrar un proveedor de identidad administrado adecuado al entorno; no crear almacenamiento casero de contraseñas.
- Elegir el proveedor de mapas y fuente de GPS después de definir país, dispositivos compatibles, presupuesto y política de privacidad.
- Mantener ubicación, reservas y datos de salud detrás de autorización del servidor.

## 13. Etapas de implementación conservadas

Estas etapas quedan como guía de avance y preservan el alcance solicitado:

### Etapa A — Datos persistentes y cuentas reales

**Estado:** base implementada; faltan pruebas operativas y ampliaciones de producto.

- Implementado: Clerk para registro e inicio de sesión; cuentas y selección inicial entre tutor/proveedor.
- Implementado: perfiles, mascotas y perfiles comerciales persistentes en PostgreSQL mediante la API.
- Implementado inicialmente: edición de perfiles de mascota, fotografía privada y QR público limitado, con consentimiento para mostrar contacto de emergencia y revocación del QR.
- Implementado: validación de identidad, control de permisos y propiedad de datos en el servidor; revisión administrativa de proveedores.
- Implementado: migración inicial reproducible y configuración para separar Vercel, Render y Supabase; el despliegue externo usa una instancia Clerk independiente.
- Preparado: servicio de API staging en Render y proyecto Supabase de staging; las migraciones `0003`–`0005` están aplicadas. Falta publicar el código, verificar Clerk/Storage y configurar Gmail en staging.
- Pendiente: completar políticas de retención y eliminación de cuenta, procedimientos de respaldo/restauración, migración de cuentas entre instancias Clerk y pruebas de recuperación/operación antes de producción.

### Etapa B — Ubicación real con controles de privacidad

- Implementado inicialmente: mapa interactivo con teselas de OpenStreetMap, ubicación del dispositivo bajo permiso y búsqueda manual de una zona; consulta lugares cercanos en datos abiertos. No es rastreo de mascotas.
- Pendiente: seleccionar servicios de mapas, geocodificación y búsqueda con capacidad/condiciones apropiadas para producción.
- Seleccionar la fuente real: collar compatible, teléfono u otro dispositivo autorizado.
- Permitir iniciar, pausar y retirar el seguimiento.
- Mostrar precisión y hora de actualización; diferenciar señal real de última ubicación guardada.
- Definir divulgación limitada y temporal durante una alerta de pérdida.
- Evitar acceso por parte de proveedores u otros usuarios si no existe permiso explícito.

### Etapas adicionales recomendadas

1. **Completar producto base:** historial de salud, QR válido, edición de perfiles, disponibilidad, confirmación de citas y notificaciones.
2. **Administración confiable:** verificación y moderación de proveedores, auditoría, reportes y métricas reales.
3. **Preparar lanzamiento:** pruebas de seguridad y accesibilidad, políticas, soporte, respaldo, monitorización y despliegue por ambiente.

## 14. Criterios para considerar listo el MVP funcional

- Una persona puede registrarse, iniciar sesión y usar solo las funciones autorizadas para su rol.
- Puede crear, modificar y archivar su mascota, y recuperar esos datos al volver a iniciar sesión desde otro dispositivo.
- La ficha QR se puede escanear con un teléfono y muestra solo la información autorizada por la persona tutora.
- El historial básico de salud conserva fecha, fuente y quién lo registró.
- El directorio devuelve proveedores de una zona y filtros reales; su estado de verificación está explicado.
- El flujo de cita evita horarios duplicados y comunica cambios a ambas partes.
- El proveedor puede gestionar servicios, disponibilidad y estado de solicitudes de su negocio.
- Una alerta de pérdida muestra hora y origen de la última ubicación, y puede cerrarse con trazabilidad.
- La persona tutora puede detener el seguimiento y revocar el acceso de ubicación.
- El panel administrativo muestra métricas reales, registra acciones y protege información sensible.
- Formularios, permisos, errores, estados vacíos y vista móvil se verifican antes del lanzamiento.
- La aplicación explica explícitamente límites médicos, uso de ubicación y datos compartidos.

## 15. Decisiones pendientes antes de producción

- ¿Cuál es la primera ciudad y país de operación? El prototipo usa Madrid y teléfonos de ejemplo españoles.
- ¿La aplicación empezará como web adaptable o se necesita una app nativa?
- ¿Qué especies y tipos de servicios forman parte del lanzamiento inicial?
- ¿Qué proveedor de identidad y qué reglas de rol se usarán?
- ¿Qué mapa y qué dispositivos de localización se soportarán?
- ¿Qué datos de salud se guardarán y quién podrá verlos?
- ¿Qué campos verá quien encuentre una mascota al escanear el QR?
- ¿Cómo se verifica un proveedor y quién revisa reportes?
- ¿Qué canales de notificación se necesitan y quién asume su coste?
- ¿Habrá precios, pagos o comisiones? No forman parte del prototipo.
- ¿Cuál será la política para conservar o eliminar ubicaciones, alertas y registros de salud?

## 16. Glosario

- **Persona tutora:** persona responsable del cuidado de una mascota.
- **Asociado/proveedor:** negocio u organización que ofrece servicios.
- **Fuente de ubicación:** dispositivo o integración que genera coordenadas; no es necesariamente el navegador.
- **Alerta de pérdida:** caso temporal con información de una mascota que necesita ayuda.
- **QR revocable:** código que dirige a una ficha segura y puede desactivarse sin cambiar datos privados expuestos.
- **Prototipo:** implementación orientada a validar la experiencia; no implica operación, seguridad o integración de producción.

---

**Estado actual, en una frase:** PetPulse conserva la demo y ya cuenta con cuentas, roles, perfiles persistentes, directorio y una primera etapa local de agenda; faltan validar las migraciones y citas en staging, configurar Gmail, completar WhatsApp y desarrollar las funciones operativas y de ubicación con privacidad.
