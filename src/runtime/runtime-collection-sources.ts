import type {
  CheckboxGroupLayoutNode,
  ListLayoutNodeItems,
  RadioGroupLayoutNode,
  RuntimeCollectionObjectItem,
  SelectDynamicItemsSource,
  SelectLayoutNodeItems,
  SelectManualScalarItemsSource,
} from '../config/runtime-config'
import type { RuntimeReferenceSurface } from './runtime-references/runtime-reference-diagnostics'
import { hasRuntimeTemplateDelimiter } from './runtime-references/runtime-reference-parser'
import type { RuntimeIterationContext } from './runtime-references/runtime-reference-resolver'
import {
  resolveRuntimeReference,
  resolveRuntimeVisibleValue,
} from './runtime-references/runtime-reference-resolver'
import type { RuntimeState } from './runtime-state/runtime-state-types'

interface ResolvedCollectionSource {
  items: unknown[]
  itemBasePath: string
}

export interface ResolvedSelectCollectionItem {
  label: string
  value: string
}

type ChoiceCollectionSurface = 'select.props.items' | 'radioGroup.props.items' | 'checkboxGroup.props.items'
type ChoiceCollectionItems =
  | SelectLayoutNodeItems
  | RadioGroupLayoutNode['props']['items']
  | CheckboxGroupLayoutNode['props']['items']
type ChoiceProjectionSurface = {
  label: RuntimeReferenceSurface
  value: RuntimeReferenceSurface
}

const CHOICE_PROJECTION_SURFACES: Record<ChoiceCollectionSurface, ChoiceProjectionSurface> = {
  'select.props.items': {
    label: 'select.props.items.label',
    value: 'select.props.items.value',
  },
  'radioGroup.props.items': {
    label: 'radioGroup.props.items.label',
    value: 'radioGroup.props.items.value',
  },
  'checkboxGroup.props.items': {
    label: 'checkboxGroup.props.items.label',
    value: 'checkboxGroup.props.items.value',
  },
}

export function resolveListCollectionItems(items: ListLayoutNodeItems, state: RuntimeState) {
  return resolveListCollectionItemsWithOptions(items, state)
}

export function resolveCollectionSourceItems(
  source: string,
  state: RuntimeState,
  options: { iterationContext?: RuntimeIterationContext } = {},
) {
  const result = resolveRuntimeReference(source, state, {
    iterationContext: options.iterationContext,
  })

  if (result.status !== 'resolved' || !Array.isArray(result.value)) {
    return []
  }

  return result.value
}

export function resolveListCollectionItemsWithOptions(
  items: ListLayoutNodeItems,
  state: RuntimeState,
  options: { iterationContext?: RuntimeIterationContext } = {},
) {
  if (Array.isArray(items)) {
    return items.map((item) =>
      resolveInterpolatedCollectionString(item, state, 'list.props.items', {
        iterationContext: options.iterationContext,
      }),
    )
  }

  const collectionSource = resolveCollectionSource(items, state, 'list.props.items', options)

  if (collectionSource === null) {
    return []
  }

  if ('itemText' in items && typeof items.itemText === 'string') {
    return projectObjectCollectionToTextItems(collectionSource, items.itemText, state, 'list.props.items')
  }

  return projectScalarCollectionToTextItems(collectionSource, state, 'list.props.items', {
    interpolateStrings: 'values' in items,
    iterationContext: options.iterationContext,
  })
}

export function resolveSelectCollectionItems(
  items: SelectLayoutNodeItems,
  state: RuntimeState,
  options: { iterationContext?: RuntimeIterationContext } = {},
) {
  return resolveChoiceCollectionItems(items, state, 'select.props.items', options)
}

export function resolveChoiceCollectionItems(
  items: ChoiceCollectionItems,
  state: RuntimeState,
  surface: ChoiceCollectionSurface,
  options: { iterationContext?: RuntimeIterationContext } = {},
) {
  if (Array.isArray(items)) {
    const projectionSurfaces = CHOICE_PROJECTION_SURFACES[surface]

    return items.map((item) => ({
      label: resolveInterpolatedCollectionString(item.label, state, projectionSurfaces.label, {
        iterationContext: options.iterationContext,
      }),
      value:
        typeof item.value === 'string'
          ? resolveInterpolatedCollectionString(item.value, state, projectionSurfaces.value, {
              iterationContext: options.iterationContext,
            })
          : String(item.value),
    }))
  }

  const collectionSource = resolveCollectionSource(items, state, surface, options)

  if (collectionSource === null) {
    return []
  }

  if ('label' in items && 'value' in items && typeof items.label === 'string' && typeof items.value === 'string') {
    return projectObjectCollectionToSelectItems(collectionSource, items.label, items.value, state, surface)
  }

  return projectScalarCollectionToSelectItems(collectionSource, surface)
}

