# Tasks — 0115 — Layout and form validators split

Contrato de ejecución. Ordenado por dependencia. La siguiente tarea que debe abordarse siempre es la primera cuyo
estado no sea `done`.

## Referencia común para toda la feature

### Inventario real (verificado con grep, no con la estimación de la spec)

La spec estimaba ~44 funciones en `validate-layout-nodes.ts` y ~32 en `validate-form-nodes.ts` (~76 total). El
recuento real, verificado con `grep -n "^export function\|^function " src/config/validate-layout-nodes.ts` y el
equivalente para `validate-form-nodes.ts`, es:

- `validate-layout-nodes.ts`: **43 funciones** (8 exportadas: `validateLayoutCollection`, `validateLayoutNode`,
  `validateQueryStateFeedback`, `mapCollectionPaginationIssue`, `mapLeafNodeIssue`, `mapLayoutNodeIssue`,
  `validateLinkNode`, `validateTableCellNode`; 35 privadas) + 1 re-export puro (`validateVisibility`, importado de
  `validate-actions-visibility.ts` y simplemente reexportado, no implementado aquí).
- `validate-form-nodes.ts`: **41 funciones** (14 exportadas: `validateFormNode`, `validateInputNode`,
  `validateTextareaNode`, `validateSelectNode`, `validateRadioGroupNode`, `validateCheckboxGroupNode`,
  `validateToggleNode`, `validateHiddenNode`, `validateFormFieldValidations`, `validateSelectItemsContract`,
  `validateCollectionSource`, `validateChoiceFieldDefaultValue`, `validateFormSemantics`,
  `validateExecutionRequestParams`; 27 privadas).
- **Total: 84 funciones** definidas en los dos ficheros (no 76). De ellas, 6 están duplicadas byte a byte entre
  ambos ficheros (`isRecord`, `isNonEmptyString`, `formatPathSegment`, `isValidCollectionItemPath`,
  `isValidCollectionProjectionPath`, `isValidCollectionPathSegment`, más la constante `collectionPathSegmentPattern`)
  y se consolidan en un único módulo compartido (Task 1), por lo que el mundo final contiene **78 implementaciones
  distintas** repartidas en 28 módulos nuevos, más el passthrough de `validateVisibility` que se redirige a su fuente
  real sin moverse.
- Los únicos importadores externos verificados con grep: `src/config/validate-runtime-config.ts` importa
  `validateLayoutCollection` de `validate-layout-nodes.ts` y `validateFormSemantics`/`validateExecutionRequestParams`
  de `validate-form-nodes.ts`. Ningún otro fichero de `src/` importa directamente de estas dos rutas.

### El ciclo real hoy (verificado con grep de los bloques de import)

- `validate-layout-nodes.ts` importa de `validate-form-nodes.ts` (9 símbolos): `validateFormNode`,
  `validateInputNode`, `validateTextareaNode`, `validateSelectNode`, `validateRadioGroupNode`,
  `validateCheckboxGroupNode`, `validateToggleNode`, `validateHiddenNode`, `validateCollectionSource`.
- `validate-form-nodes.ts` importa de `validate-layout-nodes.ts` (5 símbolos): `validateLayoutCollection`,
  `validateQueryStateFeedback`, `validateVisibility`, `mapLeafNodeIssue`, `mapLayoutNodeIssue`.

### Hallazgo estructural adicional (no anticipado por la spec): un segundo ciclo, interno a `layout`

Además del ciclo cruzado layout⟷form ya documentado en la spec, la lectura completa de ambos ficheros revela que
`validate-layout-nodes.ts` tiene su propio ciclo estructural interno, inherente a su diseño (no un artefacto de mal
código):

- `validateLayoutNode` (el dispatcher/switch) necesita referenciar directamente **cada uno** de los 23 validadores de
  tipo de nodo (17 de dominio layout + los 6 de campo de formulario + `validateHiddenNode`, ver más abajo) para poder
  despachar por `type`.
- `validateQueryStateFeedback` es llamada por **todos** los validadores de nodo (de layout y de formulario) para su
  propio campo `queryStateFeedback`, y a su vez `validateQueryStateFeedback` necesita `validateLayoutCollection` para
  validar recursivamente el contenido de `states.{estado}.fallback`.
- Siete validadores de nodo de layout (`container`, `repeater`, `modal`, `tabs`, `accordion`, `link`, y `table` a
  través de `validateTableCellNode`) recursan explícitamente hacia `validateLayoutCollection`/`validateLayoutNode`
  para validar sus propios `children`/`template`/`items[].children`/celdas.

Estos tres hechos combinados prueban matemáticamente que `validateLayoutCollection` + `validateLayoutNode` +
`validateQueryStateFeedback` (el "núcleo") y **cada uno** de los 23 validadores de tipo de nodo forman una única
componente fuertemente conexa (SCC): el núcleo necesita importar de cada validador de nodo (para el switch), y cada
validador de nodo necesita importar del núcleo (como mínimo `validateQueryStateFeedback`; los 7 recursivos también
`validateLayoutCollection`/`validateLayoutNode`). No existe ninguna partición de esta SCC en más de un módulo que
evite un ciclo, salvo con un rediseño no mecánico (p. ej. un registro de dispatch en runtime), que excede el alcance
"puramente mecánico" de esta feature y no está autorizado por la spec.

**Decisión de esta planificación**: se acepta esta topología como **"hub and spoke"**: un único módulo hub
(`validate-layout-nodes-core.ts`, con `validateLayoutCollection` + `validateLayoutNode` + `validateQueryStateFeedback`)
que importa de cada módulo de nodo (para el switch) y es importado por cada módulo de nodo (para
`validateQueryStateFeedback`, y en 7 casos también para la recursión de colección). Esto produce un ciclo de 2 nodos
entre el hub y cada módulo de nodo — 17 ciclos internos al dominio layout, más 2 ciclos cruzados con el dominio form
(`validate-form-node.ts` y `validate-form-field-nodes.ts`, ver tabla de módulos). **Cero módulos de nodo importan
entre sí** (excepto `validate-table-node.ts` → `validate-repeater-node.ts` para reutilizar
`mapCollectionPaginationIssue`, unidireccional, sin ciclo, igual que el patrón tabla→paginación de 0114).

Esta topología es segura en runtime: todas las funciones implicadas son `function` declarations (hoisted), ninguna se
invoca en tiempo de evaluación de módulo (top-level), solo dentro de cuerpos de función que se ejecutan después de que
todos los módulos han terminado de cargar. Es el mismo patrón, ampliamente usado, de cualquier validador
recursive-descent partido en varios ficheros. Es una generalización estricta, no una violación, del criterio de
aceptación 5 de la spec: el texto de ese criterio ("salvo la recursión cruzada barrel-a-barrel ya descrita") asume que
el ciclo sancionado es *entre dominios*; aquí se documenta explícitamente que el mismo principio aplica *dentro* del
dominio layout por la razón estructural probada arriba, y se localiza el ciclo al mínimo posible: nunca barrel↔barrel,
siempre hub-módulo-concreto↔módulo-concreto. La revisión automática de este plan debe verificar explícitamente que:
(a) ningún módulo "spoke" importa de otro "spoke" salvo table→repeater, (b) los únicos módulos con arista de vuelta
hacia `validate-layout-nodes-core.ts` son los 17 módulos de nodo de layout listados abajo más
`validate-form-node.ts` y `validate-form-field-nodes.ts`, (c) `validate-hidden-node.ts` NO tiene arista hacia el hub
(no usa `queryStateFeedback` ni `visibility`, solo `mapLeafNodeIssue`), (d) ninguno de los dos barrels
(`validate-layout-nodes.ts`, `validate-form-nodes.ts`) es importado por ningún módulo interno nuevo.

**Nota de `review-implementation-plan` (verificada contra el código real, ver `status.yaml` → `blocked_by`)**: los
cuatro puntos (a)-(d) se han verificado con `grep`/lectura directa de `src/config/validate-layout-nodes.ts` y
`validate-form-nodes.ts` y son ciertos hoy; el análisis de la SCC (componente fuertemente conexa) es correcto. Sin
embargo, el ciclo hub↔spoke aquí aceptado no está cubierto, tal cual está redactado hoy, por la excepción que
`spec.md` autoriza explícitamente: el criterio de aceptación 5 y el requisito no funcional correspondiente de
`spec.md` solo exceptúan la recursión "barrel-a-barrel" entre los dos ficheros de entrada (`validate-layout-nodes.ts`
⟷ `validate-form-nodes.ts`), no un ciclo entre módulos internos nuevos como `validate-layout-nodes-core.ts` y cada
módulo "spoke". Antes de implementar, `spec.md` (criterio de aceptación 5 y la sección "Requisitos no funcionales",
y opcionalmente un bullet nuevo en "Riesgos o preguntas abiertas") debe ampliarse para sancionar explícitamente este
segundo ciclo intra-dominio, con el mismo razonamiento ya documentado arriba. Esta tarea de planificación no
requiere cambios de código ni de tests.

### Simplificaciones respecto al ciclo documentado en la spec

- `validateCollectionSource` deja de ser un import cruzado layout→form: se consolida en un módulo base compartido
  `validate-collection-source.ts` (autorizado explícitamente por la spec, sección "Casos límite"), usado directamente
  por los módulos de layout (`repeater`, `heading-paragraph-list` para `list`, `table`) y de form (`choice-items`) que
  lo necesitan. Esto reduce el cruce layout→form de 9 a 8 símbolos reales.
- `validateVisibility` deja de fluir a través de `validate-layout-nodes.ts`: `validate-form-node.ts` y
  `validate-form-field-nodes.ts` lo importan directamente de `../config/validate-actions-visibility` (su fuente real;
  hoy `validate-layout-nodes.ts` solo lo reexporta sin implementarlo). El barrel de layout sigue reexportando
  `validateVisibility` (para no romper el requisito funcional 1), pero como passthrough directo desde
  `validate-actions-visibility`, no desde ningún módulo interno nuevo. Esto reduce el cruce form→layout de 5 a 4
  símbolos reales: `validateLayoutCollection`, `validateQueryStateFeedback`, `mapLeafNodeIssue`, `mapLayoutNodeIssue`.

