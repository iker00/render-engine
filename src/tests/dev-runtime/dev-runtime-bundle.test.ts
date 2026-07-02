// @vitest-environment node
import { build } from 'vite'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, beforeAll } from 'vitest'

const PROJECT_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const DIST_ASSETS = join(PROJECT_ROOT, 'dist', 'assets')
const DIST_INDEX = join(PROJECT_ROOT, 'dist', 'index.html')

// Markers that must NOT appear in the production bundle initial entry
const FORBIDDEN_MARKERS = [
  'monaco-editor',
  '@monaco-editor/react',
  'MonacoEnvironment',
  'runtimeConfigRootSchema',
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
    .filter((p) => p.startsWith('/assets/') && p.endsWith('.js'))
    .map((p) => join(distDir, p.replace(/^\//, '')))
}

describe('production bundle gate: dev wrapper excluded', () => {
  beforeAll(async () => {
    // Run a fresh production build via Vite's programmatic API.
    // Explicitly define import.meta.env flags so that the DEV branch in main.tsx
    // is eliminated as dead code and the dev-runtime chunk is tree-shaken.
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

  it('dist/assets/ contains at least one JS chunk', async () => {
    const files = await readdir(DIST_ASSETS)
    const jsFiles = files.filter((f) => f.endsWith('.js'))
    expect(jsFiles.length).toBeGreaterThan(0)
  })

  it('dist/index.html references at least one module script under assets/*.js', async () => {
    const html = await readFile(DIST_INDEX, 'utf-8')
    const entryFiles = extractEntryJsFiles(html, join(PROJECT_ROOT, 'dist'))
    expect(entryFiles.length).toBeGreaterThan(0)
  })

  for (const marker of FORBIDDEN_MARKERS) {
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
              'The production bundle initial entry (referenced from index.html) must not include Monaco, ' +
              'zod-to-json-schema, or dev-wrapper exports. Note: lazy chunks under dist/assets/ ' +
              'are not part of the bundle initial and are not scanned by this gate.',
          )
        }
      }
    })
  }
})
