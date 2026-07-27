# Spec: Layout and form validators split

## Objetivo

Dividir físicamente `src/config/validate-layout-nodes.ts` (2.713 líneas, ~44 funciones) y
`src/config/validate-form-nodes.ts` (2.017 líneas, ~32 funciones) en módulos internos agrupados por tipo de nodo o
responsabilidad real, sin cambiar ningún comportamiento de validación, ningún mensaje de error y ningún breadcrumb.

Es una reorganización puramente mecánica: mismas firmas de función, mismos códigos de error (`invalid-layout`,
`unsupported-node-type`), mismas rutas canónicas y mismo enriquecimiento de breadcrumb/extracto de nodo.

## Alcance

- Partir `src/config/validate-layout-nodes.ts` en módulos internos agrupados según las familias ya reconocibles en el
  catálogo de nodos documentado (`ai-workflow/docs/app-features/nodes/index.md`):
  - núcleo de dispatch y utilidades transversales (`validateLayoutCollection`, `validateLayoutNode`,
    `validateQueryStateFeedback`, `mapLeafNodeIssue`, `mapLayoutNodeIssue`, helpers de path/record compartidos).
  - contenedores estructurales: `container`, `repeater` (+ `mapCollectionPaginationIssue`), `modal`, `tabs`,
    `accordion`.
  - contenido simple: `heading`, `paragraph`, `list`, `image`.
  - `table` y subpartes: headers, columns, rows (manuales y dinámicas), `table-cell`, validación recursiva de
    contenedores dentro de celda.
  - nodos interactivos: `button`, `link` (+ validación de children permitidos).
  - nodos presentacionales: `badge`, `alert`, `stat`, `divider`, `skeleton`.
  - nodos de ficheros: `fileInput`, `fileManager`.
