#!/bin/sh
set -e

echo "🚀 Running Prisma production migrations..."
npx prisma migrate deploy

echo "🟢 Starting Curio Fastify Backend..."
exec node dist/index.js
