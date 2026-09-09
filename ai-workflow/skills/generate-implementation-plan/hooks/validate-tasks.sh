#!/usr/bin/env bash
# Hook SubagentStop para el agente `plan-feature`.
#
# Antes de dejar cerrar la planificación, ejecuta `check-tasks.sh` sobre la
# feature activa. Si la estructura de `tasks.md` no es válida, devuelve
# {"decision":"block","reason":...} con la lista de problemas para que el agente
# la corrija y vuelva a cerrar. Reintentos acotados por `agent_id`; agotados, se
# permite cerrar y los problemas quedan en el log del hook.

set -uo pipefail

MAX_ATTEMPTS=3

input=$(cat)

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="${CLAUDE_PROJECT_DIR:-$(cd "$script_dir/../../../.." && pwd)}"
scripts_dir="$repo_root/ai-workflow/scripts"

feature_dir=$("$scripts_dir/active-feature.sh" "$repo_root" 2>/dev/null) || exit 0
[[ -f "$feature_dir/tasks.md" ]] || exit 0

if output=$("$scripts_dir/check-tasks.sh" "$feature_dir" 2>&1); then
  exit 0
fi

agent_id=$(jq -r '.agent_id // "unknown"' <<<"$input" 2>/dev/null || echo "unknown")
state_dir="${TMPDIR:-/tmp}/claude-plan-feature-validate"
mkdir -p "$state_dir"
counter_file="$state_dir/${agent_id//[^a-zA-Z0-9_-]/_}"

attempts=$(cat "$counter_file" 2>/dev/null || echo 0)
[[ "$attempts" =~ ^[0-9]+$ ]] || attempts=0
attempts=$((attempts + 1))
echo "$attempts" >"$counter_file"

if (( attempts >= MAX_ATTEMPTS )); then
  rm -f "$counter_file"
  echo "validate-tasks.sh: ${MAX_ATTEMPTS} intentos agotados para $agent_id; se permite cerrar con tasks.md inválido." >&2
  echo "$output" >&2
  exit 0
fi

remaining=$((MAX_ATTEMPTS - attempts))
reason="La estructura de tasks.md no es válida, así que todavía no puedes cerrar la planificación.

${output}

Corrige estos problemas en ${feature_dir#$repo_root/}/tasks.md y vuelve a emitir tu respuesta final.

Intento ${attempts} de ${MAX_ATTEMPTS}; te quedan ${remaining}."

jq -n --arg reason "$reason" '{decision:"block", reason:$reason}'
exit 0
