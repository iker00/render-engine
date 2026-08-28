import { describe, expect, it } from 'vitest'
import { toJSONSchema } from 'zod'
import { injectNavigateParamsWidgetSentinel } from '../../dev-runtime/layout-canvas/property-fields/inject-navigate-params-widget-sentinel'
import { buttonNodeSchema } from '../../config/runtime-config-zod'

const NAVIGATE_PARAMS_SENTINEL = { 'x-widget': 'navigate-params' }

describe('injectNavigateParamsWidgetSentinel', () => {
  it('replaces a top-level properties.params fragment with the sentinel, preserving the rest of the schema', () => {
    const schema = {
      type: 'object',
      properties: {
        params: {},
        pageId: { type: 'string' },
      },
      required: ['pageId'],
    }

    const result = injectNavigateParamsWidgetSentinel(schema)

    expect(result.properties).toMatchObject({
      params: NAVIGATE_PARAMS_SENTINEL,
      pageId: { type: 'string' },
    })
    expect(result.type).toBe('object')
    expect(result.required).toEqual(['pageId'])
  })

  it('replaces properties.params inside every branch of a oneOf that declares it (navigateTo action variants)', () => {
    const schema = {
      oneOf: [
        {
          type: 'object',
          properties: {
            type: { const: 'navigateTo' },
            pageId: { type: 'string' },
            params: {},
          },
        },
        {
          type: 'object',
          properties: {
            type: { const: 'goBack' },
          },
        },
      ],
    }

    const result = injectNavigateParamsWidgetSentinel(schema)

    const oneOf = result.oneOf as { properties: Record<string, unknown> }[]
    expect(oneOf).toHaveLength(2)
    expect(oneOf[0].properties.params).toEqual(NAVIGATE_PARAMS_SENTINEL)
    expect(oneOf[0].properties.pageId).toEqual({ type: 'string' })
    expect(oneOf[1].properties).toEqual({ type: { const: 'goBack' } })
  })

  it('replaces properties.params inside anyOf branches that declare it', () => {
    const schema = {
      anyOf: [
        { type: 'object', properties: { params: {} } },
        { type: 'object', properties: { pageId: { type: 'string' } } },
      ],
    }

    const result = injectNavigateParamsWidgetSentinel(schema)

    const anyOf = result.anyOf as { properties: Record<string, unknown> }[]
    expect(anyOf[0].properties.params).toEqual(NAVIGATE_PARAMS_SENTINEL)
    expect(anyOf[1].properties).toEqual({ pageId: { type: 'string' } })
  })

  it('replaces items.properties.params', () => {
    const schema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          params: {},
          pageId: { type: 'string' },
        },
      },
    }

    const result = injectNavigateParamsWidgetSentinel(schema)

    const items = result.items as { properties: Record<string, unknown> }
    expect(items.properties.params).toEqual(NAVIGATE_PARAMS_SENTINEL)
    expect(items.properties.pageId).toEqual({ type: 'string' })
  })

  it('replaces params inside a $defs entry', () => {
    const schema = {
      type: 'object',
      properties: {
        root: { $ref: '#/$defs/__schema0' },
      },
      $defs: {
        __schema0: {
          type: 'object',
          properties: {
            params: {},
            other: { type: 'string' },
          },
        },
      },
    }

    const result = injectNavigateParamsWidgetSentinel(schema)

    const defs = result.$defs as Record<string, { properties: Record<string, unknown> }>
    expect(defs.__schema0.properties.params).toEqual(NAVIGATE_PARAMS_SENTINEL)
    expect(defs.__schema0.properties.other).toEqual({ type: 'string' })
  })

  it('does not touch properties whose key is not literally "params"', () => {
    const schema = {
      type: 'object',
      properties: {
        param: { type: 'string' },
        paramsList: { type: 'array', items: { type: 'string' } },
        pageId: { type: 'string' },
      },
    }

    const result = injectNavigateParamsWidgetSentinel(schema)

    expect(result).toEqual(schema)
  })

  it('copies a fragment without properties/items/oneOf/anyOf/$defs unchanged', () => {
    const schema = { type: 'string' }

    const result = injectNavigateParamsWidgetSentinel(schema)

    expect(result).toEqual(schema)
  })

  it('is idempotent: applying the transform twice produces the same result as applying it once', () => {
    const schema = {
      type: 'object',
      properties: {
        params: {},
        pageId: { type: 'string' },
      },
    }

    const once = injectNavigateParamsWidgetSentinel(schema)
    const twice = injectNavigateParamsWidgetSentinel(once)

    expect(twice).toEqual(once)
  })

  it('does not mutate the input schema', () => {
    const schema = {
      type: 'object',
      properties: {
        action: {
          oneOf: [
            {
              type: 'object',
              properties: { params: {}, pageId: { type: 'string' } },
            },
          ],
        },
      },
      $defs: {
        __schema0: { properties: { params: {} } },
      },
    }
    const clone = structuredClone(schema)

    injectNavigateParamsWidgetSentinel(schema)

    expect(schema).toEqual(clone)
  })

  it('applied to the real buttonNodeSchema, replaces params in the navigateTo action variant and leaves the goBack variant untouched', () => {
    const realSchema = toJSONSchema(buttonNodeSchema) as unknown as Record<string, unknown>

    const result = injectNavigateParamsWidgetSentinel(realSchema)

    const properties = result.properties as Record<string, unknown>
    const propsSchema = properties.props as { properties: Record<string, unknown> }
    const action = propsSchema.properties.action as {
      oneOf: { properties: { type: { const: string }; params?: unknown } }[]
    }

    const navigateToBranch = action.oneOf.find((candidate) => candidate.properties.type.const === 'navigateTo')
    expect(navigateToBranch).toBeDefined()
    expect(navigateToBranch?.properties.params).toEqual(NAVIGATE_PARAMS_SENTINEL)

    const goBackBranch = action.oneOf.find((candidate) => candidate.properties.type.const === 'goBack')
    expect(goBackBranch).toBeDefined()
    expect(goBackBranch?.properties.params).toBeUndefined()
  })
})
