# Test Plan: Declarative API boundary

## Objetivo
Validar que `api` deja de ser un bloque reservado y pasa a ser una frontera declarativa operativa: contrato tipado y validado en bootstrap, builder/ejecutor reusable de requests y fachada mínima del runtime para hidratar `queries` sin romper el gate global de cobertura.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Contrato base de `config.api`
Tipo:
- Unit tests de validación estructural del config

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts` si hace falta cubrir el borde `data-config`

Comportamiento que valida:
- aceptación de operaciones `GET`, `POST`, `PUT`, `PATCH` y `DELETE` con shapes compatibles
- rechazo de métodos no soportados y endpoints vacíos
- distinción entre `query` plano permitido con valores `string | number | boolean` y shapes no admitidos
- aceptación de `body` JSON para métodos compatibles y rechazo en `GET`
- aceptación de `body: null` como body explícitamente vacío en métodos con body
- compatibilidad hacia atrás de configuraciones con `api: {}`

Momento de ejecución:
- durante `T0009-01`
- repetir en `T0009-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### 2. Construcción y ejecución de operaciones declarativas
Tipo:
- Unit e integration tests del builder/ejecutor contra `fetch` mockeado

Archivo principal:
- `src/tests/runtime-api-execution.test.ts`

Comportamiento que valida:
- construcción de URL y query string para `GET`
- serialización de body JSON para `POST`, `PUT`, `PATCH` y `DELETE` cuando aplique
- serialización de `query` solo para valores finales `string`, `number` y `boolean`
- interpretación estable de `body: null` como body explícitamente vacío
- convivencia de literales, escape `\` y referencias runtime dentro de `query` y `body`
- error estable cuando falta una referencia necesaria para construir el request
- error estable cuando la operación no existe
- normalización uniforme de errores de red, HTTP no `ok` y JSON inválido con códigos estables
- éxito con `data: null` cuando la respuesta sea satisfactoria pero no traiga body JSON consumible, incluida `204 No Content`

Momento de ejecución:
- durante `T0009-02`
- repetir en `T0009-03` y `T0009-04` como parte de la integración final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-api-execution.test.ts
```

### 3. Integración con el store compartido de queries
Tipo:
- Integration tests del provider y del runtime state

Archivos principales:
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-api-execution.test.ts` si la fachada pública comparte contrato de retorno con el ejecutor

Comportamiento que valida:
- transición a `loading` al ejecutar una operación declarada por nombre
- transición a `success` con el dato remoto guardado en `queries.{operationName}`
- transición a `error` con shape estable y orientado a UI
- códigos de error estables para operación inexistente y fallo de construcción del request
- conservación del último `data` válido durante recargas
- ausencia de emisión de red cuando la operación no existe
- continuidad del acceso a resultados remotos a través de `queries.*`, no mediante acoplamiento directo a la red desde la UI

Momento de ejecución:
- durante `T0009-03`
- repetir en `T0009-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx
```

### 4. Regresión final del runtime y gate global
Tipo:
- Integration test de regresión del subconjunto afectado del runtime

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`
- `src/tests/runtime-api-execution.test.ts`
- `src/tests/runtime-state.test.tsx`
- `src/tests/app-shell.test.tsx` solo si la integración final revela impacto real en el arranque

Comportamiento que valida:
- continuidad del arranque actual con `api: {}`
- coherencia entre validación, ejecutor y store compartido
- posibilidad de reutilizar un mismo endpoint con operaciones nombradas distintas y métodos distintos
- éxito estable con `data: null` para respuestas remotas vacías
- continuidad del runtime visible cuando no se usan todavía disparadores declarativos de red
- cumplimiento del gate global de coverage

Momento de ejecución:
- durante `T0009-04`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0009-01`, fijar primero por tests qué shapes de `api` son válidos e inválidos antes de tocar la validación.
2. En `T0009-02`, escribir primero los tests del builder/ejecutor para URL, query string, body, referencias y errores normalizados antes de implementar la capa `src/queries/`.
3. En `T0009-03`, escribir primero los tests del provider para transiciones `loading | success | error` antes de cablear el ejecutor con el store.
4. En `T0009-04`, ejecutar la regresión del subconjunto relevante y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0009-01
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0009-02
```bash
pnpm exec vitest run src/tests/runtime-api-execution.test.ts
```

### T0009-03
```bash
pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx
```

### T0009-04
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio sigue acotado a validación de contrato, construcción/ejecución de requests y estado compartido en memoria, sin flujo de navegador extremo a extremo nuevo ni UI declarativa final para disparar operaciones.
