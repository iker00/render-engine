#!/usr/bin/env bash
# Hook SubagentStop para el subagente `implement-task`.
#
# Antes de dejar cerrar la tarea, valida que el repo queda limpio:
#   1. pnpm lint
#   2. pnpm exec tsc --noEmit -p tsconfig.app.json
#   3. pnpm exec tsc --noEmit -p tsconfig.node.json
#   4. ai-workflow/scripts/check-test-index.sh, solo si la tarea tocó src/tests/
#
# Si algo falla, devuelve {"decision":"block","reason":...} con el error concreto:
# Claude Code impide que el subagente termine y le entrega ese motivo, así que
# corrige y vuelve a emitir su JSON.
#
# No se ejecuta la suite de tests aquí a propósito: `pnpm test` corre con
# coverage sobre todo el proyecto y lo lanza el orquestador una sola vez al
# cierre de la pasada. Repetirlo por tarea multiplicaría el coste sin aportar
# señal nueva. Se usa `tsc --noEmit` en vez de `pnpm build` por el mismo motivo:
# valida los mismos tipos sin pagar el bundle de vite.
#
# Reintentos acotados por `agent_id` para que un subagente incapaz de arreglarlo
# no quede en bucle: agotado el límite, se le deja cerrar y el error queda
# visible en el log del hook.

set -uo pipefail

MAX_ATTEMPTS=3
MAX_OUTPUT_CHARS=3000

input=$(cat)

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="${CLAUDE_PROJECT_DIR:-$(cd "$script_dir/../../../.." && pwd)}"
cd "$repo_root" || exit 0

agent_id=$(jq -r '.agent_id // "unknown"' <<<"$input" 2>/dev/null || echo "unknown")
state_dir="${TMPDIR:-/tmp}/claude-implement-task-validate"
mkdir -p "$state_dir"
counter_file="$state_dir/${agent_id//[^a-zA-Z0-9_-]/_}"

failures=""

run_check() {
  local label="$1"
  shift
  local output
  if ! output=$("$@" 2>&1); then
    local trimmed="$output"
    # Conservar la cola: los errores de tsc/eslint más útiles quedan al final.
    # ${output: -N} devuelve vacío si la cadena es más corta que N, así que el
    # offset se calcula a mano.
    if (( ${#output} > MAX_OUTPUT_CHARS )); then
      trimmed="[...salida truncada...]"$'\n'"${output:$(( ${#output} - MAX_OUTPUT_CHARS ))}"
    fi
    [[ -n "$trimmed" ]] || trimmed="(el comando falló sin producir salida)"
    failures+="### ${label} — FALLA"$'\n'"comando: $*"$'\n\n'"${trimmed}"$'\n\n'
  fi
}

run_check "Lint" pnpm lint
run_check "Tipos (app)" pnpm exec tsc --noEmit -p tsconfig.app.json
run_check "Tipos (node)" pnpm exec tsc --noEmit -p tsconfig.node.json
if git status --porcelain -- src/tests | grep -q .; then
  run_check "Índice de tests" "$repo_root/ai-workflow/scripts/check-test-index.sh"
fi

if [[ -z "$failures" ]]; then
  rm -f "$counter_file"
  exit 0
fi

attempts=$(cat "$counter_file" 2>/dev/null || echo 0)
[[ "$attempts" =~ ^[0-9]+$ ]] || attempts=0
attempts=$((attempts + 1))
echo "$attempts" >"$counter_file"

if (( attempts >= MAX_ATTEMPTS )); then
  rm -f "$counter_file"
  echo "validate.sh: ${MAX_ATTEMPTS} intentos agotados para $agent_id; se permite cerrar con validación en rojo." >&2
  echo "$failures" >&2
  exit 0
fi

remaining=$((MAX_ATTEMPTS - attempts))
reason="La validación automática del repo ha fallado, así que todavía no puedes cerrar la tarea.

${failures}Corrige estos errores y vuelve a emitir tu JSON final.

- Si el fallo lo ha provocado tu cambio, arréglalo aunque esté en un fichero que no tocaste directamente.
- Si compruebas que es preexistente y ajeno a tu tarea, devuelve status \"blocked\" explicándolo en blocker_reason.
- No toques los tests para silenciar un error de tipos o de lint.

Intento ${attempts} de ${MAX_ATTEMPTS}; te quedan ${remaining}. Agotarlos cierra la tarea con la validación en rojo."

jq -n --arg reason "$reason" '{decision:"block", reason:$reason}'
exit 0
