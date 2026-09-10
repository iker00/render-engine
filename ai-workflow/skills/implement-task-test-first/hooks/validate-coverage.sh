#!/usr/bin/env bash
# Hook SubagentStop para el agente `implement-feature`.
#
# Es el único sitio donde corre la suite completa con cobertura (`pnpm test`).
# Escribe él mismo `validation.tests_green` y `validation.coverage_gate_passed`
# en el status.yaml de la feature activa, en vez de que el orquestador lea la
# salida y las escriba: son dos hechos comprobables mecánicamente y el
# orquestador no tiene por qué gastar contexto interpretando un informe de
# cobertura de miles de líneas para extraer dos booleanos.
#
# Si algo falla, devuelve {"decision":"block","reason":...} con un extracto
# acotado. Si no se implementó ninguna tarea en la pasada (completed_task_ids
# sigue vacío), no ejecuta nada: los flags ya están en false por el reset de
# inicio de pasada (ver ai-workflow/rules/status-yaml.md).
#
# Reintentos acotados por `agent_id`, igual que validate.sh, pero cada intento
# aquí es mucho más caro (`pnpm test` completo, no un tsc incremental), así
# que agotarlos dejará más rastro en el log del hook.

set -uo pipefail

MAX_ATTEMPTS=3
MAX_OUTPUT_CHARS=4000

input=$(cat)

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="${CLAUDE_PROJECT_DIR:-$(cd "$script_dir/../../../.." && pwd)}"
scripts_dir="$repo_root/ai-workflow/scripts"
cd "$repo_root" || exit 0

feature_dir=$("$scripts_dir/active-feature.sh" "$repo_root" 2>/dev/null) || exit 0
status_file="$feature_dir/status.yaml"
[[ -f "$status_file" ]] || exit 0

completed=$(sed -nE 's/^[[:space:]]*completed_task_ids:[[:space:]]*\[(.*)\].*/\1/p' "$status_file" | tr -d ' ')
[[ -n "$completed" ]] || exit 0   # nada implementado en esta pasada: los flags ya están en false

set_flag() {
  local field="$1" value="$2"
  sed -i -E "s/^([[:space:]]*${field}:).*/\1 ${value}/" "$status_file"
}

output=$(pnpm test 2>&1)
exit_code=$?

if (( exit_code == 0 )); then
  set_flag "tests_green" "true"
  set_flag "coverage_gate_passed" "true"
  exit 0
fi

tests_green=true
coverage_gate_passed=true
if grep -qE "Test Files.*[1-9][0-9]* failed" <<<"$output"; then
  tests_green=false
fi
if grep -qiE "does not meet|coverage.*threshold" <<<"$output"; then
  coverage_gate_passed=false
fi
# Salida en rojo sin ninguna de las dos señales reconocidas: no asumir éxito.
if [[ "$tests_green" == true && "$coverage_gate_passed" == true ]]; then
  tests_green=false
  coverage_gate_passed=false
fi

set_flag "tests_green" "$tests_green"
set_flag "coverage_gate_passed" "$coverage_gate_passed"

agent_id=$(jq -r '.agent_id // "unknown"' <<<"$input" 2>/dev/null || echo "unknown")
state_dir="${TMPDIR:-/tmp}/claude-implement-feature-validate"
mkdir -p "$state_dir"
counter_file="$state_dir/${agent_id//[^a-zA-Z0-9_-]/_}"

attempts=$(cat "$counter_file" 2>/dev/null || echo 0)
[[ "$attempts" =~ ^[0-9]+$ ]] || attempts=0
attempts=$((attempts + 1))
echo "$attempts" >"$counter_file"

trimmed="$output"
if (( ${#output} > MAX_OUTPUT_CHARS )); then
  trimmed="[...salida truncada...]"$'\n'"${output:$(( ${#output} - MAX_OUTPUT_CHARS ))}"
fi

if (( attempts >= MAX_ATTEMPTS )); then
  rm -f "$counter_file"
  echo "validate-coverage.sh: ${MAX_ATTEMPTS} intentos agotados para $agent_id; se permite cerrar con validación en rojo (tests_green=$tests_green, coverage_gate_passed=$coverage_gate_passed)." >&2
  echo "$trimmed" >&2
  exit 0
fi

remaining=$((MAX_ATTEMPTS - attempts))
reason="La suite completa (\`pnpm test\`) no ha pasado, así que todavía no puedes cerrar la pasada.

tests_green: ${tests_green}
coverage_gate_passed: ${coverage_gate_passed}

${trimmed}

Corrige lo que corresponda antes de volver a intentar el cierre. No toques los tests para forzar el verde.

Intento ${attempts} de ${MAX_ATTEMPTS}; te quedan ${remaining}."

jq -n --arg reason "$reason" '{decision:"block", reason:$reason}'
exit 0
