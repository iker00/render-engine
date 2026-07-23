/**
 * Valida ADE_Unificado.json contra validateRuntimeConfig y monta el runtime.
 * Se salta si el fichero aún no se ha generado.
 */
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { validateRuntimeConfig, type RuntimeConfig } from '../../config/runtime-config'
import {
  RuntimeStateProvider,
  useRuntimeStateActions,
} from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../../runtime/runtime-page'

const UNIFIED_PATH = join(process.cwd(), 'dist', 'unified-config', 'ADE_Unificado.json')
const hasUnified = existsSync(UNIFIED_PATH)

function NavigateButton({ pageId, label }: { pageId: string; label: string }) {
  const { navigateToPage } = useRuntimeStateActions()
  return (
    <button type="button" onClick={() => navigateToPage(pageId)}>
      {label}
    </button>
  )
}

describe.skipIf(!hasUnified)('ADE_Unificado (dist/unified-config)', () => {
  let config: RuntimeConfig

  beforeEach(() => {
    const raw = JSON.parse(readFileSync(UNIFIED_PATH, 'utf-8')) as unknown
    const result = validateRuntimeConfig(raw)
    if (result.status === 'error') {
      throw new Error(result.error.message)
    }
    config = result.config

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  })

  it('pasa validateRuntimeConfig del motor', () => {
    const raw = JSON.parse(readFileSync(UNIFIED_PATH, 'utf-8')) as unknown
    const result = validateRuntimeConfig(raw)
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.config.initialPage).toBe('inicio')
      expect(result.config.pages.some((p) => p.id === 'inicio')).toBe(true)
      expect(result.config.tokens?.token?.value).toBe('#bearer_token#')
    }
  })

  it('monta RuntimeStateProvider + RuntimePage sin lanzar', async () => {
    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('runtime-page')).toBeTruthy()
    })

    const page = screen.getByTestId('runtime-page')
    expect(page.getAttribute('data-runtime-page-id')).toBe('inicio')
  })

  it('puede navegar a otra página del bundle vía navigateToPage', async () => {
    const hasBuscar = config.pages.some((p) => p.id === 'buscar-persona')
    expect(hasBuscar).toBe(true)

    render(
      <RuntimeStateProvider config={config}>
        <NavigateButton pageId="buscar-persona" label="go-buscar" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'go-buscar' }))

    await waitFor(() => {
      expect(screen.getByTestId('runtime-page').getAttribute('data-runtime-page-id')).toBe(
        'buscar-persona',
      )
    })
  })
})