export function normalizeSelectFieldValue(
  items: SelectLayoutNodeItems,
  state: RuntimeState,
  value: unknown,
) {
  return normalizeChoiceFieldValue(items, state, value, { multiple: false, surface: 'select.props.items' })
}

export function normalizeChoiceFieldValue(
  items: ChoiceCollectionItems,
  state: RuntimeState,
  value: unknown,
  options: { multiple: boolean; surface: ChoiceCollectionSurface; iterationContext?: RuntimeIterationContext },
) {
  const resolvedItems = resolveChoiceCollectionItems(items, state, options.surface, {
    iterationContext: options.iterationContext,
  })

  if (options.multiple) {
    return normalizeMultipleChoiceFieldValue(resolvedItems, value)
  }

  return normalizeSingleChoiceFieldValue(resolvedItems, value)
}

function resolveCollectionSource(
  items: Exclude<ListLayoutNodeItems, string[]> | SelectManualScalarItemsSource | SelectDynamicItemsSource,
  state: RuntimeState,
  surface: 'list.props.items' | ChoiceCollectionSurface,
  options: { iterationContext?: RuntimeIterationContext } = {},
): ResolvedCollectionSource | null {
  if ('values' in items) {
    return {
      items: items.values,
      itemBasePath: `${surface}.values`,
    }
  }

  return {
    items: resolveCollectionSourceItems(items.source, state, options),
    itemBasePath: items.source,
  }
}

function projectScalarCollectionToTextItems(
  collectionSource: ResolvedCollectionSource,
  state: RuntimeState,
  surface: 'list.props.items',
  options: { interpolateStrings: boolean; iterationContext?: RuntimeIterationContext },
) {
  const items: string[] = []

  for (const item of collectionSource.items) {
    const normalizedValue =
      options.interpolateStrings && typeof item === 'string'
        ? resolveInterpolatedCollectionString(item, state, surface, {
            iterationContext: options.iterationContext,
          })
        : normalizeTextValue(item)

    if (normalizedValue !== null) {
      items.push(normalizedValue)
    }
  }

  return items
}

function projectObjectCollectionToTextItems(
  collectionSource: ResolvedCollectionSource,
  itemText: string,
  state: RuntimeState,
  surface: 'list.props.items',
) {
  const items: string[] = []
  const isInterpolatedProjection = hasRuntimeTemplateDelimiter(itemText)

  for (let index = 0; index < collectionSource.items.length; index += 1) {
    const item = collectionSource.items[index]

    if (isInterpolatedProjection) {
      items.push(resolveInterpolatedCollectionString(itemText, state, surface, {
        iterationContext: {
          item,
          key: String(index),
          itemIndex: index,
        },
      }))
      continue
    }

    const resolvedValue = resolveCollectionItemPath(item, itemText)
    const normalizedValue = resolvedValue.found ? normalizeTextValue(resolvedValue.value) : null

    if (normalizedValue === null) {
      reportCollectionItemDiagnostic({
        itemPath: `${collectionSource.itemBasePath}[${index}]`,
        surface,
        projectionPath: itemText,
      })
      continue
    }

    items.push(normalizedValue)
  }

  return items
}

function projectScalarCollectionToSelectItems(
  collectionSource: ResolvedCollectionSource,
  surface: ChoiceCollectionSurface,
) {
  const items: ResolvedSelectCollectionItem[] = []
  let valueType: 'string' | 'number' | null = null

  for (let index = 0; index < collectionSource.items.length; index += 1) {
    const item = collectionSource.items[index]

    if (typeof item !== 'string' && typeof item !== 'number') {
      continue
    }

    const currentType = typeof item as 'string' | 'number'

    if (valueType === null) {
      valueType = currentType
    } else if (valueType !== currentType) {
      reportCollectionItemDiagnostic({
        itemPath: `${collectionSource.itemBasePath}[${index}]`,
        surface,
        projectionPath: currentType,
      })
      continue
    }

    items.push({
      label: String(item),
      value: String(item),
    })
  }

  return items
}

