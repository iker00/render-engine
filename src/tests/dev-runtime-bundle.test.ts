// @vitest-environment node
import { build } from 'vite'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, beforeAll } from 'vitest'

const PROJECT_ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
const DIST_ASSETS = join(PROJECT_ROOT, 'dist', 'assets')

// Markers that must NOT appear in the production bundle
const FORBIDDEN_MARKERS = [
  'monaco-editor',
  '@monaco-editor/react',
  'MonacoEnvironment',
  'DevRuntime',
  'runtimeConfigRootSchema',
]

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

  for (const marker of FORBIDDEN_MARKERS) {
    it(`dist/assets/ JS chunks do not contain "${marker}"`, async () => {
      const files = await readdir(DIST_ASSETS)
      const jsFiles = files.filter((f) => f.endsWith('.js'))

      for (const file of jsFiles) {
        const content = await readFile(join(DIST_ASSETS, file), 'utf-8')
        if (content.includes(marker)) {
          throw new Error(
            `Bundle gate FAILED: "${marker}" found in dist/assets/${file}.\n` +
              'The production bundle must not include Monaco, zod-to-json-schema, or dev-wrapper exports.',
          )
        }
      }
    })
  }
})
