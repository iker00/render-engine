# Tasks: nodo `steps`

## Orden de implementación
T1 → T2 → T3 → T4

T2 no depende de T1 (podría implementarse en paralelo o antes), pero se lista en este orden por claridad narrativa. T3 depende de T1 y T2. T4 depende de T1 y T3.

**Siguiente tarea a escoger: T1.**

---

## T1 — Contrato de configuración y validación de `steps`

### Objetivo
Añadir `steps` como tipo de nodo soportado en `src/config/`: tipos TypeScript, esquema `Zod`, validador estructural, y las dos reglas semánticas que hacen a `steps` exclusivo de `form` (a diferencia de `tabs`). Dejar el catálogo de tipos compilando de extremo a extremo (incluida la superficie de `dev-runtime` que indexa `LayoutNodeType` de forma exhaustiva), sin tocar todavía nada de `src/runtime/`.

Shape exacto a implementar (mismo criterio que `tabs`, más los tres textos de navegación de la spec):

```ts
export type StepsVariant = 'horizontal' | 'vertical' | 'progress'

export interface StepsItem {
  label: string
  children?: LayoutNode[]
  visibility?: RuntimeVisibilityConfig
}

export interface StepsLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'steps'
  id?: string
  props: {
    variant?: StepsVariant
    backLabel?: string
    nextLabel?: string
    submitLabel?: string
    items: StepsItem[]
  }
  children?: never
}
```

Zod (mismo patrón que `tabsItemSchema`/`tabsNodeSchema` en `src/config/runtime-config-zod.ts`):

```ts
export const stepsItemSchema = z
  .object({
    label: z.string(),
    children: z.array(z.unknown()).optional(),
    visibility: visibilitySchema.optional(),
  })
  .strip()

export const stepsNodeSchema = z
  .object({
    type: z.literal('steps'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        variant: z.enum(['horizontal', 'vertical', 'progress']).optional(),
        backLabel: z.string().optional(),
        nextLabel: z.string().optional(),
        submitLabel: z.string().optional(),
        items: z.array(stepsItemSchema).min(1),
      })
      .strip(),
    children: z.never().optional(),
  })
  .strip()
```

Pasos concretos:
1. `src/config/runtime-config-types.ts`: añadir `'steps'` a `LayoutNodeType`; añadir `StepsVariant`, `StepsItem`, `StepsLayoutNode` (shape de arriba, ubicarlos junto a los tipos de `tabs`); añadir `StepsLayoutNode` a la unión `LayoutNode`.
2. `src/config/runtime-config-zod.ts`: añadir `'steps'` a `supportedNodeTypes`; añadir `stepsItemSchema` y `stepsNodeSchema` (shape de arriba, ubicarlos junto a `tabsItemSchema`/`tabsNodeSchema`).
3. `src/config/runtime-config-root-zod.ts`: importar `stepsNodeSchema`; añadir `stepsNodeLooseSchema` (mismo patrón que `tabsNodeLooseSchema`: sustituye `props.items[].children` por el `layoutNodeSchema` recursivo); añadir `stepsNodeLooseSchema` a la unión `layoutNodeSchema`. Esto alimenta el JSON Schema de Monaco (`dev-runtime-json-schema.ts`), que consume `runtimeConfigRootSchema` sin más cambios.
4. `src/config/validate-steps-node.ts` (nuevo): `validateStepsNode(rawNode, path, pageId, breadcrumb?)`, copia estructural de `src/config/validate-tabs-node.ts` adaptada a los campos nuevos: mismos mensajes de error por `props.items`/`props.items[i].label`/`props.items[i].visibility`, y además valida `props.variant` con el mismo criterio que `props.orientation` de `tabs` (mensaje `Page "${pageId}" has an invalid layout at "${path}.props.variant".`) — `backLabel`/`nextLabel`/`submitLabel` no necesitan mensaje dedicado porque son `z.string().optional()` planas, ya cubiertas por `mapLayoutNodeIssue`.
5. `src/config/validate-layout-nodes-core.ts`: importar `validateStepsNode`; añadir `case 'steps': return validateStepsNode(rawNode, path, pageId, breadcrumb)` al switch de `validateLayoutNode`.
6. `src/config/layout-placement-rules.ts`: añadir `'steps'` a `FORM_ALLOWED_DESCENDANT_TYPES`. **No** añadirlo a `FORM_ONLY_LEAF_NODE_TYPES` (ese set asume nodos hoja con `props.fieldId`; ver design.md Decisión 2).
7. `src/config/validate-form-semantics.ts`:
   - En `validateFormNodesInCollection`: añadir un caso `if (node.type === 'steps')` análogo al de `'tabs'` ya existente, pero con la restricción de la spec: si `!context.inForm`, devolver `enrichedInvalidLayoutFromNode(\`Page "${pageId}" has an invalid layout at "${nodePath}": steps nodes must be descendants of a form node.\`, nodeBreadcrumb, node)`; si `context.inForm`, recorrer `node.props.items[i].children` con `validateFormNodesInCollection` igual que el caso `tabs` (mismo patrón de path `${nodePath}.props.items[${itemIndex}].children`).
   - En `validateFormChildren`: añadir un caso `if (node.type === 'steps')` idéntico en estructura al caso `tabs` ya existente (recorre `props.items[i].children` con `validateFormChildren` y el mismo `context`, para que la unicidad de `fieldId` vía `context.fieldIds` se comparta con el resto del form).
   - **Actualizar el mensaje literal ya existente** en `validateFormChildren` para los tipos no permitidos (hoy: `` `... form nodes only accept input, textarea, select, radioGroup, checkboxGroup, fileInput, toggle, hidden, button, heading, paragraph, image, table, container, accordion, divider and tabs descendants.` ``) para que termine en `` `..., divider, tabs and steps descendants.` ``. Es una cadena estática, no derivada de `FORM_ALLOWED_DESCENDANT_TYPES`, así que hay que tocarla a mano o quedará desactualizada pese a que `steps` ya sea un descendiente válido.
