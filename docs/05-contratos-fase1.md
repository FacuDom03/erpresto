# Contratos de API — Fase 1 (Salón, POS, Cocina, Caja)

Contrato compartido entre backend y frontend. Todos los endpoints requieren JWT salvo indicación; el `tenantId` sale siempre del token. Paginación: `?page=&limit=` → `{ data, total }`.

## Salón (áreas y mesas)

| Método | Ruta | Cuerpo / Notas | Permiso |
|---|---|---|---|
| GET | `/areas?branchId=` | Áreas con sus mesas embebidas (`tables[]` con layout completo) | `tables.view` |
| POST | `/areas` | `{branchId, name}` | `tables.update` |
| PATCH | `/areas/:id` | `{name?, sortOrder?}` | `tables.update` |
| DELETE | `/areas/:id` | Falla 409 si tiene mesas con pedidos abiertos | `tables.update` |
| POST | `/tables` | `{areaId, name, shape, capacity?, x?, y?, width?, height?, rotation?, color?}` | `tables.update` |
| PATCH | `/tables/:id` | Cualquier campo de layout + `status`, `name`, `capacity`, `areaId` | `tables.update` (layout) / `tables.view` para `status` operativo |
| DELETE | `/tables/:id` | 409 si tiene pedido abierto | `tables.update` |
| PUT | `/tables/layout` | `{tables: [{id, x, y, width, height, rotation}]}` guardado masivo del editor | `tables.update` |
| POST | `/tables/:id/merge` | `{intoTableId}` — une la mesa a otra (self-relation `mergedIntoId`) | `tables.view` |
| POST | `/tables/:id/split` | Separa la mesa de su grupo | `tables.view` |

`shape`: `ROUND | SQUARE | RECTANGLE | BOX | BAR | DECOR`. `status`: `FREE | RESERVED | OCCUPIED | WAITING_KITCHEN | WAITING_BILL | OUT_OF_SERVICE`.

## Pedidos (POS)

| Método | Ruta | Cuerpo / Notas | Permiso |
|---|---|---|---|
| POST | `/orders` | `{branchId, type, tableId?, peopleCount?, customerId?}` — crea pedido OPEN; si `tableId`, mesa → OCCUPIED; `waiterId` = usuario actual; 409 si la mesa ya tiene pedido abierto (devuelve el id existente en `error.orderId`) | `sales.create` |
| GET | `/orders?branchId=&status=&type=&tableId=` | Paginado, items embebidos | `sales.view` |
| GET | `/orders/:id` | Con items (+producto), pagos, mesa, cliente | `sales.view` |
| PATCH | `/orders/:id` | `{discount?, tip?, notes?, peopleCount?, tableId?, waiterId?}` — `tableId` = transferir mesa (vieja → FREE, nueva → OCCUPIED) | `sales.update` |
| POST | `/orders/:id/items` | `{items: [{productId, quantity, notes?}]}` — agrega PENDING, copia `unitPrice` del producto y `station` de `printStation`, recalcula totales | `sales.create` |
| PATCH | `/orders/:id/items/:itemId` | `{quantity?, notes?}` solo si PENDING; `{status: 'CANCELLED'}` si ya fue enviado requiere `sales.cancel` | `sales.create` |
| DELETE | `/orders/:id/items/:itemId` | Solo PENDING | `sales.create` |
| POST | `/orders/:id/send` | Items PENDING → SENT (`sentAt`), mesa → WAITING_KITCHEN | `sales.create` |
| POST | `/orders/:id/payments` | `{method, amount, reference?}` — pagos parciales/mixtos; se imputa a la sesión de caja abierta de la sucursal si existe | `sales.create` |
| DELETE | `/orders/:id/payments/:paymentId` | Solo con pedido OPEN | `sales.update` |
| POST | `/orders/:id/close` | Valida `pagos >= total`; pedido → CLOSED (`closedAt`), mesa → FREE, **descuenta stock según modo** (ver abajo) | `sales.create` |
| POST | `/orders/:id/cancel` | Pedido → CANCELLED, mesa → FREE; no descuenta stock | `sales.cancel` |

