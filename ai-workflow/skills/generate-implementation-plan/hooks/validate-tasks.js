#!/usr/bin/env node
// Hook SubagentStop para el agente `plan-feature`.
//
// Antes de dejar cerrar la planificación, ejecuta `check-tasks.js` sobre la
// feature activa. Si la estructura de `tasks.md` no es válida, devuelve
// {"decision":"block","reason":...} con la lista de problemas para que el agente
// la corrija y vuelva a cerrar. Reintentos acotados por `agent_id`; agotados, se
// permite cerrar y los problemas quedan en el log del hook.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const MAX_ATTEMPTS = 3;

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..', '..', '..');
const scriptsDir = path.join(repoRoot, 'ai-workflow', 'scripts');

function relToRoot(p) {
  return path.relative(repoRoot, p);
}

(async () => {
  const raw = await readStdin();

  let featureDir;
  try {
    featureDir = execFileSync('node', [path.join(scriptsDir, 'active-feature.js'), repoRoot], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    process.exit(0);
  }
  if (!fs.existsSync(path.join(featureDir, 'tasks.md'))) process.exit(0);

  let output;
  try {
    output = execFileSync('node', [path.join(scriptsDir, 'check-tasks.js'), featureDir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.exit(0);
  } catch (err) {
    output = ((err.stdout || '') + (err.stderr || '')).trim();
  }

  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    input = {};
  }
  const agentId = input.agent_id || 'unknown';

  const stateDir = path.join(process.env.TMPDIR || os.tmpdir(), 'claude-plan-feature-validate');
  fs.mkdirSync(stateDir, { recursive: true });
  const counterFile = path.join(stateDir, agentId.replace(/[^a-zA-Z0-9_-]/g, '_'));

  let attempts = 0;
  try {
    attempts = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10) || 0;
  } catch {
    attempts = 0;
  }
  attempts += 1;
  fs.writeFileSync(counterFile, String(attempts));

  if (attempts >= MAX_ATTEMPTS) {
    fs.rmSync(counterFile, { force: true });
    console.error(`validate-tasks.js: ${MAX_ATTEMPTS} intentos agotados para ${agentId}; se permite cerrar con tasks.md inválido.`);
    console.error(output);
    process.exit(0);
  }

  const remaining = MAX_ATTEMPTS - attempts;
  const reason = `La estructura de tasks.md no es válida, así que todavía no puedes cerrar la planificación.

${output}

Corrige estos problemas en ${relToRoot(featureDir)}/tasks.md y vuelve a emitir tu respuesta final.

Intento ${attempts} de ${MAX_ATTEMPTS}; te quedan ${remaining}.`;

  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
})();
