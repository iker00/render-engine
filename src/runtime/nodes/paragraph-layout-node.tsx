import type { ParagraphLayoutNode } from '../../config/runtime-config'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import { getParagraphNodeClassName } from '../runtime-node-styling'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'

interface ParagraphNodeProps {
  node: ParagraphLayoutNode
}

export function ParagraphNode({ node }: ParagraphNodeProps) {
  const state = useRuntimeState()
  const text = resolveRuntimeTextReference(node.props.text, state, 'paragraph.props.text')

  return (
    <p data-layout-node="paragraph" className={getParagraphNodeClassName()}>
      {text}
    </p>
  )
}
