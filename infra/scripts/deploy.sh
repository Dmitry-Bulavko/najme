#!/usr/bin/env bash
# Deploys a given image tag on the production server. Runs as the `deploy` user in /opt/najme.
# Usage: ./deploy.sh <commit-sha>
# Pull → migrate → up → health check; on failure roll back to the last successful tag.
set -euo pipefail

cd "$(dirname "$0")"

TAG="${1:?usage: deploy.sh <image-tag>}"
if ! [[ "$TAG" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "deploy: invalid image tag '$TAG'" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

COMPOSE=(docker compose -f compose.prod.yml)

if [[ -n "${GHCR_READ_TOKEN:-}" ]]; then
  printf '%s' "$GHCR_READ_TOKEN" | docker login ghcr.io -u "${GHCR_USER:?}" --password-stdin >/dev/null
fi

# Record the tag in .env so manual `docker compose -f compose.prod.yml …` commands and the backup
# script resolve the images that are actually running.
use_tag() {
  export IMAGE_TAG="$1"
  sed -i '/^IMAGE_TAG=/d' .env
  printf 'IMAGE_TAG=%s\n' "$IMAGE_TAG" >>.env
}

deploy_tag() {
  use_tag "$1"
  echo "deploy: pulling $IMAGE_TAG"
  "${COMPOSE[@]}" pull api web
  "${COMPOSE[@]}" up -d postgres
  echo "deploy: running migrations"
  "${COMPOSE[@]}" --profile migrate run --rm migrate
  echo "deploy: starting services"
  "${COMPOSE[@]}" up -d --remove-orphans
}

healthy() {
  local _
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 5 --resolve "${DOMAIN}:443:127.0.0.1" \
      "https://${DOMAIN}/api/v1/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  return 1
}

PREVIOUS_TAG="$(cat .last_successful_tag 2>/dev/null || true)"

if deploy_tag "$TAG" && healthy; then
  echo "$TAG" >.last_successful_tag
  docker image prune -f >/dev/null
  echo "deploy: $TAG is live at https://${DOMAIN}"
  exit 0
fi

echo "deploy: $TAG failed" >&2
if [[ -n "$PREVIOUS_TAG" && "$PREVIOUS_TAG" != "$TAG" ]]; then
  echo "deploy: rolling back to $PREVIOUS_TAG" >&2
  use_tag "$PREVIOUS_TAG"
  if "${COMPOSE[@]}" up -d --remove-orphans && healthy; then
    echo "deploy: rolled back to $PREVIOUS_TAG" >&2
  else
    echo "deploy: rollback to $PREVIOUS_TAG is unhealthy too — manual action needed" >&2
  fi
fi
exit 1
