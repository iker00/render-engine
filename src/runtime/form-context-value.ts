import { createContext } from 'react'
import type { RuntimeInstanceScope } from './runtime-references/runtime-instance-scope'

export interface FormContextValue {
  formId: string
  /**
   * Cadena de scope ambiente del `form` que provee este contexto (T05 / feature
   * reusable-node-groups): permite a cada field node derivar la clave efectiva de store
   * (`deriveScopedStateKey(formId, scopeChain)`) sin que `layout-node-renderer.tsx` tenga que
   * pasarles `scopeChain` de forma individual — viaja junto al `formId` ya establecido.
   * Opcional para no romper construcciones manuales de este contexto (p. ej. en tests) que
   * predatan T05; ausente equivale a `EMPTY_INSTANCE_SCOPE` (cero regresión).
   */
  scopeChain?: RuntimeInstanceScope
}

export const FormContext = createContext<FormContextValue | null>(null)
