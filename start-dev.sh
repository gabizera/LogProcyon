#!/bin/bash
# Start dev environment on Mac
# ClickHouse in Docker, backend/frontend native, collector with sudo

set -e
cd "$(dirname "$0")"

# Load env
[ -f .env ] && export $(cat .env | grep -v '#' | xargs)

echo "==> Starting ClickHouse..."
docker compose up clickhouse -d
echo "Waiting for ClickHouse..."
until curl -s http://localhost:8123/ping > /dev/null 2>&1; do sleep 1; done
echo "ClickHouse ready."

echo "==> Starting backend..."
cd backend
CLICKHOUSE_URL=http://localhost:8123 npm run start:prod &
BACKEND_PID=$!
cd ..

echo "==> Starting frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Services running:"
echo "  ClickHouse: http://localhost:8123"
echo "  Backend:    http://localhost:3000"
echo "  Frontend:   http://localhost:5173"
echo ""
echo "==> Start NetFlow collector (requires sudo for port 514):"
echo "  sudo CLICKHOUSE_URL=http://localhost:8123 LISTEN_PORT=514 TZ_OFFSET_HOURS=${TZ_OFFSET_HOURS:--3} node collector/collector.js"
echo ""
echo "Press Ctrl+C to stop backend and frontend."
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
