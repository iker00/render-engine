#!/usr/bin/env node
// Hook SubagentStart para el subagente `implement-task`.
//
// Deja preparados dos ficheros y le pasa al subagente SUS RUTAS, no su contenido:
//
//   .subagent-context.md  standards del proyecto y docs estables concatenados
//   .subagent-task.md     bloque literal de la tarea en curso, extraído de
//                         tasks.md con extract-task.js a partir de
//                         status.yaml de la feature activa
//
// Por qué la ruta y no el texto: Claude Code trunca la salida de un hook a partir
// de ~10KB y descarga el resto a disco, así que inyectar ~60KB por
// `additionalContext` solo entregaría un preview. La ruta ocupa unos cientos de
// bytes y el subagente recupera el contenido íntegro con una sola llamada a
// `Read` (medido: 61KB / 869 líneas entran enteras, sin truncado).
//
// El fichero del agente (`ai-workflow/agents/implement-task.md`) es de escritura
// manual y nada lo modifica: aquí no se genera ni se toca.
//
// Orden determinista de concatenación: mismos ficheros de entrada -> mismos bytes
// de salida en cada subagente de la pasada.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..', '..', '..');
const standardsDir = path.join(repoRoot, 'ai-workflow', 'standards');
const docsDir = path.join(repoRoot, 'ai-workflow', 'docs');
const scriptsDir = path.join(repoRoot, 'ai-workflow', 'scripts');
const contextPath = path.join(repoRoot, '.subagent-context.md');
const taskPath = path.join(repoRoot, '.subagent-task.md');

function relToRoot(p) {
  return path.relative(repoRoot, p);
}

function emit(ctx) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: ctx } }));
  process.exit(0);
}

const fallback = 'No hay fichero de contexto compartido disponible. Lee tú mismo, uno a uno, los ficheros de `ai-workflow/standards/` y `ai-workflow/docs/` (conventions.md, architecture.md, test-index.md) antes de implementar.';

if (!fs.existsSync(standardsDir) || !fs.statSync(standardsDir).isDirectory()) {
  emit(`AVISO: no existe ${standardsDir}. ${fallback}`);
}

function emitFileBlock(filePath) {
  return `## ${relToRoot(filePath)}\n\n${fs.readFileSync(filePath, 'utf8')}\n`;
}

let contextContent;
try {
  const parts = ['# Contexto compartido del subagente de implementación', '', 'Standards del proyecto y docs estables de la pasada en curso. Una vez leído esto, no vuelvas a abrir estos ficheros por separado.', ''];

  const standardFiles = fs.readdirSync(standardsDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => path.join(standardsDir, f));
  for (const f of standardFiles) parts.push(emitFileBlock(f));

  for (const name of ['conventions.md', 'architecture.md', 'test-index.md']) {
    const docFile = path.join(docsDir, name);
    if (fs.existsSync(docFile)) parts.push(emitFileBlock(docFile));
  }

  contextContent = parts.join('\n');
  fs.writeFileSync(contextPath, contextContent);
} catch {
  emit(`AVISO: no se pudo escribir ${contextPath}. ${fallback}`);
}

if (!contextContent || fs.statSync(contextPath).size === 0) {
  emit(`AVISO: el contexto compartido salió vacío. ${fallback}`);
}

const lines = contextContent.split('\n').length - 1;
const kb = Math.ceil(fs.statSync(contextPath).size / 1024);

// Tarea en curso
fs.rmSync(taskPath, { force: true });
let taskNote;
let featureDir;
try {
  featureDir = execFileSync('node', [path.join(scriptsDir, 'active-feature.js'), repoRoot], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
} catch (err) {
  const message = (err.stdout || '') + (err.stderr || '');
  taskNote = `TAREA EN CURSO: NO DISPONIBLE\n\nNo se ha podido determinar la feature activa: ${message.trim()}\n\nDevuelve status "blocked" con ese motivo en blocker_reason, sin implementar nada.`;
  emitTaskAndFinish();
}

if (featureDir) {
  try {
    const block = execFileSync('node', [path.join(scriptsDir, 'extract-task.js'), featureDir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    fs.writeFileSync(taskPath, `${block}\n`);
    const taskIdMatch = block.match(/^## (T[0-9]+)/m);
    const taskId = taskIdMatch ? taskIdMatch[1] : '';
    taskNote = `TAREA EN CURSO\n\n- task_id: ${taskId}\n- feature_path: ${relToRoot(featureDir)}\n\nTu bloque de tarea, extraído literal de tasks.md, está en:\n\n    ${taskPath}\n\nLéelo con \`Read\` justo después del contexto compartido. No abras tasks.md.`;
  } catch (err) {
    const message = (err.stdout || '') + (err.stderr || '');
    taskNote = `TAREA EN CURSO: NO DISPONIBLE\n\nNo se ha podido extraer el bloque de la tarea de ${relToRoot(featureDir)}: ${message.trim()}\n\nDevuelve status "blocked" con ese motivo en blocker_reason, sin implementar nada.`;
  }
}

emitTaskAndFinish();

function emitTaskAndFinish() {
  emit(`CONTEXTO COMPARTIDO DE LA PASADA\n\nAntes de hacer nada más, lee este fichero con \`Read\`:\n\n    ${contextPath}\n\nContiene los standards del proyecto y las docs estables (conventions, architecture, test-index) concatenados: ${kb}KB, ${lines} líneas. Entra entero en una sola llamada a \`Read\` — no lo trocees ni uses \`offset\`/\`limit\`.\n\nUna vez leído, no vuelvas a abrir esos ficheros por separado: ya los tienes.\n\n${taskNote}`);
}
