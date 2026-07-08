import { describe, expect, it } from 'vitest'
import { getRuntimeConfigJsonSchema } from '../../dev-runtime/dev-runtime-json-schema'

describe('getRuntimeConfigJsonSchema', () => {
  it('returns a JSON Schema 7 object with type object and top-level properties', () => {
    const schema = getRuntimeConfigJsonSchema()
    expect(schema).toBeDefined()
    expect(typeof schema).toBe('object')
    expect(String(schema.$schema)).toContain('json-schema.org')
    expect(schema.type).toBe('object')
    const props = schema.properties as Record<string, unknown>
    expect(props['api']).toBeDefined()
    expect(props['pages']).toBeDefined()
    expect(props['initialPage']).toBeDefined()
  })

  it('returns the same reference on a second call (cache)', () => {
    const first = getRuntimeConfigJsonSchema()
    const second = getRuntimeConfigJsonSchema()
    expect(first).toBe(second)
  })

  it('schema includes at least a container node variant in the layout union', () => {
    const schema = getRuntimeConfigJsonSchema()
    const schemaStr = JSON.stringify(schema)
    // The union for layout nodes includes a container variant discriminated by type
    expect(schemaStr).toContain('container')
  })

  it('schema includes skeleton node variant in the layout union (autocomplete support)', () => {
    const schema = getRuntimeConfigJsonSchema()
    const schemaStr = JSON.stringify(schema)
    expect(schemaStr).toContain('skeleton')
  })

  it('schema includes translations as a root property', () => {
    const schema = getRuntimeConfigJsonSchema()
    const props = schema.properties as Record<string, unknown>
    expect(props['translations']).toBeDefined()
  })

  it('schema includes tokens as a root property', () => {
    const schema = getRuntimeConfigJsonSchema()
    const props = schema.properties as Record<string, unknown>
    expect(props['tokens']).toBeDefined()
  })
})