function projectObjectCollectionToSelectItems(
  collectionSource: ResolvedCollectionSource,
  labelPath: string,
  valuePath: string,
  state: RuntimeState,
  surface: ChoiceCollectionSurface,
) {
  const items: ResolvedSelectCollectionItem[] = []
  let valueType: 'string' | 'number' | null = null
  const projectionSurfaces = CHOICE_PROJECTION_SURFACES[surface]
  const isInterpolatedLabel = hasRuntimeTemplateDelimiter(labelPath)
  const isInterpolatedValue = hasRuntimeTemplateDelimiter(valuePath)

  for (let index = 0; index < collectionSource.items.length; index += 1) {
    const item = collectionSource.items[index]
    const normalizedLabel = isInterpolatedLabel
      ? resolveInterpolatedCollectionString(labelPath, state, projectionSurfaces.label, {
          iterationContext: {
            item,
            key: String(index),
            itemIndex: index,
          },
        })
      : normalizeCollectionItemPathText(item, labelPath)

    if (normalizedLabel === null) {
      reportCollectionItemDiagnostic({
        itemPath: `${collectionSource.itemBasePath}[${index}]`,
        surface,
        projectionPath: `${labelPath}|${valuePath}`,
      })
      continue
    }

    if (isInterpolatedValue) {
      items.push({
        label: normalizedLabel,
        value: resolveInterpolatedCollectionString(valuePath, state, projectionSurfaces.value, {
          iterationContext: {
            item,
            key: String(index),
            itemIndex: index,
          },
        }),
      })
      continue
    }

    const resolvedValue = resolveCollectionItemPath(item, valuePath)

    if (
      !resolvedValue.found ||
      (typeof resolvedValue.value !== 'string' && typeof resolvedValue.value !== 'number')
    ) {
      reportCollectionItemDiagnostic({
        itemPath: `${collectionSource.itemBasePath}[${index}]`,
        surface,
        projectionPath: `${labelPath}|${valuePath}`,
      })
      continue
    }

    const currentType = typeof resolvedValue.value as 'string' | 'number'

    if (valueType === null) {
      valueType = currentType
    } else if (valueType !== currentType) {
      reportCollectionItemDiagnostic({
        itemPath: `${collectionSource.itemBasePath}[${index}]`,
        surface,
        projectionPath: `${labelPath}|${valuePath}`,
      })
      continue
    }

    items.push({
      label: normalizedLabel,
      value: String(resolvedValue.value),
    })
  }

  return items
}

function normalizeCollectionItemPathText(item: unknown, path: string) {
  const resolvedValue = resolveCollectionItemPath(item, path)
  return resolvedValue.found ? normalizeTextValue(resolvedValue.value) : null
}

function resolveInterpolatedCollectionString(
  value: string,
  state: RuntimeState,
  surface: RuntimeReferenceSurface,
  options: { iterationContext?: RuntimeIterationContext } = {},
) {
  if (!hasRuntimeTemplateDelimiter(value)) {
    return value
  }

  return normalizeTextValue(
    resolveRuntimeVisibleValue(value, state, surface, {
      iterationContext: options.iterationContext,
    }),
  ) ?? ''
}

function resolveCollectionItemPath(item: unknown, path: string) {
  const pathSegments = path.split('.')
  let currentValue: unknown = item

  for (const segment of pathSegments) {
    if (segment.length === 0) {
      return {
        found: false,
      } as const
    }

    if (Array.isArray(currentValue)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) {
        return {
          found: false,
        } as const
      }

      currentValue = currentValue[Number(segment)]

      if (typeof currentValue === 'undefined') {
        return {
          found: false,
        } as const
      }

      continue
    }

    if (!isRecord(currentValue) || !Object.hasOwn(currentValue, segment)) {
      return {
        found: false,
      } as const
    }

    currentValue = currentValue[segment]
  }

  return {
    found: true,
    value: currentValue,
  } as const
}

function reportCollectionItemDiagnostic({
  itemPath,
  surface,
  projectionPath,
}: {
  itemPath: string
  surface: 'list.props.items' | ChoiceCollectionSurface
  projectionPath: string
}) {
  if (!import.meta.env.DEV) {
    return
  }

  console.warn(
    `[runtime-collections] Skipped item at "${itemPath}" for ${surface} because "${projectionPath}" could not be resolved.`,
  )
}

function normalizeTextValue(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return null
}

function normalizeSingleChoiceFieldValue(items: ResolvedSelectCollectionItem[], value: unknown) {
  const normalizedValue =
    typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : ''

  if (normalizedValue.length === 0) {
    return ''
  }

  const availableValues = new Set(items.map((item) => item.value))
  return availableValues.has(normalizedValue) ? normalizedValue : ''
}

function normalizeMultipleChoiceFieldValue(items: ResolvedSelectCollectionItem[], value: unknown) {
  const normalizedCandidates = new Set<string>()

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' || typeof entry === 'number') {
        normalizedCandidates.add(String(entry))
      }
    }
  }

  return items.reduce<string[]>((selectedValues, item) => {
    if (normalizedCandidates.has(item.value)) {
      selectedValues.push(item.value)
    }

    return selectedValues
  }, [])
}

function isRecord(value: unknown): value is RuntimeCollectionObjectItem {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
