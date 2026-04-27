import type { ListLayoutNode } from '../../config/runtime-config'
import { getListItemClassName, getListNodeClassName } from '../runtime-node-styling'

interface ListNodeProps {
  node: ListLayoutNode
}

export function ListNode({ node }: ListNodeProps) {
  return (
    <ul data-layout-node="list" className={getListNodeClassName()}>
      {node.props.items.map((item, index) => (
        <li key={`${item}-${index}`} className={getListItemClassName()}>
          {item}
        </li>
      ))}
    </ul>
  )
}
