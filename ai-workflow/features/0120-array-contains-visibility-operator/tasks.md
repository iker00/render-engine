# Tasks — 0120 — Array contains visibility operator

Contrato de ejecución para la feature. Alcance acotado: extender el catálogo de operadores del shape compartido
(`visibility`, `submitAction.onSuccess[*].when`, `preloads[*].when`, `operations[*].when`) con `arrayContains` y su
nuevo campo `itemField`, junto con la evaluación de runtime del nuevo operador.

Se divide en dos tareas secuenciales para separar la extensión del contrato (tipos, zod, validación de shape) de la
evaluación de runtime del operador. Ambas tareas deben cerrarse antes de considerar la feature implementada.

## Siguiente tarea a escoger
`0120-T1` — habilita el contrato. `0120-T2` no debe iniciarse hasta cerrar `0120-T1`.

---

## Task 0120-T1 — Extender el contrato de shape con `arrayContains` + `itemField`

- **ID**: 0120-T1
- **Estado**: pending
- **Objetivo**: Añadir el operador `arrayContains` y el campo opcional `itemField` al shape compartido de condiciones
  simples, con validación de shape que rechace el config completo antes del render en los casos definidos por la
  spec. Añadir a la vez el guardado explícito en `runtime-layout-visibility.ts` para que `arrayContains` no caiga por
  fall-through en la rama de `greaterThan/lessThan`; en esta tarea la evaluación de `arrayContains` devuelve `false`
  como placeholder — la semántica real se implementa en `0120-T2`. Esto evita un estado intermedio observable en el
  que declarar `arrayContains` se comporte como `lessThan` numérico.
  - Cambios concretos:
    - `src/config/runtime-config-types.ts`:
      - Extender `RuntimeVisibilityOperator` con el literal `'arrayContains'`.
      - Añadir `itemField?: string` al interfaz `RuntimeVisibilityCondition` (opcional, después de `value`).
    - `src/config/runtime-config-zod.ts`:
      - Extender la constante `supportedVisibilityOperators` con `'arrayContains'` como último elemento del array
        `as const`.
      - Añadir `itemField: z.string().optional()` al `visibilityConditionSchema.object({...}).strip()` (después de
        `negate`).
    - `src/config/validate-actions-visibility.ts`:
      - Añadir `'arrayContains'` al `Set` `visibilityComparisonOperators` (línea 46) — el operador queda cubierto por
        la regla existente "requires value".
      - No añadirlo a `visibilityScalarOperators` ni a `visibilityTruthinessOperators`.
      - Ampliar `validateSingleVisibilityCondition` para tratar `arrayContains` como caso propio de la rama de
        comparación con literal escalar:
        - Si `operator === 'arrayContains'`, aplicar la misma validación de `value` que ya usan `equals`/`notEquals`
          (`isRuntimeConfigValue(rawCondition.value)`); mensaje análogo:
          `"...only accepts string, number, boolean or null."` sobre `path.value`.
        - Después de validar `value`, validar `itemField` si está presente:
          - Detectar presencia con `Object.prototype.hasOwnProperty.call(rawCondition, 'itemField')`, mismo
            convenio que ya usa el bloque de `value` para diferenciar "clave ausente" de "clave con valor
            `undefined`".
          - Si `itemField` está presente y no es `string`, rechazar con mensaje sobre `path.itemField`:
            `Page "${pageId}" has an invalid layout at "${path}.itemField": itemField must be a string.`
      - Añadir una comprobación previa a la rama por operador: si `itemField` está presente (con la misma
        detección por `hasOwnProperty`) en `rawCondition` pero `operator !== 'arrayContains'`, rechazar con
        mensaje sobre `path.itemField`:
        `Page "${pageId}" has an invalid layout at "${path}.itemField": itemField is only valid when operator is "arrayContains".`
      - Nota: esta comprobación debe ejecutarse después de validar que `operator` es un valor del catálogo (para no
        emitir el mensaje de `itemField` cuando el problema real es un operador inválido) y antes de la rama por
        operador.
    - `src/runtime/runtime-layout-visibility.ts`:
      - Añadir, dentro de `evaluateConditionMatch`, después de la rama `condition.operator === 'notEquals'` y antes
        del bloque `greaterThan/lessThan`, la guardia explícita:
        ```ts
        if (condition.operator === 'arrayContains') {
          return false
        }
        ```
      - Este placeholder se reemplaza por la implementación real en `0120-T2` y evita el fall-through actual a la
        comparación numérica.
