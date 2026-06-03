import { useState } from 'react'
import type { TabsLayoutNode } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'
import { LayoutRenderer } from '../layout-renderer'

interface TabsNodeProps {
  node: TabsLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function TabsNode({ node, iterationContext }: TabsNodeProps) {
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
}

function TabsNodeContent({ node, items, orientation, defaultTab, state, iterationContext }: TabsNodeContentProps) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  const isVertical = orientation === 'vertical'

  const rootClassName = isVertical ? 'flex flex-row' : 'flex flex-col'

  const bar = (
    <div
      data-layout-node="tabs-bar"
      role="tablist"
      className={isVertical ? 'flex flex-col' : 'flex flex-row'}
    >
      {items.map((item, index) => {
        const resolvedLabel = resolveRuntimeTextReference(
          item.label,
          state,
          `tabs[${node.id ?? ''}].props.items[${index}].label`,
          { iterationContext },
        )
        const isActive = index === activeTab
        return (
          <button
            key={index}
            type="button"
            aria-selected={isActive}
            onClick={() => setActiveTab(index)}
            className={
              isActive
                ? 'border-b-2 border-blue-600 font-semibold px-4 py-2'
                : 'px-4 py-2 text-gray-600 hover:text-gray-900'
            }
          >
            {resolvedLabel}
          </button>
        )
      })}
    </div>
  )

  const activeItem = items[activeTab]
  const panel = (
    <div data-layout-node="tabs-panel" className="flex-1">
      {activeItem?.children && activeItem.children.length > 0 ? (
        <LayoutRenderer nodes={activeItem.children} iterationContext={iterationContext} />
      ) : null}
    </div>
  )

  return (
    <div data-layout-node="tabs" className={rootClassName}>
      {bar}
      {panel}
    </div>
  )
}
