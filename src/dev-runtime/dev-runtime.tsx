import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { Ref } from 'react'
import { flushSync } from 'react-dom'
import devConfigJson from '../dev/config.json'
import devDataValuesJson from '../dev/data-values.json'
import { AppShell } from '../app/app-shell'
import { readRuntimeConfig, type RuntimeConfig } from '../app/bootstrap/read-runtime-config'
import { readRuntimeDataValues } from '../app/bootstrap/read-runtime-data-values'
import { validateRuntimeConfig } from '../config/runtime-config'
import type { LayoutNode } from '../config/runtime-config'
import type {
  RuntimeTranslationsConfig,
  ShellConfig,
  ShellHeaderActionNode,
  ShellScrollBehavior,
} from '../config/runtime-config-types'
import { RuntimeStateProvider } from '../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../runtime/runtime-page'
import { AppShellHeader, AppShellSidebar } from '../runtime/runtime-shell'
import type { LayoutNodePath } from '../runtime/layout-node-path'
import {
  getAppShellClassName,
  getAppShellContentClassName,
  getAppShellContentPaddingClassName,
  getAppShellFrameClassName,
} from '../runtime/runtime-node-styling'
import {
  getAppShellBodyClassName,
  getAppShellBodyContentClassName,
} from '../runtime/runtime-node-styling-app-shell-sidebar'
import { DevRuntimeStateBridge } from './dev-runtime-state-bridge'
import type { DevRuntimeStateBridgeHandle } from './dev-runtime-state-bridge'
import { migrateRuntimeStateAcrossConfig } from './dev-runtime-state-migration'
import type { RuntimeConfigError } from '../config/runtime-config'
import {
  buildCommitCandidateConfig,
  denormalizeFormNodesForSerialization,
  patchRawConfigTextWithLayout,
  patchRootKey,
  type CommitCanvasMutationResult,
} from './layout-canvas/layout-canvas-commit'
import { replaceNodeAt } from './layout-tree-mutations'
import { DevEditorLayer } from './floating-toolbar/dev-editor-layer'
import { FloatingMonacoPanel } from './floating-toolbar/floating-monaco-panel'
import { setActiveConfigHmrApply } from './dev-runtime-hmr-bridge'

export type { CommitCanvasMutationResult }

interface DevRuntimeProps {
  rootElement?: HTMLElement | null
}

const defaultDevConfig = devConfigJson as unknown as RuntimeConfig
const defaultDevConfigText = JSON.stringify(devConfigJson, null, 2)
const defaultDevDataValues = devDataValuesJson as Record<string, unknown>

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
  ref?: Ref<DevRuntimeReadyHandle>
}

export interface DevRuntimeReadyHandle {
  commitCanvasMutation: (mutate: (pageLayout: LayoutNode[]) => LayoutNode[]) => CommitCanvasMutationResult
}

