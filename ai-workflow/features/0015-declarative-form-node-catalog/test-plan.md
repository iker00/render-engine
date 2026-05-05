> Nota histórica: este plan de pruebas se redactó antes de `0016-query-state-feedback-idle-state`. La semántica visible vigente de `queryStateFeedback` incluye `idle` como estado diferenciado de `loading`.

# Test Plan: Declarative form node catalog

## Objetivo
Validar que el runtime soporta un catálogo declarativo mínimo de formularios con `form`, `input`, `textarea` y `select`, inicializa el estado compartido `forms.{formId}.{fieldId}` sin sobrescrituras inesperadas, aplica validación `required` coherente con `queryStateFeedback` y ejecuta submit declarativo mediante `executeOperation` sin abrir un dominio paralelo de estado.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Contrato y validación previa al render del catálogo de formularios
Tipo:
- Unit tests de validación estructural y semántica del config

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el borde de bootstrap con el contrato ampliado

Comportamiento que valida:
- aceptación del shape de `form`, `input`, `textarea`, `select` y `submitAction`
- aceptación de `button` sin `action` solo dentro de `form.children`
- rechazo de campos fuera de un `form`
- aceptación de campos y de `button` submit implícito en cualquier descendiente de un `form`, no solo en hijos directos
- rechazo de `form.id` duplicado
- rechazo de `fieldId` duplicado dentro del mismo `form`
- rechazo de `submitAction.operationName` inexistente en `api`
- rechazo de `resetOnSuccess: true` sin `submitAction`
- rechazo de `select` con items heterogéneos por tipo de `value`
- continuidad del comportamiento actual para configuraciones sin `form`

Momento de ejecución:
- durante `T0015-01`
- repetir al cierre de `T0015-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### 2. Renderer base e inicialización lazy del estado de formularios
Tipo:
- Integration tests del runtime con store compartido y renderer visible
- Unit tests puntuales de helpers de resolución de referencias si se extraen

Archivos principales:
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-reference-resolution.test.tsx` solo si la implementación crea o expone un helper reutilizable para `defaultValue`

Comportamiento que valida:
- render de `<form>`, `<input>`, `<textarea>` y `<select>` desde JSON válido
- render correcto del mismo catálogo cuando los controles quedan agrupados en `container` dentro del `form`
- inicialización solo de campos ausentes en `forms.{formId}.{fieldId}`
- preservación del valor del usuario en rerender, navegación y vuelta a la página
- resolución única del `defaultValue` dinámico en el primer momento de inicialización
- no rehidratación automática cuando el dato dinámico aparece más tarde
- normalización de valores numéricos de `select` a string
- vaciado de `select` cuando el `defaultValue` efectivo no coincide con una opción
- aislamiento entre varios formularios dentro del mismo runtime

Momento de ejecución:
- durante `T0015-02`
- repetir al cierre de `T0015-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
```

### 3. Validación `required` y visibilidad efectiva de campos
Tipo:
- Integration tests del runtime con formularios renderizados y queries controladas en memoria

Archivos principales:
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-page-entry-preloads.test.tsx` solo si hace falta una cobertura específica de queries que gobiernan visibilidad

Comportamiento que valida:
- bloqueo del submit cuando un `input` o `textarea` visible y `required` está vacío o tiene solo espacios
- bloqueo del submit cuando un `select` visible y `required` mantiene `''`
- escritura de errores solo en `forms.{formId}.{fieldId}.error`
- validación contra el valor más reciente del usuario aunque el submit ocurra en el mismo tick que el último cambio
- limpieza automática del error al volver a un valor válido
- persistencia de valores y errores al ocultar y remostrar un campo
- exclusión de campos ocultos por `queryStateFeedback` del bloqueo de submit
- coherencia de la misma semántica visible entre renderer y lógica de formulario

Momento de ejecución:
- durante `T0015-03`
- repetir al cierre de `T0015-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
```

### 4. Submit declarativo y convivencia con botones auxiliares
Tipo:
- Integration tests del runtime con formularios renderizados, estado compartido y `fetch` mockeado cuando aplique

Archivos principales:
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-api-execution.test.ts`
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/runtime-ui-actions.test.tsx` solo si se necesita fijar un límite adicional del ejecutor común

Comportamiento que valida:
- activación del submit por Enter cuando aplica
- activación del submit por un `button` sin `action` dentro del formulario
- activación equivalente cuando ese botón submit implícito está anidado dentro de un `container` descendiente del formulario
- no activación del submit implícito cuando el botón declara `action` explícita
- ejecución de `submitAction.executeOperation` con proyección del resultado en `queries.{operationName}`
- envío del payload construido desde referencias `forms.{formId}.{fieldId}` actuales
- envío del payload con el valor más reciente aunque el usuario cambie el campo inmediatamente antes de enviar
- reset del formulario tras éxito cuando `resetOnSuccess` es `true`
- conservación de valores tras éxito cuando `resetOnSuccess` es `false`
- conservación de valores tras error de submit
- convivencia correcta con botones auxiliares como `navigateTo` o `resetForm`

Momento de ejecución:
- durante `T0015-04`
- repetir al cierre de `T0015-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts src/tests/runtime-button-navigation.test.tsx
```

### 5. Regresión final y gate global
Tipo:
- Integration test de regresión del subconjunto afectado del runtime

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-api-execution.test.ts`
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/runtime-reference-resolution.test.tsx` solo si la implementación final toca la resolución genérica de referencias
- `src/tests/app-shell.test.tsx` solo si aparece impacto real en bootstrap o render inicial

Comportamiento que valida:
- coherencia entre validación del config, renderer de formularios, store compartido y submit declarativo
- compatibilidad hacia atrás de configuraciones sin `form`
- persistencia del aislamiento entre varias instancias del runtime
- continuidad de `queryStateFeedback` sobre formularios y campos sin divergencia respecto a otros nodos
- continuidad de referencias `forms.*` ahora que los valores provienen de controles declarativos reales
- mantenimiento del gate global de coverage

Momento de ejecución:
- al cierre de `T0015-05`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts src/tests/runtime-button-navigation.test.tsx
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0015-01`, fijar primero por tests el shape exacto de `form`, `input`, `textarea`, `select`, `submitAction`, `resetOnSuccess` y la validación semántica de ancestry y unicidad.
2. En `T0015-02`, escribir primero los tests de render e inicialización lazy antes de introducir los nodos reales y la herencia de contexto de formulario.
3. En `T0015-03`, fijar primero los tests de `required`, limpieza de errores y exclusión de campos ocultos antes de cablear la validación en el nodo `form`.
4. En `T0015-04`, escribir primero los tests de submit por Enter, botón submit implícito, botón auxiliar y `resetOnSuccess` antes de cerrar la integración con `executeOperation`.
5. En `T0015-05`, repetir la regresión conjunta del subconjunto afectado y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0015-01
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0015-02
```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
```

### T0015-03
```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
```

### T0015-04
```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts src/tests/runtime-button-navigation.test.tsx
```

### Cierre de T0015-05
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-api-execution.test.ts src/tests/runtime-button-navigation.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio sigue acotado a contrato JSON, renderer React, store compartido y ejecución remota ya testeable con mocks en memoria; no introduce dependencia necesaria de navegador real, URL ni backend real para validar el comportamiento principal.
