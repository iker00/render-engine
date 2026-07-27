# Tasks — Feature 0107: Editor de acciones desde el formulario del dev editor

## Orden de ejecución
Las tareas están ordenadas por dependencia. Cada tarea es atómica, deja el
repositorio en verde y se puede revisar por separado. Antes de empezar la
implementación, leer siempre `spec.md`, `design.md` y esta ficha.

Referencias fijas:
- Panel: `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`
- Dispatcher: `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`
- Node schemas: `src/config/runtime-config-zod.ts`
- Node schema derivation: `src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts`
- Validaciones cruzadas de acciones: `src/config/validate-actions-visibility.ts`, `src/config/validate-form-nodes.ts`

Regla global de tests (no repetir por tarea): las reglas de organización,
carpeta y tamaño de ficheros de test viven en
`ai-workflow/standards/testing-rules.md`; el umbral global de cobertura
(`pnpm test`) sigue siendo gate de cierre de la pasada.

---

## T1 — Endurecer `buttonNodeSchema.props.action` con unión discriminada

- **Estado**: completada
- **Objetivo**: sustituir `z.unknown().optional()` en
  `buttonNodeSchema.props.action` por
  `z.discriminatedUnion('type', [navigateToButtonActionSchema, goBackButtonActionSchema, executeOperationRuntimeUiActionSchema, executeOperationsRuntimeUiActionSchema, resetFormRuntimeUiActionSchema, openModalRuntimeUiActionSchema, closeModalRuntimeUiActionSchema]).optional()`.
  No modificar los schemas de variante ya existentes; solo componerlos en el
  nodo. Verificar que `getNodeTypeJsonSchema('button')` emite `oneOf` con las
  7 ramas visibles en `properties.props.properties.action.oneOf`.
- **Fuera de alcance**: cambios en el dispatcher o en el panel; no consolidar
  ni eliminar validaciones de `validate-actions-visibility.ts` (D2/R6).
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: `src/config/runtime-config-zod.ts` (unión discriminada en
    `buttonNodeSchema.props.action`).
  - Tests: `src/tests/config-validation/runtime-config-validation-buttons.test.ts`
    (ampliación), `src/tests/dev-runtime/layout-canvas-node-schema.test.ts`
    (ampliación).
  - Documentación afectada: `ai-workflow/docs/app-features/nodes/button.md`
    (revisar sólo si el contrato exportado cambia; no cambia — el shape ya
    documentado se hace explícito en Zod).
- **Tests**:
  - Ficheros de test:
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts`
      (ampliación).
    - `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (ampliación).
  - Comportamiento cubierto:
    - Un config con `button.props.action` para cada una de las 7 variantes
      válidas (`navigateTo`, `goBack`, `executeOperation`,
      `executeOperations`, `resetForm`, `openModal`, `closeModal`) sigue
      siendo aceptado por `validateRuntimeConfig`, con los mismos campos que
      hoy.
    - Un config con `button.props.action.type` desconocido es rechazado por
      Zod antes de llegar a `validate-actions-visibility.ts` (nuevo camino
      de rechazo). El mensaje puede diferir del previo — se acepta que la
      ruta del error apunte a `props.action.type` (R2 documentado).
    - Un config con `button.props.action` ausente sigue siendo aceptado.
    - `getNodeTypeJsonSchema('button').properties.props.properties.action`
      contiene `oneOf` con exactamente 7 ramas, cada una con un `type`
      literal distinto.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-node-schema.test.ts`
  - Restricciones: reusar los helpers y fixtures ya presentes en
    `runtime-config-validation-buttons.test.ts` (no crear un builder nuevo si
    ya existe uno equivalente); no snapshotear el JSON Schema completo.
- **Criterios de finalización**:
  - Cierre de implementación: cambios de código y tests en verde localmente
    con los comandos anteriores; `pnpm test` global sigue en verde.

---

## T2 — Endurecer `linkNodeSchema.props.action` con unión discriminada

- **Estado**: completada
- **Objetivo**: sustituir `z.unknown().optional()` en
  `linkNodeSchema.props.action` por
  `z.discriminatedUnion('type', [navigateToButtonActionSchema, goBackButtonActionSchema]).optional()`.
  El catálogo se filtra en origen (D4): sólo `navigateTo` y `goBack`. La
  validación cruzada de mutua exclusión con `props.href` sigue viviendo en
  `validate-actions-visibility.ts`, sin cambios.
- **Fuera de alcance**: cambios en el dispatcher o en el panel; añadir
  variantes distintas a las dos ya soportadas; tocar el validador de
  `link`/`href`.
- **Dependencias**: ninguna (independiente de T1; se pueden implementar en
  cualquier orden entre sí, pero cada una debe cerrar sin la otra).
- **Impacto esperado en archivos**:
  - Código: `src/config/runtime-config-zod.ts` (unión discriminada en
    `linkNodeSchema.props.action`).
  - Tests: `src/tests/config-validation/runtime-config-validation-buttons.test.ts`
    (ampliación — el fichero ya cubre `link`), `src/tests/dev-runtime/layout-canvas-node-schema.test.ts`
    (ampliación).
  - Documentación afectada: `ai-workflow/docs/app-features/nodes/link.md`
    (revisar sólo si el contrato exportado cambia; no cambia).
- **Tests**:
  - Ficheros de test:
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts`
      (ampliación).
    - `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (ampliación).
  - Comportamiento cubierto:
    - `link.props.action` con `type: 'navigateTo'` y `type: 'goBack'` sigue
      siendo aceptado.
    - `link.props.action.type: 'executeOperation'` (o cualquiera de las 5
      variantes fuera del catálogo de `link`) es rechazado por Zod.
    - Config sin `props.action` sigue siendo aceptado (mutuamente excluyente
      con `href` sigue delegando en el validador existente).
    - `getNodeTypeJsonSchema('link').properties.props.properties.action`
      contiene `oneOf` con exactamente 2 ramas.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-node-schema.test.ts`
  - Restricciones: no reactivar la deduplicación con
    `validate-actions-visibility.ts`; el mensaje concreto del rechazo de
    Zod puede diferir del actual pero debe apuntar a `props.action.type`.
