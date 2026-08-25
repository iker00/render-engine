import { useEffect, useState, type ReactNode } from 'react'
import type { StepsItem, StepsLayoutNode, StepsVariant } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { useOptionalFormContext } from '../use-optional-form-context'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'
import { LayoutRenderer } from '../layout-renderer'
import { isLayoutNodeVisible, matchesVisibilityRule } from '../runtime-layout-visibility'
import { validateFormFields } from '../runtime-form-validations'
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
}

export function StepsNode({ node, iterationContext }: StepsNodeProps) {
  const state = useRuntimeState()
  const { initializeForm, setFormFieldError } = useRuntimeStateActions()
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
      formId={formContext?.formId ?? ''}
      iterationContext={iterationContext}
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
  formId: string
  iterationContext?: RuntimeIterationContext
}

function StepsNodeContent({
  node,
  items,
  variant,
  state,
  initializeForm,
  setFormFieldError,
  formId,
  iterationContext,
}: StepsNodeContentProps) {
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

  function handleNext() {
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

      return
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

  function handleBack() {
    const currentPosition = visibleIndices.indexOf(effectiveActiveIndex)
    const previousPosition = currentPosition - 1

    if (previousPosition < 0) {
      return
    }

    setActiveIndex(visibleIndices[previousPosition])
  }

  function handleSelectStep(index: number) {
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
  })

  const activeItem = items[effectiveActiveIndex]
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
          {activeItem?.children && activeItem.children.length > 0 ? (
            <LayoutRenderer nodes={activeItem.children} iterationContext={iterationContext} />
          ) : null}
        </div>
        <div data-layout-node="steps-navigation" className="flex flex-row justify-end gap-3">
          {!singleStep && !isFirst ? (
            <button type="button" onClick={handleBack} className={getButtonVariantClassName('neutral', 'outline', false)}>
              {backLabel}
            </button>
          ) : null}
          {!singleStep && !isLast ? (
            <button type="button" onClick={handleNext} className={getButtonVariantClassName('primary', 'solid', false)}>
              {nextLabel}
            </button>
          ) : null}
          {isLast ? (
            <button type="submit" className={getButtonVariantClassName('primary', 'solid', false)}>
              {submitLabel}
            </button>
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
          const isClickable = position <= maxVisitedPosition

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
