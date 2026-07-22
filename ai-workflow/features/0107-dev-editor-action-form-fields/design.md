# Design: Feature 0107 — Editor de acciones desde el formulario del dev editor

## Contexto

### Situación actual del panel de propiedades
El panel del dev editor (`src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`) genera formularios a partir del schema JSON del nodo seleccionado. El schema se obtiene desde `getNodeTypeJsonSchema` (`layout-canvas-node-schema.ts`), que serializa el esquema Zod del nodo con `toJSONSchema`. El dispatcher genérico (`property-fields/property-field-dispatcher.tsx`) resuelve `string`, `number`, `boolean`, `array`, `object`, `enum` y cae a un textarea de solo lectura (`RawJsonPropertyField`) cuando el schema no se puede representar.

El panel ya resuelve una unión discriminada puntual: para `visibility` y `layout.span` se llama a `resolveUnionBranch`, que elige la rama que matchea el valor actual, pero **no permite cambiar de rama**. No hay hoy soporte de "selector de variante" que reconstruya el valor por defecto al cambiar el discriminador.

### Estado actual del contrato de acciones
`buttonNodeSchema.props.action`, `linkNodeSchema.props.action` y `formNodeSchema.submitAction` están declarados como `z.unknown().optional()` en `src/config/runtime-config-zod.ts`. El shape real de cada acción vive en schemas Zod separados y ya exportados:

- `navigateToButtonActionSchema`
- `goBackButtonActionSchema`
- `executeOperationRuntimeUiActionSchema`
- `executeOperationsRuntimeUiActionSchema` (con `executeOperationsRuntimeUiActionEntrySchema` para cada entrada, incluyendo `when: whenConditionSchema`)
- `resetFormRuntimeUiActionSchema`
- `openModalRuntimeUiActionSchema`
- `closeModalRuntimeUiActionSchema`

`validate-actions-visibility.ts` es hoy la fuente de verdad: recibe `rawAction: unknown`, valida el `type` contra el catálogo cerrado, hace `safeParse` con el schema específico y añade validaciones cruzadas (`pageId` en `pages`, `operationName` en `api`, `GET` sin `body`, etc.). `validate-form-nodes.ts` hace lo equivalente para `form.submitAction`, incluyendo `onSuccess`/`onError`.

### Consecuencia para la UI
Como `props.action` y `submitAction` son `z.unknown()`, `getNodeTypeJsonSchema` no expone al panel el shape interno de estas propiedades. `PropertyFieldDispatcher` cae a `RawJsonPropertyField`, que muestra el fallback de solo lectura. Esa es la razón concreta por la que hoy no se pueden editar desde el formulario, tal y como describe la spec.

## Objetivos / No objetivos

### Objetivos
- Endurecer el shape declarado de `button.props.action`, `link.props.action` y `form.submitAction` en `runtime-config-zod.ts` con uniones discriminadas por `type`, reutilizando los schemas de acción ya existentes.
- Añadir soporte de **discriminated union** (`oneOf` de objetos con literal `type`) al dispatcher genérico del panel, incluyendo un selector de variante que reconstruya el valor por defecto al cambiar de rama.
- Añadir un **editor clave-valor** genérico para pares `string → string`, aplicable a `params`, `query`, `headers` y `body` (caso plano).
- Delegar en el editor de `visibility` ya existente para editar `when` dentro de arrays de acciones y de entradas de `executeOperations.operations`.
- Filtrar el catálogo de variantes de acción por nodo (7 en `button.props.action`, 2 en `link.props.action`, 2 en `form.submitAction` más `onSuccess`/`onError` con las 7).
- Representar explícitamente "Sin acción" como opción del selector para dejar la propiedad `undefined`.

