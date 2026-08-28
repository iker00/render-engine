# Tasks: nodo `autocomplete`

Contrato de ejecución para implementar el nodo `autocomplete` descrito en `spec.md` y `design.md`. Diez tareas secuenciales por dependencia. T1 desbloquea T2, T3, T4 y T5 (implementables en cualquier orden entre sí una vez cerrada T1, salvo T4 que no depende de nada). T6 depende de T1, T3 y T5 y deja el nodo utilizable en su forma mínima (shape estático, selección simple). T7 y T8 amplían T6 en el mismo fichero de componente. T9 cierra submit/payload. T10 depende de T4, T5, T6, T7 y T8 y cierra la feature integrando búsqueda dinámica de punta a punta.

Siguiente tarea a escoger: **T1**.

Tipos y funciones ya existentes en el repo que varias tareas reutilizan tal cual (no se recrean): `FormFieldLayoutNodeProps`, `SelectLayoutNodeItems`, `validateSelectItemsContract`, `validateChoiceFieldDefaultValue`, `resolveInterpolatedCollectionString` (privada de `runtime-collection-sources.ts`), `resolveRuntimeTextReference`, `resolveRuntimeValueWithOptions`, `useRuntimeState`, `useRuntimeStateActions`, `selectFormFieldState`, `selectQueryRequestSignature`, `getFieldControlClassName` / `getFieldErrorClassName` / `getFieldLabelClassName` / `getFieldWrapperClassName`, `FieldTooltip`.

---

## T1 — Contrato y validación previa al render de `autocomplete`

### Objetivo
Registrar `autocomplete` como tipo de nodo soportado en el contrato del runtime: tipos TypeScript, esquema `Zod`, validación previa al render (`validate-autocomplete-node.ts`) conectada al dispatcher central de `src/config/`, restricción "solo dentro de `form`", y extensión del catálogo de validaciones de campo (`required`, `minSelections`, `maxSelections`). Al cerrar esta tarea, un config que declare un nodo `autocomplete` con cualquier combinación válida o inválida de sus `props` se acepta o rechaza correctamente antes del render, sin que exista aún ningún componente de React que lo pinte ni ninguna resolución en runtime.

### Fuera de alcance
- Registro en el editor de desarrollo (dev-editor): paleta, schema JSON del panel de propiedades, instancia por defecto (T2).
- Resolución en runtime de `props.items` contra el store (filtrado estático/`item.*`, búsqueda dinámica) (T3, T4).
- Resolución de la definición de campo (`defaultValue`, persistencia de selección) (T5).
- El componente de render `AutocompleteNode` y su registro en el dispatcher visual (T6).

### Dependencias
Ninguna. Es la primera tarea de la feature.

### Interfaces
**Consume**: ninguno.

**Produce**:
- `interface AutocompleteLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields { type: 'autocomplete'; id?: string; props: FormFieldLayoutNodeProps & { items: SelectLayoutNodeItems; multiple?: boolean; placeholder?: string; allowFreeText?: boolean; minChars?: number }; children?: never }` — consumido por: T2, T5, T6. (T3 opera sobre `SelectLayoutNodeItems` directamente, sin depender de `AutocompleteLayoutNode` — ver su propio sub-bloque `Interfaces`.)
- `export const autocompleteNodeSchema` (Zod, forma descrita más abajo) — consumido por: T2.
- `function validateAutocompleteNode(rawNode: Record<string, unknown>, path: string, pageId: string, breadcrumb?: BreadcrumbSegment[]): { status: 'ready'; node: AutocompleteLayoutNode } | { status: 'error'; error: RuntimeConfigError }` — sin consumidores directos fuera del dispatcher de `src/config/` (cableado dentro de esta misma tarea).

### Impacto esperado en archivos
- `src/config/runtime-config-types.ts`:
  - Añadir `'autocomplete'` a `LayoutNodeType` (junto a `'map'`, al final de la unión).
  - Declarar `AutocompleteLayoutNode` exactamente con la forma indicada arriba, situada junto a `SelectLayoutNode`/`RadioGroupLayoutNode`/`CheckboxGroupLayoutNode` (reutiliza `SelectLayoutNodeItems`, ya usado por los tres nodos de elección — no se declara ningún tipo de items nuevo).
  - Añadir `AutocompleteLayoutNode` a la unión `LayoutNode`.
- `src/config/runtime-config-zod.ts`:
  - Añadir `'autocomplete'` a `supportedNodeTypes`.
  - Declarar `autocompleteNodeSchema` siguiendo literalmente el patrón de `selectNodeSchema`:
    ```
    export const autocompleteNodeSchema = z
      .object({
        type: z.literal('autocomplete'),
        queryStateFeedback: queryStateFeedbackSchema.optional(),
        visibility: visibilitySchema.optional(),
        layout: layoutNodeLayoutSchema.optional(),
        props: formFieldNodePropsSchema
          .extend({
            items: selectItemsSchema,
            multiple: z.boolean().optional(),
            placeholder: z.string().optional(),
            allowFreeText: z.boolean().optional(),
            minChars: z.number().int().nonnegative().optional(),
          })
          .strip(),
      })
      .strip()
    ```
    (Reutiliza `formFieldNodePropsSchema` y `selectItemsSchema` ya existentes, sin modificarlos.)
- `src/config/validate-autocomplete-node.ts` (nuevo): función `validateAutocompleteNode` que replica literalmente `validateSelectNode` (`src/config/validate-form-field-nodes.ts`), con estas diferencias:
  1. Parsea con `autocompleteNodeSchema` en lugar de `selectNodeSchema`.
  2. Tras el parseo y `validateQueryStateFeedback`/`validateVisibility`, valida `props.items` con `validateSelectItemsContract(parseResult.data.props.items, \`${path}.props.items\`, pageId, breadcrumb, rawNode)` (reutilizada sin cambios: su tipo de retorno `items: SelectLayoutNode['props']['items']` es estructuralmente idéntico a `AutocompleteLayoutNode['props']['items']`).
  3. Valida `props.defaultValue` con `validateChoiceFieldDefaultValue(parseResult.data.props.defaultValue, \`${path}.props.defaultValue\`, pageId, parseResult.data.props.multiple === true, breadcrumb, rawNode)` (reutilizada sin cambios).
  4. **No** incluye ningún equivalente a la comprobación de exclusividad de `emptySubmitValue` (ese prop no existe en `autocomplete`, ver `spec.md` "Fuera de alcance").
  5. Valida `props.validations` con `validateFormFieldValidations(rawNode.props, parseResult.data.props.validations, { type: 'autocomplete', multiple: parseResult.data.props.multiple === true }, path, pageId, breadcrumb, rawNode)`.
  6. Construye el nodo final igual que `validateSelectNode` (`type: 'autocomplete'`, resto de campos análogos, incluyendo `allowFreeText` y `minChars` copiados tal cual de `parseResult.data.props`).
- `src/config/validate-layout-nodes-core.ts`: importar `validateAutocompleteNode` desde `./validate-autocomplete-node` y añadir `case 'autocomplete': return validateAutocompleteNode(rawNode, path, pageId, breadcrumb)` al `switch` de `validateLayoutNode` (este `switch` no es exhaustivo a nivel de tipos — un `case` ausente cae al `enrichedInvalidLayout` final sin romper la compilación — pero añadir el `case` es obligatorio para que el nodo se acepte).
- `src/config/layout-placement-rules.ts`: añadir `'autocomplete'` a `FORM_ONLY_LEAF_NODE_TYPES` y a `FORM_ALLOWED_DESCENDANT_TYPES`. No se necesita ningún otro cambio en `validate-form-semantics.ts`: `isFormOnlyLeafNode` y la comprobación de `FORM_ALLOWED_DESCENDANT_TYPES` ya operan genéricamente sobre estos dos `Set`, y `AutocompleteLayoutNode['props']` incluye `fieldId: string` (heredado de `FormFieldLayoutNodeProps`), por lo que el narrowing estructural de `isFormOnlyLeafNode` lo cubre automáticamente.
- `src/config/validate-form-field-validations.ts`:
  - Añadir `| { type: 'autocomplete'; multiple: boolean }` a la unión privada `FormFieldValidationTarget`.
  - Ampliar `supportsSelectionCardinalityValidations` (gating de `minSelections`/`maxSelections`) para incluir `autocomplete` en modo múltiple: `target.type === 'checkboxGroup' || (target.type === 'select' && target.multiple) || (target.type === 'autocomplete' && target.multiple)`.
  - **No** añadir `autocomplete` a `supportsTextLengthAndPatternValidations`: `minLength`, `maxLength`, `pattern`, `email`, `url` no aplican a `autocomplete` (fuera del catálogo soportado por `spec.md`; la rama `default` de rechazo ya existente se aplica sin cambios).
  - `required` no necesita ningún cambio: su gating no depende de `target.type` (siempre permitido, ver línea 345-347 del fichero).