- **Criterios de finalización**:
  - Cierre de implementación: cambios de código y tests en verde localmente;
    `pnpm test` global sigue en verde.

---

## T3 — Endurecer `formNodeSchema.submitAction` (con `onSuccess`/`onError`)

- **Estado**: completada
- **Objetivo**: introducir dos nuevos schemas en `runtime-config-zod.ts`:
  - `formLifecycleActionEntrySchema`: unión discriminada por `type` con las
    7 variantes de acción, extendidas con `when: whenConditionSchema.optional()`.
    Sirve como shape de entrada de `onSuccess` y `onError`. Reutilizar los
    schemas de variante existentes; para las variantes sin `when` propio,
    encapsular la extensión sin duplicar campos.
  - `formSubmitActionSchema`: unión discriminada por `type` de
    `executeOperationRuntimeUiActionSchema` y
    `executeOperationsRuntimeUiActionSchema`, extendida con
    `onSuccess: z.array(formLifecycleActionEntrySchema).optional()` y
    `onError: z.array(formLifecycleActionEntrySchema).optional()`.
    La combinación puede resolverse con `z.discriminatedUnion(...).and(z.object({...}))`
    o convirtiendo cada rama en un `z.object` con `type` literal y sus
    propios `onSuccess`/`onError`; escoger la forma que Zod v4 acepte sin
    romper la salida de `toJSONSchema` (debe emitirse `oneOf` con las 2
    ramas y `properties.onSuccess`/`onError` accesibles).
  - Sustituir `submitAction: z.unknown().optional()` en `formNodeSchema` por
    `formSubmitActionSchema.optional()`.
- **Fuera de alcance**: cambios en `validate-form-nodes.ts` (sigue como
  fuente de verdad de validaciones cruzadas; su duplicación estructural es
  aceptada — R6); consolidar validaciones; tocar el dispatcher o el panel.
- **Dependencias**: ninguna (independiente de T1 y T2).
- **Impacto esperado en archivos**:
  - Código: `src/config/runtime-config-zod.ts` (nuevos
    `formLifecycleActionEntrySchema` y `formSubmitActionSchema`, sustitución
    en `formNodeSchema.submitAction`).
  - Tests: `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`
    (ampliación), `src/tests/dev-runtime/layout-canvas-node-schema.test.ts`
    (ampliación).
  - Documentación afectada: `ai-workflow/docs/app-features/nodes/form.md`
    y `ai-workflow/docs/app-features/forms/submit.md` (revisar sólo si el
    contrato exportado cambia; no cambia).
- **Tests**:
  - Ficheros de test:
    - `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`
      (ampliación).
    - `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (ampliación).
  - Comportamiento cubierto:
    - `form.submitAction` con `type: 'executeOperation'` y con
      `type: 'executeOperations'` sigue siendo aceptado con los mismos
      campos que hoy.
    - `form.submitAction.onSuccess` y `onError` con listas mezclando las 7
      variantes de acción (`resetForm`, `openModal`, `closeModal`,
      `navigateTo`, `goBack`, `executeOperation`, `executeOperations`), cada
      una con `when` opcional, siguen siendo aceptadas.
    - `form.submitAction.type: 'navigateTo'` (fuera del catálogo de
      `submitAction`) es rechazado por Zod.
    - Una entrada de `onSuccess` con `type` fuera del catálogo de 7 es
      rechazada por Zod.
    - `form.submitAction` ausente sigue siendo aceptado.
    - `getNodeTypeJsonSchema('form').properties.submitAction` contiene
      `oneOf` con exactamente 2 ramas, y ambas exponen
      `properties.onSuccess` y `properties.onError` como arrays cuyo `items`
      es un `oneOf` de 7 ramas.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-node-schema.test.ts`
  - Restricciones: no romper los tests de `validate-form-nodes.ts` ya en
    verde; si la forma exacta del schema JSON emitido difiere del `oneOf`
    esperado (p. ej. `allOf` de un `oneOf` + object para `onSuccess`),
    ajustar la composición Zod hasta que sí lo emita — es requisito de T5.
- **Criterios de finalización**:
  - Cierre de implementación: cambios de código y tests en verde localmente;
    `pnpm test` global sigue en verde.

---

## T4 — Resolver ramas de unión durante la recursión del dispatcher

- **Estado**: completada
- **Objetivo**: mover la resolución de rama de unión (`resolveUnionBranch`)
  desde `layout-canvas-properties-panel.tsx` hacia
  `property-field-dispatcher.tsx`, aplicándola durante la recursión de:
  1. Cada propiedad de un `object` (dentro de `ObjectPropertyField`),
     resolviendo la rama del sub-schema contra el valor actual antes de
     delegar en `PropertyFieldDispatcher`.
  2. Cada elemento de un `array` (dentro de `ArrayPropertyField`), resolviendo
     la rama de `items` contra el valor de cada ítem antes de delegar.
  Al terminar, eliminar del panel:
  - `resolveLayoutSubsectionSchema` (y su uso; la resolución de `span` la hace
    ahora el dispatcher al recursar dentro de `layout`).
  - `resolveUnionBranch` sólo si ya no se usa desde el panel; si sigue
    siendo el punto de entrada para el sub-schema top-level de `visibility`,
    mantenerlo hasta que el dispatcher lo cubra por recursión.
  El nuevo helper vive junto al dispatcher (mismo fichero o helper cercano),
  sin acoplarse a `LayoutNode`. Se aplica sólo a schemas con `oneOf`/`anyOf`
  cuyas ramas son objetos y NO comparten un literal `type` común (D5). El
  patrón discriminado con selector lo introduce T5.
