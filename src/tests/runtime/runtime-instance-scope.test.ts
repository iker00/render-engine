import { describe, expect, it } from 'vitest'
import {
  EMPTY_INSTANCE_SCOPE,
  deriveScopedStateKey,
  pushGroupScopeToken,
  pushRepeaterScopeToken,
  type RuntimeInstanceScope,
} from '../../runtime/runtime-references/runtime-instance-scope'

describe('runtime-instance-scope', () => {
  it('EMPTY_INSTANCE_SCOPE es una lista vacía inmutable', () => {
    expect(EMPTY_INSTANCE_SCOPE).toEqual([])
    expect(() => {
      // @ts-expect-error -- verificamos en runtime que el array está congelado
      EMPTY_INSTANCE_SCOPE.push({ kind: 'repeater', key: '0' })
    }).toThrow()
  })

  it('pushRepeaterScopeToken devuelve una nueva cadena con el token de repeater al final y no muta la entrada', () => {
    const original: RuntimeInstanceScope = EMPTY_INSTANCE_SCOPE
    const result = pushRepeaterScopeToken(original, '0')

    expect(result).toEqual([{ kind: 'repeater', key: '0' }])
    expect(original).toEqual([])
    expect(result).not.toBe(original)
  })

  it('pushGroupScopeToken devuelve una nueva cadena con el token de grupo al final y no muta la entrada', () => {
    const original: RuntimeInstanceScope = EMPTY_INSTANCE_SCOPE
    const result = pushGroupScopeToken(original, 'group-abc')

    expect(result).toEqual([{ kind: 'group', token: 'group-abc' }])
    expect(original).toEqual([])
    expect(result).not.toBe(original)
  })

  it('deriveScopedStateKey con scope vacío devuelve exactamente el baseId original', () => {
    expect(deriveScopedStateKey('modal-1', EMPTY_INSTANCE_SCOPE)).toBe('modal-1')
  })

  it('deriveScopedStateKey con un token de repeater concatena baseId y key de forma determinista', () => {
    const scope = pushRepeaterScopeToken(EMPTY_INSTANCE_SCOPE, '2')

    const key = deriveScopedStateKey('modal-1', scope)

    expect(key).toBe(deriveScopedStateKey('modal-1', scope))
    expect(key).not.toBe('modal-1')
  })

  it('deriveScopedStateKey con un token de grupo concatena baseId y token de forma determinista', () => {
    const scope = pushGroupScopeToken(EMPTY_INSTANCE_SCOPE, 'group-xyz')

    const key = deriveScopedStateKey('modal-1', scope)

    expect(key).toBe(deriveScopedStateKey('modal-1', scope))
    expect(key).not.toBe('modal-1')
  })

  it('deriveScopedStateKey con cadena mixta produce claves distintas según el orden de los tokens', () => {
    const repeaterThenGroup = pushGroupScopeToken(pushRepeaterScopeToken(EMPTY_INSTANCE_SCOPE, '0'), 'group-a')
    const groupThenRepeater = pushRepeaterScopeToken(pushGroupScopeToken(EMPTY_INSTANCE_SCOPE, 'group-a'), '0')

    const keyRepeaterThenGroup = deriveScopedStateKey('modal-1', repeaterThenGroup)
    const keyGroupThenRepeater = deriveScopedStateKey('modal-1', groupThenRepeater)

    expect(keyRepeaterThenGroup).not.toBe(keyGroupThenRepeater)
  })

  it('dos baseId distintos bajo el mismo scope producen claves distintas', () => {
    const scope = pushRepeaterScopeToken(EMPTY_INSTANCE_SCOPE, '3')

    const keyA = deriveScopedStateKey('modal-a', scope)
    const keyB = deriveScopedStateKey('modal-b', scope)

    expect(keyA).not.toBe(keyB)
  })
})
