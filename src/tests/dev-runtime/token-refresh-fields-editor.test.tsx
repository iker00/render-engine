import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  TokenRefreshFieldsEditor,
  tokenRefreshFieldRejectionKey,
  type TokenRefreshPendingRejections,
} from '../../dev-runtime/tokens-config-panel/token-refresh-fields-editor'

const REFRESH = {
  operation: 'getBalance',
  responsePath: 'data.balance',
  intervalSeconds: 30,
}

function renderEditor(overrides: Partial<Parameters<typeof TokenRefreshFieldsEditor>[0]> = {}) {
  const onToggleRefresh = vi.fn()
  const onCommitRefreshField = vi.fn()
  const props = {
    tokenId: 'authToken',
    refresh: undefined,
    apiOperationNames: ['getBalance', 'getProfile'],
    pendingRejections: {} as TokenRefreshPendingRejections,
    onToggleRefresh,
    onCommitRefreshField,
    ...overrides,
  }
  render(<TokenRefreshFieldsEditor {...props} />)
  return { onToggleRefresh, onCommitRefreshField }
}

describe('TokenRefreshFieldsEditor visibility', () => {
  it('shows only the switch (off) when refresh is undefined', () => {
    renderEditor({ refresh: undefined })

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByLabelText('Operación')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Response path')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Intervalo (segundos)')).not.toBeInTheDocument()
  })

  it('shows the three fields with refresh values and the switch on when refresh is defined', () => {
    renderEditor({ refresh: REFRESH })

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Operación')).toHaveValue('getBalance')
    expect(screen.getByLabelText('Response path')).toHaveValue('data.balance')
    expect(screen.getByLabelText('Intervalo (segundos)')).toHaveValue(30)
  })
})

describe('TokenRefreshFieldsEditor toggle', () => {
  it('invokes onToggleRefresh(true) and nothing else when activating with refresh undefined', () => {
    const { onToggleRefresh, onCommitRefreshField } = renderEditor({ refresh: undefined })

    fireEvent.click(screen.getByRole('switch'))

    expect(onToggleRefresh).toHaveBeenCalledTimes(1)
    expect(onToggleRefresh).toHaveBeenCalledWith(true)
    expect(onCommitRefreshField).not.toHaveBeenCalled()
  })

  it('invokes onToggleRefresh(false) when deactivating with refresh defined', () => {
    const { onToggleRefresh } = renderEditor({ refresh: REFRESH })

    fireEvent.click(screen.getByRole('switch'))

    expect(onToggleRefresh).toHaveBeenCalledTimes(1)
    expect(onToggleRefresh).toHaveBeenCalledWith(false)
  })
})

describe('TokenRefreshFieldsEditor disabled switch without operations', () => {
  it('disables the switch with the exact reason when there are no api operations and refresh is undefined', () => {
    renderEditor({ apiOperationNames: [], refresh: undefined })

    const switchEl = screen.getByRole('switch')
    expect(switchEl).toBeDisabled()
    expect(switchEl).toHaveAttribute(
      'title',
      'No hay ninguna operación declarada en Api; declara al menos una antes de activar el refresco.',
    )
  })

  it('keeps the switch enabled when there are no api operations but refresh is already defined', () => {
    renderEditor({ apiOperationNames: [], refresh: REFRESH })

    const switchEl = screen.getByRole('switch')
    expect(switchEl).not.toBeDisabled()
    expect(switchEl).not.toHaveAttribute('title')
    expect(screen.getByLabelText('Operación').querySelectorAll('option')).toHaveLength(0)
  })
})

describe('TokenRefreshFieldsEditor field commits', () => {
  it('commits operation without triggering the other two fields', () => {
    const { onCommitRefreshField } = renderEditor({ refresh: REFRESH })

    fireEvent.change(screen.getByLabelText('Operación'), { target: { value: 'getProfile' } })

    expect(onCommitRefreshField).toHaveBeenCalledTimes(1)
    expect(onCommitRefreshField).toHaveBeenCalledWith('operation', 'getProfile')
  })

  it('commits responsePath without triggering the other two fields', () => {
    const { onCommitRefreshField } = renderEditor({ refresh: REFRESH })

    fireEvent.change(screen.getByLabelText('Response path'), { target: { value: 'data.newPath' } })

    expect(onCommitRefreshField).toHaveBeenCalledTimes(1)
    expect(onCommitRefreshField).toHaveBeenCalledWith('responsePath', 'data.newPath')
  })

  it('commits intervalSeconds without triggering the other two fields', () => {
    const { onCommitRefreshField } = renderEditor({ refresh: REFRESH })

    fireEvent.change(screen.getByLabelText('Intervalo (segundos)'), { target: { value: '60' } })

    expect(onCommitRefreshField).toHaveBeenCalledTimes(1)
    expect(onCommitRefreshField).toHaveBeenCalledWith('intervalSeconds', 60)
  })
})

describe('TokenRefreshFieldsEditor broken operation reference', () => {
  it('renders the select without the broken option while other fields stay editable', () => {
    renderEditor({ refresh: { ...REFRESH, operation: 'missingOperation' } })

    const select = screen.getByLabelText('Operación') as HTMLSelectElement
    expect(select.querySelectorAll('option')).toHaveLength(2)
    expect(
      Array.from(select.querySelectorAll('option')).some((option) => option.value === 'missingOperation'),
    ).toBe(false)
    expect(select.value).not.toBe('missingOperation')

    expect(screen.getByLabelText('Response path')).toHaveValue('data.balance')
    expect(screen.getByLabelText('Intervalo (segundos)')).toHaveValue(30)
  })
})

describe('TokenRefreshFieldsEditor pending rejections', () => {
  it('shows the pending value and the rejection banner only for the rejected field', () => {
    const pendingRejections: TokenRefreshPendingRejections = {
      [tokenRefreshFieldRejectionKey('authToken', 'responsePath')]: {
        value: 'data.pendingPath',
        error: { code: 'invalid-layout', displayMode: 'development-only', message: 'ruta inválida' },
      },
    }
    renderEditor({ refresh: REFRESH, pendingRejections })

    expect(screen.getByLabelText('Response path')).toHaveValue('data.pendingPath')
    const banner = screen.getByTestId('token-refresh-authToken-responsePath-error')
    expect(banner).toHaveAttribute('role', 'alert')

    expect(screen.queryByTestId('token-refresh-authToken-operation-error')).not.toBeInTheDocument()
    expect(screen.queryByTestId('token-refresh-authToken-intervalSeconds-error')).not.toBeInTheDocument()
  })
})
