import { createContext } from 'react'

export interface FormContextValue {
  formId: string
}

export const FormContext = createContext<FormContextValue | null>(null)
