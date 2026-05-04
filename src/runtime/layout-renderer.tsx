import type { LayoutNode, LayoutNodeCollection } from '../config/runtime-config'
import { LayoutNodeRenderer } from './layout-node-renderer'

export interface LayoutRendererProps {
  nodes: LayoutNodeCollection
}

export function LayoutRenderer({ nodes }: LayoutRendererProps) {
  return (
    <>
      {nodes.map((node, index) => (
        <LayoutNodeRenderer
          key={getLayoutNodeKey(node, index)}
          node={node}
          renderedChildren={hasChildren(node) ? <LayoutRenderer nodes={node.children ?? []} /> : undefined}
        />
      ))}
    </>
  )
}

function hasChildren(node: LayoutNode): node is Extract<LayoutNode, { children?: LayoutNodeCollection }> {
  return node.type === 'container' || node.type === 'form'
}

function getLayoutNodeKey(node: LayoutNode, index: number) {
  if ('id' in node && typeof node.id === 'string') {
    return node.id
  }

  if (node.type === 'input' || node.type === 'textarea' || node.type === 'select') {
    return `${node.type}-${node.props.fieldId}-${index}`
  }

  return `${node.type}-${index}`
}