### No objetivos
- No se consolida en esta feature la validación de acciones en un solo sitio; `validate-actions-visibility.ts` y `validate-form-nodes.ts` siguen intactos (siguen siendo la fuente para validaciones cruzadas). La reducción de duplicación queda para una feature posterior.
- No se introducen pickers contextuales (autocompletado de `operationName`, `pageId`, `formId`, `modalId`).
- No se introduce selector de tipo por valor dentro del editor clave-valor: `params`, `query`, `headers` y `body` (caso plano) se editan como texto plano.
- No se añade deshacer/rehacer específico al selector de variante.
- No se toca comportamiento del runtime en tiempo de ejecución.

## Decisiones

### D1. Endurecer `props.action` y `submitAction` en el schema Zod del nodo
Sustituir `z.unknown()` por uniones discriminadas por `type` en `buttonNodeSchema`, `linkNodeSchema` y `formNodeSchema`. Concretamente:

- `buttonNodeSchema.props.action`: `z.discriminatedUnion('type', [navigateTo, goBack, executeOperation, executeOperations, resetForm, openModal, closeModal]).optional()`.
- `linkNodeSchema.props.action`: `z.discriminatedUnion('type', [navigateTo, goBack]).optional()`.
- `formNodeSchema.submitAction`: nuevo `formSubmitActionSchema` = `z.discriminatedUnion('type', [executeOperation, executeOperations]).and(z.object({ onSuccess: z.array(formLifecycleActionEntrySchema).optional(), onError: z.array(formLifecycleActionEntrySchema).optional() }))`. `formLifecycleActionEntrySchema` extiende cada variante de las 7 con `when: whenConditionSchema.optional()`. El shape resultante coincide con lo que hoy exige `validate-form-nodes.ts` para `onSuccess`/`onError`.

**Por qué:** hoy el shape ya se valida en fase posterior con los mismos schemas; endurecerlos en Zod no cambia qué configs se aceptan, solo dónde se rechazan los inválidos. Además desbloquea el panel: `toJSONSchema` ya emite `oneOf` para uniones discriminadas Zod v4, así que el dispatcher recibe el catálogo real sin registro paralelo.

**Alternativa descartada:** mantener `z.unknown()` en el schema del nodo y montar un catálogo de schemas de acción registrado aparte para el dev editor. Descartada porque duplica la fuente de verdad del shape (una en el nodo, otra en el registro) y complica futuras uniones (p.ej. `items` de select). El coste asumido de esta decisión es que un config con `props.action.type` no soportado deja de dar el diagnóstico específico de `validate-actions-visibility.ts` y pasa a dar el error genérico de Zod sobre `discriminatedUnion`; los diagnósticos por variante (referencias cruzadas) siguen intactos.

### D2. Mantener `validate-actions-visibility.ts` y `validate-form-nodes.ts` intactos en esta feature
El endurecimiento del schema no elimina las validaciones cruzadas (pageId/operationName/modalId contra sus catálogos, GET sin body, etc.). Se mantiene toda esa lógica sin cambios. La validación estructural queda duplicada temporalmente entre Zod y esos módulos, pero es un no-op funcional (mismo shape).

**Por qué:** aísla el radio de impacto de esta feature. Reordenar quién rechaza qué es un cambio ortogonal, propio de un ejercicio de deduplicación posterior con su propia superficie de tests.

### D3. Soporte de discriminated union en el dispatcher genérico
Extender `PropertyFieldDispatcher` para reconocer un schema con `oneOf` (o `anyOf`) donde **todas las ramas son objetos con un literal en la misma propiedad** (por convención, `type`). Cuando ese patrón se detecta:

- Renderizar un `EnumPropertyField` con las etiquetas `type` disponibles, más "Sin acción" cuando la propiedad es opcional.
- Renderizar debajo los campos de la rama seleccionada, delegando el sub-schema resuelto al propio dispatcher recursivo.
- Al cambiar de variante, reconstruir el valor por defecto vía `buildDefaultObjectForRequiredFields` sobre la nueva rama y llamar a `onChange` con el resultado.
- Al seleccionar "Sin acción" en una propiedad opcional, llamar a `onChange(undefined)`. El panel ya trata `withSubsection(node, key, undefined)` como no-op en el objeto padre (`{ ...node, key: undefined }`) — se elimina el campo aguas arriba del commit para evitar mantener `undefined` como valor almacenado; se resuelve limpiando `undefined` en el commit del panel (`sanitize` del objeto padre antes de `onCommitNodeUpdate`).

