import type { KeyboardEvent } from 'react'
import { useRef } from 'react'
import type { NodePanelTab, NodePanelTabKey } from './node-panel-tabs'

interface NodePanelTabBarProps {
  tabs: NodePanelTab[]
  activeKey: NodePanelTabKey
  onSelectTab: (key: NodePanelTabKey) => void
  idPrefix: string
}

/**
 * Presentational tab bar for the node properties panel (FR1/FR9). Implements the ARIA
 * `tablist`/`tab` pattern (as opposed to `radiogroup`/`radio`, used by
 * `SegmentedTogglePropertyField`) since these tabs each control a distinct panel section rather
 * than a single value.
 *
 * `onSelectTab` fires only when the user picks a tab different from `activeKey` — clicking the
 * already-active tab is a no-op. The component owns no active-tab state of its own; it renders
 * whatever `activeKey` says (the panel, in T4, owns that state).
 *
 * Keyboard: `ArrowRight`/`ArrowLeft` move focus to the adjacent tab and immediately call
 * `onSelectTab` for it (activation follows focus), wrapping at both edges — same pattern as
 * `SegmentedTogglePropertyField`. Roving tabindex: only the active tab is a `Tab` stop.
 */
export function NodePanelTabBar({ tabs, activeKey, onSelectTab, idPrefix }: NodePanelTabBarProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  function selectTab(key: NodePanelTabKey) {
    if (key === activeKey) return
    onSelectTab(key)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()

    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (index + direction + tabs.length) % tabs.length

    buttonRefs.current[nextIndex]?.focus()
    selectTab(tabs[nextIndex].key)
  }

  return (
    <div role="tablist" aria-label="Secciones del nodo" className="flex items-center gap-4 border-b border-gray-200">
      {tabs.map((tab, index) => {
        const isActive = tab.key === activeKey

        return (
          <button
            key={tab.key}
            ref={(node) => {
              buttonRefs.current[index] = node
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.key}`}
            aria-controls={`${idPrefix}-panel-${tab.key}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => selectTab(tab.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={
              isActive
                ? 'border-b-2 border-gray-800 px-1 py-2 text-sm font-medium text-gray-900'
                : 'border-b-2 border-transparent px-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700'
            }
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