8. `src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts`: importar `stepsNodeSchema` desde `runtime-config-zod`; añadir `steps: stepsNodeSchema` a `nodeSchemaByType` (`Record<LayoutNodeType, z.ZodType>` es exhaustivo — sin esta entrada el proyecto no compila en cuanto `LayoutNodeType` incluya `'steps'`).
9. `src/dev-runtime/layout-canvas/layout-canvas-node-palette.tsx`: añadir `steps: 'Pasos'` a `NODE_TYPE_LABELS` (mismo motivo de exhaustividad; esto hace que `steps` aparezca en la paleta de arrastre del canvas con edición genérica por schema, no un panel dedicado — coherente con "fuera de alcance" de la spec, que solo excluye un panel de propiedades a medida).
10. `src/config/runtime-config.ts`: añadir `StepsLayoutNode` a la lista de `export type { ... }` (mismo criterio que `TabsLayoutNode`: solo el tipo del nodo, no `StepsItem`/`StepsVariant`, igual que `tabs` no reexporta `TabsItem`/`TabsOrientation`).

### Fuera de alcance
- Cualquier cambio en `src/runtime/` (componente de render, ciclo de vida de campos).
- Soporte de canvas/drag-drop específico para `steps` más allá de lo forzado por la exhaustividad de tipos (sin nuevo `LayoutPathStep`, sin cambios en `layout-drop-validity.ts`, sin widgets dedicados de propiedades).

### Dependencias
Ninguna. Primera tarea de la secuencia.

### Interfaces
**Consume**: ninguno.

**Produce**:
- `StepsVariant` (tipo `'horizontal' | 'vertical' | 'progress'`) — consumido por: T4.
- `StepsItem` (interfaz, shape arriba) — consumido por: T4 (vía `StepsLayoutNode['props']['items']`).
- `StepsLayoutNode` (interfaz, shape arriba) — consumido por: T4.
- El tipo `LayoutNode` (unión ya existente) pasa a incluir `StepsLayoutNode` — consumido por: T3 (narrowing de `node.type === 'steps'` en los recolectores de campos, sin necesidad de importar `StepsLayoutNode` explícitamente).

### Impacto esperado en archivos
- Código: `src/config/runtime-config-types.ts`, `src/config/runtime-config-zod.ts`, `src/config/runtime-config-root-zod.ts`, `src/config/validate-steps-node.ts` (nuevo), `src/config/validate-layout-nodes-core.ts`, `src/config/layout-placement-rules.ts`, `src/config/validate-form-semantics.ts`, `src/config/runtime-config.ts`, `src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts`, `src/dev-runtime/layout-canvas/layout-canvas-node-palette.tsx`.
- Tests: `src/tests/config-validation/runtime-config-validation-steps.test.ts` (nuevo), `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (ampliación), `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación, 2 asserts existentes que fijan el mensaje literal), `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación, 1 assert existente que fija el mismo mensaje literal).
- Documentación: `ai-workflow/docs/app-features/config/validation.md` (nueva sección "Reglas del nodo `steps`", mirroring de la sección ya existente de `tabs`), `ai-workflow/docs/app-features/nodes/form.md` (ampliar la lista de `children` admitidos por `form` para incluir `steps`).

### Tests

**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-steps.test.ts` (nuevo)
- `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación)

**Comportamiento cubierto**:
- `props.items` ausente o vacío se rechaza con `invalid-layout` y ruta que incluye `props.items`.
- Un item sin `label` se rechaza con ruta `props.items[N].label`.
- `props.variant` con un valor fuera de `horizontal|vertical|progress` se rechaza con ruta `props.variant`; el campo es opcional (config sin `variant` es válido).
- `props.backLabel`/`props.nextLabel`/`props.submitLabel` son opcionales; si se declaran con un tipo no-string, el config se rechaza.
- Los `children` de cada item se validan recursivamente igual que en `tabs`: un nodo no soportado dentro de un item produce `unsupported-node-type`; un nodo con contrato inválido produce `invalid-layout` con ruta `props.items[N].children[...]`.
- Un nodo `steps` declarado en `pages[].layout` fuera de cualquier `form` se rechaza con el mensaje `"... steps nodes must be descendants of a form node."`.
- Un nodo `steps` declarado directamente en `form.children` es válido.
- Un nodo `steps` anidado dentro de `form.children[].container.children` (con `container` de por medio) es válido.
- Un `fieldId` duplicado entre un campo dentro de `steps.props.items[0].children` y un campo hermano fuera de `steps` en el mismo `form` se rechaza como duplicado (mismo `context.fieldIds` que ya comparte `tabs`).
- Un `fieldId` duplicado entre dos items distintos de `steps.props.items` dentro del mismo `form` se rechaza como duplicado.
- `getNodeTypeJsonSchema('steps')` no lanza y expone `properties.props.properties.items`, `.variant`, `.backLabel`, `.nextLabel`, `.submitLabel`.
- `getSupportedNodeTypesCatalog()` devuelve 29 tipos (antes 28) e incluye `'steps'`.
- Los dos asserts existentes en `runtime-config-validation-forms-semantics.test.ts` (casos `list` y `repeater` fuera del allowlist de `form`) y el assert existente en `runtime-config-validation-form-fields.test.ts` (caso `list`) reflejan el mensaje actualizado terminado en `"..., divider, tabs and steps descendants."`.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/config-validation/runtime-config-validation-steps.test.ts
pnpm test --run src/tests/dev-runtime/layout-canvas-node-schema.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts
```

