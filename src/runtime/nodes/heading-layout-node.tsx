import { createElement } from 'react'
import type { HeadingLayoutNode } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import { getHeadingNodeClassName, getHeadingTag } from '../runtime-node-styling'

interface HeadingNodeProps {
  node: HeadingLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function HeadingNode({ node, iterationContext }: HeadingNodeProps) {
  const state = useRuntimeState()
  const text = resolveRuntimeTextReference(node.props.text, state, 'heading.props.text', { iterationContext })
  return createElement(
    getHeadingTag(node.props.level),
    {
      'data-layout-node': 'heading',
      className: getHeadingNodeClassName(node.props.level),
    },
    text,
  )
}
