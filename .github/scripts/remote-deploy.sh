#!/usr/bin/env bash
# Runs on the server (piped through ssh): loads the uploaded image, restarts the site and rolls back if it does not become healthy.
#
#   bash -s -- <image-name> <archive-path> [compose-directory] < remote-deploy.sh
set -euo pipefail

image=${1:?image name}
archive=${2:?archive path}
compose_dir=${3:-/data/compose/ailab}

archive=$(readlink -f "$archive")
archive_dir=$(dirname "$archive")

rollback() {
  if docker image inspect "$image:previous" >/dev/null 2>&1; then
    echo "Rolling back to the previous image."
    docker tag "$image:previous" "$image:latest"
    (cd "$compose_dir" && docker compose up -d --pull never) || true
  else
    echo "There is no previous image to roll back to."
  fi
}

cd "$compose_dir"

# Remember what is running now, so a bad release can be undone.
if docker image inspect "$image:latest" >/dev/null 2>&1; then
  docker tag "$image:latest" "$image:previous"
fi

echo "Loading the new image..."
if ! gunzip -c "$archive" | docker load; then
  echo "Loading the image failed; the running site was not touched." >&2
  exit 1
fi
docker image inspect "$image:latest" >/dev/null

echo "Restarting the site with the new image (never pulling from the registry)..."
docker compose up -d --pull never

healthy=0
for check in $(seq 1 36); do
  container=$(docker ps -q --filter "ancestor=$image:latest" | head -n 1)
  if [ -n "$container" ]; then
    status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || echo unknown)
  else
    status=missing
  fi
  echo "Check $check: container ${container:-none}, health: $status"
  if [ "$status" = "healthy" ]; then
    healthy=1
    break
  fi
  sleep 5
done

if [ "$healthy" -ne 1 ]; then
  echo "The new version did not become healthy in time." >&2
  docker logs --tail 40 "${container:-ailab}" 2>&1 || true
  rollback
  exit 1
fi

echo "The new version is healthy."
rm -f "$archive"
find "$archive_dir" -maxdepth 1 -name 'image-*.tar.gz' -mtime +1 -delete 2>/dev/null || true
docker image prune -f >/dev/null
echo "Deploy finished."
