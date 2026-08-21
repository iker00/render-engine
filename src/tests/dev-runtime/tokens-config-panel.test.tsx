import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { validateTokensConfig } from '../../config/validate-tokens-config'
import type { RuntimeApiConfig, RuntimeConfig, RuntimeTokensConfig } from '../../config/runtime-config-types'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { TokensConfigPanel } from '../../dev-runtime/tokens-config-panel/tokens-config-panel'

const API: RuntimeApiConfig = {
  getBalance: { method: 'GET', endpoint: '/balance' },
  getProfile: { method: 'GET', endpoint: '/profile' },
}

function buildConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    api: API,
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
    tokens: {},
    ...overrides,
  } as RuntimeConfig
}

const noopCommitTokensMutation = (): CommitCanvasMutationResult => ({ status: 'applied' })

const REJECTED: CommitCanvasMutationResult = {
  status: 'rejected',
  error: { code: 'invalid-layout', displayMode: 'development-only', message: 'Valor no válido' },
}

function renderPanel(
  tokens: RuntimeTokensConfig | undefined,
  onCommitTokensMutation: (mutate: (prev: RuntimeTokensConfig) => RuntimeTokensConfig) => CommitCanvasMutationResult = noopCommitTokensMutation,
  config: RuntimeConfig = buildConfig({ tokens }),
  api: RuntimeApiConfig = API,
) {
  return render(
    <TokensConfigPanel config={config} tokens={tokens} api={api} onCommitTokensMutation={onCommitTokensMutation} />,
  )
}

describe('TokensConfigPanel empty state', () => {
  it('shows "Sin operaciones declaradas." when tokens is undefined', () => {
    renderPanel(undefined)
    expect(screen.getByText('Sin operaciones declaradas.')).toBeInTheDocument()
  })

  it('shows "Sin operaciones declaradas." when tokens is {}', () => {
    renderPanel({})
    expect(screen.getByText('Sin operaciones declaradas.')).toBeInTheDocument()
  })
})

describe('TokensConfigPanel listing', () => {
  it('renders one card per token with its id and current value', () => {
    renderPanel({
      authToken: { value: 'abc' },
      refreshToken: { value: 'xyz' },
    })

    expect(screen.getByText('authToken')).toBeInTheDocument()
    expect(screen.getByLabelText('Value de authToken')).toHaveValue('abc')
    expect(screen.getByText('refreshToken')).toBeInTheDocument()
    expect(screen.getByLabelText('Value de refreshToken')).toHaveValue('xyz')
  })
})

describe('TokensConfigPanel creation', () => {
  it('adds a token with id/value producing { ...prev, [id]: { value } } without refresh and clears the form', () => {
    const onCommitTokensMutation = vi.fn(noopCommitTokensMutation)
    renderPanel({ authToken: { value: 'abc' } }, onCommitTokensMutation)

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'newToken' } })
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    expect(onCommitTokensMutation).toHaveBeenCalledTimes(1)
    const mutate = onCommitTokensMutation.mock.calls[0][0]
    expect(mutate({ authToken: { value: 'abc' } })).toEqual({
      authToken: { value: 'abc' },
      newToken: { value: 'secret' },
    })

    expect(screen.getByLabelText('Id')).toHaveValue('')
    expect(screen.getByLabelText('Value')).toHaveValue('')
  })

  it('disables "Añadir" and shows a reason without committing when id is empty (including only spaces)', () => {
    const onCommitTokensMutation = vi.fn(noopCommitTokensMutation)
    renderPanel({}, onCommitTokensMutation)

    expect(screen.getByRole('button', { name: 'Añadir' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'secret' } })
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeDisabled()
    expect(screen.getByText(/no puede estar vacío/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(onCommitTokensMutation).not.toHaveBeenCalled()
  })

  it('disables "Añadir" and shows a reason without committing when id normalizes to a duplicate (case-sensitive, trimmed)', () => {
    const onCommitTokensMutation = vi.fn(noopCommitTokensMutation)
    renderPanel({ authToken: { value: 'abc' } }, onCommitTokensMutation)

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: '  authToken  ' } })
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'secret' } })
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeDisabled()
    expect(screen.getByText(/ya existe/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(onCommitTokensMutation).not.toHaveBeenCalled()

    // Case-sensitivity: "AuthToken" is not a duplicate of "authToken".
    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'AuthToken' } })
    expect(screen.getByRole('button', { name: 'Añadir' })).not.toBeDisabled()
  })

  it('disables "Añadir" and shows a reason without committing when value is empty', () => {
    const onCommitTokensMutation = vi.fn(noopCommitTokensMutation)
    renderPanel({}, onCommitTokensMutation)

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'newToken' } })
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeDisabled()
    expect(screen.getByText(/value no puede estar vacío/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(onCommitTokensMutation).not.toHaveBeenCalled()
  })

  it('keeps the typed values and shows a role="alert" banner when the creation commit is rejected', () => {
    const onCommitTokensMutation = vi.fn(() => REJECTED)
    renderPanel({}, onCommitTokensMutation)

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'newToken' } })
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    expect(onCommitTokensMutation).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('tokens-config-panel-add-error')).toHaveAttribute('role', 'alert')
    expect(screen.getByLabelText('Id')).toHaveValue('newToken')
    expect(screen.getByLabelText('Value')).toHaveValue('secret')
  })
})

