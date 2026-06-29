import type { ReactNode } from 'react'
import type { LayoutNode } from '../config/runtime-config'
import type { RuntimeIterationContext } from './runtime-references/runtime-reference-resolver'
import { resolveLayoutNodeVisibility } from './runtime-layout-visibility'
import { useRuntimeLayoutContext } from './runtime-layout-context'
import { getGridChildSpanClassName } from './runtime-node-styling'
import { useRuntimeState } from './runtime-state/runtime-state-provider'
import { LayoutRenderer } from './layout-renderer'
import { NodeComponents } from './nodes/node-components-map'
import { LazyNode } from './lazy-node'

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
    case 'container': {
      const ContainerNode = NodeComponents.container
      renderedNode = <ContainerNode node={node}>{renderedChildren}</ContainerNode>
      break
    }
    case 'repeater': {
      const RepeaterNode = NodeComponents.repeater
      renderedNode = <RepeaterNode node={node} />
      break
    }
    case 'heading': {
      const HeadingNode = NodeComponents.heading
      renderedNode = <HeadingNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'paragraph': {
      const ParagraphNode = NodeComponents.paragraph
      renderedNode = <ParagraphNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'list': {
      const ListNode = NodeComponents.list
      renderedNode = <ListNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'image': {
      const ImageNode = NodeComponents.image
      renderedNode = <ImageNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'table': {
      const TableNode = NodeComponents.table
      renderedNode = <TableNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'button': {
      const ButtonNode = NodeComponents.button
      renderedNode = <ButtonNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'link': {
      const LinkNode = NodeComponents.link
      renderedNode = <LinkNode node={node} iterationContext={iterationContext} renderedChildren={renderedChildren} />
      break
    }
    case 'modal': {
      const ModalNode = NodeComponents.modal
      renderedNode = <ModalNode node={node} iterationContext={iterationContext}>{renderedChildren}</ModalNode>
      break
    }
    case 'form': {
      const FormNode = NodeComponents.form
      renderedNode = <FormNode node={node} iterationContext={iterationContext}>{renderedChildren}</FormNode>
      break
    }
    case 'input': {
      const InputNode = NodeComponents.input
      renderedNode = <InputNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'textarea': {
      const TextareaNode = NodeComponents.textarea
      renderedNode = <TextareaNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'select': {
      const SelectNode = NodeComponents.select
      renderedNode = <SelectNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'radioGroup': {
      const RadioGroupNode = NodeComponents.radioGroup
      renderedNode = <RadioGroupNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'checkboxGroup': {
      const CheckboxGroupNode = NodeComponents.checkboxGroup
      renderedNode = <CheckboxGroupNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'tabs': {
      const TabsNode = NodeComponents.tabs
      renderedNode = <TabsNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'accordion': {
      const AccordionNode = NodeComponents.accordion
      renderedNode = <AccordionNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'badge': {
      const BadgeNode = NodeComponents.badge
      renderedNode = <BadgeNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'alert': {
      const AlertNode = NodeComponents.alert
      renderedNode = <AlertNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'stat': {
      const StatNode = NodeComponents.stat
      renderedNode = <StatNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'divider': {
      const DividerNode = NodeComponents.divider
      renderedNode = <DividerNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'skeleton': {
      const SkeletonNode = NodeComponents.skeleton
      renderedNode = <SkeletonNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'fileManager': {
      const FileManagerNode = NodeComponents.fileManager
      renderedNode = <FileManagerNode node={node} iterationContext={iterationContext} />
      break
    }
  }

  renderedNode = <LazyNode>{renderedNode}</LazyNode>

  const gridChildSpanClassName =
    node.type === 'repeater' || node.type === 'modal'
      ? null
      : getGridChildSpanClassName(node.layout?.span, parentGridColumns)

  if (!gridChildSpanClassName) {
    return renderedNode
  }

  return <div className={gridChildSpanClassName}>{renderedNode}</div>
}
