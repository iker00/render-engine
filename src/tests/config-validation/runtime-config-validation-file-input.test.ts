import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

function createFileInputNode(propsOverrides: Record<string, unknown> = {}, nodeOverrides: Record<string, unknown> = {}) {
  return {
    type: 'fileInput',
    props: {
      fieldId: 'documents',
      label: 'Documentos',
      ...propsOverrides,
    },
    ...nodeOverrides,
  }
}

function createFormWithFileInput(fileInputNode: Record<string, unknown>) {
  return {
    type: 'form',
    id: 'test-form',
    children: [fileInputNode],
  }
}

function createConfigWithFileInput(fileInputNode: Record<string, unknown>) {
  return createConfigWithLayout([createFormWithFileInput(fileInputNode)])
}

// ─── Shape acceptance tests ───────────────────────────────────────────────────

describe('validateRuntimeConfig — fileInput node: acceptance (shape)', () => {
  it('accepts a minimal fileInput with fieldId and label inside a form', () => {
    const result = validateRuntimeConfig(createConfigWithFileInput(createFileInputNode()))
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const form = result.config.pages[0].layout[0] as Record<string, unknown>
      const node = (form.children as Record<string, unknown>[])[0]
      expect(node.type).toBe('fileInput')
      expect((node.props as Record<string, unknown>).fieldId).toBe('documents')
      expect((node.props as Record<string, unknown>).label).toBe('Documentos')
    }
  })

  it('accepts fileInput with all declared props (multiple, capture, and all validations)', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(
        createFileInputNode({
          multiple: false,
          capture: 'environment',
          validations: {
            required: { value: true },
            accept: { value: ['image/jpeg', 'image/png'] },
            maxFileSize: { value: 5 },
            maxTotalSize: { value: 20 },
            minFiles: { value: 1 },
            maxFiles: { value: 4 },
            validFileNames: { value: ['^IMG_\\d+\\.jpg$'] },
          },
        }),
      ),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const form = result.config.pages[0].layout[0] as Record<string, unknown>
      const node = (form.children as Record<string, unknown>[])[0]
      const props = node.props as Record<string, unknown>
      expect(props.multiple).toBe(false)
      expect(props.capture).toBe('environment')
      const validations = props.validations as Record<string, unknown>
      expect(validations.required).toEqual({ value: true })
      expect(validations.accept).toEqual({ value: ['image/jpeg', 'image/png'] })
      expect(validations.maxFileSize).toEqual({ value: 5 })
      expect(validations.maxTotalSize).toEqual({ value: 20 })
      expect(validations.minFiles).toEqual({ value: 1 })
      expect(validations.maxFiles).toEqual({ value: 4 })
      expect(validations.validFileNames).toEqual({ value: ['^IMG_\\d+\\.jpg$'] })
    }
  })

  it('accepts validation rules with optional message field', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(
        createFileInputNode({
          validations: {
            required: { value: true, message: 'Obligatorio' },
            maxFileSize: { value: 5, message: 'Fichero demasiado grande' },
          },
        }),
      ),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const form = result.config.pages[0].layout[0] as Record<string, unknown>
      const node = (form.children as Record<string, unknown>[])[0]
      const validations = (node.props as Record<string, unknown>).validations as Record<string, unknown>
      expect(validations.required).toEqual({ value: true, message: 'Obligatorio' })
      expect(validations.maxFileSize).toEqual({ value: 5, message: 'Fichero demasiado grande' })
    }
  })

  it('produces a normalized node without multiple when props.multiple is not declared', () => {
    const result = validateRuntimeConfig(createConfigWithFileInput(createFileInputNode()))
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const form = result.config.pages[0].layout[0] as Record<string, unknown>
      const node = (form.children as Record<string, unknown>[])[0]
      const props = node.props as Record<string, unknown>
      expect('multiple' in props).toBe(false)
    }
  })

  it('produces a normalized node without validations when not declared', () => {
    const result = validateRuntimeConfig(createConfigWithFileInput(createFileInputNode()))
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const form = result.config.pages[0].layout[0] as Record<string, unknown>
      const node = (form.children as Record<string, unknown>[])[0]
      const props = node.props as Record<string, unknown>
      expect('validations' in props).toBe(false)
    }
  })

  it('accepts transversal fields (visibility, queryStateFeedback, layout.span) on fileInput', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(
        createFileInputNode(
          {},
          {
            visibility: { reference: 'queries.q.status', operator: 'equals', value: 'success' },
            queryStateFeedback: { query: 'q' },
            layout: { span: 6 },
          },
        ),
      ),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const form = result.config.pages[0].layout[0] as Record<string, unknown>
      const node = (form.children as Record<string, unknown>[])[0]
      expect(node.visibility).toBeDefined()
      expect(node.queryStateFeedback).toBeDefined()
      expect(node.layout).toEqual({ span: 6 })
    }
  })

  it('accepts capture: "user" (frontal camera)', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(
        createFileInputNode({
          capture: 'user',
          validations: { accept: { value: ['video/mp4'] } },
        }),
      ),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const form = result.config.pages[0].layout[0] as Record<string, unknown>
      const node = (form.children as Record<string, unknown>[])[0]
      expect((node.props as Record<string, unknown>).capture).toBe('user')
    }
  })
})

