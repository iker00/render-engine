#!/usr/bin/env node
// Hook SubagentStop para el agente `review-task`.
//
// Incrementa `implementation.review_revisions` en el status.yaml de la
// feature activa cada vez que review-task termina, sin mirar el veredicto:
// es un contador de cuántas veces se ha lanzado la revisión sobre la tarea
// en curso, no de cuántas veces ha pedido correcciones. `implement-feature`
// decide con ese número si relanza el ciclo de corrección o lo trata como
// bloqueo — este hook solo lleva la cuenta, no bloquea nada.
//
// No hace falta reintentos ni bloqueo aquí: escribir un entero no falla.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..', '..', '..');
const scriptsDir = path.join(repoRoot, 'ai-workflow', 'scripts');

let featureDir;
try {
  featureDir = execFileSync('node', [path.join(scriptsDir, 'active-feature.js'), repoRoot], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
  process.exit(0);
}

const statusFile = path.join(featureDir, 'status.yaml');
if (!fs.existsSync(statusFile)) process.exit(0);

const content = fs.readFileSync(statusFile, 'utf8');
const fieldRe = /^([ \t]*review_revisions:)[ \t]*(\d+)[ \t]*$/m;
const match = content.match(fieldRe);

let updated;
if (match) {
  const next = parseInt(match[2], 10) + 1;
  updated = content.replace(fieldRe, `$1 ${next}`);
} else {
  // Feature anterior a este campo: insertarlo justo después de
  // in_progress_task_id, que siempre existe dentro de `implementation:`.
  const anchorRe = /^([ \t]*in_progress_task_id:.*)$/m;
  if (!anchorRe.test(content)) process.exit(0);
  updated = content.replace(anchorRe, `$1\n  review_revisions: 1`);
}

fs.writeFileSync(statusFile, updated);
process.exit(0);