### Mapa de módulos nuevos (autoridad de asignación función → fichero)

**Compartidos (usados por ambos dominios, sin pertenecer a ninguno):**

| Módulo | Símbolos | Dependencias internas |
|---|---|---|
| `validate-node-shared-helpers.ts` | `isRecord`, `isNonEmptyString`, `formatPathSegment`, `isValidCollectionItemPath`, `isValidCollectionProjectionPath`, `isValidCollectionPathSegment` (+ const `collectionPathSegmentPattern`, privada) | ninguna (usa `hasRuntimeTemplateDelimiter` externo) |
| `validate-collection-source.ts` | `validateCollectionSource` (pública), `isValidCollectionSourceReference`, `isValidQueryCollectionSource` (privadas) | `validate-node-shared-helpers` |

**Dominio layout (`src/config/`):**

| Módulo | Símbolos | Dependencias internas | Arista de vuelta al hub |
|---|---|---|---|
| `validate-layout-nodes-core.ts` (hub) | `validateLayoutCollection`, `validateLayoutNode`, `validateQueryStateFeedback` (las 3 públicas) | importa las 17 funciones de nodo de layout + `validateFormNode`/6 de `validate-form-field-nodes`/`validateHiddenNode`; `validate-node-shared-helpers` (`isRecord`) | — (es el hub) |
| `validate-layout-issue-mapping.ts` | `mapLeafNodeIssue`, `mapLayoutNodeIssue` (públicas) | `validate-node-shared-helpers` (`formatPathSegment`) | ninguna (no depende del hub) |
| `validate-container-node.ts` | `validateContainerNode` (privada hoy, sigue privada) | hub, issue-mapping, shared-helpers | sí |
| `validate-repeater-node.ts` | `validateRepeaterNode` (privada), `mapCollectionPaginationIssue` (pública), `isValidRepeaterItemKeyPath` (privada) | hub, issue-mapping, shared-helpers, `validate-collection-source` | sí |
| `validate-heading-paragraph-list-nodes.ts` | `validateHeadingNode`, `validateParagraphNode`, `validateListNode`, `validateListItems` (todas privadas) | hub, issue-mapping, shared-helpers, `validate-collection-source` | sí |
| `validate-image-node.ts` | `validateImageNode` (privada) | hub, issue-mapping | sí |
| `validate-table-node.ts` | `validateTableNode`, `mapTableColumnsIssue`, `validateTableHeaders`, `validateTableColumns`, `validateTableRows`, `validateTableManualRows`, `validateTableDynamicRows`, `validateTableCellNode` (pública), `checkContainerChildrenSubset`, `isTableCellPrimitive` (resto privadas) | hub (incl. `validateLayoutNode` para la delegación de celda), issue-mapping, shared-helpers, `validate-collection-source`, `validate-repeater-node` (`mapCollectionPaginationIssue`, unidireccional) | sí |
| `validate-button-node.ts` | `validateButtonNode` (privada) | hub, issue-mapping | sí |
| `validate-link-node.ts` | `validateLinkNode` (pública), `checkLinkChildrenAllowedTypes` (privada) | hub, issue-mapping, shared-helpers, `layout-placement-rules` (ext) | sí |
| `validate-modal-node.ts` | `validateModalNode` (privada) | hub, issue-mapping | sí |
| `validate-tabs-node.ts` | `validateTabsNode` (privada) | hub, issue-mapping, shared-helpers | sí |
| `validate-accordion-node.ts` | `validateAccordionNode` (privada) | hub, issue-mapping | sí |
| `validate-badge-node.ts` | `validateBadgeNode` (privada) | hub, issue-mapping | sí |
| `validate-alert-node.ts` | `validateAlertNode` (privada) | hub, issue-mapping | sí |
| `validate-stat-node.ts` | `validateStatNode` (privada) | hub, issue-mapping | sí |
| `validate-divider-node.ts` | `validateDividerNode` (privada) | hub, issue-mapping | sí |
| `validate-skeleton-node.ts` | `validateSkeletonNode` (privada) | hub, issue-mapping | sí |
| `validate-file-input-node.ts` | `validateFileInputNode` (privada) — **no confundir con el fichero existente `validate-file-input-nodes.ts` (plural, semántica de segunda pasada, no tocado por esta feature)** | hub, issue-mapping | sí |
| `validate-file-manager-node.ts` | `validateFileManagerNode` (privada) — **no confundir con `validate-file-manager-nodes.ts` (plural, existente, no tocado)** | hub, issue-mapping | sí |

**Dominio form (`src/config/`):**

| Módulo | Símbolos | Dependencias internas | Cruce con layout |
|---|---|---|---|
| `validate-form-field-validations.ts` | `validateFormFieldValidations` (pública), `validateRequiredRule`, `validateNumericRule`, `validatePatternRule`, `validateBooleanFlagRule`, `validateValidationCompatibility`, `validateValidationRanges`, `supportsTextLengthValidations`, `supportsSelectionCardinalityValidations`, `supportsTextualValidations` (privadas), + const `supportedFormValidationRuleNames`, type `FormFieldValidationTarget` | shared-helpers; `validateWhenCondition` (ext, `validate-actions-visibility`) | ninguno |
| `validate-form-choice-items.ts` | `validateSelectItemsContract` (pública), `validateChoiceFieldDefaultValue` (pública), `validateMultipleChoiceDefaultValue`, `validateSelectScalarValues` (privadas) | shared-helpers, `validate-collection-source` | ninguno |
| `validate-form-semantics.ts` | `validateFormSemantics` (pública), `collectModalIds`, `isFormOnlyLeafNode`, `validateFormNodesInCollection`, `validateFormChildren`, `validateOnSuccessActionTargets`, `validateOnErrorActionTargets`, `validateFallbackCollections` (privadas), interface `FormValidationContext` | `layout-placement-rules` (ext), `validation-breadcrumb` (ext) | ninguno (opera sobre árbol ya validado) |
| `validate-form-request-params.ts` | `validateExecutionRequestParams` (pública), `validateExecutionRequestParamsInCollection` (privada) | `validation-breadcrumb` (ext) | ninguno |
| `validate-hidden-node.ts` | `validateHiddenNode` (pública), const `hiddenProhibitedProps` | issue-mapping (`mapLeafNodeIssue`), shared-helpers | solo hacia `validate-layout-issue-mapping` (sin arista de vuelta al hub: no usa `queryStateFeedback`/`visibility`) |
| `validate-form-field-nodes.ts` | `validateInputNode`, `validateTextareaNode`, `validateSelectNode`, `validateRadioGroupNode`, `validateCheckboxGroupNode`, `validateToggleNode` (privadas) | hub (`validateQueryStateFeedback`), issue-mapping (`mapLeafNodeIssue`), `validate-form-field-validations`, `validate-form-choice-items`, shared-helpers; `validateVisibility`/`mapQueryStateFeedbackIssue`/`mapVisibilityIssue` (ext, directo de `validate-actions-visibility`) | sí, con el hub (arista de vuelta) |
| `validate-form-node.ts` | `validateFormNode` (pública) | hub (`validateLayoutCollection`, `validateQueryStateFeedback`), issue-mapping (`mapLayoutNodeIssue`); `validateFormSubmitAction`/`validateVisibility`/ext | sí, con el hub (arista de vuelta) |

Total: 4 compartidos/hub-adyacentes (shared-helpers, collection-source, core, issue-mapping) + 17 módulos de nodo de
layout + 7 módulos de form = **28 módulos nuevos**.

### Orden de ejecución (fases)

1. **Fase 1 — cimientos sin dependencias cíclicas** (Tasks 1-4): helpers compartidos, `collection-source`,
   `issue-mapping`, y el hub (`validate-layout-nodes-core.ts`). El hub, en el momento de su extracción (Task 4), aún
   no tiene disponibles los 17 módulos de nodo de layout ni los 3 de form que necesita para el switch: los importa
   temporalmente desde los ficheros originales `validate-layout-nodes.ts`/`validate-form-nodes.ts` (que todavía los
   contienen). Cada tarea posterior que extrae uno de esos símbolos (Tasks 5-21, 26-28) **debe además** actualizar la
   línea de import correspondiente en `validate-layout-nodes-core.ts` para apuntar al nuevo módulo. Esto es señalado
   explícitamente en el "Impacto esperado en archivos" de cada una de esas tareas.
2. **Fase 2 — módulos de nodo de layout** (Tasks 5-21): un módulo por tipo de nodo (o familia reconocible), en el
   orden container → repeater → heading/paragraph/list → image → table (depende de repeater) → button → link → modal
   → tabs → accordion → badge → alert → stat → divider → skeleton → fileInput → fileManager. El orden entre ellos,
   salvo table-tras-repeater, es libre (no hay dependencias cruzadas entre spokes).
3. **Fase 3 — módulos de form sin dependencia de layout** (Tasks 22-25): `validate-form-field-validations.ts`,
   `validate-form-choice-items.ts`, `validate-form-semantics.ts`, `validate-form-request-params.ts`. Pueden ejecutarse
   en cualquier momento tras la Fase 1 (no dependen de layout), se agrupan aquí por claridad narrativa.
4. **Fase 4 — módulos de form con cruce hacia layout** (Tasks 26-28): `validate-form-field-nodes.ts` (depende de Task
   22 y 23), `validate-hidden-node.ts`, `validate-form-node.ts`. Cada una actualiza también la línea de import
   correspondiente en `validate-layout-nodes-core.ts`.
5. **Fase 5 — barrels puros y verificación global** (Task 29).

### Reglas transversales