**Por qué:** es el mecanismo genérico que la spec pide ("no introducir un segundo contrato de UI hardcodeado por tipo de nodo"). Es reutilizable por futuras uniones discriminadas (items de `select`/`radioGroup`/`checkboxGroup`, potenciales validations por tipo, etc.).

**Alternativa descartada:** componentes ad-hoc `ActionField`/`SubmitActionField` invocados desde el panel según `node.type`. Descartada porque duplicaría el conocimiento de los shapes de acción y multiplicaría el mantenimiento a cada nueva variante.

### D4. Filtrado del catálogo de variantes por nodo
El catálogo se filtra en origen porque cada schema Zod declara **solo las variantes válidas** para ese nodo: `linkNodeSchema.props.action` incluye únicamente `navigateTo` y `goBack`, y `formSubmitActionSchema` únicamente `executeOperation` y `executeOperations`. El dispatcher solo ve las variantes emitidas por `toJSONSchema` y no necesita lógica de filtrado propia.

**Por qué:** la fuente de verdad es el schema del nodo, no una lista paralela en el dev editor.

### D5. `resolveUnionBranch` vs. nuevo soporte de discriminated union
`resolveUnionBranch` seguirá siendo el helper para uniones **sin selector explícito** (span, visibility): el usuario no elige la rama, se resuelve por el shape del valor actual. El nuevo soporte de discriminated union (D3) aplica cuando **existe un selector explícito** para el usuario, discriminado por un literal común. Ambos coexisten porque resuelven problemas distintos.

Detección del patrón "discriminated union con selector": las ramas del `oneOf` son objetos, todas comparten una propiedad literal en `properties.<discriminator>.const` (o `enum` de un único valor). Se elige `type` como discriminador por convención, coherente con `discriminatedUnion('type', …)` del propio proyecto.

### D6. Editor clave-valor
Añadir `KeyValuePropertyField` en `src/dev-runtime/layout-canvas/property-fields/` para editar objetos `{ [k: string]: string }`. UI: filas con dos inputs de texto (clave, valor) y botón "Quitar" por fila; botón "Añadir" al final. Sin selector de tipo por valor. El nombre de la clave se edita en el propio input; renombrar reordena las claves sobre el objeto (`{ [nuevaClave]: valor, ...resto }`).

Aplica cuando el sub-schema tiene la forma `additionalProperties: { type: 'string' }` con `type: 'object'` y sin `properties` declaradas. Es el shape que `toJSONSchema` emite para `z.record(z.string(), z.string())` en `runtimeApiHeadersSchema`. Para `runtimeApiQuerySchema` (`z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))`) y para `navigateTo.params` (valores `string | number | boolean | null`), el editor sigue tratando el valor como string en la UI y solo el shape declarado del schema decide la validación upstream. En la UI, el editor **no** coacciona tipos: el usuario escribe strings; la coerción a number/boolean se deja fuera de alcance (fuera de alcance explícito en la spec).

Se prefiere aceptar temporalmente valores como string en la UI aunque el schema declare `number | boolean | null`, siempre y cuando el usuario pueda usar interpolación `{{...}}` o referencias dinámicas (que siempre son strings). Cuando el usuario introduce un literal numérico o booleano en un campo tipado, el config no será rechazado por Zod porque el shape declarado por `z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))` acepta strings; el runtime ya tolera strings donde tolera números como interpolaciones. Un riesgo residual (R1) se documenta abajo.

