#!/usr/bin/env bash
# Extrae de `tasks.md` el bloque literal de una tarea.
#
# Uso:
#   extract-task.sh <carpeta-de-la-feature> [<ID>]
#
# Si no se pasa <ID>, se toma `implementation.in_progress_task_id` de
# `status.yaml`. El bloque va desde el encabezado `## <ID> — …` hasta la línea
# anterior al siguiente encabezado de nivel 2, sin el separador `---` ni las
# líneas en blanco finales.
#
# Salida:
#   0 = bloque impreso por stdout
#   1 = argumentos, ficheros o tarea en curso inválidos
#   2 = la tarea no existe en tasks.md o aparece más de una vez

set -uo pipefail

feature_dir="${1:-}"
task_id="${2:-}"

[[ -n "$feature_dir" ]] || { echo "uso: $0 <carpeta-de-la-feature> [<ID>]" >&2; exit 1; }
[[ -d "$feature_dir" ]] || { echo "no existe la carpeta $feature_dir" >&2; exit 1; }

tasks_file="$feature_dir/tasks.md"
status_file="$feature_dir/status.yaml"
[[ -f "$tasks_file" ]] || { echo "no existe $tasks_file" >&2; exit 1; }

if [[ -z "$task_id" ]]; then
  [[ -f "$status_file" ]] || { echo "no existe $status_file y no se ha pasado <ID>" >&2; exit 1; }
  task_id=$(sed -nE 's/^[[:space:]]*in_progress_task_id:[[:space:]]*([^[:space:]#]+).*/\1/p' "$status_file" | head -1)
  if [[ -z "$task_id" || "$task_id" == "null" || "$task_id" == "~" ]]; then
    echo "status.yaml no tiene ninguna tarea en curso (in_progress_task_id vacío)" >&2
    exit 1
  fi
fi

matches=$(grep -cE "^## ${task_id}( |$)" "$tasks_file" || true)
if (( matches == 0 )); then
  echo "la tarea $task_id no existe en $tasks_file" >&2
  exit 2
elif (( matches > 1 )); then
  echo "la tarea $task_id aparece $matches veces en $tasks_file" >&2
  exit 2
fi

awk -v id="$task_id" '
  $0 ~ "^## " id "( |$)" { inside = 1 }
  inside && /^## / && $0 !~ "^## " id "( |$)" { exit }
  inside { lines[++n] = $0 }
  END {
    while (n > 0 && (lines[n] ~ /^[[:space:]]*$/ || lines[n] ~ /^---[[:space:]]*$/)) n--
    for (i = 1; i <= n; i++) print lines[i]
  }
' "$tasks_file"
