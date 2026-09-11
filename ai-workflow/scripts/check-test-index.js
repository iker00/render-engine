#!/usr/bin/env node
// Comprueba que `ai-workflow/docs/test-index.md` sigue correspondiéndose con los
// ficheros reales de `src/tests/`.
//
// El índice se mantiene a mano y eso ya falló una vez: llegó a tener 50 ficheros
// sin catalogar (25% del árbol) y una entrada apuntando a un fichero inexistente.
// El fallo es silencioso —un índice incompleto parece completo— así que conviene
// ejecutarlo al cerrar una feature que añada, mueva o elimine tests.
//
// Salida:
//   0 = índice al día
//   1 = hay desfase (se listan las diferencias)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const indexFile = path.join(repoRoot, 'ai-workflow', 'docs', 'test-index.md');
const testsDir = path.join(repoRoot, 'src', 'tests');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(indexFile)) fail(`no existe ${indexFile}`);
if (!fs.existsSync(testsDir)) fail(`no existe ${testsDir}`);

function findTestFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(full));
    } else if (entry.name.includes('.test.')) {
      results.push(entry.name);
    }
  }
  return results;
}

const real = [...new Set(findTestFiles(testsDir))].sort();

const indexContent = fs.readFileSync(indexFile, 'utf8');
const indexedMatches = indexContent.match(/`[A-Za-z0-9._-]+\.test\.tsx?`/g) || [];
const indexed = [...new Set(indexedMatches.map((m) => m.slice(1, -1)))].sort();

const realSet = new Set(real);
const indexedSet = new Set(indexed);
const missing = real.filter((f) => !indexedSet.has(f));
const phantom = indexed.filter((f) => !realSet.has(f));

console.log(`ficheros de test en disco: ${real.length}`);
console.log(`sin catalogar:             ${missing.length}`);
console.log(`catalogados inexistentes:  ${phantom.length}`);

if (missing.length === 0 && phantom.length === 0) {
  console.log('test-index.md está al día');
  process.exit(0);
}

if (missing.length > 0) {
  console.log('\n--- faltan en test-index.md:');
  for (const f of missing) console.log(`  ${f}`);
}
if (phantom.length > 0) {
  console.log('\n--- catalogados pero no existen en disco:');
  for (const f of phantom) console.log(`  ${f}`);
}
process.exit(1);
