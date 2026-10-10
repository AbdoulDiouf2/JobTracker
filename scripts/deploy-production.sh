#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$HOME/infra/prod/jobtracker"
COMPOSE_FILE=docker-compose.production.yml

# Avoid overlapping deploys from GitHub Actions and manual runs.
exec 9>"$HOME/.jobtracker-production-deploy.lock"
flock 9

cd "$APP_DIR"
if [[ ! -d .git ]]; then
  echo "Deployment directory is not a Git checkout: $APP_DIR" >&2
  exit 1
fi
if [[ ! -f .env.production ]]; then
  echo "Missing production environment file: $APP_DIR/.env.production" >&2
  exit 1
fi

# Fast-forward only: local server changes or divergent history stop deployment safely.
git fetch origin main
git switch main
git pull --ff-only origin main

docker compose -f "$COMPOSE_FILE" config --quiet

# Build sequentially to keep peak memory use predictable on the 8 GiB VPS.
docker compose -f "$COMPOSE_FILE" build jobtracker-api
docker compose -f "$COMPOSE_FILE" build jobtracker-web
docker compose -f "$COMPOSE_FILE" up -d --no-build

# Wait up to 5 minutes for the DB-backed API health route through Nginx.
for attempt in $(seq 1 60); do
  if docker compose -f "$COMPOSE_FILE" exec -T jobtracker-web wget -qO- http://127.0.0.1/api/health | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("status") == "healthy" else 1)'; then
    echo "JobTracker deployment is healthy."
    docker compose -f "$COMPOSE_FILE" ps
    exit 0
  fi
  sleep 5
done

echo "JobTracker did not become healthy. Inspect service logs directly on the VPS." >&2
docker compose -f "$COMPOSE_FILE" ps >&2 || true
exit 1
