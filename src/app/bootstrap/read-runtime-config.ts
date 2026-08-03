import {
  validateRuntimeConfig,
  type RuntimeConfig,
  type RuntimeConfigError,
  type RuntimePageConfig,
} from '../../config/runtime-config'

export type { RuntimeConfig, RuntimeConfigError, RuntimePageConfig }

interface ReadRuntimeConfigOptions {
  // Raw, pre-validation config (same as data-config's parsed JSON) — always run through
  // `validateRuntimeConfig` below, which accepts `unknown` and normalizes shorthand forms (e.g.
  // preloads keyed by operation name) into the `RuntimeConfig` shape. Typing this as `RuntimeConfig`
  // itself would be describing the output, not the input.
  devConfig: unknown
  isDevelopment: boolean
  rootElement: HTMLElement | null
}

export type RuntimeConfigResult =
  | {
      status: 'ready'
      source: 'data-config' | 'dev-config'
      config: RuntimeConfig
      page: RuntimePageConfig
    }
  | {
      status: 'error'
      error: RuntimeConfigError
    }

export function readRuntimeConfig({
  devConfig,
  isDevelopment,
  rootElement,
}: ReadRuntimeConfigOptions): RuntimeConfigResult {
  const serializedConfig = rootElement?.dataset.config

  if (serializedConfig) {
    try {
      const validationResult = validateRuntimeConfig(JSON.parse(serializedConfig))

      if (validationResult.status === 'error') {
        return validationResult
      }

      return {
        status: 'ready',
        source: 'data-config',
        config: validationResult.config,
        page: validationResult.page,
      }
    } catch {
      return {
        status: 'error',
        error: {
          code: 'invalid-json',
          displayMode: 'always',
          message: 'The runtime config in data-config is not valid JSON.',
        },
      }
    }
  }

  if (isDevelopment) {
    const validationResult = validateRuntimeConfig(devConfig)

    if (validationResult.status === 'error') {
      return validationResult
    }

    return {
      status: 'ready',
      source: 'dev-config',
      config: validationResult.config,
      page: validationResult.page,
    }
  }

  return {
    status: 'error',
    error: {
      code: 'missing-config',
      displayMode: 'always',
      message: 'No runtime config was provided in data-config for this environment.',
    },
  }
}
