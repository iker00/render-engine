# Plan de implementación: manejo robusto de errores (0060)

## Resumen

Cinco tareas secuenciales que coordinan tres ejes funcionales declarados en la spec:

1. Aceptación y validación de los nuevos campos del catálogo `api` (`errorCondition`, `errorMessagePath`, `errorCodePath`) antes del render.
2. Aceptación a nivel de parser y validador de referencias de las nuevas rutas `queries.{queryName}.error.message` y `queries.{queryName}.error.code`, y rechazo explícito del resto de subrutas bajo `.error`.
3. Resolución en runtime de esas dos nuevas rutas en superficies visibles e interpolación, y en `visibility.reference`.
4. Vaciado del campo `data` cuando una query transita a `status: error` (RF-6).
5. Evaluación en runtime del `errorCondition` sobre respuestas HTTP 200 con JSON válido, extracción del mensaje/código y emisión del nuevo código tipado `business-error-condition`.

### Decisiones cerradas

- **Default del `error.code`** cuando `errorCondition` se cumple y `errorCodePath` no está declarado o no resuelve un `string`/`number`: `error.code = 'business-error-condition'` (la nueva constante tipada). La spec en RF-15 dice "queda ausente"; se interpreta como "no se extrae un valor del body" y el runtime aplica el typed default para preservar la invariante de que un error siempre lleva `code` legible para diagnóstico y referencia. Esta decisión queda recogida aquí y NO se reinterpreta durante la implementación.
- **`errorMessage` por defecto** cuando `errorMessagePath` no está declarado o no resuelve un string no vacío: `"Error en la respuesta del servidor"` (literal exacto, tal como dice RF-13).
- **Pre-validación de `errorCondition.path`**: ruta dot-notation no vacía. Solo se acepta un único string; no se descompone aquí (la navegación efectiva la hace el evaluador en runtime con `resolveNestedReferenceValue`).
- **Mutualidad `equals` / `notEquals`**: declarar ambos rechaza el config antes del render (RF-1.2). Declarar ninguno → la condición se evalúa como truthiness del valor (spec §1).
- **`errorMessagePath` / `errorCodePath`**: opcionales, pero si se declaran deben ser strings no vacíos; si llegan vacíos o de tipo distinto, se rechaza el config (RF-1.4).
- **No se rompe el shape público de `RuntimeApiError`**: solo se añade `'business-error-condition'` al union de `code` y `code` se mantiene requerido. La extensión del catálogo de referencias afecta a la navegación, no a la forma del objeto interno.
- **`data: null` en error**: se aplica en el reducer de `queries/set-error` y aplica a TODOS los códigos de error existentes, no solo al nuevo (RF-19, casos de aceptación 8).

Las decisiones cerradas actúan como contrato de ejecución para la skill de implementación.

---

## Tarea 01 — Validar `errorCondition`, `errorMessagePath` y `errorCodePath` en el catálogo `api`

**ID:** T01
**Estado:** pendiente
**Depende de:** ninguna (primera tarea)

### Objetivo

Aceptar opcionalmente en cada entrada `api` los tres nuevos campos declarativos y rechazar antes del render cualquier configuración inválida según RF-1.

Forma soportada:

- `errorCondition`: objeto opcional con `path` (string no vacío, obligatorio si el bloque existe), y opcionalmente `equals` o `notEquals` (escalar `string | number | boolean | null`); `equals` y `notEquals` son mutuamente excluyentes.
- `errorMessagePath`: string no vacío, opcional.
- `errorCodePath`: string no vacío, opcional.

La validación no resuelve ni evalúa nada en runtime; solo asegura que el shape llegue a la ejecución de operaciones bien formado.

### Fuera de alcance

- Evaluación del `errorCondition` en runtime (T05).
- Cambios en navegación de referencias `queries.*.error.*` (T02/T03).
- Vaciado de `data` (T04).
- Soporte de múltiples `errorCondition` por endpoint, combinaciones AND/OR, rangos numéricos o condiciones basadas en headers (todos explícitamente fuera de alcance en la spec).

### Dependencias

Ninguna.

### Impacto esperado en archivos

**Código a modificar:**

- `src/config/runtime-config-types.ts`
  - Añadir `RuntimeApiErrorConditionEquals = string | number | boolean | null` como alias del literal soportado en `equals`/`notEquals` (los mismos del `RuntimeConfigValue` ya existente; reusarlo si encaja).
  - Añadir interfaz `RuntimeApiErrorCondition` con campos `path: string`, `equals?: RuntimeConfigValue`, `notEquals?: RuntimeConfigValue`. Documentar con comentario corto (`// equals y notEquals son mutuamente excluyentes`) solo si el lector no lo deduce del nombre. Mantener el límite de comentarios del coding-style.
  - Extender `RuntimeApiOperation` con `errorCondition?: RuntimeApiErrorCondition`, `errorMessagePath?: string`, `errorCodePath?: string`.
- `src/config/runtime-config-zod.ts`
  - Añadir `runtimeApiErrorConditionEqualsSchema` = `z.union([z.string(), z.number(), z.boolean(), z.null()])` (puede reutilizar `runtimeConfigValueSchema` ya declarado).
  - Añadir `runtimeApiErrorConditionSchema` = `z.object({ path: nonEmptyStringSchema, equals: runtimeApiErrorConditionEqualsSchema.optional(), notEquals: runtimeApiErrorConditionEqualsSchema.optional() }).strip()`.
  - Extender `runtimeApiOperationShellSchema` añadiendo `errorCondition: runtimeApiErrorConditionSchema.optional()`, `errorMessagePath: nonEmptyStringSchema.optional()`, `errorCodePath: nonEmptyStringSchema.optional()`.