### Tests
**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-autocomplete.test.ts` (nuevo)

**Comportamiento cubierto**:
- Un nodo `autocomplete` con `props.items` manual literal (`[{label, value}]`), dentro de un `form`, se acepta.
- Un nodo `autocomplete` con `props.items` manual escalar (`{values: [...]}`) se acepta.
- Un nodo `autocomplete` con `props.items` dinámico unificado (`{source: 'queries.x.data', itemType: 'object', label, value}` y `{source: 'item.*', itemType: 'scalar'}`) se acepta.
- Un nodo `autocomplete` con `props.items` en un shape retirado (manual objeto, o dinámico sin `itemType`) se rechaza con `code: invalid-layout` y ruta exacta a `props.items`.
- Un nodo `autocomplete` con `props.multiple: true` y `defaultValue` literal no-array se rechaza; con `props.multiple` ausente/`false` y `defaultValue` literal array se rechaza (mismas reglas que `select`).
- Un nodo `autocomplete` con `props.allowFreeText` no-boolean se rechaza; con `props.allowFreeText: true` se acepta.
- Un nodo `autocomplete` con `props.minChars` negativo o decimal se rechaza; con `props.minChars` ausente, `0` o un entero positivo se acepta.
- Un nodo `autocomplete` con `props.validations.required` se acepta en selección simple y múltiple.
- Un nodo `autocomplete` con `props.validations.minSelections`/`maxSelections` se acepta solo cuando `props.multiple: true`; se rechaza cuando `props.multiple` es ausente o `false`.
- Un nodo `autocomplete` con `props.validations.minLength`, `maxLength`, `pattern`, `email` o `url` se rechaza (no soportadas para este nodo).
- Un nodo `autocomplete` fuera de un subárbol `form` se rechaza (config completo).
- Un `form.children` que contiene un `autocomplete` se acepta (no cae en el rechazo de tipos no permitidos como hijos de `form`).
- Un nodo `autocomplete` con `queryStateFeedback`/`visibility` válidos se acepta; con valores inválidos se rechaza con el mismo mensaje que el resto del catálogo.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/config-validation/runtime-config-validation-autocomplete.test.ts`

**Restricciones**:
- Seguir el mismo patrón de aserciones que `src/tests/config-validation/runtime-config-validation-collections.test.ts` (para los shapes de `items`) y `src/tests/config-validation/runtime-config-validation-forms-validations.test.ts` (para `validations`): construir un `layout` mínimo de una página dentro de un `form`, invocar la fachada pública de validación, comprobar `status`/mensaje/ruta.
- No probar aquí resolución en runtime de `props.items` contra un store real ni ningún componente: eso es exclusivamente de T3/T5/T6.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/autocomplete.md` (ficha nueva; esta tarea aporta el contrato de `props` y las reglas de validación — el resto de secciones se completa en tareas posteriores).
- `ai-workflow/docs/app-features/forms/validation-rules.md`: las líneas que restringen `required` para selección (`''`/`[]`) y `minSelections`/`maxSelections` a `select`/`radioGroup`/`checkboxGroup` dejan de ser exhaustivas — deben ampliarse para incluir `autocomplete`.

### Criterios de finalización
`autocomplete` es un tipo de nodo reconocido por `validateRuntimeConfig`: se acepta o rechaza correctamente según las reglas anteriores, sin que exista todavía ningún render visual ni resolución en runtime.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/config-validation/runtime-config-validation-autocomplete.test.ts` en verde, sin romper el resto de la suite de `config-validation/`).

---

## T2 — Registro de `autocomplete` en el editor de desarrollo (paleta genérica)

### Objetivo
Registrar `autocomplete` en los tres catálogos exhaustivos por tipo de nodo que usa el editor de desarrollo, para que (a) el nodo aparezca en la paleta de inserción, (b) tenga una instancia inicial válida al insertarse por arrastre, y (c) su panel de propiedades se derive automáticamente del esquema `Zod` ya existente (`autocompleteNodeSchema`, de T1), sin construir ningún widget dedicado (explícitamente fuera de alcance en `spec.md`). Estos tres registros son también un requisito de compilación: `nodeSchemaByType`, `NODE_TYPE_LABELS` y el `switch` de `buildDefaultNodeInstance` están tipados como exhaustivos sobre `LayoutNodeType`, por lo que la ausencia de `'autocomplete'` en cualquiera de los tres rompe la compilación TypeScript en cuanto T1 añade el tipo a la unión.

### Fuera de alcance
- Cualquier widget de edición dedicado para `props.items`, `props.validations` u otro campo de `autocomplete` (explícitamente fuera de alcance en `spec.md`; el panel de propiedades genérico ya deriva un formulario automáticamente del esquema `Zod` vía `getNodeTypeJsonSchema`).
- Cualquier cambio de comportamiento del nodo en tiempo de ejecución (T3 en adelante).

### Dependencias
T1 (usa `AutocompleteLayoutNode`, `autocompleteNodeSchema`).

### Interfaces
**Consume**:
- `interface AutocompleteLayoutNode { ... }` (de T1).
- `autocompleteNodeSchema` (de T1).

**Produce**: ninguno reutilizable (los tres cambios son entradas de registro en catálogos ya existentes, consumidos internamente por el propio editor de desarrollo, no por otras tareas de esta feature).

### Impacto esperado en archivos
- `src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts`: importar `autocompleteNodeSchema` desde `../../config/runtime-config-zod` y añadir la entrada `autocomplete: autocompleteNodeSchema` a `nodeSchemaByType` (posición alfabética, entre `alert` y `badge`, si se sigue el orden ya presente; en caso de duda sobre el orden exacto del objeto, añadir junto al resto de nodos de formulario como hace `select`).
- `src/dev-runtime/layout-canvas/layout-canvas-node-palette-defaults.ts`: añadir `case 'autocomplete':` a `buildDefaultNodeInstance`, devolviendo una instancia inicial análoga a la de `select` (mismo patrón que `case 'select':`):
  ```
  case 'autocomplete':
    return {
      type: 'autocomplete',
      props: {
        fieldId: generateUniqueId('field'),
        label: 'Autocompletar',
        items: [],
      },
    }
  ```
- `src/dev-runtime/layout-canvas/layout-canvas-node-palette.tsx`: añadir la entrada `autocomplete: 'Autocompletar'` a `NODE_TYPE_LABELS`.

### Tests
**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (ampliación)
- `src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (ampliación)

**Comportamiento cubierto**:
- `getNodeTypeJsonSchema('autocomplete')` devuelve un JSON Schema no vacío derivado de `autocompleteNodeSchema` (mismo tipo de aserción que ya existe para otros tipos en este fichero de test).
- `getSupportedNodeTypesCatalog()` incluye `'autocomplete'`.
- Insertar `autocomplete` desde la paleta dentro de un `form` (arrastre válido) produce un nodo con `type: 'autocomplete'`, `props.fieldId` no vacío, `props.label: 'Autocompletar'` y `props.items: []`.
- Insertar `autocomplete` fuera de un `form` se rechaza por las reglas de destino ya existentes (reutiliza la misma cobertura que ya existe para `select`/`radioGroup` en este fichero, aplicada al nuevo tipo).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/dev-runtime/layout-canvas-node-schema.test.ts`
- `pnpm test --run src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx`

**Restricciones**:
- No crear ningún fichero de test nuevo: ampliar los dos ficheros existentes siguiendo su patrón de aserciones ya vigente para `select`/`map`.

### Documentación afectada
- Ninguna (detalle de registro interno del editor de desarrollo; `spec.md` ya documenta que no hay experiencia de edición dedicada — no hay comportamiento estable nuevo que documentar en `app-features/`).