- Feature puramente mecánica: cero cambio de comportamiento, cero cambio de mensaje de error/código/ruta
  canónica/breadcrumb, cero cambio de firma de función. Copia literal salvo la consolidación explícitamente autorizada
  de los 6 helpers duplicados (Task 1) y de `validateCollectionSource` (Task 2).
- Ningún módulo interno nuevo importa nunca desde los barrels (`validate-layout-nodes.ts`, `validate-form-nodes.ts`),
  **salvo temporalmente** durante los pasos intermedios de este plan, mientras el símbolo que necesita todavía no se
  ha extraído a su módulo definitivo — y esa importación temporal debe corregirse en la misma tarea que extrae dicho
  símbolo (ver Fase 1).
- El único fichero externo que importa de los dos barrels (`validate-runtime-config.ts`) no cambia su import en
  ninguna tarea de este plan; se verifica con `grep` en la Task 29.
- `src/config/validate-actions-visibility.ts`, `src/config/layout-placement-rules.ts`,
  `src/config/validation-breadcrumb.ts` y `src/runtime/runtime-references/runtime-reference-parser.ts` no se tocan.
- Ninguna tarea reorganiza ningún fichero de `src/tests/config-validation/`: son la cobertura de regresión completa de
  esta feature.

---

## Task 1 — Helpers compartidos de path/record (layout + form)

- **ID**: 0115-T1
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-node-shared-helpers.ts` con, copia literal desde `validate-layout-nodes.ts`
  (idéntico byte a byte en `validate-form-nodes.ts`): `isRecord`, `isNonEmptyString`, `formatPathSegment`,
  `isValidCollectionItemPath`, `isValidCollectionProjectionPath`, `isValidCollectionPathSegment` (privada), const
  `collectionPathSegmentPattern` (privada). Importa `hasRuntimeTemplateDelimiter` de
  `'../runtime/runtime-references/runtime-reference-parser'`. Ninguna de las 6 funciones se exporta como parte del
  API público de ningún barrel (eran privadas en ambos ficheros originales). Modificar `validate-layout-nodes.ts` y
  `validate-form-nodes.ts`: eliminar sus 6 implementaciones locales + su `collectionPathSegmentPattern` local, y
  añadir `import { isRecord, isNonEmptyString, formatPathSegment, isValidCollectionItemPath,
  isValidCollectionProjectionPath, isValidCollectionPathSegment } from './validate-node-shared-helpers'` en ambos.
- **Fuera de alcance**: `isTableCellPrimitive` (solo se usa en layout/table, no está duplicada, se queda en su módulo
  de destino en Task 9) e `isValidRepeaterItemKeyPath` (solo repeater, Task 6) e `isValidCollectionSourceReference`/
  `isValidQueryCollectionSource` (solo usadas por `validateCollectionSource`, Task 2).
- **Dependencias**: ninguna. Primera tarea del plan.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-node-shared-helpers.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-form-nodes.ts` (eliminar implementaciones locales, añadir el import).
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno (nuevo ni ampliación); cubierto por: la suite completa de
    `src/tests/config-validation/*.test.ts`, ya que cualquier caso de rechazo estructural en cualquier dominio
    ejercita indirectamente estos helpers. Ejecutar como mínimo durante la implementación:
    `runtime-config-validation-containers.test.ts`, `runtime-config-validation-collections.test.ts`,
    `runtime-config-validation-forms-validations.test.ts`.
  - **Comportamiento cubierto**:
    - Cualquier rechazo que dependía de `isRecord`/`isNonEmptyString` (tipos no-objeto, strings vacíos) sigue
      comportándose igual en ambos dominios.
    - Rutas de colección (`isValidCollectionItemPath`, `isValidCollectionProjectionPath`,
      `isValidCollectionPathSegment`) siguen aceptando/rechazando exactamente los mismos valores en `repeater`,
      `list`, `select`/`radioGroup`/`checkboxGroup` y `table` dinámico.
    - `formatPathSegment` sigue formateando índices numéricos como `[n]` y claves como `.clave` en los mensajes de
      error de `tabs`, `button`, `link` y los mapeadores de issue.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-containers.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-collections.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-validations.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente; no dejar ninguna de las 6 funciones duplicada en
    ninguno de los dos ficheros originales tras esta tarea.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: `validate-node-shared-helpers.ts` existe con las 6 funciones + la constante; ninguno de
    los dos ficheros originales contiene ya estas implementaciones; los comandos de test listados pasan.

---

## Task 2 — Módulo base compartido: origen de colección

- **ID**: 0115-T2
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-collection-source.ts` moviendo, copia literal, desde
  `validate-form-nodes.ts`: `validateCollectionSource` (pública), `isValidCollectionSourceReference`,
  `isValidQueryCollectionSource` (privadas). El módulo importa `isNonEmptyString`, `isValidCollectionPathSegment` de
  `'./validate-node-shared-helpers'`, `parseRuntimeReference` de `'../runtime/runtime-references/runtime-reference-parser'`
  e `invalidLayout` de `'./runtime-config-validation-errors'`. Modificar `validate-form-nodes.ts`: eliminar la
  implementación local, añadir `import { validateCollectionSource } from './validate-collection-source'` (uso interno
  por `validateSelectItemsContract`, todavía en el mismo fichero hasta Task 23) y `export { validateCollectionSource }`
  (recompuesto desde el import, para no romper el requisito funcional 2). Modificar `validate-layout-nodes.ts`: su
  bloque de import cruzado hacia `'./validate-form-nodes'` pierde `validateCollectionSource` de la lista; se añade en
  su lugar `import { validateCollectionSource } from './validate-collection-source'` (uso interno por
  `validateRepeaterNode`, `validateListItems`, `validateTableDynamicRows`, todos aún en el mismo fichero hasta las
  Tasks 6, 7 y 9 respectivamente). Esto reduce el cruce layout→form de 9 a 8 símbolos desde esta tarea en adelante.
- **Fuera de alcance**: cualquier otro símbolo de `validate-form-nodes.ts`.
- **Dependencias**: Task 1 (`validate-node-shared-helpers.ts` debe existir).
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-collection-source.ts`; modificar `src/config/validate-form-nodes.ts` y
    `src/config/validate-layout-nodes.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-collections.test.ts` (contrato completo de
    `validateCollectionSource`), `runtime-config-validation-repeater.test.ts` (`props.items.source`),
    `runtime-config-validation-image-table.test.ts` (rows dinámicas de `table`), `runtime-config-validation-form-fields.test.ts`
    (`items.source` de `select`/`radioGroup`/`checkboxGroup`).
  - **Comportamiento cubierto**:
    - `validateCollectionSource` sigue aceptando `queries.{q}.data`, `queries.{q}.data.*` e `item.*` (cuando
      `allowItemReference: true`) y rechazando el resto, con el mismo mensaje `invalid-layout`.
    - El mismo comportamiento se preserva para los 4 consumidores actuales (`repeater`, `list`, `select`/`radioGroup`/
      `checkboxGroup`, `table` dinámico) sin cambiar cuál de ellos pasa `allowItemReference`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-collections.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-repeater.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-image-table.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente; verificar que `validate-layout-nodes.ts` ya no importa
    `validateCollectionSource` de `'./validate-form-nodes'`.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: `validate-collection-source.ts` existe con los 3 símbolos; ambos ficheros originales
    importan desde él; los comandos de test listados pasan.

---

## Task 3 — Módulo de mapeo de issues de layout

