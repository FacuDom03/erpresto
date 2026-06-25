# Contrato — Flujo de servicio estilo Toast (estaciones, marchado, entrega, cuenta)

Rediseño del flujo de pedidos para alinearlo con la operación real de un restaurante (modelo Toast POS). Complementa [05](05-contratos-fase1.md). Convenciones: JWT, `tenantId` del token.

## Concepto central: estación de preparación + "requiere preparación"

Cada producto se rutea a una **estación** y puede o no **requerir preparación**:

- `Product.printStation` (string, ya existe): nombre de la estación → `"Cocina"`, `"Barra"`, `"Parrilla"`, `"Postres"`… **Configurable libremente** (el restaurante define sus estaciones). Si es null/empty se trata como sin estación.
- `Product.requiresPreparation` (**nuevo**, boolean, default true):
  - `true` → el ítem se marcha a la pantalla (KDS) de su estación; la cocina/barra lo prepara (SENT→PREPARING→READY) y el **mozo** lo marca DELIVERED.
  - `false` → **no pasa por ninguna pantalla**: al marcharlo va directo a READY; lo entrega el mozo (ej. gaseosa/agua de la heladera). Es el caso de las bebidas que mencionó el usuario.

Defaults por categoría (para no cargar producto por producto):
- `Category.defaultStation` (**nuevo**, string nullable)
- `Category.defaultRequiresPreparation` (**nuevo**, boolean, default true)

Al crear un producto sin `printStation`/`requiresPreparation` explícitos, se heredan de su categoría.

## Cambios de schema (Prisma) → requiere migración

```prisma
model Category {
  // ...
  defaultStation             String?
  defaultRequiresPreparation Boolean @default(true)
}

model Product {
  // ... (printStation ya existe)
  requiresPreparation Boolean @default(true)
}

model OrderItem {
  // ... (station ya existe como snapshot)
  course      Int     @default(1)     // marchado por tiempos (1=entrada, 2=principal, 3=postre…)
  requiresPrep Boolean @default(true) // snapshot de Product.requiresPreparation al agregar el ítem
  firedAt     DateTime?               // cuándo se marchó (distinto de sentAt para retrocompat: usar firedAt)
}
```

El backend genera la migración con `prisma migrate dev --name service_flow` y la deja en `prisma/migrations`. Seed: asignar estaciones a las categorías demo (Bebidas → `"Barra"` con `defaultRequiresPreparation=false`; Entradas/Platos principales/Postres → `"Cocina"`), y a los productos (las bebidas embotelladas Coca/Agua `requiresPreparation=false`; "Cerveza artesanal pinta" → Barra `requiresPreparation=true`). Course por defecto según categoría: Entradas=1, Platos principales=2, Postres=3, Bebidas=1.

## Marchar (reemplaza "enviar a cocina")

`POST /orders/:id/fire` — body opcional `{ course?: number }`.
- Sin `course`: marcha **todos** los ítems PENDING del pedido.
- Con `course`: marcha solo los ítems PENDING de ese tiempo (marchado por tiempos).
- Por cada ítem marchado (transaccional):
  - `requiresPrep=true` → status **SENT**, `firedAt=now`. Aparece en el KDS de su `station`.
  - `requiresPrep=false` → status **READY**, `firedAt=now`, `readyAt=now` (no pasa por KDS).
  - **Descuento de stock AL MARCHAR** (ver sección Stock).
- Estado de mesa: pasa a `WAITING_KITCHEN` **solo si** al menos un ítem marchado tiene `requiresPrep=true`. Si solo se marcharon ítems sin preparación, la mesa queda como estaba (OCCUPIED).
- Emite `order.updated`, `kitchen.updated`, y `table.updated` si cambió la mesa.
- Mantener `POST /orders/:id/send` como alias de `fire` sin course (retrocompat del POS actual hasta que migre).

## KDS (cocina/barra) — solo prepara

- `GET /kitchen/items?branchId=&station=&statuses=` — sin cambios de forma; `station` ahora sí discrimina (Cocina vs Barra). Devolver además `course` y `requiresPrep`.
- `PATCH /kitchen/items/:id/status`: el KDS maneja **solo** `SENT → PREPARING → READY`. **Ya no acepta DELIVERED** (devuelve 400 si lo piden). CANCELLED sigue requiriendo `sales.cancel`. Al pasar a READY: `readyAt=now` y emitir `kitchen.updated` (notificación al mozo). La lógica de "todos los ítems de la mesa READY → mesa OCCUPIED" se mantiene.

## Mozo entrega (nuevo, en el POS)

