# PetPulse — paquete del proyecto

Este paquete contiene el código fuente actual del prototipo y los documentos para continuar su implementación con Claude Pro.

## Archivos de orientación

- `docs/PetPulse-Documento-Maestro.md` — intención, alcance, funcionalidades, requisitos y etapas de implementación.
- `docs/PetPulse-Prompt-Claude-Pro.md` — prompt de seguimiento listo para copiar en Claude Pro.
- `docs/deployment/PetPulse-Despliegue-Portatil.md` — guía para recrear la web en Vercel, la API en Render y PostgreSQL en Supabase.
- `artifacts/pet-pulse/` — interfaz web del prototipo.
- `artifacts/api-server/` y `lib/db/` — API, autenticación, permisos y persistencia reales.

## Estado del prototipo

PetPulse conserva una demostración interactiva con datos ficticios en el navegador y una base real de cuentas, roles y persistencia de mascotas y proveedores. La ruta `/demo/map` sigue siendo simulada y aislada. La ruta `/map` inicia centrada en Medellín, Antioquia, y consulta con Photon veterinarias, comercios para mascotas, parques, espacios culturales/de eventos, cafés y restaurantes registrados en OpenStreetMap. También permite usar la ubicación del dispositivo con permiso explícito o buscar otra zona; la ubicación se envía a Photon para la búsqueda, no se guarda en PetPulse ni rastrea a las mascotas. Los espacios culturales/de eventos no representan una agenda de eventos actuales. Antes de usar el mapa con tráfico de producción hay que revisar los límites de los servicios públicos de mapas y búsqueda o seleccionar un proveedor con capacidad adecuada. El directorio comercial de PetPulse, las citas, el GPS de mascotas, las notificaciones y otros flujos siguen pendientes. Consulta el Documento Maestro antes de tratar una interacción de demostración como una capacidad real.

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

Las instrucciones de despliegue portátil están en `docs/deployment/PetPulse-Despliegue-Portatil.md`; las instrucciones del entorno Replit están en `replit.md`. No se incluyen dependencias instaladas, `.git`, archivos de secretos ni herramientas internas del agente.
