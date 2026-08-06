import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Bold } from 'lucide-react'
import { SegmentedTogglePropertyField } from '../../dev-runtime/layout-canvas/property-fields/segmented-toggle-property-field'

describe('SegmentedTogglePropertyField rendering', () => {
  it('renders two segments in order, marking the active one via aria-checked', () => {
    render(
      <SegmentedTogglePropertyField
        label="Modo"
        segments={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        activeValue="a"
        onSelect={vi.fn()}
      />,
    )

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(2)
    expect(radios[0]).toHaveTextContent('A')
    expect(radios[1]).toHaveTextContent('B')
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
    expect(radios[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('marks only the matching numeric segment as active among five', () => {
    render(
      <SegmentedTogglePropertyField
        label="Nivel"
        segments={[1, 2, 3, 4, 5].map((level) => ({ value: level, label: String(level) }))}
        activeValue={3}
        onSelect={vi.fn()}
      />,
    )

    const radios = screen.getAllByRole('radio')
    radios.forEach((radio, index) => {
      expect(radio).toHaveAttribute('aria-checked', index === 2 ? 'true' : 'false')
    })
  })

  it('marks no segment as active when activeValue is null, while segments stay pulsable', () => {
    const onSelect = vi.fn()
    render(
      <SegmentedTogglePropertyField
        label="Nivel"
        segments={[1, 2, 3, 4, 5].map((level) => ({ value: level, label: String(level) }))}
        activeValue={null}
        onSelect={onSelect}
      />,
    )

    const radios = screen.getAllByRole('radio')
    radios.forEach((radio) => {
      expect(radio).toHaveAttribute('aria-checked', 'false')
    })

    fireEvent.click(radios[1])
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('exposes an accessible group name derived from label', () => {
    render(
      <SegmentedTogglePropertyField
        label="Alineación"
        segments={[
          { value: 'left', label: 'Izquierda' },
          { value: 'right', label: 'Derecha' },
        ]}
        activeValue="left"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByRole('radiogroup', { name: 'Alineación' })).toBeInTheDocument()
  })
})

describe('SegmentedTogglePropertyField icon rendering', () => {
  it('renders the Lucide icon to the left of the text for a segment with an icon prop', () => {
    render(
      <SegmentedTogglePropertyField
        label="Formato"
        segments={[
          { value: 'bold', label: 'Negrita', icon: Bold },
          { value: 'italic', label: 'Cursiva' },
        ]}
        activeValue="bold"
        onSelect={vi.fn()}
      />,
    )

    const radios = screen.getAllByRole('radio')
    expect(radios[0].querySelector('svg')).not.toBeNull()
    expect(radios[1].querySelector('svg')).toBeNull()
  })
})

describe('SegmentedTogglePropertyField selection behavior', () => {
  it('calls onSelect once with the value of a clicked, non-active segment', () => {
    const onSelect = vi.fn()
    render(
      <SegmentedTogglePropertyField
        label="Modo"
        segments={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        activeValue="a"
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'B' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('b')
  })

  it('does not call onSelect when clicking the already-active segment', () => {
    const onSelect = vi.fn()
    render(
      <SegmentedTogglePropertyField
        label="Modo"
        segments={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        activeValue="a"
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'A' }))

    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('SegmentedTogglePropertyField keyboard navigation', () => {
  it('ArrowRight from the active segment moves focus to the next segment and selects it', () => {
    const onSelect = vi.fn()
    render(
      <SegmentedTogglePropertyField
        label="Nivel"
        segments={[1, 2, 3].map((level) => ({ value: level, label: String(level) }))}
        activeValue={1}
        onSelect={onSelect}
      />,
    )

    const radios = screen.getAllByRole('radio')
    radios[0].focus()
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' })

    expect(document.activeElement).toBe(radios[1])
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('ArrowLeft from the active segment moves focus to the previous segment and selects it', () => {
    const onSelect = vi.fn()
    render(
      <SegmentedTogglePropertyField
        label="Nivel"
        segments={[1, 2, 3].map((level) => ({ value: level, label: String(level) }))}
        activeValue={2}
        onSelect={onSelect}
      />,
    )

    const radios = screen.getAllByRole('radio')
    radios[1].focus()
    fireEvent.keyDown(radios[1], { key: 'ArrowLeft' })

    expect(document.activeElement).toBe(radios[0])
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('wraps focus to the first segment when ArrowRight is pressed at the right edge', () => {
    const onSelect = vi.fn()
    render(
      <SegmentedTogglePropertyField
        label="Nivel"
        segments={[1, 2, 3].map((level) => ({ value: level, label: String(level) }))}
        activeValue={3}
        onSelect={onSelect}
      />,
    )

    const radios = screen.getAllByRole('radio')
    radios[2].focus()
    fireEvent.keyDown(radios[2], { key: 'ArrowRight' })

    expect(document.activeElement).toBe(radios[0])
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('wraps focus to the last segment when ArrowLeft is pressed at the left edge', () => {
    const onSelect = vi.fn()
    render(
      <SegmentedTogglePropertyField
        label="Nivel"
        segments={[1, 2, 3].map((level) => ({ value: level, label: String(level) }))}
        activeValue={1}
        onSelect={onSelect}
      />,
    )

    const radios = screen.getAllByRole('radio')
    radios[0].focus()
    fireEvent.keyDown(radios[0], { key: 'ArrowLeft' })

    expect(document.activeElement).toBe(radios[2])
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(3)
  })
})
