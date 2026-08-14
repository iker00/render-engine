# Plan — 0132 dev-editor-visibility-condition-widget

Contrato de ejecución para la feature. Alcance: un único componente reutilizable de edición de la
forma condición/grupo de `visibility`/`when` en el editor visual del dev mode, sustituyendo el
pipeline genérico actual (`resolveUnionBranch` + objeto genérico + fallback de `value` sin editor
real) en las tres superficies que ya reutilizan esa forma: `node.visibility` del panel de `Layout`,
`when` de `executeOperations.operations` y de `onSuccess`/`onError`, y `visibility` de `menuItem`/
`menuItemChild` y `sidebarItem` del panel `Shell`.

La fuente única de verdad de la spec vive en [[spec.md]]. Las decisiones técnicas (D1–D4) viven en
[[design.md]] y esta planificación las respeta literalmente.

Todas las tareas comparten estos anclajes técnicos:

- **Registro de widgets dedicados por schema**: `WIDGET_REGISTRY` en
  `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`. Es el mismo hook
  `x-widget` que ya usan `choice-items` (feature `0108`), `layout-span` (feature `0127`),
  `heading-level`/`tabs-orientation` (feature `0128`) e `icon` (feature `0129`). La nueva entrada
  es `x-widget: 'condition-group'`, resuelta al componente `ConditionGroupPropertyField` (T2). No
  se introduce un segundo mecanismo de registro ni se toca `resolveUnionBranch` (D1 de
  [[design.md]]): al sustituir el fragmento de schema por el sentinel plano
  `{ 'x-widget': 'condition-group' }`, `getUnionBranches` no encuentra `oneOf`/`anyOf` y devuelve
  el schema sin tocar, dejando que la resolución del hook `x-widget` (prioritaria) gane.

- **Punto de inyección del sentinel** (D2 de [[design.md]]): un único transform recursivo, `injectConditionGroupWidgetSentinel(schema)`, se aplica **una sola vez** justo después de
  `toJSONSchema(...)` y antes de cachear, en los dos puntos de generación de schema consumidos por
  los paneles:
  - `src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts` → `getNodeTypeJsonSchema`.
  - `src/dev-runtime/shell-config-panel/shell-config-panel-schema.ts` → `getMenuItemJsonSchema` y
    `getSidebarItemJsonSchema` (los dos getters cuyos schemas contienen `visibility`; los otros
    dos getters de ese módulo — `getShellHeaderJsonSchema` y `getShellSidebarJsonSchema` — se
    verifican en T4 y solo se envuelven si su schema generado anida `visibility` sin resolver a
    través de los getters ya cubiertos).
  El transform recorre recursivamente `properties`, `items`, `oneOf`, `anyOf` y `$defs` y sustituye
  por completo cualquier propiedad **cuya clave sea literalmente `visibility` o `when`** por
  `{ 'x-widget': 'condition-group' }`, sin inspeccionar la forma del fragmento sustituido — mismo
  criterio de detección por convención de nombre de campo que ya usa `resolveIconPropsSchema` en
  `0129-T2`, y ya aceptado como convención del proyecto. `sidebarItemSchema` es recursivo
  (`z.lazy`), así que el transform debe atravesar `$defs` explícitamente para alcanzar el
  `visibility` anidado en la rama `children` a cualquier profundidad.

- **Sin cambios en el schema de Monaco**: `src/dev-runtime/dev-runtime-json-schema.ts` (el schema
  que alimenta el autocompletado de Monaco) es un módulo y un call-path distintos y **no se toca**;
  Monaco sigue mostrando el `oneOf` real completo. Mismo precedente que `choice-items` (`0108`) y
  `icon` (`0129`).

- **Sustitución completa vía sentinel; sin adaptadores por panel**: a diferencia de
  `resolveIconPropsSchema`/`resolveTabsPropsSchema`/`resolveHeadingPropsSchema`/
  `resolveContainerPropsSchema` (que viven en `layout-canvas-properties-panel.tsx` y sólo cubren
  un nivel fijo dentro de `props`), este transform vive **en el origen cacheado** porque
  `visibility`/`when` aparecen a profundidades y en subsecciones distintas por tipo de nodo (nodo
  raíz, dentro de `props.action` en sus 7 variantes, dentro de `executeOperations.operations[]`,
  dentro de `submitAction` de `form`, dentro de `menuItem.children` a profundidad ≥ 2, dentro de
  `sidebarItem.children` a profundidad arbitraria). Inyectar una vez en el origen cubre
  automáticamente todas esas subsecciones sin duplicar el criterio de detección.

- **`MenuItemFieldsEditor`/`SidebarItemFieldsEditor` no cambian**: ambos ya enrutan `visibility` a
  través de `PropertyFieldDispatcher` + `resolveUnionBranch(visibilitySchema, item.visibility)`
  (`src/dev-runtime/shell-config-panel/menu-item-fields-editor.tsx` líneas 44 y 113–118,
  `src/dev-runtime/shell-config-panel/sidebar-item-fields-editor.tsx` líneas 42 y 111–116 al
  momento de la planificación). Con el sentinel inyectado en el schema que ambos consumen, el
  dispatcher ya monta el widget sin adaptación. Únicamente se retira el `import` de
  `resolveUnionBranch` si tras el cambio queda sin uso (a comprobar en T4).

- **Composición interna del widget** (D3 y D4 de [[design.md]]):
  `ConditionGroupPropertyField` recibe `{ label, value, onChange }` (mismo contrato que el resto
  de `WIDGET_REGISTRY`) y no ve ningún fragmento JSON Schema real. Construye internamente:
  - detección de forma inicial a partir de `value` (grupo si tiene `conditions` en su forma
    superior; condición simple en el resto de casos; ausente/no reconocible degrada a "condición
    simple" con estado por defecto mínimo — coherente con la degradación silenciosa ya vigente en
    otros widgets).
  - selector explícito de forma con dos opciones ("Condición simple" / "Grupo (y/o)").
  - dentro de "Grupo (y/o)", `SegmentedTogglePropertyField` (`0128`) para `and`/`or`, lista de
    filas con botón "Añadir" y "Quitar" por fila (bloqueado si `conditions.length === 1`).
  - un único sub-componente de fila de condición, reutilizado tanto en el modo "Condición simple"
    top-level como en cada fila de un grupo, con la misma lógica de campos condicionales por
    `operator` (`itemField` sólo con `arrayContains`; `value` oculto con `isTruthy`/`isFalsy`) y la
    misma reconciliación al cambiar `operator`.
  - editor de `value` propio: con `equals`/`notEquals`/`arrayContains`, `SegmentedTogglePropertyField`
    para el tipo (Texto/Número/Booleano/Null) + control correspondiente debajo; con
    `greaterThan`/`lessThan`, input numérico simple sin selector de tipo.
  - reglas exactas de "Reconstrucción al cambiar de operador" según spec (Requisitos funcionales,
    apartado "Reconstrucción al cambiar de operador").

  Reutiliza componentes ya existentes bajo `src/dev-runtime/layout-canvas/property-fields/`:
  `SegmentedTogglePropertyField` (selector de forma, `and`/`or` de grupo, selector de tipo de
  `value`), `TextPropertyField`, `NumberPropertyField`, `BooleanPropertyField`. No introduce una
  segunda vía de render para ninguno de estos controles.

- **Pipeline de commit y feedback por rechazo**: sin cambios. El widget delega en `onChange` como
  el resto de entradas del registro; el llamador (panel de `Layout` o de `Shell`) aplica
  `validateRuntimeConfig` y dibuja el aviso `role="alert"` con el patrón vigente
  (`pendingRejections` + `CommitRejectionBanner` en `Layout`; el mismo pipeline por fila ya
  vigente en `Shell`). El widget no gestiona `pendingRejections` propios.

