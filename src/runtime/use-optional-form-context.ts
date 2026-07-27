import { useContext } from 'react'
import { FormContext } from './form-context-value'

export function useOptionalFormContext() {
  return useContext(FormContext)
}
