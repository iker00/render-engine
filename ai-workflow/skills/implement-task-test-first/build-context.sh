#!/usr/bin/env bash
# Genera el bloque fijo cacheable del prompt del subagente de implement-task-test-first.
#
# Concatena en orden determinista:
#   1. Standards del proyecto (ai-workflow/standards/*.md, alfabético)
#   2. Docs estables (workflow.md, conventions.md, architecture.md, test-index.md)
#   3. Contrato de implementación del subagente (subagent-prompt.md)
#
# Escribe a <output_path> y emite el mismo contenido a stdout via `tee`, para que
# el orquestador lo capture en una sola llamada a Bash. Mismos ficheros de entrada
# -> mismos bytes de salida -> prompt cache hit en cada subagente de la pasada.
#
# Uso:
#   build-context.sh <output_path>

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: build-context.sh <output_path>" >&2
  exit 1
fi

output_path="$1"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"
standards_dir="$repo_root/ai-workflow/standards"
docs_dir="$repo_root/ai-workflow/docs"
contract_file="$script_dir/subagent-prompt.md"

if [[ ! -f "$contract_file" ]]; then
  echo "missing contract file: $contract_file" >&2
  exit 1
fi

mkdir -p "$(dirname "$output_path")"

emit_file() {
  local path="$1"
  local rel="${path#$repo_root/}"
  echo "## $rel"
  echo
  cat "$path"
  echo
}

{
  echo "# Contexto compartido del subagente de implementación"
  echo
  echo "Este bloque es idéntico en cada subagente lanzado durante la pasada actual: standards del proyecto, docs estables y contrato de implementación. Aparece como prefijo cacheable para que el LLM no lo procese como material nuevo cada vez. No releas los ficheros incluidos aquí; ya están cargados en tu contexto."
  echo

  if [[ -d "$standards_dir" ]]; then
    shopt -s nullglob
    for f in "$standards_dir"/*.md; do
      emit_file "$f"
    done
    shopt -u nullglob
  fi

  for name in workflow.md conventions.md architecture.md test-index.md; do
    doc_file="$docs_dir/$name"
    [[ -f "$doc_file" ]] && emit_file "$doc_file"
  done

  emit_file "$contract_file"
} | tee "$output_path"
