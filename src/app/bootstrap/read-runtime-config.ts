export interface RuntimePageConfig {
  id: string
  title: string
  description: string
}

export interface RuntimeConfig {
  api: Record<string, unknown>
  pages: RuntimePageConfig[]
  initialPage: string
}

interface ReadRuntimeConfigOptions {
  devConfig: RuntimeConfig
  isDevelopment: boolean
  rootElement: HTMLElement | null
}

export type RuntimeConfigResult =
  | {
      status: 'ready'
      source: 'data-config' | 'dev-config'
      config: RuntimeConfig
    }
  | {
      status: 'error'
      message: string
    }

export function readRuntimeConfig({
  devConfig,
  isDevelopment,
  rootElement,
}: ReadRuntimeConfigOptions): RuntimeConfigResult {
  const serializedConfig = rootElement?.dataset.config

  if (serializedConfig) {
    try {
      return {
        status: 'ready',
        source: 'data-config',
        config: JSON.parse(serializedConfig) as RuntimeConfig,
      }
    } catch {
      return {
        status: 'error',
        message: 'The runtime config in data-config is not valid JSON.',
      }
    }
  }

  if (isDevelopment) {
    return {
      status: 'ready',
      source: 'dev-config',
      config: devConfig,
    }
  }

  return {
    status: 'error',
    message: 'No runtime config was provided in data-config for this environment.',
  }
}
