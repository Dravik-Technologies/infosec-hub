#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$ROOT_DIR/.tmp/agent-workflow"
STATE_FILE="$STATE_DIR/state"
MODE_FILE="$STATE_DIR/mode"
TASK_FILE="$STATE_DIR/task"
RUN_ID_FILE="$STATE_DIR/run-id"
RUNS_DIR="$STATE_DIR/runs"

mkdir -p "$STATE_DIR"
mkdir -p "$RUNS_DIR"

small_bug_roles=(
  "qa-user-journey"
  "product-manager"
  "app-engineer"
  "integration-verifier"
  "release-security-engineer"
  "azure-release-engineer"
)

db_tenant_auth_roles=(
  "qa-user-journey"
  "product-manager"
  "backend-engineer"
  "db-tenancy-engineer"
  "integration-verifier"
  "release-security-engineer"
  "azure-release-engineer"
)

ui_refresh_roles=(
  "qa-user-journey"
  "product-manager"
  "frontend-engineer"
  "integration-verifier"
  "release-security-engineer"
  "azure-release-engineer"
)

multi_app_rollout_roles=(
  "qa-user-journey"
  "product-manager"
  "app-engineer"
  "db-tenancy-engineer"
  "integration-verifier"
  "qa-user-journey"
  "release-security-engineer"
  "azure-release-engineer"
)

DEFAULT_MODE="multi-app-rollout"
ROLES_DIR="$ROOT_DIR/.agents/roles"
TEMPLATES_DIR="$ROOT_DIR/.agents/templates"

mode_key() {
  tr '[:upper:]' '[:lower:]' <<<"${1// /-}"
}

current_mode() {
  if [[ ! -f "$MODE_FILE" ]]; then
    echo "$DEFAULT_MODE"
    return
  fi
  cat "$MODE_FILE"
}

save_mode() {
  printf '%s\n' "$1" > "$MODE_FILE"
}

current_task() {
  if [[ ! -f "$TASK_FILE" ]]; then
    echo "unspecified task"
    return
  fi
  cat "$TASK_FILE"
}

save_task() {
  printf '%s\n' "$1" > "$TASK_FILE"
}

current_run_id() {
  if [[ ! -f "$RUN_ID_FILE" ]]; then
    echo ""
    return
  fi
  cat "$RUN_ID_FILE"
}

save_run_id() {
  printf '%s\n' "$1" > "$RUN_ID_FILE"
}

run_dir() {
  local run_id="$1"
  echo "$RUNS_DIR/$run_id"
}

current_run_dir() {
  local run_id
  run_id="$(current_run_id)"
  if [[ -z "$run_id" ]]; then
    echo ""
    return
  fi
  run_dir "$run_id"
}

