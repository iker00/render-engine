# Tasks: length-formatter — formatter `length` para arrays y strings

## Orden de ejecución
Una única tarea, sin dependencias externas al plan.

- **T1** — bloquea el cierre de la feature. Es la única tarea del plan.

---

## T1 — Añadir formatter `length` al catálogo central y cubrir su comportamiento en todas las superficies documentadas

### Objetivo
Añadir `length` al catálogo cerrado v1 de `RUNTIME_FORMATTER_REGISTRY`
(`src/runtime/runtime-references/runtime-formatter-registry.ts`): sin argumento, acepta `array` (cuenta
elementos) y `string` (cuenta caracteres en unidades UTF-16, mismo criterio que ya usa `truncate`), y trata
cualquier otro tipo de entrada (`object` plano, `number`, `boolean`, `null`, `undefined`, `NaN`, `Infinity`)
como entrada incompatible. La resolución de la cadena de formatters (`applyFormatterChain`) es agnóstica de
superficie: no requiere cambios propios para que `length` funcione en superficies visibles, en las cuatro
superficies de headers o en `api.endpoint`. Esta tarea también cubre con tests esas tres superficies para
demostrar que el catálogo ampliado se propaga correctamente sin más cambios de producción.

### Fuera de alcance
- Alias del formatter (`count`, `size`, etc.).
- Soporte de entrada `object` (contar claves).
- Cualquier cambio en `runtime-formatter-parser.ts`: la gramática de placeholders ya es genérica y no requiere
  cambios para reconocer `length` como nombre de formatter.
- Cualquier cambio en cómo el backend expone contadores.
- Cambios en `dynamic-strings.md` u otra documentación: la actualización documental se hace en una pasada
  posterior con `update-app-documentation`.

### Dependencias
Ninguna. Es la primera y única tarea del plan.

### Interfaces
- **Consume**: ninguno.
- **Produce**: `applyLength(value: unknown, argument: RuntimeFormatterArgument): RuntimeFormatterChainResult`
  registrada como `RUNTIME_FORMATTER_REGISTRY.length = { argument: 'none', apply: applyLength }` — sin
  consumidores directos dentro de este plan (no hay tareas posteriores que la consuman explícitamente; queda
  disponible vía `applyFormatterChain`, que ya itera genéricamente sobre `RUNTIME_FORMATTER_REGISTRY`).

### Impacto esperado en archivos

**Código**
- `src/runtime/runtime-references/runtime-formatter-registry.ts` (modificar):
  - añadir `'length'` a la unión `RuntimeFormatterName`.
  - implementar `applyLength(value, argument)`: si `argument.kind !== 'none'` → `UNRESOLVABLE`; si
    `Array.isArray(value)` → `{ status: 'ok', value: value.length }`; si `typeof value === 'string'` →
    `{ status: 'ok', value: value.length }` (unidades UTF-16, sin `Array.from` ni `Intl.Segmenter`); cualquier
    otro caso → `UNRESOLVABLE`.
  - registrar `length: { argument: 'none', apply: applyLength }` en `RUNTIME_FORMATTER_REGISTRY`.
  - no modificar `applyFormatterChain` ni `findFirstFailingFormatterName`: ambas funciones ya son genéricas
    sobre las claves de `RUNTIME_FORMATTER_REGISTRY` y no requieren cambios.

**Tests**
- `src/tests/runtime/runtime-formatter-registry.test.ts` (ampliación)
- `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación)
- `src/tests/runtime/runtime-api-header-interpolation.test.ts` (ampliación)
- `src/tests/runtime/runtime-api-execution.test.ts` (ampliación)

**Documentación**
- `ai-workflow/docs/app-features/references/dynamic-strings.md`: revisar tras el cierre de implementación
  (tabla del catálogo v1 y tabla de compatibilidad de entrada por formatter). Actualización diferida a
  `update-app-documentation`.

### Tests

#### Ficheros de test
- `src/tests/runtime/runtime-formatter-registry.test.ts` (ampliación) — tests unitarios del formatter en
  aislamiento y dentro de `applyFormatterChain`.
- `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación) — comportamiento en superficies
  visibles, dentro del bloque existente `describe('T0101 formatters in visible interpolation', ...)`.
- `src/tests/runtime/runtime-api-header-interpolation.test.ts` (ampliación) — comportamiento en superficie de
  headers, dentro del bloque existente `describe('resolveHeaders — formatter failures produce
  request-build-failed', ...)`.
- `src/tests/runtime/runtime-api-execution.test.ts` (ampliación) — comportamiento en `api.endpoint`, dentro del
  bloque existente `describe('formatters in endpoint interpolation (feature 0101)', ...)`.

#### Comportamiento cubierto

En `runtime-formatter-registry.test.ts`, nuevo `describe('RUNTIME_FORMATTER_REGISTRY.length', ...)`:
- sobre un array de 5 elementos, `apply('length', array)` devuelve `{ status: 'ok', value: 5 }`.
- sobre un array vacío (`[]`), devuelve `{ status: 'ok', value: 0 }`.
- sobre el string `"hola"`, devuelve `{ status: 'ok', value: 4 }`.
- sobre el string vacío (`""`), devuelve `{ status: 'ok', value: 0 }`.
- sobre un string con un emoji compuesto por varios code units UTF-16 (por ejemplo `'😀'`), devuelve el conteo
  de code units (`.length` nativo), no el conteo por grafema.
