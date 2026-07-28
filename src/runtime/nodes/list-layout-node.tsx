import type { ListLayoutNode } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { getListItemClassName, getListNodeClassName } from '../runtime-node-styling'
import { useRuntimeState } from '../runtime-state/use-runtime-state'
import { resolveListCollectionItemsWithOptions } from '../runtime-collection-sources'

interface ListNodeProps {
  node: ListLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function ListNode({ node, iterationContext }: ListNodeProps) {
  const state = useRuntimeState()
  const items = resolveListCollectionItemsWithOptions(node.props.items, state, { iterationContext })

  return (
    <ul data-layout-node="list" className={getListNodeClassName()}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className={getListItemClassName()}>
          {item}
        </li>
      ))}
    </ul>
  )
}
