# Contratos de API — Fase 3 (Facturación ARCA, Mercado Pago, Delivery, Reportes)

Complemento de [05](05-contratos-fase1.md), [06](06-contratos-fase1b.md) y [07](07-contratos-fase2.md). Mismas convenciones: JWT, `tenantId` del token, paginación `{ data, total }`, Decimals devueltos como números.

> **Nota de entorno:** no hay credenciales reales de ARCA/AFIP ni de Mercado Pago. Ambas integraciones usan el patrón **puerto + proveedor**: un proveedor real preparado (activado por env) y un proveedor **mock por defecto**. El código productivo queda listo para enchufar credenciales sin tocar la lógica de negocio.

## 1. Facturación ARCA

Configuración fiscal en `Tenant.settings.fiscal`: `{ cuit, pointOfSale (int), ivaCondition: 'RI'|'MONOTRIBUTO'|'EXENTO' }`. El modelo `Invoice` ya existe.

### Tipo de comprobante (según condición del emisor y del cliente)
- Emisor RI + cliente con CUIT (RI) → **FACTURA_A**
- Emisor RI + cliente consumidor final / sin CUIT → **FACTURA_B**
- Emisor Monotributo/Exento → **FACTURA_C**
- Nota de crédito: `NOTA_CREDITO_{A|B|C}` espejando la factura origen.

### Puerto `ArcaProvider`
```ts
interface ArcaProvider {
  requestCae(input: ArcaInvoiceInput): Promise<
    | { approved: true; cae: string; caeExpiry: Date }
    | { approved: false; reason: string }
  >;
}
```
- `MockArcaProvider` (default): CAE simulado de 14 dígitos, `caeExpiry` = hoy + 10 días, registra el `arcaPayload` que se habría enviado. Siempre aprueba salvo datos inválidos.
- `WsfeArcaProvider` (activado si `ARCA_CUIT` + `ARCA_CERT_PATH` + `ARCA_KEY_PATH` están en env): esqueleto WSAA (login ticket cacheado) + WSFEv1 `FECAESolicitar`. Si las credenciales faltan, el factory devuelve el mock. Documentar TODOs de homologación.

### Endpoints (permiso `invoices.*` — verificar/crear en seed)
| Método | Ruta | Notas | Permiso |
|---|---|---|---|
| GET | `/invoices?branchId=&type=&status=&from=&to=&search=&page=&limit=` | Con `customer`, `order.number`, montos | `invoices.view` |
| GET | `/invoices/:id` | Detalle con líneas (desglose IVA), CAE, payload ARCA | `invoices.view` |
| POST | `/invoices/from-order/:orderId` | Crea factura desde un pedido **CLOSED**: tipo auto, líneas desde `OrderItem`, IVA por `Product.taxRate`, numeración correlativa por `(pointOfSale, type)` (transacción + retry), llama al provider → ISSUED con CAE o REJECTED. Body opcional `{customerId?, type?}` para override. 409 si el pedido ya tiene factura ISSUED | `invoices.create` |
| POST | `/invoices/:id/credit-note` | NC total (o `{items?}` parcial) espejando la factura ISSUED, su propio CAE | `invoices.create` |

`netAmount`, `taxAmount`, `totalAmount` calculados server-side. Líneas: precio con IVA incluido (criterio AR) → se desglosa neto + IVA por alícuota.

## 2. Mercado Pago (QR dinámico)

Config en `Tenant.settings.mercadopago`: `{ enabled }`; token real en env `MERCADOPAGO_ACCESS_TOKEN`.

### Puerto `MercadoPagoProvider`
```ts
createQrPayment(input): Promise<{ externalId: string; qrData: string }>  // qrData = string a renderizar como QR
getStatus(externalId): Promise<'pending' | 'approved' | 'rejected'>
```
- `MockMercadoPagoProvider` (default): `qrData` = URL ficticia, marca `approved` automáticamente ~10 s después de creado (simula el pago del cliente).
- `RealMercadoPagoProvider` (si hay token): API de pagos QR / órdenes.

