# 0092 — Repeater: literal reservado `$index` — Plan de implementación

## Resumen del cambio

Tres ejes independientes pero coordinados:

1. **Validación de configuración**: ampliar `isValidRepeaterItemKeyPath` para aceptar el literal `"$index"` como valor válido en `repeater.props.items.key`.
2. **Iteración del repeater**: añadir una rama `$index` en `resolveRepeaterIterations` que use el índice numérico como React key y omita la detección de duplicados.
3. **Referencia sintética `item.$index`**: extender el parser y el resolver de referencias para exponer `item.$index` como número dentro del subárbol iterado de cualquier repeater, con precedencia sobre propiedades literales `$index` del valor del item.

---

## T1 — Validación de configuración: aceptar `"$index"` en `props.items.key`

**Estado**: pendiente

**Objetivo**: que la validación del JSON de configuración acepte `"$index"` como valor válido en `repeater.props.items.key`, al mismo nivel que `"$key"`, y rechace variantes malformadas como `"$index.algo"`, `"meta.$index"`, etc.

**Fuera de alcance**: lógica de runtime del repeater, resolución de referencias, cualquier cambio en el parser o resolver de `item.$index`.

**Dependencias**: ninguna.

**Impacto esperado en archivos**:
- `src/config/validate-layout-nodes.ts` — modificar `isValidRepeaterItemKeyPath` (~línea 2595) para añadir `value === '$index'` como caso válido, junto al existente `value === '$key'`.
- `src/tests/config-validation/runtime-config-validation-repeater.test.ts` — ampliación con nuevos casos de aceptación y rechazo.

**Tests**:

- **Ficheros de test**:
  - `src/tests/config-validation/runtime-config-validation-repeater.test.ts` (ampliación)

- **Comportamiento cubierto**:
  - Un repeater con `key: "$index"` y un template válido es aceptado por `validateRuntimeConfig` y devuelve `status: 'ready'` con el literal `"$index"` preservado en la config validada.
  - Los valores `"$index.algo"`, `"$index.$key"`, `"meta.$index"` siguen siendo rechazados con el error `invalid-layout` existente (ampliar el array de casos del test `rejects "$"-prefixed key values other than the exact literal "$key"`).

- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-repeater.test.ts`

- **Restricciones**: reusar la estructura del test existente `accepts the reserved literal "$key"` como modelo para el test de aceptación de `"$index"`.

**Documentación afectada**: `ai-workflow/docs/app-features/nodes/repeater.md` (contrato de `props.items.key`).

**Criterios de finalización**:
- cierre de implementación: `isValidRepeaterItemKeyPath` acepta `"$index"`, los tests nuevos están en verde, `pnpm test` pasa.

---

## T2 — Iteración del repeater: `$index` como React key

**Estado**: pendiente

**Objetivo**: cuando `props.items.key` es `"$index"`, el repeater usa el índice numérico de iteración (0, 1, 2…) como React key para cada elemento, sin detección de duplicados ni diagnósticos de key inválida. Funciona tanto con fuentes array como con fuentes objeto plano.

**Fuera de alcance**: la propiedad sintética `item.$index` (eso es T3). Esta tarea solo cambia la lógica de key del repeater. El `iterationContext` que se pasa a los hijos no cambia aquí.

**Dependencias**: T1 (la validación debe aceptar `"$index"` antes de que el runtime lo reciba).

**Impacto esperado en archivos**:
- `src/runtime/nodes/repeater-layout-node.tsx` — modificar `resolveRepeaterIterations` (~línea 314) para añadir una rama `keyPath === '$index'` que asigne `String(index)` como `effectiveKey` y salte la detección de duplicados.
- `src/tests/layout-renderer/layout-renderer-repeater-basic.test.tsx` — ampliación con tests de render para `key: "$index"`.

**Tests**:

- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-repeater-basic.test.tsx` (ampliación)

- **Comportamiento cubierto**:
  - Un repeater con `key: "$index"` sobre un array de strings (`["a", "b", "c"]`) renderiza tres expansiones del template. Cada expansión muestra el string correspondiente vía `item` (referencia al item directo) como texto visible.
  - Un repeater con `key: "$index"` sobre un array de objetos renderiza una expansión por elemento; `item.title` se resuelve correctamente dentro de cada iteración.
  - Un repeater con `key: "$index"` sobre un objeto plano renderiza una expansión por entrada con la posición ordinal como React key; `item.label` se resuelve contra el valor de cada entrada.
  - Un repeater con `key: "$index"` sobre un array donde algún elemento es `null` o un primitivo renderiza la iteración normalmente sin omitir entradas (a diferencia de `key: "id"` que omitiría items sin la propiedad `id`).
  - Un repeater con `key: "$index"` sobre un array con valores duplicados (`["a", "a", "b"]`) renderiza tres iteraciones sin omitir ninguna, porque los índices (0, 1, 2) son inherentemente únicos.
  - Un repeater con `key: "$index"` paginado aplica `pageSize` correctamente y muestra solo los items de la primera página.

- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-basic.test.tsx`

- **Restricciones**: reusar el harness `renderRuntimePageWithState` y `createRuntimePageState` ya existentes en el fichero de test.

**Documentación afectada**: `ai-workflow/docs/app-features/nodes/repeater.md`.

**Criterios de finalización**:
- cierre de implementación: la rama `$index` en `resolveRepeaterIterations` funciona, los tests nuevos están en verde, `pnpm test` pasa.

---

## T3 — Referencia sintética `item.$index`

**Estado**: pendiente

**Objetivo**: exponer `item.$index` como propiedad sintética dentro del subárbol iterado de cualquier repeater, independientemente del valor de `props.items.key`. `item.$index` devuelve el índice numérico (0, 1, 2…) de la iteración actual como número. Tiene precedencia sobre cualquier propiedad literal `$index` del valor del item.

**Fuera de alcance**: el uso de `$index` como valor de `props.items.key` (ya cubierto por T1 y T2). El soporte de `item.$index` en consumidores de colecciones fuera de repeater (`list`, `select`, `radioGroup`, `checkboxGroup`).

**Dependencias**: T2 (el índice ya debe estar disponible como parte de la iteración del repeater).

**Impacto esperado en archivos**:
- `src/runtime/runtime-references/runtime-reference-parser.ts` — añadir constante `ITEM_INDEX_SYNTHETIC_SEGMENT = '$index'` (~línea 13) y ampliar la validación de shape en `hasValidReferenceShape` (~línea 115) para aceptar `item.$index` como forma válida, análoga a `item.$key`.
- `src/runtime/runtime-references/runtime-reference-resolver.ts` — ampliar `RuntimeIterationContext` (~línea 19) con un campo `itemIndex: number`, y ampliar `resolveSupportedReferenceValue` (~línea 259) para resolver `item.$index` devolviendo `iterationContext.itemIndex` como número. La nueva rama debe preceder la navegación genérica `resolveNestedReferenceValue`, dándole precedencia sobre propiedades literales `$index`.
- `src/runtime/nodes/repeater-layout-node.tsx` — modificar el push a `iterations` (~línea 347) y la construcción de `iterationContext` (~línea 109) para incluir `itemIndex: index` (el índice del loop de iteración, que corresponde a la posición ordinal en la colección fuente).
- `src/tests/layout-renderer/layout-renderer-repeater-basic.test.tsx` — ampliación con tests de render para `item.$index`.
- `src/tests/runtime/runtime-reference-resolution.test.tsx` — ampliación con tests unitarios del parser y resolver para `item.$index`.

**Tests**:

- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-repeater-basic.test.tsx` (ampliación)
  - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación)

- **Comportamiento cubierto**:
  - `parseRuntimeReference('item.$index', { allowItemReference: true })` devuelve una referencia soportada con `namespace: 'item'` y `path: ['$index']`.
  - `parseRuntimeReference('item.$index', { allowItemReference: false })` devuelve una referencia no soportada (mismo patrón que `item.$key`).
  - `parseRuntimeReference('item.$index.algo')` devuelve una referencia inválida.
  - `resolveRuntimeReference('item.$index', state, { iterationContext: { item: { $index: 'shadow' }, key: '0', itemIndex: 2 } })` devuelve `{ status: 'resolved', value: 2 }` — precedencia sobre la propiedad literal.
  - `resolveRuntimeReference('item.$index', state, { iterationContext: { item: {}, key: '0', itemIndex: 0 } })` devuelve `{ status: 'resolved', value: 0 }` — funciona con índice 0.
  - Un repeater con `key: "id"` (no `$index`) renderiza `{{item.$index}}` como el índice numérico (0, 1, 2…) dentro de cada iteración, demostrando que `item.$index` es independiente del valor de `key`.
  - Un repeater con `key: "$index"` también expone `{{item.$index}}` con el mismo valor que la React key.
  - Un repeater con fuente objeto plano expone `item.$index` como la posición ordinal (0, 1, 2…), no la clave del diccionario.
  - `item.$index` tiene precedencia: un item con propiedad literal `$index` sigue devolviendo el índice numérico de iteración, no el valor de la propiedad interna.
  - Un repeater paginado con `pageSize: 3` y 6 items, al navegar a la segunda página, expone `{{item.$index}}` como 3, 4, 5 (posición en la colección completa), no como 0, 1, 2 (posición relativa a la página visible).

- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-basic.test.tsx`
  - `pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx`

- **Restricciones**: seguir el patrón exacto de `ITEM_KEY_SYNTHETIC_SEGMENT` / `item.$key` en parser y resolver. El campo `itemIndex` en `RuntimeIterationContext` debe ser `number`, no `string`, para que el valor resuelto sea numérico.

**Documentación afectada**: `ai-workflow/docs/app-features/nodes/repeater.md`, `ai-workflow/docs/app-features/references/reference-resolution.md`.

**Criterios de finalización**:
- cierre de implementación: `item.$index` se resuelve correctamente en parser y resolver, los tests de render y de resolución de referencias están en verde, `pnpm test` pasa con cobertura ≥ 80%.
