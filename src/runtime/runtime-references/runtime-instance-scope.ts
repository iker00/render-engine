/**
 * Cadena de scope ambiente para derivar claves de estado por instancia.
 *
 * Cada nivel de anidamiento reutilizable (repeater, group de nodos) añade un
 * token a la cadena. `deriveScopedStateKey` compone esos tokens con el `id`
 * literal del nodo para que dos instancias del mismo nodo bajo iteraciones o
 * copias de grupo distintas no compartan estado en `runtime-state`.
 */

export type RuntimeInstanceScopeToken =
  | { kind: 'repeater'; key: string }
  | { kind: 'group'; token: string }

export type RuntimeInstanceScope = readonly RuntimeInstanceScopeToken[]

export const EMPTY_INSTANCE_SCOPE: RuntimeInstanceScope = Object.freeze([])

export function pushRepeaterScopeToken(scope: RuntimeInstanceScope, key: string): RuntimeInstanceScope {
  return [...scope, { kind: 'repeater', key }]
}

export function pushGroupScopeToken(scope: RuntimeInstanceScope, token: string): RuntimeInstanceScope {
  return [...scope, { kind: 'group', token }]
}

/**
 * Formato de clave: `baseId` seguido de un segmento `::` por token de scope,
 * en el orden en que se añadieron (ancestro más externo primero). Cada
 * segmento codifica su tipo (`r` para repeater, `g` para group) y su valor,
 * de modo que scopes con el mismo conjunto de valores pero distinto orden o
 * distinto tipo de token produzcan claves distintas.
 */
export function deriveScopedStateKey(baseId: string, scope: RuntimeInstanceScope): string {
  if (scope.length === 0) {
    return baseId
  }

  const segments = scope.map((token) =>
    token.kind === 'repeater' ? `r:${token.key}` : `g:${token.token}`,
  )

  return [baseId, ...segments].join('::')
}
