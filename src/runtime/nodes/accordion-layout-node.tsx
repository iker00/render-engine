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
      // Try to claim the group as the default-open accordion
      return claimDefaultOpen(groupId, instanceId)
    }

    return false
  })

  // For grouped accordions, sync local state with the group context
  useEffect(() => {
    if (!groupId) return

    const activeId = getActiveInstanceId(groupId)

    // If the group has an active accordion and it's not this one, close this one
    if (activeId !== null && activeId !== instanceId && isOpen) {
      setIsOpen(false)
    }

    // If this accordion is the active one in the group but not locally open, open it
    if (activeId === instanceId && !isOpen) {
      setIsOpen(true)
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
      } else {
        openInGroup(groupId, instanceId)
        setIsOpen(true)
      }
    } else {
      setIsOpen((prev) => !prev)
    }
  }

  return (
    <div data-layout-node="accordion">
      <button
        type="button"
        data-layout-node="accordion-header"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="w-full text-left px-4 py-2 font-semibold bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {resolvedLabel}
      </button>
      {isOpen && (
        <div data-layout-node="accordion-body" className="px-4 py-2">
          {node.children && node.children.length > 0 ? (
            <LayoutRenderer nodes={node.children} iterationContext={iterationContext} />
          ) : null}
        </div>
      )}
    </div>
  )
}
