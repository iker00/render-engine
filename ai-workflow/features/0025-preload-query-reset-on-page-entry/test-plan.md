# Test Plan: Preload query reset on page entry

## Estado de revisión

El contrato ya está suficientemente cerrado para implementar con enfoque tests-first:

- el reset previo de `preloads` será una transición atómica del reducer
- esa transición dejará las queries afectadas directamente en `loading`, sin paso visible por `idle`
- el provider aplicará esa preparación antes del primer paint útil y lanzará después la tanda remota
- las recargas manuales seguirán conservando el último `data` válido durante `loading`

## Objetivo
Validar que una nueva `pageEntry` con `preloads` limpia primero las queries declaradas antes de cualquier render útil de la nueva entrada, que formularios y consumidores visibles ya no pueden leer datos obsoletos de la visita anterior y que las ejecuciones manuales mantienen intacta su semántica vigente.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Unit tests esperados

### 1. Arranque atómico del store para `preloads`
Archivo principal:
- `src/tests/runtime-state.test.tsx`

Comportamiento a validar:
- existencia de una transición explícita de arranque para una nueva tanda de `preloads`
- copia correcta de `entryId`, `pageId`, `params` y `preloadNames` al agregado `pageEntry`
- reset selectivo de solo las queries incluidas en la tanda
- transición directa de esas queries a `loading` con `data: null` y `error: null`
- conservación intacta de queries ajenas a la tanda
- continuidad de la semántica histórica de acciones manuales de query

Momento de ejecución:
- durante `T0025-01`
- repetir en `T0025-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx
```

## Integration tests esperados

### 2. Orquestación de `preloads` en provider y `pageEntry`
Archivo principal:
- `src/tests/runtime-page-entry-preloads.test.tsx`

Comportamiento a validar:
- al entrar en una página con `preloads`, las queries precargadas ya aparecen limpias y en `loading`
- no existe un paso visible por `idle` entre la limpieza y la nueva carga
- la política se reaplica al reentrar con params distintos y al volver atrás hacia una entrada previa con `preloads`
- páginas sin `preloads` no vacían queries no relacionadas
- el snapshot compartido de una tanda ya contiene params activos y queries precargadas limpias
- el agregado `pageEntry` sigue cerrando en `success` o `error` con semántica latest-only

Momento de ejecución:
- durante `T0025-02`
- repetir en `T0025-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-page-entry-preloads.test.tsx
```

### 3. Navegación visible y regresión de reentrada con datos obsoletos
Archivo principal:
- `src/tests/runtime-button-navigation.test.tsx`

Comportamiento a validar:
- reentrada a la misma página con params distintos sin render transitorio del dato anterior
- `goBack` hacia una entrada previa con `preloads` reaplica la misma política
- formularios con `defaultValue` basado en `queries.*` no se inicializan con el registro previo antes de la nueva carga
- consumidores visibles basados en `queries.*` reaccionan al estado limpio y a `loading`
- continuidad de la semántica manual de `executeOperation`, que sigue manteniendo el último `data` durante recargas no automáticas

Momento de ejecución:
- durante `T0025-02` y `T0025-03`
- repetir en `T0025-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-button-navigation.test.tsx
```

### 4. Renderer y formularios sobre estado limpio durante `loading`
Archivos principales:
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-state.test.tsx`

Comportamiento a validar:
- un `heading` o `paragraph` alimentado por `queries.{queryName}.data.*` degrada al estado limpio en la nueva entrada y no muestra el dato anterior
- `queryStateFeedback.states.loading` sigue pudiendo mostrar fallback o loading state durante la nueva tanda
- la semántica lazy de formularios sigue vigente: el campo toma su `defaultValue` solo al inicializarse, pero ya contra el snapshot limpio de la nueva entrada
- `persistOnUnmount: false` sigue dependiendo de desmontaje real y no cambia por la nueva política de `preloads`

Momento de ejecución:
- durante `T0025-03`
- repetir en `T0025-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
```

## Regresión final y gate global

### 5. Subconjunto afectado completo
Tipo:
- integración y regresión final del runtime afectado por la feature

Archivos principales:
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-page-entry-preloads.test.tsx`
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/layout-renderer.test.tsx`

Comportamiento que valida:
- coherencia entre reducer, provider, navegación por entrada, `preloads`, renderer y formularios
- aislamiento del cambio al mecanismo automático de `preloads`
- mantenimiento de la semántica manual de recarga con `data` previo
- ausencia de render útil con datos obsoletos al reentrar en páginas parametrizadas
- mantenimiento del gate global de coverage

Momento de ejecución:
- durante `T0025-04`

Comandos recomendados:

```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/layout-renderer.test.tsx
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0025-01`, fijar primero por tests la transición atómica de arranque de `preloads` y su alcance selectivo sobre queries.
2. En `T0025-02`, escribir primero los tests de provider para demostrar el reset previo, la ausencia de `idle` visible y la continuidad de `pageEntry`.
3. En `T0025-03`, fijar primero los tests de reentrada visible y de formularios con `defaultValue` basado en `queries.*`.
4. En `T0025-04`, repetir la regresión del subconjunto afectado y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0025-01
```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx
```

### T0025-02
```bash
pnpm exec vitest run src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx
```

### T0025-03
```bash
pnpm exec vitest run src/tests/runtime-button-navigation.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
```

### T0025-04
```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/layout-renderer.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El comportamiento afectado vive íntegramente dentro del runtime React, su store compartido y la frontera declarativa ya cubierta por tests de integración del repositorio, sin necesidad de navegador real ni backend externo.