- `src/config/validate-api-config.ts`
  - En `validateApiOperation`, tras el `shellResult` exitoso y antes de construir el `operation` final, añadir un bloque que valide la exclusividad `equals` XOR `notEquals` cuando `errorCondition` está declarado:
    - Si `errorCondition.equals !== undefined && errorCondition.notEquals !== undefined`, devolver `invalidLayout(\`The api operation "${operationName}.errorCondition" cannot declare both "equals" and "notEquals".\`)`.
  - En el mapeo de issues Zod (`shellResult.error.issues[0]`):
    - Si `path[0] === 'errorCondition'`: discriminar por `path[1]`:
      - `path[1] === 'path'` → `invalidLayout(\`The api operation "${operationName}.errorCondition.path" must be a non-empty string.\`)`.
      - `path[1] === 'equals'` o `'notEquals'` → `invalidLayout(\`The api operation "${operationName}.errorCondition.${path[1]}" must be a string, number, boolean or null.\`)`.
      - Fallback → `invalidLayout(\`The api operation "${operationName}.errorCondition" must be an object with a non-empty "path".\`)`.
    - Si `path[0] === 'errorMessagePath'` → `invalidLayout(\`The api operation "${operationName}.errorMessagePath" must be a non-empty string.\`)`.
    - Si `path[0] === 'errorCodePath'` → `invalidLayout(\`The api operation "${operationName}.errorCodePath" must be a non-empty string.\`)`.
  - Tras parsear con éxito y validar exclusividad, propagar los tres campos al objeto `operation` resultante (paridad estricta con cómo se propagan `query`, `body`, `headers`).

**Tests a modificar:**

- `src/tests/config-validation/runtime-config-validation-api-operations.test.ts` (ampliación)

**Documentación afectada:**

- `ai-workflow/docs/app-features/config/api-catalog.md` (nuevos campos)
- `ai-workflow/docs/app-features/queries/execution.md` (referencia al nuevo bloque)
- `ai-workflow/features/index.md`

### Tests

**Ficheros de test:**

- `src/tests/config-validation/runtime-config-validation-api-operations.test.ts` (ampliación)

**Comportamiento cubierto:**

- Una operación que NO declara `errorCondition`, `errorMessagePath` ni `errorCodePath` se acepta como `status: 'ready'` sin cambios respecto al estado actual (regresión obligatoria).
- Una operación con `errorCondition: { path: "code" }` (sin `equals`/`notEquals`) se acepta como `ready` (modo truthiness).
- Una operación con `errorCondition: { path: "code", equals: 200 }` se acepta como `ready` y el `equals` se propaga al objeto normalizado.
- Una operación con `errorCondition: { path: "code", notEquals: 200 }` se acepta como `ready` y el `notEquals` se propaga.
- Una operación con `errorCondition: { path: "ok", equals: true }`, `errorCondition: { path: "ok", equals: false }`, `errorCondition: { path: "ok", equals: null }` y `errorCondition: { path: "msg", equals: "FATAL" }` se aceptan como `ready` (cobertura de los cuatro tipos escalares).
- Una operación con `errorCondition: { path: "code", equals: 200, notEquals: 500 }` se rechaza con ruta `errorCondition` y mensaje sobre `equals` y `notEquals` mutuamente excluyentes.
- Una operación con `errorCondition: {}` (sin `path`) se rechaza con ruta `errorCondition.path` y mensaje "must be a non-empty string".
- Una operación con `errorCondition: { path: "" }` se rechaza con ruta `errorCondition.path`.
- Una operación con `errorCondition: { path: "code", equals: { nested: true } }` se rechaza con ruta `errorCondition.equals`.
- Una operación con `errorCondition: { path: "code", notEquals: [1, 2] }` se rechaza con ruta `errorCondition.notEquals`.
- Una operación con `errorCondition` declarado como string/array/null (no objeto) se rechaza con ruta `errorCondition`.
- Una operación con `errorMessagePath: "message"` y `errorCodePath: "code"` ambos válidos se acepta como `ready` y los campos se propagan.
- Una operación con `errorMessagePath: ""` se rechaza con ruta `errorMessagePath`.
- Una operación con `errorCodePath: ""` se rechaza con ruta `errorCodePath`.
- Una operación con `errorMessagePath: 123` (no string) se rechaza con ruta `errorMessagePath`.
- Una operación con `errorCodePath: { nested: true }` (no string) se rechaza con ruta `errorCodePath`.
- Una operación que declara `errorMessagePath` y `errorCodePath` sin declarar `errorCondition` se acepta como `ready` (los campos pueden coexistir; la spec no obliga a declarar `errorCondition` para que `errorMessagePath`/`errorCodePath` sean válidos en validación).
- Claves extra dentro de `errorCondition` se descartan silenciosamente por `.strip()`.

**Comandos durante la implementación:**

```
pnpm test --run src/tests/config-validation/runtime-config-validation-api-operations.test.ts
```

**Restricciones:**

- No introducir nuevos walkers de JSON; reutilizar el patrón existente de mapeo de issues Zod en `validate-api-config.ts`.
- Mantener el shape del error de validación consistente (`invalidLayout(...)`).
- No añadir snapshots.
- No tocar `RuntimeApiError` ni el resto del runtime; esta tarea es pura validación previa al render.

### Criterios de finalización

- `RuntimeApiErrorCondition` existe y `RuntimeApiOperation` lo expone como campo opcional.
- `runtimeApiOperationShellSchema` admite `errorCondition`, `errorMessagePath`, `errorCodePath`.
- `validateApiOperation` rechaza las combinaciones inválidas listadas en los tests con la ruta exacta y propaga los campos al objeto normalizado en los casos válidos.
- `pnpm test --run src/tests/config-validation/runtime-config-validation-api-operations.test.ts` pasa en verde.

### Cierre de implementación

Código y tests de esta tarea completos y validados. T02 puede ejecutarse.

---

## Tarea 02 — Aceptar `queries.{queryName}.error.message` y `queries.{queryName}.error.code` como referencias soportadas

