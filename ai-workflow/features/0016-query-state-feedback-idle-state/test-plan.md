# Test Plan: Query state feedback idle state

## Objetivo
Validar que `queryStateFeedback` distingue explícitamente `idle` de `loading`, que una query no lanzada o ausente del store se trata como `idle`, que `empty` sigue reservado a respuestas válidas sin datos útiles y que la misma semántica se reutiliza tanto en render visible como en validación de formularios.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Contrato del estado visible `idle`
Tipo:
- Unit tests de validación estructural del config

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el borde de bootstrap con el contrato ampliado

Comportamiento que valida:
- aceptación de `idle` como clave soportada dentro de `queryStateFeedback.states`
- aceptación de `mode: show`, `mode: hide` y `mode: fallback` también bajo `idle`
- rechazo de nombres de estado desconocidos distintos de `idle`
- rechazo de `fallback` inválido bajo `states.idle`
- descarte de claves extra no soportadas sin cambiar la semántica actual
- compatibilidad hacia atrás de configuraciones que no declaran `states.idle`

Momento de ejecución:
- durante `T0016-01`
- repetir en `T0016-03` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### 2. Derivación compartida e integración visible de `idle | loading | error | empty | success`
Tipo:
- Unit tests de utilidades o selectores del runtime
- Integration tests del renderer del runtime con store compartido
- Integration tests de formularios con queries controladas en memoria

Archivos principales:
- `src/tests/runtime-state.test.tsx`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-page-entry-preloads.test.tsx` si hace falta fijar una transición real desde runtime

Comportamiento que valida:
- proyección de `queries.{queryName}.status: idle` a estado visible `idle`
- tratamiento de una query ausente del store como `idle`
- proyección de `status: loading` a `loading` incluso cuando existe `data` previo
- proyección de `status: error` a `error`
- proyección de `status: success` con `null`, `undefined`, `''`, `[]` y `{}` a `empty`
- proyección de `status: success` con `0`, `false`, strings no vacíos, arrays con elementos y objetos con claves a `success`
- defaults efectivos uniformes cuando `idle` no tiene regla explícita
- sobrescritura selectiva de `idle` sin afectar al resto de estados
- ocultación del nodo cuando `states.idle.mode` resuelve `hide`
- render de un fallback local de “haz una búsqueda” cuando `states.idle.mode` resuelve `fallback`
- uso exclusivo de la rama `loading` durante una ejecución real en curso y no antes
- exclusión de campos `required` ocultos por `states.idle` del bloqueo de submit
- recuperación del mismo campo como visible y validable cuando la query abandona `idle`
- coherencia de la misma semántica para queries lanzadas por `preloads` y para queries lanzadas manualmente

Momento de ejecución:
- durante `T0016-02`
- repetir en `T0016-03` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
```

### 3. Regresión final y gate global
Tipo:
- Integration test de regresión del subconjunto afectado del runtime

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`
- `src/tests/runtime-state.test.tsx`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-page-entry-preloads.test.tsx`
- `src/tests/app-shell.test.tsx` solo si aparece impacto real en bootstrap o render inicial

Comportamiento que valida:
- coherencia entre validación del config, helper compartido y render visible
- continuidad de la semántica de `empty` como “respuesta válida sin datos útiles”
- continuidad de formularios y reglas `required` cuando `queryStateFeedback` gobierna la visibilidad
- comportamiento estable de queries nunca ejecutadas o todavía ausentes del store
- transición de `idle` a `loading` al arrancar `preloads`
- mantenimiento del gate global de coverage

Momento de ejecución:
- durante `T0016-03`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0016-01`, fijar primero por tests el contrato exacto de `states.idle` antes de tocar tipos y validación.
2. En `T0016-02`, fijar primero por tests la derivación compartida y su efecto visible en renderer y formularios antes de ajustar helpers o selectores.
3. En `T0016-03`, repetir la regresión del subconjunto afectado y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0016-01
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0016-02
```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
```

### T0016-03
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio sigue acotado a contrato JSON, helpers del runtime, renderer en memoria y formularios ya testeables con mocks y estado controlado; no introduce dependencia necesaria de navegador real, URL ni backend real para validar el comportamiento principal.
