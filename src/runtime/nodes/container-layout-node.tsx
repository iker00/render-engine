import { createElement, type ReactNode } from 'react'
import type { ContainerLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import { getContainerNodeStyling } from '../runtime-node-styling'

interface ContainerLayoutNodeViewProps {
  node: ContainerLayoutNode
  children?: ReactNode
}

export function ContainerNode({ node, children }: ContainerLayoutNodeViewProps) {
  const formContext = useOptionalFormContext()
  const isFormSection = formContext !== null && (node.props?.columns !== undefined || node.props?.direction !== 'row')
  const styling = getContainerNodeStyling({
    direction: node.props?.direction,
    gap: node.props?.gap,
    columns: node.props?.columns,
    align: node.props?.align,
    justify: node.props?.justify,
    wrap: node.props?.wrap,
    surface: isFormSection ? 'form-section' : 'plain',
  })

  return createElement(
    'section',
    {
      'data-layout-node': 'container',
      className: styling.className,
      style: styling.style,
    },
    children,
  )
}
