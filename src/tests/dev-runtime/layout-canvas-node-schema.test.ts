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
