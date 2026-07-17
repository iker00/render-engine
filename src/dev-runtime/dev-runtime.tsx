import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import devConfigJson from '../dev/config.json'
import devDataValuesJson from '../dev/data-values.json'
import { AppShell } from '../app/app-shell'
import { readRuntimeConfig, type RuntimeConfig } from '../app/bootstrap/read-runtime-config'
import { readRuntimeDataValues } from '../app/bootstrap/read-runtime-data-values'
import { validateRuntimeConfig } from '../config/runtime-config'
import type { LayoutNode } from '../config/runtime-config'
import { RuntimeStateProvider } from '../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../runtime/runtime-page'
import type { LayoutNodePath } from '../runtime/layout-node-path'
import {
  getAppShellClassName,
  getAppShellContentClassName,
  getAppShellFrameClassName,
} from '../runtime/runtime-node-styling'
import { DevRuntimeStateBridge } from './dev-runtime-state-bridge'
import type { DevRuntimeStateBridgeHandle } from './dev-runtime-state-bridge'
import { DevRuntimeMonacoEditor } from './dev-runtime-monaco-editor'
import { DevRuntimeToggleButton } from './dev-runtime-toggle-button'
import { DevRuntimeDrawer } from './dev-runtime-drawer'
import type { DevRuntimeDrawerTab } from './dev-runtime-drawer'
import { useDevRuntimeKeyboard } from './dev-runtime-keyboard'
import { migrateRuntimeStateAcrossConfig } from './dev-runtime-state-migration'
import type { RuntimeConfigError } from '../config/runtime-config'
import {
  buildCommitCandidateConfig,
  patchRawConfigTextWithLayout,
  type CommitCanvasMutationResult,
} from './layout-canvas/layout-canvas-commit'
import { LayoutCanvas } from './layout-canvas/layout-canvas'
import { replaceNodeAt } from './layout-tree-mutations'

export type { CommitCanvasMutationResult }

interface DevRuntimeProps {
  rootElement?: HTMLElement | null
}

const defaultDevConfig = devConfigJson as unknown as RuntimeConfig
const defaultDevConfigText = JSON.stringify(devConfigJson, null, 2)
const defaultDevDataValues = devDataValuesJson as Record<string, unknown>

let activeConfigHmrApply: ((nextConfig: unknown) => void) | null = null

/**
 * Test-only seam: `activeConfigHmrApply` is only ever invoked in practice by
 * Vite's real HMR runtime when `../dev/config.json` changes on disk, which does
 * not happen inside a `vitest run` pass. This forwards to the exact same
 * function the `import.meta.hot.accept` callback below calls, so tests can
 * exercise the real HMR commit path without a live dev server.
 */
export function triggerActiveConfigHmrApplyForTests(nextConfig: unknown): void {
  activeConfigHmrApply?.(nextConfig)
}

if (import.meta.hot) {
  // Fast Refresh re-evaluates this module on config.json HMR but preserves
  // DevRuntimeReady's state, so the new config never reaches `currentConfig`
  // through the initialConfig prop. Forward the update directly to the mounted
  // component so it can re-apply via the same migration path as the drawer.
  import.meta.hot.accept('../dev/config.json', (newModule) => {
    if (newModule && activeConfigHmrApply) {
      activeConfigHmrApply((newModule as unknown as { default: unknown }).default)
    }
  })
}

export function DevRuntime({ rootElement = document.getElementById('layout-renderer') }: DevRuntimeProps) {
  // Capture the raw text before validation so the editor shows the original format.
  // The validator normalizes preloads from { "opName": {} } to { operationName, requestParams },
  // so re-serializing the normalized config would break re-validation.
  const rawConfigText = rootElement?.dataset.config ?? defaultDevConfigText

  const bootstrapResult = readRuntimeConfig({
    devConfig: defaultDevConfig,
    isDevelopment: true,
    rootElement,
  })

  if (bootstrapResult.status === 'error') {
    return <AppShell isDevelopment={true} runtimeConfig={bootstrapResult} />
  }

  const dataValuesResult = readRuntimeDataValues({
    devDataValues: defaultDevDataValues,
    isDevelopment: true,
    rootElement,
  })

  if (dataValuesResult.status === 'error') {
    return (
      <AppShell
        isDevelopment={true}
        runtimeConfig={bootstrapResult}
        dataValuesError={dataValuesResult.error}
      />
    )
  }

  return (
    <DevRuntimeReady
      initialConfig={bootstrapResult.config}
      initialConfigText={rawConfigText}
      dataValues={dataValuesResult.dataValues}
    />
  )
}

