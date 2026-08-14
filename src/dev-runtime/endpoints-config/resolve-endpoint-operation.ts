/**
 * Pure resolver that turns a declared endpoints config + a business operation key into a concrete
 * `{ url, token }` pair, or explains why that pair isn't available yet. Shared by every consumer that needs to
 * call a PlataGes operation (save config, search texts, batch translations) so the `tokenId` → `tokens.*` lookup
 * is implemented once (D2 of the feature design).
 */
import type { RuntimeTokensConfig } from '../../config/runtime-config-types'
import type { EndpointOperationKey, RuntimeEndpointsConfig } from './runtime-endpoints-config-schema'

export type EndpointOperationUnavailableReason = 'operation-not-declared' | 'token-not-resolvable'

export type ResolvedEndpointOperation =
  | { status: 'ready'; url: string; token: string }
  | { status: 'unavailable'; reason: EndpointOperationUnavailableReason }

export function resolveEndpointOperation(
  endpointsConfig: RuntimeEndpointsConfig | undefined,
  operationKey: EndpointOperationKey,
  tokens: RuntimeTokensConfig | undefined,
): ResolvedEndpointOperation {
  const operation = endpointsConfig?.operations?.[operationKey]

  if (!operation) {
    return { status: 'unavailable', reason: 'operation-not-declared' }
  }

  const token = tokens?.[operation.tokenId]?.value

  if (token === undefined) {
    return { status: 'unavailable', reason: 'token-not-resolvable' }
  }

  return {
    status: 'ready',
    url: `${endpointsConfig.baseUrl}${operation.path}`,
    token,
  }
}
