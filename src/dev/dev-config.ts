/**
 * Orquestador de configuración para desarrollo local.
 *
 * Auto-descubre todos los configs de pantalla en tests-config/ y todos los mocks
 * en mocks/, los fusiona y entrega un único objeto de configuración al DevRuntime.
 *
 * Convención:
 *   - tests-config/{nombre}.json  → config de una pantalla (misma estructura que producción)
 *   - mocks/{operationName}.json  → datos de respuesta mock para esa operación API
 *
 * Para añadir una pantalla nueva: soltar un JSON en tests-config/
 * Para añadir un mock nuevo: soltar un JSON en mocks/ (nombre = nombre de la operación)
 * Para cambiar la página de arranque: editar dev-settings.json
 */

import settings from './dev-settings.json'

const configModules = import.meta.glob<{ default: Record<string, unknown> }>(
  './tests-config/*.json',
  { eager: true },
)

const mockModules = import.meta.glob<{ default: unknown }>(
  './mocks/*.json',
  { eager: true },
)

const mocksByOperation: Record<string, unknown> = Object.fromEntries(
  Object.entries(mockModules).map(([path, mod]) => {
    const operationName = path.replace('./mocks/', '').replace('.json', '')
    return [operationName, mod.default]
  }),
)

const mergedApi: Record<string, unknown> = {}
const mergedPages: unknown[] = []
const mergedTokens: Record<string, unknown> = {}

for (const mod of Object.values(configModules)) {
  const config = mod.default as {
    api?: Record<string, unknown>
    pages?: unknown[]
    tokens?: Record<string, unknown>
  }

  for (const [tokenId, token] of Object.entries(config.tokens ?? {})) {
    mergedTokens[tokenId] = token
  }

  for (const [opName, op] of Object.entries(config.api ?? {})) {
    mergedApi[opName] =
      opName in mocksByOperation
        ? { ...(op as object), mockResponse: mocksByOperation[opName] }
        : op
  }

  mergedPages.push(...(config.pages ?? []))
}

export default {
  api: mergedApi,
  pages: mergedPages,
  initialPage: settings.initialPage,
  ...(Object.keys(mergedTokens).length > 0 ? { tokens: mergedTokens } : {}),
}
