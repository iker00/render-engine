#!/usr/bin/env bash
# Comprueba que `ai-workflow/docs/test-index.md` sigue correspondiéndose con los
# ficheros reales de `src/tests/`.
#
# El índice se mantiene a mano y eso ya falló una vez: llegó a tener 50 ficheros
# sin catalogar (25% del árbol) y una entrada apuntando a un fichero inexistente.
# El fallo es silencioso —un índice incompleto parece completo— así que conviene
# ejecutarlo al cerrar una feature que añada, mueva o elimine tests.
#
# Salida:
#   0 = índice al día
#   1 = hay desfase (se listan las diferencias)

set -uo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
index_file="$repo_root/ai-workflow/docs/test-index.md"
tests_dir="$repo_root/src/tests"

[[ -f "$index_file" ]] || { echo "no existe $index_file" >&2; exit 1; }
[[ -d "$tests_dir" ]] || { echo "no existe $tests_dir" >&2; exit 1; }

real=$(mktemp); indexed=$(mktemp)
trap 'rm -f "$real" "$indexed"' EXIT

find "$tests_dir" -name '*.test.*' -printf '%f\n' | sort -u >"$real"
grep -oE '`[A-Za-z0-9._-]+\.test\.tsx?`' "$index_file" | tr -d '`' | sort -u >"$indexed"

missing=$(comm -23 "$real" "$indexed")
phantom=$(comm -13 "$real" "$indexed")

n_real=$(wc -l <"$real"); n_missing=$(grep -c . <<<"$missing" || true); n_phantom=$(grep -c . <<<"$phantom" || true)
[[ -z "$missing" ]] && n_missing=0
[[ -z "$phantom" ]] && n_phantom=0

echo "ficheros de test en disco: $n_real"
echo "sin catalogar:             $n_missing"
echo "catalogados inexistentes:  $n_phantom"

if (( n_missing == 0 && n_phantom == 0 )); then
  echo "test-index.md está al día"
  exit 0
fi

if (( n_missing > 0 )); then
  echo; echo "--- faltan en test-index.md:"; sed 's/^/  /' <<<"$missing"
fi
if (( n_phantom > 0 )); then
  echo; echo "--- catalogados pero no existen en disco:"; sed 's/^/  /' <<<"$phantom"
fi
exit 1
