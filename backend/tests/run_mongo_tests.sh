#!/usr/bin/env bash
# Lance les tests backend contre une MongoDB ÉPHÉMÈRE (Docker).
#
# - conteneur jetable (--rm), données en RAM (--tmpfs), port lié à 127.0.0.1 uniquement ;
# - aucune base dev/prod n'est utilisée ;
# - le conteneur est supprimé à la fin, même en cas d'échec.
#
# Usage (depuis backend/) :
#   bash tests/run_mongo_tests.sh                 # tests Opportunités + to_apply
#   bash tests/run_mongo_tests.sh tests/xxx.py    # fichiers spécifiques
#
# NB : test_jobtracker_api.py / test_dashboard_v2.py ciblent une URL distante
# (legacy) et ne sont PAS lancés par ce script.
set -euo pipefail

# Git Bash (Windows) : ne pas convertir /data/db en chemin Windows
export MSYS_NO_PATHCONV=1

CONTAINER="jobtracker-test-mongo-$$"
PORT="${MONGO_TEST_PORT:-27018}"
IMAGE="${MONGO_TEST_IMAGE:-mongo:7}"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --rm --name "$CONTAINER" -p "127.0.0.1:${PORT}:27017" --tmpfs /data/db "$IMAGE" >/dev/null

echo "Attente de MongoDB ($IMAGE sur 127.0.0.1:${PORT})..."
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER" mongosh --quiet --eval "db.runCommand({ ping: 1 }).ok" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Interpréteur : variable PY si fournie, sinon le venv du projet
if [ -z "${PY:-}" ]; then
  if [ -x venv/Scripts/python.exe ]; then PY=venv/Scripts/python.exe; else PY=venv/bin/python; fi
fi

TESTS=("$@")
if [ ${#TESTS[@]} -eq 0 ]; then
  TESTS=(tests/test_job_urls.py tests/test_opportunity_service.py tests/test_to_apply_status.py
         tests/test_opportunity_conversion.py tests/test_opportunity_api.py
         tests/test_agent_token_service.py tests/test_agent_api.py tests/test_lot1_e2e.py
         tests/test_security_settings.py
         tests/test_watch_validation.py tests/test_watch_preferences.py tests/test_watch_ingest.py
         tests/test_watch_api.py tests/test_vercel_routing.py tests/test_mcp_transport.py
         tests/test_ai_sdk_offline.py tests/test_oauth.py tests/test_a0_activation.py
         tests/test_admin_oauth.py tests/test_mcp_tools.py tests/test_p1_multiclient.py
         tests/test_opportunity_origin.py tests/test_opportunity_filters.py
         tests/test_p2_public_clients.py)
fi

MONGO_TEST_URL="mongodb://127.0.0.1:${PORT}" PYTHONIOENCODING=utf-8 "$PY" -m pytest "${TESTS[@]}" -v -p no:cacheprovider
