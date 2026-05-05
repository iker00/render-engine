# Test Plan: Action-level API request params

## Objetivo
Validar que el runtime puede combinar una operación `api` base con `query`, `body` y `headers` declarados por ejecución desde botón o submit, manteniendo compatibilidad hacia atrás, errores normalizados estables y una única frontera de composición del request en `src/queries/`.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Contrato y validación previa al render de request params declarativos
Tipo:
- Unit tests de validación estructural y semántica del config

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el borde de bootstrap con el contrato ampliado

Comportamiento que valida:
- aceptación de `api.headers` como canal opcional del contrato base
- aceptación de `button.props.action.executeOperation` con `query`, `body` y `headers` opcionales
- aceptación de `form.submitAction` con esos mismos canales opcionales
- rechazo de `body` para métodos `GET` tanto en la operación base como en el override por ejecución
- rechazo de claves vacías o valores no soportados en `query` y `headers`
- rechazo de valores no string en `headers`
- rechazo de `operationName` inexistente en acciones y submit
- compatibilidad hacia atrás de configuraciones que solo declaran `operationName`

Momento de ejecución:
- durante `T0018-01`
- repetir en `T0018-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### 2. Composición del request efectivo y normalización de errores en `src/queries/`
Tipo:
- Unit tests del request builder
- Integration tests acotados de ejecución remota con `fetch` controlado

Archivos principales:
- `src/tests/runtime-api-execution.test.ts`
- `src/tests/runtime-state.test.tsx` solo si conviene fijar la firma ampliada del provider o la lectura de snapshot

Comportamiento que valida:
- traslado de `api.headers` al `RequestInit` final
- merge superficial de `query` con precedencia del override por ejecución
- merge superficial de `headers` con precedencia del override por ejecución
- merge superficial en raíz de `body` cuando ambas capas usan objeto JSON
- sustitución completa del body base cuando la capa base o el override usan un valor raíz no objeto
- adición de `content-type: application/json` solo cuando hay body serializado y no existe ya un `content-type` efectivo declarado
- prevalencia del `content-type` explícito cuando la operación base o el override por ejecución ya lo aportan
- combinación previa a la resolución de referencias y uso de un snapshot runtime único por ejecución
- continuidad de `request-build-failed` ante referencias no resolubles o valores finales incompatibles
- continuidad de la firma histórica cuando no se pasan `requestParams`

Momento de ejecución:
- durante `T0018-02`
- repetir en `T0018-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx
```

### 3. Integración de botón y submit con request params por ejecución
Tipo:
- Integration tests del runtime con renderer, store compartido y `fetch` controlado
- Unit tests del ejecutor común de acciones UI

Archivos principales:
- `src/tests/runtime-ui-actions.test.tsx`
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/runtime-state.test.tsx`

Comportamiento que valida:
- reenvío del action completo desde `executeRuntimeUiAction` a `executeQueryOperation`
- ejecución correcta de un botón con `executeOperation.query`, `body` o `headers`
- ejecución correcta de un submit con `submitAction.query`, `body` o `headers`
- uso del snapshot más reciente del formulario cuando el override referencia `forms.*`
- continuidad de `resetOnSuccess` solo tras éxito real de la operación combinada
- continuidad de la proyección visible exclusiva en `queries.{operationName}`
- continuidad de errores `request-build-failed`, `network-error`, `http-error` e `invalid-json-response` sin superficies paralelas en botón o formulario
- compatibilidad hacia atrás de botones y formularios que no declaran request params por ejecución

Momento de ejecución:
- durante `T0018-03`
- repetir en `T0018-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-ui-actions.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-state.test.tsx
```

### 4. Regresión final y gate global
Tipo:
- Integration test de regresión del subconjunto afectado del runtime

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`
- `src/tests/runtime-api-execution.test.ts`
- `src/tests/runtime-ui-actions.test.tsx`
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/runtime-state.test.tsx`
- `src/tests/layout-renderer.test.tsx` solo si la implementación final deja impacto visible adicional en el renderer

Comportamiento que valida:
- coherencia entre contrato JSON, request builder, provider, botón y submit
- compatibilidad hacia atrás de operaciones `api` y acciones `executeOperation` históricas
- continuidad de `preloads` y de callers existentes que ejecutan operaciones sin `requestParams`
- no emisión de red cuando la construcción del request falla en cualquier trigger
- ausencia de duplicidades accidentales de `content-type` en requests con `body` y headers declarativos
- mantenimiento del gate global de coverage

Momento de ejecución:
- durante `T0018-04`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-api-execution.test.ts src/tests/runtime-ui-actions.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-state.test.tsx
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0018-01`, fijar primero por tests el shape exacto de `api.headers`, `action.query`, `action.body`, `action.headers`, `submitAction.query`, `submitAction.body` y `submitAction.headers`, incluyendo los rechazos de `GET` con body.
2. En `T0018-02`, escribir primero los tests del request builder y de `executeRuntimeApiOperation` para cerrar la semántica de merge y de errores antes de tocar el provider.
3. En `T0018-03`, fijar primero los tests del ejecutor común, del botón y del submit con overrides por ejecución antes de cablear definitivamente el runtime.
4. En `T0018-04`, repetir la regresión del subconjunto afectado y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0018-01
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0018-02
```bash
pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx
```

### T0018-03
```bash
pnpm exec vitest run src/tests/runtime-ui-actions.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-state.test.tsx
```

### T0018-04
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-api-execution.test.ts src/tests/runtime-ui-actions.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-state.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio sigue acotado a contrato JSON, validación, composición del request, store compartido y triggers declarativos ya testeables con `Vitest`, renderer React y `fetch` mockeado, sin exigir navegador real, URL ni backend real para validar el comportamiento principal.
