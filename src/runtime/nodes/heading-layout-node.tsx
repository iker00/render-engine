import type { HeadingLayoutNode } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import { getHeadingNodeClassName, getHeadingTag } from '../runtime-node-styling'
import { IconNode } from './icon-node'

interface HeadingNodeProps {
  node: HeadingLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function HeadingNode({ node, iterationContext }: HeadingNodeProps) {
  const state = useRuntimeState()
  const text = resolveRuntimeTextReference(node.props.text, state, 'heading.props.text', { iterationContext })
  const Tag = getHeadingTag(node.props.level)
  return (
    <Tag data-layout-node="heading" className={getHeadingNodeClassName(node.props.level)}>
      <IconNode name={node.props.icon} className="size-[1em] shrink-0 inline-block align-middle mr-2" />
      {text}
    </Tag>
  )
}