`PATCH /orders/:id/items/:itemId/deliver` (permiso `sales.update`): mueve `READY → DELIVERED`, setea `deliveredAt`. 400 si el ítem no está READY. Emite `order.updated`.
`POST /orders/:id/deliver-all` (permiso `sales.update`): marca DELIVERED todos los ítems READY del pedido. Útil para cerrar la entrega de una mesa.

## Pedir la cuenta (nuevo)

- `POST /orders/:id/request-bill` (permiso `sales.update`): si el pedido está OPEN y tiene mesa → mesa `WAITING_BILL`. Emite `table.updated` y `order.updated`. (La precuenta se imprime en el frontend; el backend solo refleja el estado.)
- `POST /orders/:id/cancel-bill-request` (permiso `sales.update`): revierte WAITING_BILL → OCCUPIED.
- Al **cerrar** el pedido (`/close`) o **cancelarlo**, la mesa pasa a FREE (sin cambios respecto de hoy).

## Stock: descontar AL MARCHAR (cambia el timing)

El descuento de stock **se mueve de `/close` a `/fire`**. Reglas:
- Se descuenta una sola vez por ítem, en el momento en que se marcha (PENDING→SENT/READY). `/close` **ya no descuenta stock**.
- El modo efectivo por producto es el mismo de hoy (`Product.stockLinkMode` con mapeo `INHERIT`→`Tenant.stockMode`): `NONE`/`trackStock=false` no descuenta; `INDEPENDENT` descuenta `ProductStock` (mov. `SALE`); `LINKED_AUTO` descuenta `ProductStock` y, si hay receta activa, materia prima (`SALE_CONSUME`); `LINKED_MANUAL` como INDEPENDENT. `reference = order.id`.
- **Anulación de un ítem ya marchado** (`status` distinto de PENDING → CANCELLED, con `sales.cancel`): **revierte** el descuento de stock de ese ítem (crea movimientos inversos `ADJUSTMENT`/devolución por la cantidad del ítem; producción y, si aplicó, materia prima). Se considera que un ítem marchado por error no debe descontar stock. Registrar en AuditLog.
- Marcar un ítem como `firedAt` ya seteado evita doble descuento (idempotencia): solo descuentan los ítems que transicionan desde PENDING en esta llamada.

## Frontend

- **Form de productos** (`/productos` y alta desde POS): selector de **Estación** (texto libre con sugerencias Cocina/Barra/Parrilla/Postres) y toggle **"Requiere preparación"**. Mostrar que por defecto se hereda de la categoría.
- **Form de categorías** (`/categorias`): campos **Estación por defecto** y **Requiere preparación por defecto**.
- **POS** (`/pos/[orderId]`):
  - Asignar **tiempo/course** a cada ítem (1/2/3…) y botón **"Marchar"** que puede marchar todo o por tiempo. El botón actual "Enviar a cocina" pasa a "Marchar".
  - Mostrar el estado de cada ítem (Pendiente/Enviado/Preparando/Listo/Entregado) y, cuando un ítem está **Listo**, resaltar y permitir **"Entregar"** (por ítem) y **"Entregar todo"**.
  - Acción **"Pedir cuenta"** (→ request-bill, mesa Esperando cuenta) y **"Imprimir precuenta"** (vista de impresión del ticket sin valor fiscal).
- **KDS** (`/cocina`): selector/segmentación por **estación** (Cocina, Barra) para que cada pantalla muestre lo suyo; los botones de avance llegan solo hasta **Listo** (la entrega ya no se hace desde el KDS).

## Verificación E2E (backend, contra PostgreSQL real)
1. Migración aplicada + seed con estaciones (Bebidas→Barra/no-prep).
2. Pedido con: 1 Rabas (Cocina, prep, course 1), 1 Milanesa (Cocina, prep, course 2), 1 Coca (Barra, no-prep), 1 Cerveza (Barra, prep).
3. `fire` sin course → Rabas/Milanesa/Cerveza quedan SENT; Coca queda READY directo; mesa WAITING_KITCHEN. **Stock descontado al marchar** (verificar ProductStock y, si Rabas tiene receta, materia prima).
4. KDS `?station=Cocina` muestra Rabas+Milanesa; `?station=Barra` muestra Cerveza (no la Coca). KDS no deja pasar a DELIVERED (400).
5. Cocina: Rabas/Milanesa → READY. Mozo: `deliver` de cada ítem READY → DELIVERED. `deliver-all`.
6. `request-bill` → mesa WAITING_BILL. `close` → mesa FREE; **close NO vuelve a descontar stock** (verificar que el stock quedó igual que tras el fire).
7. Anular un ítem ya marchado → su stock se revierte.
8. Probar marchado por tiempos: `fire {course:1}` marcha solo la entrada; `fire {course:2}` marcha el principal después.
