#!/usr/bin/env node
// Hook SubagentStart para el agente `review-task`.
//
// Deja preparados tres ficheros y le pasa al agente SUS RUTAS, no su contenido
// (mismo motivo que `load-context.js`: un hook trunca su salida a partir de
// ~10KB, y el diff de una tarea puede superarlo con facilidad):
//
//   .review-task-block.md  bloque literal de la tarea en curso, extraído de
//                          tasks.md con extract-task.js
//   .review-diff.patch     `git diff` sin commitear (el delta de esta tarea:
//                          las anteriores ya están commiteadas)
//   .task-report.json      el JSON que devolvió el subagente implementador,
//                          volcado a disco por implement-feature antes de
//                          lanzar esta revisión
//
// La tarea en curso se identifica igual que en `load-context.js`:
// `implementation.in_progress_task_id` de la feature activa. Se mantiene
// puesta hasta que review-task aprueba, así que sigue apuntando a la tarea
// correcta durante todo el ciclo de revisión-corrección.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..', '..', '..');
const scriptsDir = path.join(repoRoot, 'ai-workflow', 'scripts');

const blockPath = path.join(repoRoot, '.review-task-block.md');
const diffPath = path.join(repoRoot, '.review-diff.patch');
const reportPath = path.join(repoRoot, '.task-report.json');

function emit(ctx) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: ctx } }));
  process.exit(0);
}

let featureDir;
try {
  featureDir = execFileSync('node', [path.join(scriptsDir, 'active-feature.js'), repoRoot], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
} catch (err) {
  emit(`No se ha podido determinar la feature activa: ${((err.stdout || '') + (err.stderr || '')).trim()}\n\nDevuelve "requiere correcciones" con ese motivo como único hallazgo.`);
}

let block;
try {
  block = execFileSync('node', [path.join(scriptsDir, 'extract-task.js'), featureDir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  fs.writeFileSync(blockPath, block);
} catch (err) {
  emit(`No se ha podido extraer el bloque de la tarea en curso: ${((err.stdout || '') + (err.stderr || '')).trim()}\n\nDevuelve "requiere correcciones" con ese motivo como único hallazgo.`);
}

let diff = '';
try {
  diff = execFileSync('git', ['diff'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch {
  diff = '';
}
fs.writeFileSync(diffPath, diff);

const reportNote = fs.existsSync(reportPath)
  ? `    ${reportPath}`
  : `    (no disponible: ${reportPath} no existe; revisa igualmente el diff y el bloque de la tarea)`;

emit(`Lee estos tres ficheros con \`Read\`, en este orden, antes de hacer nada más:

1. Bloque de la tarea:
    ${blockPath}
2. Diff sin commitear de esta tarea:
    ${diffPath}
3. Informe del implementador:
${reportNote}

Cada uno entra entero en una sola lectura. Una vez leídos, no vuelvas a abrirlos por separado.`);
