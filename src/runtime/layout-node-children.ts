import type { LayoutNode, LayoutNodeCollection } from '../config/runtime-config'

export type EmptyPlaceholderNodeType = 'container' | 'form' | 'link'

export function hasChildren(node: LayoutNode): node is Extract<LayoutNode, { children?: LayoutNodeCollection }> {
  return node.type === 'container' || node.type === 'form' || node.type === 'modal' || node.type === 'link'
}

export function isEmptyPlaceholderCandidate(
  node: Extract<LayoutNode, { children?: LayoutNodeCollection }>,
): node is Extract<LayoutNode, { type: EmptyPlaceholderNodeType }> {
  return (
    (node.type === 'container' || node.type === 'form' || node.type === 'link') && (node.children ?? []).length === 0
  )
}
