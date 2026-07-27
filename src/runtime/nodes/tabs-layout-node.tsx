import { useState } from 'react'
import type { TabsLayoutNode } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/use-runtime-state'
import { LayoutRenderer } from '../layout-renderer'
import { matchesVisibilityRule } from '../runtime-layout-visibility'
import type { LayoutNodePath } from '../layout-node-path'
import {
  getTabsBarClassName,
  getTabsButtonClassName,
  getTabsPanelClassName,
  getTabsRootClassName,
} from '../runtime-node-styling'

interface TabsNodeProps {
  node: TabsLayoutNode
  iterationContext?: RuntimeIterationContext
  path?: LayoutNodePath
}

export function TabsNode({ node, iterationContext, path }: TabsNodeProps) {
  const state = useRuntimeState()
  const { items, orientation = 'horizontal', defaultTab = 0 } = node.props

  if (!items || items.length === 0) {
    return null
  }

  const safeDefaultTab = defaultTab >= 0 && defaultTab < items.length ? defaultTab : 0

  return (
    <TabsNodeContent
      node={node}
      items={items}
      orientation={orientation}
      defaultTab={safeDefaultTab}
      state={state}
      iterationContext={iterationContext}
      path={path}
    />
  )
}

interface TabsNodeContentProps {
  node: TabsLayoutNode
  items: TabsLayoutNode['props']['items']
  orientation: 'horizontal' | 'vertical'
  defaultTab: number
  state: ReturnType<typeof useRuntimeState>
  iterationContext?: RuntimeIterationContext
  path?: LayoutNodePath
}

function TabsNodeContent({ node, items, orientation, defaultTab, state, iterationContext, path }: TabsNodeContentProps) {
  // Compute visible indices using the original array indices
  const visibleIndices = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => matchesVisibilityRule(item.visibility, state, iterationContext))
    .map(({ index }) => index)

  // Initialize with lazy state: respect defaultTab if visible, otherwise use first visible
  const [activeTab, setActiveTab] = useState(() =>
    visibleIndices.includes(defaultTab) ? defaultTab : (visibleIndices[0] ?? 0),
  )

  // If no visible tabs, render nothing
  if (visibleIndices.length === 0) {
    return null
  }

  // "Adjusting state during render" pattern: correct activeTab if it is no longer visible
  let effectiveActiveTab = activeTab
  if (!visibleIndices.includes(activeTab)) {
    effectiveActiveTab = visibleIndices[0]
    setActiveTab(effectiveActiveTab)
  }

  const bar = (
    <div
      data-layout-node="tabs-bar"
      role="tablist"
      className={getTabsBarClassName(orientation)}
    >
      {visibleIndices.map((index) => {
        const item = items[index]
        const resolvedLabel = resolveRuntimeTextReference(
          item.label,
          state,
          `tabs[${node.id ?? ''}].props.items[${index}].label`,
          { iterationContext },
        )
        const isActive = index === effectiveActiveTab
        return (
          <button
            key={index}
            type="button"
            aria-selected={isActive}
            onClick={() => setActiveTab(index)}
            className={getTabsButtonClassName(isActive, orientation)}
          >
            {resolvedLabel}
          </button>
        )
      })}
    </div>
  )

  const activeItem = items[effectiveActiveTab]
  const basePath = path ?? []
  const panel = (
    <div data-layout-node="tabs-panel" className={getTabsPanelClassName()}>
      {activeItem?.children && activeItem.children.length > 0 ? (
        <LayoutRenderer
          nodes={activeItem.children}
          iterationContext={iterationContext}
          path={basePath}
          parentTabItemIndex={effectiveActiveTab}
          buildChildPath={(index) => [...basePath, { field: 'tabItem', itemIndex: effectiveActiveTab, index }]}
        />
      ) : null}
    </div>
  )

  return (
    <div data-layout-node="tabs" className={getTabsRootClassName(orientation)}>
      {bar}
      {panel}
    </div>
  )
}