- **Fuera de alcance**: introducir el selector explícito de variante (T5);
  añadir el editor clave-valor (T6); tocar los schemas de acción (T1-T3).
- **Dependencias**: ninguna funcional; en la práctica se recomienda
  implementar tras T1-T3 para poder observar `oneOf` reales en más
  ubicaciones, pero no es requisito.
- **Impacto esperado en archivos**:
  - Código:
    `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`,
    `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`.
  - Tests: `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
    (ampliación), `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
    (ampliación).
  - Documentación afectada: ninguna (refactor interno del panel).
- **Tests**:
  - Ficheros de test:
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
      (ampliación).
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
      (ampliación).
  - Comportamiento cubierto:
    - Regresión: editar `layout.span` de un contenedor con `columns` sigue
      funcionando en las dos variantes (entero y mapa responsive), con la
      resolución hecha ahora por el dispatcher. Editar `md` sobre
      `{ sm: 6, lg: 4 }` sigue conservando `lg`.
    - Regresión: editar `visibility` de un nodo sigue mostrando la rama
      correcta (condición simple vs grupo) y no cae al fallback.
    - Nuevo: un schema anidado `oneOf` sin discriminador `type` (equivalente
      al de `visibility`/`span`) dentro de un ítem de array se resuelve por
      shape y se renderiza como formulario editable (harness sintético con
      un schema fabricado en el test — no requiere `when` real todavía).
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
  - Restricciones: reusar el harness `ControlledDispatcher` ya presente en
    el fichero de tests del dispatcher; no snapshotear árboles de DOM
    grandes.
- **Criterios de finalización**:
  - Cierre de implementación: cambios de código y tests en verde localmente;
    `pnpm test` global sigue en verde.

---

## T5 — Selector de variante para uniones discriminadas por `type` en el dispatcher

- **Estado**: completada
- **Objetivo**: añadir en `property-field-dispatcher.tsx` una detección del
  patrón "unión discriminada con selector":
  - El schema tiene `oneOf` (o `anyOf`) donde todas las ramas son objetos y
    todas exponen la misma propiedad literal (`properties.type.const` o
    `properties.type.enum` con un único valor). El nombre del discriminador
    es fijo: `type`.
  - Se renderiza un nuevo `DiscriminatedUnionPropertyField` (nombre
    orientativo) que:
    1. Muestra un `EnumPropertyField` con las etiquetas `type` disponibles.
    2. Si el campo padre lo marca como opcional (ver más abajo), añade
       "Sin acción" como opción explícita. Al elegirla, llama a
       `onChange(undefined)`.
    3. Renderiza debajo los campos de la rama seleccionada delegando el
       sub-schema resuelto en `PropertyFieldDispatcher` (misma recursión que
       ya usan objetos y arrays).
    4. Al cambiar de variante, reconstruye el valor por defecto vía
       `buildDefaultObjectForRequiredFields` sobre la nueva rama y llama a
       `onChange` con el resultado. No se conserva historial por variante.
  - Señal de opcionalidad: el dispatcher ya recibe `required?: boolean`
    desde el padre (`ObjectPropertyField` lo pasa según el `required[]` del
    schema del padre). Se reutiliza esa señal: si el schema es discriminado
    por `type` y `required` es `false`, se añade la opción "Sin acción".
  - Etiquetas de variante: mapa local `type` → texto legible en español
    para las 7 variantes (`navigateTo`, `goBack`, `executeOperation`,
    `executeOperations`, `resetForm`, `openModal`, `closeModal`) y para
    "Sin acción". Los textos exactos se cierran en implementación siguiendo
    la convención ya visible en el panel (verbos en infinitivo cortos, p. ej.
    "Navegar a página", "Ejecutar operación"). Si una variante no está en el
    mapa, mostrar el `type` literal como fallback.
- **Fuera de alcance**: KV editor y su override para `body` (T6/T7);
  sanitización de `undefined` en el commit (T8); pickers contextuales de
  referencias string; deshacer/rehacer del selector.
- **Dependencias**: T1, T2, T3 (para que existan `oneOf` reales que
  ejerciten el nuevo camino) y T4 (para que la resolución de ramas ya viva
  en el dispatcher; el nuevo camino se activa antes que la resolución
  genérica por shape porque tiene un discriminador explícito).
- **Impacto esperado en archivos**:
  - Código:
    `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`
    (nueva detección + renderer). Si el renderer supera 80 líneas o mezcla
    demasiada UI con el dispatcher, extraerlo a
    `src/dev-runtime/layout-canvas/property-fields/discriminated-union-property-field.tsx`
    y mantener el resto del fichero por debajo del umbral orientativo de
    ~400 líneas.
  - Tests: `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
    (ampliación), `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
    (ampliación).
  - Documentación afectada:
    `ai-workflow/docs/app-features/development/local-config.md` si el
    documento describe hoy la limitación del panel para `props.action` /
    `submitAction`; revisar.
