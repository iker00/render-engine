// @vitest-environment node
import { build } from 'vite'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, beforeAll } from 'vitest'

const PROJECT_ROOT = new URL('../../../', import.meta.url).pathname.replace(/\/$/, '')
const DIST_ASSETS = join(PROJECT_ROOT, 'dist', 'assets')
const DIST_INDEX = join(PROJECT_ROOT, 'dist', 'index.html')

// Text markers from node components that must NOT appear in the production
// bundle initial entry after code splitting. These strings survive esbuild
// minification and were verified present in the pre-feature bundle.
const FORBIDDEN_NODE_MARKERS = [
  // file-manager node markers
  'No hay ficheros subidos.',
  'Arrastra los ficheros aquí o haz clic para seleccionar',
  'Ver fichero',
  // file-input node marker
  'Límite de ficheros alcanzado',
  // map node marker: Leaflet's root DOM class, only present if its CSS was bundled
  'leaflet-container',
]

/**
 * Extracts the set of JS files that are statically referenced from dist/index.html:
 * - <script type="module" src="..."> entries
 * - <link rel="modulepreload" href="..."> entries
 *
 * Returns an array of absolute paths to the referenced JS files under dist/assets/.
 * Only files under assets/ ending in .js are included.
 */
function extractEntryJsFiles(htmlContent: string, distDir: string): string[] {
  const paths: string[] = []

  // Match <script type="module" ... src="/assets/foo.js">
  const scriptRe = /<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["'][^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = scriptRe.exec(htmlContent)) !== null) {
    paths.push(match[1])
  }

  // Match <link rel="modulepreload" ... href="/assets/foo.js">
  const preloadRe = /<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["'][^>]*>/gi
  while ((match = preloadRe.exec(htmlContent)) !== null) {
    paths.push(match[1])
  }

  return paths
    .map((p) => p.replace(/^\.\//, '/'))
    .filter((p) => p.startsWith('/assets/') && p.endsWith('.js'))
    .map((p) => join(distDir, p.replace(/^\//, '')))
}

describe('production bundle gate: node code splitting', () => {
  beforeAll(async () => {
    // Run a fresh production build via Vite's programmatic API.
    // All three defines are required: without DEV: 'false' and PROD: 'true', the
    // DevRuntime branch in main.tsx is not eliminated as dead code, and its lazy
    // chunk would satisfy the "lazy chunk present" invariant even without node
    // code splitting.
    await build({
      root: PROJECT_ROOT,
      mode: 'production',
      configFile: join(PROJECT_ROOT, 'vite.config.ts'),
      define: {
        'import.meta.env.DEV': 'false',
        'import.meta.env.PROD': 'true',
        'import.meta.env.MODE': JSON.stringify('production'),
      },
      logLevel: 'silent',
    })
  }, 120_000)

  it('dist/assets/ contains more than one JS file', async () => {
    const files = await readdir(DIST_ASSETS)
    const jsFiles = files.filter((f) => f.endsWith('.js'))
    expect(jsFiles.length).toBeGreaterThan(1)
  })

  it('dist/assets/ contains at least one JS file not referenced from dist/index.html (lazy chunk present)', async () => {
    const html = await readFile(DIST_INDEX, 'utf-8')
    const entryFiles = extractEntryJsFiles(html, join(PROJECT_ROOT, 'dist'))

    const files = await readdir(DIST_ASSETS)
    const allJsFiles = files
      .filter((f) => f.endsWith('.js'))
      .map((f) => join(DIST_ASSETS, f))

    const entrySet = new Set(entryFiles)
    const lazyChunks = allJsFiles.filter((f) => !entrySet.has(f))

    expect(lazyChunks.length).toBeGreaterThan(0)
  })

  for (const marker of FORBIDDEN_NODE_MARKERS) {
    it(`bundle initial (entry + modulepreload from index.html) does not contain "${marker}"`, async () => {
      const html = await readFile(DIST_INDEX, 'utf-8')
      const entryFiles = extractEntryJsFiles(html, join(PROJECT_ROOT, 'dist'))

      if (entryFiles.length === 0) {
        throw new Error(
          'Bundle gate FAILED: dist/index.html references no module scripts under assets/*.js.\n' +
            'This is a regression: the HTML must reference the entry bundle.',
        )
      }

      for (const filePath of entryFiles) {
        const content = await readFile(filePath, 'utf-8')
        const fileName = filePath.replace(join(PROJECT_ROOT, 'dist') + '/', '')
        if (content.includes(marker)) {
          throw new Error(
            `Bundle gate FAILED: "${marker}" found in ${fileName}.\n` +
              'Node components must be code-split into separate lazy chunks. ' +
              'The production bundle initial entry (referenced from index.html) must not ' +
              'contain file-manager node text. Note: lazy chunks under dist/assets/ ' +
              'are not part of the bundle initial and are not scanned by this gate.',
          )
        }
      }
    })
  }
})