### Criterios de finalización
`autocomplete` aparece en la paleta del editor de desarrollo, se inserta con una instancia inicial válida dentro de `form`, y su panel de propiedades se deriva automáticamente del esquema `Zod` sin ningún widget dedicado.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/dev-runtime/layout-canvas-node-schema.test.ts` y `pnpm test --run src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` en verde).

---

## T3 — Resolución y filtrado en cliente de `props.items` (shape estático e `item.*`, sin red)

### Objetivo
Extender `runtime-collection-sources.ts` para que `autocomplete` pueda resolver su catálogo de opciones exactamente igual que `select` (mismos tres shapes), y añadir una función pura de filtrado por texto (substring case-insensitive, gate por `minChars`) para las sugerencias visibles cuando el shape es estático o `item.*` (decisión 1 de `design.md`: `item.*` se filtra en cliente igual que el shape estático, sin red).

### Fuera de alcance
- Disparo de ejecución de operación por tecleo para el shape `queries.*` (T4).
- Cualquier componente de React (T6).
- Normalización/limpieza del valor efectivo del campo frente a colección cambiante (T5): esta tarea solo resuelve y filtra la **lista de sugerencias**, no el valor almacenado del campo.

### Dependencias
Ninguna (opera sobre `SelectLayoutNodeItems`, ya existente antes de esta feature; no depende estructuralmente de `AutocompleteLayoutNode`).

### Interfaces
**Consume**: ninguno.

**Produce**:
- `function resolveAutocompleteCollectionItems(items: SelectLayoutNodeItems, state: RuntimeState, options?: { iterationContext?: RuntimeIterationContext }): ResolvedSelectCollectionItem[]` — consumido por: T6.
- `function filterAutocompleteSuggestions(items: ResolvedSelectCollectionItem[], searchText: string, minChars: number): ResolvedSelectCollectionItem[]` — consumido por: T6.

### Impacto esperado en archivos
- `src/runtime/runtime-collection-sources.ts`:
  - Añadir `'autocomplete.props.items'` a la unión privada `ChoiceCollectionSurface`.
  - Añadir la entrada `'autocomplete.props.items': { label: 'autocomplete.props.items.label', value: 'autocomplete.props.items.value' }` a `CHOICE_PROJECTION_SURFACES`.
  - Añadir `export function resolveAutocompleteCollectionItems(items, state, options = {}) { return resolveChoiceCollectionItems(items, state, 'autocomplete.props.items', options) }`, siguiendo literalmente el patrón de `resolveSelectCollectionItems` (línea 190-196 del fichero). No se toca `ChoiceCollectionItems` (ya incluye `SelectLayoutNodeItems` como primer miembro de la unión, suficiente para `autocomplete`).
  - Añadir `export function filterAutocompleteSuggestions(items: ResolvedSelectCollectionItem[], searchText: string, minChars: number): ResolvedSelectCollectionItem[]`: si `searchText.length < minChars`, devuelve `[]`; si no, devuelve `items.filter((item) => item.label.toLowerCase().includes(searchText.toLowerCase()))`. Función pura, sin acceso a `state`.
- `src/runtime/runtime-references/runtime-reference-diagnostics.ts`: añadir `'autocomplete.props.items.label' | 'autocomplete.props.items.value'` a la unión `RuntimeReferenceSurface` (mismo patrón que las entradas ya existentes de `select`/`radioGroup`/`checkboxGroup`).

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-autocomplete-collection.test.ts` (nuevo)

**Comportamiento cubierto**:
- `resolveAutocompleteCollectionItems` resuelve correctamente los tres shapes de `items` (manual literal, manual escalar, dinámico con `source: 'queries.x.data'`, dinámico con `source: 'item.*'` dentro de un `iterationContext`), devolviendo `{label, value}[]` en el mismo orden que la colección.
- `filterAutocompleteSuggestions` con `searchText.length < minChars` devuelve `[]` sin importar el contenido de `items`.
- `filterAutocompleteSuggestions` con `searchText.length >= minChars` devuelve solo los items cuyo `label` contiene `searchText` como substring, sin distinguir mayúsculas/minúsculas.
- `filterAutocompleteSuggestions` con `searchText: ''` y `minChars: 0` devuelve la lista completa de `items` sin filtrar.
- `filterAutocompleteSuggestions` no muta el array de entrada.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-autocomplete-collection.test.ts`

**Restricciones**:
- Prueba de funciones puras: sembrar `queries.*` directamente en un `RuntimeState` de prueba (mismo patrón que `runtime-reference-resolution.test.tsx` o `runtime-map-marker-sources.test.ts`), sin montar ningún componente React.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/autocomplete.md`: sección de filtrado en shape estático e `item.*`.

### Criterios de finalización
`resolveAutocompleteCollectionItems` resuelve los tres shapes de `items` igual que `select`, y `filterAutocompleteSuggestions` filtra correctamente por texto y `minChars`, sin depender de ningún componente de render.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/runtime/runtime-autocomplete-collection.test.ts` en verde).

---

## T4 — Módulo de disparo de búsqueda dinámica con debounce

### Objetivo
Crear el nuevo módulo de runtime que dispara la ejecución de una operación por tecleo, con debounce fijo de `300ms` y gate por `minChars` (decisiones 2 y 4 de `design.md`), delegando la ejecución real en la fachada ya existente `executeQueryOperation` (obtenida vía `useRuntimeStateActions()`). El módulo también deja rastro del `requestSignature` que la propia instancia disparó por última vez, base de la convivencia entre instancias con el mismo `queryName` (decisión 5 de `design.md`, resuelta en detalle en T10).

### Fuera de alcance
- Cuándo/cómo se construye `searchText` o `requestParams` a partir de la interacción del usuario (eso lo decide el componente que use este hook, en T10).
- Comparar el `requestSignature` devuelto contra el estado global para decidir si se pintan sugerencias "frescas" (T10).
- Cualquier lógica de filtrado en cliente (T3).

### Dependencias
Ninguna.

### Interfaces
**Consume**: ninguno.

**Produce**:
- `function useAutocompleteSearchTrigger(params: { queryName: string | null; searchText: string; minChars: number; requestParams?: RuntimeApiRequestParams; iterationContext?: RuntimeIterationContext }): { lastFiredRequestSignature: string | null }` — consumido por: T10.

### Impacto esperado en archivos
- `src/runtime/runtime-search-trigger.ts` (nuevo):
  - `export function useAutocompleteSearchTrigger({ queryName, searchText, minChars, requestParams, iterationContext })`.
  - Constante privada `AUTOCOMPLETE_SEARCH_DEBOUNCE_MS = 300`.
  - Implementación:
    ```
    const state = useRuntimeState()
    const { executeQueryOperation } = useRuntimeStateActions()
    const stateRef = useRef(state)
    useEffect(() => { stateRef.current = state })

    const [lastFiredRequestSignature, setLastFiredRequestSignature] = useState<string | null>(null)

    useEffect(() => {
      if (queryName === null || searchText.length < minChars) {
        return
      }

      const timer = setTimeout(() => {
        void executeQueryOperation(queryName, { requestParams, iterationContext }).then(() => {
          setLastFiredRequestSignature(selectQueryRequestSignature(stateRef.current, queryName))
        })
      }, AUTOCOMPLETE_SEARCH_DEBOUNCE_MS)

      return () => clearTimeout(timer)
      // eslint-disable-next-line react-hooks/exhaustive-deps -- requestParams/iterationContext se comparan por referencia como en el resto del runtime; no se hace deep-equal aquí
    }, [queryName, searchText, minChars])

    return { lastFiredRequestSignature }
    ```
  - `stateRef` se actualiza en cada render (vía `useEffect` sin dependencias, para evitar leer un `state` obsoleto dentro del `.then()` asíncrono) — el valor leído tras resolver la promesa es el estado más reciente disponible en ese momento, no necesariamente el estado inmediatamente posterior a la escritura (riesgo residual ya aceptado explícitamente en la decisión 5 de `design.md`).
  - Import de `selectQueryRequestSignature` desde `./runtime-state/runtime-state-selectors` (mismo nivel que `use-runtime-state`) y de `useRuntimeState`/`useRuntimeStateActions` desde `./runtime-state/use-runtime-state`.

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-search-trigger.test.tsx` (nuevo)

**Comportamiento cubierto**:
- Con `searchText` por debajo de `minChars`, no se llama a `executeQueryOperation` aunque pase el tiempo de debounce.
- Varias actualizaciones de `searchText` en menos de `300ms` producen una única llamada a `executeQueryOperation`, con el último `searchText` (verificado indirectamente vía el último `requestParams` pasado, controlado por el test que invoca el hook).
- Tras `300ms` sin nuevas actualizaciones, se llama a `executeQueryOperation(queryName, {requestParams, iterationContext})` exactamente una vez.
- Tras resolver la promesa de `executeQueryOperation`, `lastFiredRequestSignature` refleja el valor devuelto por `selectQueryRequestSignature` para ese `queryName`.
- Con `queryName: null`, nunca se llama a `executeQueryOperation` con independencia de `searchText`.
- Desmontar el hook antes de que expire el debounce cancela el timer pendiente (no se llama a `executeQueryOperation`).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-search-trigger.test.tsx`

**Restricciones**:
- Seguir el mismo patrón de test que `src/tests/runtime/runtime-tokens-scheduler.test.tsx`: `renderHook` de `@testing-library/react`, temporizadores falsos (`vi.useFakeTimers()`), y un `RuntimeStateProvider`/harness de test ya usado por otros hooks de `runtime-state/` para envolver el hook bajo prueba y poder mockear/espiar `executeQueryOperation`.

### Documentación afectada
- `ai-workflow/docs/app-features/queries/execution.md`: nueva superficie de disparo (además de `preloads`, botón y submit) — disparo por tecleo desde un nodo de formulario, con debounce fijo de 300ms.

### Criterios de finalización
El hook dispara `executeQueryOperation` con debounce y gate de `minChars`, sin depender de ningún nodo de formulario concreto ni de lógica de filtrado.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/runtime/runtime-search-trigger.test.tsx` en verde).