**ID:** T02
**Estado:** pendiente
**Depende de:** ninguna (puede paralelizarse con T01 pero el orden documental es T01 → T02)

### Objetivo

Extender el parser de referencias y el validador de `visibility.reference` para que:

- `queries.{queryName}.error.message` se reconozca como referencia `kind: 'reference', status: 'supported', namespace: 'queries', path: [queryName, 'error', 'message']`.
- `queries.{queryName}.error.code` se reconozca igualmente como `supported` con `path: [queryName, 'error', 'code']`.
- Cualquier otra subruta bajo `.error` distinta de `.message` o `.code` (longitud `>= 3` cuyo `path[2]` no sea `message` ni `code`, o longitudes superiores) siga clasificándose como `invalid`.
- El validador de `visibility` acepte las dos nuevas rutas; el mensaje de error existente para rutas inválidas se actualiza para mencionar también `error.message`/`error.code`.

Esta tarea solo cambia el contrato de aceptación; la resolución dinámica en runtime vive en T03.

### Fuera de alcance

- Resolución dinámica de las nuevas rutas en `runtime-reference-resolver.ts` (T03).
- Validación del catálogo `api` (T01).
- Cualquier cambio en otras superficies que no admitan ya `queries.*` (las superficies se heredan del catálogo soportado actual; este plan no añade superficies nuevas).

### Dependencias

Ninguna.

### Impacto esperado en archivos

**Código a modificar:**

- `src/runtime/runtime-references/runtime-reference-parser.ts`
  - En `hasValidQueryReferencePath`, ampliar la rama de `path.length === 3` para aceptar también el caso `path[1] === 'error' && (path[2] === 'message' || path[2] === 'code')`. Cualquier otro `path[1] === 'error'` con longitud `>= 3` debe seguir devolviendo `false`.
  - Si la longitud es `>= 4`, mantener el filtro actual (solo permite `path[1] === 'data'`), de modo que `queries.x.error.message.foo` sigue siendo `invalid`.
  - Mantener `isSupportedQueryProperty` igual (sigue siendo el conjunto cerrado `{data, status, error}` para la longitud 2).
- `src/config/validate-actions-visibility.ts`
  - En `isValidVisibilityReference`, en la rama `segments[2] === 'status' || segments[2] === 'error'`:
    - Si `segments[2] === 'status'`, mantener el comportamiento actual (longitud exactamente 3).
    - Si `segments[2] === 'error'`, aceptar también longitud 4 si `segments[3] === 'message' || segments[3] === 'code'`. La longitud 3 (`queries.x.error` raíz) sigue siendo válida.
    - Cualquier otra subruta bajo `.error` sigue devolviendo `false`.
  - Actualizar el mensaje del error en la línea ~286 para listar las nuevas rutas válidas: añadir `queries.{queryName}.error.message`, `queries.{queryName}.error.code` al final de la enumeración existente. El mensaje debe quedar legible y permitir tests con `expect(...).toContain('error.message')`.

**Tests a modificar:**

- `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación) — sección del parser (`describe('T0008-01 nested query reference parser contract')`)
- `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación)

**Documentación afectada:**

- `ai-workflow/docs/app-features/references/reference-resolution.md` (catálogo ampliado con `error.message`/`error.code`)
- `ai-workflow/docs/app-features/queries/state-model.md` (referencias soportadas)
- `ai-workflow/docs/app-features/references/visibility.md` (lista de rutas válidas para `reference`)
- `ai-workflow/features/index.md`

### Tests

**Ficheros de test:**

- `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación)
- `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación)

**Comportamiento cubierto:**

En `runtime-reference-resolution.test.tsx` (parser):

- `parseRuntimeReference('queries.searchUsers.error.message')` devuelve `kind: 'reference'`, `status: 'supported'`, `namespace: 'queries'`, `path: ['searchUsers', 'error', 'message']`. Este test invierte el contrato anterior; el test existente en la línea ~227 y/o ~307 debe actualizarse explícitamente, no añadirse en paralelo.
- `parseRuntimeReference('queries.searchUsers.error.code')` devuelve igualmente `supported` con `path: ['searchUsers', 'error', 'code']`.
- `parseRuntimeReference('queries.searchUsers.error')` (raíz) sigue siendo `supported` (regresión obligatoria).
- `parseRuntimeReference('queries.searchUsers.error.token')`, `parseRuntimeReference('queries.searchUsers.error.message.foo')`, `parseRuntimeReference('queries.searchUsers.error.code.bar')`, `parseRuntimeReference('queries.searchUsers.status.label')` siguen siendo `invalid` (regresión + cierre del nuevo límite).
- `parseRuntimeReference('queries.searchUsers.error.')` y `parseRuntimeReference('queries.searchUsers.error..message')` (segmentos vacíos) siguen siendo `invalid`.

En `runtime-config-validation-visibility.test.ts`:

- Un `visibility` con `reference: 'queries.searchUsers.error.message'` y `operator: 'isTruthy'` se acepta como `ready`.
- Un `visibility` con `reference: 'queries.searchUsers.error.code'` y `operator: 'equals'`, `value: 'UNAUTHORIZED'` se acepta como `ready`.
- Un `visibility` con `reference: 'queries.searchUsers.error.token'` se rechaza con ruta `.reference` y mensaje que mencione las rutas válidas. Verificar que el mensaje incluye literalmente `error.message` y `error.code`.
- Un `visibility` con `reference: 'queries.searchUsers.error.message.foo'` se rechaza con ruta `.reference`.
- Regresión: `visibility` con `reference: 'queries.searchUsers.error'` (raíz) sigue aceptándose como `ready`.
- Regresión: `visibility` con `reference: 'queries.searchUsers.status'` y `reference: 'queries.searchUsers.data.foo'` siguen aceptándose.

**Comandos durante la implementación:**

```
pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx
pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts
```

**Restricciones:**

