import {
  parseRuntimeEndpointsConfig,
  type RuntimeEndpointsConfig,
} from '../../dev-runtime/endpoints-config/runtime-endpoints-config-schema'

interface ReadRuntimeEndpointsConfigOptions {
  devEndpointsConfig: unknown
  rootElement: HTMLElement | null
}

/**
 * Reads the external endpoints config at bootstrap time following the same
 * host-attribute → local file fallback pattern as `readRuntimeDataValues`.
 * Unlike `readRuntimeConfig`, this has no `ready | error` surface: FR3 requires
 * a structurally invalid config to collapse to `undefined`, exactly like an
 * absent one, so the rest of the editor never needs to distinguish the two.
 */
export function readRuntimeEndpointsConfig({
  devEndpointsConfig,
  rootElement,
}: ReadRuntimeEndpointsConfigOptions): RuntimeEndpointsConfig | undefined {
  const serializedConfig = rootElement?.dataset.endpointsConfig

  if (serializedConfig !== undefined) {
    let parsed: unknown

    try {
      parsed = JSON.parse(serializedConfig)
    } catch {
      return undefined
    }

    return parseRuntimeEndpointsConfig(parsed)
  }

  return parseRuntimeEndpointsConfig(devEndpointsConfig)
}
