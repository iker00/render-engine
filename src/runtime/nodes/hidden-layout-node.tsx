import { useEffect } from 'react'
import type { HiddenLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../use-optional-form-context'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeValueWithOptions } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'

interface HiddenNodeProps {
  node: HiddenLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function HiddenNode({ node, iterationContext }: HiddenNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { initializeForm } = useRuntimeStateActions()

  useEffect(() => {
    if (!formContext) {
      return
    }

    const resolvedValue = resolveRuntimeValueWithOptions(node.props.value, state, { iterationContext })
    const value = resolvedValue.status === 'resolved' ? resolvedValue.value : node.props.value

    initializeForm(formContext.formId, {
      [node.props.fieldId]: {
        defaultValue: value,
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
