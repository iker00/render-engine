// The context itself lives in `./form-context-value` (not here) so this file's only export is
// the component `FormContextProvider` — Fast Refresh requires component-only modules to
// preserve state across edits, and it also asks for React contexts to live in their own file.
import { FormContext } from './form-context-value'

export const FormContextProvider = FormContext.Provider