- **ID**: 0115-T3
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-layout-issue-mapping.ts` moviendo, copia literal, desde
  `validate-layout-nodes.ts`: `mapLeafNodeIssue`, `mapLayoutNodeIssue` (ambas públicas hoy). El módulo importa
  `formatPathSegment` de `'./validate-node-shared-helpers'` y `enrichedInvalidLayout` de `'./validation-breadcrumb'`.
  Modificar `validate-layout-nodes.ts`: eliminar ambas implementaciones, añadir
  `export { mapLeafNodeIssue, mapLayoutNodeIssue } from './validate-layout-issue-mapping'`, y un `import` normal de
  las mismas para uso interno de las funciones que aún no se han extraído (todos los validadores de nodo de layout
  que las llaman siguen en este fichero hasta sus propias tareas). Modificar `validate-form-nodes.ts`: su bloque de
  import cruzado hacia `'./validate-layout-nodes'` pierde `mapLeafNodeIssue`/`mapLayoutNodeIssue`; se añade
  `import { mapLeafNodeIssue, mapLayoutNodeIssue } from './validate-layout-issue-mapping'`. Esto reduce el cruce
  form→layout de 5 a 3 símbolos reales (`validateLayoutCollection`, `validateQueryStateFeedback` quedan pendientes de
  la Task 4; `validateVisibility` se resuelve también en esta tarea, ver siguiente punto).
- Adicionalmente en esta misma tarea: modificar `validate-form-nodes.ts` para que `validateVisibility` deje de
  importarse de `'./validate-layout-nodes'` y pase a importarse directamente de `'./validate-actions-visibility'` (su
  fuente real; hoy `validate-layout-nodes.ts` solo la reexporta con `export { validateVisibility }` sin
  implementarla). El barrel de layout sigue reexportando `validateVisibility` sin cambios de comportamiento. Con esto
  el cruce form→layout queda en 2 símbolos reales (`validateLayoutCollection`, `validateQueryStateFeedback`),
  pendientes de la Task 4.
- **Fuera de alcance**: `validateLayoutCollection`, `validateLayoutNode`, `validateQueryStateFeedback` (Task 4).
- **Dependencias**: Task 1.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-layout-issue-mapping.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-form-nodes.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `validation-breadcrumb.test.ts`, `runtime-config-validation-containers.test.ts`,
    `runtime-config-validation-image-table.test.ts` (ejercitan mensajes `invalid-layout` enriquecidos sobre nodos hoja
    y de layout).
  - **Comportamiento cubierto**:
    - `mapLeafNodeIssue`/`mapLayoutNodeIssue` siguen produciendo exactamente los mismos mensajes/rutas para issues de
      `layout.span`, `id`, `props` y el resto de segmentos ya cubiertos.
    - `validateVisibility` sigue siendo importable desde `'./validate-layout-nodes'` (vía el barrel) con el mismo
      comportamiento, ahora sourced directamente desde `validate-actions-visibility`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/validation-breadcrumb.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-containers.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-image-table.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: `validate-layout-issue-mapping.ts` existe con las 2 funciones; `validate-form-nodes.ts`
    ya no importa nada de `'./validate-layout-nodes'` salvo `validateLayoutCollection`/`validateQueryStateFeedback`;
    los comandos de test listados pasan.

---

## Task 4 — Módulo hub: dispatcher + colección + queryStateFeedback

- **ID**: 0115-T4
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-layout-nodes-core.ts` moviendo, copia literal, desde
  `validate-layout-nodes.ts`: `validateLayoutCollection`, `validateLayoutNode` (el switch completo, con sus 23
  `case`), `validateQueryStateFeedback` (las 3 públicas). El switch de `validateLayoutNode` importa, temporalmente,
  las 17 funciones de nodo de layout (`validateContainerNode`, `validateRepeaterNode`, `validateHeadingNode`,
  `validateParagraphNode`, `validateListNode`, `validateImageNode`, `validateTableNode`, `validateButtonNode`,
  `validateLinkNode`, `validateModalNode`, `validateTabsNode`, `validateAccordionNode`, `validateBadgeNode`,
  `validateAlertNode`, `validateStatNode`, `validateDividerNode`, `validateSkeletonNode`, `validateFileInputNode`,
  `validateFileManagerNode`) de `'./validate-layout-nodes'` (siguen ahí hasta sus tareas respectivas) y las 8
  funciones de form (`validateFormNode`, `validateInputNode`, `validateTextareaNode`, `validateSelectNode`,
  `validateRadioGroupNode`, `validateCheckboxGroupNode`, `validateToggleNode`, `validateHiddenNode`) de
  `'./validate-form-nodes'` (siguen ahí hasta las Tasks 26-28). Importa `isRecord` de
  `'./validate-node-shared-helpers'`. Modificar `validate-layout-nodes.ts`: eliminar las 3 implementaciones movidas,
  añadir `export { validateLayoutCollection, validateLayoutNode, validateQueryStateFeedback } from
  './validate-layout-nodes-core'`, y un `import` normal de `validateLayoutCollection`/`validateQueryStateFeedback`
  para uso interno de los validadores de nodo que aún no se han extraído (container, repeater, list, modal, tabs,
  link, accordion, table — todos siguen en este fichero y llaman a estas dos funciones). Modificar
  `validate-form-nodes.ts`: su import de `validateLayoutCollection`/`validateQueryStateFeedback` pasa de
  `'./validate-layout-nodes'` a `'./validate-layout-nodes-core'` directamente (cruce form→layout ya resuelto de forma
  definitiva, sin más cambios pendientes en tareas posteriores).
- **Fuera de alcance**: mover cualquier validador de nodo concreto (Tasks 5-21, 26-28); estos siguen donde están hasta
  su propia tarea, y esta tarea únicamente los referencia por import temporal.
- **Dependencias**: Tasks 1 y 3.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-layout-nodes-core.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-form-nodes.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: la suite completa de `src/tests/config-validation/*.test.ts` (el
    dispatcher y `queryStateFeedback` se ejercitan desde cualquier test de cualquier nodo). Ejecutar como mínimo
    durante la implementación: `runtime-config-validation-qsf.test.ts`, `runtime-config-validation-visibility.test.ts`,
    `runtime-config-root-zod.test.ts`, `runtime-config-validation-navigate-params.test.ts`.
  - **Comportamiento cubierto**:
    - El dispatch por `type` sigue resolviendo exactamente el mismo validador para cada uno de los 23 tipos de nodo
      soportados, y sigue rechazando con `unsupported-node-type` cualquier tipo no reconocido.
    - `validateLayoutCollection` sigue delegando en `validateLayoutNode` por elemento, preservando el breadcrumb.
    - `validateQueryStateFeedback` sigue validando recursivamente `states.{estado}.fallback` como una colección de
      layout completa, sin cambiar la normalización de estados sin `fallback`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-qsf.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-root-zod.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-navigate-params.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente; no reordenar los `case` del switch.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: `validate-layout-nodes-core.ts` existe con las 3 funciones; ambos barrels reexportan/
    importan correctamente; los comandos de test listados pasan.

---

## Task 5 — Módulo container

- **ID**: 0115-T5
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-container-node.ts` moviendo, copia literal, `validateContainerNode` (hoy
  privada, sigue privada — no forma parte del API público de ningún barrel). Importa `validateLayoutCollection`,
  `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`; `mapLayoutNodeIssue` de
  `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateVisibility` de
  `'./validate-actions-visibility'`; `containerNodeSchema` de `'./runtime-config-zod'`; `enrichedInvalidLayout`,
  `enrichErrorResult` de `'./validation-breadcrumb'`. Modificar `validate-layout-nodes.ts`: eliminar la implementación.
  No añadir ningún import de `validateContainerNode` en este fichero: el switch que lo consumía ya vive en el hub
  desde Task 4, así que `validate-layout-nodes.ts` no necesita referenciarlo (mismo patrón que Tasks 8, 10, 12, 14-21).
  Verificar que no queda ningún residuo de import sin usar. Modificar `validate-layout-nodes-core.ts`: cambiar su
  import temporal de `validateContainerNode` desde `'./validate-layout-nodes'` a `'./validate-container-node'`.
- **Fuera de alcance**: cualquier otro validador de nodo.
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-container-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-containers.test.ts` (~959 líneas).
  - **Comportamiento cubierto**:
    - `container` sigue aceptando/rechazando `direction`/`gap`/`columns`/`variant`/`align`/`justify`/`wrap` con los
      mismos mensajes de ruta.
    - La restricción cruzada `columns` + `wrap` mutuamente excluyentes sigue rechazando con el mismo mensaje.
    - `children` sigue validándose recursivamente vía `validateLayoutCollection`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-containers.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: `validate-container-node.ts` existe; `validate-layout-nodes-core.ts` importa de él; el
    test de regresión pasa.

---

## Task 6 — Módulo repeater

- **ID**: 0115-T6
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-repeater-node.ts` moviendo, copia literal: `validateRepeaterNode` (privada),
  `mapCollectionPaginationIssue` (pública hoy), `isValidRepeaterItemKeyPath` (privada). Importa
  `validateLayoutCollection`, `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`; `mapLayoutNodeIssue`
  de `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateVisibility` de
  `'./validate-actions-visibility'`; `validateCollectionSource` de `'./validate-collection-source'`;
  `isValidCollectionItemPath` de `'./validate-node-shared-helpers'`; `repeaterNodeSchema` de `'./runtime-config-zod'`.
  Modificar `validate-layout-nodes.ts`: eliminar las 3 implementaciones, añadir
  `export { mapCollectionPaginationIssue } from './validate-repeater-node'` (única de las 3 que es pública).
  Modificar `validate-layout-nodes-core.ts`: cambiar su import temporal de `validateRepeaterNode` a
  `'./validate-repeater-node'`.
- **Fuera de alcance**: `validateTableNode` y su uso de `mapCollectionPaginationIssue` (Task 9, que importará de este
  módulo).
- **Dependencias**: Tasks 1, 2, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-repeater-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-repeater.test.ts` (~560 líneas).
  - **Comportamiento cubierto**:
    - `repeater` sigue validando `props.items.source` vía `validateCollectionSource`, `props.items.key` (incluido
      `$key`/`$index` y el rechazo de prefijos `item`/`queries`/`forms`/`params`/`navigation`/`routeParams`) y
      `props.template` recursivamente.
    - `props.pagination` sigue produciendo los mismos mensajes de `mapCollectionPaginationIssue` para `controls`,
      `enabled`, `pageSize` y claves desconocidas.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-repeater.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: `validate-repeater-node.ts` existe con los 3 símbolos; el barrel reexporta
    `mapCollectionPaginationIssue`; el hub importa de este módulo; el test de regresión pasa.

---

## Task 7 — Módulo heading/paragraph/list

- **ID**: 0115-T7
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-heading-paragraph-list-nodes.ts` moviendo, copia literal:
  `validateHeadingNode`, `validateParagraphNode`, `validateListNode`, `validateListItems` (todas privadas). Importa
  `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`; `mapLeafNodeIssue` de
  `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateVisibility` de
  `'./validate-actions-visibility'`; `validateCollectionSource` de `'./validate-collection-source'`;
  `isRecord`, `isValidCollectionProjectionPath` de `'./validate-node-shared-helpers'`; `headingNodeSchema`,
  `paragraphNodeSchema`, `listNodeSchema` de `'./runtime-config-zod'`. Modificar `validate-layout-nodes.ts`: eliminar
  las 4 implementaciones (ninguna es pública, no requiere línea de reexport). Modificar
  `validate-layout-nodes-core.ts`: cambiar los imports temporales de `validateHeadingNode`, `validateParagraphNode`,
  `validateListNode` a `'./validate-heading-paragraph-list-nodes'`.
- **Fuera de alcance**: `image` y `table` (tareas propias, aunque también sean "contenido").
- **Dependencias**: Tasks 1, 2, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-heading-paragraph-list-nodes.ts`; modificar
    `src/config/validate-layout-nodes.ts` y `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-containers.test.ts` (casos de `heading`/
    `paragraph`/`list` como hijos), `runtime-config-validation-collections.test.ts` (`list.props.items` fuente/valores).
  - **Comportamiento cubierto**:
    - `heading`/`paragraph` siguen validando su shape con el mismo mapeo de issue vía `mapLeafNodeIssue`.
    - `list.props.items` sigue aceptando array de strings, `{ source, itemType/itemText }` e `{ values, itemText? }`
      con las mismas reglas de exclusión mutua y el mismo mensaje cuando faltan mapeos.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-containers.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-collections.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe con las 4 funciones; el hub importa de él; los tests listados pasan.

