# Tasks: Runtime state provider decomposition

## Contexto de ejecución

Feature mecánica de reorganización de código con adición de tests unitarios. **No debe cambiar ningún
comportamiento observable** de preloads, navegación ni queries. Las firmas de función, los cuerpos y el orden de
las llamadas se mueven tal cual, sin reescritura ni "mejoras" de paso.

Red de seguridad durante todo el plan: la suite de integración existente
(`src/tests/runtime/runtime-page-entry-preloads.test.tsx`, `src/tests/runtime-state/runtime-state-forms-queries.test.tsx`,
`src/tests/runtime-state/runtime-state-navigation.test.tsx`, `src/tests/runtime/runtime-global-preloads.test.tsx`)
ya ejercita estas funciones de forma indirecta. **Ninguna aserción de esos ficheros puede modificarse.** Si una de
esas suites se pone en rojo tras un movimiento, el movimiento está mal hecho: corregir el movimiento, nunca el test.

### Qué significa "en verde" en los comandos por fichero

**Importante, verificado en este repo**: `package.json` define `"test": "vitest run --coverage …"` y
`vitest.config.ts` fija `coverage.all: true` con umbrales globales del 80% en `functions`, `lines` y `statements`.
Por eso **cualquier ejecución filtrada a un solo fichero termina con exit code 1** aunque todas sus aserciones
pasen, con un mensaje del tipo
`ERROR: Coverage for lines (0.51%) does not meet global threshold (80%)`.

Regla para todas las tareas de este plan:

- En los comandos `pnpm test --run <ruta>` de cada tarea, lo único que cuenta es el resultado de las aserciones:
  la línea `Test Files … passed` y `Tests … passed`.
- El error de umbral global en una ejecución filtrada es **esperado** y no indica regresión. No es motivo para
  tocar código de producción ni para editar tests.
- El gate real de cobertura se evalúa **solo** con `pnpm test` completo, sin filtro (criterio 5 de T3 y bloque
  "Verificación final de la feature").

### Hechos verificados contra el código (fuente de verdad para el plan)

Verificado sobre `src/runtime/runtime-state/runtime-state-provider.tsx` (606 líneas):

- **Grafo de dependencias interno entre las 8 funciones** (condiciona que el movimiento sea atómico):
  - Hojas sin dependencias entre sí: `arePageParamsEqual`, `arePreloadNamesEqual`, `createPreloadPlanningSnapshot`,
    `deriveAggregatePageEntryStatus`, `createPlannedPreloadBatchSignature`.
  - `isMatchingPageEntryState` → llama a `arePageParamsEqual` y `arePreloadNamesEqual`.
  - `evaluatePreloadExecution` → solo depende de `buildRuntimeApiRequest` (externa).
  - `planPagePreloadExecution` → llama a `createPreloadPlanningSnapshot`, `evaluatePreloadExecution`,
    `deriveAggregatePageEntryStatus`, `createPlannedPreloadBatchSignature` y a `matchesVisibilityRule` (externa).
  - **Consecuencia**: las 8 forman un grupo cerrado. Ninguna depende de `createRuntimeStateFromBrowserHash` ni de
    `replaceBrowserHash`, y ninguna función que se queda en el provider es llamada por ellas. Extraerlas en dos
    tandas obligaría a un import de vuelta hacia `runtime-state-provider.tsx`, prohibido por el requisito no
    funcional 1. Por eso T2 las mueve **todas de una vez**, en un único cambio.
- **Uso de los tipos**: `PlannedPreloadReloadItem` solo se usa dentro del código que se mueve (definición de
  `PlannedPreloadBatch` y cast `[] as PlannedPreloadReloadItem[]` en `planPagePreloadExecution`).
  `PlannedPreloadBatch` **sí** se usa en el componente (`useRef<PlannedPreloadBatch | null>(null)`), así que el
  provider debe reimportarlo como tipo.
- **Qué consume realmente el provider tras el movimiento**: solo 4 de las 8 funciones
  (`arePageParamsEqual` y `arePreloadNamesEqual` en el efecto de reconciliación, `isMatchingPageEntryState` en
  cuatro puntos, `planPagePreloadExecution` en uno). Las otras 4 (`evaluatePreloadExecution`,
  `createPreloadPlanningSnapshot`, `deriveAggregatePageEntryStatus`, `createPlannedPreloadBatchSignature`) son
  internas del grupo movido. **Aun así las 8 se exportan**, tal como exigen el requisito funcional 1 y el criterio
  de aceptación 3, porque el fichero de test unitario de T3 las ejercita directamente. No "corregir" esto
  reduciendo la superficie exportada.
