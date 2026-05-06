# Test Plan: Declarative runtime visibility rules

## Objetivo
Validar que el runtime puede interpretar `visibility` como una regla declarativa transversal de show/hide basada en valores ya disponibles en `forms.*` y `queries.*`, manteniendo una única semántica compartida con `queryStateFeedback`, coherencia entre renderer y formularios, y compatibilidad hacia atrás.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Contrato y validación previa al render de `visibility`
Tipo:
- Unit tests de validación estructural y semántica del config

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el borde de bootstrap con el contrato ampliado

Comportamiento que valida:
- aceptación de `visibility` en cualquier nodo soportado
- aceptación solo del shape `reference + operator + value` opcional según operador
- aceptación solo de `forms.*`, `queries.{queryName}`, `queries.{queryName}.data`, `queries.{queryName}.data.*`, `queries.{queryName}.status` y `queries.{queryName}.error`
- rechazo de referencias fuera de alcance como `navigation.*`, `routeParams.*`, `params.*`, `queries.{queryName}.status.*` o `queries.{queryName}.error.*`
- rechazo de operadores fuera del catálogo soportado
- rechazo de `value` cuando el operador es `isTruthy` o `isFalsy`
- rechazo de ausencia de `value` cuando el operador es `equals`, `notEquals`, `greaterThan` o `lessThan`
- aceptación de `equals` y `notEquals` solo con literales escalares declarativos (`string`, `number`, `boolean` y `null`)
- rechazo de arrays u objetos como `value` para `equals` y `notEquals` para no abrir comparaciones profundas o de doble referencia
- conservación de strings con forma de referencia dentro de `value` como literales declarativos y no como una segunda referencia runtime
- rechazo de umbrales no numéricos para `greaterThan` y `lessThan`
- compatibilidad hacia atrás de configuraciones sin `visibility`

Momento de ejecución:
- durante `T0019-01`
- repetir en `T0019-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### 2. Utilidad compartida de visibilidad efectiva y precedencia con `queryStateFeedback`
Tipo:
- Unit tests del helper de visibilidad runtime

Archivos principales:
- `src/tests/runtime-layout-visibility.test.ts`
- `src/tests/runtime-reference-resolution.test.tsx` solo si hace falta fijar un borde de resolución reutilizado por el helper

Comportamiento que valida:
- resolución visible por defecto de nodos sin reglas
- precedencia estable de `queryStateFeedback` sobre `visibility`
- continuidad exacta de `fallback` cuando `queryStateFeedback` lo activa
- evaluación de `equals` y `notEquals` sin coerciones implícitas
- evaluación de `equals` y `notEquals` tratando `value` siempre como literal ya validado, aunque tenga forma textual de referencia runtime
- evaluación de `isTruthy` e `isFalsy` sobre valores resueltos y ausentes
- evaluación de `greaterThan` y `lessThan` sobre números
- evaluación de `greaterThan` y `lessThan` sobre longitud de arrays y no sobre objetos, strings u otros valores no declarados como colección comparable
- degradación a `no match` para valores no comparables en lugar de lanzar error
- tratamiento estable de referencias válidas pero ausentes para que renderer y formularios reciban la misma decisión

Momento de ejecución:
- durante `T0019-02`
- repetir en `T0019-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-layout-visibility.test.ts src/tests/runtime-reference-resolution.test.tsx
```

### 3. Integración visible del renderer con `visibility`
Tipo:
- Integration tests del renderer del runtime con estado compartido controlado

Archivos principales:
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-state.test.tsx` solo si conviene fijar desde un harness existente cambios de estado compartido

Comportamiento que valida:
- render estable de nodos sin `visibility`
- ocultación y reaparición de `heading`, `paragraph`, `list`, `button`, `container` y `form` por `forms.*` y `queries.*`
- control visible por `queries.{queryName}.status`, `queries.{queryName}.error` y rutas anidadas `queries.{queryName}.data.*`
- comparación por longitud de colecciones visibles
- convivencia entre `queryStateFeedback` y `visibility` cuando ambos observan la misma query o fuentes distintas
- continuidad del fallback de `queryStateFeedback` cuando ese bloque tiene prioridad
- soporte de `visibility` también dentro de nodos renderizados como `fallback`, sin reabrir la rama original descartada por `queryStateFeedback`

Momento de ejecución:
- durante `T0019-03`
- repetir en `T0019-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
```

### 4. Integración de formularios con visibilidad efectiva
Tipo:
- Integration tests del runtime con formularios, estado compartido y submit controlado

Archivos principales:
- `src/tests/runtime-state.test.tsx`
- `src/tests/layout-renderer.test.tsx` solo si conviene fijar la reaparición visible desde un escenario ya existente

Comportamiento que valida:
- exclusión de campos `required` ocultos por `visibility` durante el submit
- conservación de `value`, `error`, `dirty`, `touched` y `defaultValue` al ocultar el campo
- recuperación del mismo estado local al volver a mostrarse
- inicialización lazy de campos que se vuelven visibles por primera vez después del primer render
- precedencia compartida `queryStateFeedback` antes de `visibility` también en campos de formulario
- coherencia entre render del campo, validación y payload de submit
- continuidad de `select` y de reglas de longitud o número sin romper normalización del valor vigente
- ausencia de bloqueo espurio cuando una regla `greaterThan` o `lessThan` observa un valor no comparable y debe degradar a oculto sin error

Momento de ejecución:
- durante `T0019-04`
- repetir en `T0019-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx
```

### 5. Regresión final y gate global
Tipo:
- Integration test de regresión del subconjunto afectado del runtime

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`
- `src/tests/runtime-layout-visibility.test.ts`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-reference-resolution.test.tsx` solo si la implementación final deja ahí cobertura real de un borde importante

Comportamiento que valida:
- coherencia entre contrato JSON, helper compartido, renderer y formularios
- compatibilidad hacia atrás de nodos y formularios que no declaran `visibility`
- estabilidad del tratamiento de referencias válidas pero ausentes
- estabilidad de la precedencia entre `queryStateFeedback` y `visibility`
- ausencia de coerciones implícitas, dobles referencias silenciosas o errores de ejecución en comparaciones numéricas y por longitud de arrays
- mantenimiento del gate global de coverage

Momento de ejecución:
- durante `T0019-05`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-layout-visibility.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0019-01`, fijar primero por tests el shape exacto de `visibility`, el catálogo de operadores, el uso de `value` y el alcance de referencias admitidas.
2. En `T0019-02`, escribir primero los tests del helper compartido para cerrar precedencia, semántica de valor ausente y reglas de comparación antes de tocar renderer o formularios.
3. En `T0019-03`, fijar primero los tests del renderer con nodos generales visibles y ocultos antes de cablear la integración definitiva en `layout-node-renderer.tsx`.
4. En `T0019-04`, fijar primero los tests de formularios y submit sobre campos condicionales antes de modificar la lógica de inicialización lazy y validación `required`.
5. En `T0019-05`, repetir la regresión del subconjunto afectado y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0019-01
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0019-02
```bash
pnpm exec vitest run src/tests/runtime-layout-visibility.test.ts src/tests/runtime-reference-resolution.test.tsx
```

### T0019-03
```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
```

### T0019-04
```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx
```

### T0019-05
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-layout-visibility.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio sigue acotado a contrato JSON, helper runtime, renderer React y validación de formularios ya cubribles con `Vitest`, estado compartido y `fetch` mockeado cuando haga falta, sin exigir navegador real, URL ni backend real para validar el comportamiento principal.
