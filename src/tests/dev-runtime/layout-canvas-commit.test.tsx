import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock @monaco-editor/react with a controllable textarea, matching the pattern
// already established in dev-runtime.test.tsx.
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ value, onChange, onMount }) => {
    if (onMount) {
      onMount(
        { getValue: () => value as string },
        { languages: { json: { jsonDefaults: { setDiagnosticsOptions: vi.fn() } } } },
      )
    }
    return (
      <textarea
        data-testid="monaco-editor-mock"
        value={value as string}
        onChange={(e) => (onChange as (v: string) => void)?.(e.target.value)}
      />
    )
  }),
}))

import {
  buildCommitCandidateConfig,
  denormalizeFormNodesForSerialization,
  patchRawConfigTextWithLayout,
  patchRootKey,
} from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import {
  DevRuntimeReady,
  type CommitCanvasMutationResult,
  type DevRuntimeReadyHandle,
} from '../../dev-runtime/dev-runtime'
import { triggerActiveConfigHmrApplyForTests } from '../../dev-runtime/dev-runtime-hmr-bridge'
import * as dyeRuntimeStateMigrationModule from '../../dev-runtime/dev-runtime-state-migration'
import { validateRuntimeConfig } from '../../config/runtime-config'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'

function heading(text: string): LayoutNode {
  return { type: 'heading', props: { text, level: 2 } }
}

function inputNode(fieldId: string): LayoutNode {
  return { type: 'input', props: { fieldId, label: fieldId } }
}

function container(children: LayoutNode[] = []): LayoutNode {
  return { type: 'container', children }
}

function plainForm(id: string, children: LayoutNode[] = []): LayoutNode {
  return { type: 'form', id, children } as LayoutNode
}

// Normalized shape (matches `FormLayoutNode`: onSuccess/onError are sibling
// fields of submitAction, not nested inside it). Used to exercise
// `denormalizeFormNodesForSerialization` directly, which operates on
// already-normalized LayoutNode trees (the shape `currentConfig` holds).
function formWithOnSuccessOnError(id: string, children: LayoutNode[] = []): LayoutNode {
  return {
    type: 'form',
    id,
    submitAction: { type: 'executeOperation', operationName: 'doThing' },
    onSuccess: [{ type: 'goBack' }],
    onError: [{ type: 'goBack' }],
    children,
  } as LayoutNode
}

// Raw crude shape (matches what a user types in Monaco / what
// validateRuntimeConfig expects as input): onSuccess/onError nested inside
// submitAction. Used to build fixture configs fed to validateRuntimeConfig.
function rawFormWithOnSuccessOnError(id: string, children: LayoutNode[] = []): unknown {
  return {
    type: 'form',
    id,
    submitAction: {
      type: 'executeOperation',
      operationName: 'doThing',
      onSuccess: [{ type: 'goBack' }],
      onError: [{ type: 'goBack' }],
    },
    children,
  }
}

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('buildCommitCandidateConfig', () => {
  function makeConfig(): RuntimeConfig {
    return {
      api: { doThing: { method: 'POST', endpoint: '/thing' } },
      pages: [
        { id: 'home', layout: [heading('Home')] },
        { id: 'about', layout: [heading('About')] },
      ],
      initialPage: 'home',
      translations: { es: { hello: 'Hola' } },
      tokens: { authToken: { value: 'abc' } },
    } as RuntimeConfig
  }

  it('replaces only the layout of the targeted page, leaving the rest of the document intact and not mutating currentConfig', () => {
    const original = makeConfig()
    const snapshot = JSON.parse(JSON.stringify(original))

    const result = buildCommitCandidateConfig(original, 'home', () => [heading('Updated Home')])

    expect(original).toEqual(snapshot)
    expect(result).not.toBe(original)
    expect(result.pages.find((page) => page.id === 'home')?.layout).toEqual([heading('Updated Home')])
    expect(result.pages.find((page) => page.id === 'about')).toBe(
      original.pages.find((page) => page.id === 'about'),
    )
    expect(result.api).toBe(original.api)
    expect(result.initialPage).toBe(original.initialPage)
    expect(result.translations).toBe(original.translations)
    expect(result.tokens).toBe(original.tokens)
  })
})

