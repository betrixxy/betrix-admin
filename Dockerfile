# syntax=docker/dockerfile:1.7
#
# betrix-studio üretim imajı — çok aşamalı (multi-stage), Next.js standalone çıktısı.
# Hedefler:
#   runner   → uygulama sunucusu (varsayılan, non-root, yalnızca standalone çıktı)
#   migrator → `prisma migrate deploy` / `prisma db seed` için tek seferlik araç imajı
# Bkz. docker-compose.prod.yml ve CLAUDE.md 1.9.

ARG NODE_IMAGE=node:24-alpine

# ---------- base ----------
FROM ${NODE_IMAGE} AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- deps: kilit dosyasına göre birebir bağımlılık kurulumu ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---------- builder: Prisma client üretimi + next build ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Gizli anahtar yok: lib/env.ts, `next build` aşamasında (NEXT_PHASE) yer tutucu kullanır.
RUN npx prisma generate --config prisma7.config.ts \
 && npm run build

# ---------- migrator: migration + seed (tam node_modules, non-root) ----------
FROM builder AS migrator
USER node
CMD ["npx", "prisma", "migrate", "deploy", "--config", "prisma7.config.ts"]

# ---------- runner: üretim sunucusu ----------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs \
 && adduser -S -u 1001 -G nodejs -H -s /sbin/nologin nextjs

# Uygulama dosyaları root'a ait kalır (süreç kendi kodunu değiştiremez); yalnızca
# storage/ ve .next/cache yazılabilir — compose'ta ikisi de volume olarak bağlanır.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN mkdir -p storage/uploads storage/generated storage/renders .next/cache \
 && chown -R nextjs:nodejs storage .next/cache

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/login || exit 1

CMD ["node", "server.js"]
