# Dependency stage
FROM oven/bun:1.3.10 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Runtime stage
FROM oven/bun:1.3.10
WORKDIR /app

# Install postgresql client
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Copy dependencies from builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock* ./
COPY tsconfig.json ./
COPY index.ts ./
COPY src ./src
COPY db ./db
COPY startup.sh ./

# Make startup script executable
RUN chmod +x startup.sh

ENV NODE_ENV=production
EXPOSE 4000

CMD ["./startup.sh"]
