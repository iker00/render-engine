import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import devConfigJson from '../dev/dev-config'
import devDataValuesJson from '../dev/data-values.json'
import { AppShell } from '../app/app-shell'
import { readRuntimeConfig, type RuntimeConfig } from '../app/bootstrap/read-runtime-config'
import { readRuntimeDataValues } from '../app/bootstrap/read-runtime-data-values'
import { validateRuntimeConfig } from '../config/runtime-config'
import { RuntimeStateProvider } from '../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../runtime/runtime-page'
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
import { useDevRuntimeKeyboard } from './dev-runtime-keyboard'
import { migrateRuntimeStateAcrossConfig } from './dev-runtime-state-migration'
import type { RuntimeConfigError } from '../config/runtime-config'

interface DevRuntimeProps {
  rootElement?: HTMLElement | null
}

const defaultDevConfig = devConfigJson as unknown as RuntimeConfig
const defaultDevConfigText = JSON.stringify(devConfigJson, null, 2)
const defaultDevDataValues = devDataValuesJson as Record<string, unknown>

let activeConfigHmrApply: ((nextConfig: unknown) => void) | null = null

if (import.meta.hot) {
  // Fast Refresh re-evaluates this module on config.json HMR but preserves
  // DevRuntimeReady's state, so the new config never reaches `currentConfig`
  // through the initialConfig prop. Forward the update directly to the mounted
  // component so it can re-apply via the same migration path as the drawer.
  import.meta.hot.accept('../dev/dev-config', (newModule) => {
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

function DevRuntimeReady({ initialConfig, initialConfigText, dataValues }: DevRuntimeReadyProps) {
  const [currentConfig, setCurrentConfig] = useState<RuntimeConfig>(initialConfig)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorBuffer, setEditorBuffer] = useState<string | null>(null)
  const [hasPendingChanges, setHasPendingChanges] = useState(false)
  const [validationError, setValidationError] = useState<RuntimeConfigError | null>(null)
  const [parseError, setParseError] = useState<{ code: string; message: string } | null>(null)
  const [hasAppliedChanges, setHasAppliedChanges] = useState(false)

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
    setParseError(null)
    setValidationError(null)
    setHasPendingChanges(false)
  }, [initialConfig])

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

      flushSync(() => {
        setCurrentConfig(validation.config)
        setParseError(null)
        setValidationError(null)
        // Sync the drawer's editor buffer to the new disk content, but only when
        // the user has no unsaved in-browser edits — never clobber pending work.
        if (!hasPendingChangesRef.current) {
          setEditorBuffer(JSON.stringify(nextConfig, null, 2))
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
    })
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
}
