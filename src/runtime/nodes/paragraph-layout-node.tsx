import type { ParagraphLayoutNode } from '../../config/runtime-config'
import { getParagraphNodeClassName } from '../runtime-node-styling'

interface ParagraphNodeProps {
  node: ParagraphLayoutNode
}

export function ParagraphNode({ node }: ParagraphNodeProps) {
  return (
    <p data-layout-node="paragraph" className={getParagraphNodeClassName()}>
      {node.props.text}
    </p>
  )
}