- Actualizar los tests existentes que verifican el contrato anterior ("keeps status and error branches closed to additional navigation" en `runtime-reference-resolution.test.tsx`) en lugar de añadir tests contradictorios en paralelo. El test antiguo de `error.message → invalid` debe pasar a `error.message → supported` y permanecer; un nuevo test cubre el cierre con `error.token → invalid` y `error.message.foo → invalid`.
- No tocar la regex `REFERENCE_PATTERN`; el pattern actual ya admite los segmentos `error`, `message`, `code` con el alfabeto soportado.
- Mantener la firma pública de `isValidVisibilityReference` sin cambios estructurales.

### Criterios de finalización

- `parseRuntimeReference` clasifica `queries.X.error.message` y `queries.X.error.code` como `supported` y todas las demás subrutas bajo `.error` como `invalid`.
- El validador de `visibility` acepta esas dos rutas y rechaza el resto con mensaje actualizado.
- `pnpm test --run` de los dos ficheros listados pasa en verde.

### Cierre de implementación

Código y tests de esta tarea completos y validados. T03 queda habilitada.

---

## Tarea 03 — Resolución runtime de `queries.{queryName}.error.message` y `queries.{queryName}.error.code`

**ID:** T03
**Estado:** pendiente
**Depende de:** T02

### Objetivo

Cuando el parser entrega una referencia `supported` con `path: [queryName, 'error', 'message' | 'code']`, el resolver debe devolver:

- El string contenido en `queries[queryName].error.message` cuando la query tiene un error activo y `error.message` es string.
- El string contenido en `queries[queryName].error.code` cuando la query tiene un error activo (todos los códigos tipados existentes son string, incluido `business-error-condition`).
- `found: false` (degradación según la política del consumidor) cuando la query no existe, no tiene error activo (`error === null`), o el subcampo solicitado no es un string.

La degradación en superficies textuales y en `visibility` reutiliza el comportamiento existente:

- En superficies visibles e interpolación, `found: false` → string vacío.
- En `visibility`, `found: false` → valor ausente; `isFalsy` hace match, `equals`/`notEquals` no hacen match.

### Fuera de alcance

- Cambios en la forma del objeto `error` (sigue siendo `RuntimeQueryError` actual).
- Cambios en otras subrutas (`queries.X.data.*`, `queries.X.status`, etc.).
- Validación previa al render (T02).
- Vaciado de `data` (T04).

### Dependencias

T02.

### Impacto esperado en archivos

**Código a modificar:**

- `src/runtime/runtime-state/runtime-state-selectors.ts`
  - Extender `selectQueryReferenceValue` para aceptar opcionalmente `subProperty?: 'message' | 'code'` cuando `property === 'error'`. Implementación literal:
    - Si `property === 'error'` y `subProperty` está definido, devolver `queryState.error?.[subProperty]`. Esto es `string | undefined`. El caller decide si `undefined` se traduce a `found: false`.
    - Si `property === 'error'` y `subProperty` no está, devolver el objeto `error` completo (comportamiento actual).
  - Alternativa equivalente: añadir un selector hermano `selectQueryErrorProperty(state, queryName, subProperty: 'message' | 'code')` que devuelva `string | undefined`. Elegir la opción que minimice el cambio de firma pública del selector existente; la decisión es del implementador siempre que no introduzca duplicación.
- `src/runtime/runtime-references/runtime-reference-resolver.ts`
  - En `resolveSupportedReferenceValue`, dentro de la rama de `queries`:
    - Detectar el caso `property === 'error' && nestedDataPath.length === 1 && (nestedDataPath[0] === 'message' || nestedDataPath[0] === 'code')`.
    - Si el `queryState` existe pero `queryState.error === null`, devolver `{ found: false }` (alineado con RF-17: degrada en superficies visibles a string vacío y en `visibility` a valor ausente).
    - Si el `queryState.error` existe, devolver `{ found: true, value: queryState.error[nestedDataPath[0]] }`. El `value` puede ser `undefined` cuando `code` no existe; en ese caso usar `{ found: false }` para que el placeholder degrade. El mensaje siempre existe en los errores actuales (no degrada por ausencia salvo ausencia total del error).
  - Mantener el resto de ramas (`property === 'data' && nestedDataPath.length > 0` y el fallback al selector) sin cambios.

**Tests a modificar:**

- `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación; sección de `resolveRuntimeReference`)
- `src/tests/runtime/runtime-layout-visibility.test.ts` (ampliación)
- `src/tests/layout-renderer/layout-renderer-state-feedback.test.tsx` (ampliación; cobertura del placeholder en superficies visibles e interpolación)

**Documentación afectada:**

- `ai-workflow/docs/app-features/references/reference-resolution.md`
- `ai-workflow/docs/app-features/queries/state-model.md`
- `ai-workflow/docs/app-features/references/dynamic-strings.md`
- `ai-workflow/features/index.md`

### Tests

**Ficheros de test:**

- `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación)
- `src/tests/runtime/runtime-layout-visibility.test.ts` (ampliación)
- `src/tests/layout-renderer/layout-renderer-state-feedback.test.tsx` (ampliación)

**Comportamiento cubierto:**

En `runtime-reference-resolution.test.tsx`:

- `resolveRuntimeReference('queries.X.error.message', state)` con `queries.X.status === 'error'`, `queries.X.error = { code: 'http-error', message: 'HTTP 500' }` devuelve `status: 'resolved'`, `value: 'HTTP 500'`.
- `resolveRuntimeReference('queries.X.error.code', state)` con el mismo estado devuelve `status: 'resolved'`, `value: 'http-error'`.
- `resolveRuntimeReference('queries.X.error.message', state)` cuando `queries.X.status === 'success'` (y por tanto `queries.X.error === null`) devuelve `status: 'missing'`.
- `resolveRuntimeReference('queries.X.error.code', state)` con `queries.X` ausente del store devuelve `status: 'missing'`.
- `resolveRuntimeReference('queries.X.error.code', state)` cuando el error existe pero su `code` resulta `undefined` (en caso teórico ya cubierto por shape opcional) devuelve `status: 'missing'`.
- Regresión: `resolveRuntimeReference('queries.X.error', state)` sigue devolviendo el objeto error completo.

