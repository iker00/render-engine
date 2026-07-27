import { describe, expect, it } from 'vitest'
import {
  getNodeTypeJsonSchema,
  getSupportedNodeTypesCatalog,
} from '../../dev-runtime/layout-canvas/layout-canvas-node-schema'

describe('getNodeTypeJsonSchema', () => {
  it('reflects containerNodeSchema props (direction/gap/columns/variant/align/justify/wrap)', () => {
    const schema = getNodeTypeJsonSchema('container')
    expect(schema).toBeDefined()
    expect(typeof schema).toBe('object')

    const properties = schema.properties as Record<string, unknown>
    const propsSchema = properties['props'] as { properties?: Record<string, unknown> }
    expect(propsSchema).toBeDefined()

    const propProperties = propsSchema.properties ?? {}
    expect(propProperties['direction']).toBeDefined()
    expect(propProperties['gap']).toBeDefined()
    expect(propProperties['columns']).toBeDefined()
    expect(propProperties['variant']).toBeDefined()
    expect(propProperties['align']).toBeDefined()
    expect(propProperties['justify']).toBeDefined()
    expect(propProperties['wrap']).toBeDefined()
  })

  it('reflects buttonNodeSchema props including the action field', () => {
    const schema = getNodeTypeJsonSchema('button')
    const properties = schema.properties as Record<string, unknown>
    const propsSchema = properties['props'] as { properties?: Record<string, unknown> }
    expect(propsSchema).toBeDefined()

    const propProperties = propsSchema.properties ?? {}
    expect(propProperties['label']).toBeDefined()
    expect(propProperties['action']).toBeDefined()
    expect(propProperties['color']).toBeDefined()
    expect(propProperties['variant']).toBeDefined()
    expect(propProperties['fullWidth']).toBeDefined()
    expect(propProperties['icon']).toBeDefined()
    expect(propProperties['iconPosition']).toBeDefined()
  })

  it('emits an action oneOf with the 7 button action variants, each with a distinct literal type', () => {
    const schema = getNodeTypeJsonSchema('button')
    const properties = schema.properties as Record<string, unknown>
    const propsSchema = properties['props'] as { properties?: Record<string, unknown> }
    const propProperties = propsSchema.properties ?? {}
    const actionSchema = propProperties['action'] as { oneOf?: Array<{ properties?: { type?: { const?: string } } }> }

    expect(actionSchema.oneOf).toBeDefined()
    expect(actionSchema.oneOf).toHaveLength(7)

    const literalTypes = (actionSchema.oneOf ?? []).map((branch) => branch.properties?.type?.const)
    expect(literalTypes).toEqual([
      'navigateTo',
      'goBack',
      'executeOperation',
      'executeOperations',
      'resetForm',
      'openModal',
      'closeModal',
    ])
    expect(new Set(literalTypes).size).toBe(7)
  })

  it('emits an action oneOf with exactly the 2 link action variants (navigateTo, goBack)', () => {
    const schema = getNodeTypeJsonSchema('link')
    const properties = schema.properties as Record<string, unknown>
    const propsSchema = properties['props'] as { properties?: Record<string, unknown> }
    const propProperties = propsSchema.properties ?? {}
    const actionSchema = propProperties['action'] as { oneOf?: Array<{ properties?: { type?: { const?: string } } }> }

    expect(actionSchema.oneOf).toBeDefined()
    expect(actionSchema.oneOf).toHaveLength(2)

    const literalTypes = (actionSchema.oneOf ?? []).map((branch) => branch.properties?.type?.const)
    expect(literalTypes).toEqual(['navigateTo', 'goBack'])
    expect(new Set(literalTypes).size).toBe(2)
  })

  it('emits form.submitAction as an oneOf with exactly 2 branches (executeOperation, executeOperations), each exposing onSuccess/onError arrays of a 7-branch oneOf', () => {
    const schema = getNodeTypeJsonSchema('form')
    const properties = schema.properties as Record<string, unknown>
    const submitActionSchema = properties['submitAction'] as {
      oneOf?: Array<{
        properties?: {
          type?: { const?: string }
          onSuccess?: { type?: string; items?: { oneOf?: Array<{ properties?: { type?: { const?: string } } }> } }
          onError?: { type?: string; items?: { oneOf?: Array<{ properties?: { type?: { const?: string } } }> } }
        }
      }>
    }

    expect(submitActionSchema.oneOf).toBeDefined()
    expect(submitActionSchema.oneOf).toHaveLength(2)

    const branchTypes = (submitActionSchema.oneOf ?? []).map((branch) => branch.properties?.type?.const)
    expect(branchTypes).toEqual(['executeOperation', 'executeOperations'])

    for (const branch of submitActionSchema.oneOf ?? []) {
      for (const field of ['onSuccess', 'onError'] as const) {
        const fieldSchema = branch.properties?.[field]
        expect(fieldSchema?.type).toBe('array')
        expect(fieldSchema?.items?.oneOf).toBeDefined()
        expect(fieldSchema?.items?.oneOf).toHaveLength(7)

        const entryTypes = (fieldSchema?.items?.oneOf ?? []).map((entry) => entry.properties?.type?.const)
        expect(entryTypes).toEqual([
          'navigateTo',
          'goBack',
          'executeOperation',
          'executeOperations',
          'resetForm',
          'openModal',
          'closeModal',
        ])
        expect(new Set(entryTypes).size).toBe(7)
      }
    }
  })

  it('returns the same reference on a second call for the same type (cache)', () => {
    const first = getNodeTypeJsonSchema('container')
    const second = getNodeTypeJsonSchema('container')
    expect(first).toBe(second)
  })

  it('does not return the same reference for different types', () => {
    const container = getNodeTypeJsonSchema('container')
    const button = getNodeTypeJsonSchema('button')
    expect(container).not.toBe(button)
  })

  it.each(getSupportedNodeTypesCatalog())('does not throw for node type "%s"', (type) => {
    expect(() => getNodeTypeJsonSchema(type)).not.toThrow()
  })
})

describe('getSupportedNodeTypesCatalog', () => {
  it('returns the full node type catalog (same count as NodeComponents, 27 types)', () => {
    const catalog = getSupportedNodeTypesCatalog()
    expect(catalog).toHaveLength(27)
    expect(catalog).toContain('container')
    expect(catalog).toContain('button')
    expect(catalog).toContain('hidden')
    expect(catalog).toContain('fileManager')
  })
})
