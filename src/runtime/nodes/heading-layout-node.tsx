import type { HeadingLayoutNode } from '../../config/runtime-config'
import { getHeadingNodeClassName, getHeadingTag } from '../runtime-node-styling'

interface HeadingNodeProps {
  node: HeadingLayoutNode
}

export function HeadingNode({ node }: HeadingNodeProps) {
  const HeadingTag = getHeadingTag(node.props.level)

  return (
    <HeadingTag data-layout-node="heading" className={getHeadingNodeClassName(node.props.level)}>
      {node.props.text}
    </HeadingTag>
  )
}
