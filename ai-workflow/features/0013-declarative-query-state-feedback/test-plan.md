# Test Plan: Declarative query state feedback

## Objetivo
Validar que el runtime puede declarar feedback visual por nodo ligado al estado de una query concreta, derivar uniformemente `loading | error | empty | success`, renderizar fallbacks locales sin lógica imperativa externa y mantener el gate global de cobertura sin romper configuraciones previas.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Contrato del bloque `queryStateFeedback`
Tipo:
- Unit tests de validación estructural del config

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el borde del bootstrap con errores visibles

Comportamiento que valida:
- aceptación de `queryStateFeedback.query` como string no vacío
- aceptación exclusiva de `loading`, `error`, `empty` y `success` como estados configurables
- rechazo de nombres de estado desconocidos dentro de `states` aunque el resto del bloque sea válido
- aceptación de `mode: show` y `mode: hide` sin `fallback`
- aceptación de `mode: fallback` solo cuando declara `fallback`
- aceptación de `fallback` como `LayoutNode[]` ordenado y con varios hermanos
- rechazo de `fallback` estructuralmente inválido o con nodos no soportados
- descarte de claves extra no soportadas en la raíz del bloque o en sus reglas
- compatibilidad hacia atrás de configuraciones sin `queryStateFeedback`

Momento de ejecución:
- durante `T0013-01`
- repetir en `T0013-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### 2. Derivación de estado visible y defaults efectivos
Tipo:
- Unit tests de selectors o utilidades del runtime
- Integration tests acotados del store cuando convenga fijar transiciones reales

Archivos principales:
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-page-entry-preloads.test.tsx`
- `src/tests/layout-renderer.test.tsx` solo si parte de la semántica se fija mejor desde el borde visible

Comportamiento que valida:
- proyección de `idle` a `loading`
- continuidad de `loading` incluso cuando existe `data` previo conservado
- proyección de `error` a `error`
- proyección de `success` con `null`, `undefined`, `''`, `[]` y `{}` a `empty`
- proyección de `success` con `0`, `false`, strings no vacíos, arrays con elementos y objetos con claves a `success`
- tratamiento de una query ausente del store como rama equivalente a `loading`
- defaults efectivos `success -> show` y `loading/error/empty -> hide`
- sobrescritura selectiva de defaults cuando el nodo declara reglas solo para algunos estados

Momento de ejecución:
- durante `T0013-02`
- repetir en `T0013-03` y `T0013-04` como parte de la integración final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
```

### 3. Render visible del nodo original, ocultación y fallback local
Tipo:
- Integration tests del renderer del runtime con estado compartido e interacciones de query

Archivos principales:
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-page-entry-preloads.test.tsx`
- `src/tests/runtime-button-navigation.test.tsx` solo si hace falta fijar que `button` también respeta el borde transversal

Comportamiento que valida:
- continuidad del render actual para nodos sin `queryStateFeedback`
- ocultación del nodo cuando la respuesta efectiva del estado es `hide`
- sustitución del nodo por el fallback local cuando la respuesta efectiva es `fallback`
- desaparición del fallback y reaparición del nodo original al pasar a `success` con datos no vacíos
- reaparición de la rama `loading` durante una recarga con `data` previo conservado
- orden estable cuando el fallback contiene varios nodos hermanos
- coexistencia de varios nodos escuchando la misma query con respuestas distintas
- aplicabilidad uniforme de la capacidad al catálogo soportado actual, incluido `button`

Momento de ejecución:
- durante `T0013-03`
- repetir en `T0013-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx
```

### 4. Regresión final y gate global
Tipo:
- Integration test de regresión del subconjunto afectado del runtime

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-page-entry-preloads.test.tsx`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/app-shell.test.tsx` solo si aparece impacto real en el arranque visible

Comportamiento que valida:
- coherencia entre validación del config, derivación del estado visible y render alternativo local
- continuidad de configuraciones previas sin `queryStateFeedback`
- semántica visual idéntica para queries disparadas manualmente y por `preloads`
- comportamiento estable cuando la query nunca se ejecuta o no existe todavía en el store
- rechazo previo al render de fallbacks inválidos
- mantenimiento del gate global de coverage

Momento de ejecución:
- durante `T0013-04`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0013-01`, fijar primero por tests el shape contractual exacto de `queryStateFeedback`, sus modos y la forma de `fallback` antes de tocar tipos y validación.
2. En `T0013-02`, fijar primero por tests la semántica uniforme de `idle/loading/error/success`, la heurística de `empty` y los defaults efectivos antes de conectar el renderer.
3. En `T0013-03`, escribir primero los tests visibles de ocultación, sustitución y recuperación del nodo original antes de integrar el feedback en `layout-node-renderer.tsx`.
4. En `T0013-04`, ejecutar la regresión del subconjunto relevante y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0013-01
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0013-02
```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
```

### T0013-03
```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx
```

### T0013-04
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio sigue acotado a contrato JSON, store compartido y renderer en memoria; no introduce routing real de navegador ni una dependencia de backend real para validar el comportamiento principal.
