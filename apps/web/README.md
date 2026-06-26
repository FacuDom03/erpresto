# ERPresto Web

Frontend del ERP gastronómico ERPresto. Next.js 15 (App Router) + TypeScript + Tailwind CSS v4, TanStack Query v5, React Hook Form + Zod, next-themes y componentes UI propios estilo shadcn/ui.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
```

Variables de entorno (ver `.env.example`):

- `NEXT_PUBLIC_API_URL`: URL del backend (default `http://localhost:3001`).

## Build

```bash
npm run build      # build de producción (output standalone)
npm run start
```

## Docker

```bash
docker build -t erpresto-web --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 .
docker run -p 3000:3000 erpresto-web
```

## Notas

- Los tokens se guardan en localStorage (`erpresto.accessToken` / `erpresto.refreshToken`). Ante un 401 el cliente intenta un refresh y reintenta; si falla, limpia la sesión y redirige a `/login`.
- El shape asumido de `GET /products` (`{ data, total }`) y los nombres de campos del producto (`name`, `sku`, `price`, `categoryId`, `description`) están encapsulados en `src/lib/products.ts` y `src/lib/types.ts`: si el backend difiere, ajustar solo ahí.
- `/dashboard` muestra datos mock (marcados con el badge "datos de ejemplo"). `/productos` consume la API real; el resto de los módulos son placeholders "En desarrollo".
