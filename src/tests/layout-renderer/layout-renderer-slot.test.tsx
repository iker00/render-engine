import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SlotLayoutNode } from '../../runtime/nodes/slot-layout-node'
import { SlotContentProvider } from '../../runtime/nodes/slot-content-context'

describe('SlotLayoutNode', () => {
  it('renders nothing when there is no SlotContentProvider ancestor (default context is null)', () => {
    const { container } = render(<SlotLayoutNode node={{ type: 'slot' }} />)

    expect(container.innerHTML).toBe('')
  })

  it('renders the ReactNode provided by an ancestor SlotContentProvider', () => {
    render(
      <SlotContentProvider.Provider value={<span>hola</span>}>
        <SlotLayoutNode node={{ type: 'slot' }} />
      </SlotContentProvider.Provider>,
    )

    expect(screen.getByText('hola')).toBeInTheDocument()
  })
})