**Restricciones**:
- Reutilizar literalmente el estilo de mensajes de error de `validate-tabs-node.ts` (mismo formato `Page "${pageId}" has an invalid layout at "${path}..."`.) para que el enriquecimiento de breadcrumb/`Node:` ya vigente en `validation.md` siga aplicando sin cambios.
- No introducir un test dedicado para la combinación `steps` anidado dentro de `tabs` dentro de `form`: queda cubierta implícitamente por la recursión genérica ya existente, sin comportamiento nuevo que verificar.
- Al actualizar el mensaje literal de `validateFormChildren`, tocar únicamente esa cadena; no modificar el resto de los dos tests existentes en `runtime-config-validation-forms-semantics.test.ts` ni el resto del test existente en `runtime-config-validation-form-fields.test.ts`.

### Documentación afectada
`ai-workflow/docs/app-features/config/validation.md` (nueva sección "Reglas del nodo `steps`"), `ai-workflow/docs/app-features/nodes/form.md` (lista de `children` admitidos).

### Criterios de finalización
- `steps` es un tipo de nodo reconocido de extremo a extremo en `src/config/`: se parsea, valida su shape, y se rechaza fuera de `form`.
- El proyecto compila con `'steps'` añadido a `LayoutNodeType` (incluida la superficie exhaustiva de `dev-runtime`).
- El mensaje de error de tipos no permitidos dentro de `form` menciona `steps`.
- Todos los tests listados están en verde.

### Cierre de implementación
Código y tests de esta tarea completos, en verde, sin romper ningún test existente de `runtime-config-validation-tabs`/`forms-tabs`/`containers` ni del resto de la suite de `config-validation`.

---

## T2 — Extraer la recolección de campos de formulario a un módulo reutilizable

### Objetivo
Refactor puro de comportamiento: mover las cinco funciones de recorrido hoy privadas en `src/runtime/nodes/form-layout-node.tsx` — `collectResolvedFormFieldDefinitions`, `collectAllFormFieldIds`, `collectHiddenFieldDefinitions`, `collectHiddenNodeFieldIds`, `collectSelectEmptySubmitValues` — a un nuevo módulo `src/runtime/nodes/runtime-form-field-collection.ts`, exportadas, sin cambiar su lógica ni su firma. `form-layout-node.tsx` pasa a importarlas desde el nuevo módulo en lugar de definirlas localmente. Esto prepara el terreno para que T3 les añada el caso `steps` y para que T4 (`StepsNode`) pueda invocar `collectResolvedFormFieldDefinitions` sobre el subárbol de un paso concreto sin duplicar la recursión sobre `container`/`repeater`/`tabs` anidados.

Firmas a preservar exactamente (usar el tipo `RuntimeState` de `../runtime-state/runtime-state-types` en vez de `ReturnType<typeof useRuntimeState>`, comportamiento idéntico):

```ts
function collectResolvedFormFieldDefinitions(
  nodes: LayoutNodeCollection,
  state: RuntimeState,
  iterationContext?: RuntimeIterationContext,
): ResolvedFormFieldDefinition[]

function collectAllFormFieldIds(nodes: LayoutNodeCollection): string[]

function collectHiddenFieldDefinitions(
  nodes: LayoutNodeCollection,
  state: RuntimeState,
  iterationContext?: RuntimeIterationContext,
): Array<{ fieldId: string; value: unknown }>

function collectHiddenNodeFieldIds(nodes: LayoutNodeCollection): Set<string>

function collectSelectEmptySubmitValues(nodes: LayoutNodeCollection): Map<string, string | number>
```

`resolveFileInputFieldDefinition` (usada solo dentro de `collectResolvedFormFieldDefinitions`) se mueve junto con ella al nuevo módulo. El resto de `form-layout-node.tsx` (componente `FormNode`, `buildFileInputSources`, `areFieldValuesEqual`, `shouldRefreshPristineFieldDefault`, `isPlaceholderFieldDefault`) no se toca salvo por los imports.

### Fuera de alcance
- Añadir el caso `steps` a estas funciones (T3).
- Cualquier cambio de comportamiento observable.

### Dependencias
Ninguna (no depende de T1; puede implementarse en paralelo, pero se secuencia aquí para mantener el orden lineal del plan).

### Interfaces
**Consume**: ninguno.

