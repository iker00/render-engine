import { useEffect, useId, useState } from 'react'
import type { AccordionLayoutNode } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'
import { LayoutRenderer } from '../layout-renderer'
import { useAccordionGroup } from '../runtime-accordion-group'
import { useLayoutEditModeContext } from '../layout-edit-mode-context'
import type { LayoutNodePath } from '../layout-node-path'
import {
  getAccordionBodyAnimationClassName,
  getAccordionBodyClassName,
  getAccordionChevronClassName,
  getAccordionHeaderClassName,
} from '../runtime-node-styling'

interface AccordionNodeProps {
  node: AccordionLayoutNode
  iterationContext?: RuntimeIterationContext
  path?: LayoutNodePath
}

export function AccordionNode({ node, iterationContext, path }: AccordionNodeProps) {
  const state = useRuntimeState()
  const { label, defaultOpen = false, groupId } = node.props
  const instanceId = useId()
  const { getActiveInstanceId, claimDefaultOpen, openInGroup, closeInGroup } = useAccordionGroup()
  const editModeContext = useLayoutEditModeContext()
  const isEditMode = editModeContext !== null && editModeContext.active

  // Determine initial open state
  // For grouped accordions, the group context controls who starts open
  const [isOpen, setIsOpen] = useState(() => {
    if (!groupId) {
      return defaultOpen
    }

    if (defaultOpen) {
      return claimDefaultOpen(groupId, instanceId)
    }

    return false
  })
  const [isClosing, setIsClosing] = useState(false)

  // For grouped accordions, sync local state with the group context
  useEffect(() => {
    if (!groupId) return

    const activeId = getActiveInstanceId(groupId)

    if (activeId !== null && activeId !== instanceId && isOpen) {
      setIsOpen(false)
      setIsClosing(true)
    }

    if (activeId === instanceId && !isOpen) {
      setIsOpen(true)
      setIsClosing(false)
    }
  })

  const resolvedLabel = resolveRuntimeTextReference(
    label,
    state,
    `accordion[${node.id ?? ''}].props.label`,
    { iterationContext },
  )

  const handleToggle = () => {
    if (groupId) {
      if (isOpen) {
        closeInGroup(groupId)
        setIsOpen(false)
        setIsClosing(true)
      } else {
        openInGroup(groupId, instanceId)
        setIsOpen(true)
        setIsClosing(false)
      }
    } else {
      if (isOpen) {
        setIsOpen(false)
        setIsClosing(true)
      } else {
        setIsOpen(true)
        setIsClosing(false)
      }
    }
  }

  const showContent = isEditMode || isOpen || isClosing

  return (
    <div data-layout-node="accordion">
      <button
        type="button"
        data-layout-node="accordion-header"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className={getAccordionHeaderClassName()}
      >
        <span>{resolvedLabel}</span>
        <svg
          data-layout-node="accordion-chevron"
          aria-hidden="true"
          className={getAccordionChevronClassName(isOpen)}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {showContent && (
        <div
          data-layout-node="accordion-body"
          className={getAccordionBodyAnimationClassName(isEditMode || isOpen)}
          onAnimationEnd={() => {
            if (!isOpen) setIsClosing(false)
          }}
        >
          {node.children && node.children.length > 0 ? (
            <div className={getAccordionBodyClassName()}>
              <LayoutRenderer nodes={node.children} iterationContext={iterationContext} path={path} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