### D7. `body` con excepción JSON libre por clave
Reutilizar `KeyValuePropertyField` para `body` con una regla adicional: si el **valor** de una clave concreta ya es objeto o array (no string primitivo), esa fila se renderiza con `RawJsonPropertyField` en el slot de valor (deshabilitado como hoy — el usuario debe editar esa clave desde Monaco). El resto de claves siguen como par texto/texto. Añadir una nueva clave crea el par con valor de texto vacío.

**Por qué:** cumple la spec ("`body` degrada a edición JSON libre solo en las claves cuyo valor actual sea un array o un objeto") sin bifurcar el editor entero por tipo de clave.

### D8. Reutilizar el editor de `visibility` para `when`
`whenConditionSchema` = `visibilitySchema` en `runtime-config-zod.ts`. El dispatcher ya resuelve `visibility` vía `resolveUnionBranch`. Para `when` dentro de `executeOperations.operations[]` y de `onSuccess`/`onError[]`, el mismo mecanismo aplica automáticamente cuando el dispatcher recorre el sub-schema del ítem.

Riesgo: el mecanismo actual de `resolveUnionBranch` para `visibility` está pensado para la subsección superior del nodo. Ampliarlo a un `visibility`/`when` anidado dentro de un array requiere que el helper se aplique de forma recursiva desde el propio dispatcher, no solo desde el panel. Decisión: mover la resolución de union branches a `PropertyFieldDispatcher` (en la rama de `object` y en la rama de `array`), no solo al panel. Esto también simplifica el panel: la resolución específica de `layout.span` se elimina en favor de la resolución genérica desde el dispatcher.

### D9. Filtro de la variante "Sin acción" solo para propiedades opcionales
El selector añade "Sin acción" solo cuando el schema del padre marca la propiedad como opcional. `props.action` en button/link y `submitAction` en form son todos opcionales, así que las tres cubren el requisito. Esta regla se hace genérica en el dispatcher para no acoplarla a nombres concretos.

Detección: el dispatcher recibe el sub-schema y una indicación de opcionalidad (ya modelada implícitamente por `required: string[]` del padre). Cuando el sub-schema es un discriminated union y no está en el array `required` del padre, se añade "Sin acción". Al elegirla, `onChange(undefined)`.

### D10. Sanitización de `undefined` en el commit del panel
`withSubsection` y las cascadas de `onChange` del dispatcher pueden producir objetos con claves cuyo valor sea `undefined` cuando el usuario elige "Sin acción". Antes del commit, filtrar recursivamente las claves con valor `undefined` en el objeto de la subsección. La utilidad vive en `layout-canvas-properties-panel.tsx` como helper local `stripUndefined` (o similar) y se aplica en el callback de `onChange` justo antes de llamar a `onCommitNodeUpdate`. Es una utilidad pequeña, pertenece al panel, no al dispatcher (el dispatcher no debe conocer la semántica de commit).

## Riesgos y trade-offs

### R1. Coerción de tipos en `query` y `params` (bajo)
El editor clave-valor devuelve strings, pero `runtimeApiQuerySchema` y `params` de `navigateTo` declaran valores `string | number | boolean` (más `null` en `params`). Si el usuario introduce `"42"` desde el editor y el schema espera `number`, Zod puede rechazarlo dependiendo de cómo se serialice. Mitigación: aceptar la limitación (spec la deja explícitamente fuera de alcance) y documentar que valores no string deben editarse desde Monaco. Riesgo residual: el usuario introduce un literal numérico y el config se rechaza. Mitigación futura opcional: soportar un selector de tipo por valor, fuera de esta feature.

**Acción concreta en el design:** verificar en la implementación con un smoke test (config real) que un `params` o `query` no vacío se guarda y valida correctamente cuando el usuario introduce strings simples.

### R2. Diagnósticos de bootstrap distintos (bajo)
Un config con `props.action.type: "foo"` hoy da error específico de `validate-actions-visibility.ts` (`Unsupported action type "foo"` o equivalente). Tras endurecer el schema, el error viene de Zod (`Invalid discriminator value`). Es un cambio cosmético en el error, no en la aceptación del config. Mitigación: aceptable, y el error de Zod sigue apuntando a la ruta exacta. Si en pruebas aparece un diagnóstico regresivo relevante, decidir si añadir un traductor específico en `validation-breadcrumb.ts`.

