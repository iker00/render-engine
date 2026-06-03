const DEFAULT_ACTIVE_LANGUAGE = 'es'

interface ReadRuntimeActiveLanguageOptions {
  rootElement: HTMLElement | null
}

export function readRuntimeActiveLanguage({ rootElement }: ReadRuntimeActiveLanguageOptions): string {
  const lang = rootElement?.dataset.lang

  if (!lang || lang.trim() === '') {
    return DEFAULT_ACTIVE_LANGUAGE
  }

  return lang
}
