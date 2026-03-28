# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Runtime stage
FROM node:22-alpine
WORKDIR /app
RUN npm install -g serve

COPY --from=builder /app/dist ./dist

ENV VITE_API_URL=http://localhost:3001
EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