- **Tests**:
  - Ficheros de test:
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
      (ampliación).
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
      (ampliación).
  - Comportamiento cubierto:
    - Un schema fabricado con `oneOf` de dos ramas objeto que comparten
      `properties.type.const` distinto se renderiza como selector +
      formulario de la rama activa (unit sobre el dispatcher).
    - Al cambiar el selector a otra variante, `onChange` recibe un objeto
      con el nuevo `type` y los campos por defecto de esa variante (sin los
      campos de la variante previa).
    - Cuando el schema es opcional (`required=false`), el selector incluye
      "Sin acción"; elegirlo llama a `onChange(undefined)`.
    - Cuando el schema es obligatorio (`required=true`), el selector NO
      incluye "Sin acción".
    - Integración panel: en un nodo `button`, el panel muestra el selector
      con las 7 variantes reales y editar `pageId` de `navigateTo` se
      refleja en un `onCommitNodeUpdate` con el shape correcto.
    - Integración panel: en un nodo `link`, el panel muestra sólo 2
      variantes en el selector (más "Sin acción").
    - Integración panel: en un nodo `form`, el panel muestra 2 variantes
      para `submitAction` (más "Sin acción"), y las listas
      `submitAction.onSuccess`/`onError` (ya editables como arrays) exponen
      un selector con las 7 variantes en cada entrada añadida.
    - Integración panel — array `executeOperations.operations` (RF7, criterio
      de aceptación 3): al elegir la variante `executeOperations` en
      `button.props.action` (o en `form.submitAction`), la lista
      `operations` arranca con al menos una entrada (respetando el
      `minItems: 1` del schema). "Añadir" crea una entrada con
      `operationName` vacío y los campos opcionales (`query`, `body`,
      `headers`, `when`) ausentes. Editar `operationName` en una entrada
      existente se refleja en un `onCommitNodeUpdate` cuyo shape mantiene la
      operación en su posición y no altera al resto. "Quitar" queda
      deshabilitado en el mínimo.
    - Integración panel — `when` anidado en listas de acciones (RF8, criterio
      de aceptación 3): en un `form.submitAction.type: 'executeOperations'`,
      añadir una entrada a `onSuccess` y declararle un `when` (usando el
      mismo editor que `visibility` gracias a la recursión introducida por
      T4) produce un `onCommitNodeUpdate` con la entrada + `when` cuyo
      shape coincide con `whenConditionSchema` (condición simple o grupo),
      sin caer al fallback JSON deshabilitado. Repetir el mismo caso para
      una entrada de `executeOperations.operations`.
    - Cambiar la variante en un nodo `button` que hoy tiene
      `action: { type: 'navigateTo', pageId: 'x' }` a `resetForm` deja el
      valor commitado como `{ type: 'resetForm', formId: '' }` — sin `pageId`
      residual.
    - Elegir "Sin acción" en el `button` deja `props.action` fuera del
      objeto commitado (la sanitización dura vive en T8; aquí basta con
      verificar que `onCommitNodeUpdate` recibe un updater cuyo resultado
      no incluye `action` con un `type` viejo, sea porque es `undefined` o
      porque el commit ya lo elimina).
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
  - Restricciones: los tests unit deben usar schemas fabricados en el
    propio fichero, no depender de las 7 variantes reales; los tests de
    integración del panel sí usan los schemas reales para cerrar el
    contrato end-to-end. Las etiquetas legibles del selector deben
    aserar con `getByLabelText`/`getByRole('combobox', { name })` sin
    acoplarse al texto exacto en más de un lugar del test.
- **Criterios de finalización**:
  - Cierre de implementación: cambios de código y tests en verde localmente;
    `pnpm test` global sigue en verde.

---

## T6 — `KeyValuePropertyField` para `additionalProperties: { type: 'string' }`

- **Estado**: completada
- **Objetivo**: añadir un nuevo componente
  `src/dev-runtime/layout-canvas/property-fields/key-value-property-field.tsx`
  que renderiza un editor de pares clave-valor `{ [k: string]: string }`:
  - UI: fila por entrada con dos inputs de texto (clave, valor) y botón
    "Quitar"; botón "Añadir" al final que crea una entrada con clave `""`
    y valor `""`.
  - Editar el nombre de una clave reordena las claves conservando el resto
    del objeto (`{ ...prev, [nuevaClave]: valor }` sin dejar la clave vieja
    duplicada).
  - No coacciona tipos: siempre string en la UI. Valores no string en el
    valor entrante (p. ej. `number`, `boolean`) se muestran como
    `String(value)`; escribir texto los sobreescribe como string (R1
    documentado).
  - Accesibilidad: cada input tiene su `label`/`aria-label` asociado; los
    botones "Quitar" y "Añadir" replican el patrón del `ArrayPropertyField`
    ya existente.
  Además, extender `PropertyFieldDispatcher` para despachar a este
  componente cuando el schema es `type: 'object'`, sin `properties`
  declaradas, y con `additionalProperties: { type: 'string' }`. La rama
  `object` genérica ya existente se mantiene para objetos con `properties`.
- **Fuera de alcance**: selector de tipo por valor (string/number/boolean);
  soporte para `additionalProperties` con schema distinto a `string`; la
  excepción para `body` con claves anidadas (T7).
- **Dependencias**: T5 (para poder ejercitar el KV editor dentro de un
  formulario de acción real, aunque el fichero unit del KV es autónomo).