**Produce**:
- `collectResolvedFormFieldDefinitions(nodes: LayoutNodeCollection, state: RuntimeState, iterationContext?: RuntimeIterationContext): ResolvedFormFieldDefinition[]` — consumido por: T3, T4.
- `collectAllFormFieldIds(nodes: LayoutNodeCollection): string[]` — consumido por: T3.
- `collectHiddenFieldDefinitions(nodes: LayoutNodeCollection, state: RuntimeState, iterationContext?: RuntimeIterationContext): Array<{ fieldId: string; value: unknown }>` — consumido por: T3.
- `collectHiddenNodeFieldIds(nodes: LayoutNodeCollection): Set<string>` — consumido por: T3.
- `collectSelectEmptySubmitValues(nodes: LayoutNodeCollection): Map<string, string | number>` — consumido por: T3.

### Impacto esperado en archivos
- Código: `src/runtime/nodes/runtime-form-field-collection.ts` (nuevo), `src/runtime/nodes/form-layout-node.tsx` (modificar: eliminar las funciones movidas, importarlas del nuevo módulo).
- Tests: ninguno nuevo.
- Documentación: ninguna (refactor interno, sin cambio de contrato observable).

### Tests

**Ficheros de test**: ninguno (refactor puro sin cambio de comportamiento); cubierto por la suite existente de formularios: `src/tests/runtime/runtime-form-tabs.test.tsx`, `src/tests/layout-renderer/layout-renderer-forms.test.tsx`, `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx`, `src/tests/layout-renderer/layout-renderer-hidden.test.tsx`, `src/tests/runtime/runtime-form-submit-hidden-fields.test.tsx`, `src/tests/runtime/runtime-api-payload-omission.test.ts`, `src/tests/runtime/runtime-form-submit-empty-select-fallback.test.tsx`.

