import type { HeadingLayoutNode } from '../../config/runtime-config'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import { getHeadingNodeClassName, getHeadingTag } from '../runtime-node-styling'

interface HeadingNodeProps {
  node: HeadingLayoutNode
}

export function HeadingNode({ node }: HeadingNodeProps) {
  const HeadingTag = getHeadingTag(node.props.level)
  const state = useRuntimeState()
  const text = resolveRuntimeTextReference(node.props.text, state, 'heading.props.text')

  return (
    <HeadingTag data-layout-node="heading" className={getHeadingNodeClassName(node.props.level)}>
      {text}
    </HeadingTag>
  )
}