- **Impacto esperado en archivos**:
  - Código: nuevo
    `src/dev-runtime/layout-canvas/property-fields/key-value-property-field.tsx`;
    modificación de
    `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`
    para incluir la nueva detección.
  - Tests: nuevo
    `src/tests/dev-runtime/layout-canvas-property-field-key-value.test.tsx`;
    ampliación de
    `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
    (sólo para el despacho al nuevo componente).
  - Documentación afectada: ninguna.
- **Tests**:
  - Ficheros de test:
    - `src/tests/dev-runtime/layout-canvas-property-field-key-value.test.tsx`
      (nuevo).
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
      (ampliación).
  - Comportamiento cubierto:
    - Renderiza un objeto vacío como cero filas más el botón "Añadir".
    - "Añadir" crea una fila con clave y valor vacíos y llama a `onChange`
      con `{ '': '' }`.
    - Editar la clave de una fila renombra la clave preservando el valor y
      el orden relativo del resto.
    - Editar el valor de una fila deja la clave intacta.
    - "Quitar" elimina esa fila del objeto.
    - Con un valor entrante `{ page: 1, active: true }`, la UI muestra
      `"1"` y `"true"`; al reescribir un input, `onChange` recibe el nuevo
      objeto con strings.
    - Despacho: un schema
      `{ type: 'object', additionalProperties: { type: 'string' } }` (sin
      `properties`) se renderiza como KV y no como `ObjectPropertyField`.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-key-value.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
  - Restricciones: reusar el `ControlledDispatcher` del fichero de
    dispatcher para la parte de despacho; no montar Monaco en estos tests.
- **Criterios de finalización**:
  - Cierre de implementación: cambios de código y tests en verde localmente;
    `pnpm test` global sigue en verde.

---

## T7 — Override de `body`: KV con fallback JSON libre por clave

- **Estado**: completada
- **Objetivo**: extender el KV editor (T6) o el dispatcher para el caso
  concreto de `body` de acciones (`executeOperation`, `executeOperations`,
  `form.submitAction`):
  - Cuando la fila del KV tenga un valor primitivo string (o vacío), la
    fila se renderiza como par texto/texto ya definido en T6.
  - Cuando la fila tenga un valor que sea objeto o array (no primitivo), el
    slot de valor de esa fila usa `RawJsonPropertyField` (existente) en su
    forma deshabilitada — replicando el fallback actual sin bifurcar el
    editor entero. El nombre de la clave sigue siendo editable; "Quitar"
    sigue disponible; "Añadir" sigue creando pares string/string.
  - Detección: el schema de `body` (`runtimeApiBodySchema`) es
    `z.union([string, number, boolean, null, array(body), record(string, body)])`.
    En JSON Schema se emite como una unión no discriminada. Para que el
    dispatcher aplique el editor KV, la rama activa debe resolverse contra
    el valor actual (T4) y, cuando el valor es un objeto plano, tratarse
    como `record(string, body)`. La excepción por clave se activa por
    inspección del valor en tiempo de render, no del schema.
  - No cambia el comportamiento de `params`, `query` y `headers` (todos KV
    puro sin excepción).
- **Fuera de alcance**: convertir un valor object/array de una clave en
  editable desde el panel; permitir crear una clave nueva ya anidada
  (siempre se crea como string vacío).
- **Dependencias**: T6.
- **Impacto esperado en archivos**:
  - Código:
    `src/dev-runtime/layout-canvas/property-fields/key-value-property-field.tsx`
    (o un nuevo componente delgado si el KV se mantiene puro; decidir en
    implementación priorizando claridad — la spec y `runtime-config-zod.ts`
    marcan `body` como el único caso con excepción, así que un
    condicional local es aceptable si no oscurece el flujo).
  - Tests: ampliación de
    `src/tests/dev-runtime/layout-canvas-property-field-key-value.test.tsx`;
    ampliación de
    `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
    (integración con un nodo real).
  - Documentación afectada: ninguna.
- **Tests**:
  - Ficheros de test:
    - `src/tests/dev-runtime/layout-canvas-property-field-key-value.test.tsx`
      (ampliación).
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
      (ampliación).
  - Comportamiento cubierto:
    - Un `body` con `{ nombre: 'Ana', edad: 30 }` muestra dos filas KV
      editables.
    - Un `body` con `{ nombre: 'Ana', metadatos: { origen: 'web' } }`
      muestra la primera fila como par texto/texto editable y la segunda
      con el slot de valor deshabilitado (mensaje de fallback), sin afectar
      al resto de filas ni al selector de variante superior.
    - Un `body` con `{ tags: ['a', 'b'] }` cae al mismo fallback deshabilitado
      para esa clave (array = objeto anidado a efectos del override).
    - "Añadir" en un `body` mixto crea la nueva fila como par
      string/string.
    - Integración panel: en un `button` con
      `action.type: 'executeOperation'`, `body` es editable como KV;
      añadir una clave y escribir valor se refleja en `onCommitNodeUpdate`.
    - Integración panel — excepción `body` en entradas de
      `executeOperations.operations` (criterio de aceptación 6): en un nodo
      `button` o `form` con la variante `executeOperations` y una entrada
      cuyo `body` tenga una clave con valor objeto o array, esa clave se
      renderiza como fallback JSON deshabilitado dentro de la fila del KV,
      mientras el resto de claves de ese mismo `body` de esa misma entrada
      siguen editables como par texto/texto y las otras entradas del array
      `operations` no se ven afectadas.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-key-value.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
  - Restricciones: no introducir una segunda ruta de commit por fila; el
    valor commitado por el KV sigue siendo el objeto completo.
- **Criterios de finalización**:
  - Cierre de implementación: cambios de código y tests en verde localmente;
    `pnpm test` global sigue en verde.

---

## T8 — Sanitizar `undefined` en el commit del panel

- **Estado**: completada
- **Objetivo**: añadir un helper local `stripUndefined` (o nombre
  equivalente) en `layout-canvas-properties-panel.tsx` que, en el callback
  de `onChange` de cada subsección (`props`, `layout`, `visibility`,
  `queryStateFeedback`), filtre recursivamente las claves cuyo valor sea
  `undefined` antes de llamar a `onCommitNodeUpdate`. El helper:
  - Actúa sólo sobre objetos planos; no toca arrays ni primitivos.
  - Es recursivo: elimina `undefined` en cualquier nivel del subsección.
  - No transforma valores válidos (mantiene `null`, `0`, `''` y strings/números/booleanos).
  Motivación: al elegir "Sin acción" en el selector (T5), el objeto de
  subsección resultante puede quedar `{ label: 'x', action: undefined }`.
  El helper deja `{ label: 'x' }` antes del commit; el JSON en Monaco no
  contiene ya una clave `action` con valor `undefined`.
