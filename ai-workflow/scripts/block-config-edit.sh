#!/usr/bin/env bash
# Hook PreToolUse para `Write|Edit`.
#
# Bloquea la edición de los ficheros de configuración de lint, tipos y tests
# del proyecto. La creación por primera vez con `Write` sí se permite; lo que
# se bloquea es debilitar una configuración ya existente para que un check
# deje de fallar, en vez de arreglar el código que lo hace fallar.
#
# `Edit` siempre opera sobre un fichero existente, así que para esa
# herramienta el bloqueo aplica siempre que el nombre coincida.
#
# La lista de ficheros protegidos vive en protected-config-files.txt, junto a
# este script: es lo único específico del stack del proyecto, el resto de
# este script es genérico.

set -uo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
patterns_file="$script_dir/protected-config-files.txt"

input=$(cat)

tool_name=$(jq -r '.tool_name // empty' <<<"$input" 2>/dev/null)
file_path=$(jq -r '.tool_input.file_path // empty' <<<"$input" 2>/dev/null)
[[ -n "$file_path" ]] || exit 0
[[ -f "$patterns_file" ]] || exit 0

base="$(basename -- "$file_path")"
match=0
while IFS= read -r pattern; do
  pattern="${pattern%%#*}"                     # quitar comentario de fin de línea
  pattern="$(echo -n "$pattern" | xargs)"       # recortar espacios
  [[ -z "$pattern" ]] && continue
  # shellcheck disable=SC2053  # patrón sin comillas: coincidencia glob a propósito
  [[ "$base" == $pattern ]] && { match=1; break; }
done < "$patterns_file"
(( match == 1 )) || exit 0

if [[ "$tool_name" == "Write" ]]; then
  # Falla cerrado: cualquier error que no sea "no existe" se trata como
  # "existe", igual que config-protection en ecc.
  if ! lstat_out=$(command -p ls -ld -- "$file_path" 2>&1); then
    [[ "$lstat_out" == *"No such file"* ]] && exit 0
  fi
fi

echo "[block-config-edit] BLOQUEADO: $file_path coincide con $patterns_file." >&2
echo "[block-config-edit] No se permite editarla para que un check deje de fallar. Corrige el código, no la configuración." >&2
echo "[block-config-edit] Si el cambio de configuración es intencionado, pídeselo al usuario directamente." >&2
exit 2
