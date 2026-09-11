#!/usr/bin/env node
// Hook PreToolUse para `Write|Edit`.
//
// Bloquea la edición de los ficheros de configuración de lint, tipos y tests
// del proyecto. La creación por primera vez con `Write` sí se permite; lo que
// se bloquea es debilitar una configuración ya existente para que un check
// deje de fallar, en vez de arreglar el código que lo hace fallar.
//
// `Edit` siempre opera sobre un fichero existente, así que para esa
// herramienta el bloqueo aplica siempre que el nombre coincida.
//
// La lista de ficheros protegidos vive en protected-config-files.txt, junto a
// este script: es lo único específico del stack del proyecto, el resto de
// este script es genérico.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const withGlobs = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${withGlobs}$`);
}

(async () => {
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const toolName = input.tool_name || '';
  const filePath = input.tool_input && input.tool_input.file_path;
  if (!filePath) process.exit(0);

  const patternsFile = path.join(__dirname, 'protected-config-files.txt');
  if (!fs.existsSync(patternsFile)) process.exit(0);

  const lines = fs.readFileSync(patternsFile, 'utf8').split('\n');
  const base = path.basename(filePath);
  let matched = false;
  for (const line of lines) {
    const pattern = line.split('#')[0].trim();
    if (!pattern) continue;
    if (globToRegExp(pattern).test(base)) {
      matched = true;
      break;
    }
  }
  if (!matched) process.exit(0);

  if (toolName === 'Write') {
    try {
      fs.lstatSync(filePath);
      // existe: cae al bloqueo de abajo
    } catch (err) {
      // falla cerrado: cualquier error que no sea "no existe" se trata como
      // "existe", igual que config-protection en ecc.
      if (err.code === 'ENOENT') process.exit(0);
    }
  }

  console.error(`[block-config-edit] BLOQUEADO: ${filePath} coincide con ${patternsFile}.`);
  console.error('[block-config-edit] No se permite editarla para que un check deje de fallar. Corrige el código, no la configuración.');
  console.error('[block-config-edit] Si el cambio de configuración es intencionado, pídeselo al usuario directamente.');
  process.exit(2);
})();