---

## T5 — Resolución de la definición de campo en runtime y wiring en `form-layout-node`

### Objetivo
Resolver `defaultValue` de `autocomplete` con la semántica de persistencia descrita en `spec.md`/`design.md` (decisión 6): el shape estático se comporta como `select` (se limpia si no existe en el catálogo, salvo que `allowFreeText: true`); el shape dinámico (`queries.*` o `item.*`) **nunca** limpia el valor por defecto aunque no esté entre las sugerencias actualmente resueltas. Integrar `autocomplete` en las dos funciones de recolección de campos de `form-layout-node.tsx` para que participe en validación y en el cálculo de campos ocultos del submit.

### Fuera de alcance
- Cualquier componente de React (T6, T7, T8).
- El propio disparo de búsqueda dinámica (T4) y su integración en vivo con el componente (T10): esta tarea resuelve `defaultValue` de forma estática por render, no gestiona interacción del usuario.

### Dependencias
T1 (usa `AutocompleteLayoutNode`).

### Interfaces
**Consume**:
- `interface AutocompleteLayoutNode { ... }` (de T1).

**Produce**:
- `function resolveAutocompleteFieldDefinition(node: AutocompleteLayoutNode, state: ReturnType<typeof useRuntimeState>, iterationContext?: RuntimeIterationContext): ResolvedFormFieldDefinition` — consumido por: T6 (llamada directa desde el componente, igual que `SelectNode` llama a `resolveResolvedFormFieldDefinition`) y por `form-layout-node.tsx` (cableado en esta misma tarea).

### Impacto esperado en archivos
- `src/runtime/runtime-form-validations.ts`: añadir `| 'autocomplete'` a la unión `ResolvedFormFieldDefinition['type']` (línea 47). No se necesita ningún otro cambio en este fichero: `resolveFormFieldValue` y `passesRequiredValidation` ya se comportan correctamente para `autocomplete` siempre que su `ResolvedFormFieldDefinition.items` sea `undefined` (ver más abajo) — con `items: undefined`, `resolveFormFieldValue` devuelve el valor almacenado tal cual (sin re-normalizar contra el catálogo en cada lectura, que es exactamente el comportamiento de persistencia requerido, válido tanto para el shape dinámico como para `allowFreeText` en shape estático), y `passesRequiredValidation` cae en la rama `typeof value === 'string' && value.trim().length > 0` para selección simple (equivalente en la práctica a la rama `value !== ''` de `select`, y más correcta para el caso `allowFreeText: true`, donde el valor es texto libre).
- `src/runtime/nodes/resolve-form-field-definition.ts`: añadir `export function resolveAutocompleteFieldDefinition(node, state, iterationContext)`, en el mismo fichero y siguiendo el mismo patrón que `resolveToggleFieldDefinition` (función independiente, no integrada en `resolveResolvedFormFieldDefinition` ni en `isChoiceFieldNode`, porque su regla de persistencia de `defaultValue` es deliberadamente distinta). Algoritmo exacto:
  ```
  export function resolveAutocompleteFieldDefinition(
    node: AutocompleteLayoutNode,
    state: ReturnType<typeof useRuntimeState>,
    iterationContext?: RuntimeIterationContext,
  ): ResolvedFormFieldDefinition {
    const isMultiple = node.props.multiple === true
    const fallbackValue = isMultiple ? [] : ''
    const resolvedValue = resolveRuntimeValueWithOptions(node.props.defaultValue, state, { iterationContext })

    const defaultValue = (() => {
      if (resolvedValue.status !== 'resolved') {
        return fallbackValue
      }

      if (node.props.allowFreeText === true) {
        return coerceAutocompleteFieldShape(resolvedValue.value, isMultiple, fallbackValue)
      }

      const isStaticShape = Array.isArray(node.props.items) || 'values' in node.props.items

      if (isStaticShape) {
        return normalizeChoiceFieldValue(node.props.items, state, resolvedValue.value, {
          multiple: isMultiple,
          surface: 'autocomplete.props.items',
          iterationContext,
        })
      }

      // shape dinámico (queries.* o item.*) sin allowFreeText: nunca se limpia aunque el valor
      // no esté entre las sugerencias actualmente resueltas (design.md, decisión 6).
      return coerceAutocompleteFieldShape(resolvedValue.value, isMultiple, fallbackValue)
    })()

    return {
      fieldId: node.props.fieldId,
      type: 'autocomplete',
      validations: node.props.validations,
      queryStateFeedback: node.queryStateFeedback,
      visibility: node.visibility,
      items: undefined,
      multiple: isMultiple,
      defaultValue,
    }
  }
  ```
  Función privada auxiliar en el mismo fichero:
  ```
  function coerceAutocompleteFieldShape(value: unknown, isMultiple: boolean, fallbackValue: '' | []) {
    if (isMultiple) {
      return Array.isArray(value) && value.every((item) => typeof item === 'string' || typeof item === 'number')
        ? value.map(String)
        : fallbackValue
    }

    if (typeof value === 'string') {
      return value
    }

    if (typeof value === 'number') {
      return String(value)
    }

    return fallbackValue
  }
  ```
  `items: undefined` es deliberado (no un descuido): es lo que hace que `resolveFormFieldValue` (en `runtime-form-validations.ts`) nunca vuelva a re-normalizar/limpiar el valor almacenado contra el catálogo en cada lectura posterior (submit, revalidación en edición) — comportamiento necesario tanto para la persistencia del shape dinámico como para que `allowFreeText` no vea su texto libre borrado por no coincidir con ningún `item.value`.
- `src/runtime/nodes/form-layout-node.tsx`:
  - En `collectResolvedFormFieldDefinitions`: añadir una rama `if (node.type === 'autocomplete') { fields.push(resolveAutocompleteFieldDefinition(node, state, iterationContext)); continue }` (mismo patrón que la rama ya existente de `toggle`, situada junto a ella).
  - En `collectAllFormFieldIds`: añadir `'autocomplete'` a la lista de tipos que empujan `node.props.fieldId` (línea 423-431).

### Tests
**Ficheros de test**:
- `src/tests/runtime/resolve-autocomplete-field-definition.test.ts` (nuevo)

**Comportamiento cubierto**:
- Shape estático, `allowFreeText: false`, `defaultValue` que coincide con un `item.value` del catálogo: `defaultValue` resuelto es ese valor.
- Shape estático, `allowFreeText: false`, `defaultValue` que **no** coincide con ningún `item.value`: `defaultValue` resuelto es `''` (simple) o `[]` (múltiple, si algún miembro no coincide se filtra igual que `select.multiple`).
- Shape estático, `allowFreeText: true`, `defaultValue` que no coincide con ningún `item.value`: `defaultValue` resuelto es el texto literal, sin limpiar.
- Shape dinámico (`source: 'queries.x.data'`), `allowFreeText: false`, `defaultValue` apuntando a un valor que no está entre los `queries.x.data` actualmente sembrados en el estado de prueba: `defaultValue` resuelto conserva ese valor (no se limpia).
- Shape dinámico con `item.*`: mismo comportamiento de no-limpieza que `queries.*`.
- `multiple: true` con `defaultValue` no-array: fallback a `[]`.
- El `ResolvedFormFieldDefinition` devuelto tiene siempre `items: undefined`.
- `collectResolvedFormFieldDefinitions` incluye un `autocomplete` visible en sus resultados; `collectAllFormFieldIds` incluye su `fieldId` con independencia de su visibilidad.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/resolve-autocomplete-field-definition.test.ts`

**Restricciones**:
- Sembrar `queries.*`/`forms.*` directamente en un `RuntimeState` de prueba (mismo helper que ya usan otros tests puros de `runtime/`), sin montar ningún componente React.
- No probar aquí `passesRequiredValidation` ni el resto de `getFirstVisibleValidationError`: esa cobertura ya existe de forma genérica y no depende de ningún cambio específico de `autocomplete` más allá de la unión de tipos.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/autocomplete.md`: sección de persistencia de selección frente a colección dinámica cambiante, incluido el caso límite de `defaultValue` en shape dinámico.
- `ai-workflow/docs/app-features/forms/defaults.md`: mención de que `autocomplete` es la primera excepción documentada a la regla de limpieza de `defaultValue` frente a colección resuelta.