En `runtime-layout-visibility.test.ts`:

- `visibility: { reference: 'queries.X.error.code', operator: 'equals', value: 'UNAUTHORIZED' }` con error activo `{ code: 'UNAUTHORIZED', message: '...' }` → nodo visible.
- Mismo `visibility` con error activo `{ code: 'http-error', message: '...' }` → nodo oculto.
- Mismo `visibility` con la query en `idle`/`success`/`loading` (sin error activo) → nodo oculto (`equals` no hace match con valor ausente).
- `visibility: { reference: 'queries.X.error.code', operator: 'isFalsy' }` con la query en `idle` → nodo visible (`isFalsy` matchea valor ausente).
- `visibility: { reference: 'queries.X.error.code', operator: 'isTruthy' }` con error activo y `code: 'business-error-condition'` → nodo visible.
- `visibility: { reference: 'queries.X.error.message', operator: 'isTruthy' }` con error activo cuyo mensaje no esté vacío → nodo visible.

En `layout-renderer-state-feedback.test.tsx`:

- Un `heading` con `text: '{{queries.X.error.message}}'` y query en error con `message: 'No autorizado'` renderiza `No autorizado`.
- Un `paragraph` con `text: '{{queries.X.error.code}}'` y query en error con `code: 'UNAUTHORIZED'` renderiza `UNAUTHORIZED`.
- Un `heading` con `text: 'Error: {{queries.X.error.message}}'` y query en success renderiza `Error: ` (placeholder degrada a string vacío).
- Un `heading` con `text: 'queries.X.error.message'` (referencia completa, sin `{{}}`) y query en error con mensaje no vacío renderiza el mensaje literal.

**Comandos durante la implementación:**

```
pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx
pnpm test --run src/tests/runtime/runtime-layout-visibility.test.ts
pnpm test --run src/tests/layout-renderer/layout-renderer-state-feedback.test.tsx
```

**Restricciones:**

- No tocar `selectNestedQueryDataValue`; esa función sigue siendo solo para `data.*`. La navegación dentro de `error` se resuelve en `resolveSupportedReferenceValue` directamente o vía selector específico.
- Reutilizar el fixture existente de `runtime-reference-resolution.test.tsx` para construir estados (`runtimeState`, `runtimeStateWithNullableValues`, `nestedQueryRuntimeState`); no introducir helpers nuevos salvo si la cobertura los justifica.
- En `layout-renderer-state-feedback.test.tsx`, reusar el harness existente de render con fixtures de queries en error y no añadir un harness paralelo.
- No introducir snapshots de DOM.

### Criterios de finalización

- El resolver devuelve `resolved` para `queries.X.error.message`/`queries.X.error.code` cuando hay error activo y `missing` en cualquier otro caso.
- El nodo `visibility` evalúa correctamente comparaciones literales sobre `error.code` y `error.message`.
- Interpolación `{{queries.X.error.message}}` y `{{queries.X.error.code}}` degrada a string vacío cuando no hay error activo y muestra el valor cuando lo hay.
- `pnpm test --run` de los tres ficheros listados pasa en verde.

### Cierre de implementación

Código y tests de esta tarea completos y validados. T04 queda habilitada.

---

## Tarea 04 — Vaciar `data` al transicionar a `status: error`

**ID:** T04
**Estado:** pendiente
**Depende de:** ninguna (puede ejecutarse en paralelo con T01/T02/T03, pero el orden secuencial es T03 → T04 para evitar reescribir tests)

### Objetivo

Garantizar que cualquier transición a `status: 'error'` en el reducer de queries deja `data: null`, independientemente del valor previo. Esta regla cubre los códigos existentes (`network-error`, `http-error`, `invalid-json-response`, `operation-not-found`, `request-build-failed`) y, por construcción, también el nuevo `business-error-condition` (T05).

### Fuera de alcance

- Evaluación del `errorCondition` (T05).
- Cualquier cambio en `queries/set-success`, `queries/set-loading`, `queries/initialize`, `queries/reset` (no cambian).
- Cualquier cambio en el flujo de preloads que ya resetea queries explícitamente.

### Dependencias

Ninguna estricta; secuencialmente se ubica tras T03 para no tener que reescribir tests existentes de error que dependieran del `data` previo.

### Impacto esperado en archivos

**Código a modificar:**

- `src/runtime/runtime-state/runtime-state-reducer.ts`
  - En el case `queries/set-error` (líneas ~258–270), reemplazar el spread sobre el estado previo de la query por una construcción explícita que fije `data: null`:
    - Mantener `requestSignature` y `status: 'error'` como ahora.
    - Sustituir `...getRuntimeQueryState(state.queries[action.payload.queryName])` por un objeto literal cuyo único punto de partida sea el estado anterior pero con `data` forzado a `null`. La forma literal preferida:
      ```
      [action.payload.queryName]: {
        status: 'error',
        data: null,
        error: action.payload.error,
        requestSignature: action.payload.requestSignature ?? null,
      }
      ```
      Esto elimina la dependencia del spread y deja la invariante explícita en el reducer.
  - Mantener `getRuntimeQueryState` exportado si se usa en otros sitios; no eliminarlo en esta tarea.

**Tests a modificar:**

- `src/tests/runtime-state/runtime-state-operations.test.tsx` (ampliación)
- `src/tests/runtime-state/runtime-state-forms-queries.test.tsx` (ampliación; sección de queries / set-error)

**Documentación afectada:**

- `ai-workflow/docs/app-features/queries/state-model.md` (regla nueva sobre `data: null` en error)
- `ai-workflow/features/index.md`

### Tests

**Ficheros de test:**

