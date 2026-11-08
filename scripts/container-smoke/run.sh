#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export COMPOSE_PROJECT_NAME="portal-smoke-${RANDOM}-${RANDOM}"
export SMOKE_CERT_DIR
SMOKE_CERT_DIR=$(mktemp -d)
compose=(docker compose -f scripts/container-smoke/compose.yml)
cleanup() {
  result=$?
  if (( result != 0 )); then "${compose[@]}" logs --no-color; fi
  "${compose[@]}" down --volumes --remove-orphans
  rm -rf "$SMOKE_CERT_DIR"
  exit "$result"
}
trap cleanup EXIT
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout "$SMOKE_CERT_DIR/key.pem" -out "$SMOKE_CERT_DIR/cert.pem" \
  -subj /CN=db -addext subjectAltName=DNS:db > /dev/null 2>&1
chmod 755 "$SMOKE_CERT_DIR"
chmod 644 "$SMOKE_CERT_DIR/cert.pem"
"${compose[@]}" up -d --wait postgres
db_port=$("${compose[@]}" port postgres 5432)
DIRECT_URL="postgresql://smoke:smoke@${db_port}/portal?sslmode=disable" npx prisma migrate deploy
"${compose[@]}" exec -T postgres psql -U smoke -d portal -v ON_ERROR_STOP=1 < scripts/container-smoke/user.sql
"${compose[@]}" up -d portal
portal_port=$("${compose[@]}" port portal 3000)
SMOKE_ORIGIN="http://${portal_port}" node scripts/container-smoke/check.mjs
SMOKE_ORIGIN="http://${portal_port}" node scripts/container-smoke/bell.mjs
