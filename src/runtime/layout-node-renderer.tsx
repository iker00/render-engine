import type { MouseEvent, ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { LayoutNode } from '../config/runtime-config'
import type { RuntimeIterationContext } from './runtime-references/runtime-reference-resolver'
import type { LayoutNodePath } from './layout-node-path'
import { resolveLayoutNodeVisibility } from './runtime-layout-visibility'
import { useRuntimeLayoutContext } from './runtime-layout-context'
import { useLayoutEditModeContext } from './layout-edit-mode-context'
import { serializeLayoutNodePath } from './layout-node-path'
import { getGridChildSpanClassName } from './runtime-node-styling'
import { useRuntimeState } from './runtime-state/runtime-state-provider'
import { LayoutRenderer } from './layout-renderer'
import { NodeComponents } from './nodes/node-components-map'
import { LazyNode } from './lazy-node'

export interface LayoutNodeRendererProps {
  node: LayoutNode
  renderedChildren?: ReactNode
  iterationContext?: RuntimeIterationContext
  path?: LayoutNodePath
}

export function LayoutNodeRenderer({ node, renderedChildren, iterationContext, path = [] }: LayoutNodeRendererProps) {
  const state = useRuntimeState()
  const { parentGridColumns } = useRuntimeLayoutContext()
  const editModeContext = useLayoutEditModeContext()
  // Hoisted above every early return (Rules of Hooks: this hook must run on every render,
  // regardless of visibility branch) and unconditionally called even outside the canvas —
  // `useDraggable` is a safe no-op without an ancestor DndContext (default internal
  // context), and `disabled` keeps it inert whenever there is no LayoutEditModeContext, so
  // production/preview rendering (no provider) is unaffected. See T12 / design.md Decisión 7.
  const serializedPath = serializeLayoutNodePath(path)
  const { setNodeRef: setDraggableNodeRef, listeners: draggableListeners } = useDraggable({
    id: serializedPath,
    disabled: editModeContext === null,
  })
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
      renderedNode = <RepeaterNode node={node} path={path} />
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
      renderedNode = <TabsNode node={node} iterationContext={iterationContext} path={path} />
      break
    }
    case 'accordion': {
      const AccordionNode = NodeComponents.accordion
      renderedNode = <AccordionNode node={node} iterationContext={iterationContext} path={path} />
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
    case 'fileInput': {
      const FileInputNode = NodeComponents.fileInput
      renderedNode = <FileInputNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'fileManager': {
      const FileManagerNode = NodeComponents.fileManager
      renderedNode = <FileManagerNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'toggle': {
      const ToggleNode = NodeComponents.toggle
      renderedNode = <ToggleNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'hidden': {
      const HiddenNode = NodeComponents.hidden
      renderedNode = <HiddenNode node={node} iterationContext={iterationContext} />
      break
    }
  }

  renderedNode = <LazyNode>{renderedNode}</LazyNode>

  if (editModeContext !== null) {
    const isSelected =
      editModeContext.selectedPath !== null &&
      serializeLayoutNodePath(editModeContext.selectedPath) === serializedPath
    const isHovered =
      editModeContext.hoveredPath !== null &&
      serializeLayoutNodePath(editModeContext.hoveredPath) === serializedPath

    let editModeClassName: string | undefined
    if (isSelected) {
      editModeClassName = 'outline outline-2 -outline-offset-2 outline-blue-500'
    } else if (isHovered) {
      editModeClassName = 'outline outline-1 -outline-offset-1 outline-blue-300'
    }

    // Every selectable node is wrapped the same way, so a click on a deeply nested node
    // bubbles (intentionally, no stopPropagation — see design.md) through every ancestor
    // wrapper's onClick too. Native click bubbling fires the innermost wrapper first, so
    // the first wrapper to see an unmarked native event is always the actual click target;
    // it claims the selection and stamps the event so ancestor wrappers become no-ops for
    // selection while still letting the event keep bubbling normally (e.g. to an unrelated
    // click listener higher up the tree).
    const handleSelectClick = (event: MouseEvent<HTMLDivElement>) => {
      const nativeEvent = event.nativeEvent as MouseEvent['nativeEvent'] & {
        __layoutEditModeNodeSelected?: boolean
      }

      if (nativeEvent.__layoutEditModeNodeSelected) {
        return
      }

      nativeEvent.__layoutEditModeNodeSelected = true
      editModeContext.onSelectNode(path)
    }

    renderedNode = (
      <div
        ref={setDraggableNodeRef}
        data-node-path={serializedPath}
        onClick={handleSelectClick}
        onMouseEnter={() => editModeContext.onHoverNode(path)}
        onMouseLeave={() => editModeContext.onHoverNode(null)}
        className={editModeClassName}
        {...draggableListeners}
      >
        {renderedNode}
      </div>
    )
  }

  const gridChildSpanClassName =
    node.type === 'repeater' || node.type === 'modal' || node.type === 'hidden'
      ? null
      : getGridChildSpanClassName(node.layout?.span, parentGridColumns)

  if (!gridChildSpanClassName) {
    return renderedNode
  }

  return <div className={gridChildSpanClassName}>{renderedNode}</div>
}