export function DevRuntimeReady({ initialConfig, initialConfigText, dataValues, ref }: DevRuntimeReadyProps) {
  const [currentConfig, setCurrentConfig] = useState<RuntimeConfig>(initialConfig)
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
  // Visual/Editor toggle (design.md 0103, Decisión 1). The floating toolbar is the single
  // entry point for the dev editor surface — there is no separate drawer/toggle anymore.
  const [mode, setMode] = useState<'visual' | 'editor'>('visual')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [monacoOpen, setMonacoOpen] = useState(false)

  const bridgeRef = useRef<DevRuntimeStateBridgeHandle>(null)

  // Track the current applied config in a ref so the HMR effect below can read
  // the latest value without adding it to deps (which would cause infinite loops).
  // Synced via an effect (not during render) because writing to a ref's `.current`
  // in the render body is a render side effect the React Compiler rejects.
  const currentConfigRef = useRef<RuntimeConfig>(currentConfig)
  useEffect(() => {
    currentConfigRef.current = currentConfig
  }, [currentConfig])

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
  }, [initialConfig, initialConfigText, dataValues])

  const hasPendingChangesRef = useRef(hasPendingChanges)
  useEffect(() => {
    hasPendingChangesRef.current = hasPendingChanges
  }, [hasPendingChanges])

  useEffect(() => {
    if (!import.meta.hot) return

    setActiveConfigHmrApply((nextConfig) => {
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
    })

    return () => {
      setActiveConfigHmrApply(null)
    }
  }, [dataValues])

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

  // The drawer's `handleToggle` used to seed `editorBuffer` with the original raw text the
  // first time it opened. With the drawer gone, `onMonacoOpenChange` is wired directly to
  // `setMonacoOpen` (no wrapping handler — see the render below), so this seeds the buffer
  // the first time the Monaco panel opens, preserving "first open shows the original raw
  // text, not the re-serialized normalized config". Done during render (the React-documented
  // "adjust state when a prop changes" pattern) instead of an effect: the guard
  // (`editorBuffer === null`) is only ever true once per null-buffer window, so it cannot
  // loop, and it avoids a redundant extra commit versus doing this in a useEffect.
  if (monacoOpen && editorBuffer === null) {
    setEditorBuffer(initialConfigText)
  }

  // Sole remaining keyboard entry point (design.md 0103, Decisión 7): `Esc` closes the Monaco
  // panel when it's open. The toggle shortcut (`Ctrl/Cmd+Shift+J`) and `useDevRuntimeKeyboard`
  // are retired — the floating toolbar is the only entry point into the dev editor now.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && monacoOpen) {
        setMonacoOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [monacoOpen])

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
    // The edited page is the really-navigated one (design.md 0103, Decisión 2), not a local
    // canvas selector — read it from the bridge at commit time, same pattern already used
    // below to read `prevState` before migrating. Falls back to `initialPage` if the bridge
    // isn't mounted yet, matching the rest of the bootstrap code's degradation criteria.
    const activePageId = bridgeRef.current?.getLatestState().navigation.currentPageId ?? currentConfig.initialPage

    const candidateConfig = buildCommitCandidateConfig(currentConfig, activePageId, mutate)
    const mutatedPage = candidateConfig.pages.find((page) => page.id === activePageId)
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
    const nextText = patchRawConfigTextWithLayout(lastValidConfigText, activePageId, mutatedLayout)

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

  // Same pipeline as `commitCanvasMutation`, generalized for the `shell` root key instead of a
  // single page's `layout` (0122-T5): mutate the in-memory value, patch only that key onto the
  // last-known-valid raw text via `patchRootKey`, validate the patched text, and apply it. Unlike
  // `layout`, `shell` is not nested inside `pages[]`, so there is no `activePageId` to resolve
  // and no `buildCommitCandidateConfig`-style page lookup.
  function commitShellMutation(
    mutate: (shell: ShellConfig | undefined) => ShellConfig | undefined,
  ): CommitCanvasMutationResult {
    const mutatedShell = mutate(currentConfig.shell)

    // `shell.header.actions` holds full `link`/`button` layout nodes (0122-T1) — the same raw/
    // normalized divergence `denormalizeFormNodesForSerialization` already guards against for
    // `layout` applies here too (e.g. a `link` action with a nested `form` inside its allowed
    // container children), even though today's UI never nests a form under a shell action.
    const rawMutatedShell =
      mutatedShell?.header?.actions !== undefined
        ? {
            ...mutatedShell,
            header: {
              ...mutatedShell.header,
              actions: denormalizeFormNodesForSerialization(mutatedShell.header.actions) as ShellHeaderActionNode[],
            },
          }
        : mutatedShell

    const nextText = patchRootKey(lastValidConfigText, 'shell', rawMutatedShell)

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
      setHasPendingChanges(false)
      setHasAppliedChanges(true)
      setParseError(null)
      setValidationError(null)
    })

    return { status: 'applied' }
  }

  // Same pipeline as `commitShellMutation`, generalized for the `translations` root key
  // (0130-T2): mutate the in-memory value, patch only that key onto the last-known-valid raw
  // text via `patchRootKey`, validate the patched text, and apply it. Unlike `shell`, a
  // translations map never embeds `layout` nodes, so there is no raw/normalized divergence to
  // guard against and no `denormalizeFormNodesForSerialization`-style pass is needed here.
  function commitTranslationsMutation(
    mutate: (prev: RuntimeTranslationsConfig | undefined) => RuntimeTranslationsConfig | undefined,
  ): CommitCanvasMutationResult {
    const mutatedTranslations = mutate(currentConfig.translations)

    const nextText = patchRootKey(lastValidConfigText, 'translations', mutatedTranslations)

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
  function handleCanvasNodeUpdate(
    path: LayoutNodePath,
    updater: (node: LayoutNode) => LayoutNode,
  ): CommitCanvasMutationResult {
    return commitCanvasMutation((pageLayout) => replaceNodeAt(pageLayout, path, updater))
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

  const devSidebarItems = currentConfig.shell?.sidebar?.items
  const hasDevSidebarItems = devSidebarItems !== undefined && devSidebarItems.length > 0

  const devScrollBehavior: ShellScrollBehavior = currentConfig.shell?.scrollBehavior ?? 'page'
  const isDevFixed = devScrollBehavior === 'fixed'

  // Mirrors `AppShell`'s header-height measurement (FR11, 0124-T4) for the dev preview: the
  // sidebar's sticky offset in "page" mode has to track the real, ResizeObserver-measured header
  // height here too, not just in the production shell.
  const [devHeaderNode, setDevHeaderNode] = useState<HTMLElement | null>(null)
  const [devHeaderHeightPx, setDevHeaderHeightPx] = useState(0)

  useLayoutEffect(() => {
    // Local wrapper (same shape as `recompute` in `layout-canvas-grid-drop-zones.tsx`) so the
    // effect body calls a local function rather than the `useState` setter directly.
    const measureDevHeaderHeight = (heightPx: number) => {
      setDevHeaderHeightPx(heightPx)
    }

    if (devHeaderNode === null) {
      measureDevHeaderHeight(0)
      return
    }
    measureDevHeaderHeight(devHeaderNode.getBoundingClientRect().height)
    const observer = new ResizeObserver((entries) => {
      measureDevHeaderHeight(entries[0].contentRect.height)
    })
    observer.observe(devHeaderNode)
    return () => observer.disconnect()
  }, [devHeaderNode])

  const editorLayer = (
    <DevEditorLayer
      mode={mode}
      onModeChange={setMode}
      paletteOpen={paletteOpen}
      onPaletteOpenChange={setPaletteOpen}
      monacoOpen={monacoOpen}
      onMonacoOpenChange={setMonacoOpen}
      monaco={{
        editorBuffer,
        onEditorChange: handleEditorChange,
        onApply: handleApply,
        onCopy: handleCopy,
        pendingChanges: hasPendingChanges,
        errors: currentError,
      }}
      onCommitCanvasMutation={commitCanvasMutation}
      onCommitNodeUpdate={handleCanvasNodeUpdate}
      onCommitShellMutation={commitShellMutation}
      onCommitTranslationsMutation={commitTranslationsMutation}
    >
      <RuntimePage />
    </DevEditorLayer>
  )

  const devAppShellClassName = isDevFixed ? `${getAppShellClassName()} overflow-hidden` : getAppShellClassName()
  const devBodyRowClassName = isDevFixed ? `${getAppShellBodyClassName()} flex-1 min-h-0` : getAppShellBodyClassName()
  const devContentWrapperClassName = isDevFixed
    ? `${getAppShellBodyContentClassName()} ${getAppShellContentPaddingClassName()} flex-1 min-h-0 overflow-y-auto`
    : `${getAppShellBodyContentClassName()} ${getAppShellContentPaddingClassName()}`
  const devPageContentClassName = isDevFixed
    ? `${getAppShellContentPaddingClassName()} flex-1 min-h-0 overflow-y-auto`
    : getAppShellContentPaddingClassName()

  return (
    <>
      <main className={devAppShellClassName} data-testid="runtime-app">
        <section className={getAppShellContentClassName()} data-testid="runtime-shell-content">
          <div className={getAppShellFrameClassName()} data-testid="runtime-shell-frame">
            <RuntimeStateProvider config={currentConfig} dataValues={dataValues}>
              <DevRuntimeStateBridge ref={bridgeRef} />
              <AppShellHeader ref={setDevHeaderNode} header={currentConfig.shell?.header} pinned={!isDevFixed} />
              {hasDevSidebarItems ? (
                <div className={devBodyRowClassName}>
                  <AppShellSidebar
                    sidebar={currentConfig.shell?.sidebar}
                    scrollBehavior={devScrollBehavior}
                    stickyTopPx={devHeaderHeightPx}
                  />
                  <div className={devContentWrapperClassName}>{editorLayer}</div>
                </div>
              ) : (
                <div className={devPageContentClassName}>{editorLayer}</div>
              )}
            </RuntimeStateProvider>
          </div>
        </section>
      </main>

      {/* Outside RuntimeStateProvider: FloatingMonacoPanel doesn't consume runtime state, its
          data all arrives via props (design.md 0103, Decisión 7). */}
      <FloatingMonacoPanel
        open={monacoOpen}
        onClose={() => setMonacoOpen(false)}
        editorBuffer={editorBuffer}
        onEditorChange={handleEditorChange}
        onApply={handleApply}
        onCopy={handleCopy}
        pendingChanges={hasPendingChanges}
        errors={currentError}
      />
    </>
  )
}
