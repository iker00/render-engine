import type { MouseEvent, ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { LayoutNode } from '../config/runtime-config'
import type { RuntimeIterationContext } from './runtime-references/runtime-reference-resolver'
import type { LayoutNodePath } from './layout-node-path'
import { resolveLayoutNodeVisibility } from './runtime-layout-visibility'
import { useRuntimeLayoutContext } from './use-runtime-layout-context'
import { useLayoutEditModeContext } from './use-layout-edit-mode-context'
import { pathEndsAtTableCell, serializeLayoutNodePath } from './layout-node-path'
import { getGridChildSpanClassName } from './runtime-node-styling'
import { useRuntimeState } from './runtime-state/use-runtime-state'
import { LayoutRenderer } from './layout-renderer'
import { NodeComponents } from './nodes/node-components-map'
import { LazyNode } from './lazy-node'

// Node types whose native form control(s) must become inert in Editor mode.
// A single <fieldset disabled> ancestor cascades the disabled state to every
// listed-element descendant (input/select/textarea/button/…), covers label-driven
// activation of checkboxes/radios/toggles that pointer-events-none alone would
// leave functional, and does so without touching any individual node file.
// See design.md (feature 0103) Decisión 4 for why 'button', 'accordion',
// 'tabs', 'hidden' and 'fileManager' are deliberately excluded.
const NODE_TYPES_INERT_IN_EDIT_MODE: ReadonlySet<LayoutNode['type']> = new Set([
  'input',
  'textarea',
  'select',
  'radioGroup',
  'checkboxGroup',
  'toggle',
  'fileInput',
  'autocomplete',
])

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
  // A table cell node (path ending in a `row`/`cells` step, T4/design.md) is never a drag
  // source: `table` never appears in `nodeTypeAcceptsChildren`, so no drop zone is ever
  // generated to reorder cells against each other or against anything else — dragging one
  // would only produce an inert gesture. A cell-container's own children (path continuing
  // past `row`/`cells` with a `children` step) are unaffected and stay draggable normally.
  const serializedPath = serializeLayoutNodePath(path)
  const { setNodeRef: setDraggableNodeRef, listeners: draggableListeners } = useDraggable({
    id: serializedPath,
    disabled: editModeContext === null || !editModeContext.active || pathEndsAtTableCell(path),
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
      renderedNode = <TableNode node={node} iterationContext={iterationContext} path={path} />
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
    case 'map': {
      const MapNode = NodeComponents.map
      renderedNode = <MapNode node={node} iterationContext={iterationContext} />
      break
    }
    case 'autocomplete': {
      const AutocompleteNode = NodeComponents.autocomplete
      renderedNode = <AutocompleteNode node={node} iterationContext={iterationContext} />
      break
    }
  }

  renderedNode = <LazyNode>{renderedNode}</LazyNode>

  if (editModeContext !== null && NODE_TYPES_INERT_IN_EDIT_MODE.has(node.type)) {
    // `display: contents` keeps the layout untouched (no extra box, no reflow —
    // same non-functional guarantee the selection wrapper below already meets).
    // The fieldset sits INSIDE the selection wrapper so that clicks on the
    // (now inert) control still bubble up to it and trigger selection.
    // Presence is gated only by "provider mounted" (design.md Decisión 9): it must never
    // toggle between Visual and Editor, only `disabled` does, so a node's DOM subtree never
    // remounts when switching modes.
    renderedNode = (
      <fieldset disabled={editModeContext.active} className="contents">
        {renderedNode}
      </fieldset>
    )
  }

  if (editModeContext !== null) {
    // Narrowed reference (not a plain boolean) so TypeScript keeps `selectedPath`/`hoveredPath`/
    // `onSelectNode`/`onHoverNode` available below without re-checking `.active` each time.
    const activeContext = editModeContext.active ? editModeContext : null
    const isSelected =
      activeContext !== null &&
      activeContext.selectedPath !== null &&
      serializeLayoutNodePath(activeContext.selectedPath) === serializedPath
    const isHovered =
      activeContext !== null &&
      activeContext.hoveredPath !== null &&
      serializeLayoutNodePath(activeContext.hoveredPath) === serializedPath

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
      if (activeContext === null) return

      const nativeEvent = event.nativeEvent as MouseEvent['nativeEvent'] & {
        __layoutEditModeNodeSelected?: boolean
      }

      if (nativeEvent.__layoutEditModeNodeSelected) {
        return
      }

      nativeEvent.__layoutEditModeNodeSelected = true
      activeContext.onSelectNode(path)
    }

    // Wrapper is mounted whenever a provider exists at all (design.md Decisión 9), never
    // gated on `.active` — only its handlers/className behave differently, so a node's DOM
    // subtree never remounts when switching between Visual and Editor.
    renderedNode = (
      <div
        ref={setDraggableNodeRef}
        data-node-path={serializedPath}
        onClick={handleSelectClick}
        onMouseEnter={() => activeContext?.onHoverNode(path)}
        onMouseLeave={() => activeContext?.onHoverNode(null)}
        className={editModeClassName}
        {...draggableListeners}
      >
        {renderedNode}
      </div>
    )
  }

  const gridChildSpanClassName =
    (node.type === 'repeater' && node.props.columns === undefined) || node.type === 'modal' || node.type === 'hidden'
      ? null
      : getGridChildSpanClassName(node.layout?.span, parentGridColumns)

  if (!gridChildSpanClassName) {
    return renderedNode
  }

  return <div className={gridChildSpanClassName}>{renderedNode}</div>
}
