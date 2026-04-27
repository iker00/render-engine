import type { ReactNode } from 'react'
import type { LayoutNode } from '../config/runtime-config'
import { ContainerNode } from './nodes/container-layout-node'
import { HeadingNode } from './nodes/heading-layout-node'
import { ListNode } from './nodes/list-layout-node'
import { ParagraphNode } from './nodes/paragraph-layout-node'

export interface LayoutNodeRendererProps {
  node: LayoutNode
  renderedChildren?: ReactNode
}

export function LayoutNodeRenderer({ node, renderedChildren }: LayoutNodeRendererProps) {
  switch (node.type) {
    case 'container':
      return <ContainerNode node={node}>{renderedChildren}</ContainerNode>
    case 'heading':
      return <HeadingNode node={node} />
    case 'paragraph':
      return <ParagraphNode node={node} />
    case 'list':
      return <ListNode node={node} />
  }
}