- Partir `src/config/validate-form-nodes.ts` en módulos internos agrupados por:
  - dispatch del nodo `form`.
  - validadores de primera pasada por campo: `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `toggle`,
    `hidden`.
  - motor de reglas de `props.validations` (required, numéricas, pattern, flags booleanos, compatibilidad por tipo de
    campo, rangos contradictorios).
  - contrato de `items` y origen de colección para campos de elección (`validateSelectItemsContract`,
    `validateCollectionSource`, validación de scalars).
  - `defaultValue` de campos de elección simple/múltiple.
  - validación semántica cruzada de formularios de segunda pasada (`validateFormSemantics`): IDs de formulario
    duplicados, `fieldId` duplicado, placement, `resetOnSuccess`, referencias de `onSuccess`/`onError` a páginas,
    operaciones y modales.
  - validación semántica cruzada de segunda pasada sobre `body` en operaciones `GET` (`validateExecutionRequestParams`).
- La agrupación exacta y el número final de ficheros por dominio se decide en `generate-implementation-plan`, siempre
  que cada función quede en un módulo cuya responsabilidad sea reconocible por su nombre y coincida con la
  descomposición anterior a nivel de dominio.
- `src/config/validate-layout-nodes.ts` y `src/config/validate-form-nodes.ts` se mantienen ambos como punto de
  entrada único (barrel) que re-exporta el contenido de sus módulos internos respectivos, de forma que **ningún
  import externo a estos dos ficheros cambie**. Esta decisión está tomada y cerrada (ver justificación en Riesgos).
- Mismas firmas públicas, mismos nombres exportados, mismo comportamiento runtime, mismos mensajes y rutas de error.
- Los ficheros de test actuales que cubren esta validación (ver Riesgos, ya organizados por dominio funcional y no por
  fichero fuente) siguen validando el mismo comportamiento sin perder cobertura de ningún caso ya cubierto.

## Fuera de alcance

- Cualquier cambio de mensaje de error, código de error, ruta canónica, breadcrumb o extracto de nodo.
- Cualquier cambio de comportamiento de validación (aceptar o rechazar un config que hoy se rechaza o acepta).
- Cambios en los imports de los ficheros externos que hoy consumen estos dos módulos: únicamente
  `src/config/validate-runtime-config.ts` (fachada de orquestación) importa de ambos; ningún otro fichero de `src/`
  importa directamente de `validate-layout-nodes.ts` ni de `validate-form-nodes.ts`.
- Reorganizar `src/config/validate-actions-visibility.ts`, `src/config/layout-placement-rules.ts`,
  `src/config/validation-breadcrumb.ts` ni `src/runtime/runtime-references/runtime-reference-parser.ts`: siguen
  siendo dependencias externas estables de ambos dominios, sin cambios.
- Modularizar otros ficheros de `src/config/` no mencionados (`validate-preloads`, `validate-api-config`,
  `validate-runtime-config`, esquemas `Zod`, adaptador de errores).
- Reorganizar los ficheros de test bajo `src/tests/config-validation/`: ya están organizados por dominio funcional
  (uno por tipo de nodo o regla, no por fichero fuente) y no requieren cambio estructural por esta feature.
- Cambiar el umbral o la estrategia global de cobertura de tests.

## Requisitos funcionales

1. Toda función y tipo actualmente exportado por `src/config/validate-layout-nodes.ts` sigue siendo importable desde
   esa misma ruta, con la misma firma y el mismo comportamiento.
2. Toda función y tipo actualmente exportado por `src/config/validate-form-nodes.ts` sigue siendo importable desde
   esa misma ruta, con la misma firma y el mismo comportamiento.
3. Cada función queda ubicada en un módulo cuyo nombre refleja el dominio de nodo o responsabilidad que cubre (por
   ejemplo `validate-table-node.ts`, `validate-form-field-validations.ts`), no en un cajón de sastre.
4. La recursión cruzada ya existente hoy entre ambos ficheros se preserva exactamente igual tras la división:
   - el dispatcher de `validateLayoutNode` sigue delegando en los validadores de campo de formulario
     (`validateFormNode`, `validateInputNode`, `validateTextareaNode`, `validateSelectNode`,
     `validateRadioGroupNode`, `validateCheckboxGroupNode`, `validateToggleNode`, `validateHiddenNode`) para los tipos
     de nodo correspondientes.
   - `validateFormNode` sigue delegando en `validateLayoutCollection` para validar los descendientes de un `form` que
     no son campos de formulario (`container`, `heading`, `table`, `accordion`, `tabs`, etc., según
     `FORM_ALLOWED_DESCENDANT_TYPES`).
   - `validateCollectionSource` (usado por `select`/`radioGroup`/`checkboxGroup` en el dominio de formulario y por
     `repeater`/`list`/`table` en el dominio de layout) sigue teniendo un único punto de verdad, sin duplicar su
     implementación entre dominios.
5. La reutilización interna ya existente (por ejemplo, `validateTableCellNode` delegando en `validateLayoutNode`
   para el contrato completo de la celda, o `validateSelectItemsContract` reutilizado por `select`, `radioGroup` y
   `checkboxGroup`) se preserva exactamente igual tras la división.

## Requisitos no funcionales

- Ningún fichero de `src/` fuera de `src/config/` (u otros módulos internos de esta división) necesita modificar su
  import de `validate-layout-nodes` o `validate-form-nodes` como consecuencia de esta feature.
- No debe introducirse ningún ciclo de import **nuevo** entre los módulos internos resultantes más allá de: (a) la
  recursión cruzada que ya existe hoy entre ambos ficheros (dispatcher de layout ⟷ validación de children de form),
  que debe resolverse a nivel de barrel-a-módulo-interno-del-otro-dominio (nunca barrel-a-barrel real), y (b) un
  segundo ciclo, interno al dominio layout, entre el módulo hub que concentra `validateLayoutNode` +
  `validateLayoutCollection` + `validateQueryStateFeedback` y cada módulo de nodo individual (layout o campo de
  formulario) que ese hub despacha. Este segundo ciclo es una consecuencia estructural inevitable de cualquier
  partición mecánica de un dispatcher recursive-descent en módulos por tipo de nodo: el hub necesita importar cada
  validador de nodo para el `switch` de dispatch, y cada validador de nodo necesita importar de vuelta al hub como
  mínimo `validateQueryStateFeedback` (y, en los nodos que anidan hijos, también `validateLayoutCollection`). No es un
  artefacto de mal diseño ni requiere `design.md`: es seguro en runtime (todas las funciones implicadas son
  declaraciones `function` hoisted, invocadas solo dentro de otros cuerpos de función, nunca en evaluación de módulo
  top-level) y es el mismo patrón ya usado hoy, sin partición, en los dos ficheros originales. La excepción se limita
  estrictamente a esta topología "hub and spoke": el hub puede importar de cada módulo de nodo y viceversa, pero
  ningún módulo de nodo puede importar de otro módulo de nodo salvo una delegación unidireccional ya existente y
  documentada explícitamente en `tasks.md` (por ejemplo `table` reutilizando paginación de `repeater`, sin ciclo).
- Los helpers privados que hoy están duplicados byte a byte entre ambos ficheros (`isRecord`, `isNonEmptyString`,
  `formatPathSegment`, `isValidCollectionItemPath`, `isValidCollectionProjectionPath`,
  `isValidCollectionPathSegment` y el patrón `collectionPathSegmentPattern`) pueden consolidarse en un único módulo
  compartido durante esta división, siempre que el comportamiento permanezca idéntico; no es obligatorio si complica
  la agrupación por dominio.
- La cobertura global de tests se mantiene en el umbral mínimo del 80% sobre `src/`.
- Ningún módulo nuevo debería quedar significativamente más grande que el resto salvo justificación por densidad real
  del dominio (por ejemplo, `table`, que ya concentra hoy más subpartes que el resto de nodos de layout, o la
  validación semántica cruzada de formularios, que ya concentra hoy más reglas que el resto de responsabilidades de
  form).

## Criterios de aceptación

1. `src/config/validate-layout-nodes.ts` y `src/config/validate-form-nodes.ts` dejan de tener 2.713 y 2.017 líneas
   respectivamente y pasan a ser barrels cortos, o el nuevo punto de entrada equivalente re-exporta el mismo API
   público completo de cada uno.
2. El único fichero externo que hoy importa de ambos (`src/config/validate-runtime-config.ts`) no requiere cambios en
   su import tras la división (verificable con `grep` antes/después: mismo conjunto de rutas de import, mismos
   specifiers).
3. La suite de tests existente bajo `src/tests/config-validation/` sigue en verde sin cambiar ninguna aserción sobre
   mensajes de error, códigos, rutas canónicas o breadcrumb.
4. `pnpm build` y `pnpm test` completan sin errores tras la división.
5. Ningún módulo interno nuevo importa (directa o transitivamente) desde un módulo que a su vez dependa de él, salvo
   las dos excepciones explícitas descritas en los requisitos no funcionales: (a) la recursión cruzada entre el
   dominio layout y el dominio form, resuelta barrel-a-módulo-interno-del-otro-dominio, nunca barrel-a-barrel real; y
   (b) la topología hub-and-spoke dentro del dominio layout entre el módulo hub de dispatch y cada módulo de nodo
   individual. Ningún módulo "spoke" (de nodo) importa de otro módulo "spoke" salvo una delegación unidireccional ya
   documentada explícitamente en `tasks.md`.

## Casos límite

- **Recursión `form` ⟷ `layout`**: un `form` puede contener nodos de layout genéricos (`container`, `table`,
  `accordion`, `tabs`, `divider`, etc.) además de campos de formulario, y un nodo de layout (`container`, `repeater`,
  `modal`, `tabs`) puede contener un `form`. Esta recursión mutua debe seguir funcionando exactamente igual.
- **`validateCollectionSource`**: usado hoy desde `validate-form-nodes.ts` pero consumido también por
  `repeater.props.items.source`, `list.props.items.source` y `table.props.rows` (dynamic rows) en
  `validate-layout-nodes.ts`. Debe quedar en un único módulo con un único punto de verdad, sin importar si su nueva
  ubicación física queda en el dominio de layout, en el de form o en un módulo base compartido — eso se decide en
  planificación.
- **`validateTableCellNode`**: valida el subconjunto de tipos permitidos dentro de una celda y luego delega en
  `validateLayoutNode` (el dispatcher completo) para el resto del contrato; debe seguir pudiendo alcanzar el
  dispatcher tras la división.
- **Helpers privados duplicados hoy entre ambos ficheros** (`isRecord`, `isNonEmptyString`, `formatPathSegment`, y los
  tres validadores de path de colección): consolidarlos en un módulo compartido es una simplificación válida dentro
  del alcance de esta feature siempre que no cambie el comportamiento; dejarlos duplicados en sus nuevos módulos
  también es aceptable si resulta más simple para la agrupación elegida.
- **Constantes y tipos internos no exportados** (por ejemplo `hiddenProhibitedProps`, `supportedFormValidationRuleNames`,
  `FormFieldValidationTarget`): pueden quedar privados de su módulo si solo los usa ese dominio.

## Riesgos o preguntas abiertas

Ninguno bloqueante. Investigado y resuelto con datos concretos:

- **Importadores externos**: se verificó con `grep` que solo `src/config/validate-runtime-config.ts` importa
  directamente de `validate-layout-nodes.ts` (`validateLayoutCollection`) y de `validate-form-nodes.ts`
  (`validateFormSemantics`, `validateExecutionRequestParams`). Ningún otro fichero de `src/` importa estas rutas
  directamente (las menciones adicionales encontradas en `layout-placement-rules.ts`,
  `layout-canvas-node-palette-defaults.ts` y `layout-canvas-properties-panel.tsx` son solo comentarios, no imports).
  Por eso se fija barrel re-exportador en ambos ficheros, siguiendo el mismo patrón ya validado con éxito en la
  feature hermana `0114-runtime-node-styling-modularization`.
- **Ciclo real entre ambos ficheros**: a diferencia de `0114` (donde la única dependencia cruzada era
  unidireccional), aquí existe hoy un ciclo real y necesario por dominio: `validate-layout-nodes.ts` importa 9
  funciones de `validate-form-nodes.ts` (el dispatcher de layout necesita delegar en los validadores de campo de
  formulario) y `validate-form-nodes.ts` importa 5 funciones de `validate-layout-nodes.ts`
  (`validateLayoutCollection`, `validateQueryStateFeedback`, `validateVisibility`, `mapLeafNodeIssue`,
  `mapLayoutNodeIssue`), porque un `form` puede contener nodos de layout genéricos y un nodo de layout puede
  contener un `form`. Este ciclo es inherente al dominio (no un artefacto de mal diseño) y ya funciona en producción
  hoy como ciclo de import a nivel de fichero. La resolución elegida y cerrada en esta spec es preservarlo
  exactamente con la misma forma pero a nivel de barrel: cada barrel (`validate-layout-nodes.ts` y
  `validate-form-nodes.ts`) puede seguir importando del otro barrel para los puntos de recursión concretos
  (dispatcher de layout, children de form), sin que esa indirección se propague a un ciclo nuevo y más profundo entre
  módulos internos de dominios distintos. No se considera un trade-off arquitectónico no trivial que requiera
  `design.md`: es la misma estrategia mecánica de barrel ya usada con éxito en `0114`, aplicada a los dos lados de un
  ciclo existente en vez de a un único fichero.
- **Volumen**: esta feature reparte ~76 funciones en 2 ficheros (frente a 94 funciones en 1 fichero en `0114`), por lo
  que se marca `risk_level: medium` en vez de `low`, aunque el patrón de resolución (barrel, sin cambio de
  comportamiento) es idéntico y de bajo riesgo real.
- **Tests**: los ficheros de test relevantes (`src/tests/config-validation/*.test.ts`) ya están organizados por
  dominio funcional (uno por tipo de nodo o regla) y no por fichero fuente, así que no requieren reorganización como
  consecuencia de esta feature; solo deben seguir en verde.
- **Segundo ciclo, interno al dominio layout (detectado durante `generate-implementation-plan`, no en la redacción
  original de esta spec)**: `validateLayoutNode` (el dispatcher) necesita importar cada uno de los ~23 validadores de
  tipo de nodo para su `switch`, y cada validador de nodo necesita importar de vuelta, como mínimo,
  `validateQueryStateFeedback` (los que anidan hijos también `validateLayoutCollection`). Es una componente fuertemente
  conexa inevitable en cualquier partición mecánica de este dispatcher, ya presente hoy sin partición en un único
  fichero. Se resuelve con una topología hub-and-spoke (ver requisitos no funcionales y criterio de aceptación 5):
  el hub puede importar cada módulo de nodo y viceversa, pero ningún módulo de nodo importa de otro salvo una
  delegación unidireccional documentada. No requiere `design.md`: es la generalización directa del mismo patrón de
  barrel ya usado con éxito en `0114`, aplicada a una segunda componente conexa además de la cruzada layout⟷form.

## Áreas de producto afectadas

- `src/config/` (organización interna de la validación previa al render). No es una feature de producto visible; no
  cambia comportamiento para el usuario final de la aplicación construida con el runtime.

## Documentación probablemente afectada

- `ai-workflow/docs/architecture.md`: la línea que describe `src/config/` menciona `validate-layout-nodes` y
  `validate-form-nodes` como los módulos de dominio de la validación; si el punto de entrada público mantiene esos
  mismos nombres de ruta (barrel), no requiere cambio salvo revisar si conviene anotar que cada uno es ahora un
  barrel sobre submódulos internos.
- `ai-workflow/docs/app-features/config/validation.md` y `ai-workflow/docs/app-features/nodes/index.md`: no deberían
  requerir cambio, ya que ningún comportamiento ni mensaje de validación cambia.
- `ai-workflow/docs/test-index.md`: no debería requerir cambio, ya que los tests no se reorganizan como parte de esta
  feature.
