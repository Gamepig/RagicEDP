# --- Build stage ---
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG SHORT_SHA=dev
ENV SHORT_SHA=${SHORT_SHA}

# Allow build without runtime secrets (env.ts uses allowEmptyInBuild)
ENV NEXT_PHASE=phase-production-build
RUN pnpm run build

# --- Production stage ---
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Copy standalone server + static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Copy public dir only if it exists (currently empty)
COPY --from=builder /app/public ./public

EXPOSE 8080

CMD ["node", "server.js"]
