import type { ReactNode } from 'react'
import type { LayoutNode } from '../config/runtime-config'
import { resolveLayoutNodeVisibility } from './runtime-layout-visibility'
import { useRuntimeState } from './runtime-state/runtime-state-provider'
import { LayoutRenderer } from './layout-renderer'
import { ButtonNode } from './nodes/button-layout-node'
import { CheckboxGroupNode } from './nodes/checkbox-group-layout-node'
import { ContainerNode } from './nodes/container-layout-node'
import { FormNode } from './nodes/form-layout-node'
import { HeadingNode } from './nodes/heading-layout-node'
import { InputNode } from './nodes/input-layout-node'
import { ListNode } from './nodes/list-layout-node'
import { ParagraphNode } from './nodes/paragraph-layout-node'
import { RadioGroupNode } from './nodes/radio-group-layout-node'
import { SelectNode } from './nodes/select-layout-node'
import { TextareaNode } from './nodes/textarea-layout-node'

export interface LayoutNodeRendererProps {
  node: LayoutNode
  renderedChildren?: ReactNode
}

export function LayoutNodeRenderer({ node, renderedChildren }: LayoutNodeRendererProps) {
  const state = useRuntimeState()
  const resolvedVisibility = resolveLayoutNodeVisibility(node, state)

  if (resolvedVisibility.mode === 'hide') {
    return null
  }

  if (resolvedVisibility.mode === 'fallback') {
    return <LayoutRenderer nodes={resolvedVisibility.fallback} />
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
    case 'radioGroup':
      return <RadioGroupNode node={node} />
    case 'checkboxGroup':
      return <CheckboxGroupNode node={node} />
  }
}
