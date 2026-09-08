import type { LayoutNode, LayoutNodeType } from '../../config/runtime-config'

// "Eliminar nodo" over a table cell-node reverts the cell to its empty-text literal instead of
// removing it from `props.rows`/`props.rows.cells` (T5, 0138): removing the cell entirely would
// shift row/cell positions and columns must stay aligned with `headers`. Two distinct literals
// are required because `validateTableDynamicRows` (`src/config/validate-table-node.ts`, via
// `isNonEmptyString`) rejects an empty string for a dynamic-mode cell — a contract intentionally
// left untouched by this task (see `runtime-config-validation-image-table.test.ts`'s pinned
// "regression: current contract" test). `row` only exists in manual mode and `cells` only in
// dynamic mode (T1/T2), so the last path step alone discriminates which literal applies.
export const EMPTY_TABLE_CELL_TEXT_VALUE = ''
export const EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE = '—'

// Monotonically increasing, module-scoped: guarantees every generated `fieldId`/`id` is unique
// across the whole session, so a freshly-inserted `form`/`modal` never collides with an
// existing one on the page (both must be globally unique per validateRuntimeConfig, see
// validate-form-nodes.ts) and a freshly-inserted form-only leaf never collides with a sibling
// field already present in the target form. The value baked into the returned node is a plain
// string literal by the time `insertNodeAt` sees it — not a reference re-evaluated later — so
// this still satisfies "no dynamic references" below.
let uniqueSuffixCounter = 0

function generateUniqueId(prefix: string): string {
  uniqueSuffixCounter += 1
  return `${prefix}-${uniqueSuffixCounter}`
}

/**
 * Produces a minimally valid `LayoutNode` for every type in `getSupportedNodeTypesCatalog()`
 * (T7), suitable for inserting directly via `insertNodeAt` (T3) from the node palette (T15,
 * FR8). Every value is a static literal — never a `queries.*`/`forms.*` reference or a
 * `{{...}}` interpolation — so the inserted node is valid immediately, without depending on any
 * query or form actually existing in the active config. The one structural exception is
 * `repeater`: its own schema (`repeaterNodeSchema`) requires `props.items.source` to already be
 * shaped like `queries.{queryName}.data` — validation only checks that shape, never that the
 * named query exists, so a placeholder query name is still a fully static, self-contained
 * value that needs no runtime state to insert validly (it simply renders zero items until a
 * real query is wired up).
 */
export function buildDefaultNodeInstance(type: LayoutNodeType): LayoutNode {
  switch (type) {
    case 'container':
      return { type: 'container' }

    case 'repeater':
      return {
        type: 'repeater',
        props: {
          items: { source: 'queries.placeholderQuery.data', key: 'id' },
          template: [],
        },
      }

    case 'heading':
      return { type: 'heading', props: { text: 'Título', level: 2 } }

    case 'paragraph':
      return { type: 'paragraph', props: { text: 'Texto de párrafo.' } }

    case 'list':
      return { type: 'list', props: { items: { values: [] } } }

    case 'image':
      return { type: 'image', props: { src: 'https://placehold.co/64x64', alt: 'Imagen' } }

    case 'table':
      return { type: 'table', props: { headers: ['Columna 1'], rows: [] } }

    case 'button':
      return { type: 'button', props: { label: 'Botón', action: { type: 'goBack' } } }

    case 'link':
      return { type: 'link', props: { label: 'Enlace', href: '#' } }

    case 'form':
      return { type: 'form', id: generateUniqueId('form') }

    case 'input':
      return { type: 'input', props: { fieldId: generateUniqueId('field'), label: 'Campo de texto' } }

    case 'textarea':
      return { type: 'textarea', props: { fieldId: generateUniqueId('field'), label: 'Área de texto' } }

    case 'select':
      return {
        type: 'select',
        props: {
          fieldId: generateUniqueId('field'),
          label: 'Selector',
          items: [],
        },
      }

    case 'radioGroup':
      return {
        type: 'radioGroup',
        props: {
          fieldId: generateUniqueId('field'),
          label: 'Opciones',
          items: [],
        },
      }

    case 'checkboxGroup':
      return {
        type: 'checkboxGroup',
        props: {
          fieldId: generateUniqueId('field'),
          label: 'Opciones',
          items: [],
        },
      }

    case 'modal':
      return { type: 'modal', id: generateUniqueId('modal') }

    case 'tabs':
      return { type: 'tabs', props: { items: [{ label: 'Pestaña 1' }] } }

    case 'steps':
      return { type: 'steps', props: { items: [{ label: 'Paso 1' }] } }

    case 'accordion':
      return { type: 'accordion', props: { label: 'Sección' } }

    case 'badge':
      return { type: 'badge', props: { label: 'Etiqueta' } }

    case 'alert':
      return { type: 'alert', props: { message: 'Mensaje informativo.' } }

    case 'stat':
      return { type: 'stat', props: { label: 'Métrica', value: '0' } }

    case 'divider':
      return { type: 'divider' }

    case 'skeleton':
      return { type: 'skeleton' }

    case 'fileManager':
      return { type: 'fileManager', props: { fieldName: 'archivos' } }

    case 'fileInput':
      return { type: 'fileInput', props: { fieldId: generateUniqueId('field'), label: 'Archivo' } }

    case 'toggle':
      return { type: 'toggle', props: { fieldId: generateUniqueId('field'), label: 'Activar' } }

    case 'hidden':
      return { type: 'hidden', props: { fieldId: generateUniqueId('field'), value: 'valor' } }

    case 'map':
      return { type: 'map' }

    case 'gallery':
      return {
        type: 'gallery',
        props: { images: [], display: { mode: 'paginated', pagination: { pageSize: 6 } } },
      }

    case 'autocomplete':
      return {
        type: 'autocomplete',
        props: {
          fieldId: generateUniqueId('field'),
          label: 'Autocompletar',
          items: [],
        },
      }

    // Minimum shape that passes `validateChartNode` without further user action: `bar` is a
    // categorical variant, and its single static data point satisfies the `data`/`source`
    // mutual-exclusion check while matching that variant's `{ category, value }` family.
    case 'chart':
      return {
        type: 'chart',
        props: { variant: 'bar', data: [{ category: 'Ejemplo', value: 1 }] },
      }

    // T15 (feature reusable-node-groups): `groupId: ''` is a deliberate draft placeholder, not
    // an oversight — `groupInstanceNodeSchema` accepts an empty `groupId` and `checkGroupInstance`
    // (`validate-groups.ts`) skips its cross-checks specifically for `''`, so this inserts
    // validly even though no real `groups.*` entry is referenced yet (`GroupLayoutNode`,
    // `src/runtime/nodes/group-layout-node.tsx`, degrades to `null` at render time until the user
    // picks one from the properties panel). Unlike every other case above, this stays context-free on
    // purpose: `buildDefaultNodeInstance` has no `config.groups` to auto-pick a "sensible" real id
    // from, and picking one would be arbitrary anyway.
    case 'group':
      return { type: 'group', props: { groupId: '', params: {} } }

    // `slot` is structurally part of `LayoutNodeType` (T06) but excluded from
    // `getSupportedNodeTypesCatalog()` (see that function's own comment) — the palette never
    // drags one of these in, so this branch is unreachable in practice.
    case 'slot':
      throw new Error(`buildDefaultNodeInstance: node type "${type}" is not yet insertable from the palette`)

    default: {
      const exhaustiveCheck: never = type
      throw new Error(`buildDefaultNodeInstance: unsupported node type "${String(exhaustiveCheck)}"`)
    }
  }
}
