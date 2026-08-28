import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import type { StepOnNextAction, StepsItem, StepsLayoutNode, StepsVariant } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import type { LayoutNodePath } from '../layout-node-path'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { useOptionalFormContext } from '../use-optional-form-context'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'
import { LayoutRenderer } from '../layout-renderer'
import { isLayoutNodeVisible, matchesVisibilityRule } from '../runtime-layout-visibility'
import { validateFormFields } from '../runtime-form-validations'
import { useLayoutEditModeContext } from '../use-layout-edit-mode-context'
import {
  getButtonVariantClassName,
  getStepsIndicatorClassName,
  getStepsItemWrapperClassName,
  getStepsMarkerClassName,
  getStepsPanelClassName,
  getStepsRootClassName,
} from '../runtime-node-styling'
import { collectResolvedFormFieldDefinitions } from './runtime-form-field-collection'

interface StepsNodeProps {
  node: StepsLayoutNode
  iterationContext?: RuntimeIterationContext
  path?: LayoutNodePath
}

export function StepsNode({ node, iterationContext, path }: StepsNodeProps) {
  const state = useRuntimeState()
  const { initializeForm, setFormFieldError, executeQueryOperation, readRuntimeState } = useRuntimeStateActions()
  const formContext = useOptionalFormContext()
  const { items, variant = 'horizontal' } = node.props

  if (!items || items.length === 0) {
    return null
  }

  return (
    <StepsNodeContent
      node={node}
      items={items}
      variant={variant}
      state={state}
      initializeForm={initializeForm}
      setFormFieldError={setFormFieldError}
      executeQueryOperation={executeQueryOperation}
      readRuntimeState={readRuntimeState}
      formId={formContext?.formId ?? ''}
      iterationContext={iterationContext}
      path={path}
    />
  )
}

interface StepsNodeContentProps {
  node: StepsLayoutNode
  items: StepsItem[]
  variant: StepsVariant
  state: ReturnType<typeof useRuntimeState>
  initializeForm: ReturnType<typeof useRuntimeStateActions>['initializeForm']
  setFormFieldError: ReturnType<typeof useRuntimeStateActions>['setFormFieldError']
  executeQueryOperation: ReturnType<typeof useRuntimeStateActions>['executeQueryOperation']
  readRuntimeState: ReturnType<typeof useRuntimeStateActions>['readRuntimeState']
  formId: string
  iterationContext?: RuntimeIterationContext
  path?: LayoutNodePath
}