// ─── Shape rejection tests ────────────────────────────────────────────────────

describe('validateRuntimeConfig — fileInput node: rejection (shape)', () => {
  it('rejects fileInput with capture: "rear" (invalid enum value)', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(createFileInputNode({ capture: 'rear' })),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.capture')
    }
  })

  it('rejects fileInput with validations.accept as empty array (nonempty required)', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(createFileInputNode({ validations: { accept: { value: [] } } })),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('validations.accept')
    }
  })

  it('rejects fileInput with validations.accept value as a string (not array)', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(createFileInputNode({ validations: { accept: { value: 'image/png' } } })),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('validations.accept')
    }
  })

  it('rejects fileInput with validations.maxFileSize: -1', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(createFileInputNode({ validations: { maxFileSize: { value: -1 } } })),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('validations.maxFileSize')
    }
  })

  it('rejects fileInput with validations.maxFileSize: 0', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(createFileInputNode({ validations: { maxFileSize: { value: 0 } } })),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('validations.maxFileSize')
    }
  })

  it('rejects fileInput with validations.maxFiles: 0', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(createFileInputNode({ validations: { maxFiles: { value: 0 } } })),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('validations.maxFiles')
    }
  })

  it('rejects fileInput with validations.required: true (bare boolean, not extended form)', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(createFileInputNode({ validations: { required: true } })),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('validations.required')
    }
  })

  it('rejects fileInput with validations.validFileNames as empty array', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(createFileInputNode({ validations: { validFileNames: { value: [] } } })),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('validations.validFileNames')
    }
  })

  it('rejects fileInput without props.fieldId', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([{
        type: 'form',
        id: 'test-form',
        children: [{ type: 'fileInput', props: { label: 'Documentos' } }],
      }]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.fieldId')
    }
  })

  it('rejects fileInput without props.label', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([{
        type: 'form',
        id: 'test-form',
        children: [{ type: 'fileInput', props: { fieldId: 'documents' } }],
      }]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.label')
    }
  })
})

// ─── Placement tests ──────────────────────────────────────────────────────────

describe('validateRuntimeConfig — fileInput node: placement', () => {
  it('accepts fileInput inside a container that is inside a form', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'form',
          id: 'test-form',
          children: [
            {
              type: 'container',
              children: [createFileInputNode()],
            },
          ],
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('rejects fileInput at the top level of page.layout (outside any form)', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createFileInputNode()]))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('descendants of a form node')
    }
  })

  it('rejects fileInput inside a container without a form ancestor', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'container',
          children: [createFileInputNode()],
        },
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('descendants of a form node')
    }
  })
})

// ─── fieldId uniqueness tests ─────────────────────────────────────────────────

describe('validateRuntimeConfig — fileInput node: fieldId uniqueness', () => {
  it('rejects two fileInput nodes with the same fieldId in the same form', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'form',
          id: 'test-form',
          children: [
            createFileInputNode({ fieldId: 'docs' }),
            createFileInputNode({ fieldId: 'docs' }),
          ],
        },
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.fieldId')
    }
  })

  it('rejects a fileInput and an input with the same fieldId in the same form', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'form',
          id: 'test-form',
          children: [
            { type: 'input', props: { fieldId: 'name', label: 'Name' } },
            createFileInputNode({ fieldId: 'name' }),
          ],
        },
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('props.fieldId')
    }
  })
})

// ─── capture + accept cross-check tests ──────────────────────────────────────

describe('validateRuntimeConfig — fileInput node: capture + accept cross-check', () => {
  it('accepts fileInput with capture: "environment" and accept containing an image/* MIME', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(
        createFileInputNode({
          capture: 'environment',
          validations: { accept: { value: ['image/png'] } },
        }),
      ),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts fileInput with capture: "user" and accept containing a video/* MIME', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(
        createFileInputNode({
          capture: 'user',
          validations: { accept: { value: ['video/mp4'] } },
        }),
      ),
    )
    expect(result.status).toBe('ready')
  })

  it('rejects fileInput with capture: "environment" and accept containing only application/pdf', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(
        createFileInputNode({
          capture: 'environment',
          validations: { accept: { value: ['application/pdf'] } },
        }),
      ),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('capture')
    }
  })

  it('rejects fileInput with capture: "environment" and no validations.accept declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileInput(
        createFileInputNode({ capture: 'environment' }),
      ),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('capture')
    }
  })

  it('accepts fileInput without capture and without accept (cross-check inactive)', () => {
    const result = validateRuntimeConfig(createConfigWithFileInput(createFileInputNode()))
    expect(result.status).toBe('ready')
  })
})
