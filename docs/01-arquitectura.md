# Arquitectura — ERPresto

ERP gastronómico SaaS multi-tenant para restaurantes, bares, cafeterías y cadenas del mercado argentino.

## Visión general

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTES                              │
│  PWA (POS táctil, app mozos, KDS, back-office, dashboard)   │
│  Next.js + React + TypeScript + Tailwind + shadcn/ui        │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / WebSockets
┌──────────────────────────┴──────────────────────────────────┐
│                      API (NestJS)                            │
│  Clean Architecture · módulos por dominio · CQRS donde      │
│  aporta valor · eventos de dominio · RBAC · multi-tenant    │
├──────────────┬───────────────┬───────────────┬──────────────┤
│  PostgreSQL  │     Redis     │    BullMQ     │  S3 storage  │
│  (Prisma)    │  cache/pubsub │  jobs/colas   │  imágenes    │
└──────────────┴───────────────┴───────────────┴──────────────┘
```

## Decisiones técnicas y su justificación

| Decisión | Justificación |
|---|---|
| **Monorepo simple (`apps/api`, `apps/web`)** | Un solo repo para todo el producto facilita refactors cross-stack y CI unificado. Cada app es standalone (sin hoisting de workspaces) para builds Docker reproducibles. |
| **NestJS + Prisma** | NestJS impone módulos, inyección de dependencias y guards — el encaje natural para RBAC y multi-tenancy. Prisma da tipado end-to-end del schema y migraciones versionadas. |
| **PostgreSQL único con `tenantId` (row-level)** | Para miles de tenants pequeños/medianos, una base compartida con discriminador es la opción más operable y barata. El aislamiento se refuerza en capa de aplicación (el `tenantId` sale SIEMPRE del JWT, nunca del request). Camino de evolución: RLS de Postgres y, para clientes enterprise, base dedicada. |
| **UUIDs como PK en todas las tablas** | Requisito del modo offline: los IDs deben poder generarse en el cliente/nodo local sin coordinación con el servidor. |
| **Eventos + outbox (`SyncEvent`)** | Cada mutación operativa registra un evento con `version`, `deviceId` y `occurredAt`. Es la base tanto de la sincronización offline como de la auditoría y de futuros consumidores (BI, notificaciones). |
| **Redis + BullMQ** | Cache de lecturas calientes (cartas, layouts de salón), pub/sub para WebSockets multi-instancia, y colas para trabajos diferidos (facturación ARCA, emails, reportes pesados). |
| **PWA en lugar de apps nativas** | Un solo código para POS, mozos y KDS. Instalable, con cache offline (service worker) y actualización automática. |

## Multi-tenancy

- Toda tabla operativa lleva `tenantId` (directo o vía su agregado padre).
- El JWT de acceso incluye `tenantId`, `permissions[]` y `branchIds[]`.
- Un guard global resuelve el contexto de tenant por request; los servicios filtran por ese contexto. **Ningún endpoint acepta `tenantId` por body o query.**
- Jerarquía: `Tenant (empresa) → Branch (sucursal) → recursos operativos (mesas, caja, depósitos, pedidos)`. Los catálogos (productos, materias primas, clientes, proveedores, roles) viven a nivel tenant y se comparten entre sucursales; el stock y la operación son por sucursal. La empresa consolida reportes sumando sucursales.

## RBAC

- Catálogo global de permisos granulares (`products.create`, `cash.open`, `costs.view`, `sales.cancel`, …) agrupados por módulo.
- Roles de sistema predefinidos (Dueño, Administrador, Gerente, Supervisor, Encargado, Cajero, Mozo, Ayudante, Cocina, Bartender, Compras, Depósito, Contador, Repartidor) + roles custom por tenant.
- Cada permiso puede activarse individualmente en un rol. La autorización se evalúa en un `PermissionsGuard` con metadata por endpoint (`@RequirePermissions(...)`).

## Doble stock independiente (regla de negocio central)

Dos subsistemas que **no tienen relación obligatoria**:

1. **Materia prima** (`RawMaterial`, `Warehouse`, `StockBatch`, `RawStockMovement`): compras, lotes, vencimientos, mermas, transferencias, inventarios. Funciona 100% solo.
2. **Producción/platos** (`ProductStock`, `ProductStockMovement`, `ProductionOrder`): el chef carga "20 rabas, 15 milanesas"; la venta descuenta 1 a 1. Funciona 100% solo.

La vinculación es **opcional** vía `Recipe` (motor de conversión) y se configura en dos niveles:

- `Tenant.stockMode` (global): `RAW_ONLY`, `PRODUCTION_ONLY`, `BOTH_INDEPENDENT`, `AUTO_CONVERSION`, `MANUAL_ASSISTED`, `PER_PRODUCT`.
- `Product.stockLinkMode` (por producto, cuando el modo global es `PER_PRODUCT` o como override): `INHERIT`, `NONE`, `INDEPENDENT`, `LINKED_AUTO`, `LINKED_MANUAL`.

El sistema **jamás impone** la relación: si un producto no tiene receta, la producción y la venta operan solo sobre el stock de platos sin error alguno.

## Offline first (arquitectura objetivo)

- **Nodo local por sucursal**: un servicio instalable (misma API NestJS + Postgres local en Docker) contra el que operan todos los dispositivos de la sucursal por LAN. Internet no es requisito para vender, comandar, imprimir ni cobrar.
- **Sincronización**: cada movimiento lleva UUID, `occurredAt`, `userId`, `deviceId`, `branchId` y `version`. El nodo local empuja su outbox (`SyncEvent`) a la nube cuando hay conectividad y recibe los cambios remotos. Conflictos: last-write-wins por versión para entidades de catálogo; los movimientos (ventas, stock, caja) son **append-only e inmutables**, por lo que nunca colisionan ni se pierden — el estado se deriva de la suma de movimientos.
- **PWA**: service worker con cache de assets y cola local de mutaciones para cortes breves cuando se opera directo contra la nube.
- **Impresión**: el nodo local habla con impresoras térmicas por red/USB (ESC/POS), sin depender de Internet.

## Realtime

WebSockets (Socket.io sobre Redis adapter) con rooms por sucursal: estado de mesas, comandas a cocina (KDS), avisos al mozo cuando un plato está listo, actualización de caja.

## Seguridad

- OWASP top 10 como checklist permanente: ValidationPipe global con whitelist (mass-assignment), Prisma parametrizado (SQLi), helmet (headers), rate limiting con Throttler, CORS restringido.
- Contraseñas con bcrypt; refresh tokens rotados y almacenados hasheados (sha256) en `Session` con auditoría de IP, dispositivo y navegador. 2FA opcional (TOTP, campo previsto en `User`).
- `AuditLog` para acciones sensibles (anulaciones, cambios de precio/costo, apertura/cierre de caja).

## Escalabilidad

- API stateless → réplicas horizontales detrás de un load balancer (preparado para Kubernetes).
- Redis para cache de catálogo y layouts; índices por `tenantId` en todas las consultas calientes.
- Lecturas de reportes pesados por réplica de lectura / jobs en BullMQ.
- Cuando un módulo lo amerite (facturación ARCA, sync engine), puede extraerse a servicio propio: los límites de módulo de NestJS + eventos de dominio dejan ese corte preparado.

## Extensibilidad (plugins)

Toda mutación relevante emite eventos de dominio. El futuro sistema de plugins se suscribe a esos eventos y expone hooks de UI declarativos, sin tocar el núcleo. Las integraciones (Mercado Pago, PedidosYa, Rappi, MODO, WhatsApp) se implementan como adaptadores sobre puertos definidos en el dominio (`PaymentProvider`, `DeliveryChannel`, `NotificationChannel`).