**Comportamiento cubierto**: no aplica (sin tests nuevos); el criterio de cierre es que la suite listada arriba siga en verde sin modificarla.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/runtime/runtime-form-tabs.test.tsx src/tests/layout-renderer/layout-renderer-forms.test.tsx src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx src/tests/layout-renderer/layout-renderer-hidden.test.tsx src/tests/runtime/runtime-form-submit-hidden-fields.test.tsx src/tests/runtime/runtime-api-payload-omission.test.ts src/tests/runtime/runtime-form-submit-empty-select-fallback.test.tsx
```

**Restricciones**:
- No modificar ninguno de los ficheros de test listados.
- Si algún test de la lista falla tras el refactor, es una regresión de esta tarea: corregir el refactor, no el test.

### Documentación afectada
Ninguna.

### Criterios de finalización
- Las cinco funciones existen en `runtime-form-field-collection.ts` con las firmas indicadas, sin cambio de comportamiento.
- `form-layout-node.tsx` las importa del nuevo módulo y no las define localmente.
- Todos los tests listados están en verde.

### Cierre de implementación
Código completo, en verde, sin romper ningún test existente de la suite de formularios listada arriba.

---

## T3 — Extender la recolección de campos con el caso `steps` y excluirlo de la inicialización eager

### Objetivo
Sobre el módulo creado en T2, añadir el caso `steps` a las cinco funciones, con recorrido **idéntico** al caso `tabs` ya existente en cada una (recorre todos los items con `visibility` visible, sin distinguir paso activo). Además:

1. En `src/runtime/runtime-form-validations.ts`: añadir el campo opcional `stepGroup?: { nodeId: string; itemIndex: number }` a `ResolvedFormFieldDefinition`.
2. En `collectResolvedFormFieldDefinitions` (módulo de T2): cuando el recorrido entra en un nodo `steps`, cada campo resuelto dentro de `props.items[itemIndex].children` recibe `stepGroup: { nodeId: node.id ?? '', itemIndex }` antes de empujarse al array de salida. Los campos que no cuelgan de ningún `steps` mantienen `stepGroup: undefined` (sin declarar la clave, igual que el resto de campos opcionales de la interfaz).
3. En `collectAllFormFieldIds`, `collectHiddenFieldDefinitions`, `collectHiddenNodeFieldIds`, `collectSelectEmptySubmitValues`: añadir el caso `steps` recorriendo `node.props.items[i].children`, mismo patrón que el caso `tabs` de cada función (estas cuatro no necesitan `stepGroup`, ya que no devuelven `ResolvedFormFieldDefinition`).
4. En `src/runtime/nodes/form-layout-node.tsx`: el `useMemo` de `fieldsNeedingInitialization` añade un filtro adicional — un campo con `fieldDefinition.stepGroup !== undefined` nunca entra en la inicialización eager de montaje del form, independientemente de su visibilidad. La inicialización de esos campos queda delegada a `StepsNode` (T4). El resto de la lógica de `fieldsNeedingInitialization` (visibilidad, `fieldState === null`, `shouldRefreshPristineFieldDefault`) no cambia.
5. `handleSubmit` y la pasada de renormalización de choices (`useEffect` que recorre `fieldDefinitions` para `normalizeChoiceFieldValue`) no cambian: siguen operando sobre `fieldDefinitions`/`visibleFieldDefinitions` sin distinguir `stepGroup`, por lo que los campos de `steps` participan en submit, payload y renormalización exactamente igual que los de `tabs`.

### Fuera de alcance
- El componente `StepsNode` y su propio `useEffect` de inicialización lazy por paso (T4).
- Cualquier cambio en el caso `tabs` de estas funciones.

### Dependencias
T1 (`LayoutNode` debe incluir `StepsLayoutNode`/`'steps'` para que el narrowing `node.type === 'steps'` y el acceso a `node.props.items` type-checken en las cinco funciones), T2 (el módulo `runtime-form-field-collection.ts` debe existir).

### Interfaces
**Consume**:
- `LayoutNode` extendido con `StepsLayoutNode` (de T1)
- `collectResolvedFormFieldDefinitions(nodes: LayoutNodeCollection, state: RuntimeState, iterationContext?: RuntimeIterationContext): ResolvedFormFieldDefinition[]` (de T2)
- `collectAllFormFieldIds(nodes: LayoutNodeCollection): string[]` (de T2)
- `collectHiddenFieldDefinitions(nodes: LayoutNodeCollection, state: RuntimeState, iterationContext?: RuntimeIterationContext): Array<{ fieldId: string; value: unknown }>` (de T2)
- `collectHiddenNodeFieldIds(nodes: LayoutNodeCollection): Set<string>` (de T2)
- `collectSelectEmptySubmitValues(nodes: LayoutNodeCollection): Map<string, string | number>` (de T2)

**Produce**:
- Las cinco firmas anteriores, sin cambio de firma pero con comportamiento extendido para nodos `steps` — consumido por: T4.
- `ResolvedFormFieldDefinition` extendida con `stepGroup?: { nodeId: string; itemIndex: number }` — consumido por: T4 (para filtrar/etiquetar campos por paso si lo necesita; T4 también puede resolver campos por paso invocando `collectResolvedFormFieldDefinitions` directamente sobre `item.children` de un único item, sin depender de `stepGroup` para ese uso).

### Impacto esperado en archivos
- Código: `src/runtime/nodes/runtime-form-field-collection.ts` (modificar: caso `steps` en las cinco funciones), `src/runtime/runtime-form-validations.ts` (modificar: campo `stepGroup` en `ResolvedFormFieldDefinition`), `src/runtime/nodes/form-layout-node.tsx` (modificar: filtro de `fieldsNeedingInitialization`).
- Tests: `src/tests/runtime/runtime-form-steps-field-collection.test.tsx` (nuevo).
- Documentación: `ai-workflow/docs/app-features/forms/lifecycle.md` (nueva sección de excepción de inicialización lazy por paso, análoga a la ya existente para `tabs`).

### Tests

**Ficheros de test**:
- `src/tests/runtime/runtime-form-steps-field-collection.test.tsx` (nuevo)

**Comportamiento cubierto**:
- Un `form` con un `steps` de 2 pasos, cada uno con un `input`: al montar el form, ningún campo de `steps` existe todavía en `forms.{formId}.*` (a diferencia de un `tabs` equivalente en el mismo form, que sí se inicializa eager — verificar ambos en el mismo test para el contraste).
- Llamando a submit del form (disparando `handleSubmit` vía el evento nativo del `<form>`, con un botón `type="submit"` de prueba) con el paso 2 nunca "activado" por ninguna UI: el campo del paso 2 se inicializa y valida igual que si fuera visible (falla si es `required` y está vacío, con el error escrito en `forms.{formId}.{fieldId}.error`).
- El payload de un submit exitoso incluye los campos de todos los items de `steps` con `visibility` visible, no solo uno.
- Un item de `steps` con `visibility` oculta: sus campos no se inicializan, no participan en validación y no aparecen en el payload.
- Un campo `hidden` fuera de `steps` en el mismo form sigue inicializándose eager (regresión: el filtro de `stepGroup` no afecta a `collectHiddenFieldDefinitions` fuera de `steps`).
- Un `form` con `steps` + `tabs` + `container` + `repeater` combinados en el mismo árbol: los campos de cada uno se descubren sin cruzarse (un campo de `steps` no aparece con `stepGroup` de otro `steps`, y los campos de `tabs`/`container`/`repeater` no llevan `stepGroup`).
- `collectAllFormFieldIds` y `collectSelectEmptySubmitValues` incluyen los campos/valores dentro de `steps.props.items[].children` (verificable indirectamente vía el comportamiento de omisión de payload en campos ocultos y `emptySubmitValue`, reutilizando el mismo mecanismo que ya cubre `runtime-api-payload-omission.test.ts` para `tabs`).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/runtime/runtime-form-steps-field-collection.test.tsx
```

**Restricciones**:
- No modificar `src/tests/runtime/runtime-form-tabs.test.tsx` ni el resto de la suite de T2: deben seguir en verde sin cambios como confirmación de que el caso `tabs` no se alteró.
- El test nuevo no debe depender de `StepsNode` (T4 aún no existe en este punto de la secuencia): montar el `form` renderizando directamente el árbol de nodos hijos vía `LayoutRenderer`/`FormNode` con fixtures de config ya tipadas como `LayoutNode[]`, sin pasar por el dispatcher de `NodeComponents.steps` (que a esta altura no existe todavía).

### Documentación afectada
`ai-workflow/docs/app-features/forms/lifecycle.md` (sección de excepción de inicialización lazy por paso de `steps`).

### Criterios de finalización
- Las cinco funciones de recolección reconocen `steps` con el mismo criterio que `tabs`.
- Los campos dentro de `steps` quedan excluidos de la inicialización eager de montaje del form, sin afectar a `tabs`/`hidden`/resto del árbol.
- Submit, payload y renormalización de choices siguen incluyendo los campos de `steps` igual que los de `tabs`.
- Todos los tests listados están en verde.

