# Build stage
FROM oven/bun:1.3.10 AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Runtime stage
FROM oven/bun:1.3.10
WORKDIR /app
COPY package.json bun.lock* ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

ENV VITE_API_URL=${VITE_API_URL:-http://localhost:4000}
EXPOSE 5173

CMD ["bun", "run", "preview", "--", "--host", "--port", "5173"]