- **Ausencia de consumidores externos**: ninguna de las 8 funciones, ninguno de los 2 tipos ni `replaceBrowserHash`
  se referencian fuera de `runtime-state-provider.tsx`. La única coincidencia de nombre en el repo es
  `arePageParamsEqual` en `src/runtime/runtime-state/runtime-state-reducer.ts` (línea 670): función privada
  distinta, con otra lógica, no exportada. **Está fuera de alcance y no se toca.** No unificar, no deduplicar, no
  importar la una desde la otra.
- **Ausencia de ciclos**: `src/runtime/runtime-layout-visibility.ts` y `src/queries/runtime-api-executor.ts` no
  importan nada de `runtime-state/runtime-state-provider.tsx` ni de `runtime-global-preloads/`. El nuevo fichero no
  introduce ciclo.

---

## T1 — Mover `replaceBrowserHash` a `runtime-navigation/browser-hash-navigation.ts`

**Estado**: pendiente

### Objetivo
Sacar `replaceBrowserHash` de `runtime-state-provider.tsx` y dejarla definida y exportada en
`src/runtime/runtime-navigation/browser-hash-navigation.ts`, con nombre, firma y cuerpo idénticos. El provider pasa
a importarla desde ahí, en la misma sentencia de import que ya trae `parseBrowserHashNavigationHash`.

Cuerpo a mover tal cual (líneas 602-606 del provider):

```ts
export function replaceBrowserHash(hash: string) {
  const currentUrl = new URL(window.location.href)
  currentUrl.hash = hash
  window.history.replaceState(window.history.state, '', currentUrl)
}
```

Ubicarla en `browser-hash-navigation.ts` junto al resto de funciones exportadas del módulo (antes del bloque de
funciones privadas `createParseResult`/`resolvePageIdFromHashPath`/…), para no mezclar superficie pública y
privada.

### Fuera de alcance
- Cambiar el cuerpo, el nombre o la firma de `replaceBrowserHash`.
- Mover `createRuntimeStateFromBrowserHash` (permanece en el provider por decisión cerrada en la spec).
- Mover las 8 funciones de planificación de preloads (eso es T2).
- Añadir tests propios para `replaceBrowserHash`. La spec no lo pide (el requisito funcional 5 y el criterio de
  aceptación 6 cubren solo las 8 funciones de planificación). Queda cubierta por las suites de integración
  existentes que ya ejercitan la sincronización de hash.
- Tocar `parseBrowserHashNavigationHash`, `createBrowserHashNavigationHash` o
  `areBrowserHashNavigationEntriesEqual`.

### Dependencias
Ninguna previa: es la primera tarea del plan. **T2 depende de T1**, para que el bloque de imports de
`runtime-state-provider.tsx` quede en su forma final en una sola pasada y las dos ediciones no se solapen.

### Impacto esperado en archivos
- Código a modificar:
  - `src/runtime/runtime-navigation/browser-hash-navigation.ts` — añadir `export function replaceBrowserHash`.
  - `src/runtime/runtime-state/runtime-state-provider.tsx` — eliminar la declaración local (líneas 602-606, final
    del fichero) y añadir `replaceBrowserHash` a la importación existente de la línea 12:
    `import { parseBrowserHashNavigationHash, replaceBrowserHash } from '../runtime-navigation/browser-hash-navigation'`.
    Las dos llamadas del componente (líneas 90 y 102) no cambian.
- Tests a crear o modificar: ninguno.
- Documentación a revisar: ninguna.

### Tests
- **Ficheros de test**: ninguno; cubierto por las suites existentes
  `src/tests/runtime/runtime-browser-hash-navigation.test.ts`,
  `src/tests/runtime-state/runtime-state-navigation.test.tsx` y
  `src/tests/runtime/runtime-page-entry-preloads.test.tsx`, que ya ejercitan la normalización del hash a través del
  provider. Refactor puro sin cambio de comportamiento.