- **Fuera de alcance**:
  - Implementación de la semántica de coincidencia por elemento del array (queda para `0120-T2`).
  - Cualquier cambio en operadores existentes (`equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan`,
    `lessThan`).
  - Cambios en la sintaxis general de referencias (`runtime-reference-syntax.ts`) o en el resolvedor
    (`runtime-references/`); `itemField` es un campo propio de la condición, no una ampliación del lenguaje de
    referencias.
  - Modificar el schema de grupos (`visibilityGroupSchema`) más allá de la extensión implícita por el nuevo operador
    en las condiciones simples.
  - Actualizar documentación funcional (queda para `update-app-documentation` posterior).
- **Dependencias**: ninguna. Es la primera tarea del plan.
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/runtime-config-types.ts` (extender tipo `RuntimeVisibilityOperator` y `RuntimeVisibilityCondition`)
    - `src/config/runtime-config-zod.ts` (extender `supportedVisibilityOperators` y `visibilityConditionSchema`)
    - `src/config/validate-actions-visibility.ts` (nueva rama de validación para `arrayContains` y `itemField`)
    - `src/runtime/runtime-layout-visibility.ts` (guardia placeholder para `arrayContains`)
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación)
  - Documentación: revisar tras el cierre de implementación
    (`ai-workflow/docs/app-features/references/visibility.md`) — no ejecutar aquí.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación)
  - **Comportamiento cubierto**:
    - Aceptación: una `visibility` con `{ reference: "queries.x.data.permissions", operator: "arrayContains",
      itemField: "code", value: "3-1" }` valida sin error.
    - Aceptación: una `visibility` con `{ reference: "queries.x.data.tags", operator: "arrayContains", value: "b" }`
      (sin `itemField`) valida sin error.
    - Aceptación: `arrayContains` con `value: null`, `value: 3`, `value: true` valida sin error (todos los literales
      escalares soportados).
    - Aceptación: `arrayContains` con `negate: true` sigue validando.
    - Aceptación: `arrayContains` dentro de un grupo `and`/`or` (junto a otras condiciones simples con operadores ya
      existentes) valida sin error.
    - Aceptación: `arrayContains` funciona igual en los 4 contextos que reutilizan el shape — replicar al menos un
      caso positivo con `arrayContains` para: (a) `visibility` de un nodo, (b) `submitAction.onSuccess[*].when` (via
      `validateWhenCondition` sobre form submit action), (c) `pages[].preloads[*].when`,
      (d) `button.props.action.operations[*].when` (executeOperations dentro de un botón).
    - Rechazo: `arrayContains` sin `value` produce un error sobre `path.value` con el mensaje
      `operator "arrayContains" requires value.`
    - Rechazo: `arrayContains` con `value` no escalar (objeto, array) produce un error sobre `path.value` con el
      mensaje `operator "arrayContains" only accepts string, number, boolean or null.`
    - Rechazo: `arrayContains` con `itemField` no string (number, boolean, null, objeto, array) produce un error
      sobre `path.itemField` con el mensaje `itemField must be a string.`
    - Rechazo: `itemField` presente en una condición cuyo `operator` es distinto de `arrayContains` (`equals`,
      `notEquals`, `isTruthy`, `isFalsy`, `greaterThan`, `lessThan`) produce un error sobre `path.itemField` con el
      mensaje `itemField is only valid when operator is "arrayContains".`
    - Rechazo: `arrayContains` con `negate` no booleano sigue rechazándose por la regla existente de `negate` (sin
      añadir nueva casuística).
    - Regresión: los tests ya existentes de operadores `equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan`,
      `lessThan` siguen pasando sin cambios de aserciones (extra keys, valores no aceptados, `operator` fuera de
      catálogo, etc.).
    - Regresión: una condición existente sin `itemField` y con cualquier operador previo sigue validando.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts`
    - `pnpm test` (una vez al cierre, para confirmar la suite global y el gate de cobertura)
  - **Restricciones**:
    - Añadir los nuevos casos como `it(...)` o `describe(...)` propios de `arrayContains` dentro de los `describe`
      existentes del fichero, adyacentes a los casos análogos de otros operadores; no crear un fichero nuevo.
    - No introducir snapshots.
    - No tocar ni reordenar tests ya existentes; solo añadir.
    - Reutilizar los helpers y fixtures ya declarados en la cabecera del fichero.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/references/visibility.md` — extender el catálogo de operadores con `arrayContains`
    y documentar `itemField`, sus reglas y casos límite.
  - `ai-workflow/docs/app-features/references/index.md` — solo si el índice menciona explícitamente el catálogo de
    operadores; verificar durante la actualización documental.
- **Criterios de finalización**:
  - `RuntimeVisibilityOperator` incluye `'arrayContains'` y `RuntimeVisibilityCondition` acepta `itemField?: string`.
  - `visibilityConditionSchema` acepta `itemField` opcional y `supportedVisibilityOperators` incluye `arrayContains`.
  - `validateSingleVisibilityCondition` rechaza cada uno de los casos declarados en la spec (`value` ausente/no
    escalar, `itemField` no string, `itemField` con operador distinto de `arrayContains`) sobre la ruta exacta y con
    el mensaje declarado arriba.
  - `evaluateConditionMatch` no cae por fall-through a `lessThan` cuando `operator === 'arrayContains'`; devuelve
    `false` como placeholder.
  - Todos los tests nuevos y ya existentes del fichero `runtime-config-validation-visibility.test.ts` en verde.
  - `pnpm test` (suite completa) en verde sin bajar el umbral de cobertura global del 80%.
- **Cierre de implementación**:
  - Tipos, schema, validación de shape y guardia de runtime placeholder están en el árbol; los tests declarados
    arriba pasan; la suite global sigue en verde.

---

## Task 0120-T2 — Implementar la evaluación de runtime de `arrayContains`

- **ID**: 0120-T2
- **Estado**: pending
- **Objetivo**: Sustituir el placeholder `return false` de `arrayContains` en `runtime-layout-visibility.ts` por la
  semántica real de coincidencia por elemento del array, incluyendo la navegación por `itemField` con segmentos
  anidados y las degradaciones definidas en la spec. Cubrir la semántica con tests de runtime.
  - Cambios concretos:
    - `src/runtime/runtime-layout-visibility.ts`:
      - Reemplazar el bloque placeholder de `arrayContains` (introducido en `0120-T1`) por una rama que:
        - Obtenga el valor resuelto de la referencia (`resolvedReference.value`). Si `resolvedReference.status !==
          'resolved'` o el valor no es un array (`Array.isArray(value) === false`), devuelve `false` (no coincide,
          sin coerciones). Nota: `arrayContains` debe ejecutarse antes del `if (resolvedReference.status !==
          'resolved')` actual (línea 107), porque la degradación "no match" para `arrayContains` cubre también el
          caso de referencia no resuelta y no debe delegarse en la rama numérica.
        - Si `condition.itemField` está declarado, para cada elemento del array:
          - Si el elemento no es un objeto plano (`typeof element !== 'object' || element === null ||
            Array.isArray(element)`), ignorar ese elemento y continuar.
          - Si es objeto, navegar los segmentos de `condition.itemField.split('.')` accediendo por clave (los
            segmentos vacíos o cualquier segmento inexistente durante la navegación descartan ese elemento y
            continúan). Al final de la navegación, si se resolvió un valor, compararlo con `condition.value`
            usando `Object.is`; si coincide, devolver `true`.
        - Si `condition.itemField` no está declarado, para cada elemento del array comparar el elemento completo
          contra `condition.value` con `Object.is`; si coincide, devolver `true`.
        - Tras recorrer todos los elementos sin coincidencia, devolver `false`.
      - Extraer un helper local `arrayContainsMatch(value, condition)` si mejora la legibilidad de la función;
        mantenerlo en el mismo fichero y no exportarlo.
      - No modificar `normalizeComparableValue`, `isTruthyValue`, `resolveLayoutNodeVisibility`,
        `isLayoutNodeVisible`, ni el resto de ramas de `evaluateConditionMatch`.
- **Fuera de alcance**:
  - Cambios de tipos, zod o validación de shape (ya cerrados en `0120-T1`).
  - Ampliar `runtime-reference-syntax.ts` o el resolvedor con wildcards `permissions[]` u otras formas nuevas de
    referencia.
  - Extensiones semánticas del operador: comparaciones distintas a igualdad estricta dentro del array, reportar la
    posición del array coincidente, o soportar `itemField` con notación de índice.
  - Cualquier UI de edición visual del dev editor para construir condiciones `arrayContains`.
  - Actualizar documentación funcional (queda para `update-app-documentation` posterior).
- **Dependencias**: `0120-T1` cerrado. Sin ello, el runtime no compilaría contra el nuevo tipo `RuntimeVisibilityOperator`
  ni podría distinguir `itemField` en la condición.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-layout-visibility.ts` (implementación real de la rama `arrayContains`).
  - Tests:
    - `src/tests/runtime/runtime-layout-visibility.test.ts` (ampliación)
  - Documentación: revisar tras el cierre de implementación
    (`ai-workflow/docs/app-features/references/visibility.md`) — no ejecutar aquí.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-layout-visibility.test.ts` (ampliación)
  - **Comportamiento cubierto**:
    - Match con `itemField` (array de objetos): con `queries.x.data.permissions = [{ code: "1-1" }, { code: "1-2" },
      { code: "2-2" }, { code: "3-1" }]`, `{ operator: "arrayContains", reference: "queries.x.data.permissions",
      itemField: "code", value: "3-1" }` coincide (nodo visible); con `value: "9-9"` no coincide.
    - Match sin `itemField` (array de primitivos): con `queries.x.data.tags = ["a", "b", "c"]`,
      `{ operator: "arrayContains", reference: "queries.x.data.tags", value: "b" }` coincide; con `value: "z"` no
      coincide.
    - Match con `itemField` de segmentos anidados: con `queries.x.data.permissions = [{ user: { code: "1-1" } },
      { user: { code: "3-1" } }]`, `{ operator: "arrayContains", itemField: "user.code", value: "3-1" }` coincide.
    - No-match por referencia no resuelta (`queries.x.data.permissions` ausente, objeto sin la clave `permissions`
      dentro de `data`, o forma no navegable): no coincide, sin lanzar error.
    - No-match por valor no-array: `queries.x.data.permissions` resuelto como objeto no-array, string, número,
      booleano o `null` no coincide en ningún caso.
    - No-match por array vacío (`[]`) con o sin `itemField`.
    - No-match por `itemField` con segmento inexistente en todos los elementos: `[{ other: "x" }, { other: "y" }]`
      con `itemField: "code"`, `value: "3-1"` no coincide.
    - No-match por `itemField` declarado sobre array de primitivos: `["a", "b"]` con `itemField: "code"` no coincide.
    - Elementos de tipos mixtos: `[{ code: "1-1" }, "suelto", 42, null]` con `itemField: "code"`, `value: "1-1"`
      coincide (el elemento objeto sí resuelve `code`; los otros se ignoran sin invalidar).
    - `value: null` con `itemField`: `[{ code: null }, { code: "x" }]` con `itemField: "code"`, `value: null`
      coincide (usa `Object.is` para igualdad estricta contra `null`).
    - Array con un único elemento se comporta igual que cualquier otro tamaño.
    - `negate: true` sobre `arrayContains` que no coincide → visible; sobre `arrayContains` que coincide → oculto.
    - Composición en grupo `or`: `{ operator: "or", conditions: [{ arrayContains match }, { equals no match }] }`
      coincide; `and` con al menos una condición que no coincide oculta el nodo.
    - Regresión: los tests ya existentes de `equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan`, `lessThan`,
      `params.*`, `item.*`, grupos `and`/`or` y precedencia de `queryStateFeedback` siguen pasando sin cambios.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-layout-visibility.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts` (sanity check para
      confirmar que la extensión de runtime no rompe validación de shape)
    - `pnpm test` (una vez al cierre, para confirmar la suite global y el gate de cobertura)
  - **Restricciones**:
    - Añadir los casos como `it(...)` o un `describe('arrayContains', ...)` anidado dentro del `describe('Runtime
      layout visibility', ...)` existente, siguiendo la disposición actual del fichero.
    - No introducir snapshots.
    - No tocar los tests ya existentes.
    - Reutilizar los helpers de construcción de `RuntimeState` y de `RuntimeIterationContext` ya presentes en el
      fichero; no crear un harness paralelo.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/references/visibility.md` — la actualización se ejecuta en la pasada documental
    posterior; queda registrada aquí como referencia.
- **Criterios de finalización**:
  - `arrayContains` se comporta según los 10 criterios de aceptación de `spec.md` en runtime.
  - Todos los casos límite de la spec (array vacío, `itemField` con segmento inexistente, elementos mixtos, `value:
    null`, array de un único elemento, `itemField` sobre primitivos) están cubiertos por tests y en verde.
  - `negate` y participación en grupos `and`/`or` funcionan igual que con el resto de operadores.
  - `pnpm test --run src/tests/runtime/runtime-layout-visibility.test.ts` en verde.
  - `pnpm test` (suite completa) en verde sin bajar el umbral de cobertura global del 80%.
- **Cierre de implementación**:
  - `runtime-layout-visibility.ts` implementa la semántica real de `arrayContains`; los tests declarados arriba
    pasan; la suite global sigue en verde.
