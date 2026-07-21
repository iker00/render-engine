import type { ReactNode } from 'react'
import type { ContainerLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import { useLayoutEditModeContext } from '../layout-edit-mode-context'
import { RuntimeLayoutContextProvider } from '../runtime-layout-context'
import { getContainerNodeStyling, getContainerNodeSurface } from '../runtime-node-styling'

interface ContainerLayoutNodeViewProps {
  node: ContainerLayoutNode
  children?: ReactNode
}

export function ContainerNode({ node, children }: ContainerLayoutNodeViewProps) {
  const formContext = useOptionalFormContext()
  const editModeContext = useLayoutEditModeContext()
  const styling = getContainerNodeStyling({
    direction: node.props?.direction,
    gap: node.props?.gap,
    columns: node.props?.columns,
    variant: node.props?.variant,
    align: node.props?.align,
    justify: node.props?.justify,
    wrap: node.props?.wrap,
    surface: getContainerNodeSurface({
      withinForm: formContext !== null,
      direction: node.props?.direction,
      columns: node.props?.columns,
    }),
  })

  // T2 (feature 0106): the grid-drop-zones overlay (`LayoutCanvasGridDropZonesOverlay`) is
  // rendered as a child of this `<section>` and needs `position: relative` to establish a
  // containing block for its absolutely-positioned zones. The class is applied only when the
  // Editor is active AND the container is in grid mode, so Visual/production DOM stays
  // byte-identical to before this feature.
  const isEditModeActive = editModeContext !== null && editModeContext.active
  const isGridMode = node.props?.columns !== undefined && node.props?.columns !== null
  const className = isEditModeActive && isGridMode ? `${styling.className} relative` : styling.className

  return (
    <section data-layout-node="container" className={className} style={styling.style}>
      <RuntimeLayoutContextProvider
        value={{
          parentGridColumns: node.props?.columns ?? null,
        }}
      >
        {children}
      </RuntimeLayoutContextProvider>
    </section>
  )
}
