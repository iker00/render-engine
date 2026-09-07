import { createElement, useContext } from 'react'
import type { HeadingLayoutNode } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/use-runtime-state'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import { RuntimeGroupContextProvider } from '../runtime-references/runtime-group-context'
import { getHeadingNodeClassName, getHeadingTag } from '../runtime-node-styling'
import { IconNode } from './icon-node'

interface HeadingNodeProps {
  node: HeadingLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function HeadingNode({ node, iterationContext }: HeadingNodeProps) {
  const state = useRuntimeState()
  // `group.*` (T12 / feature reusable-node-groups): see paragraph-layout-node.tsx for why this
  // reads via React context instead of prop drilling.
  const groupContext = useContext(RuntimeGroupContextProvider)
  const text = resolveRuntimeTextReference(node.props.text, state, 'heading.props.text', {
    iterationContext,
    groupContext,
  })
  // The heading level maps to a plain host tag ('h1'..'h6'), not a component — built with
  // createElement (not JSX's `<Tag>` shorthand) so the React Compiler doesn't mistake this
  // dynamic-but-stable host tag for a component being freshly declared on every render.
  return createElement(
    getHeadingTag(node.props.level),
    { 'data-layout-node': 'heading', className: getHeadingNodeClassName(node.props.level) },
    <IconNode key="icon" name={node.props.icon} className="size-[1em] shrink-0 inline-block align-middle mr-2" />,
    text,
  )
}
