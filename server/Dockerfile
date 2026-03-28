# Build stage
FROM oven/bun:1.1 AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile

# Runtime stage
FROM oven/bun:1.1
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY package.json bun.lock* ./
COPY tsconfig.json ./
COPY index.ts ./
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3001

CMD ["bun", "run", "index.ts"]
