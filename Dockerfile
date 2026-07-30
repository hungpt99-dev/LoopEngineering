FROM node:22-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

FROM node:22-slim AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src/ ./src/

RUN npm run build

FROM node:22-slim AS production

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma/ ./prisma/

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

RUN addgroup --gid 1001 ai-dev && \
    adduser --uid 1001 --gid 1001 ai-dev && \
    chown -R ai-dev:ai-dev /app && \
    mkdir -p /data && chown ai-dev:ai-dev /data

VOLUME ["/data"]

USER ai-dev

ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/cli/index.js"]
CMD ["--help"]
