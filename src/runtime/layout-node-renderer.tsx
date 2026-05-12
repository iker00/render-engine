import type { ReactNode } from 'react'
import type { LayoutNode } from '../config/runtime-config'
import type { RuntimeIterationContext } from './runtime-references/runtime-reference-resolver'
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
import { RepeaterNode } from './nodes/repeater-layout-node'
import { SelectNode } from './nodes/select-layout-node'
import { TextareaNode } from './nodes/textarea-layout-node'

export interface LayoutNodeRendererProps {
  node: LayoutNode
  renderedChildren?: ReactNode
  iterationContext?: RuntimeIterationContext
}

export function LayoutNodeRenderer({ node, renderedChildren, iterationContext }: LayoutNodeRendererProps) {
  const state = useRuntimeState()
  const resolvedVisibility = resolveLayoutNodeVisibility(node, state, iterationContext)

  if (resolvedVisibility.mode === 'hide') {
    return null
  }

  if (resolvedVisibility.mode === 'fallback') {
    return <LayoutRenderer nodes={resolvedVisibility.fallback} iterationContext={iterationContext} />
  }

  switch (node.type) {
    case 'container':
      return <ContainerNode node={node}>{renderedChildren}</ContainerNode>
    case 'repeater':
      return <RepeaterNode node={node} />
    case 'heading':
      return <HeadingNode node={node} iterationContext={iterationContext} />
    case 'paragraph':
      return <ParagraphNode node={node} iterationContext={iterationContext} />
    case 'list':
      return <ListNode node={node} iterationContext={iterationContext} />
    case 'button':
      return <ButtonNode node={node} iterationContext={iterationContext} />
    case 'form':
      return <FormNode node={node} iterationContext={iterationContext}>{renderedChildren}</FormNode>
    case 'input':
      return <InputNode node={node} />
    case 'textarea':
      return <TextareaNode node={node} />
    case 'select':
      return <SelectNode node={node} iterationContext={iterationContext} />
    case 'radioGroup':
      return <RadioGroupNode node={node} iterationContext={iterationContext} />
    case 'checkboxGroup':
      return <CheckboxGroupNode node={node} iterationContext={iterationContext} />
  }
}
