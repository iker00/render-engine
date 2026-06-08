import { useEffect, useId, useState } from 'react'
import type { AccordionLayoutNode } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'
import { LayoutRenderer } from '../layout-renderer'
import { useAccordionGroup } from '../runtime-accordion-group'

interface AccordionNodeProps {
  node: AccordionLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function AccordionNode({ node, iterationContext }: AccordionNodeProps) {
  const state = useRuntimeState()
  const { label, defaultOpen = false, groupId } = node.props
  const instanceId = useId()
  const { getActiveInstanceId, claimDefaultOpen, openInGroup, closeInGroup } = useAccordionGroup()

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

  const showContent = isOpen || isClosing

  return (
    <div data-layout-node="accordion">
      <button
        type="button"
        data-layout-node="accordion-header"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="w-full text-left px-4 py-2 font-semibold flex items-center justify-between bg-app-accent/10 hover:bg-app-accent/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
      >
        <span>{resolvedLabel}</span>
        <svg
          data-layout-node="accordion-chevron"
          aria-hidden="true"
          className={`h-4 w-4 text-app-accent transition-transform duration-200 ease-out${isOpen ? ' rotate-180' : ''}`}
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
          className={isOpen ? 'animate-accordion-open' : 'animate-accordion-close'}
          onAnimationEnd={() => {
            if (!isOpen) setIsClosing(false)
          }}
        >
          {node.children && node.children.length > 0 ? (
            <div className="px-4 py-2">
              <LayoutRenderer nodes={node.children} iterationContext={iterationContext} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
