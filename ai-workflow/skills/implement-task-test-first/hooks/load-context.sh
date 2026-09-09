#!/usr/bin/env bash
# Hook SubagentStart para el subagente `implement-task`.
#
# Deja preparados dos ficheros y le pasa al subagente SUS RUTAS, no su contenido:
#
#   .subagent-context.md  standards del proyecto y docs estables concatenados
#   .subagent-task.md     bloque literal de la tarea en curso, extraído de
#                         tasks.md con extract-task.sh a partir de
#                         status.yaml de la feature activa
#
# Por qué la ruta y no el texto: Claude Code trunca la salida de un hook a partir
# de ~10KB y descarga el resto a disco, así que inyectar ~60KB por
# `additionalContext` solo entregaría un preview. La ruta ocupa unos cientos de
# bytes y el subagente recupera el contenido íntegro con una sola llamada a
# `Read` (medido: 61KB / 869 líneas entran enteras, sin truncado).
#
# El fichero del agente (`ai-workflow/agents/implement-task.md`) es de escritura
# manual y nada lo modifica: aquí no se genera ni se toca.
#
# Orden determinista de concatenación: mismos ficheros de entrada -> mismos bytes
# de salida en cada subagente de la pasada.

set -uo pipefail

cat >/dev/null   # drenar el JSON de stdin; no lo necesitamos

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="${CLAUDE_PROJECT_DIR:-$(cd "$script_dir/../../../.." && pwd)}"
standards_dir="$repo_root/ai-workflow/standards"
docs_dir="$repo_root/ai-workflow/docs"
scripts_dir="$repo_root/ai-workflow/scripts"
context_path="$repo_root/.subagent-context.md"
task_path="$repo_root/.subagent-task.md"

emit() {
  jq -n --arg ctx "$1" \
    '{hookSpecificOutput:{hookEventName:"SubagentStart",additionalContext:$ctx}}'
  exit 0
}

fallback="No hay fichero de contexto compartido disponible. Lee tú mismo, uno a uno, los ficheros de \`ai-workflow/standards/\` y \`ai-workflow/docs/\` (conventions.md, architecture.md, test-index.md) antes de implementar."

[[ -d "$standards_dir" ]] || emit "AVISO: no existe $standards_dir. $fallback"

emit_file() {
  local path="$1"
  echo "## ${path#$repo_root/}"
  echo
  cat "$path"
  echo
}

{
  echo "# Contexto compartido del subagente de implementación"
  echo
  echo "Standards del proyecto y docs estables de la pasada en curso. Una vez leído esto, no vuelvas a abrir estos ficheros por separado."
  echo

  shopt -s nullglob
  for f in "$standards_dir"/*.md; do
    emit_file "$f"
  done
  shopt -u nullglob

  for name in conventions.md architecture.md test-index.md; do
    doc_file="$docs_dir/$name"
    [[ -f "$doc_file" ]] && emit_file "$doc_file"
  done
} > "$context_path" 2>/dev/null || emit "AVISO: no se pudo escribir $context_path. $fallback"

[[ -s "$context_path" ]] || emit "AVISO: el contexto compartido salió vacío. $fallback"

lines=$(wc -l <"$context_path" | tr -d ' ')
kb=$(( ($(wc -c <"$context_path") + 1023) / 1024 ))

# Tarea en curso
rm -f "$task_path"
task_note=""
if feature_dir=$("$scripts_dir/active-feature.sh" "$repo_root" 2>&1); then
  if block=$("$scripts_dir/extract-task.sh" "$feature_dir" 2>&1); then
    printf '%s\n' "$block" > "$task_path"
    task_id=$(sed -nE 's/^## (T[0-9]+).*/\1/p' "$task_path" | head -1)
    task_note="TAREA EN CURSO

- task_id: ${task_id}
- feature_path: ${feature_dir#$repo_root/}

Tu bloque de tarea, extraído literal de tasks.md, está en:

    ${task_path}

Léelo con \`Read\` justo después del contexto compartido. No abras tasks.md."
  else
    task_note="TAREA EN CURSO: NO DISPONIBLE

No se ha podido extraer el bloque de la tarea de ${feature_dir#$repo_root/}: ${block}

Devuelve status \"blocked\" con ese motivo en blocker_reason, sin implementar nada."
  fi
else
  task_note="TAREA EN CURSO: NO DISPONIBLE

No se ha podido determinar la feature activa: ${feature_dir}

Devuelve status \"blocked\" con ese motivo en blocker_reason, sin implementar nada."
fi

emit "CONTEXTO COMPARTIDO DE LA PASADA

Antes de hacer nada más, lee este fichero con \`Read\`:

    ${context_path}

Contiene los standards del proyecto y las docs estables (conventions, architecture, test-index) concatenados: ${kb}KB, ${lines} líneas. Entra entero en una sola llamada a \`Read\` — no lo trocees ni uses \`offset\`/\`limit\`.

Una vez leído, no vuelvas a abrir esos ficheros por separado: ya los tienes.

${task_note}"
