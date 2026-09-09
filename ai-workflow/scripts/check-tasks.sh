#!/usr/bin/env bash
# Comprueba que `tasks.md` de una feature tiene la estructura que el flujo de
# implementación da por supuesta, de modo que cada tarea pueda extraerse por
# su ID y contenga los bloques que el subagente necesita.
#
# Uso:
#   check-tasks.sh <carpeta-de-la-feature>
#
# Comprueba:
#   - cada tarea tiene un encabezado de nivel 2 con la forma `## T<n> — <título>`
#     (otros encabezados de nivel 2, como el orden de ejecución, se ignoran)
#   - los IDs son únicos y van en orden creciente
#   - cada tarea contiene los bloques obligatorios (nivel 3 y 4)
#   - los IDs de `status.yaml` existen en `tasks.md`
#
# Salida:
#   0 = estructura correcta
#   1 = hay problemas (se listan)

set -uo pipefail

feature_dir="${1:-}"
[[ -n "$feature_dir" ]] || { echo "uso: $0 <carpeta-de-la-feature>" >&2; exit 1; }
[[ -d "$feature_dir" ]] || { echo "no existe la carpeta $feature_dir" >&2; exit 1; }

tasks_file="$feature_dir/tasks.md"
status_file="$feature_dir/status.yaml"
[[ -f "$tasks_file" ]] || { echo "no existe $tasks_file" >&2; exit 1; }

required_h3=(
  "Objetivo"
  "Fuera de alcance"
  "Dependencias"
  "Interfaces"
  "Impacto esperado en archivos"
  "Tests"
  "Documentación afectada"
  "Criterios de finalización"
  "Cierre de implementación"
)
required_h4=(
  "Ficheros de test"
  "Comportamiento cubierto"
  "Comandos durante la implementación"
)

problems=()
add() { problems+=("$1"); }

# Encabezados de nivel 2
mapfile -t h2 < <(grep -nE '^## ' "$tasks_file")
(( ${#h2[@]} > 0 )) || add "no hay ninguna tarea (ningún encabezado '## T<n> — …')"

ids=()
prev_num=0
for entry in "${h2[@]}"; do
  line="${entry%%:*}"
  text="${entry#*:}"
  if [[ "$text" =~ ^##\ (T[0-9]+)\ —\ .+$ ]]; then
    id="${BASH_REMATCH[1]}"
    num=$((10#${id#T}))
    for seen in "${ids[@]:-}"; do
      [[ "$seen" == "$id" ]] && add "línea $line: ID duplicado $id"
    done
    (( num > prev_num )) || add "línea $line: $id no sigue el orden creciente (anterior T$prev_num)"
    prev_num=$num
    ids+=("$id")
  elif [[ "$text" =~ ^##\ T[0-9] ]]; then
    add "línea $line: encabezado de tarea mal formado, se espera '## T<n> — <título>': '$text'"
  fi
done

# Bloques obligatorios por tarea
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
for id in "${ids[@]:-}"; do
  [[ -n "$id" ]] || continue
  block=$("$script_dir/extract-task.sh" "$feature_dir" "$id" 2>/dev/null) || continue
  for h in "${required_h3[@]}"; do
    grep -qE "^### ${h}[[:space:]]*$" <<<"$block" || add "$id: falta el bloque '### $h'"
  done
  for h in "${required_h4[@]}"; do
    grep -qE "^#### ${h}[[:space:]]*$" <<<"$block" || add "$id: falta el sub-bloque '#### $h' dentro de Tests"
  done
done

# IDs referenciados desde status.yaml
if [[ -f "$status_file" ]]; then
  mapfile -t status_ids < <(
    {
      sed -nE 's/^[[:space:]]*completed_task_ids:[[:space:]]*\[(.*)\].*/\1/p' "$status_file" | tr ',' '\n'
      sed -nE 's/^[[:space:]]*in_progress_task_id:[[:space:]]*([^[:space:]#]+).*/\1/p' "$status_file"
    } | tr -d ' ' | grep -vE '^(null|~|)$'
  )
  for sid in "${status_ids[@]:-}"; do
    [[ -n "$sid" ]] || continue
    found=0
    for id in "${ids[@]:-}"; do [[ "$id" == "$sid" ]] && found=1; done
    (( found )) || add "status.yaml referencia $sid, que no existe en tasks.md"
  done
fi

echo "tareas encontradas: ${#ids[@]}"
if (( ${#problems[@]} == 0 )); then
  echo "tasks.md tiene la estructura esperada"
  exit 0
fi

echo "problemas: ${#problems[@]}"
printf '  %s\n' "${problems[@]}"
exit 1
