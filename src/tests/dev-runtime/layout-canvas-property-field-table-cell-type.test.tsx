import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TableCellValue } from '../../config/runtime-config'
import { tableCellAllowedNodeTypes } from '../../config/runtime-config-zod'
import {
  EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE,
  EMPTY_TABLE_CELL_TEXT_VALUE,
  buildDefaultNodeInstance,
} from '../../dev-runtime/layout-canvas/layout-canvas-node-palette-defaults'
import { TableCellTypePropertyField } from '../../dev-runtime/layout-canvas/property-fields/table-cell-type-property-field'

const NODE_TYPE_LABELS: Record<(typeof tableCellAllowedNodeTypes)[number], string> = {
  image: 'Imagen',
  list: 'Lista',
  button: 'Botón',
  container: 'Contenedor',
  heading: 'Título',
  paragraph: 'Párrafo',
  link: 'Enlace',
}

function renderField(value: TableCellValue, onChange = vi.fn(), emptyTextValue = EMPTY_TABLE_CELL_TEXT_VALUE) {
  render(<TableCellTypePropertyField label="Tipo de celda" value={value} emptyTextValue={emptyTextValue} onChange={onChange} />)
  return screen.getByLabelText('Tipo de celda') as HTMLSelectElement
}

describe('TableCellTypePropertyField active type detection', () => {
  it.each([
    ['', ''],
    ['hola', 'hola'],
    [42, '42'],
    [true, 'true'],
  ])('detects "Texto" for primitive cell value %p', (value) => {
    const select = renderField(value as TableCellValue)
    expect(select.value).toBe('text')
  })

  it.each(tableCellAllowedNodeTypes)('detects its own type for a %s node cell', (type) => {
    const select = renderField(buildDefaultNodeInstance(type))
    expect(select.value).toBe(type)
  })
})

describe('TableCellTypePropertyField dropdown shape', () => {
  it('lists exactly 8 options in stable order with the fixed Spanish labels', () => {
    const select = renderField(EMPTY_TABLE_CELL_TEXT_VALUE)

    const optionValues = Array.from(select.options).map((option) => option.value)
    const optionTexts = Array.from(select.options).map((option) => option.textContent)

    expect(optionValues).toEqual(['text', 'image', 'list', 'button', 'container', 'heading', 'paragraph', 'link'])
    expect(optionTexts).toEqual(['Texto', 'Imagen', 'Lista', 'Botón', 'Contenedor', 'Título', 'Párrafo', 'Enlace'])
  })
})

describe('TableCellTypePropertyField choosing a node type', () => {
  it.each(tableCellAllowedNodeTypes)('choosing "%s" from "Texto" commits buildDefaultNodeInstance("%s")', (type) => {
    const onChange = vi.fn()
    const select = renderField(EMPTY_TABLE_CELL_TEXT_VALUE, onChange)

    fireEvent.change(select, { target: { value: type } })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(buildDefaultNodeInstance(type))
  })

  it('choosing a node type distinct from the active one reconstructs from scratch, dropping previous fields', () => {
    const onChange = vi.fn()
    const select = renderField(buildDefaultNodeInstance('heading'), onChange)

    fireEvent.change(select, { target: { value: 'paragraph' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(buildDefaultNodeInstance('paragraph'))
  })
})

describe('TableCellTypePropertyField choosing "Texto"', () => {
  it.each([EMPTY_TABLE_CELL_TEXT_VALUE, EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE])(
    'choosing "Texto" from a node type commits the exact emptyTextValue %p received, never a hardcoded literal',
    (emptyTextValue) => {
      const onChange = vi.fn()
      const select = renderField(buildDefaultNodeInstance('button'), onChange, emptyTextValue)

      fireEvent.change(select, { target: { value: 'text' } })

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(emptyTextValue)
    },
  )
})

describe('TableCellTypePropertyField idempotency', () => {
  it('reselecting the already-active "Texto" option does not call onChange', () => {
    const onChange = vi.fn()
    const select = renderField(EMPTY_TABLE_CELL_TEXT_VALUE, onChange)

    fireEvent.change(select, { target: { value: 'text' } })

    expect(onChange).not.toHaveBeenCalled()
  })

  it.each(tableCellAllowedNodeTypes)('reselecting the already-active "%s" option does not call onChange', (type) => {
    const onChange = vi.fn()
    const select = renderField(buildDefaultNodeInstance(type), onChange)

    fireEvent.change(select, { target: { value: type } })

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('TableCellTypePropertyField literal text editing', () => {
  it('shows a free-text field editing the literal value while "Texto" is active', () => {
    const onChange = vi.fn()
    renderField('hola', onChange)

    const textInput = screen.getByLabelText('Texto') as HTMLInputElement
    expect(textInput.value).toBe('hola')

    fireEvent.change(textInput, { target: { value: 'nuevo texto' } })

    expect(onChange).toHaveBeenCalledWith('nuevo texto')
  })

  it.each(tableCellAllowedNodeTypes)('does not render the free-text field while "%s" is active', (type) => {
    renderField(buildDefaultNodeInstance(type))

    expect(screen.queryByLabelText('Texto')).not.toBeInTheDocument()
  })
})