### Endpoints
| Método | Ruta | Notas | Permiso |
|---|---|---|---|
| POST | `/orders/:id/mp-payment` | `{amount}` → crea intención + QR. Devuelve `{externalId, qrData, amount, status}`. Persiste la intención (en `arcaPayload`-style: usar tabla nueva NO; guardar en memoria/registro liviano — ver nota) | `sales.create` |
| GET | `/mp-payments/:externalId/status` | Polling: `{status}`; si `approved` y aún no registrado, crea `Payment` method MERCADOPAGO sobre el pedido y emite `order.updated` (idempotente) | `sales.view` |
| POST | `/webhooks/mercadopago` | **Público**. Notificación de MP; valida firma si hay token real; al aprobar registra el `Payment` (idempotente por `externalId`) y emite `order.updated` | — |

> **Persistencia de la intención MP:** sin cambios de schema, guardar la relación `externalId → {orderId, amount, status}` en `Payment.reference` al confirmarse, y mantener las intenciones pendientes en un store en memoria del provider (suficiente para mock/demo; el real reconcilia por webhook). Documentar como deuda técnica para una tabla `MpPayment` en F4.

## 3. Delivery

`DeliveryInfo` ya existe (PENDING→ASSIGNED→IN_TRANSIT→DELIVERED/CANCELLED, `courierId`, `estimatedAt`, `deliveredAt`).

| Método | Ruta | Notas | Permiso |
|---|---|---|---|
| PUT | `/orders/:id/delivery` | `{address, notes?, estimatedAt?}` upsert de la info de delivery del pedido (tipo DELIVERY) | `sales.create` |
| GET | `/deliveries?branchId=&status=` | Tablero: pedidos DELIVERY con `delivery`, `order.number`, `total`, `customer`, `courier:{id,name}` | `sales.view` |
| GET | `/users?role=courier&branchId=` | Usuarios con rol Repartidor de la sucursal (para asignar) | `sales.view` |
| POST | `/deliveries/:id/assign` | `{courierId}` → status ASSIGNED | `delivery.manage` (o `sales.update`) |
| PATCH | `/deliveries/:id/status` | `{status}` transiciones válidas; DELIVERED setea `deliveredAt`. Emite `order.updated` | `delivery.manage` (o `sales.update`) |

`:id` de deliveries = `order.id` (relación 1-1). Crear el rol/permiso `delivery.manage` o reutilizar `sales.update` — preferir reutilizar para no inflar; exponer permiso nuevo solo si es limpio.

## 4. Reportes exportables

Todos `GET /reports/{key}` con permiso `reports.view`, query `?branchId=&from=&to=&groupBy=&format=`. Sin `format` → JSON `{ columns: [{key,label,type}], rows: [{...}], totals: {...} }` (forma genérica para render). Con `format=csv|xlsx|pdf` → archivo (`Content-Disposition: attachment`).

| key | Contenido |
|---|---|
| `sales` | Ventas por día/sucursal/método (groupBy: `day`\|`method`\|`type`), totales de monto y cantidad |
| `products` | Productos vendidos (cantidad, total, margen si hay costo) en el rango |
| `waiters` | Ventas por mozo (pedidos, total, ticket promedio) |
| `cash` | Sesiones de caja (apertura, ventas, esperado, diferencia) |
| `stock` | Existencias actuales de materia prima y producción + movimientos del rango |
| `purchases` | Compras por proveedor (órdenes, total, recibido) |

- CSV: nativo (sin dep). XLSX: `exceljs`. PDF: `pdfkit` (tabla simple con encabezado del tenant y rango).
- Fechas en TZ de la sucursal (usar `src/common/utils/timezone.ts`).
- Frontend descarga el blob con el header `Authorization` (fetch → blob → `URL.createObjectURL`), nombre `reporte-{key}-{from}-{to}.{ext}`.

## Permisos a verificar/crear en seed
`invoices.view`, `invoices.create`, `reports.view`, y `delivery.manage` (si se opta por permiso propio). Asignaciones: Contador → invoices.* + reports.view; Cajero → invoices.create; Repartidor → ve sus deliveries (sales.view) y actualiza estado; Dueño/Admin/Gerente → todo.
