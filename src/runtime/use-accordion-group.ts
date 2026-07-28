import { useContext, useId } from 'react'
import { AccordionGroupContext } from './runtime-accordion-group-value'

export function useAccordionGroup() {
  const ctx = useContext(AccordionGroupContext)

  if (!ctx) {
    throw new Error('useAccordionGroup must be used within AccordionGroupProvider')
  }

  return { ...ctx, useId }
}