---

## Task 8 — Módulo image

- **ID**: 0115-T8
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-image-node.ts` moviendo, copia literal, `validateImageNode` (privada).
  Importa `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`; `mapLeafNodeIssue` de
  `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateVisibility` de
  `'./validate-actions-visibility'`; `imageNodeSchema` de `'./runtime-config-zod'`. Modificar
  `validate-layout-nodes.ts`: eliminar la implementación. Modificar `validate-layout-nodes-core.ts`: cambiar el
  import temporal a `'./validate-image-node'`.
- **Fuera de alcance**: cualquier otro validador.
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-image-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-image-table.test.ts`,
    `runtime-config-validation-image-fetch.test.ts`.
  - **Comportamiento cubierto**:
    - `image` sigue exigiendo exactamente uno de `props.src`/`props.fetch`, rechazando ambos o ninguno con el mismo
      mensaje, y normalizando el nodo resultante según el modo (`src` vs `fetch`).
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-image-table.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-image-fetch.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe; el hub importa de él; los tests listados pasan.

---

## Task 9 — Módulo table (depende de Task 6)

- **ID**: 0115-T9
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-table-node.ts` moviendo, copia literal: `validateTableNode`,
  `mapTableColumnsIssue`, `validateTableHeaders`, `validateTableColumns`, `validateTableRows`,
  `validateTableManualRows`, `validateTableDynamicRows`, `validateTableCellNode` (pública hoy),
  `checkContainerChildrenSubset`, `isTableCellPrimitive` (resto privadas). Importa `validateLayoutNode`,
  `validateQueryStateFeedback` de `'./validate-layout-nodes-core'` (`validateLayoutNode` para la delegación de
  `validateTableCellNode`); `mapLeafNodeIssue` de `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`,
  `mapVisibilityIssue`, `validateVisibility` de `'./validate-actions-visibility'`; `mapCollectionPaginationIssue` de
  `'./validate-repeater-node'` (unidireccional, igual que el patrón tabla→paginación de 0114); `validateCollectionSource`
  de `'./validate-collection-source'`; `isRecord`, `isNonEmptyString` de `'./validate-node-shared-helpers'`;
  `tableNodeSchema`, `tableCellAllowedNodeTypes` de `'./runtime-config-zod'`. Modificar `validate-layout-nodes.ts`:
  eliminar las 10 implementaciones, añadir `export { validateTableCellNode } from './validate-table-node'` (única
  pública). Modificar `validate-layout-nodes-core.ts`: cambiar el import temporal de `validateTableNode` a
  `'./validate-table-node'`.
- **Fuera de alcance**: el propio `validate-repeater-node.ts` (ya creado en Task 6, este módulo solo lo consume).
- **Dependencias**: Tasks 1, 2, 3, 4, 6.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-table-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-image-table.test.ts` (~635 líneas).
  - **Comportamiento cubierto**:
    - `headers`/`rows`/`columns` siguen validándose con las mismas reglas (unicidad de `column.id`, correspondencia
      con `headers`, `filterable`/`sortable` obligatorio, `filterPlaceholder` requiere `filterable`).
    - Filas manuales siguen exigiendo el número exacto de celdas por `headers.length`; filas dinámicas siguen
      exigiendo `{ source, cells }` sin `values`.
    - `validateTableCellNode` sigue delegando en el dispatcher completo (`validateLayoutNode`) tras comprobar el
      subconjunto de tipos permitidos en celda, incluida la recursión en `container` anidados.
    - `mapCollectionPaginationIssue` sigue produciendo los mismos mensajes para `props.pagination` de `table`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-image-table.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente; no duplicar `mapCollectionPaginationIssue`, importarla
    de `validate-repeater-node.ts`.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe con los 10 símbolos; el barrel reexporta `validateTableCellNode`; el
    hub importa de él; el test de regresión pasa.

---

## Task 10 — Módulo button

- **ID**: 0115-T10
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-button-node.ts` moviendo, copia literal, `validateButtonNode` (privada).
  Importa `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`; `mapLayoutNodeIssue` de
  `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateVisibility`,
  `validateRuntimeUiAction` de `'./validate-actions-visibility'`; `formatPathSegment` de
  `'./validate-node-shared-helpers'`; `buttonNodeSchema` de `'./runtime-config-zod'`. Modificar
  `validate-layout-nodes.ts`: eliminar la implementación. Modificar `validate-layout-nodes-core.ts`: cambiar el
  import temporal a `'./validate-button-node'`.
- **Fuera de alcance**: `link` (Task 11, distinto módulo aunque comparta familia "nodos interactivos").
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-button-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-buttons.test.ts` (~700 líneas),
    `runtime-config-validation-button-styles.test.ts`.
  - **Comportamiento cubierto**:
    - `button` sigue validando `props.action` (`navigateTo`/`goBack`/`executeOperation`/`resetForm`/`openModal`/
      `closeModal`) vía `validateRuntimeUiAction`, y `props.color`/`variant`/`fullWidth`/`iconPosition` con los
      mismos mensajes de ruta.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-button-styles.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe; el hub importa de él; los tests listados pasan.

---

## Task 11 — Módulo link

- **ID**: 0115-T11
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-link-node.ts` moviendo, copia literal: `validateLinkNode` (pública hoy),
  `checkLinkChildrenAllowedTypes` (privada). Importa `validateLayoutCollection`, `validateQueryStateFeedback` de
  `'./validate-layout-nodes-core'`; `mapLayoutNodeIssue` de `'./validate-layout-issue-mapping'`;
  `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateVisibility`, `validateRuntimeUiAction` de
  `'./validate-actions-visibility'`; `isRecord`, `formatPathSegment` de `'./validate-node-shared-helpers'`;
  `LINK_ALLOWED_CHILD_TYPES` de `'./layout-placement-rules'`; `linkNodeSchema` de `'./runtime-config-zod'`. Modificar
  `validate-layout-nodes.ts`: eliminar ambas implementaciones, añadir `export { validateLinkNode } from
  './validate-link-node'`. Modificar `validate-layout-nodes-core.ts`: cambiar el import temporal de `validateLinkNode`
  a `'./validate-link-node'`.
- **Fuera de alcance**: `button`.
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-link-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-buttons.test.ts` (incluye la validación
    estructural y cruzada de `link`).
  - **Comportamiento cubierto**:
    - `link` sigue exigiendo exactamente uno de `props.label`/`children` y exactamente uno de `props.href`/
      `props.action`, con los mismos mensajes de exclusión mutua.
    - `children` de `link` siguen restringidos al subconjunto permitido (`container`, `heading`, `paragraph`, `list`,
      `image`, `badge`, `alert`, `stat`, `divider`, `skeleton`), incluida la recursión dentro de `container` anidados.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe con las 2 funciones; el barrel reexporta `validateLinkNode`; el hub
    importa de él; el test listado pasa.

---

## Task 12 — Módulo modal

- **ID**: 0115-T12
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-modal-node.ts` moviendo, copia literal, `validateModalNode` (privada).
  Importa `validateLayoutCollection`, `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`;
  `mapLayoutNodeIssue` de `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`,
  `validateVisibility` de `'./validate-actions-visibility'`; `MODAL_ALLOWED_CHILD_TYPES` de
  `'./layout-placement-rules'`; `modalNodeSchema` de `'./runtime-config-zod'`. Modificar `validate-layout-nodes.ts`:
  eliminar la implementación. Modificar `validate-layout-nodes-core.ts`: cambiar el import temporal a
  `'./validate-modal-node'`.
- **Fuera de alcance**: cualquier otro validador.
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-modal-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-modal.test.ts` (~700 líneas).
  - **Comportamiento cubierto**:
    - `modal` sigue restringiendo sus `children` al subconjunto permitido (`container`, `form`, `heading`,
      `paragraph`, `list`, `image`, `table`, `button`, `repeater`, `accordion`, `fileManager`) con el mismo mensaje.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-modal.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe; el hub importa de él; el test listado pasa.

---

## Task 13 — Módulo tabs

- **ID**: 0115-T13
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-tabs-node.ts` moviendo, copia literal, `validateTabsNode` (privada).
  Importa `validateLayoutCollection`, `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`;
  `validateVisibility` directamente de `'./validate-actions-visibility'` (no a través del hub, igual que en el resto
  de módulos de nodo de layout, para minimizar la dependencia del hub más allá de lo estrictamente necesario);
  `mapLayoutNodeIssue` de `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue` de
  `'./validate-actions-visibility'`; `formatPathSegment`, `isRecord` de `'./validate-node-shared-helpers'`;
  `tabsNodeSchema` de `'./runtime-config-zod'`. Modificar `validate-layout-nodes.ts`: eliminar la implementación.
  Modificar `validate-layout-nodes-core.ts`: cambiar el import temporal a `'./validate-tabs-node'`.
- **Fuera de alcance**: cualquier otro validador.
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-tabs-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-tabs.test.ts`,
    `runtime-config-validation-forms-tabs.test.ts`.
  - **Comportamiento cubierto**:
    - `tabs` sigue exigiendo `props.items` no vacío, cada item con `label` string, `props.orientation` restringido a
      `horizontal`/`vertical`, y `children` de cada item validados recursivamente con la misma ruta
      `props.items[N].children`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-tabs.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-tabs.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe; el hub importa de él; los tests listados pasan.

---

## Task 14 — Módulo accordion

- **ID**: 0115-T14
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-accordion-node.ts` moviendo, copia literal, `validateAccordionNode`
  (privada). Importa `validateLayoutCollection`, `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`;
  `mapLayoutNodeIssue` de `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`,
  `validateVisibility` de `'./validate-actions-visibility'`; `accordionNodeSchema` de `'./runtime-config-zod'`.
  Modificar `validate-layout-nodes.ts`: eliminar la implementación. Modificar `validate-layout-nodes-core.ts`:
  cambiar el import temporal a `'./validate-accordion-node'`.
- **Fuera de alcance**: cualquier otro validador.
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-accordion-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-accordion.test.ts`.
  - **Comportamiento cubierto**:
    - `accordion` sigue validando `props.label`/`defaultOpen`/`groupId` con los mismos mensajes de ruta.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-accordion.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe; el hub importa de él; el test listado pasa.

