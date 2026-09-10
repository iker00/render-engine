#!/usr/bin/env bash
# Hook PreToolUse para `Bash`.
#
# Bloquea saltarse los hooks de git: `--no-verify` en commit/push/merge/
# cherry-pick/rebase/am, y `-c core.hooksPath=...` para apuntar a un
# directorio de hooks vacío.
#
# El comando se comprueba con las cadenas entre comillas y los cuerpos de
# heredoc eliminados primero, para que un mensaje de commit que contenga
# literalmente el texto "--no-verify" (vía comillas o vía `<<'EOF' ... EOF`,
# la forma habitual de los commits de este flujo) no dispare un falso
# positivo. No es un parser de shell completo: heurística deliberada, igual
# de rigurosa que el resto de hooks de este proyecto, no más.

set -uo pipefail

input=$(cat)

tool_name=$(jq -r '.tool_name // empty' <<<"$input" 2>/dev/null)
[[ "$tool_name" == "Bash" ]] || exit 0

command=$(jq -r '.tool_input.command // empty' <<<"$input" 2>/dev/null)
[[ -n "$command" ]] || exit 0

# Fuera los cuerpos de heredoc (<<EOF / <<'EOF' / <<-EOF ... EOF): son datos
# que se le pasan al comando por stdin, no flags de línea de comandos.
no_heredoc=$(awk '
  match($0, /<<-?[[:space:]]*["'"'"']?[A-Za-z_][A-Za-z0-9_]*["'"'"']?/) {
    line = substr($0, RSTART, RLENGTH)
    delim = line
    sub(/^<<-?[[:space:]]*/, "", delim)
    gsub(/["'"'"']/, "", delim)
    print $0
    in_heredoc = 1
    heredoc_delim = delim
    next
  }
  in_heredoc && $0 ~ ("^[[:space:]]*" heredoc_delim "[[:space:]]*$") { in_heredoc = 0; next }
  in_heredoc { next }
  { print }
' <<<"$command")

# Fuera las cadenas entre comillas simples o dobles antes de mirar patrones.
stripped=$(sed -E "s/'[^']*'//g; s/\"[^\"]*\"//g" <<<"$no_heredoc")

if grep -qE '(^|[[:space:]])--no-verify([[:space:]]|$)' <<<"$stripped"; then
  echo "[block-no-verify] BLOQUEADO: --no-verify salta los hooks de git." >&2
  echo "[block-no-verify] Si un hook está bloqueando algo, corrige lo que señala en vez de saltártelo." >&2
  exit 2
fi

if grep -qE '(^|[[:space:]])-c[[:space:]]+core\.hooksPath=' <<<"$stripped"; then
  echo "[block-no-verify] BLOQUEADO: redirigir core.hooksPath es otra forma de saltarse los hooks de git." >&2
  exit 2
fi

exit 0
