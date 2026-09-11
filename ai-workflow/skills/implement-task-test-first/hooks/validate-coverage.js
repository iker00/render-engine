#!/usr/bin/env node
// Hook SubagentStop para el agente `implement-feature`.
//
// Es el único sitio donde corre la suite completa con cobertura (`pnpm test`).
// Escribe él mismo `validation.tests_green` y `validation.coverage_gate_passed`
// en el status.yaml de la feature activa, en vez de que el orquestador lea la
// salida y las escriba: son dos hechos comprobables mecánicamente y el
// orquestador no tiene por qué gastar contexto interpretando un informe de
// cobertura de miles de líneas para extraer dos booleanos.
//
// Si algo falla, devuelve {"decision":"block","reason":...} con un extracto
// acotado. Si no se implementó ninguna tarea en la pasada (completed_task_ids
// sigue vacío), no ejecuta nada: los flags ya están en false por el reset de
// inicio de pasada (ver ai-workflow/rules/status-yaml.md).
//
// Reintentos acotados por `agent_id`, igual que validate.js, pero cada intento
// aquí es mucho más caro (`pnpm test` completo, no un tsc incremental), así
// que agotarlos dejará más rastro en el log del hook.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const MAX_ATTEMPTS = 3;
const MAX_OUTPUT_CHARS = 4000;

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

function setFlag(statusFile, field, value) {
  const content = fs.readFileSync(statusFile, 'utf8');
  const re = new RegExp(`^([ \\t]*${field}:).*$`, 'm');
  fs.writeFileSync(statusFile, content.replace(re, `$1 ${value}`));
}

(async () => {
  const raw = await readStdin();

  let featureDir;
  try {
    featureDir = execFileSync('node', [path.join(scriptsDir, 'active-feature.js'), repoRoot], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    process.exit(0);
  }

  const statusFile = path.join(featureDir, 'status.yaml');
  if (!fs.existsSync(statusFile)) process.exit(0);

  const statusContent = fs.readFileSync(statusFile, 'utf8');
  const completedMatch = statusContent.match(/^[ \t]*completed_task_ids:[ \t]*\[(.*)\]/m);
  const completed = completedMatch ? completedMatch[1].replace(/\s/g, '') : '';
  if (!completed) process.exit(0); // nada implementado en esta pasada: los flags ya están en false

  let output = '';
  let exitCode = 0;
  try {
    output = execFileSync('pnpm', ['test'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    output = (err.stdout || '') + (err.stderr || '');
    exitCode = typeof err.status === 'number' ? err.status : 1;
  }

  if (exitCode === 0) {
    setFlag(statusFile, 'tests_green', 'true');
    setFlag(statusFile, 'coverage_gate_passed', 'true');
    process.exit(0);
  }

  let testsGreen = true;
  let coverageGatePassed = true;
  if (/Test Files.*[1-9][0-9]* failed/.test(output)) testsGreen = false;
  if (/does not meet|coverage.*threshold/im.test(output)) coverageGatePassed = false;
  // Salida en rojo sin ninguna de las dos señales reconocidas: no asumir éxito.
  if (testsGreen && coverageGatePassed) {
    testsGreen = false;
    coverageGatePassed = false;
  }

  setFlag(statusFile, 'tests_green', String(testsGreen));
  setFlag(statusFile, 'coverage_gate_passed', String(coverageGatePassed));

  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    input = {};
  }
  const agentId = input.agent_id || 'unknown';

  const stateDir = path.join(process.env.TMPDIR || os.tmpdir(), 'claude-implement-feature-validate');
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

  let trimmed = output;
  if (output.length > MAX_OUTPUT_CHARS) {
    trimmed = `[...salida truncada...]\n${output.slice(output.length - MAX_OUTPUT_CHARS)}`;
  }

  if (attempts >= MAX_ATTEMPTS) {
    fs.rmSync(counterFile, { force: true });
    console.error(`validate-coverage.js: ${MAX_ATTEMPTS} intentos agotados para ${agentId}; se permite cerrar con validación en rojo (tests_green=${testsGreen}, coverage_gate_passed=${coverageGatePassed}).`);
    console.error(trimmed);
    process.exit(0);
  }

  const remaining = MAX_ATTEMPTS - attempts;
  const reason = `La suite completa (\`pnpm test\`) no ha pasado, así que todavía no puedes cerrar la pasada.

tests_green: ${testsGreen}
coverage_gate_passed: ${coverageGatePassed}

${trimmed}

Corrige lo que corresponda antes de volver a intentar el cierre. No toques los tests para forzar el verde.

Intento ${attempts} de ${MAX_ATTEMPTS}; te quedan ${remaining}.`;

  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
})();
