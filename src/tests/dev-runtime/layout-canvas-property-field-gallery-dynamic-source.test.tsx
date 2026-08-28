import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { GalleryDynamicSourcePropertyField } from '../../dev-runtime/layout-canvas/property-fields/gallery-dynamic-source-property-field'

// GalleryDynamicSourcePropertyField is fully controlled — same harness pattern as
// ChoiceItemsPropertyField's test file: the caller owns `value` and must feed back whatever
// `onChange` reports, so each interaction can be observed both as an onChange call and as the
// resulting re-render (needed for the mode-switch round-trip tests below).
function ControlledField({
  initialValue,
  onChangeSpy,
}: {
  initialValue: unknown
  onChangeSpy: (value: unknown) => void
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <GalleryDynamicSourcePropertyField
      label="source"
      value={value}
      onChange={(nextValue) => {
        onChangeSpy(nextValue)
        setValue(nextValue)
      }}
    />
  )
}

const SRC_VALUE = { source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'src', src: 'url' }
const FETCH_VALUE = { source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'fetch', fetch: { url: '/media/{{item.id}}.jpg' } }

describe('GalleryDynamicSourcePropertyField "src" mode', () => {
  it('renders source/key/alt/src seeded with the current value, and "src" active', () => {
    render(<ControlledField initialValue={SRC_VALUE} onChangeSpy={vi.fn()} />)

    expect(screen.getByLabelText('source', { exact: false })).toHaveValue('queries.photos.data')
    expect(screen.getByLabelText('key', { exact: false })).toHaveValue('id')
    expect(screen.getByLabelText('alt', { exact: false })).toHaveValue('title')
    expect(screen.getByLabelText('src', { exact: false })).toHaveValue('url')
    expect(screen.getByRole('radio', { name: 'src' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByLabelText('url')).not.toBeInTheDocument()
  })

  it('editing "source" commits the patched value preserving key/alt/mode/src', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledField initialValue={SRC_VALUE} onChangeSpy={onChangeSpy} />)

    fireEvent.change(screen.getByLabelText('source', { exact: false }), { target: { value: 'queries.other.data' } })

    expect(onChangeSpy).toHaveBeenCalledWith({ ...SRC_VALUE, source: 'queries.other.data' })
  })

  it('editing "src" commits the patched value preserving the rest', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledField initialValue={SRC_VALUE} onChangeSpy={onChangeSpy} />)

    fireEvent.change(screen.getByLabelText('src', { exact: false }), { target: { value: '/new.jpg' } })

    expect(onChangeSpy).toHaveBeenCalledWith({ ...SRC_VALUE, src: '/new.jpg' })
  })
})

describe('GalleryDynamicSourcePropertyField "fetch" mode', () => {
  it('renders source/key/alt/url seeded with the current value, and "fetch" active, no "src" field', () => {
    render(<ControlledField initialValue={FETCH_VALUE} onChangeSpy={vi.fn()} />)

    expect(screen.getByLabelText('source', { exact: false })).toHaveValue('queries.photos.data')
    expect(screen.getByRole('radio', { name: 'fetch' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByLabelText('src')).not.toBeInTheDocument()
    expect(screen.getByLabelText('url', { exact: false })).toHaveValue('/media/{{item.id}}.jpg')
  })

  it('editing the fetch url commits the patched value nesting it under fetch', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledField initialValue={FETCH_VALUE} onChangeSpy={onChangeSpy} />)

    fireEvent.change(screen.getByLabelText('url', { exact: false }), { target: { value: '/media/{{item.id}}.png' } })

    expect(onChangeSpy).toHaveBeenCalledWith({ ...FETCH_VALUE, fetch: { url: '/media/{{item.id}}.png' } })
  })
})

describe('GalleryDynamicSourcePropertyField "fetch" mode — source.idField (FR7)', () => {
  const FETCH_VALUE_WITH_ID_FIELD = { ...FETCH_VALUE, idField: 'id' }

  it('renders idField seeded with the current value when "fetch" is active', () => {
    render(<ControlledField initialValue={FETCH_VALUE_WITH_ID_FIELD} onChangeSpy={vi.fn()} />)

    expect(screen.getByLabelText('idField', { exact: false })).toHaveValue('id')
  })

  it('does not render idField when "src" is active', () => {
    render(<ControlledField initialValue={SRC_VALUE} onChangeSpy={vi.fn()} />)

    expect(screen.queryByLabelText('idField', { exact: false })).not.toBeInTheDocument()
  })

  it('editing idField commits the patched value preserving the rest', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledField initialValue={FETCH_VALUE} onChangeSpy={onChangeSpy} />)

    fireEvent.change(screen.getByLabelText('idField', { exact: false }), { target: { value: 'id' } })

    expect(onChangeSpy).toHaveBeenCalledWith({ ...FETCH_VALUE, idField: 'id' })
  })

  it('switching "fetch" -> "src" discards an already-entered idField value', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledField initialValue={FETCH_VALUE_WITH_ID_FIELD} onChangeSpy={onChangeSpy} />)

    fireEvent.click(screen.getByRole('radio', { name: 'src' }))

    expect(onChangeSpy).toHaveBeenLastCalledWith({ source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'src', src: '' })
  })
})

describe('GalleryDynamicSourcePropertyField mode switching', () => {
  it('switching "src" -> "fetch" drops src, seeds a fresh fetch config, preserves source/key/alt', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledField initialValue={SRC_VALUE} onChangeSpy={onChangeSpy} />)

    fireEvent.click(screen.getByRole('radio', { name: 'fetch' }))

    expect(onChangeSpy).toHaveBeenCalledWith({ source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'fetch', fetch: { url: '' } })
  })

  it('switching "fetch" -> "src" drops fetch, seeds a fresh empty src, preserves source/key/alt', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledField initialValue={FETCH_VALUE} onChangeSpy={onChangeSpy} />)

    fireEvent.click(screen.getByRole('radio', { name: 'src' }))

    expect(onChangeSpy).toHaveBeenCalledWith({ source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'src', src: '' })
  })

  it('spec edge case: src -> fetch -> src does not restore a previous src value', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledField initialValue={{ ...SRC_VALUE, src: '/discarded.jpg' }} onChangeSpy={onChangeSpy} />)

    fireEvent.click(screen.getByRole('radio', { name: 'fetch' }))
    fireEvent.click(screen.getByRole('radio', { name: 'src' }))

    expect(onChangeSpy).toHaveBeenLastCalledWith({ source: 'queries.photos.data', key: 'id', alt: 'title', mode: 'src', src: '' })
  })

  it('does not call onChange when clicking the already-active mode segment', () => {
    const onChangeSpy = vi.fn()
    render(<ControlledField initialValue={SRC_VALUE} onChangeSpy={onChangeSpy} />)

    fireEvent.click(screen.getByRole('radio', { name: 'src' }))

    expect(onChangeSpy).not.toHaveBeenCalled()
  })
})

describe('GalleryDynamicSourcePropertyField unrecognizable value', () => {
  it('falls back to empty fields and "src" mode for a non-object value, without throwing', () => {
    expect(() => render(<ControlledField initialValue={undefined} onChangeSpy={vi.fn()} />)).not.toThrow()

    expect(screen.getByLabelText('source', { exact: false })).toHaveValue('')
    expect(screen.getByRole('radio', { name: 'src' })).toHaveAttribute('aria-checked', 'true')
  })
})
