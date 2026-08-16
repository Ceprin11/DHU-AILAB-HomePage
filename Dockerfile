# ===== Stage 1: Build =====
FROM node:alpine AS build
LABEL authors="Ceprin11"

WORKDIR /build

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ===== Stage 2: Run =====
FROM node:alpine AS runner
LABEL authors="Ceprin11"

WORKDIR /app

COPY --from=build /build/package*.json ./
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/dist ./dist
COPY --from=build /build/public ./public
COPY --from=build /build/server ./server

EXPOSE 3000
CMD ["npm","run","start"]
