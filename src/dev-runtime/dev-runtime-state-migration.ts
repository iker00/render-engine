import type { LayoutNode, RuntimeConfig } from '../config/runtime-config'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'

type FormFieldMap = Map<string, Set<string>>

export function migrateRuntimeStateAcrossConfig(
  prevState: RuntimeState,
  prevConfig: RuntimeConfig,
  nextConfig: RuntimeConfig,
  options?: { dataValues?: Record<string, unknown> },
): RuntimeState {
  void prevConfig // prevState drives state; prevConfig is reserved for future use

  const formFieldMap = buildFormFieldMap(nextConfig)
  const nextForms = migrateForms(prevState.forms, formFieldMap)
  const nextQueries = migrateQueries(prevState.queries, nextConfig, options?.dataValues)
  const { navigation: nextNavigation, resolvedPageId, resolvedParams } = migrateNavigation(
    prevState.navigation.currentPageId,
    prevState.navigation.history[prevState.navigation.currentEntryIndex]?.params ?? {},
    nextConfig,
  )
  const nextPageEntry = buildPageEntry(resolvedPageId, resolvedParams, nextConfig)

  return {
    navigation: nextNavigation,
    forms: nextForms,
    queries: nextQueries,
    pageEntry: nextPageEntry,
    modal: prevState.modal,
    i18n: prevState.i18n,
    tokens: prevState.tokens,
  }
}

function buildFormFieldMap(config: RuntimeConfig): FormFieldMap {
  const formFieldMap: FormFieldMap = new Map()
  for (const page of config.pages) {
    walkLayoutForForms(page.layout, formFieldMap)
  }
  return formFieldMap
}

function walkLayoutForForms(nodes: LayoutNode[], formFieldMap: FormFieldMap): void {
  for (const node of nodes) {
    if (node.type === 'container' && node.children) {
      walkLayoutForForms(node.children, formFieldMap)
    } else if (node.type === 'repeater') {
      walkLayoutForForms(node.props.template, formFieldMap)
    } else if (node.type === 'form') {
      const fieldIds = new Set<string>()
      if (node.children) {
        collectFieldIdsFromNodes(node.children, fieldIds)
      }
      formFieldMap.set(node.id, fieldIds)
    }
  }
}

function collectFieldIdsFromNodes(nodes: LayoutNode[], fieldIds: Set<string>): void {
  for (const node of nodes) {
    if (node.type === 'container' && node.children) {
      collectFieldIdsFromNodes(node.children, fieldIds)
    } else if (node.type === 'repeater') {
      collectFieldIdsFromNodes(node.props.template, fieldIds)
    } else if (
      node.type === 'input' ||
      node.type === 'textarea' ||
      node.type === 'select' ||
      node.type === 'radioGroup' ||
      node.type === 'checkboxGroup'
    ) {
      fieldIds.add(node.props.fieldId)
    }
  }
}

function migrateForms(
  prevForms: RuntimeState['forms'],
  formFieldMap: FormFieldMap,
): RuntimeState['forms'] {
  const nextForms: RuntimeState['forms'] = {}
  for (const [formId, formState] of Object.entries(prevForms)) {
    const survivingFields = formFieldMap.get(formId)
    if (survivingFields === undefined) {
      continue
    }
    const nextFormState: RuntimeState['forms'][string] = {}
    for (const [fieldId, fieldState] of Object.entries(formState)) {
      if (survivingFields.has(fieldId)) {
        nextFormState[fieldId] = fieldState
      }
    }
    nextForms[formId] = nextFormState
  }
  return nextForms
}

function migrateQueries(
  prevQueries: RuntimeState['queries'],
  nextConfig: RuntimeConfig,
  dataValues?: Record<string, unknown>,
): RuntimeState['queries'] {
  const nextQueries: RuntimeState['queries'] = {}
  const apiKeys = new Set(Object.keys(nextConfig.api))
  for (const [queryName, queryState] of Object.entries(prevQueries)) {
    if (apiKeys.has(queryName)) {
      nextQueries[queryName] = queryState
    }
  }
  if (dataValues) {
    for (const [queryName, data] of Object.entries(dataValues)) {
      if (!(queryName in nextQueries)) {
        nextQueries[queryName] = { status: 'success', data, error: null, requestSignature: null }
      }
    }
  }
  return nextQueries
}

function migrateNavigation(
  currentPageId: string,
  currentParams: RuntimeState['navigation']['history'][number]['params'],
  nextConfig: RuntimeConfig,
): {
  navigation: RuntimeState['navigation']
  resolvedPageId: string
  resolvedParams: RuntimeState['navigation']['history'][number]['params']
} {
  const pageExists = nextConfig.pages.some((page) => page.id === currentPageId)
  const resolvedPageId = pageExists ? currentPageId : nextConfig.initialPage
  const resolvedParams = pageExists ? { ...currentParams } : {}

  return {
    navigation: {
      currentPageId: resolvedPageId,
      history: [{ entryId: 0, pageId: resolvedPageId, params: resolvedParams }],
      currentEntryIndex: 0,
      lastError: null,
    },
    resolvedPageId,
    resolvedParams,
  }
}

function buildPageEntry(
  pageId: string,
  params: RuntimeState['pageEntry']['params'],
  nextConfig: RuntimeConfig,
): RuntimeState['pageEntry'] {
  const page = nextConfig.pages.find((p) => p.id === pageId)
  const preloadNames = page?.preloads?.map((preload) => preload.operationName) ?? []
  return {
    entryId: 0,
    pageId,
    params: { ...params },
    preloadNames,
    status: 'idle',
  }
}
