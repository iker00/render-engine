#!/usr/bin/env node
// Hook SubagentStart para el agente `review-plan`.
//
// Ejecuta `check-tasks.js` sobre la feature activa y entrega el resultado al
// revisor como contexto adicional, para que arranque sabiendo si la estructura
// de `tasks.md` es válida y dedique su trabajo a lo que requiere juicio.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..', '..', '..');
const scriptsDir = path.join(repoRoot, 'ai-workflow', 'scripts');

function relToRoot(p) {
  return path.relative(repoRoot, p);
}

function emit(ctx) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: ctx } }));
  process.exit(0);
}

let featureDir;
try {
  featureDir = execFileSync('node', [path.join(scriptsDir, 'active-feature.js'), repoRoot], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
} catch (err) {
  emit(`No se ha podido determinar la feature activa: ${((err.stdout || '') + (err.stderr || '')).trim()}`);
}

if (!fs.existsSync(path.join(featureDir, 'tasks.md'))) {
  emit(`La feature activa es ${relToRoot(featureDir)} pero no tiene tasks.md.`);
}

try {
  const output = execFileSync('node', [path.join(scriptsDir, 'check-tasks.js'), featureDir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  emit(`Feature activa: ${relToRoot(featureDir)}\n\nEstructura de tasks.md comprobada por script: correcta.\n${output}`);
} catch (err) {
  const output = ((err.stdout || '') + (err.stderr || '')).trim();
  emit(`Feature activa: ${relToRoot(featureDir)}\n\nEstructura de tasks.md comprobada por script: INVÁLIDA. Cada problema de esta lista es un refinamiento obligatorio.\n${output}`);
}
