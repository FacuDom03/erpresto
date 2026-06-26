# ERPresto API

Backend NestJS del ERP gastronómico SaaS multi-tenant.

## Requisitos

- Node 22+, PostgreSQL 16 (o `docker compose up -d postgres` desde la raíz del repo).
- Crear `.env` (copiar desde el `.env.example` de la raíz).

## Comandos

```bash
npm install              # dependencias
npm run prisma:generate  # genera Prisma Client
npm run prisma:migrate   # prisma migrate dev
npm run prisma:deploy    # prisma migrate deploy (producción)
npm run prisma:seed      # permisos + roles de sistema + tenant demo
npm run start:dev        # desarrollo con watch
npm run build            # compila a dist/
npm run start            # node dist/main
```

## Demo

Tras el seed: `POST /auth/login` con `admin@demo.com` / `Admin123!` (tenant slug `demo`).

Swagger en `http://localhost:3001/docs`. Health en `GET /health`.

## Variables de entorno

`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRATION` (15m),
`JWT_REFRESH_EXPIRATION` (7d), `PORT` (3001), `CORS_ORIGIN` (http://localhost:3000).

## Arquitectura

- Multi-tenant: todos los servicios filtran por `tenantId` del JWT (nunca del body).
- RBAC: `@RequirePermissions('products.create')` + `PermissionsGuard` global; el access
  token incluye `permissions` y `branchIds`.
- Doble stock independiente: materia prima (`/raw-materials`) y stock de platos
  (`/product-stock`). La producción solo descuenta materia prima si se pide
  `consumeRawMaterials: true` y el producto tiene receta activa; sin receta no falla.
