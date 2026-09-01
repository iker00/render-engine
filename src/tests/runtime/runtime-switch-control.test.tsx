import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SwitchControl } from '../../runtime/nodes/switch-control'

describe('SwitchControl', () => {
  it('renders role="switch" with aria-checked matching checked=false', () => {
    render(
      <SwitchControl
        checked={false}
        onClick={() => {}}
        trackClassName="track"
        knobClassName="knob"
      />,
    )

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('renders role="switch" with aria-checked matching checked=true', () => {
    render(
      <SwitchControl
        checked={true}
        onClick={() => {}}
        trackClassName="track"
        knobClassName="knob"
      />,
    )

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('invokes onClick when clicked', () => {
    const onClick = vi.fn()
    render(
      <SwitchControl
        checked={false}
        onClick={onClick}
        trackClassName="track"
        knobClassName="knob"
      />,
    )

    fireEvent.click(screen.getByRole('switch'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies trackClassName to the button and knobClassName to the span', () => {
    render(
      <SwitchControl
        checked={false}
        onClick={() => {}}
        trackClassName="my-track-class"
        knobClassName="my-knob-class"
      />,
    )

    const button = screen.getByRole('switch')
    expect(button).toHaveClass('my-track-class')
    expect(button.querySelector('span')).toHaveClass('my-knob-class')
  })

  it('does not add aria-label when ariaLabel is absent', () => {
    render(
      <SwitchControl
        checked={false}
        onClick={() => {}}
        trackClassName="track"
        knobClassName="knob"
      />,
    )

    expect(screen.getByRole('switch')).not.toHaveAttribute('aria-label')
  })

  it('adds aria-label with the given value when ariaLabel is present', () => {
    render(
      <SwitchControl
        checked={false}
        onClick={() => {}}
        trackClassName="track"
        knobClassName="knob"
        ariaLabel="Enable notifications"
      />,
    )

    expect(screen.getByRole('switch')).toHaveAttribute('aria-label', 'Enable notifications')
  })

  it('does not add aria-describedby when ariaDescribedBy is absent', () => {
    render(
      <SwitchControl
        checked={false}
        onClick={() => {}}
        trackClassName="track"
        knobClassName="knob"
      />,
    )

    expect(screen.getByRole('switch')).not.toHaveAttribute('aria-describedby')
  })

  it('adds aria-describedby with the given value when ariaDescribedBy is present', () => {
    render(
      <SwitchControl
        checked={false}
        onClick={() => {}}
        trackClassName="track"
        knobClassName="knob"
        ariaDescribedBy="field-error-id"
      />,
    )

    expect(screen.getByRole('switch')).toHaveAttribute('aria-describedby', 'field-error-id')
  })
})