`type`: `DINE_IN | TAKEAWAY | DELIVERY | COUNTER`. `total = subtotal - discount + tip` (subtotal = Σ items no cancelados).

### Descuento de stock al cerrar (regla central)

Modo efectivo del producto: `Product.stockLinkMode`, y si es `INHERIT` se mapea desde `Tenant.stockMode`:
`RAW_ONLY → LINKED_AUTO` · `PRODUCTION_ONLY | BOTH_INDEPENDENT → INDEPENDENT` · `AUTO_CONVERSION → LINKED_AUTO` · `MANUAL_ASSISTED → LINKED_MANUAL` · `PER_PRODUCT → INDEPENDENT` (si el producto quedó INHERIT).

- `NONE` o `trackStock=false` → no descuenta nada.
- `INDEPENDENT` → `ProductStock -qty` + movimiento `SALE`.
- `LINKED_AUTO` → `ProductStock -qty` (`SALE`) y, **si existe receta activa**, descuenta materia prima (`SALE_CONSUME`, cantidad = qty × item.quantity / yieldQuantity) en el depósito default. Sin receta NO falla.
- `LINKED_MANUAL` → como `INDEPENDENT`; el asistente de confirmación manual llega en F2.

El stock puede quedar negativo (la operación nunca se bloquea por stock); las alertas son responsabilidad de UI/reportes.

## Cocina (KDS)

| Método | Ruta | Cuerpo / Notas | Permiso |
|---|---|---|---|
| GET | `/kitchen/items?branchId=&station=&statuses=SENT,PREPARING,READY` | Items activos con `{id, status, quantity, notes, product.name, station, sentAt, order: {id, number, type, table: {name}}}` ordenados por `sentAt` | `kitchen.view` |
| PATCH | `/kitchen/items/:id/status` | `{status}` — transiciones `SENT→PREPARING→READY→DELIVERED` (CANCELLED con `sales.cancel`); al pasar a READY setea `readyAt`; si todos los items del pedido ≥ READY y la mesa estaba WAITING_KITCHEN → OCCUPIED | `kitchen.update` |

## Caja

| Método | Ruta | Cuerpo / Notas | Permiso |
|---|---|---|---|
| GET | `/cash/registers?branchId=` | Cajas de la sucursal con `currentSession` embebida (o null) | `cash.view` |
| POST | `/cash/sessions/open` | `{registerId, openingAmount}` — 409 si ya hay sesión abierta | `cash.open` |
| GET | `/cash/sessions/:id` | Detalle + resumen: apertura, ventas por método de pago, movimientos, `expectedAmount` (apertura + ventas CASH + depósitos − retiros − gastos) | `cash.view` |
| POST | `/cash/sessions/:id/movements` | `{type: WITHDRAWAL\|DEPOSIT\|EXPENSE\|TIP, amount, notes?}` | `cash.manage` (o `cash.open`) |
| POST | `/cash/sessions/:id/close` | `{closingAmount}` → calcula `expectedAmount` y `difference`, status CLOSED | `cash.close` |
| GET | `/cash/sessions?registerId=&page=` | Historial de sesiones | `cash.view` |

## Realtime (WebSockets)

Socket.io, namespace `/realtime`, auth `{ token }` en el handshake. El cliente emite `join` `{branchId}` y queda en la room `branch:{branchId}` (validada contra los branchIds del JWT). Eventos del servidor (payload mínimo `{branchId, id}` — el cliente invalida queries):

- `table.updated` — cambio de estado/layout de mesa
- `order.updated` — pedido creado/modificado/cerrado
- `kitchen.updated` — item enviado o cambio de estado en cocina
- `cash.updated` — apertura/cierre/movimiento de caja

El frontend complementa con polling suave (refetchInterval 15s) como red de seguridad.