- sobre `number`, `boolean`, `null`, `undefined`, `Number.NaN`, `Number.POSITIVE_INFINITY` y un objeto plano
  (`{}`), devuelve `{ status: 'unresolvable' }` para cada valor.
- con `stringArg(...)` o `numberArg(...)` en vez de `noArg`, devuelve `{ status: 'unresolvable' }` (formatter
  sin argumento, mismo patrón que `uppercase`).

En el mismo fichero, ampliar `describe('applyFormatterChain', ...)`:
- `applyFormatterChain(array de 1500 elementos, [{name:'length'}, {name:'number'}])` produce
  `{ status: 'ok', value: '1.500' }`, demostrando que la salida de `length` encadena con `number`.
- `applyFormatterChain('ana', [{name:'uppercase'}, {name:'length'}])` produce
  `{ status: 'ok', value: 3 }`.
- `applyFormatterChain(array de 5 elementos, [{name:'length'}, {name:'uppercase'}])` produce
  `{ status: 'ok', value: '5' }` (sin cambio visible, `uppercase` sobre un string numérico no lo modifica).

En `runtime-reference-resolution.test.tsx` (superficie visible, vía `resolveRuntimeVisibleValue`):
- `{{queries.list.data.items | length}}` con `queries.list.data.items` = array de 5 elementos produce `"5"`.
- `{{queries.list.data.items | length}}` con array vacío produce `"0"`.
- `{{queries.name.data | length}}` con `queries.name.data` = `"hola"` produce `"4"`.
- `{{queries.list.data.items | length | number}}` con un array de 1500 elementos produce `"1.500"`.
- `{{queries.obj.data | length}}` con `queries.obj.data` = objeto plano produce string vacío en ese
  placeholder, sin afectar al texto literal alrededor.
- `{{queries.total.data | length}}` con `queries.total.data` = número produce string vacío en ese placeholder.
- `{{queries.list.data.items | length:2}}` (argumento no esperado) produce string vacío en ese placeholder.
- `{{queries.name.data | uppercase | length}}` con `queries.name.data` = `"hola"` produce `"4"` (cadena
  texto→length ya documentada como caso explícito en la spec).

En `runtime-api-header-interpolation.test.ts` (superficie de headers, vía `resolveHeaders`):
- un header cuyo valor es `{{queries.total.data | length}}` con `queries.total.data` = número produce
  `request-build-failed` para la operación completa (no string vacío), reutilizando el mismo patrón que el
  test existente de `date` sobre input no-ISO.

En `runtime-api-execution.test.ts` (superficie `api.endpoint`):
- un endpoint `'/n/{{queries.list.data.items | length}}'` con `queries.list.data.items` = array de 5 elementos
  resuelve la URL final con `5` en esa posición, reutilizando el mismo patrón que el test existente de
  `uppercase` en interpolación de endpoint.

#### Comandos durante la implementación
```
pnpm test --run src/tests/runtime/runtime-formatter-registry.test.ts
pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx
pnpm test --run src/tests/runtime/runtime-api-header-interpolation.test.ts
pnpm test --run src/tests/runtime/runtime-api-execution.test.ts
```

#### Restricciones
- Reutilizar los helpers ya existentes en cada fichero (`noArg`/`stringArg`/`numberArg`/`apply(...)` en
  `runtime-formatter-registry.test.ts`; `formatterState`/`resolveRuntimeVisibleValue` en
  `runtime-reference-resolution.test.tsx`; los helpers de `resolveHeaders` en
  `runtime-api-header-interpolation.test.ts`; los helpers de construcción de operación en
  `runtime-api-execution.test.ts`) en vez de crear infraestructura de test nueva.
- No añadir soporte de argumento para `length`; `length:2` debe cubrirse como caso de argumento no esperado
  (mismo criterio que ya aplica `uppercase`/`lowercase`/`capitalize` frente a un argumento no admitido), no
  como una variante soportada del formatter.
- Contar caracteres de string con `.length` nativo de JS (unidades UTF-16). No usar `Array.from`,
  `Intl.Segmenter` ni ninguna forma de conteo por grafema.
- No añadir un nuevo `describe` de nivel superior para la superficie `api.endpoint` ni para headers si el
  bloque existente ya agrupa formatters de esta feature (0101); añadir los casos de `length` como nuevos `it`
  dentro de los `describe` ya listados arriba.

### Documentación afectada
`ai-workflow/docs/app-features/references/dynamic-strings.md` (tabla del catálogo v1 y tabla de compatibilidad
de valor de entrada por formatter).

### Criterios de finalización
- `RUNTIME_FORMATTER_REGISTRY` incluye `length` con la semántica de entrada y de argumento descrita arriba.
- Los cuatro ficheros de test listados están ampliados con los casos descritos y en verde.
- `pnpm test` completo sigue en verde y no rompe el umbral de cobertura del proyecto (80% sobre `src/`).
- Ningún formatter existente ni ningún placeholder sin `length` cambia de comportamiento.

### Cierre de implementación
Código y tests de esta tarea completos y validados: los cuatro comandos de test de la sección "Comandos
durante la implementación" pasan, y `pnpm test` global se mantiene en verde con el umbral de cobertura
cumplido.
