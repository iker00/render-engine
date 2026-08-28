#!/usr/bin/env bash
# Hook SubagentStart para el subagente `implement-task`.
#
# Concatena el contexto compartido de la pasada —standards del proyecto y docs
# estables— en un único fichero y le pasa al subagente SU RUTA, no su contenido.
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
output_path="$repo_root/.subagent-context.md"

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
} > "$output_path" 2>/dev/null || emit "AVISO: no se pudo escribir $output_path. $fallback"

[[ -s "$output_path" ]] || emit "AVISO: el contexto compartido salió vacío. $fallback"

lines=$(wc -l <"$output_path" | tr -d ' ')
kb=$(( ($(wc -c <"$output_path") + 1023) / 1024 ))

emit "CONTEXTO COMPARTIDO DE LA PASADA

Antes de hacer nada más, lee este fichero con \`Read\`:

    ${output_path}

Contiene los standards del proyecto y las docs estables (conventions, architecture, test-index) concatenados: ${kb}KB, ${lines} líneas. Entra entero en una sola llamada a \`Read\` — no lo trocees ni uses \`offset\`/\`limit\`.

Una vez leído, no vuelvas a abrir esos ficheros por separado: ya los tienes."
