# Contratos de API — Fase 2 (Compras, Dashboard, Reservas, Clientes)

Complemento de [05](05-contratos-fase1.md) y [06](06-contratos-fase1b.md). Mismas convenciones: JWT, `tenantId` del token, paginación `{ data, total }`.

## Compras

| Método | Ruta | Cuerpo / Notas | Permiso |
|---|---|---|---|
| GET | `/purchase-orders?branchId=&status=&supplierId=&search=&page=&limit=` | Con `supplier: {id, name}`, `itemsCount`, totales | `purchases.view` |
| GET | `/purchase-orders/:id` | Con items (+`rawMaterial: {name, unit}`), proveedor, sucursal | `purchases.view` |
| POST | `/purchase-orders` | `{branchId, supplierId, expectedAt?, notes?, items: [{rawMaterialId, quantity, unitCost}]}` → DRAFT, `number` correlativo por tenant (transacción + retry como Order), `total` calculado server-side | `purchases.create` |
| PATCH | `/purchase-orders/:id` | `{supplierId?, expectedAt?, notes?, items?}` (items reemplaza todo) — **solo DRAFT** | `purchases.update` |
| POST | `/purchase-orders/:id/send` | DRAFT → SENT | `purchases.update` |
| POST | `/purchase-orders/:id/receive` | `{warehouseId, items: [{itemId, quantity, unitCost?, lotCode?, expiresAt?}]}` — recepción **parcial o total** (solo SENT/PARTIALLY_RECEIVED). Por cada item recibido, transaccional: crea `StockBatch` (lote/vencimiento si vienen) + `RawStockMovement` tipo PURCHASE (`reference` = OC id), suma `receivedQty` (422 si excede lo pendiente), actualiza `lastCost` y **`avgCost` por promedio ponderado**: `avgCost' = (stockTotal×avgCost + qty×unitCost) / (stockTotal+qty)`; si `stockTotal ≤ 0` → `avgCost' = unitCost`. `unitCost` default: el de la OC. Estado → PARTIALLY_RECEIVED, o RECEIVED si todos los items quedaron completos | `purchases.receive` |
| POST | `/purchase-orders/:id/cancel` | Solo DRAFT o SENT | `purchases.update` |

## Dashboard

`GET /dashboard/summary?branchId=` (permiso `dashboard.view`). **Si se omite `branchId`: consolidado de todas las sucursales del tenant.** Día = hoy en TZ de la sucursal (o America/Argentina/Buenos_Aires para consolidado). Solo pedidos CLOSED salvo indicación:

```jsonc
{
  "salesToday": { "total": 0, "count": 0, "avgTicket": 0 },
  "salesByMethod": [ { "method": "CASH", "total": 0 } ],          // hoy
  "weekSales": [ { "date": "2026-06-05", "total": 0 } ],          // últimos 7 días incl. hoy
  "topProducts": [ { "name": "", "quantity": 0, "total": 0 } ],   // top 5 últimos 7 días
  "openOrders": 0,
  "tables": { "occupied": 0, "total": 0 },                        // total excluye DECOR y inactivas
  "cash": { "open": true, "expectedAmount": 0 } /* o null */,     // consolidado: sesiones abiertas sumadas
  "criticalRawMaterials": { "count": 0, "items": [ { "name": "", "totalStock": 0, "minStock": 0, "unit": "KG" } ] },  // top 5 bajo mínimo
  "criticalProducts": { "count": 0, "items": [ { "name": "", "quantity": 0, "minStock": 0 } ] },
  "upcomingReservations": 0                                        // próximas 24 h no canceladas
}
```

## Clientes

CRUD `/customers` (permisos `customers.view/create/update/delete`): campos del modelo (`name, email?, phone?, taxId?, birthday?, address?, notes?`). GET paginado con `search` (nombre/teléfono/email, insensitive). `GET /customers/:id` incluye `stats: {ordersCount, totalSpent, lastOrderAt}` (pedidos CLOSED). DELETE soft (`active=false`) si tiene pedidos/reservas, hard si no.

## Reservas

| Método | Ruta | Cuerpo / Notas | Permiso |
|---|---|---|---|
| GET | `/reservations?branchId=&from=&to=&status=&page=&limit=` | `from`/`to` ISO sobre `scheduledAt` (default: hoy). Con `table: {id, name}` y `customer: {id, name}` | `reservations.view` |
| POST | `/reservations` | `{branchId, name, phone?, partySize, scheduledAt, tableId?, customerId?, notes?, status?}` (default PENDING; valida mesa y cliente del tenant) | `reservations.create` |
| PATCH | `/reservations/:id` | Cualquier campo + `status` (PENDING↔CONFIRMED; CANCELLED y NO_SHOW desde cualquiera no-final) | `reservations.update` |
| POST | `/reservations/:id/seat` | `{tableId?}` (usa el de la reserva si no viene; 400 si no hay) → status SEATED y mesa → OCCUPIED (409 si la mesa está OCCUPIED/WAITING_*) | `reservations.update` |

Al crear/confirmar una reserva con mesa asignada cuyo `scheduledAt` está dentro de las próximas 2 horas, si la mesa está FREE → pasarla a RESERVED (bloqueo automático). Al cancelar/no-show/sentar, si la mesa quedó RESERVED por esta reserva → volverla a FREE (salvo seat, que la ocupa). Emitir `table.updated` por realtime en esos casos.

Permisos: verificar en seed `purchases.view/create/update/receive`, `customers.*`, `reservations.*`, `dashboard.view` — agregar los faltantes y asignarlos a roles razonables (Compras y Depósito: purchases.*; Mozo: reservations.view/create/update + customers.view/create; Cajero: customers.*).
