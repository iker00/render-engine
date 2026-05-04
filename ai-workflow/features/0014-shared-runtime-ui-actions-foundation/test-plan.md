# Test Plan: Shared runtime UI actions foundation

## Objetivo
Validar que el runtime soporta un contrato común de acciones UI reutilizable desde `button.props.action`, ejecuta `navigateTo`, `goBack`, `executeOperation` y `resetForm` sobre los dominios compartidos existentes sin lógica imperativa ad hoc en el nodo visual, y mantiene compatibilidad hacia atrás con el comportamiento actual de navegación.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Contrato y validación previa al render de `action`
Tipo:
- Unit tests de validación estructural y semántica del config

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el borde de bootstrap con el contrato ampliado

Comportamiento que valida:
- compatibilidad hacia atrás de `button.props.action` con `navigateTo` y `goBack`
- aceptación de `executeOperation` con `operationName` no vacío
- aceptación de `resetForm` con `formId` no vacío
- rechazo de acciones con `type` no soportado
- rechazo de `navigateTo.pageId` hacia páginas inexistentes
- rechazo de `executeOperation.operationName` hacia operaciones inexistentes en `api`
- aceptación de `resetForm` sin intentar cerrar un catálogo semántico de formularios inexistente en bootstrap
- descarte de claves extra no soportadas dentro de `action`

Momento de ejecución:
- durante `T0014-01`
- repetir al cierre de `T0014-03` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### 2. Ejecutador común de acciones UI
Tipo:
- Unit tests de la capa de ejecución transversal
- Integration test acotado del botón para fijar la continuidad de navegación

Archivos principales:
- `src/tests/runtime-ui-actions.test.ts`
- `src/tests/runtime-button-navigation.test.tsx`

Comportamiento que valida:
- mapeo `navigateTo -> navigateToPage(pageId)`
- mapeo `goBack -> goBackPage()`
- mapeo `executeOperation -> void executeQueryOperation(operationName)`
- mapeo `resetForm -> resetForm(formId)`
- ausencia de espera explícita de promesas o estado efímero propio del botón
- continuidad del flujo actual de navegación declarativa usando ya el ejecutor común

Momento de ejecución:
- durante `T0014-02`
- repetir al cierre de `T0014-03` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-ui-actions.test.ts src/tests/runtime-button-navigation.test.tsx
```

### 3. Integración visible de `executeOperation` y `resetForm`
Tipo:
- Integration tests del runtime con estado compartido, botones renderizados y, cuando aplique, `fetch` mockeado

Archivos principales:
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/runtime-state.test.tsx`
- `src/tests/layout-renderer.test.tsx` solo si hace falta fijar la compatibilidad de `button` con el renderer central
- `src/tests/runtime-api-execution.test.ts` solo si la implementación abre una laguna real del contrato remoto compartido

Comportamiento que valida:
- ejecución de una operación declarada desde un botón y proyección del resultado en `queries.{operationName}`
- conservación del último `data` válido durante recargas disparadas por `executeOperation`
- reutilización de errores `operation-not-found`, `request-build-failed`, `network-error`, `http-error` e `invalid-json-response`
- reseteo del formulario objetivo a su estado inicial efectivo desde un botón con `resetForm`
- ausencia de efectos colaterales sobre otros formularios
- semántica estable cuando `resetForm` apunta a un formulario todavía no inicializado
- continuidad de configuraciones previas que solo usan navegación

Momento de ejecución:
- durante `T0014-03`
- repetir dentro de `T0014-03` como parte del cierre de regresión final de la feature

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-button-navigation.test.tsx src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx
```

### 4. Regresión final y gate global
Tipo:
- Integration test de regresión del subconjunto afectado del runtime

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`
- `src/tests/runtime-ui-actions.test.ts`
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/runtime-state.test.tsx`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-api-execution.test.ts` solo si quedó tocado por la implementación
- `src/tests/app-shell.test.tsx` solo si aparece impacto real en bootstrap o render inicial

Comportamiento que valida:
- coherencia entre validación del config, ejecutor común y comportamiento visible del botón
- compatibilidad hacia atrás de configuraciones con navegación existente
- convivencia correcta de `button.props.action` con `queryStateFeedback`
- semántica homogénea entre `executeOperation` disparada por botón y la ejecución remota ya estable del runtime
- mantenimiento del gate global de coverage

Momento de ejecución:
- al cierre de `T0014-03`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-ui-actions.test.ts src/tests/runtime-button-navigation.test.tsx src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0014-01`, fijar primero por tests el shape exacto del contrato común `action`, las nuevas variantes soportadas y las validaciones semánticas cerrables en bootstrap.
2. En `T0014-02`, fijar primero por tests el mapeo del ejecutor común hacia los handlers del provider antes de sustituir el ejecutor específico de navegación en el botón.
3. En `T0014-03`, escribir primero los tests visibles de `executeOperation` y `resetForm` desde botones renderizados, apoyándose en un harness de test para inicializar formularios cuando haga falta, antes de cerrar la integración end-to-end.
4. Dentro de `T0014-03`, repetir la regresión conjunta del subconjunto afectado y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0014-01
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0014-02
```bash
pnpm exec vitest run src/tests/runtime-ui-actions.test.ts src/tests/runtime-button-navigation.test.tsx
```

### T0014-03
```bash
pnpm exec vitest run src/tests/runtime-button-navigation.test.tsx src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx
```

### Cierre de T0014-03
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-ui-actions.test.ts src/tests/runtime-button-navigation.test.tsx src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio sigue acotado a contrato JSON, runtime compartido y renderer en memoria; no introduce navegación real de navegador ni una dependencia de backend real imprescindible para validar el comportamiento principal.