### Criterios de finalización
`resolveAutocompleteFieldDefinition` resuelve `defaultValue` con la semántica de persistencia exacta de `spec.md`, y `autocomplete` participa en la recolección de campos de cualquier `form` que lo contenga (validación y cálculo de campos ocultos).

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/runtime/resolve-autocomplete-field-definition.test.ts` en verde).

---

## T6 — Componente `AutocompleteNode`: registro, render base y selección simple (shape estático)

### Objetivo
Implementar `AutocompleteNode` (`src/runtime/nodes/autocomplete-layout-node.tsx`) para el caso mínimo end-to-end: selección simple (`multiple` ausente o `false`), `allowFreeText: false`, shape estático o `item.*` de `props.items` (sin búsqueda dinámica todavía). Registrar el nodo en el dispatcher central para que participe del mismo mecanismo de render que el resto del catálogo. Al cerrar esta tarea, un `autocomplete` simple con catálogo estático es completamente utilizable de punta a punta: escribir texto filtra sugerencias, seleccionar una sugerencia fija el valor, perder el foco sin coincidencia exacta vacía el campo, `required` bloquea el submit si está vacío.

### Fuera de alcance
- `props.multiple` (chips) (T7).
- `props.allowFreeText` (T8).
- Shape dinámico `queries.*` y disparo de búsqueda (T10).
- Verificación end-to-end de submit/payload (T9), aunque el mecanismo genérico ya debería funcionar por construcción.

### Dependencias
T1, T3, T5.

### Interfaces
**Consume**:
- `interface AutocompleteLayoutNode { ... }` (de T1).
- `function resolveAutocompleteCollectionItems(items, state, options?): ResolvedSelectCollectionItem[]` (de T3).
- `function filterAutocompleteSuggestions(items, searchText, minChars): ResolvedSelectCollectionItem[]` (de T3).
- `function resolveAutocompleteFieldDefinition(node, state, iterationContext?): ResolvedFormFieldDefinition` (de T5).

**Produce**:
- `AutocompleteNode: React.ComponentType<{ node: AutocompleteLayoutNode; iterationContext?: RuntimeIterationContext }>` — consumido por: T7, T8 (amplían el mismo componente en el mismo fichero), T9, T10, y por el dispatcher central (cableado en esta misma tarea).

### Impacto esperado en archivos
- `src/runtime/nodes/autocomplete-layout-node.tsx` (nuevo):
  - Estado local (no en el store compartido, mismo principio que la paginación local de `repeater`): `searchText: string` (texto actualmente escrito en el input), `isOpen: boolean` (lista de sugerencias visible), `highlightedIndex: number | null` (para navegación por teclado).
  - Componente `AutocompleteNode({ node, iterationContext })`, estructurado igual que `SelectNode`: `useOptionalFormContext()`, `useRuntimeState()`, `useRuntimeStateActions()` (`setFormFieldValue`, `setFormFieldError`), `selectFormFieldState`, `resolveAutocompleteFieldDefinition`, `resolveRuntimeTextReference` para `label`/`tooltip`/`placeholder` (surfaces `'autocomplete.props.label'`, `'autocomplete.props.tooltip'`, `'autocomplete.props.placeholder'`), `getValidationErrorForEditedField`, `getFieldControlClassName`/`getFieldErrorClassName`/`getFieldLabelClassName`/`getFieldWrapperClassName`, `FieldTooltip`.
  - `value` efectivo del campo: `fieldState?.value ?? fieldDefinition.defaultValue` (sin pasar por `normalizeChoiceFieldValue`, a diferencia de `select` — la normalización de valor selecto/pendiente vive en la interacción del propio componente, no en una lectura genérica, porque el texto en curso puede no coincidir con ningún `item.value` cuando el usuario todavía está escribiendo).
  - Sugerencias visibles: `filterAutocompleteSuggestions(resolveAutocompleteCollectionItems(node.props.items, state, {iterationContext}), searchText, node.props.minChars ?? 0)`, recalculado en cada render mientras `isOpen`.
  - Estructura DOM (combobox ARIA):
    ```
    <label className={getFieldWrapperClassName()} data-layout-node="autocomplete">
      <span className={getFieldLabelClassName()}>{label}<FieldTooltip text={tooltip} /></span>
      <div className="relative">
        <input
          role="combobox"
          type="text"
          id={`${formId}-${fieldId}`}
          aria-expanded={isOpen}
          aria-controls={`${formId}-${fieldId}-listbox`}
          aria-activedescendant={highlightedIndex !== null ? `${formId}-${fieldId}-option-${highlightedIndex}` : undefined}
          aria-describedby={error !== null ? `${formId}-${fieldId}-error` : undefined}
          className={getFieldControlClassName(error !== null)}
          placeholder={placeholderText}
          value={searchText !== '' ? searchText : (displayLabelForCurrentValue ?? '')}
          onChange={(event) => { setSearchText(event.currentTarget.value); setIsOpen(true); setHighlightedIndex(null) }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => { /* ver "Comportamiento de blur" abajo */ }}
          onKeyDown={handleKeyDown}
        />
        {isOpen && suggestions.length > 0 ? (
          <ul role="listbox" id={`${formId}-${fieldId}-listbox`}>
            {suggestions.map((item, index) => (
              <li
                key={`${fieldId}-${index}-${item.value}`}
                id={`${formId}-${fieldId}-option-${index}`}
                role="option"
                aria-selected={index === highlightedIndex}
                onMouseDown={(event) => { event.preventDefault(); selectSuggestion(item) }}
              >
                {item.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {error ? <span id={`${formId}-${fieldId}-error`} className={getFieldErrorClassName()}>{error}</span> : null}
    </label>
    ```
  - `displayLabelForCurrentValue`: cuando el campo tiene un valor efectivo no vacío y el usuario no está escribiendo activamente (`searchText === ''`), se busca la sugerencia cuyo `value` coincide con el valor efectivo (en el catálogo completo sin filtrar por `minChars`, vía `resolveAutocompleteCollectionItems` directamente) y se muestra su `label`; si no se encuentra ninguna coincidencia (por ejemplo, catálogo dinámico todavía no resuelto), se muestra el valor efectivo tal cual como fallback de texto visible.
  - `selectSuggestion(item)`: `setFormFieldValue(formId, fieldId, item.value)`, `setSearchText('')`, `setIsOpen(false)`, `setHighlightedIndex(null)`, y si había error, revalidar con `getValidationErrorForEditedField` (mismo patrón que `SelectNode.onChange`).
  - Comportamiento de blur (`allowFreeText: false`, shape estático/`item.*`, cubierto en esta tarea): al perder el foco, si `searchText !== ''` y no coincide exactamente (case-sensitive, sobre `item.value` o `item.label`) con ninguna sugerencia del catálogo completo sin filtrar, se limpia: `setFormFieldValue(formId, fieldId, '')`, `setSearchText('')`. Se usa `onMouseDown` con `preventDefault` en las opciones (no `onClick`) para que el `blur` del input no se dispare antes de procesar la selección por clic.
  - `handleKeyDown`: `ArrowDown`/`ArrowUp` mueven `highlightedIndex` dentro de `[0, suggestions.length - 1]` (clamped, sin wrap) y abren la lista si estaba cerrada; `Enter` con `highlightedIndex !== null` invoca `selectSuggestion(suggestions[highlightedIndex])` y evita el submit del formulario (`event.preventDefault()`); `Escape` cierra la lista (`setIsOpen(false)`, `setHighlightedIndex(null)`) sin modificar el valor.
- `src/runtime/nodes/node-components-map.ts`: añadir `AutocompleteNode` al `import`, a `eagerMap.autocomplete` y a `lazyMap.autocomplete` (`React.lazy(() => import('./autocomplete-layout-node').then((m) => ({ default: m.AutocompleteNode })))`), en la misma posición alfabética que el resto de entradas.
- `src/runtime/layout-node-renderer.tsx`:
  - Añadir `case 'autocomplete': { const AutocompleteNode = NodeComponents.autocomplete; renderedNode = <AutocompleteNode node={node} iterationContext={iterationContext} />; break }` al `switch (node.type)`, al final junto a `toggle`/`hidden`/`map` (mismo patrón que el `case 'map'` ya existente).
  - Añadir `'autocomplete'` a `NODE_TYPES_INERT_IN_EDIT_MODE` (mismo tratamiento que `select`/`input`/`toggle`: en modo edición del canvas, el control nativo no debe responder a la interacción real del usuario).

### Tests
**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-autocomplete.test.tsx` (nuevo)

**Comportamiento cubierto**:
- Un `autocomplete` con `props.items` manual literal y `minChars: 2` no muestra ninguna sugerencia con 1 carácter escrito; muestra las opciones cuyo `label` contiene el texto (case-insensitive) al escribir el 2º carácter.
- Seleccionar una sugerencia (clic) fija el valor efectivo del campo al `value` de esa opción y cierra la lista.
- Perder el foco con texto que no coincide con ninguna opción vacía el campo (`''`).
- Perder el foco con texto que coincide exactamente con el `label` o `value` de una opción fija ese valor (caso límite de `spec.md`: "el texto escrito coincide exactamente con el value... se trata igual que si el usuario hubiese seleccionado esa opción explícitamente" — para esta tarea sin `allowFreeText`, solo se prueba la variante de shape estático).
- Navegación por teclado: `ArrowDown`/`ArrowUp` mueven el resaltado dentro de los límites de la lista sin dar la vuelta; `Enter` con una opción resaltada la selecciona y no envía el formulario; `Escape` cierra la lista sin cambiar el valor.
- `props.validations.required: true` sin valor bloquea el submit con el mismo mensaje por defecto que `select`.
- `autocomplete` con `item.*` como `source` dentro de un `repeater` filtra y selecciona correctamente usando el catálogo embebido de cada iteración, de forma independiente entre iteraciones.
- Atributos ARIA: `role="combobox"`, `aria-expanded`, `aria-controls`, `role="listbox"`/`role="option"`, `aria-activedescendant` al navegar por teclado, `aria-describedby` hacia el error solo cuando hay error activo (ausente si no hay error).
- `autocomplete` respeta `layout.span`, `visibility` y `queryStateFeedback` (loading/error/fallback) igual que otro nodo de formulario del catálogo (reutilizar el mismo patrón de test que `layout-renderer-toggle.test.tsx` para estas tres capacidades transversales).
- En modo edición del canvas (`LayoutEditModeContext`), el control no responde a tecleo real ni abre la lista de sugerencias (mismo patrón que `select`/`input` en `layout-node-renderer-edit-mode.test.tsx`).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/layout-renderer/layout-renderer-autocomplete.test.tsx`

**Restricciones**:
- Reutilizar el helper de montaje de estado runtime ya usado por el resto de `layout-renderer/` (mismo patrón que `layout-renderer-forms-fields.test.tsx`) para sembrar `queries.*`/`forms.*`.
- Usar temporizadores falsos solo si algún assert depende de re-render tras `blur`; no se necesita para esta tarea (sin debounce todavía).

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/index.md`: nueva fila de `autocomplete` en la tabla de "Nodos de formulario".
- `ai-workflow/docs/app-features/nodes/autocomplete.md`: contrato de render completo del caso simple/estático, accesibilidad, navegación por teclado.

### Criterios de finalización
Un `autocomplete` simple con catálogo estático o `item.*` es utilizable de punta a punta a través de `LayoutRenderer`: filtra, selecciona, valida `required` y expone la semántica ARIA de combobox descrita en `spec.md`.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/layout-renderer/layout-renderer-autocomplete.test.tsx` en verde), sin romper el resto de la suite de `layout-renderer/`.

---

## T7 — Selección múltiple con chips (shape estático)

### Objetivo
Ampliar `AutocompleteNode` (mismo fichero de T6) para soportar `props.multiple: true`: el valor efectivo pasa a ser una colección ordenada de chips; seleccionar una sugerencia añade un chip sin sustituir los existentes; el campo de texto permanece disponible tras cada chip para seguir buscando; quitar un chip es una acción explícita por chip.

### Fuera de alcance
- `props.allowFreeText` en modo múltiple (confirmación por Enter de texto libre como chip) (T8).
- Shape dinámico (T10).

### Dependencias
T6.

### Interfaces
**Consume**:
- `AutocompleteNode` (de T6, mismo fichero ampliado en esta tarea).

**Produce**: ninguno (extiende el mismo componente de T6 en el mismo fichero, sin nueva firma exportada).

### Impacto esperado en archivos
- `src/runtime/nodes/autocomplete-layout-node.tsx` (ampliación):
  - Cuando `node.props.multiple === true`: el valor efectivo (`fieldState?.value ?? fieldDefinition.defaultValue`) es `string[]`. Renderizar un chip por cada elemento, cada uno con su `label` visible (buscado en el catálogo completo por `value`, igual que `displayLabelForCurrentValue` en T6, con fallback al propio `value` si no se encuentra) y un control de borrado explícito (`<button type="button" aria-label="Quitar {label}">`) que ejecuta `setFormFieldValue(formId, fieldId, currentValue.filter((v) => v !== item.value))`.
  - `selectSuggestion(item)` en modo múltiple: si `item.value` **no** está ya en la colección actual, `setFormFieldValue(formId, fieldId, [...currentValue, item.value])`; si ya está, no duplica (no-op). Siempre limpia `searchText` a `''` tras seleccionar, pero **no** cierra la lista de sugerencias (a diferencia del modo simple): el campo de texto permanece disponible para seguir buscando tras cada chip, con el foco conservado en el input.
  - `props.placeholder` se ignora completamente en modo múltiple (misma regla que `select.multiple`, ver `nodes/select.md`).
  - `required` en modo múltiple ya está cubierto genéricamente por T1/T5 (`Array.isArray(value) && value.length > 0`); no requiere cambios adicionales aquí.
  - El input de texto se renderiza **después** de los chips existentes dentro del mismo `<div className="relative">` (layout en línea, chips + input), sin introducir ningún nuevo helper de estilo: usar utilidades `Tailwind` locales directamente en el JSX (`flex flex-wrap items-center gap-2`, etc.), consistente con `conventions.md` ("si un requisito visual no encaja todavía en una escala de diseño estable, se resuelve con utilidades de Tailwind locales y revisables").

### Tests
**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-autocomplete.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Seleccionar una sugerencia en modo múltiple añade un chip sin quitar los ya presentes; el orden de los chips sigue el orden de selección.
- Seleccionar la misma opción dos veces no duplica el chip.
- Quitar un chip (clic en su control de borrado) elimina solo ese valor de la colección, conservando el resto y su orden.
- Tras añadir un chip, el campo de texto sigue disponible y con foco para seguir buscando (la lista de sugerencias no se cierra).
- `props.placeholder` declarado no se renderiza en modo múltiple.
- `props.validations.required: true` con `[]` bloquea el submit; con al menos un chip lo permite.
- `props.validations.minSelections`/`maxSelections` validan la cantidad de chips con los mismos mensajes por defecto que `checkboxGroup`.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/layout-renderer/layout-renderer-autocomplete.test.tsx`

**Restricciones**:
- Añadir los nuevos casos como bloques `describe` adicionales en el mismo fichero de T6, sin duplicar el harness de montaje.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/autocomplete.md`: sección de selección múltiple y chips.

### Criterios de finalización
`autocomplete.props.multiple: true` con catálogo estático funciona de punta a punta: añadir, evitar duplicados y quitar chips, con `minSelections`/`maxSelections`/`required` validando correctamente.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/layout-renderer/layout-renderer-autocomplete.test.tsx` en verde).

---

## T8 — `allowFreeText` en selección simple y múltiple

### Objetivo
Ampliar `AutocompleteNode` para soportar `props.allowFreeText: true` en ambos modos de selección: en simple, el valor efectivo es el texto escrito en cada momento, sin confirmación explícita; en múltiple, confirmar el texto actual con `Enter` añade un chip con ese texto aunque no coincida con ninguna opción.

### Fuera de alcance
- Shape dinámico (T10).
- Cualquier cambio en `resolveAutocompleteFieldDefinition` (ya resuelto en T5: la rama `allowFreeText === true` ya existe desde esa tarea).

### Dependencias
T6, T7.

### Interfaces
**Consume**:
- `AutocompleteNode` (de T6/T7, mismo fichero ampliado en esta tarea).

**Produce**: ninguno (extiende el mismo componente, sin nueva firma exportada).

### Impacto esperado en archivos
- `src/runtime/nodes/autocomplete-layout-node.tsx` (ampliación):
  - **Selección simple con `allowFreeText: true`**: en cada `onChange` del input, además de `setSearchText(...)`, se llama `setFormFieldValue(formId, fieldId, event.currentTarget.value)` inmediatamente (el valor efectivo del campo se actualiza en vivo con cada carácter, misma semántica que `input`/`textarea`, sin paso de confirmación). Seleccionar una sugerencia de la lista sigue sustituyendo el valor por el `value` de esa opción (igual que en modo cerrado), y también limpia `searchText` para que el input vuelva a mostrar el `label` de la opción elegida vía `displayLabelForCurrentValue`. El comportamiento de `blur` de T6 (limpiar a `''` si no coincide) **no se aplica** cuando `allowFreeText: true`: al perder el foco, el valor actual se conserva tal cual.
  - **Selección múltiple con `allowFreeText: true`**: el texto en curso sigue siendo estado local (`searchText`), no se escribe en `forms.*` mientras no se confirma (a diferencia del modo simple). En `handleKeyDown`, `Enter` sin ninguna sugerencia resaltada (`highlightedIndex === null`) y con `searchText.trim() !== ''` añade un chip con `searchText` tal cual como `value` (mismo mecanismo que `selectSuggestion`, pero con `{label: searchText, value: searchText}` en vez de una sugerencia del catálogo), evita el submit del formulario, y limpia `searchText`. `Enter` con una sugerencia resaltada sigue seleccionando esa sugerencia (prioridad de la sugerencia resaltada sobre la confirmación de texto libre).
  - **Caso límite compartido** (`spec.md`, "casos límite"): si el texto escrito coincide exactamente (comparación de string) con el `value` de una opción del catálogo (no solo su `label`), se trata igual que si el usuario hubiese seleccionado esa opción explícitamente — en simple, esto ya ocurre de forma natural porque el valor efectivo es el texto tal cual, sin necesidad de lógica adicional; en múltiple, `Enter` sobre un `searchText` que coincide exactamente con un `value` del catálogo añade el chip con `{label: <label de esa opción>, value: searchText}` en vez de `{label: searchText, value: searchText}` (se busca la coincidencia exacta por `value` en el catálogo completo antes de construir el chip de texto libre).

### Tests
**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-autocomplete.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Simple + `allowFreeText: true`: el valor efectivo del campo se actualiza con cada carácter escrito, sin necesidad de perder el foco ni seleccionar ninguna sugerencia.
- Simple + `allowFreeText: true`: perder el foco con texto que no coincide con ninguna opción conserva ese texto como valor (no se vacía, a diferencia de T6).
- Simple + `allowFreeText: true`: seleccionar una sugerencia de la lista sustituye el texto actual por el `value` de esa opción.
- Múltiple + `allowFreeText: true`: `Enter` con texto escrito y ninguna sugerencia resaltada añade un chip con ese texto como `value`; el campo de texto en curso no es un valor del campo hasta la confirmación (el valor efectivo no cambia mientras se escribe sin pulsar `Enter`).
- Múltiple + `allowFreeText: true`: `Enter` con una sugerencia resaltada selecciona la sugerencia, no confirma el texto libre.
- Múltiple + `allowFreeText: true`: confirmar un texto que coincide exactamente con el `value` de una opción del catálogo añade un chip con el `label` de esa opción.
- `allowFreeText: false` (T6/T7) sigue funcionando sin regresión tras esta ampliación.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/layout-renderer/layout-renderer-autocomplete.test.tsx`

**Restricciones**:
- Añadir los nuevos casos como bloques `describe` adicionales en el mismo fichero, sin duplicar el harness de montaje.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/autocomplete.md`: sección de `allowFreeText`, incluido el caso límite de coincidencia exacta con `value`.

### Criterios de finalización
`allowFreeText: true` funciona de punta a punta en selección simple (valor en vivo) y múltiple (confirmación por `Enter`), incluido el caso límite de coincidencia exacta con `value`, sin regresión sobre `allowFreeText: false`.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/layout-renderer/layout-renderer-autocomplete.test.tsx` en verde).

---

## T9 — Submit, payload y omisión de campos ocultos end-to-end

### Objetivo
Verificar de punta a punta que `autocomplete` participa en el payload de submit y en la omisión de campos ocultos exactamente igual que el resto de campos de formulario, sin necesidad de ningún cambio adicional en la resolución de payload (que ya es genérica por `fieldId`, no por tipo de nodo) ni en `collectAllFormFieldIds` (ya cableado en T5). Esta tarea es principalmente de verificación; si al escribir los tests aparece algún caso no cubierto por el mecanismo genérico ya existente, corregirlo aquí en `src/queries/runtime-api-payload-resolver.ts` o en el propio nodo, documentando el ajuste.

### Fuera de alcance
- Shape dinámico (T10).
- Cualquier cambio de UI (ya cerrado en T6/T7/T8).

### Dependencias
T1, T6, T7.

### Interfaces
**Consume**:
- `AutocompleteNode` (de T6/T7).

**Produce**: ninguno.

### Impacto esperado en archivos
- Código: ninguno esperado (la resolución de payload de submit ya es genérica por referencia `forms.{formId}.{fieldId}`, con independencia del tipo de nodo que la produce; `collectAllFormFieldIds` ya incluye `autocomplete` desde T5). Si la implementación descubre un caso realmente no cubierto, el ajuste puntual se hace en `src/queries/runtime-api-payload-resolver.ts`, documentándolo en el resultado de la tarea.
- `src/tests/runtime/runtime-form-submit-autocomplete.test.tsx` (nuevo).

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-form-submit-autocomplete.test.tsx` (nuevo)

**Comportamiento cubierto**:
- Submit de un `form` con un `autocomplete` simple con valor seleccionado incluye `forms.{formId}.{fieldId}` en el payload (`body`/`query`/`headers`, según cómo lo referencie la operación) con el `value` seleccionado.
- Submit de un `form` con un `autocomplete` múltiple con varios chips incluye el array de `value`s en el payload.
- Submit de un `form` con un `autocomplete` oculto por `visibility` en el momento del submit, con selección ya hecha, omite la clave del payload que lo referencia (misma semántica que el resto de campos ocultos, sin excepción — mismo patrón de test que `runtime-form-submit-hidden-fields.test.tsx`).
- Submit de un `form` con un `autocomplete` oculto por `queryStateFeedback` se comporta igual que por `visibility`.
- `autocomplete` dentro de un `repeater`: cada iteración mantiene su propio valor de forma independiente en el payload (mismo principio que cualquier otro campo de formulario dentro de `repeater`).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-form-submit-autocomplete.test.tsx`

**Restricciones**:
- Reutilizar literalmente el harness de montaje y las aserciones de payload ya usadas en `runtime-form-submit-hidden-fields.test.tsx` y `runtime-form-submit-file-input.test.tsx`, sustituyendo el campo bajo prueba por `autocomplete`.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/autocomplete.md`: sección de submit y validación (confirmación de que sigue la semántica ya documentada en `forms/submit.md`, sin comportamiento propio adicional).

### Criterios de finalización
Un `autocomplete` (simple o múltiple, visible u oculto) participa en el submit exactamente igual que el resto de campos de formulario, sin ningún tratamiento especial no documentado.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/runtime/runtime-form-submit-autocomplete.test.tsx` en verde).

---

## T10 — Integración de búsqueda dinámica end-to-end

### Objetivo
Integrar el módulo de disparo con debounce (T4) en `AutocompleteNode` para el shape dinámico `queries.*`: escribir texto (alcanzado `minChars`) dispara la operación asociada con debounce; las sugerencias visibles reflejan `queries.{queryName}.data` una vez resuelta; una selección ya hecha persiste aunque una búsqueda posterior no la incluya en sus resultados; dos instancias que comparten `queryName` no se pisan entre sí (degradan mostrando solo la búsqueda más reciente que cada una disparó, según la decisión 5 de `design.md`). Esta es la tarea que deja `autocomplete` completamente utilizable de punta a punta en todos sus modos.

### Fuera de alcance
- Cualquier cambio en el mecanismo de debounce en sí (ya cerrado en T4).
- Paginación o scroll infinito de resultados (fuera de alcance en `spec.md`).

### Dependencias
T3, T4, T5, T6, T7, T8.

### Interfaces
**Consume**:
- `function useAutocompleteSearchTrigger(params): { lastFiredRequestSignature: string | null }` (de T4).
- `function resolveAutocompleteCollectionItems(items, state, options?): ResolvedSelectCollectionItem[]` (de T3, ya importado desde T6 en el mismo fichero — esta tarea lo reutiliza también para leer `queries.{queryName}.data`).
- `AutocompleteNode` (de T6/T7/T8, mismo fichero ampliado en esta tarea).

**Produce**: ninguno (extiende el mismo componente, sin nueva firma exportada).

### Impacto esperado en archivos
- `src/runtime/nodes/autocomplete-layout-node.tsx` (ampliación):
  - Detectar shape dinámico con `queryName`: `props.items` es `{source, itemType}` y `source` cumple `/^queries\.([^.]+)\.data(\..*)?$/` (mismo patrón ya usado por la validación de `repeater.props.items.source`/`select.props.items.source`); si coincide, `queryName` es el grupo capturado. Si `source === 'item.*'`, se sigue tratando como T3/T6 (filtrado en cliente, sin `queryName`, sin invocar el hook de T4).
  - Cuando hay `queryName`: construir `requestParams` según modo de selección (decisión 3 de `design.md`):
    - **Simple**: no se pasa ningún `requestParams` propio de este mecanismo — el texto en curso ya vive en `forms.{formId}.{fieldId}` (ver T8, `allowFreeText` o el propio `searchText` en curso incluso con `allowFreeText: false`, ya que el input siempre refleja lo escrito) y la operación declarada en `api` lo referencia directamente como `forms.{formId}.{fieldId}` en su propio `query`/`body`. **Excepción**: cuando `allowFreeText: false`, el store `forms.{formId}.{fieldId}` no se actualiza con cada carácter (a diferencia de `allowFreeText: true`, ver T8) — para que la operación pueda igualmente referenciar el texto en curso, esta tarea añade una escritura adicional: en modo simple con shape dinámico, cada cambio de `searchText` también llama `setFormFieldValue(formId, fieldId, event.currentTarget.value)` de forma transitoria (igual que si `allowFreeText` estuviera activo a efectos de esta escritura), y el `blur`/selección final sigue aplicando la limpieza de T6 si no hubo selección válida y `allowFreeText: false`. Esto no cambia el contrato observable de `spec.md` (el valor efectivo tras perder el foco sigue las mismas reglas de T6/T8), solo hace que el texto intermedio sea referenciable por la operación mientras se escribe.
      **Riesgo de submit con texto no confirmado**: esta escritura transitoria deja `forms.{formId}.{fieldId}` con texto libre no validado mientras el usuario escribe, incluso con `allowFreeText: false`. Pulsar `Enter` con el input enfocado y **sin ninguna sugerencia resaltada** dispara el submit nativo del `<form>` (ver `nodes/form.md`) antes de que el `blur` pueda limpiar ese texto, lo que filtraría texto libre no confirmado al payload pese a `allowFreeText: false` (contradice `spec.md`, sección "Texto libre", "Desactivado"). Para cerrar esta laguna: en `handleKeyDown`, cuando el modo es simple + shape dinámico + `allowFreeText: false` y `Enter` se pulsa con `highlightedIndex === null`, **siempre** llamar `event.preventDefault()` (nunca se deja pasar el submit nativo en este caso concreto) y resolver el texto actual de forma síncrona contra el catálogo dinámico ya resuelto en ese render (`resolveAutocompleteCollectionItems` sobre `queries.{queryName}.data`): si `searchText` coincide exactamente (case-sensitive) con el `value` o el `label` de una opción, se comporta como `selectSuggestion` de esa opción; si no coincide con ninguna, se aplica la misma limpieza que el `blur` de T6 (`setFormFieldValue(formId, fieldId, '')`, `setSearchText('')`). El usuario puede volver a pulsar `Enter`/el botón de submit una vez el campo queda en un estado válido.
    - **Múltiple**: `requestParams: { query: { search: searchText }, body: { search: searchText } }` (clave reservada `search`, documentada en `nodes/autocomplete.md`; se pasan ambas ramas porque el merge de `execution.md` solo usa la que corresponda al método de la operación, la otra se ignora sin efecto).
  - Llamar **siempre** (incondicionalmente, en cada render, respetando las Rules of Hooks) a `const { lastFiredRequestSignature } = useAutocompleteSearchTrigger({ queryName, searchText, minChars: node.props.minChars ?? 0, requestParams, iterationContext })`; cuando el shape actual no es `queries.*` (estático o `item.*`), `queryName` se pasa como `null` — el propio hook (T4) ya trata `queryName === null` como no-op sin disparar ninguna ejecución. Nunca se debe invocar el hook de forma condicional (dentro de un `if`) para evitar violar las Rules of Hooks.
  - Sugerencias visibles con `queryName`: en vez de `filterAutocompleteSuggestions(...)` (solo para estático/`item.*`), leer `resolveAutocompleteCollectionItems({source: ..., itemType, label, value}, state, {iterationContext})` sobre `queries.{queryName}.data`, y mostrarlas **solo si** `selectQueryRequestSignature(state, queryName) === lastFiredRequestSignature` (si no coinciden, se tratan como no frescas: no se muestra ninguna sugerencia todavía, sin error visible, hasta que la propia instancia dispare y reciba su propia búsqueda más reciente).
  - Persistencia: el valor efectivo del campo (simple o cada chip en múltiple) nunca se limpia por no estar entre las sugerencias dinámicas actuales — esto ya lo garantiza T5 (`resolveAutocompleteFieldDefinition` con `items: undefined`) para `defaultValue`, y esta tarea debe asegurar que ninguna lógica nueva de T10 reintroduce una comprobación de membership contra `queries.{queryName}.data` al leer el valor ya almacenado (solo se usa el catálogo dinámico para pintar sugerencias, nunca para invalidar el valor ya seleccionado).

### Tests
**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-autocomplete.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Escribir texto por debajo de `minChars` en shape dinámico no dispara ninguna ejecución de operación.
- Escribir varias teclas seguidas en menos tiempo que el debounce dispara una única ejecución de operación (usar temporizadores falsos).
- Una vez resuelta la operación, las sugerencias visibles reflejan `queries.{queryName}.data`.
- Seleccionar una sugerencia de una búsqueda y luego escribir una segunda búsqueda cuyos resultados no incluyen la primera opción: el chip/valor de la primera opción sigue presente tras la segunda búsqueda.
- Dos instancias de `autocomplete` con el mismo `queryName` en el mismo formulario: la instancia cuya búsqueda no fue la última en resolver dentro del `queryName` compartido deja de pintar sugerencias hasta disparar ella misma una nueva búsqueda (verificar vía `selectQueryRequestSignature`/`lastFiredRequestSignature` simulando resoluciones fuera de orden).
- Backend de búsqueda dinámica que responde sin resultados: el campo queda sin sugerencias visibles, sin bloquear el resto del formulario.
- `defaultValue` en shape dinámico que apunta a un valor que aún no está entre las sugerencias visibles (porque todavía no se ha buscado nada) se fija igualmente al montar.
- Simple + shape dinámico + `allowFreeText: false`: escribir texto que no coincide con ninguna sugerencia y pulsar `Enter` sin ninguna sugerencia resaltada **no** envía el formulario (el `onSubmit` del `form` no se dispara) y el campo queda vacío tras la pulsación.
- Simple + shape dinámico + `allowFreeText: false`: escribir texto que coincide exactamente con el `value` o el `label` de una sugerencia ya resuelta y pulsar `Enter` sin sugerencia resaltada selecciona esa opción y tampoco envía el formulario.
- `autocomplete` múltiple con shape dinámico: `requestParams.body.search`/`requestParams.query.search` llevan el texto en curso al disparar la operación.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/layout-renderer/layout-renderer-autocomplete.test.tsx`

**Restricciones**:
- Usar `vi.useFakeTimers()` para las aserciones de debounce, igual que T4.
- Sembrar/actualizar `queries.{queryName}` en el estado de prueba simulando la resolución asíncrona de `executeQueryOperation` (mock o harness ya usado por otros tests de `runtime/` que ejercitan operaciones, por ejemplo el patrón de `runtime-global-preloads.test.tsx`).

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/autocomplete.md`: sección de búsqueda dinámica completa (debounce, `minChars`, persistencia, límite de convivencia entre instancias con el mismo `queryName`, clave reservada `search` en modo múltiple).
- `ai-workflow/docs/app-features/queries/execution.md`: referencia cruzada a la nueva superficie de disparo (completa esta sección iniciada en T4).

### Criterios de finalización
Un `autocomplete` con shape dinámico funciona de punta a punta en todos los modos de `spec.md`: debounce, `minChars`, persistencia de selección, y degradación explícita cuando varias instancias comparten `queryName`.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/layout-renderer/layout-renderer-autocomplete.test.tsx` en verde), sin romper el umbral de cobertura del 80% sobre `src/` exigido por el proyecto (`pnpm test`).