describe('denormalizeFormNodesForSerialization', () => {
  it('nests onSuccess/onError back inside submitAction for a top-level form node, without top-level onSuccess/onError in the result', () => {
    const [result] = denormalizeFormNodesForSerialization([formWithOnSuccessOnError('user-form')]) as Array<
      Record<string, unknown>
    >

    expect(result).not.toHaveProperty('onSuccess')
    expect(result).not.toHaveProperty('onError')
    expect(result.submitAction).toEqual({
      type: 'executeOperation',
      operationName: 'doThing',
      onSuccess: [{ type: 'goBack' }],
      onError: [{ type: 'goBack' }],
    })
  })

  it('leaves a form without onSuccess/onError unchanged (identity pass)', () => {
    const nodes = [plainForm('plain-form', [heading('Inside')])]
    const [result] = denormalizeFormNodesForSerialization(nodes)
    expect(result).toEqual(nodes[0])
  })

  it('denormalizes a form nested inside a container', () => {
    const nodes = [container([formWithOnSuccessOnError('nested-form')])]
    const [result] = denormalizeFormNodesForSerialization(nodes) as [
      { children: Array<Record<string, unknown>> },
    ]

    expect(result.children[0]).not.toHaveProperty('onSuccess')
    expect((result.children[0].submitAction as { onSuccess: unknown }).onSuccess).toEqual([{ type: 'goBack' }])
  })

  it('denormalizes a form directly inside modal.children', () => {
    const nodes: LayoutNode[] = [
      { type: 'modal', id: 'my-modal', children: [formWithOnSuccessOnError('modal-form')] } as LayoutNode,
    ]
    const [result] = denormalizeFormNodesForSerialization(nodes) as [
      { children: Array<Record<string, unknown>> },
    ]

    expect(result.children[0]).not.toHaveProperty('onSuccess')
  })

  it('denormalizes a form inside repeater.props.template', () => {
    const nodes: LayoutNode[] = [
      {
        type: 'repeater',
        props: { items: { source: 'queries.list', key: 'id' }, template: [formWithOnSuccessOnError('template-form')] },
      } as LayoutNode,
    ]
    const [result] = denormalizeFormNodesForSerialization(nodes) as [
      { props: { template: Array<Record<string, unknown>> } },
    ]

    expect(result.props.template[0]).not.toHaveProperty('onSuccess')
  })

  it('denormalizes a form inside tabs.props.items[].children', () => {
    const nodes: LayoutNode[] = [
      {
        type: 'tabs',
        props: { items: [{ label: 'Tab 1', children: [formWithOnSuccessOnError('tab-form')] }] },
      } as LayoutNode,
    ]
    const [result] = denormalizeFormNodesForSerialization(nodes) as [
      { props: { items: Array<{ children: Array<Record<string, unknown>> }> } },
    ]

    expect(result.props.items[0].children[0]).not.toHaveProperty('onSuccess')
  })
})

describe('patchRawConfigTextWithLayout', () => {
  const rawConfig = {
    api: { loadUsers: { method: 'GET', endpoint: '/users' } },
    pages: [
      { id: 'home', preloads: [{ loadUsers: {} }], title: 'Home title', layout: [heading('Old')] },
      { id: 'about', layout: [heading('About')] },
    ],
    initialPage: 'home',
    tokens: { authToken: { value: 'xyz' } },
  }
  const rawText = JSON.stringify(rawConfig, null, 2)

  it('preserves preloads in raw crude form while replacing layout', () => {
    const nextText = patchRawConfigTextWithLayout(rawText, 'home', [heading('New')])
    const parsed = JSON.parse(nextText)

    expect(parsed.pages[0].preloads).toEqual([{ loadUsers: {} }])
    expect(parsed.pages[0].layout).toEqual([{ type: 'heading', props: { text: 'New', level: 2 } }])
    expect(parsed.pages[0].title).toBe('Home title')
  })

  it('does not modify any other page or the api/tokens/initialPage blocks', () => {
    const nextText = patchRawConfigTextWithLayout(rawText, 'home', [heading('New')])
    const parsed = JSON.parse(nextText)

    expect(parsed.pages[1]).toEqual(rawConfig.pages[1])
    expect(parsed.api).toEqual(rawConfig.api)
    expect(parsed.tokens).toEqual(rawConfig.tokens)
    expect(parsed.initialPage).toBe(rawConfig.initialPage)
  })
})

