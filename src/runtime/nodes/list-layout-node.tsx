import type { ListLayoutNode } from '../../config/runtime-config'
import { getListItemClassName, getListNodeClassName } from '../runtime-node-styling'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'
import { resolveListCollectionItems } from '../runtime-collection-sources'

interface ListNodeProps {
  node: ListLayoutNode
}

export function ListNode({ node }: ListNodeProps) {
  const state = useRuntimeState()
  const items = resolveListCollectionItems(node.props.items, state)

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
