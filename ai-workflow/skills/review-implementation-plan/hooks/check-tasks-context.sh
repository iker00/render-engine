#!/usr/bin/env bash
# Hook SubagentStart para el agente `review-plan`.
#
# Ejecuta `check-tasks.sh` sobre la feature activa y entrega el resultado al
# revisor como contexto adicional, para que arranque sabiendo si la estructura
# de `tasks.md` es válida y dedique su trabajo a lo que requiere juicio.

set -uo pipefail

cat >/dev/null   # drenar el JSON de stdin; no lo necesitamos

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="${CLAUDE_PROJECT_DIR:-$(cd "$script_dir/../../../.." && pwd)}"
scripts_dir="$repo_root/ai-workflow/scripts"

emit() {
  jq -n --arg ctx "$1" \
    '{hookSpecificOutput:{hookEventName:"SubagentStart",additionalContext:$ctx}}'
  exit 0
}

feature_dir=$("$scripts_dir/active-feature.sh" "$repo_root" 2>&1) \
  || emit "No se ha podido determinar la feature activa: $feature_dir"

[[ -f "$feature_dir/tasks.md" ]] \
  || emit "La feature activa es ${feature_dir#$repo_root/} pero no tiene tasks.md."

if output=$("$scripts_dir/check-tasks.sh" "$feature_dir" 2>&1); then
  emit "Feature activa: ${feature_dir#$repo_root/}

Estructura de tasks.md comprobada por script: correcta.
$output"
fi

emit "Feature activa: ${feature_dir#$repo_root/}

Estructura de tasks.md comprobada por script: INVÁLIDA. Cada problema de esta lista es un refinamiento obligatorio.
$output"
