# Contrato — Catálogo central de estaciones + KDS con estación fija por pantalla

Objetivo: (1) que cada pantalla del KDS recuerde su estación (montaje de pantallas fijas), y (2) un catálogo central de estaciones por empresa, elegible desde un desplegable, para evitar inconsistencias de texto libre ("Barra" vs "barra"). **Sin migración**: el catálogo se guarda en `Tenant.settings.stations`.

## Backend

### Catálogo de estaciones (en `Tenant.settings.stations: string[]`)
- `GET /stations` (autenticado): `{ stations: string[] }`.
  - Si `settings.stations` tiene contenido → devolverlo.
  - Si está vacío/ausente → devolver la **unión** de las estaciones distintas ya usadas en `Product.printStation` y `Category.defaultStation` del tenant; si aún así queda vacío → `["Cocina", "Barra"]`. (Nunca devolver vacío y no perder estaciones ya en uso.)
- `PUT /stations` (permiso `settings.manage`): body `{ stations: string[] }`.
  - Validar/normalizar: `trim`, descartar vacíos, **dedupe case-insensitive** (conservar la primera forma escrita), máx 50.
  - Guardar en `tenant.settings.stations` **haciendo merge** del resto de `settings` (NO pisar otras claves).
  - Devolver `{ stations }`.
- Implementar en el módulo `tenants` (ya existe, con `settings.manage` en `PATCH /tenants/me`) o un módulo `stations` pequeño, a criterio, limpio.
- **Seed**: en el tenant demo, setear `settings.stations = ["Cocina", "Barra"]` (merge, sin pisar otras settings). Re-corré el seed (idempotente).

## Frontend

### 1. Configuración de estaciones — `/configuracion` (hoy placeholder)
Sección "Estaciones de preparación": lista desde `GET /stations`, con agregar (input + botón), renombrar inline, eliminar, y **Guardar** (`PUT /stations`). Texto de ayuda: "Las estaciones definen a qué pantalla/puesto se rutea cada comanda. Asigná la estación de cada producto desde su ficha." Requiere permiso `settings.manage` (si el usuario no lo tiene, mostrar solo lectura).

### 2. Form de productos (dialog de alta/edición)
El campo **Estación** pasa de texto libre (datalist) a un **Select** poblado con `GET /stations`, con dos opciones especiales arriba:
- `""` → "Heredar de la categoría" (default).
- un valor centinela para "Sin estación (la entrega el mozo)" — o dejar que esto lo exprese el toggle `requiresPreparation` ya existente; mantené la semántica actual: estación vacía = hereda. No reintroducir texto libre.
Nota al pie: "¿Falta una estación? Agregala en Configuración → Estaciones."

### 3. Form de categorías
`defaultStation` también como **Select** desde `GET /stations` (con opción "Sin definir" = "").

### 4. KDS `/cocina` — estación fija por pantalla
- El selector de estación se puebla con `GET /stations` (todas las configuradas, **no solo** las derivadas de los ítems presentes) + opción "Todas".
- **Persistencia de la estación elegida**:
  - Estación inicial: primero `?station=` de la URL; si no hay, `localStorage` con clave `erpresto.kds.station.<branchId>`; si no hay, "Todas".
  - Al cambiar la estación: actualizar la URL con `replace` (sin recargar la página) **y** `localStorage`.
  - Resultado: una pantalla fija recuerda su estación tras refresco/reinicio, y se puede dejar bookmarkeada como `/cocina?station=Barra`.
- Mantener el resto del KDS igual (avance de estado solo hasta Listo, timers, course).

## Verificación
- **Backend** (PostgreSQL local, login admin@demo.com / Admin123!): `GET /stations` default; `PUT /stations` con duplicados y distinta capitalización → dedupe; verificar que otras claves de `settings` quedan intactas tras el PUT; `PUT` sin `settings.manage` → 403.
- **Frontend**: `tsc --noEmit` + build. En vivo: configurar estaciones en /configuracion; ver el Select poblado en el form de productos y de categorías; en el KDS, elegir "Barra", refrescar (F5) y que **siga en Barra**; abrir `/cocina?station=Cocina` y que arranque en Cocina.
