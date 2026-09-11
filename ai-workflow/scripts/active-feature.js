#!/usr/bin/env node
// Imprime la ruta de la carpeta de la feature activa.
//
// Uso:
//   node active-feature.js [<raíz-del-repo>]
//
// La feature activa es la carpeta de `ai-workflow/features/` cuyo nombre termina
// en el slug de la rama actual (`feature/<slug>` o `fix/<slug>`).
//
// Salida:
//   0 = ruta impresa por stdout
//   1 = la rama actual no identifica ninguna feature

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function gitToplevel() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const repoRoot = process.argv[2] || process.env.CLAUDE_PROJECT_DIR || gitToplevel();
const featuresDir = path.join(repoRoot, 'ai-workflow', 'features');

if (!fs.existsSync(featuresDir) || !fs.statSync(featuresDir).isDirectory()) {
  fail(`no existe ${featuresDir}`);
}

let branch = '';
try {
  branch = execFileSync('git', ['-C', repoRoot, 'branch', '--show-current'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
  branch = '';
}

let slug = branch;
if (slug.startsWith('feature/')) {
  slug = slug.slice('feature/'.length);
} else if (slug.startsWith('fix/')) {
  slug = slug.slice('fix/'.length);
}

if (!slug || slug === branch) {
  fail(`la rama '${branch}' no es una rama feature/<slug> ni fix/<slug>`);
}

const candidates = fs.readdirSync(featuresDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.endsWith(`-${slug}`))
  .map((entry) => entry.name)
  .sort();

if (candidates.length === 0) {
  fail(`ninguna carpeta de ${featuresDir} termina en '-${slug}'`);
}

console.log(path.join(featuresDir, candidates[candidates.length - 1]));
