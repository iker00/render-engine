import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RuntimeBlockingLoadingIndicator } from '../../runtime/runtime-blocking-loading-indicator'

describe('RuntimeBlockingLoadingIndicator', () => {
  it('exposes an element with role="status" in the DOM', () => {
    const { getByRole } = render(<RuntimeBlockingLoadingIndicator />)
    expect(getByRole('status')).toBeInTheDocument()
  })

  it('contains accessible text readable by screen readers', () => {
    const { getByRole } = render(<RuntimeBlockingLoadingIndicator />)
    const status = getByRole('status')
    expect(status).toHaveTextContent(/./)
  })

  it('applies a global theme Tailwind utility on the root element', () => {
    const { getByRole } = render(<RuntimeBlockingLoadingIndicator />)
    expect(getByRole('status')).toHaveClass('bg-app-surface')
  })

  it('is idempotent across consecutive renders (same observable DOM)', () => {
    const first = render(<RuntimeBlockingLoadingIndicator />)
    const firstHtml = first.getByRole('status').outerHTML
    first.unmount()

    const second = render(<RuntimeBlockingLoadingIndicator />)
    const secondHtml = second.getByRole('status').outerHTML

    expect(secondHtml).toBe(firstHtml)
  })

  it('exposes a stable data-testid for downstream consumers', () => {
    const { getByTestId } = render(<RuntimeBlockingLoadingIndicator />)
    expect(getByTestId('runtime-blocking-loading-indicator')).toBeInTheDocument()
  })
})