- `src/tests/runtime-state/runtime-state-operations.test.tsx` (ampliación)
- `src/tests/runtime-state/runtime-state-forms-queries.test.tsx` (ampliación)

**Comportamiento cubierto:**

En `runtime-state-forms-queries.test.tsx`:

- Dispatch directo del reducer con `queries/set-error` sobre una query con `data` no nulo previo deja `data: null` en el resultado.
- Dispatch directo del reducer con `queries/set-error` sobre una query inexistente (primera ejecución) deja `data: null` también (invariante: ya era null).
- Dispatch directo con `queries/set-error` propaga el `error` y la `requestSignature` correctamente.
- Regresión: dispatch directo con `queries/set-success` después de `set-error` rehidrata `data` normalmente.
- Regresión: `queries/set-loading` conserva el último `data` válido en una recarga (la regla "loading conserva data" sigue vigente y no debe romperse — esto valida que la regla nueva NO afecta a `loading`).

En `runtime-state-operations.test.tsx`:

- Una operación que pasa de success (con datos reales) a error (por `http-error` simulado con `fetch` mock que devuelve 500) deja `queries.X.status === 'error'`, `queries.X.data === null`, `queries.X.error.code === 'http-error'`. Cubre integración del reducer con el flujo completo.
- Una operación que falla con `network-error` también deja `data: null`.
- Una operación que falla con `invalid-json-response` también deja `data: null`.
- Una operación que falla con `operation-not-found` (`operationName` inexistente) también deja `data: null`.
- Una operación que falla con `request-build-failed` (referencia no resoluble en `query`) también deja `data: null`.

**Comandos durante la implementación:**

```
pnpm test --run src/tests/runtime-state/runtime-state-operations.test.tsx
pnpm test --run src/tests/runtime-state/runtime-state-forms-queries.test.tsx
```

**Restricciones:**

- La invariante debe vivir en el reducer, no en cada call site que despacha `queries/set-error`. La firma de la action no cambia.
- No introducir un campo nuevo en el payload de `queries/set-error` para forzar `data: null`; basta con que el reducer la fije siempre.
- No tocar `getRuntimeQueryState` (helper compartido con otros consumidores).
- No mover el test a otra carpeta; reusar los ficheros indicados.
- No introducir snapshots.

### Criterios de finalización

- El reducer fija `data: null` en TODAS las transiciones a `status: 'error'`, sin spread previo.
- Los tests listados verifican el comportamiento para los cinco códigos tipados existentes.
- `pnpm test --run` de los dos ficheros listados pasa en verde.
- Regresión: la suite global de tests sigue verde (algunos tests existentes podrían depender del comportamiento previo; ajustarlos en esta tarea si el contrato cambia para ellos).

### Cierre de implementación

Código y tests de esta tarea completos y validados. T05 queda habilitada.

---

## Tarea 05 — Evaluar `errorCondition` en runtime y emitir `business-error-condition`

**ID:** T05
**Estado:** pendiente
**Depende de:** T01 (los campos en el config deben llegar al executor), T04 (el reducer ya garantiza `data: null` en error; los tests de T05 dependen de esa invariante)

### Objetivo

Cuando una operación recibe una respuesta HTTP 200 con JSON parseable, el executor debe:

1. Si la operación NO declara `errorCondition`, comportarse exactamente como hoy: `status: 'success'` con `data` parseado.
2. Si declara `errorCondition`, evaluar la condición sobre el JSON ya parseado:
   - Resolver el valor en `errorCondition.path` recorriendo el body con la misma navegación dot-notation usada en `resolveNestedReferenceValue` (objetos y arrays con índices numéricos).
   - Si `path` apunta a un segmento ausente → condición NO se cumple → tratar como success normal.
   - Si `equals` está declarado → la condición se cumple si el valor en `path` es estrictamente igual al literal (incluyendo `null === null`).
   - Si `notEquals` está declarado → la condición se cumple si el valor en `path` existe y es distinto del literal.
   - Si ni `equals` ni `notEquals` están declarados → la condición se cumple si el valor en `path` es truthy (`Boolean(value) === true`); `0`, `''`, `null`, `undefined`, `NaN`, `false` no la cumplen.
3. Si la condición se cumple:
   - Extraer `error.message`: resolver `errorMessagePath` sobre el body con la misma navegación. Si el valor resuelto es string no vacío, usarlo; en otro caso, usar el literal exacto `"Error en la respuesta del servidor"`.
   - Extraer `error.code`: resolver `errorCodePath` sobre el body. Si el valor resuelto es `string` o `number`, coercerlo a `String(value)` y usarlo; en otro caso, usar el literal `"business-error-condition"`.
   - Devolver `{ status: 'error', error: { code, message } }`. El callsite del provider despacha `queries/set-error` (ya fija `data: null` gracias a T04).
4. Si la condición NO se cumple, devolver `{ status: 'success', data }` con el JSON parseado.

Adicionalmente:

- Añadir `'business-error-condition'` al union `code` de `RuntimeApiError` en `runtime-api-types.ts`.
- Si la respuesta HTTP NO es `ok` (4xx/5xx), `errorCondition` NO se evalúa: se sigue produciendo `http-error` como hoy (RF-2.6).
- Si la respuesta es 204 No Content o body vacío, `errorCondition` NO se evalúa (no hay JSON sobre el que evaluar; `data: null` con `status: success`, paridad con comportamiento actual).
- Si el JSON parseado es inválido, `errorCondition` NO se evalúa: se sigue produciendo `invalid-json-response` como hoy.

### Fuera de alcance

- Cualquier cambio en otras superficies de error (`http-error`, `network-error`, `invalid-json-response`, `operation-not-found`, `request-build-failed`); su semántica se conserva.
- Múltiples `errorCondition` por endpoint, condiciones compuestas, rangos numéricos, headers, combinación con status HTTP, transformaciones del body — todos fuera de alcance por spec.
- Cambios en la resolución de referencias del runtime (T03 ya cubre `error.message`/`error.code`).
- Cambios en preloads (los preloads usan la misma fachada `buildRuntimeApiRequest` + `executeBuiltRuntimeApiRequest`, así que heredan el comportamiento automáticamente cuando declaran `errorCondition` en el catálogo; esta tarea no añade lógica específica a preloads).