describe('TokensConfigPanel value editing', () => {
  it('commits the new value on blur only when it changed', () => {
    const onCommitTokensMutation = vi.fn(noopCommitTokensMutation)
    renderPanel({ authToken: { value: 'abc' } }, onCommitTokensMutation)

    const input = screen.getByLabelText('Value de authToken')

    // Blur without changing the value: no commit.
    fireEvent.blur(input)
    expect(onCommitTokensMutation).not.toHaveBeenCalled()

    // Blur after an actual change: commits.
    fireEvent.change(input, { target: { value: 'newSecret' } })
    fireEvent.blur(input)

    expect(onCommitTokensMutation).toHaveBeenCalledTimes(1)
    const mutate = onCommitTokensMutation.mock.calls[0][0]
    expect(mutate({ authToken: { value: 'abc' } })).toEqual({ authToken: { value: 'newSecret' } })
  })

  it('attempts the commit even with an empty value (no local pre-check); a rejection keeps the empty draft and shows the banner', () => {
    const onCommitTokensMutation = vi.fn(() => REJECTED)
    renderPanel({ authToken: { value: 'abc' } }, onCommitTokensMutation)

    const input = screen.getByLabelText('Value de authToken')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)

    expect(onCommitTokensMutation).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('tokens-config-panel-value-authToken-error')).toHaveAttribute('role', 'alert')
    expect(screen.getByLabelText('Value de authToken')).toHaveValue('')
  })
})

describe('TokensConfigPanel refresh integration', () => {
  it('activating refresh commits the default block (first api operation, responsePath "data", intervalSeconds 60)', () => {
    const onCommitTokensMutation = vi.fn(noopCommitTokensMutation)
    renderPanel({ authToken: { value: 'abc' } }, onCommitTokensMutation)

    const card = screen.getByTestId('tokens-config-panel-token-authToken')
    fireEvent.click(within(card).getByRole('switch'))

    expect(onCommitTokensMutation).toHaveBeenCalledTimes(1)
    const mutate = onCommitTokensMutation.mock.calls[0][0]
    const result = mutate({ authToken: { value: 'abc' } })
    expect(result).toEqual({
      authToken: {
        value: 'abc',
        refresh: { operation: 'getBalance', responsePath: 'data', intervalSeconds: 60 },
      },
    })
  })

  it('the default refresh block built on activation passes real validateTokensConfig', () => {
    const onCommitTokensMutation = vi.fn(noopCommitTokensMutation)
    renderPanel({ authToken: { value: 'abc' } }, onCommitTokensMutation)

    const card = screen.getByTestId('tokens-config-panel-token-authToken')
    fireEvent.click(within(card).getByRole('switch'))

    const mutate = onCommitTokensMutation.mock.calls[0][0]
    const nextTokens = mutate({ authToken: { value: 'abc' } })

    const validation = validateTokensConfig(nextTokens, new Set(Object.keys(API)))
    expect(validation.status).toBe('ready')
  })

  it('deactivating refresh commits removing the "refresh" key without touching value', () => {
    const onCommitTokensMutation = vi.fn(noopCommitTokensMutation)
    renderPanel(
      { authToken: { value: 'abc', refresh: { operation: 'getBalance', responsePath: 'data', intervalSeconds: 30 } } },
      onCommitTokensMutation,
    )

    const card = screen.getByTestId('tokens-config-panel-token-authToken')
    fireEvent.click(within(card).getByRole('switch'))

    expect(onCommitTokensMutation).toHaveBeenCalledTimes(1)
    const mutate = onCommitTokensMutation.mock.calls[0][0]
    const result = mutate({
      authToken: { value: 'abc', refresh: { operation: 'getBalance', responsePath: 'data', intervalSeconds: 30 } },
    })
    expect(result).toEqual({ authToken: { value: 'abc' } })
  })

  it('changing a refresh field commits only that field, and a rejection is isolated per token and field', () => {
    const onCommitTokensMutation = vi.fn(() => REJECTED)
    renderPanel(
      {
        tokenA: { value: 'a', refresh: { operation: 'getBalance', responsePath: 'data', intervalSeconds: 30 } },
        tokenB: { value: 'b', refresh: { operation: 'getBalance', responsePath: 'data', intervalSeconds: 30 } },
      },
      onCommitTokensMutation,
    )

    const cardA = screen.getByTestId('tokens-config-panel-token-tokenA')
    fireEvent.change(within(cardA).getByLabelText('Response path'), { target: { value: 'data.a' } })

    expect(onCommitTokensMutation).toHaveBeenCalledTimes(1)
    const mutate = onCommitTokensMutation.mock.calls[0][0]
    const result = mutate({
      tokenA: { value: 'a', refresh: { operation: 'getBalance', responsePath: 'data', intervalSeconds: 30 } },
      tokenB: { value: 'b', refresh: { operation: 'getBalance', responsePath: 'data', intervalSeconds: 30 } },
    })
    expect(result.tokenA.refresh).toEqual({ operation: 'getBalance', responsePath: 'data.a', intervalSeconds: 30 })
    expect(result.tokenB).toEqual({ value: 'b', refresh: { operation: 'getBalance', responsePath: 'data', intervalSeconds: 30 } })

    expect(screen.getByTestId('token-refresh-tokenA-responsePath-error')).toBeInTheDocument()
    expect(screen.queryByTestId('token-refresh-tokenB-responsePath-error')).not.toBeInTheDocument()

    const cardB = screen.getByTestId('tokens-config-panel-token-tokenB')
    fireEvent.change(within(cardB).getByLabelText('Response path'), { target: { value: 'data.b' } })

    expect(screen.getByTestId('token-refresh-tokenA-responsePath-error')).toBeInTheDocument()
    expect(screen.getByTestId('token-refresh-tokenB-responsePath-error')).toBeInTheDocument()
  })
})