- **Fuera de alcance**: mover esta utilidad al dispatcher (D10 la mantiene
  como local del panel); sanitizar dentro de arrays (los ítems con
  `undefined` no son un caso soportado por los editores actuales).
- **Dependencias**: T5 (crea el camino que produce `undefined`).
- **Impacto esperado en archivos**:
  - Código:
    `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`.
  - Tests: ampliación de
    `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`.
  - Documentación afectada: ninguna.
- **Tests**:
  - Ficheros de test:
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
      (ampliación).
  - Comportamiento cubierto:
    - Elegir "Sin acción" en el selector de `button.props.action` deja el
      objeto commitado sin la clave `action` (no como
      `{ action: undefined }`).
    - Editar un campo `props` mientras el objeto tiene otras claves
      `undefined` en profundidad produce un commit sin `undefined` en
      ningún nivel.
    - Valores válidos (`''`, `0`, `false`, `null`) se conservan tras la
      sanitización.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
  - Restricciones: el helper no debe reordenar claves; debe preservar el
    orden de inserción del objeto original.
- **Criterios de finalización**:
  - Cierre de implementación: cambios de código y tests en verde localmente;
    `pnpm test` global sigue en verde.

---

## T9 — Feedback visible y sin pérdida de cambios cuando el commit de una
subsección del panel es rechazado

