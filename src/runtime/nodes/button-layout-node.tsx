import { useState } from 'react'
import type {
  ButtonColor,
  ButtonLayoutNode,
  ButtonVariant,
  ExecuteOperationRuntimeUiAction,
  ExecuteOperationsRuntimeUiAction,
} from '../../config/runtime-config'
import type { DownloadOperationRuntimeUiAction } from '../../config/runtime-config-types'
import { useOptionalFormContext } from '../use-optional-form-context'
import {
  resolveRuntimeTextReference,
  resolveRuntimeValueWithOptions,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import type { RuntimeInstanceScope } from '../runtime-references/runtime-instance-scope'
import { EMPTY_INSTANCE_SCOPE } from '../runtime-references/runtime-instance-scope'
import { matchesVisibilityRule } from '../runtime-layout-visibility'
import { runDownloadAction } from '../runtime-actions/runtime-download-action'
import {
  executeRuntimeUiAction,
  runActionOutcomeWithLifecycle,
  type RuntimeUiActionHandlers,
} from '../runtime-actions/runtime-ui-action-executor'
import { getButtonVariantClassName } from '../runtime-node-styling'
import { getButtonSwitchClassName } from '../runtime-node-styling-button'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { IconNode } from './icon-node'
import { SwitchControl } from './switch-control'

interface ButtonNodeProps {
  node: ButtonLayoutNode
  iterationContext?: RuntimeIterationContext
  scopeChain?: RuntimeInstanceScope
}

/**
 * Resolves `button.props.checked` with the same boolean-or-full-reference mechanism already
 * used for form field `defaultValue` (`resolveToggleFieldDefinition`): a literal boolean is
 * used as-is, a well-formed reference without an available boolean value degrades to `false`.
 */
function resolveButtonSwitchChecked(
  checkedProp: boolean | string | undefined,
  state: ReturnType<typeof useRuntimeState>,
  iterationContext?: RuntimeIterationContext,
): boolean {
  const resolvedValue = resolveRuntimeValueWithOptions(checkedProp, state, { iterationContext })

  return resolvedValue.status === 'resolved' && typeof resolvedValue.value === 'boolean' ? resolvedValue.value : false
}

export function ButtonNode({ node, iterationContext, scopeChain }: ButtonNodeProps) {
  const resolvedScopeChain = scopeChain ?? EMPTY_INSTANCE_SCOPE
  const state = useRuntimeState()
  const {
    executeQueryOperation,
    executeDownloadOperation,
    goBackPage,
    navigateToPage,
    openModal,
    closeModal,
    readRuntimeState,
    resetForm,
  } = useRuntimeStateActions()
  const formContext = useOptionalFormContext()
  const action = node.props.action
  const isImplicitSubmit = action === undefined && formContext !== null
  const [isDownloading, setIsDownloading] = useState(false)
  const color: ButtonColor = node.props.color ?? 'primary'
  const declaredVariant: ButtonVariant = node.props.variant ?? 'solid'
  const variant: Exclude<ButtonVariant, 'switch'> = declaredVariant === 'switch' ? 'solid' : declaredVariant
  const fullWidth = node.props.fullWidth ?? false
  const className = getButtonVariantClassName(color, variant, fullWidth)
  const label = resolveRuntimeTextReference(node.props.label, state, 'button.props.label', { iterationContext })

  const iconRight = node.props.iconPosition === 'right'

  function buildHandlers(): RuntimeUiActionHandlers {
    return {
      executeQueryOperation,
      executeDownloadOperation,
      goBackPage,
      navigateToPage,
      openModal,
      closeModal,
      resetForm,
    }
  }

  async function handleActionWithLifecycle(
    lifecycleAction: ExecuteOperationRuntimeUiAction | ExecuteOperationsRuntimeUiAction,
    switchNextValue?: boolean,
  ) {
    if (lifecycleAction.type === 'executeOperations') {
      await runActionOutcomeWithLifecycle(
        async () => {
          const snapshotState = readRuntimeState()
          const filteredOperations = lifecycleAction.operations.filter((entry) =>
            matchesVisibilityRule(entry.when, snapshotState, iterationContext),
          )
          const results = await Promise.all(
            filteredOperations.map((entry) =>
              executeQueryOperation(entry.operationName, {
                snapshotState,
                requestParams: {
                  query: entry.query,
                  body: entry.body,
                  headers: entry.headers,
                },
                iterationContext,
                switchNextValue,
              }),
            ),
          )

          const allSuccess = results.every((result) => result.status === 'success')
          const anyError = results.some((result) => result.status === 'error')
          const status = allSuccess ? 'success' : anyError ? 'error' : 'skipped'
          return { status }
        },
        lifecycleAction.onSuccess,
        lifecycleAction.onError,
        buildHandlers(),
        readRuntimeState,
        iterationContext,
        resolvedScopeChain,
      )

      return
    }

    await runActionOutcomeWithLifecycle(
      () =>
        executeQueryOperation(lifecycleAction.operationName, {
          snapshotState: readRuntimeState(),
          requestParams: {
            query: lifecycleAction.query,
            body: lifecycleAction.body,
            headers: lifecycleAction.headers,
          },
          iterationContext,
          switchNextValue,
        }),
      lifecycleAction.onSuccess,
      lifecycleAction.onError,
      buildHandlers(),
      readRuntimeState,
      iterationContext,
      resolvedScopeChain,
    )
  }

  async function handleDownloadAction(downloadAction: DownloadOperationRuntimeUiAction) {
    setIsDownloading(true)

    try {
      await runActionOutcomeWithLifecycle(
        () =>
          runDownloadAction(
            downloadAction,
            buildHandlers(),
            readRuntimeState(),
            'button.props.action.filename',
            iterationContext,
          ),
        downloadAction.onSuccess,
        downloadAction.onError,
        buildHandlers(),
        readRuntimeState,
        iterationContext,
        resolvedScopeChain,
      )
    } finally {
      setIsDownloading(false)
    }
  }

  function handleClick() {
    if (!action || isDownloading) {
      return
    }

    if (action.type === 'downloadOperation') {
      void handleDownloadAction(action)
      return
    }

    if (
      (action.type === 'executeOperation' || action.type === 'executeOperations') &&
      (action.onSuccess !== undefined || action.onError !== undefined)
    ) {
      void handleActionWithLifecycle(action)
      return
    }

    executeRuntimeUiAction(action, buildHandlers(), { iterationContext, scopeChain: resolvedScopeChain })
  }

  function handleSwitchClick() {
    if (!action) {
      return
    }

    const switchNextValue = !resolveButtonSwitchChecked(node.props.checked, readRuntimeState(), iterationContext)

    if (action.type === 'downloadOperation') {
      void handleDownloadAction(action)
      return
    }

    if (action.type === 'executeOperation' || action.type === 'executeOperations') {
      void handleActionWithLifecycle(action, switchNextValue)
      return
    }

    executeRuntimeUiAction(action, buildHandlers(), { iterationContext, scopeChain: resolvedScopeChain })
  }

  if (declaredVariant === 'switch') {
    const checkedValue = resolveButtonSwitchChecked(node.props.checked, state, iterationContext)
    const labelVisible = node.props.labelVisible !== false
    const { trackClassName, knobClassName } = getButtonSwitchClassName(checkedValue, color)

    return (
      <div className="inline-flex items-center gap-2" data-layout-node="button">
        <SwitchControl
          checked={checkedValue}
          onClick={handleSwitchClick}
          trackClassName={trackClassName}
          knobClassName={knobClassName}
          ariaLabel={labelVisible ? undefined : label}
          ariaDescribedBy={undefined}
        />
        {labelVisible ? <span>{label}</span> : null}
      </div>
    )
  }

  return (
    <button
      data-layout-node="button"
      type={isImplicitSubmit ? 'submit' : 'button'}
      className={className}
      onClick={action ? handleClick : undefined}
      disabled={isDownloading}
    >
      {iconRight ? null : <IconNode name={node.props.icon} className="size-4 shrink-0" />}
      {label}
      {iconRight ? <IconNode name={node.props.icon} className="size-4 shrink-0" /> : null}
    </button>
  )
}
