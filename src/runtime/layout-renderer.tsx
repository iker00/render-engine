import type { LayoutNodeCollection } from '../config/runtime-config'
import { LayoutNodeRenderer } from './layout-node-renderer'

export interface LayoutRendererProps {
  nodes: LayoutNodeCollection
}

export function LayoutRenderer({ nodes }: LayoutRendererProps) {
  return (
    <>
      {nodes.map((node, index) => (
        <LayoutNodeRenderer
          key={node.id ?? `${node.type}-${index}`}
          node={node}
          renderedChildren={node.type === 'container' ? <LayoutRenderer nodes={node.children ?? []} /> : undefined}
        />
      ))}
    </>
  )
}
