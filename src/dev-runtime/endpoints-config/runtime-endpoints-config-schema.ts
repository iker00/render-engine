/**
 * Zod contract for the external endpoints config block (`data-endpoints-config` / `src/dev/endpoints-config.json`).
 * Declares the base URL plus per-operation path/tokenId for the three PlataGes operations the dev editor
 * consumes (search texts, batch translations, save config). Unlike `validateRuntimeConfig`, this module has no
 * `ready | error` surface: any structurally invalid input collapses to `undefined`, matching an absent config
 * (FR3) — the caller does not need to distinguish "not declared" from "declared but malformed".
 */
import { z } from 'zod'

const endpointOperationSchema = z
  .object({
    path: z.string(),
    tokenId: z.string(),
  })
  .strip()

const saveConfigOperationSchema = z
  .object({
    path: z.string(),
    tokenId: z.string(),
    idGestion: z.number().int(),
    idSeccion: z.number().int(),
    idObjetoOcurrencia: z.number().int(),
  })
  .strip()

const runtimeEndpointsConfigSchema = z
  .object({
    baseUrl: z.string(),
    operations: z
      .object({
        searchTexts: endpointOperationSchema.optional(),
        getTranslationsBatch: endpointOperationSchema.optional(),
        saveConfig: saveConfigOperationSchema.optional(),
      })
      .strip()
      .optional(),
  })
  .strip()

export type RuntimeEndpointsConfig = z.infer<typeof runtimeEndpointsConfigSchema>

export type EndpointOperationKey = 'searchTexts' | 'getTranslationsBatch' | 'saveConfig'

export function parseRuntimeEndpointsConfig(raw: unknown): RuntimeEndpointsConfig | undefined {
  const result = runtimeEndpointsConfigSchema.safeParse(raw)
  return result.success ? result.data : undefined
}