---

## Task 15 — Módulo badge

- **ID**: 0115-T15
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-badge-node.ts` moviendo, copia literal, `validateBadgeNode` (privada).
  Importa `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`; `mapLeafNodeIssue`, `mapLayoutNodeIssue`
  de `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateVisibility` de
  `'./validate-actions-visibility'`; `badgeNodeSchema` de `'./runtime-config-zod'`. Modificar
  `validate-layout-nodes.ts`: eliminar la implementación. Modificar `validate-layout-nodes-core.ts`: cambiar el
  import temporal a `'./validate-badge-node'`.
- **Fuera de alcance**: cualquier otro validador.
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-badge-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-badge.test.ts`.
  - **Comportamiento cubierto**:
    - `badge` sigue validando `props.label`/`variant`/`color` con los mismos mensajes de ruta.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-badge.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe; el hub importa de él; el test listado pasa.

---

## Task 16 — Módulo alert

- **ID**: 0115-T16
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-alert-node.ts` moviendo, copia literal, `validateAlertNode` (privada).
  Importa `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`; `mapLeafNodeIssue`, `mapLayoutNodeIssue`
  de `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateVisibility` de
  `'./validate-actions-visibility'`; `alertNodeSchema` de `'./runtime-config-zod'`. Modificar
  `validate-layout-nodes.ts`: eliminar la implementación. Modificar `validate-layout-nodes-core.ts`: cambiar el
  import temporal a `'./validate-alert-node'`.
- **Fuera de alcance**: cualquier otro validador.
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-alert-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-alert.test.ts`.
  - **Comportamiento cubierto**:
    - `alert` sigue validando `props.message`/`type`/`title` con los mismos mensajes de ruta.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-alert.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe; el hub importa de él; el test listado pasa.

---

## Task 17 — Módulo stat

- **ID**: 0115-T17
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-stat-node.ts` moviendo, copia literal, `validateStatNode` (privada).
  Importa `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`; `mapLeafNodeIssue`, `mapLayoutNodeIssue`
  de `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateVisibility` de
  `'./validate-actions-visibility'`; `statNodeSchema` de `'./runtime-config-zod'`. Modificar
  `validate-layout-nodes.ts`: eliminar la implementación. Modificar `validate-layout-nodes-core.ts`: cambiar el
  import temporal a `'./validate-stat-node'`.
- **Fuera de alcance**: cualquier otro validador.
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-stat-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-stat.test.ts`.
  - **Comportamiento cubierto**:
    - `stat` sigue validando `props.label`/`value`/`variant`/`color` con los mismos mensajes de ruta.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-stat.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe; el hub importa de él; el test listado pasa.

---

## Task 18 — Módulo divider

- **ID**: 0115-T18
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-divider-node.ts` moviendo, copia literal, `validateDividerNode` (privada).
  Importa `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`; `mapLeafNodeIssue`, `mapLayoutNodeIssue`
  de `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateVisibility` de
  `'./validate-actions-visibility'`; `dividerNodeSchema` de `'./runtime-config-zod'`. Modificar
  `validate-layout-nodes.ts`: eliminar la implementación. Modificar `validate-layout-nodes-core.ts`: cambiar el
  import temporal a `'./validate-divider-node'`.
- **Fuera de alcance**: cualquier otro validador.
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-divider-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-divider.test.ts`.
  - **Comportamiento cubierto**:
    - `divider` sigue validando `props.variant` (`solid`/`dashed`/`dotted`/`invisible`) con el mismo mensaje de ruta.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-divider.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe; el hub importa de él; el test listado pasa.

---

## Task 19 — Módulo skeleton

- **ID**: 0115-T19
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-skeleton-node.ts` moviendo, copia literal, `validateSkeletonNode`
  (privada). Importa `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`; `mapLeafNodeIssue`,
  `mapLayoutNodeIssue` de `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`,
  `validateVisibility` de `'./validate-actions-visibility'`; `skeletonNodeSchema` de `'./runtime-config-zod'`.
  Modificar `validate-layout-nodes.ts`: eliminar la implementación. Modificar `validate-layout-nodes-core.ts`:
  cambiar el import temporal a `'./validate-skeleton-node'`.
- **Fuera de alcance**: cualquier otro validador.
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-skeleton-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-skeleton.test.ts`.
  - **Comportamiento cubierto**:
    - `skeleton` sigue validando `props.variant`/`lines`/`width`/`height`/`rounded`/`animate` con los mismos mensajes.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-skeleton.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe; el hub importa de él; el test listado pasa.

---

## Task 20 — Módulo fileInput (nodo de layout, primera pasada)

- **ID**: 0115-T20
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-file-input-node.ts` (singular; **no confundir con el fichero existente
  `validate-file-input-nodes.ts`**, plural, que cubre la semántica de segunda pasada y no se toca en esta feature)
  moviendo, copia literal, `validateFileInputNode` (privada). Importa `validateQueryStateFeedback` de
  `'./validate-layout-nodes-core'`; `mapLayoutNodeIssue` de `'./validate-layout-issue-mapping'`;
  `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateVisibility` de `'./validate-actions-visibility'`;
  `fileInputNodeSchema` de `'./runtime-config-zod'`. Modificar `validate-layout-nodes.ts`: eliminar la
  implementación. Modificar `validate-layout-nodes-core.ts`: cambiar el import temporal a
  `'./validate-file-input-node'`.
- **Fuera de alcance**: `validate-file-input-nodes.ts` (existente, semántica de segunda pasada, no tocado).
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-file-input-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-file-input.test.ts`.
  - **Comportamiento cubierto**:
    - `fileInput` sigue validando `props.fieldId`/`label`/`tooltip`/`multiple`/`capture`/`validations` con los mismos
      mensajes de ruta.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-file-input.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente; verificar que el nombre del fichero no colisiona con
    `validate-file-input-nodes.ts`.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe; el hub importa de él; el test listado pasa.

---

## Task 21 — Módulo fileManager (nodo de layout, primera pasada)

- **ID**: 0115-T21
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-file-manager-node.ts` (singular; **no confundir con el fichero existente
  `validate-file-manager-nodes.ts`**, plural, semántica de segunda pasada, no tocado) moviendo, copia literal,
  `validateFileManagerNode` (privada). Importa `validateQueryStateFeedback` de `'./validate-layout-nodes-core'`;
  `mapLeafNodeIssue`, `mapLayoutNodeIssue` de `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`,
  `mapVisibilityIssue`, `validateVisibility` de `'./validate-actions-visibility'`; `fileManagerNodeSchema` de
  `'./runtime-config-zod'`. Modificar `validate-layout-nodes.ts`: eliminar la implementación. Modificar
  `validate-layout-nodes-core.ts`: cambiar el import temporal a `'./validate-file-manager-node'`.
- **Fuera de alcance**: `validate-file-manager-nodes.ts` (existente, no tocado).
- **Dependencias**: Tasks 1, 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-file-manager-node.ts`; modificar `src/config/validate-layout-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-file-manager.test.ts`.
  - **Comportamiento cubierto**:
    - `fileManager` sigue validando sus operaciones, `pagination`, `validations` y `labels` con los mismos mensajes
      de ruta, incluido el shape especial de `labels.{clave}`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-file-manager.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente; verificar que el nombre del fichero no colisiona con
    `validate-file-manager-nodes.ts`.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe; el hub importa de él; el test listado pasa. **Con esta tarea quedan
    cerradas todas las Fases 1 y 2: `validate-layout-nodes.ts` ya no contiene ninguna implementación de validador de
    nodo, solo lo que quede pendiente de reexportar.**

---

## Task 22 — Módulo de reglas de validación de campo de formulario

- **ID**: 0115-T22
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-form-field-validations.ts` moviendo, copia literal:
  `validateFormFieldValidations` (pública), `validateRequiredRule`, `validateNumericRule`, `validatePatternRule`,
  `validateBooleanFlagRule`, `validateValidationCompatibility`, `validateValidationRanges`,
  `supportsTextLengthValidations`, `supportsSelectionCardinalityValidations`, `supportsTextualValidations` (privadas),
  const `supportedFormValidationRuleNames`, type `FormFieldValidationTarget`. Importa `isRecord` de
  `'./validate-node-shared-helpers'`; `validateWhenCondition` de `'./validate-actions-visibility'`. Modificar
  `validate-form-nodes.ts`: eliminar las 10 implementaciones + la constante + el tipo, añadir
  `export { validateFormFieldValidations } from './validate-form-field-validations'` y un `import` normal de
  `validateFormFieldValidations` para uso interno de los validadores de campo que aún no se han extraído
  (`validateInputNode`, etc., siguen en este fichero hasta Task 26).
- **Fuera de alcance**: `validateSelectItemsContract`, `validateChoiceFieldDefaultValue` (Task 23).
- **Dependencias**: Task 1.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-form-field-validations.ts`; modificar `src/config/validate-form-nodes.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-forms-validations.test.ts` (~580 líneas).
  - **Comportamiento cubierto**:
    - `required`, `minLength`/`maxLength`, `min`/`max`, `minSelections`/`maxSelections`, `pattern`, `email`/`url`
      siguen aceptando forma corta (`true`/número/string) y forma larga (`{ value, message?, when? }`) con el mismo
      comportamiento de compatibilidad por tipo de campo.
    - Rangos contradictorios (`minLength > maxLength`, `min > max`, `minSelections > maxSelections`) siguen
      rechazándose con el mismo mensaje.
    - `when` sigue aceptando `allowItem: true` para condiciones referenciando `item.*`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-validations.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente; preservar el orden de entrada iterado en
    `Object.entries(rawValidations)` (afecta a qué regla se reporta primero en caso de error).
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe con los 10 símbolos + const + tipo; el barrel reexporta
    `validateFormFieldValidations`; el test listado pasa.

