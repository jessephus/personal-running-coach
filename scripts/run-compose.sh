#!/usr/bin/env bash

set -euo pipefail

if docker compose version >/dev/null 2>&1; then
  exec docker compose "$@"
fi

if command -v docker-compose >/dev/null 2>&1; then
  exec docker-compose "$@"
fi

echo "Neither 'docker compose' nor 'docker-compose' is installed." >&2
echo "Install Docker Compose to use the self-host commands." >&2
exit 1
