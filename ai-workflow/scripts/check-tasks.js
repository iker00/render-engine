#!/usr/bin/env node
// Comprueba que `tasks.md` de una feature tiene la estructura que el flujo de
// implementación da por supuesta, de modo que cada tarea pueda extraerse por
// su ID y contenga los bloques que el subagente necesita.
//
// Uso:
//   node check-tasks.js <carpeta-de-la-feature>
//
// Comprueba:
//   - cada tarea tiene un encabezado de nivel 2 con la forma `## T<n> — <título>`
//     (otros encabezados de nivel 2, como el orden de ejecución, se ignoran)
//   - los IDs son únicos y van en orden creciente
//   - cada tarea contiene los bloques obligatorios (nivel 3 y 4)
//   - los IDs de `status.yaml` existen en `tasks.md`
//
// Salida:
//   0 = estructura correcta
//   1 = hay problemas (se listan)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fail(message) {
  console.error(message);
  process.exit(1);
}

const featureDir = process.argv[2] || '';
if (!featureDir) fail(`uso: ${path.basename(process.argv[1])} <carpeta-de-la-feature>`);
if (!fs.existsSync(featureDir) || !fs.statSync(featureDir).isDirectory()) {
  fail(`no existe la carpeta ${featureDir}`);
}

const tasksFile = path.join(featureDir, 'tasks.md');
const statusFile = path.join(featureDir, 'status.yaml');
if (!fs.existsSync(tasksFile)) fail(`no existe ${tasksFile}`);

const requiredH3 = [
  'Objetivo',
  'Fuera de alcance',
  'Dependencias',
  'Interfaces',
  'Impacto esperado en archivos',
  'Tests',
  'Documentación afectada',
  'Criterios de finalización',
  'Cierre de implementación',
];
const requiredH4 = ['Ficheros de test', 'Comportamiento cubierto', 'Comandos durante la implementación'];

const problems = [];
const add = (p) => problems.push(p);

const lines = fs.readFileSync(tasksFile, 'utf8').split('\n');
const h2 = [];
lines.forEach((text, idx) => {
  if (/^## /.test(text)) h2.push({ line: idx + 1, text });
});
if (h2.length === 0) add("no hay ninguna tarea (ningún encabezado '## T<n> — …')");

const ids = [];
let prevNum = 0;
for (const { line, text } of h2) {
  const wellFormed = text.match(/^## (T[0-9]+) — .+$/);
  if (wellFormed) {
    const id = wellFormed[1];
    const num = parseInt(id.slice(1), 10);
    if (ids.includes(id)) add(`línea ${line}: ID duplicado ${id}`);
    if (!(num > prevNum)) add(`línea ${line}: ${id} no sigue el orden creciente (anterior T${prevNum})`);
    prevNum = num;
    ids.push(id);
  } else if (/^## T[0-9]/.test(text)) {
    add(`línea ${line}: encabezado de tarea mal formado, se espera '## T<n> — <título>': '${text}'`);
  }
}

const extractScript = path.join(__dirname, 'extract-task.js');
for (const id of ids) {
  let block;
  try {
    block = execFileSync('node', [extractScript, featureDir, id], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    continue;
  }
  for (const h of requiredH3) {
    if (!new RegExp(`^### ${h}\\s*$`, 'm').test(block)) add(`${id}: falta el bloque '### ${h}'`);
  }
  for (const h of requiredH4) {
    if (!new RegExp(`^#### ${h}\\s*$`, 'm').test(block)) add(`${id}: falta el sub-bloque '#### ${h}' dentro de Tests`);
  }
}

if (fs.existsSync(statusFile)) {
  const statusContent = fs.readFileSync(statusFile, 'utf8');
  const statusIds = [];
  const completedMatch = statusContent.match(/^[ \t]*completed_task_ids:[ \t]*\[(.*)\]/m);
  if (completedMatch) {
    completedMatch[1].split(',').forEach((s) => statusIds.push(s.trim()));
  }
  const inProgressMatch = statusContent.match(/^[ \t]*in_progress_task_id:[ \t]*([^\s#]+)/m);
  if (inProgressMatch) statusIds.push(inProgressMatch[1].trim());

  for (const sid of statusIds) {
    if (!sid || sid === 'null' || sid === '~') continue;
    if (!ids.includes(sid)) add(`status.yaml referencia ${sid}, que no existe en tasks.md`);
  }
}

console.log(`tareas encontradas: ${ids.length}`);
if (problems.length === 0) {
  console.log('tasks.md tiene la estructura esperada');
  process.exit(0);
}

console.log(`problemas: ${problems.length}`);
for (const p of problems) console.log(`  ${p}`);
process.exit(1);
