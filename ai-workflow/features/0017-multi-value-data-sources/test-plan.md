# Test Plan: Multi-value data sources

## Estado de revisión

El contrato ya está suficientemente cerrado para implementar y testear:

- una colección dinámica con referencia válida pero dato runtime no coleccionable degrada a vacío en runtime
- el nuevo `items` multi-origen usa `source` y mapeos por consumidor, manteniendo compatibilidad con los arrays históricos
- los mapeos relativos por item soportan rutas simples y anidadas
- un `select` con opción desaparecida limpia también el estado almacenado a `''`

## Objetivo
Validar que `list` y `select` pueden consumir colecciones manuales o dinámicas desde `queries.*` sin romper la compatibilidad actual, que la resolución compartida degrada de forma predecible los datos inválidos y que `select` mantiene una semántica única entre render, inicialización lazy, validación y submit.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Contrato y validación previa al render de colecciones multi-origen
Tipo:
- Unit tests de validación estructural y semántica del config

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el borde de bootstrap con el contrato ampliado

Comportamiento que valida:
- aceptación de `list.props.items: string[]` como vía histórica intacta
- aceptación de `select.props.items: { label, value }[]` como vía histórica intacta
- aceptación del nuevo shape declarativo para origen dinámico limitado a `queries.{queryName}.data` o `queries.{queryName}.data.*`
- rechazo de combinaciones ambiguas que mezclan dos orígenes incompatibles
- rechazo de orígenes dinámicos fuera de `queries.*.data` o `queries.*.data.*`
- exigencia de mapeos mínimos cuando el consumidor declara colecciones de objetos
- rechazo de `select` con valores incompatibles dentro del origen manual conocido
- compatibilidad hacia atrás de configuraciones previas sin colecciones dinámicas

Momento de ejecución:
- durante `T0017-01`
- repetir en `T0017-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### 2. Resolución compartida y render visible de `list`
Tipo:
- Integration tests del renderer con store compartido y queries controladas en memoria
- Unit tests puntuales de helpers de resolución si la implementación los expone

Archivos principales:
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-state.test.tsx` solo si conviene fijar helpers o estado derivado de la capa compartida
- `src/tests/runtime-reference-resolution.test.tsx` solo si se extrae comportamiento reutilizable desde la resolución de referencias

Comportamiento que valida:
- render sin cambios observables de listas manuales históricas
- render de listas dinámicas de escalares
- render de listas manuales o dinámicas de objetos con mapeo visible
- degradación a colección vacía cuando la referencia es válida pero el dato todavía no existe, es `null`, un escalar o un objeto no coleccionable
- degradación por item de objetos incompletos sin romper el resto de la colección
- emisión de diagnóstico útil en desarrollo para items degradados
- reutilización de una misma query por varios consumidores con proyecciones distintas

Momento de ejecución:
- durante `T0017-02`
- repetir en `T0017-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
```

### 3. Integración de `select` con formularios y valor vigente
Tipo:
- Integration tests del runtime con formularios renderizados, estado compartido y queries controladas en memoria

Archivos principales:
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-api-execution.test.ts` solo si hace falta fijar el payload final de submit

Comportamiento que valida:
- render sin cambios observables de selects manuales históricos
- construcción de opciones dinámicas desde colecciones de escalares
- construcción de opciones dinámicas desde colecciones de objetos con mapeo declarativo de `label` y `value`
- resolución de `defaultValue` solo durante la primera inicialización efectiva del campo
- no reinicialización cuando las opciones aparecen más tarde
- vaciado del campo cuando el `defaultValue` efectivo no coincide con la colección disponible
- vaciado del campo cuando el valor almacenado deja de existir tras cambiar la colección efectiva
- reutilización de ese mismo valor vacío para render, `required` y submit
- degradación por opción de items objeto inválidos sin inutilizar el resto del catálogo
- coexistencia de varios consumidores sobre la misma query sin interferencias

Momento de ejecución:
- durante `T0017-03`
- repetir en `T0017-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts
```

### 4. Regresión final y gate global
Tipo:
- Integration test de regresión del subconjunto afectado del runtime

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-reference-resolution.test.tsx` solo si la implementación final toca resolución genérica
- `src/tests/runtime-api-execution.test.ts` solo si la implementación final dejó cobertura relevante allí
- `src/tests/app-shell.test.tsx` solo si aparece impacto real en bootstrap o render inicial

Comportamiento que valida:
- coherencia entre validación del config, resolución compartida, renderer y formularios
- compatibilidad hacia atrás de listas y selects manuales existentes
- estabilidad del runtime cuando la query aún no tiene datos válidos o devuelve datos no coleccionables
- continuidad de `queryStateFeedback` como mecanismo de loading, error, empty e idle alrededor de consumidores dinámicos
- continuidad de la semántica lazy de formularios pese a la llegada tardía de opciones
- mantenimiento del gate global de coverage

Momento de ejecución:
- durante `T0017-04`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0017-01`, fijar primero por tests el shape exacto admitido por `list.props.items` y `select.props.items`, incluyendo compatibilidad hacia atrás y rechazos ambiguos.
2. En `T0017-02`, escribir primero los tests de `list` y de la resolución compartida antes de introducir el helper reutilizable y cablearlo al nodo visual.
3. En `T0017-03`, fijar primero los tests de `select` dinámico, opciones desaparecidas, `defaultValue` y `required` antes de adaptar `select` y `form`.
4. En `T0017-04`, repetir la regresión del subconjunto afectado y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0017-01
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0017-02
```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
```

### T0017-03
```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts
```

### T0017-04
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio sigue acotado a contrato JSON, resolución de referencias, renderer React, store compartido y submit ya testeables con mocks y estado controlado; no introduce dependencia necesaria de navegador real, URL ni backend real para validar el comportamiento principal.