function StepsNodeContent({
  node,
  items,
  variant,
  state,
  initializeForm,
  setFormFieldError,
  executeQueryOperation,
  readRuntimeState,
  formId,
  iterationContext,
  path,
}: StepsNodeContentProps) {
  const editModeContext = useLayoutEditModeContext()
  const isEditMode = editModeContext !== null && editModeContext.active

  const visibleIndices = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => matchesVisibilityRule(item.visibility, state, iterationContext))
    .map(({ index }) => index)

  const [activeIndex, setActiveIndex] = useState(() => visibleIndices[0] ?? 0)
  const [maxVisitedIndex, setMaxVisitedIndex] = useState(() => visibleIndices[0] ?? 0)

  // "Adjusting state during render" pattern (same as TabsNodeContent): correct activeIndex /
  // maxVisitedIndex if they are no longer part of visibleIndices (e.g. a `visibility` change).
  let effectiveActiveIndex = activeIndex
  if (visibleIndices.length > 0 && !visibleIndices.includes(activeIndex)) {
    effectiveActiveIndex = visibleIndices[0]
    setActiveIndex(effectiveActiveIndex)
  }

  let effectiveMaxVisitedIndex = maxVisitedIndex
  if (visibleIndices.length > 0 && !visibleIndices.includes(maxVisitedIndex)) {
    effectiveMaxVisitedIndex = visibleIndices[0]
    setMaxVisitedIndex(effectiveMaxVisitedIndex)
  }

  // `onNext` gating (D7): `isOnNextPending`/`onNextError` are per-instance, not per-step (see
  // design's accepted trade-off). `activeStepIndexRef` always mirrors the current active step so
  // `runStepOnNextGate` can detect — after its `await` — whether the user navigated away from the
  // step it was invoked for (e.g. via "Back", not blocked while pending) and discard a stale result.
  const [isOnNextPending, setIsOnNextPending] = useState(false)
  const [onNextError, setOnNextError] = useState<string | null>(null)
  const activeStepIndexRef = useRef(effectiveActiveIndex)

  useLayoutEffect(() => {
    activeStepIndexRef.current = effectiveActiveIndex
  }, [effectiveActiveIndex])

  // Same "adjusting state during render" idiom as activeIndex/maxVisitedIndex above (state, not a
  // ref, so it stays safe to read/write during render): clears a stale onNext error as soon as the
  // active step changes, without the extra render an effect would introduce.
  const [lastActiveIndexForOnNextError, setLastActiveIndexForOnNextError] = useState(effectiveActiveIndex)
  if (lastActiveIndexForOnNextError !== effectiveActiveIndex) {
    setLastActiveIndexForOnNextError(effectiveActiveIndex)

    if (onNextError !== null) {
      setOnNextError(null)
    }
  }

  async function runStepOnNextGate(
    targetIndex: number,
    onNext: StepOnNextAction,
  ): Promise<{ status: 'success' } | { status: 'blocked' }> {
    setIsOnNextPending(true)

    const result = await executeQueryOperation(onNext.operationName, {
      snapshotState: readRuntimeState(),
      requestParams: { query: onNext.query, body: onNext.body, headers: onNext.headers },
      iterationContext,
    })

    if (targetIndex !== activeStepIndexRef.current) {
      return { status: 'blocked' }
    }

    setIsOnNextPending(false)

    if (result.status === 'error') {
      setOnNextError(result.error.message)
      return { status: 'blocked' }
    }

    setOnNextError(null)
    return { status: 'success' }
  }

  // Lazy per-step field initialization: only the active step's visible fields are initialized,
  // mirroring FormNode's own initialization but scoped to one step at a time. FormNode itself
  // skips any field carrying a `stepGroup` marker (T3), deferring that responsibility here.
  useEffect(() => {
    if (formId === '' || visibleIndices.length === 0) {
      return
    }

    const activeItem = items[effectiveActiveIndex]
    const fieldDefinitions = collectResolvedFormFieldDefinitions(activeItem?.children ?? [], state, iterationContext)
    const fieldsNeedingInitialization = fieldDefinitions.filter((fieldDefinition) => {
      if (!isLayoutNodeVisible(fieldDefinition, state, iterationContext)) {
        return false
      }

      return selectFormFieldState(state, formId, fieldDefinition.fieldId) === null
    })

    if (fieldsNeedingInitialization.length === 0) {
      return
    }

    initializeForm(
      formId,
      Object.fromEntries(
        fieldsNeedingInitialization.map((fieldDefinition) => [
          fieldDefinition.fieldId,
          { defaultValue: fieldDefinition.defaultValue },
        ]),
      ),
    )
  }, [effectiveActiveIndex, items, node.id, state, iterationContext, initializeForm, formId, visibleIndices.length])

  if (visibleIndices.length === 0) {
    return null
  }

  // Shared by `handleNext` and the last-step submit interceptor: validates only the visible fields
  // of the currently active step (same engine the `form` submit uses), reporting errors in place.
  // Returns whether the step is valid to proceed past.
  function validateActiveStepFields(): boolean {
    const activeItem = items[effectiveActiveIndex]
    const activeFieldDefinitions = collectResolvedFormFieldDefinitions(activeItem?.children ?? [], state, iterationContext)
    const visibleActiveFieldDefinitions = activeFieldDefinitions.filter((fieldDefinition) =>
      isLayoutNodeVisible(fieldDefinition, state, iterationContext),
    )
    const result = validateFormFields({
      formId,
      fieldDefinitions: visibleActiveFieldDefinitions,
      state,
      iterationContext,
    })

    if (!result.isValid) {
      const defaultValuesByFieldId = Object.fromEntries(
        visibleActiveFieldDefinitions.map((fieldDefinition) => [fieldDefinition.fieldId, fieldDefinition.defaultValue]),
      )

      for (const [fieldId, error] of Object.entries(result.errorsByFieldId)) {
        setFormFieldError(formId, fieldId, error, { defaultValue: defaultValuesByFieldId[fieldId] })
      }

      return false
    }

    return true
  }

  async function handleNext() {
    if (isEditMode) {
      const currentPosition = visibleIndices.indexOf(effectiveActiveIndex)
      const nextPosition = currentPosition + 1

      if (nextPosition >= visibleIndices.length) {
        return
      }

      setActiveIndex(visibleIndices[nextPosition])
      return
    }

    if (!validateActiveStepFields()) {
      return
    }

    const activeItem = items[effectiveActiveIndex]

    if (activeItem?.onNext) {
      const gateResult = await runStepOnNextGate(effectiveActiveIndex, activeItem.onNext)

      if (gateResult.status === 'blocked') {
        return
      }
    }

    const currentPosition = visibleIndices.indexOf(effectiveActiveIndex)
    const nextPosition = currentPosition + 1

    if (nextPosition >= visibleIndices.length) {
      return
    }

    const nextIndex = visibleIndices[nextPosition]
    setActiveIndex(nextIndex)

    const maxVisitedPosition = visibleIndices.indexOf(effectiveMaxVisitedIndex)
    if (nextPosition > maxVisitedPosition) {
      setMaxVisitedIndex(nextIndex)
    }
  }

  // Gates the real `form` submit (D8): validates the last step's fields and runs its `onNext`
  // (same gate as `handleNext`), then triggers `requestSubmit()` on success so the existing submit
  // pipeline in `form-layout-node.tsx` runs unmodified. Only wired up when the last step declares
  // `onNext`; otherwise the button stays a plain `type="submit"` with no interceptor.
  async function handleLastStepOnNext(event: MouseEvent<HTMLButtonElement>) {
    // `currentTarget` is only valid for the synchronous phase of the event, same as a native DOM
    // event: it must be captured before the `await` below, not read from the event afterwards.
    const formElement = event.currentTarget.form

    if (!validateActiveStepFields()) {
      return
    }

    const activeItem = items[effectiveActiveIndex]

    if (!activeItem?.onNext) {
      return
    }

    const gateResult = await runStepOnNextGate(effectiveActiveIndex, activeItem.onNext)

    if (gateResult.status === 'blocked') {
      return
    }

    formElement?.requestSubmit()
  }

  function handleBack() {
    const currentPosition = visibleIndices.indexOf(effectiveActiveIndex)
    const previousPosition = currentPosition - 1

    if (previousPosition < 0) {
      return
    }

    setActiveIndex(visibleIndices[previousPosition])
  }

  // Indicator click for an already-visited step ahead of the active one is a forward move,
  // same as "Next" — it must not let the user leave the active step's fields invalid behind
  // them (they'd otherwise be silently corrupted and never surface until a blocked submit
  // with no visible error, since that step isn't the one currently rendered). A backward move
  // stays free, mirroring `handleBack`. Edit mode keeps full free navigation (T6): field
  // validation never applies there, same as `handleNext`'s early return.
  function handleSelectStep(index: number) {
    if (!isEditMode) {
      const currentPosition = visibleIndices.indexOf(effectiveActiveIndex)
      const targetPosition = visibleIndices.indexOf(index)

      if (targetPosition > currentPosition && !validateActiveStepFields()) {
        return
      }
    }

    setActiveIndex(index)
  }

  const activePosition = visibleIndices.indexOf(effectiveActiveIndex)
  const maxVisitedPosition = visibleIndices.indexOf(effectiveMaxVisitedIndex)
  const isFirst = activePosition === 0
  const isLast = activePosition === visibleIndices.length - 1
  const singleStep = visibleIndices.length === 1

  const indicatorRenderer = stepsIndicatorRenderers[variant]
  const indicator = indicatorRenderer({
    node,
    items,
    variant,
    visibleIndices,
    activePosition,
    maxVisitedPosition,
    effectiveActiveIndex,
    onSelectStep: handleSelectStep,
    state,
    iterationContext,
    isEditMode,
  })

  const activeItem = items[effectiveActiveIndex]
  const basePath = path ?? []
  const backLabel = resolveRuntimeTextReference(node.props.backLabel ?? 'Back', state, `steps[${node.id ?? ''}].props.backLabel`, {
    iterationContext,
  })
  const nextLabel = resolveRuntimeTextReference(node.props.nextLabel ?? 'Next', state, `steps[${node.id ?? ''}].props.nextLabel`, {
    iterationContext,
  })
  const submitLabel = resolveRuntimeTextReference(
    node.props.submitLabel ?? 'Submit',
    state,
    `steps[${node.id ?? ''}].props.submitLabel`,
    { iterationContext },
  )

  return (
    <div data-layout-node="steps" className={getStepsRootClassName(variant)}>
      {indicator}
      <div className="flex-1 flex flex-col gap-5">
        <div data-layout-node="steps-panel" className={getStepsPanelClassName()}>
          <LayoutRenderer
            nodes={activeItem?.children ?? []}
            iterationContext={iterationContext}
            path={basePath}
            parentStepItemIndex={effectiveActiveIndex}
            buildChildPath={(index) => [...basePath, { field: 'stepItem', itemIndex: effectiveActiveIndex, index }]}
          />
        </div>
        {onNextError ? (
          <p role="alert" className="text-sm text-app-danger">
            {onNextError}
          </p>
        ) : null}
        <div data-layout-node="steps-navigation" className="flex flex-row justify-end gap-3">
          {!singleStep && !isFirst ? (
            <button type="button" onClick={handleBack} className={getButtonVariantClassName('neutral', 'outline', false)}>
              {backLabel}
            </button>
          ) : null}
          {!singleStep && !isLast ? (
            <button
              type="button"
              onClick={() => void handleNext()}
              disabled={isOnNextPending}
              aria-busy={isOnNextPending}
              className={getButtonVariantClassName('primary', 'solid', false)}
            >
              {nextLabel}
            </button>
          ) : null}
          {!singleStep && !isLast && isOnNextPending ? (
            <span role="status" className="sr-only">
              Loading
            </span>
          ) : null}
          {isLast && activeItem?.onNext ? (
            <button
              type="button"
              onClick={(event) => void handleLastStepOnNext(event)}
              disabled={isOnNextPending}
              aria-busy={isOnNextPending}
              className={getButtonVariantClassName('primary', 'solid', false)}
            >
              {submitLabel}
            </button>
          ) : null}
          {isLast && !activeItem?.onNext ? (
            <button type="submit" className={getButtonVariantClassName('primary', 'solid', false)}>
              {submitLabel}
            </button>
          ) : null}
          {isLast && activeItem?.onNext && isOnNextPending ? (
            <span role="status" className="sr-only">
              Loading
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

interface StepsIndicatorProps {
  node: StepsLayoutNode
  items: StepsItem[]
  variant: StepsVariant
  visibleIndices: number[]
  activePosition: number
  maxVisitedPosition: number
  effectiveActiveIndex: number
  onSelectStep: (index: number) => void
  state: ReturnType<typeof useRuntimeState>
  iterationContext?: RuntimeIterationContext
  isEditMode: boolean
}

function renderClickableStepsIndicator(variant: 'horizontal' | 'vertical') {
  return function StepsClickableIndicator({
    node,
    items,
    visibleIndices,
    maxVisitedPosition,
    effectiveActiveIndex,
    onSelectStep,
    state,
    iterationContext,
    isEditMode,
  }: StepsIndicatorProps): ReactNode {
    return (
      <div data-layout-node="steps-indicator" className={getStepsIndicatorClassName(variant)}>
        {visibleIndices.map((index, position) => {
          const item = items[index]
          const label = resolveRuntimeTextReference(
            item.label,
            state,
            `steps[${node.id ?? ''}].props.items[${index}].label`,
            { iterationContext },
          )
          const isActive = index === effectiveActiveIndex
          const status: 'active' | 'visited' | 'upcoming' = isActive
            ? 'active'
            : position <= maxVisitedPosition
              ? 'visited'
              : 'upcoming'
          const isClickable = isEditMode || position <= maxVisitedPosition

          return (
            <button
              key={index}
              type="button"
              disabled={!isClickable}
              aria-current={isActive ? 'step' : undefined}
              onClick={isClickable ? () => onSelectStep(index) : undefined}
              className={getStepsItemWrapperClassName(isActive, variant)}
            >
              <span className={getStepsMarkerClassName(status, variant)}>{position + 1}</span>
              {' '}
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    )
  }
}

function renderProgressStepsIndicator({ visibleIndices, activePosition }: StepsIndicatorProps): ReactNode {
  return (
    <div data-layout-node="steps-indicator" className={getStepsIndicatorClassName('progress')}>
      {`Paso ${activePosition + 1} de ${visibleIndices.length}`}
    </div>
  )
}

const stepsIndicatorRenderers: Record<StepsVariant, (props: StepsIndicatorProps) => ReactNode> = {
  horizontal: renderClickableStepsIndicator('horizontal'),
  vertical: renderClickableStepsIndicator('vertical'),
  progress: renderProgressStepsIndicator,
}
