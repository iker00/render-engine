import type {
  CollectionPipelineFilterArgument,
  CollectionPipelineFilterOperator,
  CollectionPipelineStage,
} from '../../config/runtime-collection-pipeline-syntax'
import { normalizeTableSearchText } from '../runtime-table-processing'
import { resolveRuntimeReference } from './runtime-reference-resolver'
import type { RuntimeState } from '../runtime-state/runtime-state-types'

type FilterStage = Extract<CollectionPipelineStage, { op: 'filter' }>
type OrderByStage = Extract<CollectionPipelineStage, { op: 'orderby' }>

type ResolvedFilterArgument =
  | { kind: 'skip' }
  | { kind: 'scalar'; value: string | number }
  | { kind: 'set'; values: unknown[] }

const ARRAY_INDEX_SEGMENT_PATTERN = /^(0|[1-9]\d*)$/

/**
 * Evalúa el pipeline de colección (orderby/filter/slice) sobre una colección ya resuelta a array.
 * Las referencias dinámicas de los argumentos de filter se resuelven sin `iterationContext`, por lo
 * que `item.*`/`row.*` quedan bloqueados y degradan a "valor dinámico ausente" (spec).
 */
export function evaluateCollectionPipeline(
  items: unknown[],
  stages: CollectionPipelineStage[],
  state: RuntimeState,
): unknown[] {
  if (items == null || !Array.isArray(items)) {
    return []
  }

  return stages.reduce<unknown[]>((currentItems, stage) => applyStage(currentItems, stage, state), items)
}

function applyStage(items: unknown[], stage: CollectionPipelineStage, state: RuntimeState): unknown[] {
  switch (stage.op) {
    case 'orderby':
      return applyOrderByStage(items, stage)
    case 'filter':
      return applyFilterStage(items, stage, state)
    case 'slice':
      return items.slice(stage.start, stage.end)
  }
}

// --- orderby ---

function applyOrderByStage(items: unknown[], stage: OrderByStage): unknown[] {
  const directionMultiplier = stage.dir === 'desc' ? -1 : 1

  return [...items].sort(
    (left, right) => compareOrderableValues(left, right, stage.path) * directionMultiplier,
  )
}

function compareOrderableValues(left: unknown, right: unknown, path: string): number {
  const leftValue = extractOrderableValue(left, path)
  const rightValue = extractOrderableValue(right, path)

  if (leftValue === null && rightValue === null) {
    return 0
  }

  if (leftValue === null) {
    return -1
  }

  if (rightValue === null) {
    return 1
  }

  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return leftValue - rightValue
  }

  const leftText = String(leftValue)
  const rightText = String(rightValue)

  if (leftText < rightText) {
    return -1
  }

  if (leftText > rightText) {
    return 1
  }

  return 0
}

function extractOrderableValue(item: unknown, path: string): string | number | null {
  const fieldResult = getNestedFieldValue(item, path)

  if (!fieldResult.found) {
    return null
  }

  if (typeof fieldResult.value === 'number' && Number.isFinite(fieldResult.value)) {
    return fieldResult.value
  }

  if (typeof fieldResult.value === 'string') {
    return fieldResult.value
  }

  return null
}

// --- filter ---

function applyFilterStage(items: unknown[], stage: FilterStage, state: RuntimeState): unknown[] {
  const resolution = resolveFilterArgument(stage.value, state)

  if (resolution.kind === 'skip') {
    return items
  }

  return items.filter((item) => itemMatchesFilter(item, stage, resolution))
}

function resolveFilterArgument(
  argument: CollectionPipelineFilterArgument,
  state: RuntimeState,
): ResolvedFilterArgument {
  switch (argument.kind) {
    case 'literal':
      return { kind: 'scalar', value: argument.value }
    case 'list-literal':
      return { kind: 'set', values: argument.values }
    case 'reference':
      return resolveScalarFilterReference(argument.reference, state)
    case 'list-reference':
      return resolveSetFilterReference(argument.reference, state)
  }
}

