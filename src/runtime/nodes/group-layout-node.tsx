import { useId } from 'react'
import type { ReactNode } from 'react'
import type { RuntimeGroupInstanceNode } from '../../config/runtime-config-types'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeValueWithOptions } from '../runtime-references/runtime-reference-resolver'
import type { RuntimeInstanceScope } from '../runtime-references/runtime-instance-scope'
import { EMPTY_INSTANCE_SCOPE, pushGroupScopeToken } from '../runtime-references/runtime-instance-scope'
import { RuntimeGroupContextProvider } from '../runtime-references/runtime-group-context'
import { useRuntimeConfig, useRuntimeState } from '../runtime-state/use-runtime-state'
import { LayoutRenderer } from '../layout-renderer'
import { SlotContentProvider } from './slot-content-context'

interface GroupNodeProps {
  node: RuntimeGroupInstanceNode
  iterationContext?: RuntimeIterationContext
  /**
   * Cadena de scope ambiente recibida del ancestro (T02/T12 / feature reusable-node-groups):
   * posición del `group` antes de instanciar su propio token. `GroupLayoutNode` empuja un token
   * `group` derivado de su posición estructural en el árbol renderizado (`useId`, estable entre
   * renders de la misma instancia montada, distinto por instancia) antes de propagar la cadena
   * resultante a `groups[groupId].template`.
   */
  scopeChain?: RuntimeInstanceScope
  /**
   * Contenido de `props.children` (el slot) ya renderizado por `LayoutRenderer`/
   * `LayoutNodeRenderer` contra el mismo `iterationContext`/`scopeChain` ambiente que recibe esta
   * propia instancia de `group` — es decir, antes de que exista ningún proveedor de contexto de
   * grupo. Antes de exponerlo a través de `SlotContentProvider` se envuelve en su propio
   * `RuntimeGroupContextProvider` con valor `null` (ver más abajo) para que, sin importar en qué
   * punto del `template` lo recupere `SlotLayoutNode`, el contenido del slot nunca herede el
   * contexto de grupo ambiente de esa posición — React resuelve `useContext` por posición en el
   * árbol final, no por el punto de creación del elemento.
   */
  children?: ReactNode
}

export function GroupLayoutNode({ node, iterationContext, scopeChain, children }: GroupNodeProps) {
  const resolvedScopeChain = scopeChain ?? EMPTY_INSTANCE_SCOPE
  const state = useRuntimeState()
  const config = useRuntimeConfig()
  const groupInstanceToken = useId()
  const groupDefinition = config.groups?.[node.props.groupId]

  if (!groupDefinition) {
    return null
  }

  const paramValues: Record<string, unknown> = {}

  for (const [paramName, rawValue] of Object.entries(node.props.params)) {
    const resolved = resolveRuntimeValueWithOptions(rawValue, state, {
      iterationContext,
      scope: resolvedScopeChain,
    })
    paramValues[paramName] = resolved.status === 'resolved' ? resolved.value : undefined
  }

  // No anidamiento de `group` dentro de `groups.*.template` (rechazado en config validation), así
  // que el contexto de grupo ambiente en el punto de instanciación de cualquier `group` es siempre
  // `null` — el mismo valor que un `SlotLayoutNode` debe restaurar aquí para que su contenido se
  // comporte "como si estuviera escrito inline en el punto de instanciación".
  const slotContent = children != null ? <RuntimeGroupContextProvider value={null}>{children}</RuntimeGroupContextProvider> : null

  return (
    <SlotContentProvider value={slotContent}>
      <RuntimeGroupContextProvider value={{ paramValues }}>
        <LayoutRenderer
          nodes={groupDefinition.template}
          iterationContext={iterationContext}
          scopeChain={pushGroupScopeToken(resolvedScopeChain, groupInstanceToken)}
        />
      </RuntimeGroupContextProvider>
    </SlotContentProvider>
  )
}