describe('patchRootKey', () => {
  const rawConfig = {
    api: { loadUsers: { method: 'GET', endpoint: '/users' } },
    pages: [{ id: 'home', layout: [heading('Old')] }],
    initialPage: 'home',
    tokens: { authToken: { value: 'xyz' } },
    shell: { header: { title: 'Old title' } },
  }
  const rawText = JSON.stringify(rawConfig, null, 2)

  it('replaces the given root key with the provided value, leaving every other root key untouched', () => {
    const nextText = patchRootKey(rawText, 'shell', { header: { title: 'New title' } })
    const parsed = JSON.parse(nextText)

    expect(parsed.shell).toEqual({ header: { title: 'New title' } })
    expect(parsed.api).toEqual(rawConfig.api)
    expect(parsed.pages).toEqual(rawConfig.pages)
    expect(parsed.tokens).toEqual(rawConfig.tokens)
    expect(parsed.initialPage).toBe(rawConfig.initialPage)
  })

  it('removes the key entirely when value is undefined, instead of writing a literal null/undefined', () => {
    const nextText = patchRootKey(rawText, 'shell', undefined)
    const parsed = JSON.parse(nextText)

    expect('shell' in parsed).toBe(false)
    expect(parsed.api).toEqual(rawConfig.api)
    expect(parsed.pages).toEqual(rawConfig.pages)
  })

  it('adds a root key that was not present in the original text', () => {
    const rawTextWithoutShell = JSON.stringify(
      { api: rawConfig.api, pages: rawConfig.pages, initialPage: rawConfig.initialPage },
      null,
      2,
    )

    const nextText = patchRootKey(rawTextWithoutShell, 'shell', { header: {} })
    const parsed = JSON.parse(nextText)

    expect(parsed.shell).toEqual({ header: {} })
  })
})

function buildReadyProps(rawConfig: unknown): { initialConfig: RuntimeConfig; initialConfigText: string } {
  const initialConfigText = JSON.stringify(rawConfig, null, 2)
  const validation = validateRuntimeConfig(rawConfig)
  if (validation.status !== 'ready') {
    throw new Error(`Fixture config failed to validate: ${validation.error.message}`)
  }
  return { initialConfig: validation.config, initialConfigText }
}

// The drawer/toggle are retired (0103, T8): the Monaco panel is now opened from the floating
// toolbar's dedicated control and lives in FloatingMonacoPanel instead of DevRuntimeDrawer.
function openDrawer() {
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))
}

async function getMonacoValue(): Promise<string> {
  await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())
  return (screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value
}

