#!/usr/bin/env node
// Hook SubagentStop para el subagente `implement-task`.
//
// Antes de dejar cerrar la tarea, valida que el repo queda limpio:
//   1. pnpm lint
//   2. pnpm exec tsc --noEmit -p tsconfig.app.json
//   3. pnpm exec tsc --noEmit -p tsconfig.node.json
//   4. ai-workflow/scripts/check-test-index.js, solo si la tarea tocó src/tests/
//
// Si algo falla, devuelve {"decision":"block","reason":...} con el error concreto:
// Claude Code impide que el subagente termine y le entrega ese motivo, así que
// corrige y vuelve a emitir su JSON.
//
// No se ejecuta la suite de tests aquí a propósito: `pnpm test` corre con
// coverage sobre todo el proyecto y lo lanza el orquestador una sola vez al
// cierre de la pasada. Repetirlo por tarea multiplicaría el coste sin aportar
// señal nueva. Se usa `tsc --noEmit` en vez de `pnpm build` por el mismo motivo:
// valida los mismos tipos sin pagar el bundle de vite.
//
// Reintentos acotados por `agent_id` para que un subagente incapaz de arreglarlo
// no quede en bucle: agotado el límite, se le deja cerrar y el error queda
// visible en el log del hook.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const MAX_ATTEMPTS = 3;
const MAX_OUTPUT_CHARS = 3000;

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

function run(cmd, args) {
  try {
    const output = execFileSync(cmd, args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, output };
  } catch (err) {
    return { ok: false, output: ((err.stdout || '') + (err.stderr || '')) || '' };
  }
}

function runCheck(failures, label, cmd, args) {
  const { ok, output } = run(cmd, args);
  if (ok) return;
  let trimmed = output;
  if (output.length > MAX_OUTPUT_CHARS) {
    trimmed = `[...salida truncada...]\n${output.slice(output.length - MAX_OUTPUT_CHARS)}`;
  }
  if (!trimmed) trimmed = '(el comando falló sin producir salida)';
  failures.push(`### ${label} — FALLA\ncomando: ${[cmd, ...args].join(' ')}\n\n${trimmed}\n`);
}

(async () => {
  const raw = await readStdin();
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    input = {};
  }
  const agentId = input.agent_id || 'unknown';

  const stateDir = path.join(process.env.TMPDIR || os.tmpdir(), 'claude-implement-task-validate');
  fs.mkdirSync(stateDir, { recursive: true });
  const counterFile = path.join(stateDir, agentId.replace(/[^a-zA-Z0-9_-]/g, '_'));

  const failures = [];
  runCheck(failures, 'Lint', 'pnpm', ['lint']);
  runCheck(failures, 'Tipos (app)', 'pnpm', ['exec', 'tsc', '--noEmit', '-p', 'tsconfig.app.json']);
  runCheck(failures, 'Tipos (node)', 'pnpm', ['exec', 'tsc', '--noEmit', '-p', 'tsconfig.node.json']);

  let touchedTests = false;
  try {
    const status = execFileSync('git', ['status', '--porcelain', '--', 'src/tests'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    touchedTests = status.trim().length > 0;
  } catch {
    touchedTests = false;
  }
  if (touchedTests) {
    runCheck(failures, 'Índice de tests', 'node', [path.join(repoRoot, 'ai-workflow', 'scripts', 'check-test-index.js')]);
  }

  if (failures.length === 0) {
    fs.rmSync(counterFile, { force: true });
    process.exit(0);
  }

  let attempts = 0;
  try {
    attempts = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10) || 0;
  } catch {
    attempts = 0;
  }
  attempts += 1;
  fs.writeFileSync(counterFile, String(attempts));

  const failuresText = failures.join('\n');

  if (attempts >= MAX_ATTEMPTS) {
    fs.rmSync(counterFile, { force: true });
    console.error(`validate.js: ${MAX_ATTEMPTS} intentos agotados para ${agentId}; se permite cerrar con validación en rojo.`);
    console.error(failuresText);
    process.exit(0);
  }

  const remaining = MAX_ATTEMPTS - attempts;
  const reason = `La validación automática del repo ha fallado, así que todavía no puedes cerrar la tarea.

${failuresText}Corrige estos errores y vuelve a emitir tu JSON final.

- Si el fallo lo ha provocado tu cambio, arréglalo aunque esté en un fichero que no tocaste directamente.
- Si compruebas que es preexistente y ajeno a tu tarea, devuelve status "blocked" explicándolo en blocker_reason.
- No toques los tests para silenciar un error de tipos o de lint.

Intento ${attempts} de ${MAX_ATTEMPTS}; te quedan ${remaining}. Agotarlos cierra la tarea con la validación en rojo.`;

  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
})();