- **Sin cambios de contrato ni de runtime**: `visibility`/`when` siguen siendo el mismo Zod
  (`visibilitySchema`/`whenConditionSchema` en `src/config/runtime-config-zod.ts`). Ninguna tarea
  toca `src/config/`, `validateRuntimeConfig`, `src/runtime/` ni el schema de Monaco. Ninguna
  tarea cambia el comportamiento en producción ni en modo Visual del editor.

- **Sin coste en el bundle de producción**: el widget y el transform viven bajo `src/dev-runtime/`,
  ya excluido del bundle de producción salvo activación explícita con `data-enable-dev-mode`
  (spec, requisitos no funcionales).

Los tests de la fase de implementación deben cumplir además las reglas globales de
`ai-workflow/standards/testing-rules.md` (umbral mínimo global de cobertura del 80% sobre `src/`,
tests centrados en comportamiento observable, sin snapshots amplios ni mocks que oculten el
comportamiento real).

## Orden y dependencias

T1 → T2 → T3 → T4. Cada tarea deja el árbol de la app compilando y con `pnpm test` en verde antes
de la siguiente.

- T1 es puramente funcional (transform sobre `Record<string, unknown>`), sin React ni Zod.
- T2 es puramente presentacional (`{ label, value, onChange }`), sin depender del transform.
- T3 conecta ambos en `Layout`: registra la entrada en `WIDGET_REGISTRY` y aplica el transform en
  `layout-canvas-node-schema.ts`, cerrando dos de las tres superficies (`node.visibility` y `when`
  de acciones) end-to-end contra el pipeline real.
- T4 cierra la tercera superficie (`Shell`) aplicando el transform en `shell-config-panel-schema.ts`
  y verificando end-to-end contra el pipeline real de `Shell` (menú del header y sidebar, este
  último a profundidad ≥ 2).

## Siguiente tarea a escoger

`0132-T1` — ninguna tarea implementada aún.

---

## Task 0132-T1 — Transform de schema `injectConditionGroupWidgetSentinel`

- **ID**: 0132-T1
- **Estado**: pending
- **Objetivo**: Crear una función pura, sin dependencias de React ni de Zod, que dado un fragmento
  de JSON Schema (`Record<string, unknown>`) devuelva una copia profunda con toda propiedad cuya
  clave sea literalmente `visibility` o `when` sustituida por completo por el sentinel
  `{ 'x-widget': 'condition-group' }`. El transform recorre recursivamente `properties`, `items`,
  `oneOf`, `anyOf` y `$defs` de cualquier fragmento objeto y no muta el schema recibido. Es la
  única pieza que T3 y T4 aplican sobre los schemas cacheados de `layout-canvas-node-schema.ts` y
  `shell-config-panel-schema.ts` respectivamente.

  Contrato exacto:
  - **Ubicación**: `src/dev-runtime/layout-canvas/property-fields/inject-condition-group-widget-sentinel.ts`.
    Se coloca junto al dispatcher para dejar clara su pertenencia a la superficie del hook
    `x-widget`; es importable tanto desde `layout-canvas/` como desde `shell-config-panel/`.
  - **Firma pública**:
    `export function injectConditionGroupWidgetSentinel(schema: Record<string, unknown>): Record<string, unknown>`.
    Recibe el schema completo (raíz), devuelve una copia con los sentinels aplicados. El schema de
    entrada no se muta (verificable por igualdad referencial con una copia previa).
  - **Regla de sustitución**: dentro de un objeto `properties`, cualquier entrada cuya clave sea
    exactamente `'visibility'` o `'when'` se sustituye por `{ 'x-widget': 'condition-group' }` —
    la sustitución es total (el fragmento anterior se descarta por completo, no se hace merge). La
    sustitución se decide por **nombre de clave**, no por forma del fragmento reemplazado; mismo
    criterio ya aceptado por convención del proyecto (D2, [[design.md]]; precedente:
    `resolveIconPropsSchema` en `0129-T2`).
  - **Recorrido**: el transform desciende recursivamente por:
    - `properties` (valor objeto: recorre cada entrada, aplicando la regla de sustitución a las
      claves `visibility`/`when` y recursando en el resto).
    - `items` (valor objeto: recursión directa; si es array de objetos, recursión en cada elemento).
    - `oneOf` y `anyOf` (arrays de objetos: recursión en cada rama).
    - `$defs` (valor objeto: recorre cada entrada como schema y recursa dentro). Esto es
      necesario para alcanzar el `visibility` que vive dentro de la rama recursiva de
      `sidebarItemSchema` (`z.lazy`), que `toJSONSchema` sí materializa vía `$ref`/`$defs`.
    - Cualquier otra clave se copia sin recursar.
  - **Composición conocida**: si un fragmento tiene simultáneamente `oneOf` con ramas que
    declaran `visibility` en su `properties` (caso real de las 7 variantes de acción con `when`),
    el transform desciende por cada rama del `oneOf` y sustituye `when` en cada una.
  - **Idempotencia**: aplicar el transform dos veces al mismo schema produce el mismo resultado que
    aplicarlo una sola vez (`transform(transform(s))` deep-equal `transform(s)`). Un fragmento que
    ya sea el sentinel se copia tal cual sin volver a envolverlo.
  - **Sin dependencias externas**: no importa `zod`, no importa nada de `src/config/`, no importa
    ningún componente React. Es un módulo utilitario puro.

- **Fuera de alcance**:
  - Registro del widget en `WIDGET_REGISTRY` (T3).
  - Aplicación del transform en los getters cacheados (T3 para `Layout`, T4 para `Shell`).
  - Cualquier componente React (T2).
  - Adaptar `resolveUnionBranch` u otros helpers de `property-field-schema-resolution.ts`: el
    transform es aditivo y no obliga a tocar ninguna otra pieza.
  - Enumeración estática de las rutas donde aparece `visibility`/`when` en cada schema (el
    recorrido es dinámico por construcción; no hace falta mantener una lista paralela).