create_run() {
  local mode="$1"
  local task="$2"
  local ts slug run_id dir
  ts="$(date +%Y%m%d-%H%M%S)"
  slug="$(echo "$task" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\\+/-/g' | sed 's/^-//;s/-$//' | cut -c1-48)"
  [[ -n "$slug" ]] || slug="workflow"
  run_id="${ts}-${slug}"
  dir="$(run_dir "$run_id")"
  mkdir -p "$dir/artifacts"
  cat > "$dir/metadata.md" <<EOF
# Workflow Run Metadata

- Run ID: \`$run_id\`
- Mode: \`$mode\`
- Task: $task
- Started: $(date -Iseconds)
EOF
  cat > "$dir/results.md" <<EOF
# Workflow Results

- Run ID: \`$run_id\`
- Mode: \`$mode\`
- Task: $task

## Entries

EOF
  save_run_id "$run_id"
}

workflow_roles() {
  local mode="$1"
  case "$mode" in
    small-bug) printf '%s\n' "${small_bug_roles[@]}" ;;
    db-tenant-auth) printf '%s\n' "${db_tenant_auth_roles[@]}" ;;
    ui-refresh) printf '%s\n' "${ui_refresh_roles[@]}" ;;
    multi-app-rollout) printf '%s\n' "${multi_app_rollout_roles[@]}" ;;
    *)
      echo "Unknown workflow mode: $mode" >&2
      exit 1
      ;;
  esac
}

current_index() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo 0
    return
  fi
  cat "$STATE_FILE"
}

save_index() {
  printf '%s\n' "$1" > "$STATE_FILE"
}

print_role() {
  local idx="$1"
  local mode="$2"
  mapfile -t roles < <(workflow_roles "$mode")
  if (( idx < 0 || idx >= ${#roles[@]} )); then
    echo "done"
  else
    echo "${roles[$idx]}"
  fi
}

print_prompt() {
  local role="$1"
  local task="$2"
  if [[ "$role" == "done" ]]; then
    echo "Workflow complete."
    return
  fi
  cat <<EOF
Prompt Codex with:
continue as $role for: $task
EOF
}

role_file_path() {
  local role="$1"
  if [[ "$role" == "done" ]]; then
    echo "—"
  else
    echo "$ROLES_DIR/$role.md"
  fi
}

recommended_template() {
  local role="$1"
  case "$role" in
    qa-user-journey) echo "$TEMPLATES_DIR/qa-checklist.md" ;;
    release-security-engineer) echo "$TEMPLATES_DIR/release-checklist.md" ;;
    azure-release-engineer) echo "$TEMPLATES_DIR/release-checklist.md" ;;
    done) echo "—" ;;
    *) echo "$TEMPLATES_DIR/handoff-template.md" ;;
  esac
}

print_run_next() {
  local idx="$1"
  local mode="$2"
  local task="$3"
  local role
  role="$(print_role "$idx" "$mode")"
  echo "Workflow mode: $mode"
  echo "Current step: $idx"
  echo "Task: $task"
  echo "Next role: $role"
  echo "Role card: $(role_file_path "$role")"
  echo "Suggested template: $(recommended_template "$role")"
  print_prompt "$role" "$task"
}

list_modes() {
  cat <<EOF
Available workflow modes:
- small-bug
- db-tenant-auth
- ui-refresh
- multi-app-rollout
EOF
}

append_result_entry() {
  local role="$1"
  local status="$2"
  local artifact="$3"
  local notes="$4"
  local dir
  dir="$(current_run_dir)"
  if [[ -z "$dir" || ! -d "$dir" ]]; then
    echo "No active workflow run. Start one first with ./agent-workflow.sh start ..." >&2
    exit 1
  fi
  cat >> "$dir/results.md" <<EOF
### $(date '+%Y-%m-%d %H:%M:%S') — \`$role\`

- Status: \`$status\`
- Artifact: ${artifact:-—}
- Notes: ${notes:-—}

EOF
}

cmd="${1:-status}"
idx="$(current_index)"
mode="$(current_mode)"
task="$(current_task)"

case "$cmd" in
  status)
    role="$(print_role "$idx" "$mode")"
    echo "Current step: $idx"
    echo "Workflow mode: $mode"
    echo "Task: $task"
    echo "Run ID: $(current_run_id)"
    echo "Current role: $role"
    ;;
  next)
    role="$(print_role "$idx" "$mode")"
    echo "Next role to run: $role"
    print_prompt "$role" "$task"
    ;;
  run-next)
    print_run_next "$idx" "$mode" "$task"
    ;;
  advance)
    next_idx=$((idx + 1))
    save_index "$next_idx"
    role="$(print_role "$next_idx" "$mode")"
    echo "Advanced workflow."
    echo "Workflow mode: $mode"
    echo "Task: $task"
    echo "Current role: $role"
    print_prompt "$role" "$task"
    ;;
  advance-and-run)
    next_idx=$((idx + 1))
    save_index "$next_idx"
    echo "Advanced workflow."
    print_run_next "$next_idx" "$mode" "$task"
    ;;
  reset)
    save_index 0
    save_mode "$DEFAULT_MODE"
    save_task "unspecified task"
    save_run_id ""
    echo "Workflow reset."
    echo "Workflow mode: $DEFAULT_MODE"
    echo "Current role: $(print_role 0 "$DEFAULT_MODE")"
    ;;
  start)
    selected_mode="$(mode_key "${2:-$DEFAULT_MODE}")"
    shift 2 || true
    selected_task="${*:-unspecified task}"
    save_mode "$selected_mode"
    save_task "$selected_task"
    save_index 0
    create_run "$selected_mode" "$selected_task"
    role="$(print_role 0 "$selected_mode")"
    echo "Workflow started."
    echo "Workflow mode: $selected_mode"
    echo "Task: $selected_task"
    echo "Run ID: $(current_run_id)"
    echo "Current role: $role"
    print_prompt "$role" "$selected_task"
    ;;
  prompt)
    role="$(print_role "$idx" "$mode")"
    print_prompt "$role" "$task"
    ;;
  modes)
    list_modes
    ;;
  list)
    mapfile -t roles < <(workflow_roles "$mode")
    for i in "${!roles[@]}"; do
      echo "$i ${roles[$i]}"
    done
    ;;
  log-result)
    role="$(print_role "$idx" "$mode")"
    status_value="${2:-completed}"
    artifact_path="${3:-}"
    notes_value="${4:-}"
    dir="$(current_run_dir)"
    if [[ -z "$dir" || ! -d "$dir" ]]; then
      echo "No active workflow run. Start one first with ./agent-workflow.sh start ..." >&2
      exit 1
    fi
    if [[ -n "$artifact_path" ]]; then
      if [[ ! -f "$artifact_path" ]]; then
        echo "Artifact file not found: $artifact_path" >&2
        exit 1
      fi
      dest="$dir/artifacts/$(basename "$artifact_path")"
      cp "$artifact_path" "$dest"
      artifact_path="$dest"
    fi
    append_result_entry "$role" "$status_value" "$artifact_path" "$notes_value"
    echo "Logged result for role: $role"
    ;;
  results)
    dir="$(current_run_dir)"
    if [[ -z "$dir" || ! -d "$dir" ]]; then
      echo "No active workflow run."
      exit 1
    fi
    echo "Run directory: $dir"
    echo "Metadata: $dir/metadata.md"
    echo "Results: $dir/results.md"
    if [[ -d "$dir/artifacts" ]]; then
      echo "Artifacts:"
      ls -1 "$dir/artifacts" 2>/dev/null || true
    fi
    ;;
  latest-report)
    dir="$(current_run_dir)"
    if [[ -z "$dir" || ! -d "$dir" ]]; then
      echo "No active workflow run."
      exit 1
    fi
    echo "$dir/results.md"
    ;;
  *)
    echo "Usage: ./agent-workflow.sh {status|next|run-next|advance|advance-and-run|reset|list|modes|prompt|start <mode> <task...>|log-result [status] [artifact] [notes]|results|latest-report}" >&2
    exit 1
    ;;
esac
