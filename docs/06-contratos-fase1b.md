# Contratos de API — Fase 1b (Recetas y costos, stock, proveedores)

Complemento de [05-contratos-fase1.md](05-contratos-fase1.md). Mismas convenciones: JWT obligatorio, `tenantId` desde el token, paginación `?page=&limit=` → `{ data, total }`.

## Recetas y costos

El costo de una receta se calcula server-side a partir del `avgCost` de cada insumo:
`ingredientsCost = Σ( quantity × (1 + wastePercent/100) × rawMaterial.avgCost )` · `unitCost = ingredientsCost / yieldQuantity` · `margin = price − unitCost` · `marginPercent = margin / price × 100` (null si price = 0).

| Método | Ruta | Cuerpo / Notas | Permiso |
|---|---|---|---|
| GET | `/recipes?search=&page=&limit=` | Productos del tenant con resumen de costo: `{id, name, price, categoryName, hasRecipe, active(receta), unitCost, marginPercent}` (`unitCost`/`marginPercent` null sin receta) | `costs.view` |
| GET | `/products/:id/recipe` | `{recipe: {yieldQuantity, active, items: [{id, rawMaterialId, quantity, wastePercent, rawMaterial: {id, name, unit, avgCost}}]} \| null, cost: {ingredientsCost, unitCost, price, margin, marginPercent} \| null}` | `costs.view` |
| PUT | `/products/:id/recipe` | `{yieldQuantity, active?, items: [{rawMaterialId, quantity, wastePercent?}]}` — reemplaza la receta completa (upsert + delete de items ausentes, transaccional). Valida insumos del tenant | `recipes.update` |
| DELETE | `/products/:id/recipe` | Elimina la receta (el producto pasa a operar 100% independiente) | `recipes.update` |

## Stock (endpoints ya existentes — referencia para el frontend)

- `GET /raw-materials?search=&page=&limit=` → insumos con `totalStock` (suma de lotes) y desglose por depósito; campos `name, unit, category, minStock, avgCost, lastCost`.
- `POST /raw-materials` / `PATCH /raw-materials/:id` / `DELETE /raw-materials/:id` (permisos `stock.*`).
- `POST /raw-materials/:id/adjust` `{warehouseId, quantity (+/−), type: ADJUSTMENT|WASTE|INVENTORY, unitCost?, notes?}`.
- `GET /warehouses?branchId=` (si no existe, exponerlo: lista de depósitos de la sucursal) — `stock.view`.
- `GET /product-stock?branchId=` → `[{productId, product: {name, ...}, quantity}]`.
- `POST /product-stock/production` `{branchId, consumeRawMaterials, notes?, items: [{productId, quantity}]}`.
- `POST /product-stock/adjust` `{branchId, productId, quantity (+/−), type: MANUAL|ADJUSTMENT|WASTE, notes?}`.

## Proveedores

CRUD `/suppliers` (permisos `suppliers.view/create/update/delete`): `{name, cuit?, contactName?, phone?, email?, address?, deliveryDays?, rating? (1-5), notes?, active}`. GET paginado con `search` por nombre/CUIT. DELETE → soft (active=false) si tiene órdenes de compra, hard si no.

## Categorías (ya existente — referencia)

CRUD `/categories`: `{name, color?, sortOrder?, parentId?}` — GET devuelve árbol plano con `parentId`.