---

## Task 23 — Módulo de contrato de items de elección

- **ID**: 0115-T23
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-form-choice-items.ts` moviendo, copia literal:
  `validateSelectItemsContract` (pública), `validateChoiceFieldDefaultValue` (pública), `validateMultipleChoiceDefaultValue`,
  `validateSelectScalarValues` (privadas). Importa `validateCollectionSource` de `'./validate-collection-source'`;
  `isValidCollectionProjectionPath` de `'./validate-node-shared-helpers'`; `isTokensReference` de
  `'./runtime-reference-namespace-guards'`; `parseRuntimeReference` de
  `'../runtime/runtime-references/runtime-reference-parser'`; `selectItemsSchema` de `'./runtime-config-zod'`.
  Modificar `validate-form-nodes.ts`: eliminar las 4 implementaciones, añadir
  `export { validateSelectItemsContract, validateChoiceFieldDefaultValue } from './validate-form-choice-items'` y un
  `import` normal de ambas para uso interno de `validateSelectNode`/`validateRadioGroupNode`/`validateCheckboxGroupNode`
  (aún en este fichero hasta Task 26).
- **Fuera de alcance**: `validateFormFieldValidations` (Task 22, ya cerrada).
- **Dependencias**: Tasks 1, 2.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-form-choice-items.ts`; modificar `src/config/validate-form-nodes.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-collections.test.ts`,
    `runtime-config-validation-form-fields.test.ts` (~1129 líneas).
  - **Comportamiento cubierto**:
    - `select`/`radioGroup`/`checkboxGroup` siguen aceptando `items` como array manual, `{ values }` o `{ source,
      itemType/label/value }` con los mismos rechazos de mezcla de tipos (`string`/`number`).
    - `defaultValue` de campos de elección simple sigue rechazando arrays literales; de elección múltiple sigue
      exigiendo array u referencia soportada, con el mismo mensaje para miembros no escalares o mezclados.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-collections.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe con los 4 símbolos; el barrel reexporta los 2 públicos; los tests
    listados pasan.

---

## Task 24 — Módulo de semántica cruzada de formularios (segunda pasada)

- **ID**: 0115-T24
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-form-semantics.ts` moviendo, copia literal: `validateFormSemantics`
  (pública), `collectModalIds`, `isFormOnlyLeafNode`, `validateFormNodesInCollection`, `validateFormChildren`,
  `validateOnSuccessActionTargets`, `validateOnErrorActionTargets`, `validateFallbackCollections` (privadas),
  interface `FormValidationContext`. Importa `buttonRequiresFormAncestor`, `FORM_ALLOWED_DESCENDANT_TYPES`,
  `FORM_ONLY_LEAF_NODE_TYPES` de `'./layout-placement-rules'`; `buildBreadcrumbSegmentFromNode`,
  `enrichedInvalidLayoutFromNode` de `'./validation-breadcrumb'`; `invalidLayout` de
  `'./runtime-config-validation-errors'`. Zero dependencia de ningún módulo de layout: opera exclusivamente sobre
  `LayoutNode`/`FormLayoutNode` ya validados en primera pasada. Modificar `validate-form-nodes.ts`: eliminar las 8
  implementaciones + la interfaz, añadir `export { validateFormSemantics } from './validate-form-semantics'`.
- **Fuera de alcance**: `validateExecutionRequestParams` (Task 25, comparte tema pero no código).
- **Dependencias**: ninguna (independiente de las Tasks 1-23; se sitúa aquí por orden narrativo).
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-form-semantics.ts`; modificar `src/config/validate-form-nodes.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-forms-semantics.test.ts` (~750 líneas).
  - **Comportamiento cubierto**:
    - `form.id` duplicado, `fieldId` duplicado dentro del mismo form, `resetOnSuccess` sin `submitAction`,
      referencias de `onSuccess`/`onError` a páginas/operaciones/modales inexistentes siguen rechazándose con el
      mismo mensaje y ruta.
    - `FORM_ALLOWED_DESCENDANT_TYPES`/`FORM_ONLY_LEAF_NODE_TYPES` siguen aplicándose igual dentro y fuera de
      `container`/`accordion`/`tabs` anidados dentro de un `form`.
    - La recursión sobre `queryStateFeedback.states.{estado}.fallback` sigue aplicando las mismas reglas semánticas.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe con los 8 símbolos; el barrel reexporta `validateFormSemantics`; el
    test listado pasa.

---

## Task 25 — Módulo de validación de request params en operaciones GET (segunda pasada)

- **ID**: 0115-T25
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-form-request-params.ts` moviendo, copia literal:
  `validateExecutionRequestParams` (pública), `validateExecutionRequestParamsInCollection` (privada). Importa
  `buildBreadcrumbSegmentFromNode`, `enrichedInvalidLayoutFromNode` de `'./validation-breadcrumb'`. Zero dependencia
  de ningún módulo de layout. Modificar `validate-form-nodes.ts`: eliminar las 2 implementaciones, añadir
  `export { validateExecutionRequestParams } from './validate-form-request-params'`.
- **Fuera de alcance**: `validateFormSemantics` (Task 24, ya cerrada).
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-form-request-params.ts`; modificar `src/config/validate-form-nodes.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-api-operations.test.ts` (~490 líneas).
  - **Comportamiento cubierto**:
    - `body` en operaciones `GET` sigue rechazándose desde `button.props.action` (`executeOperation`/
      `executeOperations`), `form.submitAction` y `form.onSuccess`/`onError`, con el mismo mensaje y ruta, incluida
      la recursión dentro de `container`/`form`/`modal`/`repeater`/`tabs`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-api-operations.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe con los 2 símbolos; el barrel reexporta
    `validateExecutionRequestParams`; el test listado pasa.

---

## Task 26 — Módulo de validadores de campo de formulario (primera pasada, depende de Tasks 4, 22, 23)

- **ID**: 0115-T26
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-form-field-nodes.ts` moviendo, copia literal: `validateInputNode`,
  `validateTextareaNode`, `validateSelectNode`, `validateRadioGroupNode`, `validateCheckboxGroupNode`,
  `validateToggleNode` (las 6, todas públicas hoy). Importa `validateQueryStateFeedback` de
  `'./validate-layout-nodes-core'` (arista de vuelta hacia el hub, ver "Referencia común"); `mapLeafNodeIssue` de
  `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateVisibility` de
  `'./validate-actions-visibility'`; `validateFormFieldValidations` de `'./validate-form-field-validations'`;
  `validateSelectItemsContract`, `validateChoiceFieldDefaultValue` de `'./validate-form-choice-items'`;
  `isTokensReference` de `'./runtime-reference-namespace-guards'`; `parseRuntimeReference` de
  `'../runtime/runtime-references/runtime-reference-parser'`; `inputNodeSchema`, `textareaNodeSchema`,
  `selectNodeSchema`, `radioGroupNodeSchema`, `checkboxGroupNodeSchema`, `toggleNodeSchema` de
  `'./runtime-config-zod'`. Modificar `validate-form-nodes.ts`: eliminar las 6 implementaciones, añadir
  `export { validateInputNode, validateTextareaNode, validateSelectNode, validateRadioGroupNode,
  validateCheckboxGroupNode, validateToggleNode } from './validate-form-field-nodes'`. Modificar
  `validate-layout-nodes-core.ts`: cambiar los 6 imports temporales correspondientes desde `'./validate-form-nodes'`
  a `'./validate-form-field-nodes'`.
- **Fuera de alcance**: `validateHiddenNode` (Task 27), `validateFormNode` (Task 28).
- **Dependencias**: Tasks 3, 4, 22, 23.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-form-field-nodes.ts`; modificar `src/config/validate-form-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-form-fields.test.ts`,
    `runtime-config-validation-forms-validations.test.ts`, `runtime-config-validation-toggle.test.ts`,
    `runtime-config-validation-tooltip.test.ts`.
  - **Comportamiento cubierto**:
    - Los 6 tipos de campo siguen rechazando `defaultValue` array/tokens-reference según las mismas reglas por tipo.
    - `toggle.props.defaultValue` sigue aceptando boolean o referencia soportada (incluido `item.*`).
    - `props.tooltip` sigue aceptando string (vacío, no vacío, interpolado) en los 6 nodos y rechazando otros tipos.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-validations.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-toggle.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-tooltip.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe con las 6 funciones; el barrel las reexporta; el hub importa de este
    módulo; los tests listados pasan.

---

## Task 27 — Módulo hidden (sin arista de vuelta al hub)

- **ID**: 0115-T27
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-hidden-node.ts` moviendo, copia literal, `validateHiddenNode` (pública) +
  const `hiddenProhibitedProps`. Importa `mapLeafNodeIssue` de `'./validate-layout-issue-mapping'`; `isRecord` de
  `'./validate-node-shared-helpers'`; `hiddenNodeSchema` de `'./runtime-config-zod'`. **No importa nada de
  `validate-layout-nodes-core.ts`** (hidden no soporta `visibility` ni `queryStateFeedback`), por lo que no crea
  arista de vuelta hacia el hub — verificar explícitamente esta ausencia de import. Modificar
  `validate-form-nodes.ts`: eliminar la implementación + la constante, añadir `export { validateHiddenNode } from
  './validate-hidden-node'`. Modificar `validate-layout-nodes-core.ts`: cambiar el import temporal de
  `validateHiddenNode` desde `'./validate-form-nodes'` a `'./validate-hidden-node'`.
- **Fuera de alcance**: los otros 6 validadores de campo (Task 26, ya cerrada).
- **Dependencias**: Tasks 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-hidden-node.ts`; modificar `src/config/validate-form-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-hidden.test.ts`.
  - **Comportamiento cubierto**:
    - `hidden` sigue rechazando `visibility`/`queryStateFeedback` declarados en el nodo, y los props prohibidos
      (`label`/`validations`/`defaultValue`/`placeholder`/`icon`/`iconPosition`), con el mismo mensaje.
    - `props.fieldId`/`value` (string/number/boolean/referencia) siguen validándose igual.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-hidden.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente; confirmar con `grep` que
    `validate-hidden-node.ts` no importa de `validate-layout-nodes-core.ts`.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe sin arista hacia el hub; el barrel reexporta `validateHiddenNode`; el
    hub importa de este módulo; el test listado pasa.

