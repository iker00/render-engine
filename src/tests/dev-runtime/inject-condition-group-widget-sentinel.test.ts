import { describe, expect, it } from 'vitest'
import { toJSONSchema } from 'zod'
import { injectConditionGroupWidgetSentinel } from '../../dev-runtime/layout-canvas/property-fields/inject-condition-group-widget-sentinel'
import { buttonNodeSchema, sidebarItemSchema } from '../../config/runtime-config-zod'

const CONDITION_GROUP_SENTINEL = { 'x-widget': 'condition-group' }

describe('injectConditionGroupWidgetSentinel', () => {
  it('replaces a top-level properties.visibility fragment with the sentinel, preserving the rest of the schema', () => {
    const schema = {
      type: 'object',
      properties: {
        visibility: { oneOf: [{ type: 'object', properties: { operator: { type: 'string' } } }, { type: 'object', properties: { operator: { type: 'string' } } }] },
        label: { type: 'string' },
      },
      required: ['label'],
    }

    const result = injectConditionGroupWidgetSentinel(schema)

    expect(result.properties).toMatchObject({
      visibility: CONDITION_GROUP_SENTINEL,
      label: { type: 'string' },
    })
    expect(result.type).toBe('object')
    expect(result.required).toEqual(['label'])
  })

  it('replaces properties.when at an arbitrarily nested depth (action.oneOf[i].properties.when)', () => {
    const schema = {
      type: 'object',
      properties: {
        action: {
          oneOf: [
            {
              type: 'object',
              properties: {
                type: { const: 'navigateTo' },
                when: { oneOf: [{ type: 'object' }, { type: 'object' }] },
              },
            },
          ],
        },
      },
    }

    const result = injectConditionGroupWidgetSentinel(schema)

    const actionSchema = result.properties as Record<string, unknown>
    const action = actionSchema.action as { oneOf: Record<string, unknown>[] }
    const branch = action.oneOf[0] as { properties: Record<string, unknown> }
    expect(branch.properties.when).toEqual(CONDITION_GROUP_SENTINEL)
    expect(branch.properties.type).toEqual({ const: 'navigateTo' })
  })

  it('replaces properties.when in every branch of a seven-branch oneOf (action variants with when)', () => {
    const branchTypes = ['navigateTo', 'goBack', 'executeOperation', 'executeOperations', 'resetForm', 'openModal', 'closeModal']
    const schema = {
      oneOf: branchTypes.map((type) => ({
        type: 'object',
        properties: {
          type: { const: type },
          when: { oneOf: [{ type: 'object' }, { type: 'object' }] },
        },
      })),
    }

    const result = injectConditionGroupWidgetSentinel(schema)

    const oneOf = result.oneOf as { properties: Record<string, unknown> }[]
    expect(oneOf).toHaveLength(7)
    for (const branch of oneOf) {
      expect(branch.properties.when).toEqual(CONDITION_GROUP_SENTINEL)
    }
  })

  it('replaces items.properties.when (analogous to executeOperations.operations)', () => {
    const schema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          operationName: { type: 'string' },
          when: { oneOf: [{ type: 'object' }, { type: 'object' }] },
        },
      },
    }

    const result = injectConditionGroupWidgetSentinel(schema)

    const items = result.items as { properties: Record<string, unknown> }
    expect(items.properties.when).toEqual(CONDITION_GROUP_SENTINEL)
    expect(items.properties.operationName).toEqual({ type: 'string' })
  })

  it('replaces visibility inside a $defs entry while preserving an internal $ref untouched (no infinite recursion)', () => {
    const schema = {
      type: 'object',
      properties: {
        root: { $ref: '#/$defs/__schema0' },
      },
      $defs: {
        __schema0: {
          type: 'object',
          properties: {
            visibility: { oneOf: [{ type: 'object' }, { type: 'object' }] },
            children: { $ref: '#/$defs/__schema0' },
          },
        },
      },
    }

    const result = injectConditionGroupWidgetSentinel(schema)

    const defs = result.$defs as Record<string, { properties: Record<string, unknown> }>
    expect(defs.__schema0.properties.visibility).toEqual(CONDITION_GROUP_SENTINEL)
    // The internal $ref must survive unchanged — recursing into it would loop forever.
    expect(defs.__schema0.properties.children).toEqual({ $ref: '#/$defs/__schema0' })
  })

  it('does not touch properties whose key is not literally "visibility" or "when"', () => {
    const schema = {
      type: 'object',
      properties: {
        visible: { type: 'boolean' },
        whenever: { type: 'string' },
        visibilityRule: { type: 'object', properties: { foo: { type: 'string' } } },
        whenClause: { type: 'array', items: { type: 'string' } },
      },
    }

    const result = injectConditionGroupWidgetSentinel(schema)

    expect(result).toEqual(schema)
  })

  it('copies a fragment without properties/items/oneOf/anyOf/$defs unchanged', () => {
    const schema = { type: 'string' }

    const result = injectConditionGroupWidgetSentinel(schema)

    expect(result).toEqual(schema)
  })

  it('is idempotent: applying the transform twice produces the same result as applying it once', () => {
    const schema = {
      type: 'object',
      properties: {
        visibility: { oneOf: [{ type: 'object' }, { type: 'object' }] },
        label: { type: 'string' },
      },
    }

    const once = injectConditionGroupWidgetSentinel(schema)
    const twice = injectConditionGroupWidgetSentinel(once)

    expect(twice).toEqual(once)
  })

  it('does not mutate the input schema', () => {
    const schema = {
      type: 'object',
      properties: {
        visibility: { oneOf: [{ type: 'object' }, { type: 'object' }] },
        action: {
          oneOf: [
            {
              type: 'object',
              properties: { when: { oneOf: [{ type: 'object' }] } },
            },
          ],
        },
      },
      $defs: {
        __schema0: { properties: { visibility: { oneOf: [{ type: 'object' }] } } },
      },
    }
    const clone = structuredClone(schema)

    injectConditionGroupWidgetSentinel(schema)

    expect(schema).toEqual(clone)
  })

  it('applied to the real buttonNodeSchema, replaces top-level visibility and the nested when inside executeOperations.operations items', () => {
    const realSchema = toJSONSchema(buttonNodeSchema) as unknown as Record<string, unknown>

    const result = injectConditionGroupWidgetSentinel(realSchema)

    const properties = result.properties as Record<string, unknown>
    expect(properties.visibility).toEqual(CONDITION_GROUP_SENTINEL)

    const propsSchema = properties.props as { properties: Record<string, unknown> }
    const action = propsSchema.properties.action as {
      oneOf: { properties: { type: { const: string }; operations?: { items?: { properties: Record<string, unknown> } } } }[]
    }

    // Locate the `executeOperations` branch by its literal `type` const rather than a fixed index,
    // so this test does not depend on the branch ordering of `buttonActionSchema`.
    const branch = action.oneOf.find((candidate) => candidate.properties.type.const === 'executeOperations')
    expect(branch).toBeDefined()
    expect(branch?.properties.operations?.items?.properties.when).toEqual(CONDITION_GROUP_SENTINEL)
  })

  it('applied to the real sidebarItemSchema, replaces the top-level visibility while preserving the recursive self-$ref inside children', () => {
    const realSchema = toJSONSchema(sidebarItemSchema) as unknown as Record<string, unknown>

    const result = injectConditionGroupWidgetSentinel(realSchema)

    const properties = result.properties as Record<string, unknown>
    expect(properties.visibility).toEqual(CONDITION_GROUP_SENTINEL)

    // `sidebarItemSchema` is a `z.lazy` self-reference: `toJSONSchema` materializes it as a plain
    // `{ $ref: '#' }` on `children.items` (no `$defs` involved for this particular schema), and
    // since the root fragment already had `visibility` substituted, that substitution is reached
    // through the very same `properties.visibility` handled above — no dedicated `$defs` traversal
    // is needed for this schema. The `$ref` itself must survive completely untouched.
    const children = properties.children as { items: Record<string, unknown> }
    expect(children.items).toEqual({ $ref: '#' })
  })
})
