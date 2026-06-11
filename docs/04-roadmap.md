# Roadmap de desarrollo — ERPresto

Estrategia: cada fase entrega valor usable en producción para un segmento real de clientes, empezando por el restaurante individual y evolucionando hacia cadenas enterprise.

## Fase 0 — Fundación ✅ (esta entrega)

**Objetivo:** base técnica sólida sobre la que todo lo demás se construye sin re-trabajo.

- Monorepo (`apps/api` NestJS, `apps/web` Next.js) + Docker Compose (Postgres, Redis, API, Web).
- Schema de base de datos completo del dominio (40+ modelos), migración inicial y seed.
- Multi-tenant con aislamiento por JWT, registro de empresa, multisucursal.
- Auth completa: login, refresh rotado, logout, auditoría de sesiones.
- RBAC: catálogo de permisos, 14 roles de sistema, roles custom.
- CRUD de usuarios, roles, sucursales, categorías y productos.
- Núcleo del doble stock independiente: materia prima (ajustes, lotes) y producción (carga del chef, ajustes) con motor de conversión opcional por receta.
- Frontend: login, layout con navegación completa, dashboard (datos de ejemplo), módulo Productos funcional contra la API.
- Documentación de arquitectura, ERD, módulos y este roadmap.

## Fase 1 — MVP vendible (POS + salón + caja) · ~6-8 semanas

**Objetivo:** un restaurante puede operar su día completo con ERPresto.

- Editor visual drag & drop del salón con persistencia (mesas, formas, sectores, objetos).
- Mapa operativo en tiempo real (WebSockets): estados de mesa, unir/separar, transferir, cambiar mozo.
- POS táctil: abrir/cerrar mesa, take away, mostrador, delivery manual; dividir/unificar cuenta; descuentos, propinas; pagos parciales y mixtos.
- Caja: apertura, cierre con arqueo, movimientos, reporte de turno.
- Venta descuenta stock según el modo configurado (independiente / automático / manual asistido).
- Gestión completa de recetas y costos básicos.
- 2FA y recuperación de contraseña.
- Tests E2E de los flujos críticos (venta completa, cierre de caja).

## Fase 2 — Operación completa · ~8 semanas

- App de mozos (PWA móvil) y KDS por estación con notificaciones al mozo.
- PWA instalable con cache offline básico.
- Compras: órdenes, recepciones parciales que actualizan stock y costos, comparación de proveedores.
- Costos y rentabilidad: margen por producto, actualización automática.
- Reservas con calendario y asignación de mesas.
- Clientes: historial, cumpleaños, puntos.
- Dashboard real con KPIs y comparativas entre sucursales; primeros reportes exportables (CSV/Excel/PDF).
- Inventarios físicos y mermas con flujo guiado.

## Fase 3 — Argentina-ready · ~8 semanas

- **Facturación ARCA**: factura electrónica A/B/C, notas de crédito, CAE, validaciones, caja diaria fiscal.
- Integración Mercado Pago (QR + point) y MODO.
- Delivery: estados, repartidores, integraciones PedidosYa y Rappi.
- Notificaciones: push, email, WhatsApp (proveedor preparado).
- Reportes completos con exportación PDF/Excel/CSV.
- Cuenta corriente de clientes.

## Fase 4 — Offline first y escala · ~10 semanas

- Nodo local por sucursal (instalador Docker) con la API y datos de la sucursal.
- Motor de sincronización bidireccional sobre el outbox `SyncEvent`: versionado, resolución de conflictos, telemetría de sync.
- Impresión térmica ESC/POS (cocina, barra, ticket, precuenta) vía nodo local.
- Hardening de escala: réplicas de API, réplica de lectura de Postgres, cache agresivo, k6/load tests, observabilidad (logs estructurados, métricas, tracing).
- Kubernetes manifests / Helm chart.

## Fase 5 — Plataforma enterprise · continuo

- Asistente IA sobre datos del negocio (márgenes, pronósticos, sugerencias de compra y staffing).
- Sistema de plugins + marketplace; API pública con webhooks.
- Widgets de dashboard configurables por usuario.
- Multi-país (impuestos configurables, monedas) para expansión internacional.
- SSO enterprise, base de datos dedicada por cliente enterprise, SLA y auditoría avanzada.

## Principios que rigen todas las fases

1. Nunca asumir comportamiento fijo cuando puede ser configurable.
2. El sistema se adapta al restaurante, no al revés.
3. Los dos stocks son independientes por defecto; el vínculo lo define el cliente.
4. Toda funcionalidad se puede habilitar/deshabilitar desde configuración.
5. Cada decisión técnica queda justificada en `docs/01-arquitectura.md`.
