import type { ReactNode } from 'react'
import type { ContainerLayoutNode } from '../../config/runtime-config'
import { getContainerNodeStyling } from '../runtime-node-styling'

interface ContainerLayoutNodeViewProps {
  node: ContainerLayoutNode
  children?: ReactNode
}

export function ContainerNode({ node, children }: ContainerLayoutNodeViewProps) {
  const styling = getContainerNodeStyling({
    direction: node.props?.direction,
    gap: node.props?.gap,
  })

  return (
    <div data-layout-node="container" className={styling.className} style={styling.style}>
      {children}
    </div>
  )
}