### Cierre de implementación
Código y tests de esta tarea completos, en verde, sin romper ningún test existente de `runtime-form-tabs.test.tsx` ni del resto de la suite de formularios de T2.

---

## T4 — Nodo de runtime `StepsNode`

### Objetivo
Implementar el componente `StepsNode` (`src/runtime/nodes/steps-layout-node.tsx`) y conectarlo al dispatcher central, cubriendo el modelo de interacción completo de la spec y las tres variantes visuales.

**Modelo de estado y navegación** (mismo patrón que `TabsNodeContent` en `src/runtime/nodes/tabs-layout-node.tsx`):
- `visibleIndices`: índices del array original de `props.items` cuya `visibility` evalúa como visible (o todos si no declaran `visibility`), recalculado en cada render.
- Si `visibleIndices.length === 0`, el nodo no renderiza nada (`return null`).
- Estado local `activeIndex` (índice del array original del paso mostrado), inicializado a `visibleIndices[0]`.
- Estado local `maxVisitedIndex`, inicializado también a `visibleIndices[0]`: el índice más alto alcanzado mediante un "Siguiente" válido.
- Patrón "adjusting state during render" (igual que `TabsNodeContent`): si `activeIndex` deja de estar en `visibleIndices`, se corrige a `visibleIndices[0]` en el mismo render (cubre FR13). Si `maxVisitedIndex` deja de estar en `visibleIndices`, se corrige de la misma forma.

**Inicialización lazy por paso**:
- `useEffect` con dependencia `[activeIndex]` (y `node.id`, `state`, `iterationContext`, `initializeForm` como dependencias adicionales de React): calcula `collectResolvedFormFieldDefinitions(items[activeIndex].children ?? [], state, iterationContext)` (de T2/T3), filtra los campos visibles (`isLayoutNodeVisible`) que todavía no tengan estado (`selectFormFieldState(state, node.id, fieldId) === null`), e inicializa el resto con `initializeForm(node.id, { [fieldId]: { defaultValue }, ... })` — mismo patrón que usa `FormNode` para el conjunto completo, acotado al paso activo.

**Gating de validación al pulsar "Siguiente"**:
1. Resolver `activeFieldDefinitions = collectResolvedFormFieldDefinitions(items[activeIndex].children ?? [], state, iterationContext)`.
2. Filtrar por visibilidad: `visibleActiveFieldDefinitions = activeFieldDefinitions.filter((f) => isLayoutNodeVisible(f, state, iterationContext))`.
3. Invocar `validateFormFields({ formId: node.id, fieldDefinitions: visibleActiveFieldDefinitions, state, iterationContext })` (función ya existente en `runtime-form-validations.ts`, sin cambios).
4. Si `!result.isValid`: para cada `[fieldId, error]` de `result.errorsByFieldId`, invocar `setFormFieldError(node.id, fieldId, error, { defaultValue: ... })` (mismo patrón que `handleSubmit` en `form-layout-node.tsx`); no avanzar `activeIndex`.
5. Si `result.isValid`: calcular el siguiente índice visible tras `activeIndex` dentro de `visibleIndices`; actualizar `activeIndex` a ese índice; si su posición en `visibleIndices` supera la posición actual de `maxVisitedIndex`, actualizar también `maxVisitedIndex`.

**Navegación libre hacia atrás**:
- Botón "Atrás": mueve `activeIndex` al índice visible inmediatamente anterior dentro de `visibleIndices`, sin invocar `validateFormFields`.
- Indicador clicable (`horizontal`/`vertical` únicamente): cada paso visible es clicable solo si su posición dentro de `visibleIndices` es `<=` la posición de `maxVisitedIndex` dentro de `visibleIndices`; al pulsarlo, `activeIndex` pasa a ese índice sin validar. Un paso en una posición posterior a `maxVisitedIndex` no es clicable (sin `onClick`, o `disabled`).
- Variante `progress`: no renderiza ningún control de paso individual; solo botón "Atrás" (cuando aplica) y el texto de progreso.

**Botones de navegación**:
- Si `visibleIndices.length === 1`: no se renderiza "Atrás" ni "Siguiente"; solo el botón de envío.
- En cualquier otro caso: se renderiza "Atrás" salvo cuando `activeIndex` es el primero de `visibleIndices`; se renderiza "Siguiente" cuando `activeIndex` no es el último de `visibleIndices`; se renderiza el botón de envío cuando `activeIndex` es el último de `visibleIndices`.
- "Atrás" y "Siguiente": `<button type="button" onClick={...} className={getButtonVariantClassName('neutral', 'outline', false)}>` para "Atrás", `className={getButtonVariantClassName('primary', 'solid', false)}` para "Siguiente" y para el botón de envío.
- Botón de envío: `<button type="submit" className={getButtonVariantClassName('primary', 'solid', false)}>{submitLabel}</button>`, sin `onClick` propio — se apoya en la navegación nativa del `<form>` ya renderizado por `FormNode` (mismo mecanismo que un `button` sin `action` dentro de `form` hoy). No se introduce ningún mecanismo de submit nuevo.
- Textos: `backLabel = resolveRuntimeTextReference(node.props.backLabel ?? 'Back', state, ..., { iterationContext })`, `nextLabel = resolveRuntimeTextReference(node.props.nextLabel ?? 'Next', state, ..., { iterationContext })`, `submitLabel = resolveRuntimeTextReference(node.props.submitLabel ?? 'Submit', state, ..., { iterationContext })` — mismo mecanismo de interpolación que `tabs.props.items[].label` en `TabsNode`.

