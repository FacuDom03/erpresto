# Módulos funcionales — ERPresto

Estado: ✅ implementado · 🔜 fase planificada (ver [roadmap](04-roadmap.md)).

> **Actualización (Fases 1–3 entregadas).** Las tablas de abajo reflejan el plan original de la Fase 0. Desde entonces se implementaron y verificaron contra base real: editor visual y mapa operativo del salón, POS con pagos mixtos, KDS, caja con arqueo, recetas con costos y márgenes, compras con costo promedio ponderado, reservas, clientes, dashboard real, facturación ARCA (mock activo + adaptador real WSFEv1 preparado), Mercado Pago (QR), delivery y reportes exportables (CSV/Excel/PDF). El [roadmap](04-roadmap.md) es la fuente de verdad del estado por fase.

## Plataforma

| Módulo | Alcance | Estado |
|---|---|---|
| **Autenticación** | Login, logout, refresh token rotado, registro de empresa, auditoría de sesiones (IP, dispositivo, navegador, fecha/hora). 2FA TOTP opcional. | ✅ (2FA 🔜 F1) |
| **RBAC** | Catálogo de ~50 permisos granulares, 14 roles de sistema, roles custom por tenant, activación individual de cada permiso. | ✅ |
| **Multi-tenant / multisucursal** | Aislamiento por tenant en toda la API; sucursales con caja, depósito, mesas y stock propios; consolidación a nivel empresa. | ✅ |
| **Configuración** | `settings` por tenant y sucursal; modo de stock global y por producto; toda funcionalidad activable/desactivable. | ✅ base |

## Operación

| Módulo | Alcance | Estado |
|---|---|---|
| **Catálogo** | Categorías jerárquicas, productos con precio, IVA, estación de impresión, imagen, modo de stock individual. | ✅ |
| **Stock materia prima** | Insumos por unidad de medida, depósitos por sucursal, lotes con vencimiento, movimientos (compra, ajuste, merma, transferencia, inventario), costos promedio/último. | ✅ núcleo |
| **Stock producción** | Carga de producción del chef ("+20 rabas"), descuento por venta, ajustes, mermas. **Independiente de materia prima por diseño.** | ✅ núcleo |
| **Motor de conversión** | Recetas con rinde y merma por ingrediente. Opcional, configurable por producto: heredar, sin stock, independiente, automático, manual asistido. | ✅ núcleo |
| **Editor visual del salón** | Drag & drop de mesas (redondas, cuadradas, rectangulares, boxes, barra) y objetos decorativos; mover, rotar, redimensionar, color, capacidad; persistencia. Modelo de datos ✅. | 🔜 F1 |
| **Mapa operativo** | Estados en tiempo real (libre, reservada, ocupada, esperando cocina, esperando cuenta, fuera de servicio), unir/separar mesas, transferir pedidos, cambiar mozo. | 🔜 F1 |
| **POS** | Modo táctil; mesa/delivery/take away/mostrador; dividir y unificar cuentas; propinas, descuentos, pagos parciales y mixtos (efectivo, tarjetas, QR, Mercado Pago, transferencia); reimpresión y anulación con permiso. | 🔜 F1 |
| **App mozos** | PWA móvil: ver mesas, tomar y modificar pedidos, enviar a cocina, observaciones, pedir cuenta, cobrar. | 🔜 F2 |
| **KDS** | Pantalla de cocina por estación: comandas con mesa, observaciones, tiempo y prioridad; estados pendiente→preparando→listo→entregado; notificación automática al mozo. | 🔜 F2 |
| **Caja** | Apertura/cierre con arqueo, retiros, gastos, diferencia esperado vs. real, multiple cajas por sucursal. Modelo ✅. | 🔜 F1 |
| **Reservas** | Calendario, cliente, cantidad de personas, asignación sugerida de mesa, bloqueo automático, recordatorios. Modelo ✅. | 🔜 F2 |

## Gestión

| Módulo | Alcance | Estado |
|---|---|---|
| **Compras** | Órdenes, recepciones parciales, comparación de proveedores, historial de precios, sugerencias de reposición. Modelo ✅. | 🔜 F2 |
| **Proveedores** | CUIT, contacto, tiempos de entrega, calificación, historial. Modelo ✅. | 🔜 F2 |
| **Costos** | Costo de receta, costo promedio, margen y rentabilidad por producto, actualización automática al recibir compras. | 🔜 F2 |
| **Clientes** | Historial, preferencias, cumpleaños, puntos, descuentos, ranking. Modelo ✅. | 🔜 F2 |
| **Delivery** | Pedidos, estados, asignación de repartidor, tiempo estimado; integraciones PedidosYa/Rappi. Modelo ✅. | 🔜 F3 |
| **Facturación ARCA** | Factura A/B/C, notas de crédito, CAE, punto de venta, cuenta corriente, caja diaria. Modelo ✅. | 🔜 F3 |
| **Reportes** | Ventas, compras, stock, producción, rentabilidad, mozos, horarios, mesas, clientes, caja; exportación PDF/Excel/CSV. | 🔜 F2-F3 |
| **Dashboard** | Widgets configurables: ventas, rentabilidad, caja, mesas, stock crítico, KPIs, comparativas entre sucursales. Shell ✅ con datos de ejemplo. | 🔜 F2 |

## Plataforma avanzada

| Módulo | Alcance | Estado |
|---|---|---|
| **Offline first** | Nodo local por sucursal + sincronización por outbox (`SyncEvent` ✅ en schema) con UUID, versión, dispositivo y resolución de conflictos. | 🔜 F4 |
| **PWA** | Instalable, cache offline, actualización automática. | 🔜 F2 |
| **Impresión térmica** | ESC/POS para cocina, barra, ticket, precuenta y factura; vía nodo local sin Internet. | 🔜 F4 |
| **Notificaciones** | Push, internas, email, WhatsApp (preparado). | 🔜 F3 |
| **IA empresarial** | Asistente sobre datos del negocio (márgenes, pronóstico de ventas, sugerencias de compra) + recomendaciones automáticas. | 🔜 F5 |
| **API pública + plugins** | API documentada (Swagger ✅), webhooks, marketplace de plugins sin modificar el núcleo. | 🔜 F5 |
