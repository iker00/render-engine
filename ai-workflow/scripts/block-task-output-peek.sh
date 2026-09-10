#!/usr/bin/env bash
# Hook PreToolUse para `Bash|Read`.
#
# Bloquea cualquier acceso directo al fichero `.output` de una tarea en
# segundo plano (`.../tasks/<id>.output`), sea con Bash (cat, grep, until,
# stat, wc...) o con la herramienta Read. Ese fichero es un symlink al
# transcript completo del subagente en crudo, no un fichero de estado: la
# propia herramienta TaskOutput ya avisa de esto, pero un modelo que se
# queda sin ninguna forma de "esperar" a una llamada en segundo plano
# improvisa un bucle contra ese fichero en vez de usar TaskOutput. Este
# hook convierte esa prohibición en un bloqueo, no en una esperanza.

set -uo pipefail

input=$(cat)

tool_name=$(jq -r '.tool_name // empty' <<<"$input" 2>/dev/null)
case "$tool_name" in
  Bash) field=$(jq -r '.tool_input.command // empty' <<<"$input" 2>/dev/null) ;;
  Read) field=$(jq -r '.tool_input.file_path // empty' <<<"$input" 2>/dev/null) ;;
  *) exit 0 ;;
esac
[[ -n "$field" ]] || exit 0

if grep -qE '/tasks/[A-Za-z0-9_.-]+\.output(\b|$)' <<<"$field"; then
  echo "[block-task-output-peek] BLOQUEADO: acceso directo al fichero .output de una tarea en segundo plano." >&2
  echo "[block-task-output-peek] Es el transcript completo del subagente en crudo, no un fichero de estado; leerlo o sondearlo no te dice si ha terminado y puede desbordar tu contexto." >&2
  echo "[block-task-output-peek] Usa la herramienta TaskOutput con el task_id que te devolvió la llamada y block: true. Esa llamada espera de verdad; no construyas un bucle propio." >&2
  exit 2
fi

exit 0