describe('commitCanvasMutation via DevRuntimeReady', () => {
  const configWithPreloads = {
    api: { loadUsers: { method: 'GET', endpoint: '/users' } },
    pages: [
      {
        id: 'home',
        preloads: [{ loadUsers: {} }],
        layout: [heading('Original')],
      },
    ],
    initialPage: 'home',
  }

  it('updates currentConfig and patches editorBuffer (not a full reserialization); preloads stay raw and the result re-validates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createJsonResponse({})))

    const ref = createRef<DevRuntimeReadyHandle>()
    const { initialConfig, initialConfigText } = buildReadyProps(configWithPreloads)
    render(<DevRuntimeReady ref={ref} initialConfig={initialConfig} initialConfigText={initialConfigText} />)

    expect(screen.getByText('Original')).toBeInTheDocument()

    let result: CommitCanvasMutationResult | undefined
    act(() => {
      result = ref.current?.commitCanvasMutation((layout) => [...layout, heading('Added by canvas')])
    })

    expect(result).toEqual({ status: 'applied' })
    expect(screen.getByText('Added by canvas')).toBeInTheDocument()

    openDrawer()
    const editorText = await getMonacoValue()
    const parsedEditorConfig = JSON.parse(editorText)

    expect(parsedEditorConfig.pages[0].preloads).toEqual([{ loadUsers: {} }])
    expect(validateRuntimeConfig(parsedEditorConfig).status).toBe('ready')
  })

  it('preserves onSuccess/onError (nested in submitAction) for a form outside the mutated subtree', async () => {
    const config = {
      api: { doThing: { method: 'POST', endpoint: '/thing' } },
      pages: [
        {
          id: 'home',
          layout: [rawFormWithOnSuccessOnError('untouched-form'), heading('Section')],
        },
      ],
      initialPage: 'home',
    }

    const ref = createRef<DevRuntimeReadyHandle>()
    const { initialConfig, initialConfigText } = buildReadyProps(config)
    render(<DevRuntimeReady ref={ref} initialConfig={initialConfig} initialConfigText={initialConfigText} />)

    let result: CommitCanvasMutationResult | undefined
    act(() => {
      // Mutation only appends a node; it never touches "untouched-form".
      result = ref.current?.commitCanvasMutation((layout) => [...layout, heading('Added')])
    })
    expect(result).toEqual({ status: 'applied' })

    openDrawer()
    const parsed = JSON.parse(await getMonacoValue())
    const untouchedForm = parsed.pages[0].layout.find((node: { id?: string }) => node.id === 'untouched-form')

    expect(untouchedForm).not.toHaveProperty('onSuccess')
    expect(untouchedForm).not.toHaveProperty('onError')
    expect(untouchedForm.submitAction).toEqual({
      type: 'executeOperation',
      operationName: 'doThing',
      onSuccess: [{ type: 'goBack' }],
      onError: [{ type: 'goBack' }],
    })
  })

  it('rejects an invalid mutation (input outside a form) without touching currentConfig or editorBuffer', async () => {
    const config = { api: {}, pages: [{ id: 'home', layout: [heading('Original')] }], initialPage: 'home' }
    const ref = createRef<DevRuntimeReadyHandle>()
    const { initialConfig, initialConfigText } = buildReadyProps(config)
    render(<DevRuntimeReady ref={ref} initialConfig={initialConfig} initialConfigText={initialConfigText} />)

    let result: CommitCanvasMutationResult | undefined
    act(() => {
      result = ref.current?.commitCanvasMutation((layout) => [...layout, inputNode('stray-field')])
    })

    expect(result?.status).toBe('rejected')
    expect(screen.queryByText('stray-field')).not.toBeInTheDocument()
    expect(screen.getByText('Original')).toBeInTheDocument()

    openDrawer()
    const editorText = await getMonacoValue()
    expect(editorText).toBe(initialConfigText)
  })

  it('overwrites pending unapplied Monaco edits and clears hasPendingChanges', async () => {
    const config = { api: {}, pages: [{ id: 'home', layout: [heading('Original')] }], initialPage: 'home' }
    const ref = createRef<DevRuntimeReadyHandle>()
    const { initialConfig, initialConfigText } = buildReadyProps(config)
    render(<DevRuntimeReady ref={ref} initialConfig={initialConfig} initialConfigText={initialConfigText} />)

    openDrawer()
    await getMonacoValue()
    fireEvent.change(screen.getByTestId('monaco-editor-mock'), { target: { value: 'not applied yet' } })
    expect(screen.getByTestId('dev-editor-floating-monaco-pending-indicator')).toBeInTheDocument()

    act(() => {
      ref.current?.commitCanvasMutation((layout) => [...layout, heading('Added by canvas')])
    })

    expect(screen.queryByTestId('dev-editor-floating-monaco-pending-indicator')).not.toBeInTheDocument()
    const editorText = (screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value
    expect(editorText).not.toBe('not applied yet')
    expect(JSON.parse(editorText).pages[0].layout).toEqual([heading('Original'), heading('Added by canvas')])
  })

  it('activates the beforeunload guard (hasAppliedChanges) after a successful commit, same as Aplicar', async () => {
    const addEventSpy = vi.spyOn(window, 'addEventListener')
    const config = { api: {}, pages: [{ id: 'home', layout: [heading('Original')] }], initialPage: 'home' }
    const ref = createRef<DevRuntimeReadyHandle>()
    const { initialConfig, initialConfigText } = buildReadyProps(config)
    render(<DevRuntimeReady ref={ref} initialConfig={initialConfig} initialConfigText={initialConfigText} />)

    act(() => {
      ref.current?.commitCanvasMutation((layout) => [...layout, heading('Added by canvas')])
    })

    await waitFor(() => {
      expect(addEventSpy.mock.calls.some(([eventName]) => eventName === 'beforeunload')).toBe(true)
    })
  })

  it('calls migrateRuntimeStateAcrossConfig with the expected arguments (smoke test)', async () => {
    const migrateSpy = vi.spyOn(dyeRuntimeStateMigrationModule, 'migrateRuntimeStateAcrossConfig')
    const config = { api: {}, pages: [{ id: 'home', layout: [heading('Original')] }], initialPage: 'home' }
    const ref = createRef<DevRuntimeReadyHandle>()
    const { initialConfig, initialConfigText } = buildReadyProps(config)
    render(<DevRuntimeReady ref={ref} initialConfig={initialConfig} initialConfigText={initialConfigText} />)

    act(() => {
      ref.current?.commitCanvasMutation((layout) => [...layout, heading('Added by canvas')])
    })

    await waitFor(() => expect(migrateSpy).toHaveBeenCalled())
    const [prevState, prevConfig, nextConfig] = migrateSpy.mock.calls[0]
    expect(prevState).toBeDefined()
    expect(prevConfig).toEqual(initialConfig)
    expect(nextConfig.pages[0].layout).toEqual([heading('Original'), heading('Added by canvas')])
  })

  it('keeps lastValidConfigText in sync with the text just applied via a manual Aplicar (regression)', async () => {
    const config = { api: {}, pages: [{ id: 'home', layout: [heading('Original')] }], initialPage: 'home' }
    const appliedConfig = {
      api: {},
      pages: [{ id: 'home', title: 'applied-title', layout: [heading('Applied')] }],
      initialPage: 'home',
    }

    const ref = createRef<DevRuntimeReadyHandle>()
    const { initialConfig, initialConfigText } = buildReadyProps(config)
    render(<DevRuntimeReady ref={ref} initialConfig={initialConfig} initialConfigText={initialConfigText} />)

    openDrawer()
    await getMonacoValue()
    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: JSON.stringify(appliedConfig, null, 2) },
    })
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))
    await waitFor(() => expect(screen.getByText('Applied')).toBeInTheDocument())

    act(() => {
      ref.current?.commitCanvasMutation((layout) => [...layout, heading('Added by canvas')])
    })

    const editorText = (screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value
    expect(JSON.parse(editorText).pages[0].title).toBe('applied-title')
  })

  it('updates lastValidConfigText unconditionally on a valid HMR apply, even while editorBuffer keeps a pending edit', async () => {
    const v1Config = { api: {}, pages: [{ id: 'home', title: 'v1-title', layout: [heading('From V1')] }], initialPage: 'home' }
    const v2Config = { api: {}, pages: [{ id: 'home', title: 'v2-title', layout: [heading('From V2')] }], initialPage: 'home' }

    const ref = createRef<DevRuntimeReadyHandle>()
    const { initialConfig, initialConfigText } = buildReadyProps(v1Config)
    render(<DevRuntimeReady ref={ref} initialConfig={initialConfig} initialConfigText={initialConfigText} />)

    openDrawer()
    await getMonacoValue()
    fireEvent.change(screen.getByTestId('monaco-editor-mock'), { target: { value: 'pending edit' } })
    expect(screen.getByTestId('dev-editor-floating-monaco-pending-indicator')).toBeInTheDocument()

    act(() => {
      triggerActiveConfigHmrApplyForTests(v2Config)
    })

    // editorBuffer is untouched while there is a pending edit...
    expect((screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value).toBe('pending edit')
    // ...but currentConfig did update to v2.
    expect(screen.getByText('From V2')).toBeInTheDocument()

    // A canvas commit right after the HMR patches onto the post-HMR raw text
    // (lastValidConfigText), not the pre-HMR one.
    act(() => {
      ref.current?.commitCanvasMutation((layout) => [...layout, heading('Added by canvas')])
    })

    const editorText = (screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value
    expect(JSON.parse(editorText).pages[0].title).toBe('v2-title')
  })
})