- **Dependencias**: ninguna previa dentro de esta feature.

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/inject-condition-group-widget-sentinel.ts`
      (nuevo: exporta `injectConditionGroupWidgetSentinel`).
  - Tests:
    - `src/tests/dev-runtime/inject-condition-group-widget-sentinel.test.ts` (nuevo).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: entrada del nuevo fichero de test bajo `dev-runtime/`.
    - Ninguna ficha de `ai-workflow/docs/app-features/` (el transform no es visible hasta T3/T4).

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/inject-condition-group-widget-sentinel.test.ts` (nuevo).
  - **Comportamiento cubierto**:
    - Un schema plano `{ type: 'object', properties: { visibility: { oneOf: [ /* condition */, /* group */ ] } } }` produce, tras el transform, `properties.visibility` deep-equal a
      `{ 'x-widget': 'condition-group' }`; el resto del schema (raíz, otras propiedades) se
      preserva por igualdad estructural.
    - Un schema con `properties: { when: { oneOf: [...] } }` en un nivel arbitrariamente anidado
      (por ejemplo dentro de `properties.action.oneOf[i].properties.when`) queda igualmente
      sustituido por el sentinel a la profundidad correcta.
    - Un schema con `oneOf` de siete ramas, cada una con `properties.when`, produce las siete
      ramas con `properties.when` deep-equal al sentinel (caso análogo al schema real generado
      para las 7 variantes de acción con `when`).
    - Un schema con `items: { properties: { when: { … } } }` (caso análogo a
      `executeOperations.operations`) produce `items.properties.when` deep-equal al sentinel.
    - Un schema con `$defs: { '__schema0': { properties: { visibility: { … }, children: { $ref: '#/$defs/__schema0' } } } }` (forma análoga al schema recursivo de `sidebarItem`) produce
      `$defs['__schema0'].properties.visibility` deep-equal al sentinel, y **preserva** el `$ref`
      dentro de `children` sin recursar dentro del `$ref` (evita bucle infinito). Verificable con
      una comparación puntual de que la sustitución se ha aplicado exactamente una vez en el
      `$defs`.
    - Ninguna propiedad del schema cuya clave sea distinta de `visibility`/`when` se toca —
      verificable con un schema de control con claves `visible`, `whenever`, `visibilityRule`,
      `whenClause` (variaciones que **no** coinciden literalmente), que sobreviven al transform sin
      cambios.
    - Un fragmento sin `properties`/`items`/`oneOf`/`anyOf`/`$defs` (por ejemplo
      `{ type: 'string' }`) se copia sin cambios (`transform(s)` deep-equal `s`).
    - Idempotencia: `transform(transform(s))` deep-equal `transform(s)` para un schema que ya
      contiene un sentinel `{ 'x-widget': 'condition-group' }` en alguna posición.
    - No-mutación del input: `transform(s)` no muta `s` — verificable clonando `s` antes con
      `structuredClone`, aplicando el transform, y comparando `s` con la clonación después
      (deep-equal, sin cambios).
    - Aplicado sobre el schema real de un nodo con `visibility` (por ejemplo
      `toJSONSchema(buttonNodeSchema)` en un caso de test), la propiedad de primer nivel
      `properties.visibility` queda sustituida por el sentinel y las siete ramas de
      `properties.props.oneOf[*].properties.action.oneOf[*].properties.when` (cuando aplica)
      quedan sustituidas por el sentinel a su profundidad correspondiente. Este caso valida
      empíricamente el recorrido real, complementando los casos sintéticos previos.
    - Aplicado sobre el schema real de `sidebarItemSchema` (`toJSONSchema(sidebarItemSchema)`), la
      propiedad `visibility` queda sustituida por el sentinel **también** dentro del `$defs`
      recursivo que representa `children` — verificable con al menos una aserción sobre el
      fragmento `$defs` que confirma la sustitución sin haber roto los `$ref` internos.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/inject-condition-group-widget-sentinel.test.ts`
  - **Restricciones**:
    - Importar `toJSONSchema`/`buttonNodeSchema`/`sidebarItemSchema` desde
      `src/config/runtime-config-zod.ts` únicamente en los casos de test que validan sobre el
      schema real; los casos sintéticos usan objetos literales inline. Motivo: los casos sintéticos
      documentan la regla; los casos reales protegen contra un cambio futuro del generador de
      schema.
    - No mockear `zod` ni `toJSONSchema`. El transform es puro y el schema real es una entrada
      inmutable del test.

- **Documentación afectada** (para una pasada posterior con `update-app-documentation`; no se
  edita aquí):
  - `ai-workflow/docs/test-index.md`: entrada del nuevo fichero de test bajo `dev-runtime/`.
  - Ninguna ficha de `ai-workflow/docs/app-features/` (el transform no es visible hasta T3/T4).

- **Criterios de finalización**:
  - El transform existe, está tipado y su suite en verde.
  - Ningún consumidor del proyecto lo importa todavía (T3 y T4 conectarán).

- **Cierre de implementación**:
  - Fichero nuevo creado y exportable.
  - Suite `pnpm test --run src/tests/dev-runtime/inject-condition-group-widget-sentinel.test.ts`
    en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80% (regla global).

---

## Task 0132-T2 — Widget `ConditionGroupPropertyField` (presentacional + lógica de forma)

- **ID**: 0132-T2
- **Estado**: pending
- **Objetivo**: Crear el único componente reutilizable que edita la forma condición/grupo de
  `visibility`/`when`. Es una pieza React presentacional con la firma estándar de `WIDGET_REGISTRY`
  (`{ label, value, onChange }`), sin visibilidad sobre ningún fragmento JSON Schema real (el
  sentinel `{ 'x-widget': 'condition-group' }` no contiene información aprovechable — D3 de
  [[design.md]]). Cubre integralmente los criterios de aceptación 1–11 y 13 de la spec sobre su
  contrato observable, sin todavía estar registrado ni consumido por ningún panel.

  Contrato del componente:
  - **Ubicación**: `src/dev-runtime/layout-canvas/property-fields/condition-group-property-field.tsx`.
  - **Firma pública**:
    `{ label: string, value: unknown, onChange: (value: unknown) => void }`.
    Internamente el componente trata `value` como `RuntimeVisibilityConfig | undefined`
    (tipo público reutilizable de `src/config/runtime-config`); cualquier otra forma degrada
    silenciosamente al criterio ya vigente en el panel para datos fuera de contrato (ver "Casos
    límite" de la spec).

  - **Detección de forma inicial**:
    - Si `value` es un objeto plano con `conditions` presente en su forma superior y
      `operator` en `{ 'and', 'or' }`, arranca en modo "Grupo (y/o)".
    - En cualquier otro caso — incluidos `undefined`, `null`, no-objeto, u objeto plano con
      `operator` fuera del catálogo de grupo — arranca en modo "Condición simple". Un `value`
      totalmente ausente arranca con estado por defecto mínimo (ver "Estado por defecto" abajo)
      sin emitir `onChange`.
    - La detección se hace por forma del propio `value`, sin reutilizar `resolveUnionBranch`.

  - **Selector de forma**:
    - Renderizado con `SegmentedTogglePropertyField` (widget compartido, `0128`) con dos segmentos
      ("Condición simple", "Grupo (y/o)").
    - Cambiar de "Condición simple" a "Grupo (y/o)" emite `onChange({ operator: 'and', conditions: [<condición actual>] })` en un único commit; la condición actual se toma tal cual
      del estado en curso (spec, criterio 3).
    - Cambiar de "Grupo (y/o)" a "Condición simple" emite `onChange(<primera condición del grupo>)`
      en un único commit, descartando el resto de filas del grupo si había más de una (spec,
      criterio 4). La primera condición se toma directamente de `conditions[0]`.
    - Idempotencia: reseleccionar el segmento ya activo no emite `onChange` (mismo criterio que
      el resto de widgets de segmentos).

  - **Modo "Condición simple"**: renderiza una única instancia del sub-componente de fila de
    condición (ver más abajo). Cualquier cambio del sub-componente se propaga tal cual como
    `onChange(<nueva condición>)`.

  - **Modo "Grupo (y/o)"**:
    - Toggle del `operator` del grupo (`and`/`or`) con `SegmentedTogglePropertyField`. Cambiar el
      segmento emite `onChange({ ...value, operator: <'and'|'or'> })`.
    - Lista de filas: una por elemento de `conditions`. Cada fila monta el sub-componente de fila
      de condición con el `value` de esa condición.
    - Botón "Añadir" al final de la lista: emite `onChange({ ...value, conditions: [...conditions, <condición por defecto mínima>] })` (ver "Estado por defecto" abajo).
    - Botón "Quitar" por fila: emite `onChange({ ...value, conditions: conditions.filter((_, i) => i !== rowIndex) })`. Deshabilitado (atributo `disabled`, no oculto) cuando
      `conditions.length === 1` (spec, criterio 5), etiqueta accesible clara ("Quitar condición").
    - Sin límite superior de N.

  - **Sub-componente de fila de condición** (usado tanto en "Condición simple" como en cada fila
    de un grupo): componente interno privado del módulo, contrato local
    `{ value: <condición>, onChange: (next: <condición>) => void, canRemove: boolean, onRemove?: () => void }`. Renderiza en orden:
    - `TextPropertyField` para `reference` (siempre visible, sin condicionar por `operator`).
    - `EnumPropertyField` para `operator`, opciones del catálogo completo (`equals | notEquals | isTruthy | isFalsy | greaterThan | lessThan | arrayContains`).
    - Si `operator === 'arrayContains'`: `TextPropertyField` para `itemField` (opcional, cadena
      vacía por defecto interna del campo si `itemField` está ausente en `value`).
    - Si `operator ∈ { 'equals', 'notEquals', 'arrayContains' }`: sub-editor de `value` con
      selector de tipo (ver "Editor de `value`" abajo).
    - Si `operator ∈ { 'greaterThan', 'lessThan' }`: `NumberPropertyField` para `value`.
    - Si `operator ∈ { 'isTruthy', 'isFalsy' }`: no se renderiza ningún control para `value`.
    - `BooleanPropertyField` para `negate` (siempre visible).
    - Botón "Quitar condición" cuando `canRemove` sea `true` (sólo en modo grupo con
      `conditions.length > 1`).

  - **Reconciliación al cambiar `operator`** (spec, "Reconstrucción al cambiar de operador";
    criterio 11):
    - A `isTruthy`/`isFalsy`: elimina `value` (queda ausente, no `undefined` explícito) e
      `itemField` si estaba.
    - Desde cualquier operador distinto de `arrayContains` a `arrayContains`: si `value` no es
      ya `string | number | boolean | null`, lo reconstruye a `''`; `itemField` sigue ausente
      hasta que el usuario lo rellene.
    - Desde `arrayContains` a cualquier otro operador: elimina `itemField` si estaba.
    - A `greaterThan`/`lessThan` con `value` no numérico: reconstruye `value` a `0`.
    - Entre `equals`/`notEquals`/`arrayContains` entre sí: preserva `value` tal cual (los tres
      admiten los mismos cuatro tipos).
    - Emite un único `onChange` con la condición reconstruida.

  - **Editor de `value` con selector de tipo** (para `equals`/`notEquals`/`arrayContains`):
    - Selector de tipo con `SegmentedTogglePropertyField`, cuatro opciones ("Texto", "Número",
      "Booleano", "Null"), en ese orden.
    - Detección del tipo activo a partir del tipo JS del `value` actual:
      `typeof value === 'string'` → Texto; `typeof value === 'number'` → Número;
      `typeof value === 'boolean'` → Booleano; `value === null` → Null. Cualquier otro caso
      (por ejemplo `undefined`, un objeto o un array, spec "Casos límite") degrada a Texto sin
      convertir el valor previo, y ofrece un input de texto vacío o con la representación de
      texto del valor original — mismo criterio que ya usa el fallback genérico del panel para
      datos fuera de contrato.
    - Cambiar el tipo reconstruye `value` con un valor por defecto de ese tipo (`''`, `0`,
      `false`, `null`); **no** intenta convertir el valor anterior entre tipos.
    - Control de valor según el tipo activo:
      - Texto: `TextPropertyField`.
      - Número: `NumberPropertyField`.
      - Booleano: `BooleanPropertyField`.
      - Null: no se renderiza ningún control adicional; el valor es `null` fijo mientras el tipo
        activo sea Null.

  - **Editor de `value` para `greaterThan`/`lessThan`**: `NumberPropertyField` simple, sin
    selector de tipo (spec, criterio 10). Detección tolerante del valor inicial:
    `typeof value === 'number'` se muestra tal cual; cualquier otro caso se muestra como `0` en
    la UI sin emitir `onChange` (queda listo para que el próximo commit válido normalice).

  - **Estado por defecto (para "Añadir condición" y transiciones)**:
    - Condición por defecto mínima: `{ reference: '', operator: 'equals', value: '' }`. Se usa al
      pulsar "Añadir" en un grupo y como estado inicial cuando `value === undefined` (sin emitir
      `onChange` en este último caso hasta que el usuario edite un campo).
    - Grupo por defecto (al pasar de "Condición simple" a "Grupo (y/o)"):
      `{ operator: 'and', conditions: [<condición actual>] }`.

  - **Accesibilidad**:
    - Selector de forma, selector de operador del grupo y selector de tipo de `value` reutilizan la
      semántica ARIA del `SegmentedTogglePropertyField` ya existente (`radiogroup`/`radio`,
      roving tabindex, navegación con flechas). El `operator` de fila se edita con
      `EnumPropertyField` (mismo componente ya usado para el modo de `menuItem`/`sidebarItem`),
      operable por teclado.
    - Etiquetas accesibles de cada control derivan de `label` (por ejemplo `${label} — Forma`,
      `${label} — Operador del grupo`, `${label} — Condición 1 — Referencia`), consistente con el
      patrón ya vigente en `MenuItemFieldsEditor`/`SidebarItemFieldsEditor`.

  - **Estilo**: utilidades `Tailwind` locales; no introducir tokens visuales nuevos. Alineado con
    el resto de widgets del panel (borde punteado, `fieldset`/`legend` cuando aplique).

- **Fuera de alcance**:
  - Registro del widget en `WIDGET_REGISTRY` y aplicación del transform en los getters cacheados
    (T3 y T4).
  - Cualquier cambio en `resolveUnionBranch`, `PropertyFieldDispatcher`,
    `layout-canvas-properties-panel.tsx`, `MenuItemFieldsEditor`, `SidebarItemFieldsEditor` o
    `ShellConfigPanel`.
  - Cambios en el schema Zod o en `validateRuntimeConfig`.
  - Feedback de commit rechazado dentro del componente (`role="alert"`): el widget no gestiona
    `pendingRejections`; delega en el pipeline del panel envolvente (mismo criterio que
    `IconPickerPropertyField`, `0129`).
  - Picker contextual o autocompletado para `reference` (spec, "Fuera de alcance": sigue como
    texto libre).
  - Anidamiento de grupos dentro de grupos (spec, "Fuera de alcance").

- **Dependencias**: ninguna previa dentro de esta feature. Depende de los componentes ya
  existentes bajo `src/dev-runtime/layout-canvas/property-fields/`
  (`SegmentedTogglePropertyField`, `TextPropertyField`, `NumberPropertyField`,
  `BooleanPropertyField`, `EnumPropertyField`) y del tipo público
  `RuntimeVisibilityConfig` en `src/config/runtime-config`.

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/condition-group-property-field.tsx` (nuevo:
      exporta `ConditionGroupPropertyField`).
  - Tests:
    - `src/tests/dev-runtime/condition-group-property-field.test.tsx` (nuevo).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: entrada del nuevo fichero de test bajo `dev-runtime/`.
    - Ninguna ficha de `ai-workflow/docs/app-features/` (el widget no es visible hasta T3/T4).

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/condition-group-property-field.test.tsx` (nuevo).
  - **Comportamiento cubierto**:
    - **Detección de forma inicial y selector**:
      - Con `value = { reference: 'params.userId', operator: 'equals', value: 'x' }`, el selector
        de forma muestra "Condición simple" activo y los campos de esa condición son visibles
        (spec, criterio 1).
      - Con `value = { operator: 'and', conditions: [ /* dos condiciones */ ] }`, el selector
        muestra "Grupo (y/o)" activo, el toggle `and`/`or` con `and` activo, y dos filas de
        condición renderizadas (spec, criterio 2).
      - Con `value = undefined`, arranca en "Condición simple" con la condición por defecto
        mínima visible; `onChange` no se ha llamado todavía (verificable con `vi.fn()`).
      - Reseleccionar el segmento activo del selector de forma no llama a `onChange`.
    - **Transiciones de forma**:
      - Con `value` de forma condición simple y `reference = 'params.a'`,
        `operator = 'equals'`, `value = 'x'`, `negate = true`, pulsar "Grupo (y/o)" llama a
        `onChange` una única vez con `{ operator: 'and', conditions: [{ reference: 'params.a', operator: 'equals', value: 'x', negate: true }] }` (spec, criterio 3, con `negate` incluido en
        el traspaso).
      - Con `value` de forma grupo `or` de tres condiciones `[c1, c2, c3]`, pulsar "Condición
        simple" llama a `onChange` una única vez con `c1` tal cual (spec, criterio 4).
    - **Grupo (y/o) — controles**:
      - Toggle del grupo con `operator = 'and'`, click en "or" llama a `onChange` con
        `{ ...value, operator: 'or' }`; idempotencia sobre "and".
      - En un grupo con `conditions.length === 1`, el botón "Quitar" de esa fila tiene atributo
        `disabled` y su click no llama a `onChange` (spec, criterio 5).
      - En un grupo con `conditions.length === 2`, ambos botones "Quitar" están habilitados;
        pulsar el de la segunda fila llama a `onChange` con `{ ...value, conditions: [c1] }`.
      - Pulsar "Añadir" en un grupo llama a `onChange` con `{ ...value, conditions: [...prev, { reference: '', operator: 'equals', value: '' }] }` (spec, criterio 6, condición por defecto
        mínima).
    - **Campos condicionales por `operator` (en fila top-level y en fila de grupo)**:
      - Con `operator = 'arrayContains'`, `itemField` es visible y editable (`getByRole('textbox', { name: /itemField/i })` o análogo por label estable); con `operator ∈ { 'equals', 'notEquals', 'isTruthy', 'isFalsy', 'greaterThan', 'lessThan' }`, `itemField` no está en el DOM
        (`queryByRole` devuelve `null`). Ejercitar al menos dos operadores en cada rama (spec,
        criterios 7 y 8).
      - Con `operator ∈ { 'isTruthy', 'isFalsy' }`, el editor de `value` no está en el DOM
        (aserción negativa por ausencia del selector de tipo y del input numérico simple).
    - **Editor de `value` con selector de tipo**:
      - Con `operator = 'equals'` y `value = 'x'`, el selector de tipo tiene "Texto" activo y se
        muestra un input de texto con `'x'` (spec, criterio 9).
      - Con `operator = 'equals'` y `value = 3`, "Número" activo y `NumberPropertyField` con `3`.
      - Con `operator = 'equals'` y `value = true`, "Booleano" activo y `BooleanPropertyField`
        con `true`.
      - Con `operator = 'equals'` y `value = null`, "Null" activo y **ningún** control adicional
        para `value` en el DOM (aserción negativa por ausencia de input).
      - Cambiar el selector de tipo de "Texto" a "Número" llama a `onChange` con la condición
        completa donde `value = 0`; de "Texto" a "Booleano" con `value = false`; de "Texto" a
        "Null" con `value = null`. Cambiar de "Número" a "Texto" con `value = ''`.
      - Cambiar el selector de tipo al ya activo no llama a `onChange`.
    - **Editor numérico simple** (`greaterThan`/`lessThan`):
      - Con `operator = 'greaterThan'` y `value = 42`, el selector de tipo **no** está en el DOM
        (aserción negativa); un `NumberPropertyField` renderiza `42` (spec, criterio 10).
      - Cambiar el valor del input llama a `onChange` con la condición donde `value` es el nuevo
        número.
    - **Reconciliación al cambiar de operador** (spec, "Reconstrucción al cambiar de operador",
      criterio 11):
      - Con `{ reference: 'r', operator: 'equals', value: 'x' }`, cambiar `operator` a
        `isTruthy` llama a `onChange` con `{ reference: 'r', operator: 'isTruthy' }` (`value`
        ausente).
      - Con `{ reference: 'r', operator: 'equals', value: 'x' }`, cambiar `operator` a
        `greaterThan` llama a `onChange` con `{ reference: 'r', operator: 'greaterThan', value: 0 }`.
      - Con `{ reference: 'r', operator: 'greaterThan', value: 5 }`, cambiar `operator` a
        `lessThan` preserva `value = 5` (numérico ya compatible).
      - Con `{ reference: 'r', operator: 'arrayContains', value: 'x', itemField: 'code' }`,
        cambiar `operator` a `equals` llama a `onChange` con `{ reference: 'r', operator: 'equals', value: 'x' }` (`itemField` retirado).
      - Con `{ reference: 'r', operator: 'equals', value: 'x' }`, cambiar `operator` a
        `arrayContains` llama a `onChange` con `{ reference: 'r', operator: 'arrayContains', value: 'x' }` (`value` preservado; `itemField` sigue ausente hasta que el usuario lo rellene).
      - Entre `equals`/`notEquals`/`arrayContains`: cambiar de `equals` a `notEquals` con
        `value = true` preserva `value = true` (mismo tipo válido para los tres).
    - **Casos límite tomados de la spec**:
      - `value` ausente (`undefined`): arranca en "Condición simple" con la condición por defecto
        visible; ningún `onChange` hasta el primer commit del usuario.
      - `value` con `operator: 'isTruthy'` y `value: 'x'` presente (config editado a mano fuera
        de contrato): la fila renderiza sin control para `value` (mismo comportamiento que un
        `isTruthy` limpio); un cambio posterior del usuario que dispare `onChange` no
        reintroduce `value` en la condición.
      - `value` con `operator: 'equals'` y `value: { anidado: true }` (objeto fuera del contrato
        escalar): el selector de tipo cae a "Texto" (degradación silenciosa) sin lanzar error;
        el input de texto renderiza sin bloquear el panel; un cambio posterior del usuario
        sobreescribe el valor con un string (comportamiento de degradación descrito en spec).
    - **Regresión de `label` accesible**: verificar que el `label` recibido aparece en al menos
      uno de los grupos accesibles renderizados (por ejemplo, `getByRole('group', { name: /<label>/i })` o análogo aplicable a `SegmentedTogglePropertyField`), para asegurar que el
      componente no lo descarta.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/condition-group-property-field.test.tsx`
  - **Restricciones**:
    - No mockear ningún componente ya existente bajo
      `src/dev-runtime/layout-canvas/property-fields/`; el widget debe ejercerse con sus
      dependencias reales (`SegmentedTogglePropertyField`, `TextPropertyField`,
      `NumberPropertyField`, `BooleanPropertyField`, `EnumPropertyField`).
    - No mockear `validateRuntimeConfig` ni el pipeline de commit: este fichero prueba únicamente
      el contrato observable `{ value, onChange }` del widget. La integración end-to-end vive en
      T3/T4.
    - Reutilizar las utilidades ya vigentes en `src/tests/dev-runtime/`
      (`@testing-library/react`, `userEvent` o `fireEvent` según el patrón local); no introducir
      un harness paralelo.

