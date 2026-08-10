// Pure predicate used to decide which `translations` keys are refreshable via the provider
// (Decisión D6): only keys that are plain non-negative integers, e.g. PlataGes' `idTexto`.
export function isNumericTranslationKey(key: string): boolean {
  return /^\d+$/.test(key)
}
