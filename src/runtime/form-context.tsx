import { createContext, useContext } from 'react'

interface FormContextValue {
  formId: string
}

const FormContext = createContext<FormContextValue | null>(null)

export const FormContextProvider = FormContext.Provider

export function useOptionalFormContext() {
  return useContext(FormContext)
}