describe('TokensConfigPanel delete flow', () => {
  function buildConfigWithOrphanReference(): RuntimeConfig {
    return buildConfig({
      tokens: { authToken: { value: 'abc' } },
      api: {
        getBalance: {
          method: 'GET',
          endpoint: '/balance',
          headers: { Authorization: 'Bearer {{tokens.authToken.value}}' },
        },
      },
    })
  }

  it('clicking "Eliminar token" scans header references and opens the confirm dialog with that scan', () => {
    const config = buildConfigWithOrphanReference()
    renderPanel(config.tokens, noopCommitTokensMutation, config, config.api)

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar token authToken' }))

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByTestId('token-delete-confirm-orphan-warning')).toBeInTheDocument()
    expect(within(screen.getByRole('alertdialog')).getByText(/1 referencia/)).toBeInTheDocument()
    expect(within(screen.getByRole('alertdialog')).getByText(/en la operación «getBalance»/)).toBeInTheDocument()
  })

  it('the confirm dialog always opens for a token with no orphan references, without the warning', () => {
    renderPanel({ authToken: { value: 'abc' } })

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar token authToken' }))

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.queryByTestId('token-delete-confirm-orphan-warning')).not.toBeInTheDocument()
  })

  it('confirming removes the token via a single commit; cancelling commits nothing and closes the dialog', () => {
    const onCommitTokensMutation = vi.fn(noopCommitTokensMutation)
    renderPanel({ authToken: { value: 'abc' }, other: { value: 'xyz' } }, onCommitTokensMutation)

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar token authToken' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onCommitTokensMutation).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar token authToken' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onCommitTokensMutation).toHaveBeenCalledTimes(1)
    const mutate = onCommitTokensMutation.mock.calls[0][0]
    expect(mutate({ authToken: { value: 'abc' }, other: { value: 'xyz' } })).toEqual({ other: { value: 'xyz' } })
  })

  it('shows a CommitRejectionBanner next to the token card when the delete commit is rejected, without closing the list', () => {
    const onCommitTokensMutation = vi.fn(() => REJECTED)
    renderPanel({ authToken: { value: 'abc' } }, onCommitTokensMutation)

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar token authToken' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(onCommitTokensMutation).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('tokens-config-panel-delete-authToken-error')).toHaveAttribute('role', 'alert')
    expect(screen.getByTestId('tokens-config-panel-token-authToken')).toBeInTheDocument()
  })
})