### Dependencias

T01, T04. Recomendable T03 cerrada antes para que los tests de T05 puedan ejercer `queries.X.error.code` en interpolación y `visibility` como cobertura integrada.

### Impacto esperado en archivos

**Código a modificar:**

- `src/queries/runtime-api-types.ts`
  - Añadir `'business-error-condition'` al union `code` de `RuntimeApiError`. Mantener el resto del union sin cambios.
- `src/queries/runtime-api-executor.ts`
  - Cambiar la rama de éxito tras `JSON.parse`: en lugar de devolver `{ status: 'success', data: parsed }` directamente, llamar a una nueva función `evaluateErrorCondition(operation, parsed)` que devuelva o `{ status: 'success', data: parsed }` o `{ status: 'error', error: { code, message } }`.
  - Importar el `RuntimeApiOperation` desde el request (`request.operation`) para acceder a `errorCondition`, `errorMessagePath`, `errorCodePath`.
  - Implementación literal de la nueva rama:
    ```
    const parsed = JSON.parse(responseText) as unknown
    return evaluateErrorCondition(request.operation, parsed, request.operationName)
    ```
- `src/queries/runtime-api-executor.ts` (nuevo helper interno o en módulo hermano)
  - Añadir helper privado `evaluateErrorCondition(operation, parsed, operationName)`:
    - Si `operation.errorCondition === undefined`, devolver `{ status: 'success', data: parsed }`.
    - Resolver `valueAtPath = resolveBodyPath(parsed, operation.errorCondition.path)`. `resolveBodyPath` recorre por dot-notation; segmentos numéricos actúan como índice solo cuando el nodo actual es array; ausencia devuelve `{ found: false }`.
    - Si `valueAtPath.found === false`, devolver `{ status: 'success', data: parsed }`.
    - Calcular `conditionMet`:
      - Si `operation.errorCondition.equals !== undefined` → `valueAtPath.value === operation.errorCondition.equals`.
      - Si `operation.errorCondition.notEquals !== undefined` → `valueAtPath.value !== operation.errorCondition.notEquals`.
      - Si ninguno → `Boolean(valueAtPath.value)`.
    - Si `conditionMet === false`, devolver `{ status: 'success', data: parsed }`.
    - Si `conditionMet === true`:
      - `message`: si `operation.errorMessagePath` declarado, resolver `messageValue = resolveBodyPath(parsed, operation.errorMessagePath)`. Si `messageValue.found && typeof messageValue.value === 'string' && messageValue.value.length > 0`, usarlo; en otro caso, `'Error en la respuesta del servidor'`.
      - `code`: si `operation.errorCodePath` declarado, resolver `codeValue = resolveBodyPath(parsed, operation.errorCodePath)`. Si `codeValue.found && (typeof codeValue.value === 'string' || typeof codeValue.value === 'number')`, usar `String(codeValue.value)`; en otro caso, `'business-error-condition'`.
      - Devolver `{ status: 'error', error: { code, message } }`.
  - El helper `resolveBodyPath` debe vivir en este módulo (o en un helper hermano dentro de `src/queries/`) para mantener la separación con `runtime-references/`. Reutilizar la lógica de `resolveNestedReferenceValue` solo si se puede extraer sin acoplar a `RuntimeIterationContext`; si no, replicar la pequeña lógica de recorrido (recorre por segmento; índice numérico solo si array). No exportar como API pública.

**Tests a modificar:**

- `src/tests/runtime/runtime-api-execution.test.ts` (ampliación)

**Tests a crear:** ninguno; la suite `runtime-api-execution.test.ts` ya es el punto natural de cobertura del executor.

**Documentación afectada:**

- `ai-workflow/docs/app-features/queries/execution.md` (nuevo bullet con `business-error-condition`, `errorCondition`, extracción de `message`/`code`)
- `ai-workflow/docs/app-features/queries/state-model.md` (mención del nuevo código tipado en el ciclo de error)
- `ai-workflow/docs/app-features/config/api-catalog.md` (referencia cruzada al evaluador)
- `ai-workflow/features/index.md`

### Tests

**Ficheros de test:**

- `src/tests/runtime/runtime-api-execution.test.ts` (ampliación)

**Comportamiento cubierto:**

Caminos felices y fallos cubiertos por los criterios de aceptación de la spec:

- Sin `errorCondition`: respuesta 200 con JSON `{ ok: true }` → `status: 'success'`, `data: { ok: true }`. Regresión obligatoria.
- `errorCondition: { path: "code", notEquals: 200 }`, `errorMessagePath: "message"`, `errorCodePath: "code"`, body `{ code: 500, message: "Error interno" }` → `status: 'error'`, `error: { code: "500", message: "Error interno" }`.
- `errorCondition: { path: "success", equals: false }`, `errorMessagePath: "error.message"`, `errorCodePath: "error.code"`, body `{ success: false, error: { message: "No autorizado", code: "UNAUTHORIZED" } }` → `status: 'error'`, `error: { code: "UNAUTHORIZED", message: "No autorizado" }`.
- `errorCondition: { path: "code", equals: null }`, body `{ code: null }` → condición cumplida → `status: 'error'`; con `errorMessagePath`/`errorCodePath` ausentes, `error.message === 'Error en la respuesta del servidor'`, `error.code === 'business-error-condition'`.
- `errorCondition: { path: "ok" }` (truthiness), body `{ ok: true }` → `status: 'error'`.
- `errorCondition: { path: "ok" }` (truthiness), body `{ ok: false }` → `status: 'success'`.
- `errorCondition: { path: "ok" }` (truthiness), body `{ ok: 0 }` → `status: 'success'` (`0` no es truthy).
- `errorCondition: { path: "ok" }` (truthiness), body `{ ok: "" }` → `status: 'success'` (string vacío no es truthy).
- `errorCondition: { path: "deeply.nested.flag", equals: true }`, body `{ deeply: { nested: { flag: true } } }` → condición cumplida.
- `errorCondition: { path: "items.0.broken", equals: true }`, body `{ items: [ { broken: true } ] }` → condición cumplida (índice numérico sobre array).
- `errorCondition: { path: "missing.deep" }`, body `{ }` → condición no se cumple → `status: 'success'` (RF-2.10).
- `errorCondition: { path: "code", notEquals: 200 }`, body `{ code: 200 }` → condición no se cumple → `status: 'success'`.
- `errorCondition: { path: "code", notEquals: 200 }`, body `{ code: 500 }` con `errorMessagePath` ausente → `error.message === 'Error en la respuesta del servidor'` (default literal).
- `errorCondition: { path: "code", notEquals: 200 }`, body `{ code: 500 }` con `errorMessagePath: "message"` pero el campo `message` ausente → `error.message === 'Error en la respuesta del servidor'`.
- `errorCondition: { path: "code", notEquals: 200 }`, body `{ code: 500, message: "" }` con `errorMessagePath: "message"` → `error.message === 'Error en la respuesta del servidor'` (string vacío no cuenta).
- `errorCondition: { path: "code", notEquals: 200 }`, body `{ code: 500, message: 42 }` con `errorMessagePath: "message"` → `error.message === 'Error en la respuesta del servidor'` (no string).
- `errorCondition: { path: "code", notEquals: 200 }`, body `{ code: 500 }` con `errorCodePath: "code"` → `error.code === '500'` (number coercionado a string).
- `errorCondition: { path: "code", notEquals: 200 }`, body `{ code: 500 }` con `errorCodePath: "missing"` → `error.code === 'business-error-condition'`.
- `errorCondition: { path: "code", notEquals: 200 }`, body `{ code: 500, customCode: { nested: true } }` con `errorCodePath: "customCode"` → `error.code === 'business-error-condition'` (no string/number).
- `errorCondition: { path: "code", notEquals: 200 }`, body `{ code: 500 }` SIN `errorCodePath` declarado → `error.code === 'business-error-condition'`.
- Respuesta HTTP 500 con cualquier `errorCondition` declarado → sigue produciendo `code: 'http-error'`; `errorCondition` NO se evalúa (RF-2.6, criterio de aceptación 4).
- Respuesta HTTP 204 con `errorCondition` declarado → sigue produciendo `{ status: 'success', data: null }` (RF: body vacío no evalúa).
- Respuesta HTTP 200 con body vacío y `errorCondition` declarado → sigue produciendo `{ status: 'success', data: null }`.
- Respuesta HTTP 200 con JSON inválido y `errorCondition` declarado → sigue produciendo `code: 'invalid-json-response'`.
- El nuevo código `business-error-condition` se reporta en el `RuntimeApiError.code` y es asignable al tipo (test de tipo implícito: el helper debe compilar usando `'business-error-condition'` como literal del union).

Integración con T03/T04 (cobertura cruzada en este mismo fichero o en `runtime-state-operations.test.tsx` si encaja con su carpeta; preferir mantener en `runtime-api-execution.test.ts`):

- Tras una operación con `errorCondition` que dispara error, `data` queda `null` (cobertura cruzada de T04; el integrador verifica que la regla del reducer se aplica al nuevo código tipado).
- Una operación que primero responde success con datos reales y luego falla por `errorCondition` deja `data: null` y `error.code` extraído (criterio de aceptación 8). Verificar transición explícita en un test de integración con dos disparos consecutivos.

**Comandos durante la implementación:**

```
pnpm test --run src/tests/runtime/runtime-api-execution.test.ts
```

Tras pasar el fichero anterior, ejecutar la suite global para confirmar regresión:

```
pnpm test
```

**Restricciones:**

- El evaluador del body vive en `src/queries/`; no introducir dependencias hacia `src/runtime/runtime-references/`.
- No exponer `evaluateErrorCondition` ni `resolveBodyPath` como API pública del módulo `runtime-api-executor`; mantenerlos como helpers internos.
- La comparación `equals`/`notEquals` con `null` debe respetar `=== null` y `!== null` (sin coerción).
- La extracción de `error.message` rechaza string vacío como fallback al literal genérico.
- La extracción de `error.code` admite `string` y `number`; cualquier otro tipo cae al typed default.
- Cuando ambas extracciones caen al default, `error.message === 'Error en la respuesta del servidor'` y `error.code === 'business-error-condition'`.
- No tocar `RuntimeApiError.message` (sigue siendo `string` requerido).
- Reutilizar la maquinaria de tests existente (`fetch` mock con `Response`) sin duplicar fixtures.
- No introducir snapshots.

### Criterios de finalización

- `RuntimeApiError.code` incluye `'business-error-condition'` en su union.
- `executeBuiltRuntimeApiRequest` evalúa `errorCondition` solo cuando la respuesta es 200 con JSON válido y la operación lo declara.
- El cálculo de `equals`, `notEquals` y truthiness coincide con la spec y los criterios de aceptación.
- El default literal `'Error en la respuesta del servidor'` se usa exactamente cuando corresponde.
- El default `'business-error-condition'` se usa exactamente cuando corresponde.
- `pnpm test --run src/tests/runtime/runtime-api-execution.test.ts` pasa en verde.
- `pnpm test` pasa en verde con el umbral global de cobertura (≥ 80%) sin regresiones.

### Cierre de implementación

Código y tests de esta tarea completos y validados. La feature está implementada completamente en su lado de runtime y validación; la documentación afectada (declarada en cada tarea) se actualizará mediante invocación posterior de `update-app-documentation`.