### R3. `resolveTabsPropsSchema` sigue siendo un caso especial (bajo)
El panel actual usa `resolveTabsPropsSchema` para ocultar `children` del array de items de `tabs`. Esa lógica es ortogonal a esta feature; sigue tal cual. La resolución de discriminated union no la afecta porque `tabs.props.items[]` no es una unión.

### R4. Mover `resolveUnionBranch` al dispatcher (bajo)
Cambia el sitio donde se resuelven `visibility` y `layout.span`. Cubierto por los tests existentes de la panel; hay que ampliarlos para cubrir el caso nuevo de `when` anidado.

### R5. Reconstrucción del valor por defecto al cambiar de variante puede exigir campos que el usuario no rellena (bajo)
`executeOperation` requiere `operationName` no vacío. Al elegir esa variante, el default sería `{ type: 'executeOperation', operationName: '' }`. El config queda inválido hasta que el usuario introduce un `operationName`, pero eso ya es el comportamiento actual del panel para cualquier campo obligatorio inicialmente vacío.

**Corrección post-implementación (detectada durante la planificación de T9):** el párrafo original de este riesgo asumía que "el buffer de Monaco reflejará el string vacío hasta que se corrija". Eso es falso tal y como quedó implementado: `commitCanvasMutation` (`dev-runtime.tsx`) valida el config completo antes de aplicarlo y, si la validación falla, retorna sin llamar a `setCurrentConfig` — el commit rechazado nunca llega a `currentConfig` ni al buffer de Monaco, y el panel (que deriva su valor mostrado directamente de `node`) revertía en silencio a la variante anterior sin ningún indicio visible para el usuario. T9 (`tasks.md`) cierra ese hueco con feedback visible y estado local pendiente en el panel, sin relajar el gate de validación de `commitCanvasMutation`.

### R6. Duplicación transitoria de validación estructural (bajo)
`validate-actions-visibility.ts` y el schema Zod endurecido validarán ambos el shape. Es un no-op funcional, pero hay dos sitios que hay que mantener sincronizados si un shape cambia en el futuro. Trade-off asumido conscientemente para acotar esta feature; su consolidación pertenece a una feature posterior.

## Migración o despliegue

- No hay migración de datos.
- No hay migración de configs guardados: los configs válidos hoy siguen siéndolo. Los configs inválidos hoy siguen siendo inválidos (con el matiz cosmético de R2).
- Sin flags. El cambio se aplica de un solo golpe: el panel pasa de mostrar el fallback a mostrar el editor real en cuanto la unión discriminada llega al dispatcher.
- Los tests del panel y de bootstrap deben ampliarse en la fase de planning para cubrir los nuevos shapes rechazados por Zod y los caminos de UI del selector.

## Preguntas abiertas

- **Etiquetas legibles.** Los textos exactos en español para cada variante y para "Sin acción" (por ejemplo, ¿"Navegar a página" vs. "Ir a página" para `navigateTo`?) se cierran en implementación siguiendo las convenciones ya visibles en la panel (`Añadir`, `Quitar`, `Eliminar nodo`). No bloquea el diseño.
- **Coerción número/boolean en clave-valor.** Fuera de alcance por spec. Si en la práctica aparece un config real con `params: { page: 1 }` donde el `1` es numérico, se puede reabrir como feature aparte con selector de tipo por valor (mencionado en R1).
- **Deduplicación futura.** El diseño deja `validate-actions-visibility.ts` y `validate-form-nodes.ts` como fuente de verdad para validaciones cruzadas y (redundantemente) para shape. Reducir esa redundancia — moviendo la validación de shape a Zod y las cruzadas a un módulo dedicado — queda como candidata a feature de simplificación posterior, no aquí.