function resolveScalarFilterReference(reference: string, state: RuntimeState): ResolvedFilterArgument {
  const resolved = resolveRuntimeReference(reference, state)

  if (resolved.status !== 'resolved') {
    return { kind: 'skip' }
  }

  if (resolved.value === undefined || resolved.value === null || resolved.value === '') {
    return { kind: 'skip' }
  }

  if (typeof resolved.value !== 'string' && typeof resolved.value !== 'number') {
    return { kind: 'skip' }
  }

  return { kind: 'scalar', value: resolved.value }
}

function resolveSetFilterReference(reference: string, state: RuntimeState): ResolvedFilterArgument {
  const resolved = resolveRuntimeReference(reference, state)

  if (resolved.status !== 'resolved' || !Array.isArray(resolved.value)) {
    return { kind: 'set', values: [] }
  }

  return { kind: 'set', values: resolved.value }
}

function itemMatchesFilter(
  item: unknown,
  stage: FilterStage,
  resolution: Exclude<ResolvedFilterArgument, { kind: 'skip' }>,
): boolean {
  const fieldResult = getNestedFieldValue(item, stage.path)

  if (!fieldResult.found) {
    return false
  }

  if (stage.operator === 'in') {
    const candidates = resolution.kind === 'set' ? resolution.values : [resolution.value]
    return candidates.some((candidate) => fieldResult.value === candidate)
  }

  if (resolution.kind !== 'scalar') {
    return false
  }

  return evaluateScalarFilterOperator(fieldResult.value, stage.operator, resolution.value)
}

function evaluateScalarFilterOperator(
  fieldValue: unknown,
  operator: Exclude<CollectionPipelineFilterOperator, 'in'>,
  compareValue: string | number,
): boolean {
  switch (operator) {
    case 'eq':
      return fieldValue === compareValue
    case 'ne':
      return fieldValue !== compareValue
    case 'gt':
      return compareNumeric(fieldValue, compareValue, (a, b) => a > b)
    case 'lt':
      return compareNumeric(fieldValue, compareValue, (a, b) => a < b)
    case 'gte':
      return compareNumeric(fieldValue, compareValue, (a, b) => a >= b)
    case 'lte':
      return compareNumeric(fieldValue, compareValue, (a, b) => a <= b)
    case 'contains':
      return evaluateContains(fieldValue, compareValue)
  }
}

function compareNumeric(
  fieldValue: unknown,
  compareValue: string | number,
  compare: (a: number, b: number) => boolean,
): boolean {
  if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue)) {
    return false
  }

  if (typeof compareValue !== 'number' || !Number.isFinite(compareValue)) {
    return false
  }

  return compare(fieldValue, compareValue)
}

function evaluateContains(fieldValue: unknown, compareValue: string | number): boolean {
  if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
    return normalizeTableSearchText(fieldValue).includes(normalizeTableSearchText(compareValue))
  }

  if (Array.isArray(fieldValue)) {
    return fieldValue.some((element) => element === compareValue)
  }

  return false
}

// --- path navigation shared by orderby/filter ---

function getNestedFieldValue(item: unknown, path: string): { found: boolean; value: unknown } {
  const segments = path.split('.')
  let currentValue: unknown = item

  for (const segment of segments) {
    if (currentValue == null) {
      return { found: false, value: undefined }
    }

    if (Array.isArray(currentValue)) {
      if (!ARRAY_INDEX_SEGMENT_PATTERN.test(segment)) {
        return { found: false, value: undefined }
      }

      currentValue = currentValue[Number(segment)]

      if (currentValue === undefined) {
        return { found: false, value: undefined }
      }

      continue
    }

    if (typeof currentValue !== 'object') {
      return { found: false, value: undefined }
    }

    const objectValue = currentValue as Record<string, unknown>

    if (!Object.hasOwn(objectValue, segment)) {
      return { found: false, value: undefined }
    }

    currentValue = objectValue[segment]
  }

  return { found: true, value: currentValue }
}
