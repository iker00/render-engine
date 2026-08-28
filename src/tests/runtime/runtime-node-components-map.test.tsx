import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { NodeComponents } from '../../runtime/nodes/node-components-map'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

const minimalConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <RuntimeStateProvider config={minimalConfig}>{children}</RuntimeStateProvider>
}

const EXPECTED_KEYS = [
  'accordion',
  'alert',
  'autocomplete',
  'badge',
  'button',
  'checkboxGroup',
  'container',
  'divider',
  'fileInput',
  'fileManager',
  'form',
  'gallery',
  'heading',
  'hidden',
  'image',
  'input',
  'link',
  'list',
  'map',
  'modal',
  'paragraph',
  'radioGroup',
  'repeater',
  'select',
  'skeleton',
  'stat',
  'steps',
  'table',
  'tabs',
  'textarea',
  'toggle',
]

describe('NodeComponents map', () => {
  it('exports exactly 31 keys — no missing, no extra', () => {
    const keys = Object.keys(NodeComponents).sort()
    expect(keys).toEqual([...EXPECTED_KEYS].sort())
    expect(keys).toHaveLength(31)
  })

  it('each value in the map is truthy (not undefined)', () => {
    for (const key of Object.keys(NodeComponents)) {
      expect(
        NodeComponents[key as keyof typeof NodeComponents],
        `NodeComponents.${key} should be truthy`,
      ).toBeTruthy()
    }
  })

  it('NodeComponents.container renders synchronously in the first render (eager branch active)', () => {
    const Container = NodeComponents.container
    const { container } = render(
      <Wrapper>
        <Container node={{ type: 'container' }} />
      </Wrapper>,
    )
    // Must be present synchronously — no findBy* or waitFor needed
    expect(container.querySelector('[data-layout-node="container"]')).toBeInTheDocument()
  })

  it('NodeComponents.heading renders synchronously with a simple text', () => {
    const Heading = NodeComponents.heading
    render(
      <Wrapper>
        <Heading node={{ type: 'heading', props: { text: 'Eager heading', level: 2 } }} />
      </Wrapper>,
    )
    // getByRole throws synchronously if the element is not in the DOM yet
    expect(screen.getByRole('heading', { name: 'Eager heading' })).toBeInTheDocument()
  })

  it('NodeComponents.divider renders synchronously', () => {
    const Divider = NodeComponents.divider
    const { container } = render(
      <Wrapper>
        <Divider node={{ type: 'divider' }} />
      </Wrapper>,
    )
    expect(container.querySelector('[data-layout-node="divider"]')).toBeInTheDocument()
  })
})