- **Documentación afectada** (para `update-app-documentation`; no se edita aquí):
  - `ai-workflow/docs/test-index.md`: entrada del nuevo fichero de test bajo `dev-runtime/`.
  - Ninguna ficha de `ai-workflow/docs/app-features/` (el widget no es visible hasta T3/T4).

- **Criterios de finalización**:
  - El componente existe, está tipado y su suite en verde.
  - Ningún consumidor del proyecto lo importa todavía (T3 y T4 conectarán).
  - Los criterios de aceptación 1–11 y 13 quedan cubiertos por tests aislados del widget (13 en
    el sentido de "el widget no revierte el valor introducido"; el aviso `role="alert"` real vive
    en T3/T4).

- **Cierre de implementación**:
  - Fichero nuevo creado y exportable.
  - Suite `pnpm test --run src/tests/dev-runtime/condition-group-property-field.test.tsx` en
    verde.
  - `pnpm test` completo en verde y cobertura ≥ 80% (regla global).

---

## Task 0132-T3 — Registro `x-widget: 'condition-group'` y aplicación del transform en `Layout`

- **ID**: 0132-T3
- **Estado**: pending
- **Objetivo**: Conectar T1 y T2 al panel de propiedades de `Layout`, cerrando dos de las tres
  superficies de integración (`node.visibility` de cualquier nodo y `when` de acciones —
  `executeOperations.operations[].when`, `onSuccess[].when`, `onError[].when` en
  `button.props.action`/`link.props.action`/`form.submitAction`).

  Concretamente:
  1. Añadir la entrada `WIDGET_REGISTRY['condition-group'] = ConditionGroupPropertyField` en
     `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`, con el import
     correspondiente. No se toca `resolveUnionBranch` ni el orden de resolución del dispatcher
     (D1 de [[design.md]]).
  2. Aplicar `injectConditionGroupWidgetSentinel` (T1) sobre el resultado de `toJSONSchema(...)`
     dentro de `getNodeTypeJsonSchema` en
     `src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts`, **antes** de cachear (una sola
     invocación por tipo de nodo, en el mismo camino frío de la caché). Con este cambio, tanto
     `node.visibility` (raíz del schema del nodo) como cada `when` que aparezca dentro de las 7
     variantes de acción (dentro de `props.action.oneOf[i]`) y dentro de
     `executeOperations.operations[]` reciben el sentinel automáticamente por el recorrido
     recursivo del transform. No se añade ni se retira ningún adaptador por-tipo en
     `layout-canvas-properties-panel.tsx`.

  Con este cambio:
  - La subsección `Visibilidad` del panel monta el widget en lugar del editor genérico previo
    para cualquier nodo del catálogo.
  - Cada entrada de `executeOperations.operations`, de `onSuccess`/`onError` de
    `button.props.action`/`link.props.action`/`form.submitAction` que declare `when` monta el
    widget en la subsección `Props` (o dentro del bloque `submitAction` de `form`, gestionado
    aparte pero por el mismo dispatcher).

  Nota sobre `label` visible: el `label` que llega al widget desde el dispatcher es el nombre
  técnico del campo (`visibility`, `when`, o el label sintético de una entrada de array como
  `Visibilidad #1`), tal como ya ocurre con el resto de widgets del registro. La legend humana es
  detalle de implementación del propio widget (T2, ya cubierto).

