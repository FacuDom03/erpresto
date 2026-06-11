# ERPresto

ERP gastronómico SaaS multi-tenant para restaurantes, bares, cafeterías y cadenas del mercado argentino. No es un POS: es una plataforma para administrar el 100% de la operación — salón, ventas, cocina, doble stock independiente (materia prima y producción), compras, caja, clientes, reservas y facturación argentina — preparada para miles de clientes simultáneos.

## Stack

- **Backend:** NestJS · TypeScript · Prisma · PostgreSQL · Redis · BullMQ · WebSockets
- **Frontend:** Next.js · React · TypeScript · TailwindCSS · shadcn/ui · TanStack Query · React Hook Form · Zod
- **Infra:** Docker · Docker Compose · preparado para Kubernetes

## Documentación

| Documento | Contenido |
|---|---|
| [docs/01-arquitectura.md](docs/01-arquitectura.md) | Arquitectura, multi-tenancy, RBAC, offline-first, decisiones justificadas |
| [docs/02-base-de-datos.md](docs/02-base-de-datos.md) | Diseño de BD, ERD, decisiones de modelado |
| [docs/03-modulos.md](docs/03-modulos.md) | Todos los módulos funcionales y su estado |
| [docs/04-roadmap.md](docs/04-roadmap.md) | Plan de desarrollo por fases (F0 → F5) |

## Inicio rápido

```bash
# Levantar todo con Docker
docker compose up -d

# O en desarrollo:
cp .env.example .env
docker compose up -d postgres redis

# Backend (puerto 3001, Swagger en /docs)
cd apps/api
npm install
npx prisma migrate dev
npm run prisma:seed
npm run start:dev

# Frontend (puerto 3000)
cd apps/web
npm install
npm run dev
```

**Usuario demo:** `admin@demo.com` / `Admin123!` (creado por el seed, rol Dueño del tenant "Demo Resto").

## Estructura

```
apps/
  api/   # API NestJS + Prisma (schema, migraciones, seed)
  web/   # Frontend Next.js (PWA)
docs/    # Arquitectura, BD/ERD, módulos, roadmap
```

## Principios del producto

1. El sistema se adapta al restaurante, no el restaurante al sistema.
2. Stock de materia prima y stock de producción son **independientes por defecto**; la vinculación (recetas/conversión) es opcional y configurable por producto.
3. Toda funcionalidad puede habilitarse o deshabilitarse desde configuración.
4. Multi-empresa, multisucursal, multiusuario, con aislamiento total de datos por tenant.