**Panel activo**:
- Renderiza `items[activeIndex].children` vía `<LayoutRenderer nodes={items[activeIndex].children ?? []} iterationContext={iterationContext} />`, sin `path` ni `buildChildPath` propios: la selección/edición individual de nodos dentro de un paso en el canvas del dev-editor queda fuera de alcance de esta feature (ver spec, "fuera de alcance"), igual que el resto del soporte de editor visual dedicado a `steps`. El nodo `steps` en sí sigue siendo seleccionable de forma genérica en el canvas (wrapper de `LayoutNodeRenderer`), solo sus hijos internos no.
- Si el item activo no declara `children` o los declara vacíos: el panel se muestra vacío sin error.

**Variantes visuales** — nuevo módulo `src/runtime/runtime-node-styling-steps.ts`, re-exportado desde `src/runtime/runtime-node-styling.ts` (mismo patrón que `runtime-node-styling-tabs.ts`):
- `getStepsRootClassName(variant: StepsVariant): string`
- `getStepsIndicatorClassName(variant: StepsVariant): string`
- `getStepsMarkerClassName(status: 'active' | 'visited' | 'upcoming', variant: StepsVariant): string` — marcador circular numerado 1-based sobre los pasos visibles; `active`/`visited` con paleta `primary` (mismo criterio semántico que `badge`/`stat`), `upcoming` con paleta neutra.
- `getStepsPanelClassName(): string` — reutiliza el criterio ya vigente de `getTabsPanelClassName()` (borde perimetral `border-app-border-soft`, `p-4`, hijos en `flex flex-col gap-5`), técnica de "tab conectado" adaptada: en `horizontal` el marcador+etiqueta del paso activo funde su borde inferior con el panel (igual criterio que `getTabsButtonClassName` en orientación `horizontal`); en `vertical`, el paso activo funde su borde derecho con el panel (igual criterio que `getTabsButtonClassName` en orientación `vertical`); `progress` no tiene indicador con el que fusionar, solo el panel con su borde perimetral estándar.
- La resolución por variante se centraliza en un lookup `Record<StepsVariant, (props: StepsIndicatorProps) => ReactNode>` para la porción de indicador únicamente, definido en `steps-layout-node.tsx` (requiere JSX, no puede vivir en el módulo `.ts` de estilos puros). El esqueleto común (panel + fila de navegación + lógica de gating descrita arriba) se declara una sola vez en `StepsNode`/`StepsNodeContent`, no se repite por variante.
- `progress`: el indicador es solo texto, `` `Paso ${posiciónActual} de ${totalVisibles}` `` interpolado como texto plano (posición 1-based del `activeIndex` dentro de `visibleIndices`), sin usar `resolveRuntimeTextReference` (no es un texto configurable por props, es derivado).

**Registro del nodo**:
- `src/runtime/nodes/node-components-map.ts`: añadir `steps: StepsNode as AnyComponent` a `eagerMap` y `steps: React.lazy(() => import('./steps-layout-node').then((m) => ({ default: m.StepsNode })))` a `lazyMap`.
- `src/runtime/layout-node-renderer.tsx`: añadir `case 'steps': { const StepsNode = NodeComponents.steps; renderedNode = <StepsNode node={node} iterationContext={iterationContext} />; break }` (sin `path`, ver nota de panel activo arriba).

### Fuera de alcance
- Soporte de editor visual dedicado (paneles de propiedades a medida para `props.items`/`props.variant`, selección de nodos hijos dentro de un paso en el canvas).
- Cualquier cambio a `TabsNode`/`AccordionNode`.

### Dependencias
T1 (tipos y validación), T3 (recolección de campos con caso `steps` y `stepGroup`).

### Interfaces
**Consume**:
- `StepsLayoutNode` (de T1)
- `collectResolvedFormFieldDefinitions(nodes: LayoutNodeCollection, state: RuntimeState, iterationContext?: RuntimeIterationContext): ResolvedFormFieldDefinition[]` (de T2/T3)

**Produce**:
- `StepsNode({ node, iterationContext }: { node: StepsLayoutNode; iterationContext?: RuntimeIterationContext }): JSX.Element | null` — sin consumidores directos dentro de este plan (se conecta al dispatcher central, no lo importa ninguna otra tarea).

### Impacto esperado en archivos
- Código: `src/runtime/nodes/steps-layout-node.tsx` (nuevo), `src/runtime/runtime-node-styling-steps.ts` (nuevo), `src/runtime/runtime-node-styling.ts` (modificar: re-exportar los helpers de `runtime-node-styling-steps.ts`), `src/runtime/nodes/node-components-map.ts` (modificar), `src/runtime/layout-node-renderer.tsx` (modificar).
- Tests: `src/tests/layout-renderer/layout-renderer-steps.test.tsx` (nuevo), `src/tests/runtime/runtime-node-components-map.test.tsx` (ampliación).
- Documentación: `ai-workflow/docs/app-features/nodes/index.md` (nueva entrada en el catálogo), `ai-workflow/docs/app-features/nodes/steps.md` (nueva ficha), `ai-workflow/docs/app-features/forms/lifecycle.md` (sección de gating de validación al avanzar de paso, complementaria a la de T3), `ai-workflow/docs/current-state.md` (evaluar si cambia la fila de "Catálogo de nodos"/"Formularios y validación").