- **Estado**: completada
- **Motivación (bug detectado tras el cierre de T1-T8)**: `commitCanvasMutation`
  (`src/dev-runtime/dev-runtime.tsx`) valida el config completo con
  `validateRuntimeConfig` antes de aplicar un commit del panel de propiedades.
  Cuando la validación falla (`validation.status === 'error'`), la función
  hace `return { status: 'rejected', error: validation.error }` **sin llamar
  a `setCurrentConfig`** (`dev-runtime.tsx:339-341`). `handleCanvasNodeUpdate`
  (`dev-runtime.tsx:374-376`) descarta ese valor de retorno por completo, y
  `onCommitNodeUpdate` (el prop que recibe
  `layout-canvas-properties-panel.tsx`) está tipado como `(path, updater) =>
  void`, así que el resultado nunca llega al panel. Como el `DiscriminatedUnionPropertyField`
  (T5) reconstruye el valor de una nueva variante con
  `buildDefaultObjectForRequiredFields`, que produce `''` para todo campo
  string requerido sin default (`operationName`, `formId`, `modalId`,
  `pageId`), **toda variante salvo `goBack`** deja el config completo
  temporalmente inválido nada más elegirla. El commit se rechaza en
  silencio, `currentConfig` no cambia, y el panel — que deriva el valor
  mostrado directamente de `node`, sin estado local propio — vuelve a
  renderizar la variante anterior como si el cambio nunca hubiera ocurrido.
  Esto contradice RF2/RF9 y el criterio de aceptación de spec.md ("Cambiar
  de variante en el selector limpia los campos de la variante previa y
  muestra los campos por defecto de la nueva variante") y invalida el
  supuesto de design.md R5 ("el buffer de Monaco reflejará el string vacío
  hasta que se corrija") — ese buffer nunca llega a reflejarlo porque el
  commit entero se descarta antes de tocar `setCurrentConfig`. Lo mismo
  ocurre al añadir una entrada nueva a `executeOperations.operations`,
  `onSuccess` u `onError` (arranca con `operationName: ''`).
- **Objetivo**: cuando un commit iniciado desde el panel de propiedades
  (`layout-canvas-properties-panel.tsx`) es rechazado por
  `commitCanvasMutation`, el usuario debe ver de forma inmediata (a) que el
  cambio no se guardó y por qué, y (b) su propio cambio reflejado
  localmente en el campo que lo originó (el selector no debe "volver" en
  silencio a la variante anterior; una entrada añadida a una lista no debe
  desaparecer). El mecanismo es genérico por subsección del panel — no un
  caso especial de `props.action`/`submitAction` — para no introducir un
  segundo contrato de UI hardcodeado (coherente con el requisito no
  funcional de spec.md sobre no duplicar lógica ad-hoc por nodo). Cambios
  concretos:
  1. `src/dev-runtime/dev-runtime.tsx`: `handleCanvasNodeUpdate` deja de
     descartar el resultado de `commitCanvasMutation`; pasa a `return
     commitCanvasMutation((pageLayout) => replaceNodeAt(pageLayout, path,
     updater))` y su firma cambia a `(path: LayoutNodePath, updater: (node:
     LayoutNode) => LayoutNode) => CommitCanvasMutationResult`. No cambiar
     nada más de `commitCanvasMutation` (su gate de validación, el
     `flushSync`, o el hecho de que `currentConfig` sólo se actualiza en la
     rama `applied`, se mantienen intactos — este task no relaja esa
     invariante en ningún momento).
  2. `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx`: el prop
     `onCommitNodeUpdate` (`DevEditorLayerProps`, línea ~43) cambia de `(path,
     updater) => void` a `(path, updater) => CommitCanvasMutationResult`
     (mismo patrón que el prop `onCommitCanvasMutation` ya declarado dos
     líneas por encima, línea ~42, que ya importa ese tipo). Solo cambia el
     tipo; el componente ya reenvía el prop sin transformarlo (línea ~228).
  3. `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`:
     - `LayoutCanvasPropertiesPanelProps.onCommitNodeUpdate` cambia a `(path,
       updater) => CommitCanvasMutationResult | void`. El `| void` es
       deliberado: mantiene válidos, sin tocarlos, todos los test doubles
       existentes que hoy pasan `vi.fn()` sin `mockReturnValue` (devuelven
       `undefined`); el punto 4 de más abajo define cómo se interpreta ese
       caso.
     - Añadir un nuevo estado local `pendingRejections`: un record indexado
       por `NodeSubsectionKey | 'submitAction'` (los mismos identificadores
       que ya usa `SUBSECTIONS` más el caso especial `submitAction`), cuyo
       valor es `{ value: unknown; error: RuntimeConfigError }`
       (`RuntimeConfigError` ya se importa indirectamente vía
       `../../config/runtime-config`, exportado desde
       `runtime-config-types.ts`). Inicial: `{}`.
     - Añadir un `useEffect` que resetea `pendingRejections` a `{}` cuando
       cambia `serializeLayoutNodePath(path)` (importar desde
       `../../runtime/layout-node-path`, ya usada en ese módulo) — es decir,
       al seleccionar un nodo distinto se descarta cualquier rechazo
       pendiente del nodo anterior. No resetear en ningún otro caso (en
       particular, no resetear solo porque `node` cambie de referencia: un
       commit propio exitoso ya limpia su propia entrada explícitamente, ver
       siguiente punto).
     - Cada uno de los `onChange` que hoy llaman a `onCommitNodeUpdate`
       (el bucle de `SUBSECTIONS`, línea ~218-221, y el bloque de
       `submitAction`, línea ~230-234) pasa a: capturar el valor devuelto por
       `onCommitNodeUpdate(...)`; si `result?.status === 'rejected'`, guardar
       `{ value: sanitizedValue (o nextValue en el caso de submitAction),
       error: result.error }` en `pendingRejections` bajo la clave de esa
       subsección; en cualquier otro caso (`{status:'applied'}` o
       `undefined`/`void`), eliminar la entrada de esa clave de
       `pendingRejections` si existía.
     - El valor pasado como `value` a cada `PropertyFieldDispatcher` pasa de
       ser directamente `currentValue` (o `buildSubmitActionFieldValue(node)`)
       a `pendingRejections[key]?.value ?? currentValue` (mismo patrón para
       `submitAction`). Esto es lo que hace que el selector/campo muestre el
       cambio del usuario aunque el commit se haya rechazado.
     - Justo debajo del `PropertyFieldDispatcher` de cada subsección con una
       entrada activa en `pendingRejections`, renderizar un banner de error:
       `role="alert"`, `data-testid` con el patrón
       `` `layout-canvas-properties-panel-${key}-error` `` (p. ej.
       `layout-canvas-properties-panel-props-error`,
       `layout-canvas-properties-panel-submitAction-error`), estilo visual
       consistente con el banner ya existente de
       `floating-monaco-panel.tsx` (línea ~81-90: fondo/texto rojo,
       `bg-red-50 text-red-800` o clases equivalentes del proyecto). Texto
       exacto: literal `No se pudo guardar este cambio: ` seguido de
       `error.code` (en negrita, mismo patrón que
       `floating-monaco-panel.tsx`), `': '`, y `error.message`.
     - No tocar `stripUndefined`, `withSubsection`, `buildSubmitActionFieldValue`
       ni `withSubmitActionField`: siguen aplicándose exactamente igual antes
       de llamar a `onCommitNodeUpdate`. El valor guardado en
       `pendingRejections` es el valor ya saneado que se intentó comitear —
       nunca se escribe en `currentConfig`, solo se usa para el re-render
       local de ese campo.
  4. Regla de interpretación del resultado (aplica en el punto 3): un
     `onCommitNodeUpdate` que devuelve `undefined` (los `vi.fn()` sin
     `mockReturnValue` de los tests ya existentes, y cualquier otro caller
     futuro que no propague el resultado) se trata exactamente igual que
     `{status:'applied'}` — limpia cualquier rechazo pendiente de esa
     subsección y no muestra banner. Esto es intencional para no forzar la
     actualización de los `vi.fn()` ya usados en
     `layout-canvas-properties-panel.test.tsx` que no ejercitan este
     comportamiento.
- **Fuera de alcance**:
  - Tocar `commitCanvasMutation` más allá de que su valor de retorno deje
    de descartarse en `handleCanvasNodeUpdate`: su gate de validación
    (`currentConfig` solo se actualiza cuando `validateRuntimeConfig`
    acepta el config completo) no cambia. No se hace ningún commit
    "optimista" de un config inválido a `currentConfig`/Monaco.
  - Tocar `validate-actions-visibility.ts` o `validate-form-nodes.ts`.
  - Tocar cualquier schema Zod de `runtime-config-zod.ts` (en particular, no
    añadir `.default()` a `operationName`/`modalId`/`formId`/`pageId`: esos
    campos se validan contra catálogos reales — `config.api`, IDs de nodos
    `modal` declarados — así que un valor por defecto inventado seguiría
    siendo inválido salvo coincidencia, y cambiar el schema alteraría el
    contrato de `required` en el JSON Schema emitido que fijan T1-T3 de esta
    misma feature).
  - Abrir `FloatingMonacoPanel` automáticamente o reutilizar su estado
    `validationError`/banner: ese banner vive dentro del árbol de
    `FloatingMonacoPanel` y solo se renderiza con `monacoOpen`, no es un
    banner genérico reutilizable sin cambios propios; esta tarea introduce
    un banner nuevo, propio del panel de propiedades, en su lugar.
  - Un sistema de toast/notificación global.
  - Resolver el caso general de cualquier edición inválida en cualquier
    campo del panel fuera de las subsecciones ya cubiertas por
    `SUBSECTIONS`/`submitAction` (el mecanismo es genérico por subsección,
    pero esta tarea no audita ni corrige otros flujos de commit fuera del
    panel de propiedades, p. ej. drag/drop en el canvas).
  - Deshacer/rehacer.
- **Dependencias**: T5 (crea el selector de variante cuyo cambio dispara el
  bug) y T8 (`stripUndefined`, cuyo comportamiento se preserva sin cambios).
  Ambas ya completadas.
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/dev-runtime.tsx` (`handleCanvasNodeUpdate` devuelve el
      resultado de `commitCanvasMutation`).
    - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx` (tipo del prop
      `onCommitNodeUpdate`).
    - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`
      (estado `pendingRejections`, banner de error, resolución de valor
      efectivo por subsección).
  - Tests:
    - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
      (nuevo).
    - `src/tests/dev-runtime/dev-runtime.test.tsx` (ampliación).
  - Documentación afectada:
    `ai-workflow/docs/app-features/development/dev-mode-editor.md` (revisar
    si documenta hoy el comportamiento del panel ante un commit rechazado;
    si no lo documenta, no requiere cambio en esta tarea — la actualización
    documental amplia corresponde a `update-app-documentation` tras el
    cierre de implementación).
- **Tests**:
  - Ficheros de test:
    - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
      (nuevo). Fichero nuevo en lugar de ampliar
      `layout-canvas-properties-panel.test.tsx` (654 líneas ya hoy, por
      encima del umbral orientativo de `testing-rules.md`): este es un
      dominio de comportamiento distinto (feedback de commit rechazado, no
      forma/shape del valor comiteado). Reusar el patrón ya establecido en
      `layout-canvas-properties-panel.test.tsx` para el mock de
      `@monaco-editor/react`, el fixture `somePath` (`[{ field: 'children',
      index: 0 }]`) y el helper `buttonNode(action)` (duplicar el mismo
      patrón local, no importarlo — no está exportado).
    - `src/tests/dev-runtime/dev-runtime.test.tsx` (ampliación): un nuevo
      `describe` de alto nivel para el caso end-to-end real (sin mockear
      `onCommitNodeUpdate`) que prueba que el bug descrito en "Motivación"
      queda cerrado con el `DevRuntime` real. Reusar el mock de
      `@monaco-editor/react` y `makeRootElement` ya definidos en la cabecera
      del fichero.
  - Comportamiento cubierto:
    - (nuevo fichero) Cambiar el selector de `button.props.action` de
      `navigateTo` a `executeOperation` con un `onCommitNodeUpdate` mockeado
      que devuelve `{ status: 'rejected', error: { code: 'invalid-layout',
      message: '...', displayMode: 'always' } }`: el `<select>` pasa a
      mostrar `executeOperation` (no revierte a `navigateTo`), aparece un
      elemento con `role="alert"` y `data-testid="layout-canvas-properties-panel-props-error"`
      cuyo texto incluye el `code` y el `message` del error simulado.
    - (nuevo fichero) La misma subsección, tras un primer commit rechazado,
      recibe un segundo cambio (p. ej. escribir `operationName`) cuyo mock
      ahora devuelve `{ status: 'applied' }`: el banner desaparece y el
      valor mostrado ya no depende de `pendingRejections` (queda regido por
      el `node` recibido por props, como antes de esta tarea).
    - (nuevo fichero) Con un rechazo pendiente en la subsección `props` de un
      nodo, cambiar el `path` prop (simulando seleccionar otro nodo) hace
      desaparecer el banner y el valor mostrado vuelve a derivarse de la
      prop `node` del nuevo render, sin necesidad de un nuevo commit.
    - (nuevo fichero) Un `onCommitNodeUpdate = vi.fn()` sin `mockReturnValue`
      (el patrón ya usado en todo el resto de `layout-canvas-properties-panel.test.tsx`)
      no produce ningún banner tras un cambio — regresión que confirma que
      el nuevo comportamiento no rompe la interpretación por defecto usada
      por los tests ya existentes de ese otro fichero.
    - (nuevo fichero) Añadir una entrada a `executeOperations.operations`
      (vía el botón "Añadir" del array) con el mock devolviendo `{status:
      'rejected', ...}`: la nueva entrada sigue visible en la lista (no
      revierte a la longitud previa) y el banner de esa subsección aparece.
    - (ampliación `dev-runtime.test.tsx`) Con un `DevRuntime` real montado
      sobre un config cuyo `button.props.action` es `{ type: 'navigateTo',
      pageId: 'home' }`, seleccionar el nodo en modo editor, abrir el panel
      de propiedades, cambiar el selector de acción a `executeOperation`: el
      selector muestra `executeOperation`, aparece el banner de error de la
      subsección `props` (el config resultante es inválido porque
      `operationName` queda `''`), y el resto de la página renderizada (p.
      ej. otro nodo `heading` con texto fijo) no cambia ni se rompe — prueba
      end-to-end de que `handleCanvasNodeUpdate` ya no descarta el resultado
      de `commitCanvasMutation`.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
      (regresión: confirmar que ningún test existente de ese fichero, que
      usa `vi.fn()` sin `mockReturnValue`, cambia de comportamiento).
    - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
      (regresión: confirmar que el cambio de tipo de `onCommitNodeUpdate` en
      ese componente no rompe sus tests existentes).
  - Restricciones: no introducir Monaco real en el nuevo fichero de test (usar
    el mismo mock de `@monaco-editor/react` que el resto de la carpeta); no
    snapshotear el árbol de DOM del panel completo; el banner debe
    localizarse con `getByRole('alert')` combinado con su `data-testid`, no
    con el texto literal completo (para no acoplar el test a la redacción
    exacta más de una vez).
- **Criterios de finalización**:
  - Cierre de implementación: cambios de código y tests en verde localmente
    con los comandos anteriores; `pnpm test` global sigue en verde.

---

## Siguiente tarea recomendada
`T9` — es la única tarea pendiente de la feature. Cierra un bug de
comportamiento silencioso detectado tras el cierre de T1-T8 (commit del
selector de variante de acción rechazado sin ningún indicio visible en la
UI), sin reabrir ni tocar T1-T8.
