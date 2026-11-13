# PetPulse — paquete del proyecto

Este paquete contiene el código fuente actual del prototipo y los documentos para continuar su implementación con Claude Pro.

## Archivos de orientación

- `docs/PetPulse-Documento-Maestro.md` — intención, alcance, funcionalidades, requisitos y etapas de implementación.
- `docs/engineering/CALIDAD-REQUISITOS-Y-ROADMAP.md` — análisis del estado actual, CI, casos de prueba, requisitos y backlog priorizado.
- `docs/PetPulse-Prompt-Claude-Pro.md` — prompt de seguimiento listo para copiar en Claude Pro.
- `docs/deployment/PetPulse-Despliegue-Portatil.md` — guía para recrear la web en Vercel, la API en Render y PostgreSQL en Supabase.
- `artifacts/pet-pulse/` — interfaz web del prototipo.
- `artifacts/api-server/` y `lib/db/` — API, autenticación, permisos y persistencia reales.

## Estado del prototipo

PetPulse conserva una demostración interactiva con datos ficticios en el navegador y una base real de cuentas, roles y persistencia de mascotas y proveedores. La ruta `/demo/map` sigue siendo simulada y aislada. La ruta `/map` inicia centrada en Medellín, Antioquia, y consulta con Photon lugares etiquetados en OpenStreetMap. Estos resultados son externos y no están verificados por PetPulse: pueden estar desactualizados o ubicados incorrectamente; cada resultado ofrece un enlace para reportar una corrección en OpenStreetMap. Los perfiles de proveedor publicados pueden incluir enlaces HTTPS a sitio web, Instagram, Facebook y WhatsApp. Su aprobación verifica el perfil del negocio, no la precisión de sus enlaces externos ni una ubicación exacta; el directorio por ahora permite buscar el nombre y barrio en Google Maps. El mapa aún no contiene ubicaciones de proveedores verificadas por PetPulse. La ubicación del dispositivo se envía a Photon para la búsqueda, no se guarda en PetPulse ni rastrea a las mascotas. Los espacios culturales/de eventos no representan una agenda de eventos actuales. Antes de usar el mapa con tráfico de producción hay que revisar los límites de los servicios públicos de mapas y búsqueda o seleccionar un proveedor con capacidad adecuada.

Los perfiles reales de mascotas permiten editar datos y subir fotos privadas a Supabase Storage. Cada tutor puede crear un QR con una ficha pública limitada y revocarlo; el contacto de emergencia solo aparece tras consentimiento explícito. Para desplegar estas funciones se requiere aplicar las migraciones y configurar un bucket privado `pet-photos` y las credenciales de Storage en Render. Los enlaces opcionales de proveedor requieren aplicar también la migración `0002_provider_social_links.sql`; el cambio aún no se ha aplicado a staging ni producción. Las citas, el GPS de mascotas, las notificaciones y otros flujos siguen pendientes. Consulta el Documento Maestro antes de tratar una interacción de demostración como una capacidad real.

## Tecnologías

- Web: React, TypeScript/TSX, Vite, CSS/Tailwind CSS 4, Wouter y Lucide React.
- API: Node.js, TypeScript, Express 5, Clerk y contratos OpenAPI con cliente generado.
- Datos: PostgreSQL, Drizzle ORM y migraciones SQL.
- Workspace/deployment: pnpm monorepo; manifiestos para Vercel, Render y Supabase.

## Organización de la interfaz

- `artifacts/pet-pulse/src/app/` configura Clerk, el cliente de consultas y el puente de autenticación con la API.
- `artifacts/pet-pulse/src/pages/` contiene las páginas públicas, de cuenta, de proveedores y de administración.
- `artifacts/pet-pulse/src/features/map/` agrupa los tipos y consultas de lugares del mapa.
- `artifacts/pet-pulse/src/components/` contiene componentes compartidos y la interfaz del mapa.

## Ejecución en el workspace

Desde la raíz del workspace, con pnpm instalado:

```bash
pnpm install
pnpm --filter @workspace/pet-pulse run dev
```

Para probar la demostración local sin cargar Clerk ni llamar a la API, inicia Vite y abre `http://localhost:5173/demo-local.html#/`. Usa datos ficticios guardados en el almacenamiento local del navegador; no representa autenticación ni permisos reales. Esta página es una entrada de desarrollo y no forma parte del build de producción.

Las instrucciones de despliegue portátil están en `docs/deployment/PetPulse-Despliegue-Portatil.md`; las instrucciones del entorno Replit están en `replit.md`. No se incluyen dependencias instaladas, `.git`, archivos de secretos ni herramientas internas del agente.
