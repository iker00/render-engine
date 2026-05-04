import type { ReactNode } from 'react'
import type { LayoutNode } from '../config/runtime-config'
import { resolveLayoutNodeFeedback } from './runtime-query-state-feedback'
import { useRuntimeState } from './runtime-state/runtime-state-provider'
import { LayoutRenderer } from './layout-renderer'
import { ButtonNode } from './nodes/button-layout-node'
import { ContainerNode } from './nodes/container-layout-node'
import { FormNode } from './nodes/form-layout-node'
import { HeadingNode } from './nodes/heading-layout-node'
import { InputNode } from './nodes/input-layout-node'
import { ListNode } from './nodes/list-layout-node'
import { ParagraphNode } from './nodes/paragraph-layout-node'
import { SelectNode } from './nodes/select-layout-node'
import { TextareaNode } from './nodes/textarea-layout-node'

export interface LayoutNodeRendererProps {
  node: LayoutNode
  renderedChildren?: ReactNode
}

export function LayoutNodeRenderer({ node, renderedChildren }: LayoutNodeRendererProps) {
  const state = useRuntimeState()

  if (node.queryStateFeedback) {
    const resolvedFeedback = resolveLayoutNodeFeedback(node.queryStateFeedback, state)

    if (resolvedFeedback && resolvedFeedback.mode === 'hide') {
      return null
    }

    if (resolvedFeedback && resolvedFeedback.mode === 'fallback') {
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
    case 'form':
      return <FormNode node={node}>{renderedChildren}</FormNode>
    case 'input':
      return <InputNode node={node} />
    case 'textarea':
      return <TextareaNode node={node} />
    case 'select':
      return <SelectNode node={node} />
  }
}