---

## Task 28 — Módulo form (dispatch del nodo `form`)

- **ID**: 0115-T28
- **Estado**: pending
- **Objetivo**: Crear `src/config/validate-form-node.ts` moviendo, copia literal, `validateFormNode` (pública).
  Importa `validateLayoutCollection`, `validateQueryStateFeedback` de `'./validate-layout-nodes-core'` (arista de
  vuelta hacia el hub); `mapLayoutNodeIssue` de `'./validate-layout-issue-mapping'`; `mapQueryStateFeedbackIssue`,
  `mapVisibilityIssue`, `validateFormSubmitAction` de `'./validate-actions-visibility'`; `formNodeSchema` de
  `'./runtime-config-zod'`. Modificar `validate-form-nodes.ts`: eliminar la implementación, añadir
  `export { validateFormNode } from './validate-form-node'`. Modificar `validate-layout-nodes-core.ts`: cambiar el
  import temporal de `validateFormNode` desde `'./validate-form-nodes'` a `'./validate-form-node'`. **Con esta tarea
  `validate-form-nodes.ts` deja de contener ninguna implementación**: solo debe quedar el bloque de reexports.
- **Fuera de alcance**: cualquier otro validador (todas las Tasks anteriores ya cerradas).
- **Dependencias**: Tasks 3, 4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/validate-form-node.ts`; modificar `src/config/validate-form-nodes.ts` y
    `src/config/validate-layout-nodes-core.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `runtime-config-validation-forms-semantics.test.ts`,
    `runtime-config-validation-forms-validations.test.ts`.
  - **Comportamiento cubierto**:
    - `form` sigue validando `submitAction`/`resetOnSuccess`/`persistOnUnmount`/`children` con los mismos mensajes de
      ruta y sigue delegando en `validateLayoutCollection` para sus `children`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-validations.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta la tarea final.
- **Criterios de finalización**:
  - Cierre de implementación: el módulo existe; el barrel reexporta `validateFormNode`; el hub importa de este
    módulo; `validate-form-nodes.ts` ya no contiene ninguna implementación; los tests listados pasan.

---

## Task 29 — Barrels puros y verificación global

- **ID**: 0115-T29
- **Estado**: pending
- **Objetivo**: Con las 28 tareas anteriores cerradas, `src/config/validate-layout-nodes.ts` y
  `src/config/validate-form-nodes.ts` deben quedar como barrels puros: únicamente líneas `export { ... } from
  './<módulo>'` (y `export type { ... }` si aplica), sin ninguna declaración de función/constante/interfaz propia ni
  import sin usar. Esta tarea:
  1. Revisa ambos barrels y elimina cualquier import o código muerto residual de las 28 extracciones.
  2. Confirma con `grep -n "^export function\|^function \|^const \|^interface " src/config/validate-layout-nodes.ts
     src/config/validate-form-nodes.ts` que ninguno de los dos declara ya nada directamente (el comando no debe
     devolver resultados de implementación, solo, como mucho, comentarios).
  3. Confirma que el conjunto de símbolos reexportados por cada barrel (nombres, no implementación) es exactamente el
     mismo conjunto inventariado al inicio del plan: layout reexporta `validateLayoutCollection`, `validateLayoutNode`,
     `validateQueryStateFeedback`, `mapCollectionPaginationIssue`, `mapLeafNodeIssue`, `mapLayoutNodeIssue`,
     `validateLinkNode`, `validateTableCellNode`, `validateVisibility` (9 símbolos); form reexporta `validateFormNode`,
     `validateInputNode`, `validateTextareaNode`, `validateSelectNode`, `validateRadioGroupNode`,
     `validateCheckboxGroupNode`, `validateToggleNode`, `validateHiddenNode`, `validateFormFieldValidations`,
     `validateSelectItemsContract`, `validateCollectionSource`, `validateChoiceFieldDefaultValue`,
     `validateFormSemantics`, `validateExecutionRequestParams` (14 símbolos).
  4. Ejecuta `grep -n "from '\./validate-layout-nodes'\|from '\./validate-form-nodes'" src/config/*.ts` y confirma que
     ningún módulo interno nuevo (los 28 de esta feature) sigue importando de los dos barrels — todos deben importar
     de los módulos internos concretos.
  5. Ejecuta `git diff --name-only` (o `grep` del bloque de import) sobre `src/config/validate-runtime-config.ts` y
     confirma que su import de `validateLayoutCollection` (de `'./validate-layout-nodes'`) y de
     `validateFormSemantics`/`validateExecutionRequestParams` (de `'./validate-form-nodes'`) no cambió.
  6. Ejecuta la verificación global de la feature.
- **Fuera de alcance**: crear o mover ninguna función adicional; tocar `validate-runtime-config.ts` o cualquier otro
  fichero externo a esta feature; reorganizar ningún fichero de `src/tests/config-validation/`.
- **Dependencias**: Tasks 1-28, todas cerradas.
- **Impacto esperado en archivos**:
  - Código: modificar `src/config/validate-layout-nodes.ts` y `src/config/validate-form-nodes.ts` (limpieza final,
    sin crear módulos nuevos).
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna a modificar en esta tarea (se declara como afectada para la pasada posterior de
    `update-app-documentation`, ver más abajo).
- **Tests**:
  - **Ficheros de test**: ninguno (nuevo ni ampliación); cubierto por: la suite completa de
    `src/tests/config-validation/*.test.ts` (mapa completo en `ai-workflow/docs/test-index.md`), con foco explícito
    en confirmar que ningún mensaje/código/ruta/breadcrumb cambió.
  - **Comportamiento cubierto**:
    - `git diff --name-only` tras las 29 tareas no debe listar `src/config/validate-runtime-config.ts` ni ningún otro
      fichero fuera de `src/config/validate-layout-nodes*.ts`, `src/config/validate-form-nodes*.ts`, y los 28 módulos
      nuevos listados en la "Referencia común".
    - No existe ningún ciclo de import entre módulos "spoke" (verificación manual: ninguno de los 17 módulos de nodo
      de layout ni de los 7 módulos de form importa de otro módulo de su misma categoría, salvo
      `validate-table-node.ts` → `validate-repeater-node.ts`, unidireccional).
    - Los únicos módulos con arista de vuelta hacia `validate-layout-nodes-core.ts` son exactamente los 17 módulos de
      nodo de layout + `validate-form-field-nodes.ts` + `validate-form-node.ts`; `validate-hidden-node.ts` no tiene
      ninguna arista hacia el hub.
    - `pnpm test --run src/tests/config-validation` (o el patrón equivalente) pasa sin cambiar ninguna aserción.
    - `pnpm test` completo pasa, incluido el umbral mínimo de cobertura del 80% sobre `src/`.
    - `pnpm build` completa sin errores.
    - `pnpm lint` pasa sin error sobre los 28 módulos nuevos y los 2 barrels.
  - **Comandos durante la implementación**: en este orden, todos deben terminar en éxito: `git diff --name-only`
    (inspección manual), los 2 comandos `grep` del punto 2-4 del objetivo, `pnpm lint`, `pnpm build`, `pnpm test`.
  - **Restricciones**: no añadir tests nuevos para "cubrir" la reorganización; la regresión de la suite existente es
    la validación completa de esta tarea. Mantener explícitas las líneas `export { ... } from ...` por módulo (no
    colapsar en `export * from`) para trazabilidad futura.
- **Documentación afectada**: `ai-workflow/docs/architecture.md` (la línea que describe `src/config/` menciona
  `validate-layout-nodes` y `validate-form-nodes` como los módulos de dominio de la validación; revisar si conviene
  anotar que cada uno es ahora un barrel sobre submódulos internos, dado que el punto de entrada público mantiene los
  mismos nombres de ruta). `ai-workflow/docs/app-features/config/validation.md` y
  `ai-workflow/docs/app-features/nodes/index.md`: no deberían requerir cambio (ningún comportamiento cambia).
  `ai-workflow/docs/test-index.md`: no requiere cambio. A actualizar manualmente en una pasada posterior de
  `update-app-documentation`.
- **Criterios de finalización**:
  - Cierre de implementación: ambos barrels quedan como barrels puros; los comandos de verificación (`grep` x3,
    `pnpm lint`, `pnpm build`, `pnpm test`, inspección de `git diff --name-only`) terminan en éxito y sin listar
    ningún fichero fuera de lo esperado.

---

## Cierre de la feature

Cuando las Tasks 1-29 queden en `done`, la feature está completa a nivel de implementación:
`src/config/validate-layout-nodes.ts` y `src/config/validate-form-nodes.ts` pasan de 2.713 y 2.017 líneas
respectivamente a barrels cortos; las 84 funciones originales (78 implementaciones distintas tras consolidar los 6
helpers duplicados) siguen siendo importables desde las mismas rutas con la misma firma y comportamiento; ninguno de
los ficheros externos (`validate-runtime-config.ts`) cambió su import; el ciclo real layout⟷form se preserva
exactamente con la misma forma pero localizado a los módulos internos concretos que lo necesitan (`validate-layout-nodes-core.ts`
↔ `validate-form-node.ts`/`validate-form-field-nodes.ts`), sin propagarse a un ciclo nuevo entre dominios distintos; y
la suite de tests (incluido el umbral de cobertura del 80%) sigue en verde. Queda pendiente, fuera de este
`tasks.md`, la actualización manual de la documentación listada en Task 29 vía `update-app-documentation`.
