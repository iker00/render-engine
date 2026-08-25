import type {
  ButtonColor,
  ButtonLayoutNode,
  ButtonVariant,
  ExecuteOperationRuntimeUiAction,
  ExecuteOperationsRuntimeUiAction,
} from '../../config/runtime-config'
import { useOptionalFormContext } from '../use-optional-form-context'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { matchesVisibilityRule } from '../runtime-layout-visibility'
import {
  executeRuntimeUiAction,
  runRuntimeUiActionLifecycleList,
  type RuntimeUiActionHandlers,
} from '../runtime-actions/runtime-ui-action-executor'
import { getButtonVariantClassName } from '../runtime-node-styling'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { IconNode } from './icon-node'

interface ButtonNodeProps {
  node: ButtonLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function ButtonNode({ node, iterationContext }: ButtonNodeProps) {
  const state = useRuntimeState()
  const { executeQueryOperation, goBackPage, navigateToPage, openModal, closeModal, readRuntimeState, resetForm } =
    useRuntimeStateActions()
  const formContext = useOptionalFormContext()
  const action = node.props.action
  const isImplicitSubmit = action === undefined && formContext !== null
  const color: ButtonColor = node.props.color ?? 'primary'
  const variant: ButtonVariant = node.props.variant ?? 'solid'
  const fullWidth = node.props.fullWidth ?? false
  const className = getButtonVariantClassName(color, variant, fullWidth)
  const label = resolveRuntimeTextReference(node.props.label, state, 'button.props.label', { iterationContext })

  const iconRight = node.props.iconPosition === 'right'

  function buildHandlers(): RuntimeUiActionHandlers {
    return {
      executeQueryOperation,
      goBackPage,
      navigateToPage,
      openModal,
      closeModal,
      resetForm,
    }
  }

  async function handleActionWithLifecycle(
    lifecycleAction: ExecuteOperationRuntimeUiAction | ExecuteOperationsRuntimeUiAction,
  ) {
    if (lifecycleAction.type === 'executeOperations') {
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
          }),
        ),
      )

      const allSuccess = results.every((result) => result.status === 'success')
      const anyError = results.some((result) => result.status === 'error')

      if (allSuccess) {
        runRuntimeUiActionLifecycleList(lifecycleAction.onSuccess, buildHandlers(), readRuntimeState, iterationContext)
      } else if (anyError) {
        runRuntimeUiActionLifecycleList(lifecycleAction.onError, buildHandlers(), readRuntimeState, iterationContext)
      }

      return
    }

    const result = await executeQueryOperation(lifecycleAction.operationName, {
      snapshotState: readRuntimeState(),
      requestParams: {
        query: lifecycleAction.query,
        body: lifecycleAction.body,
        headers: lifecycleAction.headers,
      },
      iterationContext,
    })

    if (result.status === 'success') {
      runRuntimeUiActionLifecycleList(lifecycleAction.onSuccess, buildHandlers(), readRuntimeState, iterationContext)
    } else if (result.status === 'error') {
      runRuntimeUiActionLifecycleList(lifecycleAction.onError, buildHandlers(), readRuntimeState, iterationContext)
    }
  }

  function handleClick() {
    if (!action) {
      return
    }

    if (
      (action.type === 'executeOperation' || action.type === 'executeOperations') &&
      (action.onSuccess !== undefined || action.onError !== undefined)
    ) {
      void handleActionWithLifecycle(action)
      return
    }

    executeRuntimeUiAction(action, buildHandlers(), { iterationContext })
  }

  return (
    <button
      data-layout-node="button"
      type={isImplicitSubmit ? 'submit' : 'button'}
      className={className}
      onClick={action ? handleClick : undefined}
    >
      {iconRight ? null : <IconNode name={node.props.icon} className="size-4 shrink-0" />}
      {label}
      {iconRight ? <IconNode name={node.props.icon} className="size-4 shrink-0" /> : null}
    </button>
  )
}
