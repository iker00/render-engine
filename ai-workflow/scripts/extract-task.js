#!/usr/bin/env node
// Extrae de `tasks.md` el bloque literal de una tarea.
//
// Uso:
//   node extract-task.js <carpeta-de-la-feature> [<ID>]
//
// Si no se pasa <ID>, se toma `implementation.in_progress_task_id` de
// `status.yaml`. El bloque va desde el encabezado `## <ID> — …` hasta la línea
// anterior al siguiente encabezado de nivel 2, sin el separador `---` ni las
// líneas en blanco finales.
//
// Salida:
//   0 = bloque impreso por stdout
//   1 = argumentos, ficheros o tarea en curso inválidos
//   2 = la tarea no existe en tasks.md o aparece más de una vez

import fs from 'node:fs';
import path from 'node:path';

function fail(code, message) {
  console.error(message);
  process.exit(code);
}

const featureDir = process.argv[2] || '';
let taskId = process.argv[3] || '';

if (!featureDir) fail(1, `uso: ${path.basename(process.argv[1])} <carpeta-de-la-feature> [<ID>]`);
if (!fs.existsSync(featureDir) || !fs.statSync(featureDir).isDirectory()) {
  fail(1, `no existe la carpeta ${featureDir}`);
}

const tasksFile = path.join(featureDir, 'tasks.md');
const statusFile = path.join(featureDir, 'status.yaml');
if (!fs.existsSync(tasksFile)) fail(1, `no existe ${tasksFile}`);

if (!taskId) {
  if (!fs.existsSync(statusFile)) {
    fail(1, `no existe ${statusFile} y no se ha pasado <ID>`);
  }
  const statusContent = fs.readFileSync(statusFile, 'utf8');
  const match = statusContent.match(/^[ \t]*in_progress_task_id:[ \t]*([^\s#]+)/m);
  taskId = match ? match[1] : '';
  if (!taskId || taskId === 'null' || taskId === '~') {
    fail(1, 'status.yaml no tiene ninguna tarea en curso (in_progress_task_id vacío)');
  }
}

const lines = fs.readFileSync(tasksFile, 'utf8').split('\n');
const headingRe = new RegExp(`^## ${taskId}( |$)`);
const matches = lines.filter((line) => headingRe.test(line));

if (matches.length === 0) fail(2, `la tarea ${taskId} no existe en ${tasksFile}`);
if (matches.length > 1) fail(2, `la tarea ${taskId} aparece ${matches.length} veces en ${tasksFile}`);

let inside = false;
const collected = [];
for (const line of lines) {
  if (headingRe.test(line)) {
    inside = true;
    collected.push(line);
    continue;
  }
  if (inside && /^## /.test(line)) break;
  if (inside) collected.push(line);
}

while (collected.length > 0) {
  const last = collected[collected.length - 1];
  if (/^\s*$/.test(last) || /^---\s*$/.test(last)) {
    collected.pop();
  } else {
    break;
  }
}

console.log(collected.join('\n'));
