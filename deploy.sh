#!/bin/bash
# Deploy to production (Linux VPS)
set -e
cd "$(dirname "$0")"

[ ! -f .env ] && { echo "ERROR: .env not found. Copy .env.example and fill in values."; exit 1; }

export $(cat .env | grep -v '#' | xargs)

echo "==> Building and starting all services..."
docker compose --env-file .env up -d --build

echo ""
echo "==> Status:"
docker compose ps

echo ""
echo "Done! Platform running at http://$(hostname -I | awk '{print $1}')"
echo "NetFlow collector listening on UDP port 514"