- **Comportamiento cubierto**:
  - La normalización del hash al montar el provider (hash no canónico → `history.replaceState` con el hash
    canónico) sigue funcionando igual, sin nuevas entradas en el historial.
  - La sincronización de hash tras navegar y tras `popstate`/`hashchange` sigue funcionando igual.
  - Ambos comportamientos ya están cubiertos por las suites listadas; no se añaden aserciones nuevas.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/runtime/runtime-browser-hash-navigation.test.ts`
  - `pnpm test --run src/tests/runtime-state/runtime-state-navigation.test.tsx`
  - `pnpm test --run src/tests/runtime/runtime-page-entry-preloads.test.tsx`
- **Restricciones**:
  - No añadir aserciones ni casos nuevos a esos ficheros; se ejecutan como red de regresión, no se editan.
  - Los tres comandos son ejecuciones filtradas: se consideran correctos cuando `Test Files … passed` y
    `Tests … passed`. El fallo de umbral global de cobertura que acompaña a toda ejecución filtrada es esperado y
    se ignora (ver "Qué significa 'en verde' en los comandos por fichero").

### Documentación afectada
Ninguna. El movimiento no cambia ninguna frontera arquitectónica documentada:
`ai-workflow/docs/app-features/runtime/organization.md` ya describe `runtime-navigation/` como el módulo de
navegación por hash y sigue siendo cierto sin cambios.

### Criterios de finalización
1. `grep -n "function replaceBrowserHash" src/runtime/runtime-state/runtime-state-provider.tsx` no devuelve
   coincidencias.
2. `grep -n "export function replaceBrowserHash" src/runtime/runtime-navigation/browser-hash-navigation.ts`
   devuelve exactamente una coincidencia.
3. El provider importa `replaceBrowserHash` desde `../runtime-navigation/browser-hash-navigation` en la misma
   sentencia que `parseBrowserHashNavigationHash`.
4. Los tres comandos de test de la tarea pasan en verde sin editar ningún fichero de test.
5. `pnpm lint` no reporta errores nuevos (en particular, ningún import sin usar en el provider).

### Cierre de implementación
Código movido, imports actualizados y las tres suites de regresión en verde. Habilita continuar con T2.

---

## T2 — Extraer las 8 funciones de planificación de preloads de página a `plan-page-preloads.ts`

**Estado**: pendiente

### Objetivo
Crear `src/runtime/runtime-global-preloads/plan-page-preloads.ts` con las 8 funciones de planificación de
`pages[].preloads` y sus 2 tipos de soporte, movidos **literalmente** desde `runtime-state-provider.tsx`
(mismo cuerpo, misma firma, mismo orden de sentencias), exportarlos, re-exportarlos desde el barrel
`src/runtime/runtime-global-preloads/index.ts` y dejar el provider consumiéndolos por import.

Elementos a mover, con su ubicación actual en `runtime-state-provider.tsx`:

| Elemento | Líneas actuales |
|---|---|
| `interface PlannedPreloadReloadItem` | 28-32 |
| `interface PlannedPreloadBatch` | 34-42 |
| `arePageParamsEqual` | 344-359 |
| `arePreloadNamesEqual` | 361-363 |
| `isMatchingPageEntryState` | 365-380 |
| `planPagePreloadExecution` | 382-439 |
| `evaluatePreloadExecution` | 441-479 |
| `createPreloadPlanningSnapshot` | 481-502 |
| `deriveAggregatePageEntryStatus` | 504-514 |
| `createPlannedPreloadBatchSignature` | 516-544 |

Los 10 elementos se mueven en un único cambio (ver "Grafo de dependencias interno" en el contexto: forman un grupo
cerrado y una extracción parcial exigiría un import de vuelta hacia el provider).

`createRuntimeStateFromBrowserHash` (líneas 546-600) **no se mueve**: permanece en `runtime-state-provider.tsx`.

Imports que necesita el fichero nuevo (rutas ya ajustadas a `src/runtime/runtime-global-preloads/`):

```ts
import { buildRuntimeApiRequest } from '../../queries/runtime-api-executor'
import type {
  RuntimeApiRequestParams,
  RuntimeConfig,
  RuntimePageConfig,
  RuntimePreloadConfig,
} from '../../config/runtime-config'
import { matchesVisibilityRule } from '../runtime-layout-visibility'
import type { RuntimePageParams, RuntimeQueryError, RuntimeState } from '../runtime-state/runtime-state-types'
```

Las 8 funciones pasan de `function X` a `export function X`; los 2 tipos, de `interface X` a `export interface X`.

Añadidos al barrel `src/runtime/runtime-global-preloads/index.ts`, siguiendo el patrón ya vigente de
`plan-global-preloads`:

```ts
export {
  arePageParamsEqual,
  arePreloadNamesEqual,
  createPlannedPreloadBatchSignature,
  createPreloadPlanningSnapshot,
  deriveAggregatePageEntryStatus,
  evaluatePreloadExecution,
  isMatchingPageEntryState,
  planPagePreloadExecution,
} from './plan-page-preloads'
export type { PlannedPreloadBatch, PlannedPreloadReloadItem } from './plan-page-preloads'
```

Cambios en `runtime-state-provider.tsx`:
- Eliminar las dos interfaces (28-42) y las 8 funciones (344-544).
- Ampliar el import de la línea 4 a
  `import { arePageParamsEqual, arePreloadNamesEqual, isMatchingPageEntryState, planGlobalPreloads, planPagePreloadExecution, useRuntimeGlobalPreloads } from '../runtime-global-preloads'`
  y añadir `import type { PlannedPreloadBatch } from '../runtime-global-preloads'`.
  Solo se importan esas 4 funciones: son las únicas que el componente llama.
  `PlannedPreloadReloadItem` **no** se importa (ya no se usa en el provider).
- **Eliminar los imports que quedan muertos tras el movimiento** (verificado símbolo a símbolo; dejarlos rompería
  `pnpm lint` por `@typescript-eslint/no-unused-vars`):
  - de `'../../config/runtime-config'`: quitar `RuntimeApiRequestParams`, `RuntimePageConfig`,
    `RuntimePreloadConfig`; **mantener** `RuntimeConfig`.
  - borrar la línea completa `import { buildRuntimeApiRequest } from '../../queries/runtime-api-executor'`.
  - borrar la línea completa `import { matchesVisibilityRule } from '../runtime-layout-visibility'`.
  - de `'./runtime-state-types'`: quitar `RuntimePageParams` y `RuntimeQueryError`; **mantener** `RuntimeState` y
    `RuntimeStateAction`.
  - **mantener** intactos `parseBrowserHashNavigationHash` (+ `replaceBrowserHash` tras T1), `planGlobalPreloads`,
    `useRuntimeGlobalPreloads` y el resto de imports del provider.
- No cambiar ninguna llamada ni ningún argumento en el cuerpo del componente (líneas 144, 157, 178, 194, 249, 298,
  299 y la `useRef<PlannedPreloadBatch | null>` de la línea 49 siguen escritas igual).

### Fuera de alcance
- Cualquier reescritura de la lógica movida: no renombrar parámetros, no extraer helpers nuevos, no cambiar el
  early-return de `planPagePreloadExecution`, no cambiar el `JSON.stringify` de
  `createPlannedPreloadBatchSignature`, no cambiar la semántica de `Object.is` de `arePageParamsEqual`.
- Escribir los tests unitarios de las funciones movidas (eso es T3).
- Mover `createRuntimeStateFromBrowserHash`.
- Tocar `runtime-state-reducer.ts`, `runtime-state-types.ts`, `runtime-state-selectors.ts`,
  `runtime-state-context.ts`, `use-runtime-state.ts` ni `runtime-state-query-execution.ts`.
- Fusionar o refactorizar `plan-global-preloads.ts`; el fichero nuevo queda a su lado, sin tocarlo.
- Renombrar la carpeta `runtime-global-preloads/` (tensión semántica ya evaluada y aceptada en la spec).
- Añadir un `export *` al barrel: se enumeran los símbolos explícitamente, como ya hace el barrel hoy.

### Dependencias
T1 completada (para que el bloque de imports del provider quede ya en su forma final y ambas ediciones no se
solapen).

### Impacto esperado en archivos
- Código a crear:
  - `src/runtime/runtime-global-preloads/plan-page-preloads.ts` (nuevo; 8 funciones exportadas + 2 interfaces
    exportadas + el bloque de imports indicado arriba).
- Código a modificar:
  - `src/runtime/runtime-global-preloads/index.ts` — re-exportar las 8 funciones y los 2 tipos.
  - `src/runtime/runtime-state/runtime-state-provider.tsx` — eliminar las 10 declaraciones movidas, añadir los
    imports nuevos y borrar los imports muertos listados arriba.
- Tests a crear o modificar: ninguno.
- Documentación a revisar: `ai-workflow/docs/app-features/runtime/organization.md`,
  `ai-workflow/docs/app-features/queries/preloads.md` (revisión declarativa; la actualización real la hará
  `update-app-documentation`).

### Tests
- **Ficheros de test**: ninguno; cubierto por la suite de integración existente
  `src/tests/runtime/runtime-page-entry-preloads.test.tsx`,
  `src/tests/runtime-state/runtime-state-forms-queries.test.tsx`,
  `src/tests/runtime-state/runtime-state-navigation.test.tsx` y
  `src/tests/runtime/runtime-global-preloads.test.tsx`, más los tests unitarios que añade T3.
  Movimiento puro de código sin cambio de comportamiento.
- **Comportamiento cubierto**:
  - Los preloads de `pages[].preloads` se siguen disparando al entrar en una página y no se relanzan al volver a
    entrar si la firma efectiva de request no ha cambiado.
  - `pageEntry.status` sigue transitando igual (`idle` → `loading` → `success`/`error`) y sigue quedando `idle`
    cuando ninguna precarga sobrevive al filtro `when`.
  - El filtro `when` de cada precarga sigue evaluándose contra el estado vigente.
  - La dedup por firma con el bloque raíz `preloads` sigue funcionando.
  - La interacción con formularios en `goBack` sigue igual.
  - Todo ello ya está cubierto por las suites listadas; no se añaden ni modifican aserciones.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/runtime/runtime-page-entry-preloads.test.tsx`
  - `pnpm test --run src/tests/runtime-state/runtime-state-forms-queries.test.tsx`
  - `pnpm test --run src/tests/runtime-state/runtime-state-navigation.test.tsx`
  - `pnpm test --run src/tests/runtime/runtime-global-preloads.test.tsx`
