#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a
  source .env
  set +a
fi

POSTGRES_PORT="${POSTGRES_PORT:-5433}"
export POSTGRES_PORT

ALL_SERVICES=(
  postgres
  hub
  scorva
  mash
  nexus
  lava
  data-fabric
  crater-api
  crater-ui
)

usage() {
  cat <<'EOF'
Usage:
  bash local-apps.sh <command> [target...]

Commands:
  start [all|service...]     Start one or more services
  build [all|service...]     Build and start one or more services
  restart [all|service...]   Restart one or more services
  stop [all|service...]      Stop one or more services
  down                       Stop the full stack
  status                     Show running services
  logs [service...]          Tail logs for one or more services
  help                       Show this help

Targets:
  all                        postgres hub scorva mash nexus lava data-fabric crater-api crater-ui
  hub
  scorva
  mash                       Sentinel
  sentinel                   Alias for mash
  nexus
  lava
  data-fabric
  crater-api
  crater-ui
  crater                     Alias for crater-api crater-ui
  postgres
  db                         Alias for postgres

Examples:
  bash local-apps.sh start all
  bash local-apps.sh build hub
  bash local-apps.sh build scorva nexus
  bash local-apps.sh restart sentinel
  bash local-apps.sh stop hub scorva
  bash local-apps.sh logs hub
EOF
}

expand_targets() {
  if [ "$#" -eq 0 ]; then
    echo "all"
    return
  fi

  local expanded=()
  local target
  for target in "$@"; do
    case "$target" in
      all)
        expanded+=("${ALL_SERVICES[@]}")
        ;;
      sentinel|mash)
        expanded+=("mash")
        ;;
      crater)
        expanded+=("crater-api" "crater-ui")
        ;;
      db|postgres)
        expanded+=("postgres")
        ;;
      hub|scorva|nexus|lava|data-fabric|crater-api|crater-ui)
        expanded+=("$target")
        ;;
      *)
        echo "Unknown target: $target" >&2
        exit 1
        ;;
    esac
  done

  printf '%s\n' "${expanded[@]}" | awk '!seen[$0]++'
}

run_compose() {
  echo "POSTGRES_PORT=$POSTGRES_PORT"
  echo "Services: $*"
  docker compose "$@"
}

COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
  help|-h|--help)
    usage
    ;;

  status)
    run_compose ps
    ;;

  down)
    run_compose down
    ;;

  logs)
    mapfile -t SERVICES < <(expand_targets "$@")
    run_compose logs -f "${SERVICES[@]}"
    ;;

  start)
    mapfile -t SERVICES < <(expand_targets "$@")
    run_compose up -d "${SERVICES[@]}"
    ;;

  build)
    mapfile -t SERVICES < <(expand_targets "$@")
    run_compose up -d --build "${SERVICES[@]}"
    ;;

  restart)
    mapfile -t SERVICES < <(expand_targets "$@")
    run_compose up -d --build --force-recreate "${SERVICES[@]}"
    ;;

  stop)
    mapfile -t SERVICES < <(expand_targets "$@")
    run_compose stop "${SERVICES[@]}"
    ;;

  *)
    echo "Unknown command: $COMMAND" >&2
    echo >&2
    usage
    exit 1
    ;;
esac
