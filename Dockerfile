# ===== Stage 1: Build =====
FROM node:22-alpine AS build
LABEL authors="Ceprin11"

WORKDIR /build

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

# ===== Stage 2: Run =====
FROM node:22-alpine AS runner
LABEL authors="Ceprin11"

RUN apk add --no-cache poppler-utils

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=build /build/package*.json ./
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/dist ./dist
COPY --from=build /build/server ./server

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["npm", "run", "start"]
