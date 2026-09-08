#!/usr/bin/env bash
set -euo pipefail
cd /opt/datadock
registry_image="${1:?registry image required}"
release_sha="${2:?commit SHA required}"
[[ "$release_sha" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$registry_image" =~ ^[a-zA-Z0-9._/-]+$ ]] || exit 2
test -f .env.production
umask 077
cp .env.production .env.previous
trap 'cp .env.previous .env.production; docker compose --env-file .env.production -f compose.production.yml up -d --wait --wait-timeout 180 || true' ERR
sed -i "s|^API_IMAGE=.*|API_IMAGE=${registry_image}/api:${release_sha}|" .env.production
sed -i "s|^WEB_IMAGE=.*|WEB_IMAGE=${registry_image}/web:${release_sha}|" .env.production
docker compose --env-file .env.production -f compose.production.yml pull
docker compose --env-file .env.production -f compose.production.yml up -d --wait --wait-timeout 180
curl --fail --retry 5 --retry-delay 5 http://127.0.0.1:8080/api/health
trap - ERR
printf 'Release %s is healthy.\n' "$release_sha"