- **Restricciones**:
  - Prohibido editar esos ficheros de test. Si **alguna aserción** de esas suites falla, el fallo está en el
    movimiento: corregir el movimiento.
  - Los cuatro comandos son ejecuciones filtradas: cuentan solo las aserciones (`Test Files … passed` /
    `Tests … passed`). El fallo de umbral global de cobertura que acompaña a toda ejecución filtrada es esperado,
    **no** es una regresión del movimiento y no debe llevar a tocar código ni tests (ver "Qué significa 'en verde'
    en los comandos por fichero").
  - Verificar la ausencia de ciclos con
    `grep -rn "runtime-state-provider" src/runtime/runtime-global-preloads/` → debe devolver cero coincidencias.

### Documentación afectada
- `ai-workflow/docs/app-features/runtime/organization.md`: la línea 26 sobre `src/runtime/runtime-state/` sigue
  siendo cierta, pero conviene mencionar que la planificación de `pages[].preloads` vive ahora en
  `runtime-global-preloads/` junto a la del bloque raíz.
- `ai-workflow/docs/app-features/queries/preloads.md`: sin cambio de fondo (el comportamiento no cambia); como
  mucho, mencionar el módulo que implementa la planificación por página.

### Criterios de finalización
1. El grep del criterio de aceptación 1 de la spec sobre `runtime-state-provider.tsx` no devuelve ninguna
   coincidencia para las 8 funciones ni para `replaceBrowserHash`.
2. `grep -n "function createRuntimeStateFromBrowserHash" src/runtime/runtime-state/runtime-state-provider.tsx`
   sigue devolviendo una coincidencia.
3. Las 8 funciones y los 2 tipos están definidos y exportados en `plan-page-preloads.ts` y re-exportados desde
   `index.ts`.
4. `grep -rn "runtime-state-provider" src/runtime/runtime-global-preloads/` devuelve cero coincidencias.
5. Los cuatro comandos de test de la tarea pasan en verde sin editar ningún fichero de test.
6. `pnpm lint` sin errores (garantiza que no quedó ningún import muerto en el provider).
7. `pnpm build` completa sin errores de tipos.

### Cierre de implementación
Fichero nuevo creado, barrel actualizado, provider limpio de las 10 declaraciones y sin imports muertos, suites de
integración en verde y build de tipos correcto. Habilita T3.

---

## T3 — Tests unitarios sin React para las 8 funciones de planificación

**Estado**: pendiente

### Objetivo
Crear `src/tests/runtime/runtime-plan-page-preloads.test.ts` con tests unitarios puros de las 8 funciones movidas,
importándolas desde el barrel `../../runtime/runtime-global-preloads`. El fichero **no monta ningún componente y no
importa React ni `@testing-library/react`** (criterio de aceptación 6 de la spec).

Construcción de fixtures: montar objetos `RuntimeConfig` mínimos en línea y derivar el `RuntimeState` base con
`createRuntimeState(config)` de `../../runtime/runtime-state/runtime-state-reducer`, ajustando `state.queries` a
mano para cada caso. Es el patrón ya establecido en el bloque `describe('planGlobalPreloads purity')` de
`src/tests/runtime-state/runtime-state-global-preloads-init.test.tsx`; reusarlo en vez de inventar un harness nuevo.

`buildRuntimeApiRequest` es composición pura y no hace red: `evaluatePreloadExecution` y `planPagePreloadExecution`
se testean con el `buildRuntimeApiRequest` real, sin mocks ni `fetch` mockeado. Para provocar un error determinista
de compose basta con referenciar un `operationName` ausente del catálogo `api` (`operation-not-found`).

### Fuera de alcance
- Modificar, recortar o reorganizar los tests de integración existentes. Quedan intactos: son complementarios, no
  redundantes.
- Testear `createRuntimeStateFromBrowserHash` (sigue sin test unitario propio por decisión explícita de la spec).
- Testear `replaceBrowserHash`.
- Mockear `fetch`, `window` o `buildRuntimeApiRequest`.
- Cambiar cualquier línea de código de producción. Si un test unitario falla, el fallo está en el test o en el
  movimiento de T2, nunca es motivo para "ajustar" la lógica movida.

### Dependencias
T2 completada (el módulo y sus exports deben existir).

### Impacto esperado en archivos
- Código a crear o modificar: ninguno.
- Tests a crear:
  - `src/tests/runtime/runtime-plan-page-preloads.test.ts` (nuevo).
- Documentación a revisar: `ai-workflow/docs/test-index.md` (nueva entrada en la sección `runtime/`). Revisión
  declarativa: **la edición real la hará `update-app-documentation`**, no esta tarea.

### Tests
- **Ficheros de test**:
  - `src/tests/runtime/runtime-plan-page-preloads.test.ts` (nuevo) — único fichero de la tarea; cubre las 8
    funciones agrupadas en un `describe` por función.
- **Comportamiento cubierto**:
  - `deriveAggregatePageEntryStatus`: devuelve `'loading'` si al menos una query nombrada está `loading` (incluso
    si otra está en `error`); `'error'` si ninguna está `loading` y al menos una está `error`; `'success'` cuando
    todas están `success`; `'success'` cuando un nombre de `preloadNames` no existe en `state.queries`;
    `'success'` con `preloadNames` vacío.
  - `evaluatePreloadExecution` (compose correcto): `shouldReload: false` y `requestSignature` igual a la firma
    compuesta cuando `queries[operationName].requestSignature` ya coincide con ella;
    `shouldReload: true` cuando la firma vigente difiere y cuando la query no existe todavía en `state.queries`.
  - `evaluatePreloadExecution` (compose fallido, `operationName` desconocido): devuelve `requestSignature: null` y
    propaga `error`; `shouldReload: true` cuando el estado actual no está en `error`; `shouldReload: false` cuando
    ya está en `error` con el **mismo** `code` y `message`; `shouldReload: true` cuando está en `error` con
    distinto `code` o distinto `message`.
  - `planPagePreloadExecution` (caso vacío): con una página sin `preloads`, o con todas las precargas descartadas
    por su regla `when`, devuelve `preloadNames: []`, `reloadItems: []`, `aggregateStatus: 'idle'`,
    `batchSignature: ''` y un `snapshotState` que es **la misma referencia** que el `state` de entrada.
  - `planPagePreloadExecution` (caso con precargas): `preloadNames` contiene solo las precargas cuyo `when` casa
    con el estado; `reloadItems` contiene solo las evaluaciones con `shouldReload: true`, cada una con
    `operationName`, `requestParams` y `requestSignature`; `aggregateStatus` se deriva del `state.queries` de
    entrada (no del snapshot reseteado); `batchSignature` es una cadena no vacía.
  - `createPreloadPlanningSnapshot`: las queries nombradas en `preloadNames` quedan en
    `{ status: 'idle', data: null, error: null, requestSignature: null }`; las no nombradas conservan su objeto de
    estado original por identidad; el `state` de entrada no se muta; con `preloadNames` vacío devuelve **la misma
    referencia** de `state` sin clonar; un nombre de `preloadNames` que no existe en `state.queries` no se añade
    como clave nueva.
  - `isMatchingPageEntryState`: `true` cuando coinciden `entryId`, `pageId`, `status`, params y `preloadNames`;
    `false` con un caso por cada campo que difiere (uno por `entryId`, `pageId`, `status`, params y
    `preloadNames`).
  - `arePageParamsEqual`: `true` con las mismas claves y valores aunque el **orden de inserción de las claves sea
    distinto**; `true` con dos objetos vacíos; `false` con distinto número de claves; `false` con la misma clave y
    distinto valor; `false` cuando una clave existe en un lado y no en el otro con el mismo total de claves.
  - `arePreloadNamesEqual`: `true` con mismo contenido y mismo orden; `true` con dos arrays vacíos; `false` con el
    mismo contenido en **distinto orden** (el orden es parte del contrato); `false` con distinta longitud.
  - `createPlannedPreloadBatchSignature`: dos invocaciones con el mismo input devuelven exactamente la misma
    cadena; la firma cambia al variar `entryId`, al variar `pageId`, al variar `params`, al variar `preloadNames`,
    al variar el `requestSignature` de una evaluación y al variar el `error` de una evaluación; una evaluación sin
    `error` se normaliza a `error: null` en la cadena resultante.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/runtime/runtime-plan-page-preloads.test.ts`
- **Restricciones**:
  - Prohibido importar `react`, `react-dom` o `@testing-library/react` en este fichero, y prohibido renderizar o
    montar componentes. Comprobación explícita antes de cerrar:
    `grep -n "react\|testing-library\|render(" src/tests/runtime/runtime-plan-page-preloads.test.ts` no debe
    devolver ningún import de React ni de testing-library.
  - Extensión `.ts`, no `.tsx` (no hay JSX).
  - Importar las funciones desde el barrel `../../runtime/runtime-global-preloads`, no desde la ruta directa del
    fichero, para que el test valide también el re-export del criterio de aceptación 3.
  - `pnpm test --run src/tests/runtime/runtime-plan-page-preloads.test.ts` es una ejecución filtrada: se considera
    correcta cuando `Test Files … passed` y `Tests … passed`. El fallo de umbral global de cobertura que acompaña
    a toda ejecución filtrada es esperado y se ignora aquí; el gate de cobertura se comprueba con `pnpm test`
    completo en el criterio de finalización 5.
  - Sin snapshots. Comparar valores concretos y explícitos.
  - Fixtures pequeñas y legibles: un `RuntimeConfig` mínimo por `describe` en vez de una fixture gigante
    compartida.

### Documentación afectada
- `ai-workflow/docs/test-index.md`: añadir la entrada de `runtime-plan-page-preloads.test.ts` en la sección
  `runtime/`, describiendo que cubre las 8 funciones puras de planificación de `pages[].preloads`
  (feature `0117`). Queda declarado como referencia para la pasada de `update-app-documentation`; **esta tarea no
  edita el fichero**, igual que en T2.

### Criterios de finalización
1. `src/tests/runtime/runtime-plan-page-preloads.test.ts` existe y cubre las 8 funciones, con al menos todos los
   comportamientos listados en "Comportamiento cubierto".
2. El fichero no importa React ni `@testing-library/react` y no monta ningún componente.
3. `pnpm test --run src/tests/runtime/runtime-plan-page-preloads.test.ts` pasa en verde.
4. `pnpm test` completo pasa en verde, incluidas todas las suites de integración sin ninguna aserción modificada.
5. El umbral global de cobertura del 80% sobre `src/` se sigue cumpliendo.
6. `pnpm build` completa sin errores.

### Cierre de implementación
Fichero de test unitario creado y en verde, suite completa en verde, cobertura por encima del umbral y build
correcto. Cierra el alcance de código de la feature.

---

## Orden de ejecución

1. **T1** — mover `replaceBrowserHash` (independiente, el más pequeño).
2. **T2** — extraer las 8 funciones + 2 tipos a `plan-page-preloads.ts` (depende de T1 por el bloque de imports).
3. **T3** — tests unitarios sin React de las 8 funciones (depende de T2).

Siguiente tarea a escoger: **T1**.

## Verificación final de la feature (tras T3)

Comprobaciones de la spec que se validan una vez cerrado el plan completo:

- `pnpm test` en verde con cobertura ≥ 80% sobre `src/`.
- `pnpm build` sin errores.
- `pnpm lint` sin errores.
- Criterios de aceptación 1-8 de `spec.md` satisfechos.
