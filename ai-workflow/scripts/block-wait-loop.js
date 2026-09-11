#!/usr/bin/env node
// Hook PreToolUse para `Bash|Read`.
//
// Bloquea las dos formas con las que un modelo improvisa la espera de un
// subagente lanzado en segundo plano en vez de usar TaskOutput con
// block: true:
//   - acceder al fichero .output de la tarea, sea con Bash (cat, grep,
//     until, stat, wc...) o con la herramienta Read; es el transcript
//     completo del subagente en crudo, no un fichero de estado
//   - un `sleep` suelto en Bash que no comprueba nada, la otra forma de
//     "esperar" sin usar la herramienta correcta
//
// No hay ningún uso legítimo de ninguna de las dos en este proyecto, así
// que ambas se bloquean sin excepciones.
//
// El comando de Bash se comprueba para `sleep` con las cadenas entre
// comillas y los cuerpos de heredoc eliminados primero, para que un mensaje
// de commit que contenga literalmente la palabra "sleep" no dispare un
// falso positivo. No es un parser de shell completo: heurística deliberada,
// igual de rigurosa que el resto de hooks de este proyecto, no más.

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

  const toolName = input.tool_name;
  let field;
  if (toolName === 'Bash') {
    field = input.tool_input && input.tool_input.command;
  } else if (toolName === 'Read') {
    field = input.tool_input && input.tool_input.file_path;
  } else {
    process.exit(0);
  }
  if (!field) process.exit(0);

  if (/\/tasks\/[A-Za-z0-9_.-]+\.output(\b|$)/.test(field)) {
    console.error('[block-wait-loop] BLOQUEADO: acceso directo al fichero .output de una tarea en segundo plano.');
    console.error('[block-wait-loop] Es el transcript completo del subagente en crudo, no un fichero de estado; leerlo o sondearlo no te dice si ha terminado y puede desbordar tu contexto.');
    console.error('[block-wait-loop] Usa la herramienta TaskOutput con el task_id que te devolvió la llamada y block: true. Esa llamada espera de verdad; no construyas un bucle propio.');
    process.exit(2);
  }

  if (toolName === 'Bash') {
    const stripped = stripQuotedStrings(stripHeredocs(field));
    if (/(^|[;&|(`]|\s)sleep(\s|$)/.test(stripped)) {
      console.error("[block-wait-loop] BLOQUEADO: 'sleep' como espera.");
      console.error('[block-wait-loop] Si estás esperando el resultado de un Agent en segundo plano, usa TaskOutput con ese task_id y block: true. Si no hay ningún subagente en marcha, no esperes: no hay nada que comprobar.');
      process.exit(2);
    }
  }

  process.exit(0);
})();
