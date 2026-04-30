import type { ReactNode } from 'react'
import type { LayoutNode } from '../config/runtime-config'
import { resolveQueryStateFeedback } from './runtime-query-state-feedback'
import { selectQueryState } from './runtime-state/runtime-state-selectors'
import { useRuntimeState } from './runtime-state/runtime-state-provider'
import { LayoutRenderer } from './layout-renderer'
import { ContainerNode } from './nodes/container-layout-node'
import { ButtonNode } from './nodes/button-layout-node'
import { HeadingNode } from './nodes/heading-layout-node'
import { ListNode } from './nodes/list-layout-node'
import { ParagraphNode } from './nodes/paragraph-layout-node'

export interface LayoutNodeRendererProps {
  node: LayoutNode
  renderedChildren?: ReactNode
}

export function LayoutNodeRenderer({ node, renderedChildren }: LayoutNodeRendererProps) {
  const state = useRuntimeState()

  if (node.queryStateFeedback) {
    const resolvedFeedback = resolveQueryStateFeedback(
      node.queryStateFeedback,
      selectQueryState(state, node.queryStateFeedback.query),
    )

    if (resolvedFeedback.mode === 'hide') {
      return null
    }

    if (resolvedFeedback.mode === 'fallback') {
      return <LayoutRenderer nodes={resolvedFeedback.fallback} />
    }
  }

  switch (node.type) {
    case 'container':
      return <ContainerNode node={node}>{renderedChildren}</ContainerNode>
    case 'heading':
      return <HeadingNode node={node} />
    case 'paragraph':
      return <ParagraphNode node={node} />
    case 'list':
      return <ListNode node={node} />
    case 'button':
      return <ButtonNode node={node} />
  }
}
