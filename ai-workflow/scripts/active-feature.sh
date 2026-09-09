#!/usr/bin/env bash
# Imprime la ruta de la carpeta de la feature activa.
#
# Uso:
#   active-feature.sh [<raíz-del-repo>]
#
# La feature activa es la carpeta de `ai-workflow/features/` cuyo nombre termina
# en el slug de la rama actual (`feature/<slug>` o `fix/<slug>`).
#
# Salida:
#   0 = ruta impresa por stdout
#   1 = la rama actual no identifica ninguna feature

set -uo pipefail

repo_root="${1:-${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}}"
features_dir="$repo_root/ai-workflow/features"
[[ -d "$features_dir" ]] || { echo "no existe $features_dir" >&2; exit 1; }

branch=$(git -C "$repo_root" branch --show-current 2>/dev/null || true)
slug="${branch#feature/}"
slug="${slug#fix/}"

if [[ -z "$slug" || "$slug" == "$branch" ]]; then
  echo "la rama '$branch' no es una rama feature/<slug> ni fix/<slug>" >&2
  exit 1
fi

match=$(find "$features_dir" -mindepth 1 -maxdepth 1 -type d -name "*-$slug" | sort | tail -1)
if [[ -z "$match" ]]; then
  echo "ninguna carpeta de $features_dir termina en '-$slug'" >&2
  exit 1
fi

echo "$match"
