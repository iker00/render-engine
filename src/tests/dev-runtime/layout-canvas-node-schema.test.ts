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

  // T5 (2026-08-24-13-02-repeater-grid-mode): repeaterNodeSchema.props was extended in T2 with the
  // same columns/gap/align/justify fields containerNodeSchema already declares, so the properties
  // panel's generic schema-driven dispatcher can expose them without any dedicated widget. Same
  // assertion shape as the sibling container test above.
  it('reflects repeaterNodeSchema props (columns/gap/align/justify), same as containerNodeSchema', () => {
    const schema = getNodeTypeJsonSchema('repeater')
    expect(schema).toBeDefined()
    expect(typeof schema).toBe('object')

    const properties = schema.properties as Record<string, unknown>
    const propsSchema = properties['props'] as { properties?: Record<string, unknown> }
    expect(propsSchema).toBeDefined()

    const propProperties = propsSchema.properties ?? {}
    expect(propProperties['columns']).toBeDefined()
    expect(propProperties['gap']).toBeDefined()
    expect(propProperties['align']).toBeDefined()
    expect(propProperties['justify']).toBeDefined()
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

  it('emits an action oneOf with the 8 button action variants, each with a distinct literal type', () => {
    const schema = getNodeTypeJsonSchema('button')
    const properties = schema.properties as Record<string, unknown>
    const propsSchema = properties['props'] as { properties?: Record<string, unknown> }
    const propProperties = propsSchema.properties ?? {}
    const actionSchema = propProperties['action'] as { oneOf?: Array<{ properties?: { type?: { const?: string } } }> }

    expect(actionSchema.oneOf).toBeDefined()
    expect(actionSchema.oneOf).toHaveLength(8)

    const literalTypes = (actionSchema.oneOf ?? []).map((branch) => branch.properties?.type?.const)
    expect(literalTypes).toEqual([
      'navigateTo',
      'goBack',
      'executeOperation',
      'executeOperations',
      'resetForm',
      'openModal',
      'closeModal',
      'downloadOperation',
    ])
    expect(new Set(literalTypes).size).toBe(8)
  })

  it('emits an action oneOf with exactly the 3 link action variants (navigateTo, goBack, downloadOperation)', () => {
    const schema = getNodeTypeJsonSchema('link')
    const properties = schema.properties as Record<string, unknown>
    const propsSchema = properties['props'] as { properties?: Record<string, unknown> }
    const propProperties = propsSchema.properties ?? {}
    const actionSchema = propProperties['action'] as { oneOf?: Array<{ properties?: { type?: { const?: string } } }> }

    expect(actionSchema.oneOf).toBeDefined()
    expect(actionSchema.oneOf).toHaveLength(3)

    const literalTypes = (actionSchema.oneOf ?? []).map((branch) => branch.properties?.type?.const)
    expect(literalTypes).toEqual(['navigateTo', 'goBack', 'downloadOperation'])
    expect(new Set(literalTypes).size).toBe(3)
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

  // T3 (0141): the navigateTo action variant's `params` is swapped for the `navigate-params`
  // widget sentinel (T1) on both `button` and `link`, chained after the pre-existing
  // `condition-group` sentinel (T3, 0132) — regression check that the two transforms coexist
  // without one clobbering the other's substitution.
  it('replaces props.action navigateTo.params with the navigate-params widget sentinel for button and link, while visibility keeps the condition-group sentinel', () => {
    for (const type of ['button', 'link'] as const) {
      const schema = getNodeTypeJsonSchema(type)
      const properties = schema.properties as Record<string, unknown>
      const propsSchema = properties['props'] as { properties?: Record<string, unknown> }
      const propProperties = propsSchema.properties ?? {}
      const actionSchema = propProperties['action'] as {
        oneOf?: Array<{ properties?: { type?: { const?: string }; params?: unknown } }>
      }

      const navigateToBranch = (actionSchema.oneOf ?? []).find(
        (branch) => branch.properties?.type?.const === 'navigateTo',
      )
      expect(navigateToBranch?.properties?.params).toEqual({ 'x-widget': 'navigate-params' })

      expect(properties['visibility']).toEqual({ 'x-widget': 'condition-group' })
    }
  })

  it('reflects stepsNodeSchema props (items, variant, backLabel, nextLabel, submitLabel)', () => {
    const schema = getNodeTypeJsonSchema('steps')
    expect(schema).toBeDefined()
    expect(typeof schema).toBe('object')

    const properties = schema.properties as Record<string, unknown>
    const propsSchema = properties['props'] as { properties?: Record<string, unknown> }
    expect(propsSchema).toBeDefined()

    const propProperties = propsSchema.properties ?? {}
    expect(propProperties['items']).toBeDefined()
    expect(propProperties['variant']).toBeDefined()
    expect(propProperties['backLabel']).toBeDefined()
    expect(propProperties['nextLabel']).toBeDefined()
    expect(propProperties['submitLabel']).toBeDefined()
  })

  // T2 (2026-08-25-09-15-autocomplete-node): autocompleteNodeSchema (T1) is registered in
  // nodeSchemaByType, so its JSON Schema must derive automatically without any dedicated widget —
  // same assertion shape as the container/repeater tests above, but for the field-specific props
  // (items/multiple/placeholder/allowFreeText/minChars) plus the shared field props (fieldId/label).
  it('reflects autocompleteNodeSchema props (fieldId/label/items/multiple/placeholder/allowFreeText/minChars)', () => {
    const schema = getNodeTypeJsonSchema('autocomplete')
    expect(schema).toBeDefined()
    expect(typeof schema).toBe('object')

    const properties = schema.properties as Record<string, unknown>
    const propsSchema = properties['props'] as { properties?: Record<string, unknown> }
    expect(propsSchema).toBeDefined()

    const propProperties = propsSchema.properties ?? {}
    expect(propProperties['fieldId']).toBeDefined()
    expect(propProperties['label']).toBeDefined()
    expect(propProperties['items']).toBeDefined()
    expect(propProperties['multiple']).toBeDefined()
    expect(propProperties['placeholder']).toBeDefined()
    expect(propProperties['allowFreeText']).toBeDefined()
    expect(propProperties['minChars']).toBeDefined()
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
  it('returns the full node type catalog (31 types)', () => {
    const catalog = getSupportedNodeTypesCatalog()
    expect(catalog).toHaveLength(31)
    expect(catalog).toContain('container')
    expect(catalog).toContain('button')
    expect(catalog).toContain('hidden')
    expect(catalog).toContain('fileManager')
    expect(catalog).toContain('steps')
  })
})
