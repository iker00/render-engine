import type { ReactNode } from 'react'
import type { LayoutNode } from '../config/runtime-config'
import type { RuntimeIterationContext } from './runtime-references/runtime-reference-resolver'
import { resolveLayoutNodeVisibility } from './runtime-layout-visibility'
import { useRuntimeLayoutContext } from './runtime-layout-context'
import { getGridChildSpanClassName } from './runtime-node-styling'
import { useRuntimeState } from './runtime-state/runtime-state-provider'
import { LayoutRenderer } from './layout-renderer'
import { AccordionNode } from './nodes/accordion-layout-node'
import { AlertNode } from './nodes/alert-layout-node'
import { BadgeNode } from './nodes/badge-layout-node'
import { DividerNode } from './nodes/divider-layout-node'
import { SkeletonNode } from './nodes/skeleton-layout-node'
import { StatNode } from './nodes/stat-layout-node'
import { ButtonNode } from './nodes/button-layout-node'
import { LinkNode } from './nodes/link-layout-node'
import { CheckboxGroupNode } from './nodes/checkbox-group-layout-node'
import { ContainerNode } from './nodes/container-layout-node'
import { FormNode } from './nodes/form-layout-node'
import { HeadingNode } from './nodes/heading-layout-node'
import { ImageNode } from './nodes/image-layout-node'
import { InputNode } from './nodes/input-layout-node'
import { ListNode } from './nodes/list-layout-node'
import { ModalNode } from './nodes/modal-layout-node'
import { ParagraphNode } from './nodes/paragraph-layout-node'
import { RadioGroupNode } from './nodes/radio-group-layout-node'
import { RepeaterNode } from './nodes/repeater-layout-node'
import { SelectNode } from './nodes/select-layout-node'
import { TableNode } from './nodes/table-layout-node'
import { TabsNode } from './nodes/tabs-layout-node'
import { TextareaNode } from './nodes/textarea-layout-node'

export interface LayoutNodeRendererProps {
  node: LayoutNode
  renderedChildren?: ReactNode
  iterationContext?: RuntimeIterationContext
}

export function LayoutNodeRenderer({ node, renderedChildren, iterationContext }: LayoutNodeRendererProps) {
  const state = useRuntimeState()
  const { parentGridColumns } = useRuntimeLayoutContext()
  const resolvedVisibility = resolveLayoutNodeVisibility(node, state, iterationContext)

  if (resolvedVisibility.mode === 'hide') {
    return null
  }

  if (resolvedVisibility.mode === 'fallback') {
    const fallbackContent = <LayoutRenderer nodes={resolvedVisibility.fallback} iterationContext={iterationContext} />

    if (resolvedVisibility.visibleState === 'loading') {
      return <div role="status">{fallbackContent}</div>
    }

    if (resolvedVisibility.visibleState === 'error') {
      return <div role="alert">{fallbackContent}</div>
    }

    return fallbackContent
  }

  let renderedNode: ReactNode

  switch (node.type) {
    case 'container':
      renderedNode = <ContainerNode node={node}>{renderedChildren}</ContainerNode>
      break
    case 'repeater':
      renderedNode = <RepeaterNode node={node} />
      break
    case 'heading':
      renderedNode = <HeadingNode node={node} iterationContext={iterationContext} />
      break
    case 'paragraph':
      renderedNode = <ParagraphNode node={node} iterationContext={iterationContext} />
      break
    case 'list':
      renderedNode = <ListNode node={node} iterationContext={iterationContext} />
      break
    case 'image':
      renderedNode = <ImageNode node={node} iterationContext={iterationContext} />
      break
    case 'table':
      renderedNode = <TableNode node={node} iterationContext={iterationContext} />
      break
    case 'button':
      renderedNode = <ButtonNode node={node} iterationContext={iterationContext} />
      break
    case 'link':
      renderedNode = <LinkNode node={node} iterationContext={iterationContext} />
      break
    case 'modal':
      renderedNode = <ModalNode node={node} iterationContext={iterationContext}>{renderedChildren}</ModalNode>
      break
    case 'form':
      renderedNode = <FormNode node={node} iterationContext={iterationContext}>{renderedChildren}</FormNode>
      break
    case 'input':
      renderedNode = <InputNode node={node} iterationContext={iterationContext} />
      break
    case 'textarea':
      renderedNode = <TextareaNode node={node} iterationContext={iterationContext} />
      break
    case 'select':
      renderedNode = <SelectNode node={node} iterationContext={iterationContext} />
      break
    case 'radioGroup':
      renderedNode = <RadioGroupNode node={node} iterationContext={iterationContext} />
      break
    case 'checkboxGroup':
      renderedNode = <CheckboxGroupNode node={node} iterationContext={iterationContext} />
      break
    case 'tabs':
      renderedNode = <TabsNode node={node} iterationContext={iterationContext} />
      break
    case 'accordion':
      renderedNode = <AccordionNode node={node} iterationContext={iterationContext} />
      break
    case 'badge':
      renderedNode = <BadgeNode node={node} iterationContext={iterationContext} />
      break
    case 'alert':
      renderedNode = <AlertNode node={node} iterationContext={iterationContext} />
      break
    case 'stat':
      renderedNode = <StatNode node={node} iterationContext={iterationContext} />
      break
    case 'divider':
      renderedNode = <DividerNode node={node} iterationContext={iterationContext} />
      break
    case 'skeleton':
      renderedNode = <SkeletonNode node={node} iterationContext={iterationContext} />
      break
  }

  const gridChildSpanClassName =
    node.type === 'repeater' || node.type === 'modal'
      ? null
      : getGridChildSpanClassName(node.layout?.span, parentGridColumns)

  console.log(node, node.layout?.span)

  if (!gridChildSpanClassName) {
    return renderedNode
  }

  return <div className={gridChildSpanClassName}>{renderedNode}</div>
}
