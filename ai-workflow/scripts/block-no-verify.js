#!/usr/bin/env node
// Hook PreToolUse para `Bash`.
//
// Bloquea saltarse los hooks de git: `--no-verify` en commit/push/merge/
// cherry-pick/rebase/am, y `-c core.hooksPath=...` para apuntar a un
// directorio de hooks vacío.
//
// El comando se comprueba con las cadenas entre comillas y los cuerpos de
// heredoc eliminados primero, para que un mensaje de commit que contenga
// literalmente el texto "--no-verify" (vía comillas o vía `<<'EOF' ... EOF`,
// la forma habitual de los commits de este flujo) no dispare un falso
// positivo. No es un parser de shell completo: heurística deliberada, igual
// de rigurosa que el resto de hooks de este proyecto, no más.

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

function stripHeredocs(command) {
  const lines = command.split('\n');
  const out = [];
  let inHeredoc = false;
  let delim = null;
  for (const line of lines) {
    if (!inHeredoc) {
      const match = line.match(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
      out.push(line);
      if (match) {
        inHeredoc = true;
        delim = match[2];
      }
      continue;
    }
    if (new RegExp(`^\\s*${delim}\\s*$`).test(line)) {
      inHeredoc = false;
      delim = null;
      continue;
    }
    // dentro del heredoc: se descarta, es dato de stdin, no línea de comandos
  }
  return out.join('\n');
}

function stripQuotedStrings(command) {
  return command.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
}

(async () => {
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  if (input.tool_name !== 'Bash') process.exit(0);
  const command = input.tool_input && input.tool_input.command;
  if (!command) process.exit(0);

  const noHeredoc = stripHeredocs(command);
  const stripped = stripQuotedStrings(noHeredoc);

  if (/(^|\s)--no-verify(\s|$)/.test(stripped)) {
    console.error('[block-no-verify] BLOQUEADO: --no-verify salta los hooks de git.');
    console.error('[block-no-verify] Si un hook está bloqueando algo, corrige lo que señala en vez de saltártelo.');
    process.exit(2);
  }

  if (/(^|\s)-c\s+core\.hooksPath=/.test(stripped)) {
    console.error('[block-no-verify] BLOQUEADO: redirigir core.hooksPath es otra forma de saltarse los hooks de git.');
    process.exit(2);
  }

  process.exit(0);
})();