- **Fuera de alcance**:
  - Integración en `ShellConfigPanel` (T4).
  - Cambios en el schema Zod, en `validateRuntimeConfig` o en el schema de Monaco
    (`dev-runtime-json-schema.ts`).
  - Cambios en `resolveUnionBranch` u otros helpers de `property-field-schema-resolution.ts`.
  - Cambios en `resolveTabsPropsSchema`/`resolveHeadingPropsSchema`/`resolveContainerPropsSchema`/
    `resolveChoiceLikePropsSchema`/`resolveIconPropsSchema`/`resolveLayoutSubsectionSchema`.
  - Cambios en `buildDefaultNodeInstance` o en la paleta de nodos.

- **Dependencias**: T1 (`injectConditionGroupWidgetSentinel`) y T2 (`ConditionGroupPropertyField`).

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx` (modificar:
      import de `ConditionGroupPropertyField` y entrada `'condition-group'` en
      `WIDGET_REGISTRY`).
    - `src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts` (modificar: import del
      transform y aplicación única antes de cachear en `getNodeTypeJsonSchema`).
  - Tests:
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación:
      caso nuevo que verifica que un schema `{ 'x-widget': 'condition-group' }` monta
      `ConditionGroupPropertyField`, y regresión negativa de que sin `x-widget` el flujo
      genérico sigue como estaba).
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación: al menos
      dos casos aislados — un nodo cualquiera con `visibility` declarada monta el widget en
      la subsección `Visibilidad`; un `button` con `props.action.type = 'executeOperations'`
      cuya `operations[0].when` está declarada monta el widget dentro de la subsección `Props`
      en la posición correspondiente).
    - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
      (ampliación: cobertura end-to-end sobre el pipeline real (`validateRuntimeConfig` +
      `patchRootKey`) que cubre los criterios 12 (parcialmente: dos de las tres superficies) y
      13 y 14 de la spec — ver `Comportamiento cubierto` abajo).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: ampliación de las líneas de los tres ficheros de test
      afectados bajo `dev-runtime/`.
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección del panel de
      propiedades — la edición de `node.visibility` y de `when` de acciones pasa al widget
      dedicado con selector explícito de forma, ocultación de campos irrelevantes por
      `operator` y editor de `value` por tipo.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
      (ampliación).
  - **Comportamiento cubierto** (dispatcher, ampliación):
    - Un schema `{ 'x-widget': 'condition-group' }` monta `ConditionGroupPropertyField` con el
      `value`/`onChange` proporcionados; ninguna de las ramas genéricas del dispatcher (`enum`,
      primitive types, object) se ejerce (regresión negativa por ausencia de sus controles
      característicos).
    - Regresión: un schema `oneOf` de dos ramas sin `x-widget` sigue pasando por
      `resolveUnionBranch` (comportamiento previo intacto — un caso puntual basta si no está ya
      cubierto).
  - **Comportamiento cubierto** (panel de propiedades, ampliación):
    - Seleccionar un nodo con `visibility` de forma condición simple monta el widget en la
      subsección `Visibilidad`; el input de texto genérico previo para los campos de la condición
      **no** aparece por separado — el widget consume esa subsección entera (regresión negativa
      por ausencia del label técnico `reference` en un `TextPropertyField` propio de la subsección
      `Visibilidad`).
    - Seleccionar el mismo nodo con `visibility` de forma grupo `and` de dos condiciones renderiza
      el widget en modo grupo con dos filas.
    - Seleccionar un `button` con
      `props.action = { type: 'executeOperations', operations: [{ operationName: 'x', when: <condición> }] }` renderiza el widget dentro de la subsección `Props` en el punto donde antes
      aparecía el editor genérico de `when`; el resto de campos de la operación (`operationName`,
      etc.) siguen editándose con los controles genéricos.
    - Regresión: para un nodo sin `visibility` declarada, la subsección `Visibilidad` sigue
      apareciendo (con el widget en modo condición simple con estado por defecto mínimo) — el
      widget arranca sin necesidad de datos previos (spec, casos límite).
    - Regresión: el resto de subsecciones (`Props` no-`when`, `Layout`, `Estado de consulta`)
      siguen editándose exactamente igual que antes de esta feature — reutilizar aserciones ya
      presentes.
  - **Comportamiento cubierto** (end-to-end commit-feedback, ampliación):
    - **Criterio 12 (parcial: `Layout`)**: seleccionar un `button` con `visibility` declarada como
      condición simple → el widget renderiza con selector de forma "Condición simple" activo.
      Pulsar "Grupo (y/o)" desde el widget dispara el pipeline real y el config resultante contiene
      `visibility = { operator: 'and', conditions: [<condición previa>] }`; el buffer de Monaco
      queda sincronizado.
    - **Criterio 12 (parcial: `when` de acción)**: mismo criterio para `when` dentro de una
      entrada de `executeOperations.operations` de un `button` con
      `props.action.type = 'executeOperations'` — cambiar la forma, cambiar el `operator`, cambiar
      el tipo de `value` (por ejemplo, elegir "Número" cuando el `value` era `''`) recorre el
      pipeline real y el config resultante contiene el `when` con el shape esperado; el resto de
      claves de la operación se preservan.
    - **Criterio 13**: simular un rechazo puntual del commit — misma vía que el resto del fichero
      (mockeando `validateRuntimeConfig` para devolver un rechazo con código/mensaje puntual) —
      con un cambio del widget (por ejemplo, elegir `operator: 'greaterThan'` con `value: 0` en un
      contexto donde el schema Zod real lo rechaza). El widget conserva visualmente el valor
      intentado (la fila sigue mostrando `greaterThan` seleccionado con `value: 0`), aparece un
      `role="alert"` bajo la subsección `Visibilidad` con `error.code`/`error.message`, y el buffer
      de Monaco queda sin cambios. Un commit válido posterior o un cambio de nodo seleccionado
      limpia el aviso.
    - **Criterio 14 (regresión no funcional)**: verificar que el schema real de un nodo
      representativo (por ejemplo `container` o `button`) obtenido de `getNodeTypeJsonSchema(type)`
      contiene el sentinel en `properties.visibility` deep-equal a `{ 'x-widget': 'condition-group' }` y — cuando el nodo lo admite — también en las rutas de `when` dentro de
      `props.action.oneOf[i].properties.operations.items.properties.when` (formalmente; el path
      exacto puede variar según el generador de schema). Aserción puntual sobre la caché del
      getter (`getNodeTypeJsonSchema` con dos llamadas seguidas devuelve la misma referencia; el
      transform se aplica una vez).
    - **Regresión (no funcional del runtime)**: renderizar el mismo config con la propia
      infraestructura de renderer ya presente en la suite (si el fichero la usa) comprueba que la
      resolución en modo Visual no cambia — el widget no altera el runtime. Sólo añadir si el
      fichero ya monta un runtime real; si no lo hace, dejarlo para T4 o descartarlo (el criterio
      14 queda cubierto por el hecho de que ninguna tarea toca `src/runtime/` ni `src/config/`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
  - **Restricciones**:
    - No mockear `ConditionGroupPropertyField`: los tests deben ejercer el componente real (T2)
      para probar el contrato observable end-to-end (selector de forma visible, campos
      condicionales, editor de `value` por tipo).
    - No mockear `injectConditionGroupWidgetSentinel`: los tests deben ejercer el transform real
      (T1) sobre los schemas reales generados por `getNodeTypeJsonSchema`.
    - Reutilizar los harness ya vigentes en cada fichero (fixtures de nodo, `DevRuntimeReady` o
      equivalente, `vi.fn()` para `onCommitNodeUpdate` en los tests aislados del panel, pipeline
      real para el fichero de commit-feedback). No introducir un harness paralelo.
    - Ninguna aserción debe depender de que el pipeline haya rechazado un cambio sin motivo real:
      el criterio 13 se prueba mockeando puntualmente el rechazo, mismo patrón exacto que el
      resto del fichero (por ejemplo, `pendingRejections` sobre la subsección `visibility`).

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección del panel de
    propiedades — nueva UX para `node.visibility` y para `when` de acciones (selector de forma,
    campos condicionales, editor de `value` por tipo). Nota sobre la degradación silenciosa para
    condiciones fuera de contrato (spec, casos límite).
  - `ai-workflow/docs/test-index.md`: ampliación de las líneas de los tres ficheros de test
    afectados bajo `dev-runtime/`.

- **Criterios de finalización**:
  - Los criterios de aceptación 1–11, 13 y 14 quedan cubiertos por el conjunto de tests aislados
    y por el bloque end-to-end sobre el pipeline real para `Layout`.
  - El criterio 12 queda cubierto de forma parcial (dos de las tres superficies); la tercera se
    cierra en T4.

- **Cierre de implementación**:
  - Los tres ficheros de test afectados están en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80% (regla global).

---

## Task 0132-T4 — Aplicación del transform en `Shell` (menú del header y sidebar)

- **ID**: 0132-T4
- **Estado**: pending
- **Objetivo**: Cerrar la tercera superficie de integración aplicando el transform de T1 sobre los
  getters de `src/dev-runtime/shell-config-panel/shell-config-panel-schema.ts` cuyos schemas
  contienen `visibility`, para que `MenuItemFieldsEditor` y `SidebarItemFieldsEditor` (ya
  enrutados a `PropertyFieldDispatcher` + `resolveUnionBranch(visibilitySchema, item.visibility)`)
  monten automáticamente el widget de T2 sin cambios en su propio código, gracias al hook
  `x-widget` ya registrado en T3.

  Concretamente:
  1. Aplicar `injectConditionGroupWidgetSentinel` (T1) sobre el resultado de `toJSONSchema(...)`
     antes de cachear en `getMenuItemJsonSchema` y en `getSidebarItemJsonSchema` de
     `src/dev-runtime/shell-config-panel/shell-config-panel-schema.ts` (dos invocaciones, una por
     getter, cada una en su camino frío de caché).
  2. **Verificación previa** durante la implementación: comprobar si el schema generado por
     `getShellHeaderJsonSchema` y `getShellSidebarJsonSchema` contiene `visibility` sin resolver
     — es decir, si `toJSONSchema(shellHeaderSchema)`/`toJSONSchema(shellSidebarSchema)` inlinea
     el shape de `menuItem`/`sidebarItem` en vez de referenciarlo. Si lo hace, aplicar también el
     transform en esos dos getters (D2 de [[design.md]]; señalado ahí como "a confirmar en
     planificación contra el schema real, sin bloquear este design"). Si no lo hace (los editores
     de `Shell` solo consumen `getMenuItemJsonSchema`/`getSidebarItemJsonSchema` directamente y
     el `header.menu`/`sidebar.items` no vuelve a rehidratarse desde `getShellHeader...`/
     `getShellSidebar...`), documentar la comprobación con un comentario breve en el fichero y no
     envolver esos getters. El resultado de esta comprobación se refleja en la lista de
     `Impacto esperado en archivos` de esta tarea al ejecutarla (dos ficheros de código si no hace
     falta ampliar los otros dos getters; uno solo si sí).
  3. Verificar en el propio cambio si el import de `resolveUnionBranch` en
     `MenuItemFieldsEditor` y `SidebarItemFieldsEditor` queda sin uso tras la sustitución.
     `resolveUnionBranch` sobre `{ 'x-widget': 'condition-group' }` devuelve el schema sin tocar
     (por D1 de [[design.md]]), así que la llamada actual sigue siendo válida y no rompe nada;
     retirar el import sólo si TypeScript lo señala como sin uso o si el linter así lo pide.
     No es un objetivo forzado de esta tarea.

  Ninguno de los dos editores se modifica en su lógica: la conexión ya existe (ambos pasan por el
  dispatcher) y esta tarea sólo cambia el schema que reciben, para que el dispatcher active la
  rama `x-widget`.

- **Fuera de alcance**:
  - Cambios en `WIDGET_REGISTRY` (ya hecho en T3).
  - Cambios en `MenuItemFieldsEditor`/`SidebarItemFieldsEditor` fuera de una posible retirada de
    imports sin uso (ver objetivo, punto 3).
  - Cambios en `ShellConfigPanel` fuera de estos dos editores.
  - Cambios en la conexión de arrastre (`shell-config-panel-dnd.tsx`), en el colapso de filas o
    en la gestión de árbol.
  - Cambios en el schema Zod o en `validate-shell.ts`.

- **Dependencias**: T1 (transform) y T3 (registro del widget). Independiente en su código de T2 y
  T3 más allá de la existencia del registro; en tests, depende de que T3 haya dejado el widget
  disponible desde el dispatcher.

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/shell-config-panel/shell-config-panel-schema.ts` (modificar: import del
      transform; aplicación única antes de cachear en `getMenuItemJsonSchema` y
      `getSidebarItemJsonSchema`; y, condicionalmente según la comprobación del objetivo punto
      2, también en `getShellHeaderJsonSchema`/`getShellSidebarJsonSchema`).
    - Opcionalmente, `src/dev-runtime/shell-config-panel/menu-item-fields-editor.tsx` y
      `src/dev-runtime/shell-config-panel/sidebar-item-fields-editor.tsx` si TypeScript marca
      `resolveUnionBranch` como import sin uso (ver objetivo, punto 3).
  - Tests:
    - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación: expandir la fila de un
      `menuItem` raíz con `visibility` declarada monta el widget; y un `menuItemChild` dentro de un
      padre en modo "Con desplegable" con `visibility` declarada también monta el widget; regresión
      negativa del editor genérico previo).
    - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación: expandir la fila de
      un `sidebarItem` raíz con `visibility` declarada monta el widget; y un `sidebarItem`
      anidado a profundidad ≥ 2 con `visibility` declarada también monta el widget — cobertura
      explícita del riesgo señalado en `design.md`, "Riesgos y trade-offs").
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación: al menos un caso end-to-end
      contra el pipeline real que confirma que cambiar la forma de `visibility` de un `menuItem` o
      de un `sidebarItem` desde el widget recorre `validateRuntimeConfig + patchRootKey` y persiste
      el nuevo shape en `shell.header.menu[i].visibility` o
      `shell.sidebar.items[i].children[j].visibility`, sin tocar `layout`/`api`/`initialPage`/
      `tokens`).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: ampliación de las líneas de los tres ficheros de test
      afectados bajo `dev-runtime/`.
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección "Shell (dominio de
      configuración)" — el campo `visibility` de `menuItem` y `sidebarItem` (a cualquier
      profundidad) se edita con el mismo widget del panel de propiedades del canvas.
    - `ai-workflow/docs/app-features/shell/header.md`: nota breve — el campo `visibility` de
      `menuItem` se edita con el widget compartido de condición/grupo en el editor visual, sin
      cambios de contrato.
    - `ai-workflow/docs/app-features/shell/sidebar.md`: análogo para `sidebarItem` a cualquier
      profundidad.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación).
    - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación).
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación).
  - **Comportamiento cubierto** (menú del header, ampliación):
    - Expandir la fila de un `menuItem` raíz con
      `visibility = { reference: 'params.userId', operator: 'equals', value: 'admin' }` monta el
      widget con selector de forma "Condición simple" activo y los campos de la condición
      visibles. Regresión negativa: no aparece un `TextPropertyField` propio de la subsección de
      `visibility` con el label técnico `reference` fuera del widget (el widget consume la
      subsección entera).
    - Expandir la fila de un `menuItemChild` (dentro de un padre en modo "Con desplegable") con
      `visibility` de forma grupo `or` de dos condiciones monta el widget con el toggle `or`
      activo y dos filas — verifica que el sentinel llega también dentro del schema del
      `menuItem` cuando se anida (aunque `menuItemChild` no tenga `children` propios, la fila
      hija reutiliza el mismo `MenuItemFieldsEditor`).
    - Elegir "Grupo (y/o)" desde el widget en la fila de un `menuItem` con `visibility` de forma
      condición simple invoca el `onChange` del editor con el `menuItem` actualizado
      (`visibility = { operator: 'and', conditions: [<condición previa>] }`), sin tocar el resto
      de campos del item.
  - **Comportamiento cubierto** (sidebar, ampliación):
    - Expandir la fila de un `sidebarItem` raíz con `visibility` declarada monta el widget con el
      selector de forma en el modo correspondiente a la forma de esa `visibility`.
    - **Riesgo señalado en `design.md`**: expandir la fila de un `sidebarItem` anidado a
      profundidad ≥ 2 (dentro de `children` → `children`) con `visibility` declarada monta el
      widget correctamente. Verifica que el transform ha alcanzado el `visibility` a través del
      `$defs` recursivo del schema generado — regresión del caso descrito en design como no
      ejercitado hoy por ningún `x-widget` existente.
    - Elegir un cambio de forma o de operador en cualquiera de esas dos filas invoca el
      `onChange` del editor con la mutación correcta a la profundidad correspondiente.
  - **Comportamiento cubierto** (`shell-config-panel.test.tsx`, ampliación):
    - Cambiar la forma de `visibility` de un `menuItem` a "Grupo (y/o)" desde el widget recorre el
      pipeline real (`validateRuntimeConfig + patchRootKey`) y el config resultante contiene
      `shell.header.menu[i].visibility = { operator: 'and', conditions: [<condición previa>] }`,
      sin tocar el resto de campos del menú.
    - Mismo criterio para `visibility` de un `sidebarItem` anidado a profundidad ≥ 2 — cambio de
      operador o de tipo de `value` desde el widget recorre el pipeline real y el config
      resultante contiene la mutación en la ruta `shell.sidebar.items[i].children[j].visibility`
      exacta, sin tocar hermanos.
    - **Regresión (alcance del commit)**: el commit sigue tocando sólo la clave `shell`, sin
      tocar `layout`/`api`/`initialPage`/`tokens` (aserción análoga a las ya presentes en el
      fichero para otras mutaciones de `Shell`).
    - **Regresión (criterio 14 de la spec)**: verificar puntualmente que el schema real generado
      por `getMenuItemJsonSchema()` y por `getSidebarItemJsonSchema()` contiene el sentinel deep-
      equal a `{ 'x-widget': 'condition-group' }` en `properties.visibility`, y — para
      `sidebarItem` — también dentro de la rama recursiva de `$defs.<key>.properties.visibility`
      (no importa el nombre exacto de la clave de `$defs`; una búsqueda estructural puntual basta).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/shell-menu-list-editor.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
  - **Restricciones**:
    - No mockear `ConditionGroupPropertyField` ni `injectConditionGroupWidgetSentinel`: los tests
      deben ejercer los artefactos reales (T1, T2, T3) para probar el contrato observable
      end-to-end.
    - Reutilizar los harness ya vigentes en cada fichero (fixture aislado para las listas,
      pipeline real para `shell-config-panel.test.tsx`); no introducir un harness paralelo.
    - Ninguna aserción debe depender de la existencia previa de un editor genérico para
      `visibility` fuera del widget (esa era la vía anterior; ahora el widget cubre la subsección
      entera). Las regresiones negativas verifican por ausencia del label técnico `reference` en
      un `TextPropertyField` propio de la fila.

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección "Shell (dominio de
    configuración)".
  - `ai-workflow/docs/app-features/shell/header.md`: nota breve sobre la edición de `visibility`
    de `menuItem` en el editor visual.
  - `ai-workflow/docs/app-features/shell/sidebar.md`: nota breve análoga para `sidebarItem` a
    cualquier profundidad.
  - `ai-workflow/docs/test-index.md`: ampliación de las líneas de los tres ficheros de test
    afectados bajo `dev-runtime/`.

- **Criterios de finalización**:
  - Los campos `visibility` de `menuItem` (raíz y `children` de header) y de `sidebarItem` (a
    cualquier profundidad) se editan con el widget compartido en `ShellConfigPanel`.
  - El criterio de aceptación 12 queda cubierto por completo (las tres superficies comparten el
    mismo widget).
  - El criterio 14 (sin regresión de comportamiento en producción o modo Visual) queda cubierto
    por la ausencia de cambios en `src/config/` y `src/runtime/` en todas las tareas de la
    feature, y por la aserción puntual sobre los schemas cacheados (T3 y T4).

- **Cierre de implementación**:
  - Los tres ficheros de test afectados están en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80% (regla global).