### Tests

**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-steps.test.tsx` (nuevo)
- `src/tests/runtime/runtime-node-components-map.test.tsx` (ampliación)

**Comportamiento cubierto** (en `layout-renderer-steps.test.tsx`):
- Al montar un `steps` de 3 pasos sin ninguno oculto, el paso activo es el primero (`visibleIndices[0]`), variante por defecto `horizontal`.
- Con un campo `required` vacío en el paso activo, al pulsar "Siguiente" el paso no avanza y el campo muestra su mensaje de error; el resto de pasos no se ven afectados.
- Con todos los campos válidos del paso activo, al pulsar "Siguiente" el paso activo pasa a ser el siguiente visible.
- Tras avanzar hasta el paso 3, pulsar "Atrás" retrocede al paso 2 sin invocar validación (un campo inválido en el paso 2 no bloquea el retroceso) y conserva los valores ya introducidos en todos los pasos.
- Tras avanzar hasta el paso 3, pulsar el paso 1 en el indicador (`horizontal`) retrocede a él; pulsar un paso no alcanzado (uno posterior al actual nunca visitado) no tiene efecto.
- El último paso visible renderiza un botón `type="submit"` con el texto por defecto `"Submit"` (o `props.submitLabel` si se declara) que, al pulsarse con todos los campos de todos los pasos visibles válidos, dispara `submitAction` del `form` padre con el payload agregado de todos los pasos no ocultos.
- Un item de `steps` con `visibility` oculta: no aparece en el indicador, no es alcanzable, y sus campos no aparecen en el payload del submit ni bloquean el avance de otros pasos.
- Con `steps` de un único item visible: no se renderizan "Atrás" ni "Siguiente", solo el botón de envío.
- Si el paso activo pasa a estar oculto por un cambio de `visibility` en runtime (p. ej. tras cambiar un valor de formulario del que depende esa `visibility`), el paso activo se recalcula automáticamente al primer paso visible.
- Un item sin `children` o con `children: []` muestra un panel vacío sin error.
- `props.variant: "vertical"`: mismo modelo de interacción, indicador a la izquierda, técnica de "tab conectado" con fusión de borde derecho en el paso activo.
- `props.variant: "progress"`: el indicador es el texto `"Paso X de Y"` sin ningún control de paso individual pulsable; solo "Atrás" permite retroceder.
- `props.backLabel`/`props.nextLabel`/`props.submitLabel` personalizados se usan en vez de los valores por defecto, con soporte de interpolación `{{...}}`.
- Transversales: `layout.span` aplica la clase de ocupación de grid esperada; `visibility` a nivel de nodo oculta el `steps` completo (barra/indicador y panel); `queryStateFeedback` en un estado distinto de la rama principal sustituye el nodo `steps` entero por el feedback correspondiente.

**Comportamiento cubierto** (en `runtime-node-components-map.test.tsx`, ampliación):
- `EXPECTED_KEYS` incluye `'steps'`; el test de "exporta exactamente N claves" pasa a esperar 29.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/layout-renderer/layout-renderer-steps.test.tsx
pnpm test --run src/tests/runtime/runtime-node-components-map.test.tsx
```

**Restricciones**:
- Reutilizar `getButtonVariantClassName` de `runtime-node-styling-button.ts` para los tres botones (colores/variantes fijados arriba); no declarar clases de botón nuevas.
- Reutilizar la técnica de "tab conectado" ya implementada para `tabs` (`getTabsButtonClassName`/`getTabsPanelClassName` en `runtime-node-styling-tabs.ts`) como referencia directa de las clases a adaptar en `runtime-node-styling-steps.ts`, sin reinventar la paleta.
- No añadir un test dedicado de code-splitting en `runtime-nodes-bundle.test.ts`: ese gate ya verifica invariantes genéricas de splitting sin depender de un marcador por nodo para `steps`.

### Documentación afectada
`ai-workflow/docs/app-features/nodes/index.md`, `ai-workflow/docs/app-features/nodes/steps.md` (nueva), `ai-workflow/docs/app-features/forms/lifecycle.md`, `ai-workflow/docs/current-state.md` (evaluar).

### Criterios de finalización
- `StepsNode` implementa el modelo de interacción completo de la spec (montaje, gating de "Siguiente", "Atrás" libre, indicador clicable acotado a `maxVisitedIndex`, submit en el último paso, caso de un único paso visible, reactivación automática ante ocultación del paso activo) en las tres variantes.
- El nodo está registrado en `NodeComponents` (eager y lazy) y en el switch de `layout-node-renderer.tsx`.
- Los transversales (`layout.span`, `visibility`, `queryStateFeedback`) funcionan sin código adicional más allá de extender los tipos correctos (ya cubierto por T1).
- Todos los tests listados están en verde.

### Cierre de implementación
Código y tests de esta tarea completos, en verde, sin romper ningún test existente de `layout-renderer-tabs.test.tsx`, `runtime-form-tabs.test.tsx` ni del resto de la suite de `layout-renderer`/`runtime`.
