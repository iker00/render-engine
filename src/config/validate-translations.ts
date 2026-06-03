import type { RuntimeTranslationsConfig } from './runtime-config-types'
import { runtimeTranslationsSchema } from './runtime-config-zod'
import { invalidLayout } from './runtime-config-validation-errors'

type TranslationsValidationResult =
  | { status: 'ok'; translations: RuntimeTranslationsConfig }
  | { status: 'error'; error: ReturnType<typeof invalidLayout>['error'] }

export function validateTranslations(
  rawTranslations: unknown,
): TranslationsValidationResult {
  // Must be a plain object, not an array or primitive
  if (
    rawTranslations === null ||
    typeof rawTranslations !== 'object' ||
    Array.isArray(rawTranslations)
  ) {
    return {
      status: 'error',
      error: invalidLayout(
        'The runtime config field "translations" must be a plain object.',
      ).error,
    }
  }

  const result = runtimeTranslationsSchema.safeParse(rawTranslations)

  if (!result.success) {
    const issue = result.error.issues[0]

    if (issue) {
      const path = issue.path

      if (path.length === 0) {
        return {
          status: 'error',
          error: invalidLayout(
            'The runtime config field "translations" must be a plain object.',
          ).error,
        }
      }

      // path[0] = translation key, path[1] = lang slug (if present)
      const translationKey = path[0] as string

      if (path.length >= 2) {
        const langSlug = path[1] as string
        return {
          status: 'error',
          error: invalidLayout(
            `The runtime config field "translations.${translationKey}.${langSlug}" must be a string.`,
          ).error,
        }
      }

      // path.length === 1: entry value is not a valid lang map
      return {
        status: 'error',
        error: invalidLayout(
          `The runtime config field "translations.${translationKey}" must be an object mapping language slugs to strings.`,
        ).error,
      }
    }

    return {
      status: 'error',
      error: invalidLayout(
        'The runtime config field "translations" has an invalid shape.',
      ).error,
    }
  }

  return { status: 'ok', translations: result.data }
}
