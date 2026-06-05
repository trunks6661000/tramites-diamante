#!/bin/sh
# Aplica migraciones pendientes antes de arrancar el server.
# Si quieres ejecutar el seed la primera vez, fija SEED_ON_START=1.

set -e

echo "[entrypoint] aplicando migraciones..."
npx prisma migrate deploy

if [ "$SEED_ON_START" = "1" ]; then
  echo "[entrypoint] ejecutando seed..."
  node prisma/seed.js || npx tsx prisma/seed.ts || true
fi

echo "[entrypoint] arrancando Next.js..."
exec node server.js
