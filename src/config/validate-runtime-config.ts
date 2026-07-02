import type {
  LayoutNode,
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
import { validateFileManagerSemantics } from './validate-file-manager-nodes'
import { validateFileInputSemantics } from './validate-file-input-nodes'
import { validateTranslations } from './validate-translations'
import { validateTokensConfig } from './validate-tokens-config'

export function validateRuntimeConfig(rawConfig: unknown): RuntimeConfigValidationResult {
  // Extract and validate the optional translations block before the shell schema strips it
  let validatedTranslations: ReturnType<typeof validateTranslations> | null = null

  if (isRecord(rawConfig) && 'translations' in rawConfig && rawConfig.translations !== undefined) {
    validatedTranslations = validateTranslations(rawConfig.translations)

    if (validatedTranslations.status === 'error') {
      return { status: 'error', error: validatedTranslations.error }
    }
  }

  // Extract the optional tokens block before the shell schema strips it
  const rawTokens = isRecord(rawConfig) && 'tokens' in rawConfig ? rawConfig.tokens : undefined

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

  // Validate the tokens block after api is validated (cross-check needs api operation names)
  const tokensResult = validateTokensConfig(rawTokens, new Set(Object.keys(apiResult.api)))

  if (tokensResult.status === 'error') {
    return { status: 'error', error: tokensResult.error }
  }

  const pageShellResults: Array<{
    id: string
    preloads?: RuntimePreloadConfig[]
    title?: string
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

      if (pagePath === 'title') {
        return invalidLayout(`The page at "pages[${index}].title" must be a string.`)
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

    const pageShellEntry: {
      id: string
      preloads?: RuntimePreloadConfig[]
      title?: string
      layout: LayoutNodeCollection
    } = {
      id: pageShellResult.data.id,
      preloads: preloadsResult.preloads,
      layout: pageShellResult.data.layout as LayoutNodeCollection,
    }

    if (pageShellResult.data.title !== undefined) {
      pageShellEntry.title = pageShellResult.data.title
    }

    pageShellResults.push(pageShellEntry)
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

    if (pageShell.title !== undefined) {
      pageConfig.title = pageShell.title
    }

    pages.push(pageConfig)
  }

  const config: RuntimeConfig = {
    api: apiResult.api,
    pages,
    initialPage: configShellResult.data.initialPage,
  }

  if (validatedTranslations !== null && validatedTranslations.status === 'ok') {
    config.translations = validatedTranslations.translations
  }

  if (tokensResult.status === 'ready' && Object.keys(tokensResult.tokens).length > 0) {
    config.tokens = tokensResult.tokens
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

  const fileManagerSemanticsError = validateFileManagerSemantics(config)

  if (fileManagerSemanticsError) {
    return fileManagerSemanticsError
  }

  const fileInputSemanticsError = validateFileInputSemantics(config)

  if (fileInputSemanticsError) {
    return fileInputSemanticsError
  }

  const modalRefsError = validateModalReferences(config)

  if (modalRefsError) {
    return modalRefsError
  }

  return {
    status: 'ready',
    config,
    page,
  }
}

function validateModalReferences(
  config: RuntimeConfig,
): { status: 'error'; error: RuntimeConfigError } | null {
  const seenModalIds = new Map<string, string>()

  for (const page of config.pages) {
    const error = collectModalIds(page.layout, 'layout', page.id, seenModalIds)
    if (error) return error
  }

  for (const page of config.pages) {
    const error = checkModalRefs(page.layout, 'layout', page.id, seenModalIds, false)
    if (error) return error
  }

  return null
}

function collectModalIds(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  seenModalIds: Map<string, string>,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const nodePath = `${path}[${i}]`

    const fallbackError = collectModalIdsInFallbacks(node, nodePath, seenModalIds)
    if (fallbackError) return fallbackError

    if (node.type === 'modal') {
      if (seenModalIds.has(node.id)) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}.id": duplicate modal id "${node.id}".`)
      }
      seenModalIds.set(node.id, nodePath)

      if (node.children) {
        const error = collectModalIds(node.children, `${nodePath}.children`, pageId, seenModalIds)
        if (error) return error
      }
    } else if ((node.type === 'container' || node.type === 'form') && node.children) {
      const error = collectModalIds(node.children, `${nodePath}.children`, pageId, seenModalIds)
      if (error) return error
    } else if (node.type === 'repeater') {
      const error = collectModalIds(node.props.template, `${nodePath}.props.template`, pageId, seenModalIds)
      if (error) return error
    }
  }

  return null
}

function collectModalIdsInFallbacks(
  node: LayoutNode,
  nodePath: string,
  seenModalIds: Map<string, string>,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (!node.queryStateFeedback?.states) return null

  for (const [stateName, rule] of Object.entries(node.queryStateFeedback.states)) {
    if (!rule || rule.mode !== 'fallback') continue

    const error = collectModalIds(
      [...rule.fallback],
      `${nodePath}.queryStateFeedback.states.${stateName}.fallback`,
      nodePath,
      seenModalIds,
    )
    if (error) return error
  }

  return null
}

function checkModalRefs(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  modalIds: Map<string, string>,
  insideRepeaterTemplate: boolean,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const nodePath = `${path}[${i}]`

    const fallbackError = checkModalRefsInFallbacks(node, nodePath, pageId, modalIds, insideRepeaterTemplate)
    if (fallbackError) return fallbackError

    if (node.type === 'button' && node.props.action) {
      const { action } = node.props
      if ((action.type === 'openModal' || action.type === 'closeModal') && !modalIds.has(action.modalId)) {
        return invalidLayout(
          `Page "${pageId}" has an invalid layout at "${nodePath}.props.action.modalId": unknown modal "${action.modalId}".`,
        )
      }
    }

    if (node.type === 'modal') {
      if (insideRepeaterTemplate && node.props?.defaultOpen === true) {
        return invalidLayout(
          `Page "${pageId}" has an invalid layout at "${nodePath}.props.defaultOpen": modal defaultOpen is not supported inside a repeater template.`,
        )
      }

      if (node.children) {
        const error = checkModalRefs(node.children, `${nodePath}.children`, pageId, modalIds, insideRepeaterTemplate)
        if (error) return error
      }
    } else if ((node.type === 'container' || node.type === 'form') && node.children) {
      const error = checkModalRefs(node.children, `${nodePath}.children`, pageId, modalIds, insideRepeaterTemplate)
      if (error) return error
    } else if (node.type === 'repeater') {
      const error = checkModalRefs(node.props.template, `${nodePath}.props.template`, pageId, modalIds, true)
      if (error) return error
    }
  }

  return null
}

function checkModalRefsInFallbacks(
  node: LayoutNode,
  nodePath: string,
  pageId: string,
  modalIds: Map<string, string>,
  insideRepeaterTemplate: boolean,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (!node.queryStateFeedback?.states) return null

  for (const [stateName, rule] of Object.entries(node.queryStateFeedback.states)) {
    if (!rule || rule.mode !== 'fallback') continue

    const error = checkModalRefs(
      [...rule.fallback],
      `${nodePath}.queryStateFeedback.states.${stateName}.fallback`,
      pageId,
      modalIds,
      insideRepeaterTemplate,
    )
    if (error) return error
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