interface DevRuntimeReadyProps {
  initialConfig: RuntimeConfig
  initialConfigText: string
  dataValues?: Record<string, unknown>
}

export interface DevRuntimeReadyHandle {
  commitCanvasMutation: (mutate: (pageLayout: LayoutNode[]) => LayoutNode[]) => CommitCanvasMutationResult
}

export const DevRuntimeReady = forwardRef<DevRuntimeReadyHandle, DevRuntimeReadyProps>(function DevRuntimeReady(
  { initialConfig, initialConfigText, dataValues },
  ref,
) {
  const [currentConfig, setCurrentConfig] = useState<RuntimeConfig>(initialConfig)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorBuffer, setEditorBuffer] = useState<string | null>(null)
  const [hasPendingChanges, setHasPendingChanges] = useState(false)
  const [validationError, setValidationError] = useState<RuntimeConfigError | null>(null)
  const [parseError, setParseError] = useState<{ code: string; message: string } | null>(null)
  const [hasAppliedChanges, setHasAppliedChanges] = useState(false)
  // Raw text that, when parsed and validated, produces `currentConfig` exactly.
  // The canvas commit pipeline patches only the `layout` key of the active page
  // on top of this text instead of reserializing the full RuntimeConfig, which
  // would lose the raw crude `preloads` shape and silently drop
  // `form.onSuccess`/`form.onError` (see design.md, Decision 5 / Contexto).
  const [lastValidConfigText, setLastValidConfigText] = useState(initialConfigText)
  // The page the canvas is currently editing, driven by LayoutCanvas's own page
  // selector. Defaults to the first page and is not persisted across sessions.
  const [activeCanvasPageId, setActiveCanvasPageId] = useState(() => currentConfig.pages[0].id)
  // Which drawer tab is active. Defaults to 'json' to preserve the drawer's
  // existing open behavior (Monaco visible immediately).
  const [activeTab, setActiveTab] = useState<DevRuntimeDrawerTab>('json')

  const bridgeRef = useRef<DevRuntimeStateBridgeHandle>(null)

  // Track the current applied config in a ref so the HMR effect below can read
  // the latest value without adding it to deps (which would cause infinite loops).
  const currentConfigRef = useRef<RuntimeConfig>(currentConfig)
  currentConfigRef.current = currentConfig

  const prevInitialConfigRef = useRef(initialConfig)
  useEffect(() => {
    if (prevInitialConfigRef.current === initialConfig) return
    prevInitialConfigRef.current = initialConfig

    const prevState = bridgeRef.current?.getLatestState()
    const nextState = prevState
      ? migrateRuntimeStateAcrossConfig(prevState, currentConfigRef.current, initialConfig, { dataValues })
      : undefined

    if (nextState && bridgeRef.current) {
      bridgeRef.current.dispatchAndSyncState({ type: 'runtime/reset', payload: { state: nextState } })
    }

    setCurrentConfig(initialConfig)
    setEditorBuffer(null)
    setLastValidConfigText(initialConfigText)
    setParseError(null)
    setValidationError(null)
    setHasPendingChanges(false)
  }, [initialConfig, initialConfigText])

  const hasPendingChangesRef = useRef(hasPendingChanges)
  hasPendingChangesRef.current = hasPendingChanges

  useEffect(() => {
    if (!import.meta.hot) return

    activeConfigHmrApply = (nextConfig) => {
      const validation = validateRuntimeConfig(nextConfig)
      if (validation.status === 'error') {
        setValidationError(validation.error)
        return
      }

      const prevState = bridgeRef.current?.getLatestState()
      const nextState = prevState
        ? migrateRuntimeStateAcrossConfig(prevState, currentConfigRef.current, validation.config, { dataValues })
        : undefined

      if (nextState && bridgeRef.current) {
        bridgeRef.current.dispatchAndSyncState({ type: 'runtime/reset', payload: { state: nextState } })
      }

      const reloadedModuleText = JSON.stringify(nextConfig, null, 2)

      flushSync(() => {
        setCurrentConfig(validation.config)
        setParseError(null)
        setValidationError(null)
        // lastValidConfigText tracks currentConfig, not editorBuffer, so it must
        // update unconditionally here — never only inside the guard below. If it
        // only updated alongside editorBuffer, an HMR with pending Monaco changes
        // followed by a canvas commit would patch the new layout onto a stale
        // pre-HMR raw text, reintroducing the raw/normalized divergence this
        // state exists to avoid (see design.md, Decision 5).
        setLastValidConfigText(reloadedModuleText)
        // Sync the drawer's editor buffer to the new disk content, but only when
        // the user has no unsaved in-browser edits — never clobber pending work.
        if (!hasPendingChangesRef.current) {
          setEditorBuffer(reloadedModuleText)
        }
      })
    }

    return () => {
      activeConfigHmrApply = null
    }
  }, [])

  useEffect(() => {
    if (!hasAppliedChanges) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.returnValue = 'unsaved-changes'
      return 'unsaved-changes'
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasAppliedChanges])

  const currentError = parseError ?? validationError

  function handleToggle() {
    setEditorOpen((prev) => {
      if (!prev && editorBuffer === null) {
        // First open: show the original raw text, not the re-serialized normalized config.
        setEditorBuffer(initialConfigText)
      }
      return !prev
    })
  }

  function handleClose() {
    setEditorOpen(false)
  }

  function handleEditorChange(value: string) {
    setEditorBuffer(value)
    setHasPendingChanges(true)
    setParseError(null)
    setValidationError(null)
  }

  function handleApply() {
    const text = editorBuffer ?? initialConfigText

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      const msg = err instanceof SyntaxError ? err.message : 'Invalid JSON'
      setParseError({ code: 'invalid-json', message: msg })
      return
    }

    const validation = validateRuntimeConfig(parsed)
    if (validation.status === 'error') {
      setValidationError(validation.error)
      return
    }

    const prevState = bridgeRef.current?.getLatestState()
    const nextState = prevState
      ? migrateRuntimeStateAcrossConfig(prevState, currentConfig, validation.config, { dataValues })
      : undefined

    // Dispatch the state reset BEFORE updating currentConfig so the provider's
    // layoutEffects (triggered by the new config prop) see the migrated state,
    // not the stale one. flushSync then commits both atomically.
    if (nextState && bridgeRef.current) {
      bridgeRef.current.dispatchAndSyncState({ type: 'runtime/reset', payload: { state: nextState } })
    }

    flushSync(() => {
      setCurrentConfig(validation.config)
      setParseError(null)
      setValidationError(null)
      setHasPendingChanges(false)
      setHasAppliedChanges(true)
      // Keep editorBuffer as-is: it's the text that just validated.
      // Re-serializing validation.config would produce the normalized format
      // (e.g. preloads as { operationName, requestParams }) which the validator
      // expects in raw format ({ "opName": {} }) — breaking a second apply.
      // lastValidConfigText mirrors that same invariant for the canvas commit
      // pipeline: it stays the raw text that just validated into currentConfig.
      setLastValidConfigText(text)
    })
  }

  function commitCanvasMutation(
    mutate: (pageLayout: LayoutNode[]) => LayoutNode[],
  ): CommitCanvasMutationResult {
    const candidateConfig = buildCommitCandidateConfig(currentConfig, activeCanvasPageId, mutate)
    const mutatedPage = candidateConfig.pages.find((page) => page.id === activeCanvasPageId)
    const mutatedLayout = mutatedPage ? mutatedPage.layout : []

    // Validate the patched raw text (mirroring handleApply), not the in-memory
    // candidate built from currentConfig directly. currentConfig always holds the
    // already-normalized shape (preloads as { operationName, requestParams },
    // form.onSuccess/onError as sibling fields of submitAction), which the
    // validator does not accept as input: it hard-rejects normalized preloads and
    // silently strips normalized onSuccess/onError (see design.md, Contexto, and
    // the existing regression test "silently discards onSuccess at root form
    // node"). Patching onto lastValidConfigText keeps every untouched part of the
    // document — including other pages' preloads and forms — in the raw shape the
    // validator expects, exactly like a manual "Aplicar".
    const nextText = patchRawConfigTextWithLayout(lastValidConfigText, activeCanvasPageId, mutatedLayout)

    const parsed: unknown = JSON.parse(nextText)
    const validation = validateRuntimeConfig(parsed)
    if (validation.status === 'error') {
      return { status: 'rejected', error: validation.error }
    }

    const prevState = bridgeRef.current?.getLatestState()
    const nextState = prevState
      ? migrateRuntimeStateAcrossConfig(prevState, currentConfig, validation.config, { dataValues })
      : undefined

    if (nextState && bridgeRef.current) {
      bridgeRef.current.dispatchAndSyncState({ type: 'runtime/reset', payload: { state: nextState } })
    }

    flushSync(() => {
      setCurrentConfig(validation.config)
      setEditorBuffer(nextText)
      setLastValidConfigText(nextText)
      // A canvas commit deliberately overwrites any unapplied Monaco edit: unlike
      // HMR (whose origin is external to the session), the canvas is a user
      // action within the same editing session, closer in nature to "Aplicar".
      setHasPendingChanges(false)
      setHasAppliedChanges(true)
      setParseError(null)
      setValidationError(null)
    })

    return { status: 'applied' }
  }

  useImperativeHandle(ref, () => ({ commitCanvasMutation }))

  // LayoutCanvasPropertiesPanel edits a single node by path; replaceNodeAt (T3)
  // rebuilds the page's node tree around that edit, and commitCanvasMutation
  // (T4) is what actually validates and applies it — this is the same pipeline
  // a structural canvas mutation would go through.
  function handleCanvasNodeUpdate(path: LayoutNodePath, updater: (node: LayoutNode) => LayoutNode) {
    commitCanvasMutation((pageLayout) => replaceNodeAt(pageLayout, path, updater))
  }

  async function handleCopy() {
    const text = editorBuffer ?? initialConfigText
    const minified = JSON.stringify(JSON.parse(text))
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(minified)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }

  useDevRuntimeKeyboard({
    isOpen: editorOpen,
    onToggle: handleToggle,
    onClose: handleClose,
  })

  return (
    <>
      <main className={getAppShellClassName()} data-testid="runtime-app">
        <section className={`${getAppShellContentClassName()} items-center`} data-testid="runtime-shell-content">
          <div className={getAppShellFrameClassName()} data-testid="runtime-shell-frame">
            <RuntimeStateProvider config={currentConfig} dataValues={dataValues}>
              <DevRuntimeStateBridge ref={bridgeRef} />
              <RuntimePage />
            </RuntimeStateProvider>
          </div>
        </section>
      </main>

      <DevRuntimeToggleButton onToggle={handleToggle} />

      <DevRuntimeDrawer
        open={editorOpen}
        onClose={handleClose}
        onApply={handleApply}
        onCopy={handleCopy}
        pendingChanges={hasPendingChanges}
        errors={currentError}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        visualContent={
          <LayoutCanvas
            config={currentConfig}
            activePageId={activeCanvasPageId}
            onActivePageIdChange={setActiveCanvasPageId}
            onCommitNodeUpdate={handleCanvasNodeUpdate}
            onCommitCanvasMutation={commitCanvasMutation}
          />
        }
      >
        {editorBuffer !== null && (
          <DevRuntimeMonacoEditor
            value={editorBuffer}
            onChange={handleEditorChange}
            onMount={() => {}}
          />
        )}
      </DevRuntimeDrawer>
    </>
  )
})

DevRuntimeReady.displayName = 'DevRuntimeReady'
