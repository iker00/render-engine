import type {
  LayoutNodeCollection,
  RuntimeConfig,
  RuntimeConfigError,
  RuntimeConfigValidationResult,
  RuntimePageConfig,
  RuntimePreloadConfig,
} from './runtime-config-types'
import {
  runtimeConfigShellSchema,
  runtimePageShellSchema,
} from './runtime-config-zod'
import { initialPageNotFound, invalidLayout } from './runtime-config-validation-errors'
import { validateApiConfig } from './validate-api-config'
import { validatePagePreloads } from './validate-preloads'
import { validateRuntimeApiRequestParams, validateActionTargets } from './validate-actions-visibility'
import { validateLayoutCollection } from './validate-layout-nodes'
import { validateFormSemantics, validateExecutionRequestParams } from './validate-form-nodes'

export function validateRuntimeConfig(rawConfig: unknown): RuntimeConfigValidationResult {
  const configShellResult = runtimeConfigShellSchema.safeParse(rawConfig)

  if (!configShellResult.success) {
    const issue = configShellResult.error.issues[0]

    if (!issue || issue.path.length === 0) {
      return invalidLayout('The runtime config must be an object.')
    }

    if (issue.path[0] === 'api') {
      return invalidLayout('The runtime config field "api" must be an object.')
    }

    if (issue.path[0] === 'pages') {
      return invalidLayout('The runtime config field "pages" must be an array.')
    }

    if (issue.path[0] === 'initialPage') {
      return invalidLayout('The runtime config field "initialPage" must be a non-empty string.')
    }

    return invalidLayout('The runtime config must be an object.')
  }

  const apiResult = validateApiConfig(configShellResult.data.api)

  if (apiResult.status === 'error') {
    return apiResult
  }

  const pageShellResults: Array<{
    id: string
    preloads?: RuntimePreloadConfig[]
    layout: LayoutNodeCollection
  }> = []

  for (let index = 0; index < configShellResult.data.pages.length; index += 1) {
    const pageShellResult = runtimePageShellSchema.safeParse(configShellResult.data.pages[index])

    if (!pageShellResult.success) {
      const issue = pageShellResult.error.issues[0]
      const pagePath = issue?.path[0]

      if (pagePath === 'id') {
        return invalidLayout(`The page at "pages[${index}].id" must be a non-empty string.`)
      }

      if (pagePath === 'preloads') {
        return invalidLayout(`The page at "pages[${index}].preloads" must be an array of preload objects.`)
      }

      if (pagePath === 'layout') {
        const rawPage = configShellResult.data.pages[index]
        const pageId = isRecord(rawPage) && typeof rawPage.id === 'string' ? rawPage.id : `pages[${index}]`
        return invalidLayout(`Page "${pageId}" has an invalid layout at "layout".`)
      }

      return invalidLayout(`The page at "pages[${index}]" must be an object.`)
    }

    const preloadsResult = validatePagePreloads(
      pageShellResult.data.preloads,
      index,
      validateRuntimeApiRequestParams,
    )

    if (preloadsResult.status === 'error') {
      return preloadsResult
    }

    pageShellResults.push({
      id: pageShellResult.data.id,
      preloads: preloadsResult.preloads,
      layout: pageShellResult.data.layout as LayoutNodeCollection,
    })
  }

  const pages: RuntimePageConfig[] = []

  for (let index = 0; index < pageShellResults.length; index += 1) {
    const pageShell = pageShellResults[index]
    const layoutResult = validateLayoutCollection(pageShell.layout, 'layout', pageShell.id)

    if (layoutResult.status === 'error') {
      return layoutResult
    }

    const pageConfig: RuntimePageConfig = {
      id: pageShell.id,
      layout: layoutResult.nodes,
    }

    if (pageShell.preloads !== undefined) {
      pageConfig.preloads = pageShell.preloads
    }

    pages.push(pageConfig)
  }

  const config: RuntimeConfig = {
    api: apiResult.api,
    pages,
    initialPage: configShellResult.data.initialPage,
  }

  const page = config.pages.find((entry) => entry.id === config.initialPage)

  if (!page) {
    return initialPageNotFound(config.initialPage)
  }

  const actionTargetError = validateActionTargets(config)

  if (actionTargetError) {
    return actionTargetError
  }

  const formSemanticError = validateFormSemantics(config)

  if (formSemanticError) {
    return formSemanticError
  }

  const requestParamsError = validateExecutionRequestParams(config)

  if (requestParamsError) {
    return requestParamsError
  }

  return {
    status: 'ready',
    config,
    page,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
