# ============================================================
# ERPresto API — multi-stage build
# Pensado para buildearse desde la RAÍZ del repo (como hace
# docker-compose.yml: context ".", dockerfile apps/api/Dockerfile)
# ============================================================

# ---------- deps: instala TODAS las dependencias ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci

# ---------- build: genera Prisma Client y compila ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/api/package.json apps/api/package-lock.json ./
COPY apps/api/prisma ./prisma
RUN npx prisma generate
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json ./
COPY apps/api/src ./src
RUN npm run build

# ---------- prod-deps: solo dependencias de producción ----------
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev
# Prisma Client generado (engine incluido) para runtime
COPY apps/api/prisma ./prisma
RUN npx prisma generate

# ---------- runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
