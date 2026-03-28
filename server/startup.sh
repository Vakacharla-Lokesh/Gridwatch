#!/bin/bash
# Startup script for GridWatch server
# Waits for database and seeds it if needed

echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -h postgres -p 5432 >/dev/null 2>&1; do
  echo "  Postgres is unavailable - sleeping..."
  sleep 2
done
echo "✅ PostgreSQL is ready"

echo "🌱 Running database seed..."
bun db/seed.ts

echo "🚀 Starting GridWatch server..."
exec bun run index.ts
