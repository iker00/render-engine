# Test Plan: Page entry query preloads

## Objetivo
Validar que el runtime puede declarar `preloads` por página, dispararlos automáticamente al entrar en ella y exponer un ciclo agregado observable de entrada sin romper la semántica ya estable de `queries.*`, la navegación interna ni el gate global de cobertura.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Contrato de página con `preloads`
Tipo:
- Unit tests de validación estructural del config

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts` solo si hace falta cubrir el borde `data-config`

Comportamiento que valida:
- aceptación de páginas sin `preloads`
- aceptación de `preloads: []`
- aceptación de `preloads` como lista de nombres no vacíos
- conservación del orden declarado
- rechazo de `preloads` cuando no es array
- rechazo de entradas vacías, no string o whitespace-only
- compatibilidad hacia atrás de configuraciones existentes sin `preloads`

Momento de ejecución:
- durante `T0010-01`
- repetir en `T0010-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### 2. Dominio agregado de entrada de página
Tipo:
- Unit e integration tests del store compartido y sus selectors

Archivos principales:
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-page-entry-preloads.test.tsx` si la nueva cobertura se separa en un archivo dedicado

Comportamiento que valida:
- representación explícita de una entrada sin precargas como estado agregado `idle`
- transición controlada del agregado a `loading`, `success` y `error`
- persistencia del `pageId`, `entryId` y `preloadNames` de la entrada activa
- ignorar cierres agregados de tandas antiguas cuando el `entryId` ya no coincide
- continuidad del resto del store sin regresiones en navegación, formularios y queries

Momento de ejecución:
- durante `T0010-02`
- repetir en `T0010-03` y `T0010-04` como parte de la integración final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
```

### 3. Ejecución automática de `preloads` al entrar en página
Tipo:
- Integration tests del provider del runtime con `fetch` mockeado

Archivos principales:
- `src/tests/runtime-page-entry-preloads.test.tsx`
- `src/tests/runtime-state.test.tsx`

Comportamiento que valida:
- disparo automático sobre `initialPage`
- disparo automático al navegar a una página con `preloads`
- reejecución al volver a una página ya visitada
- ausencia de relanzamientos duplicados para una misma entrada cuando el provider rerenderiza o cambian estados internos no relacionados con la navegación
- ausencia de emisión de red al entrar en una página sin `preloads`
- paralelismo dentro de la misma tanda
- agregado final `success` cuando todas las precargas terminan bien
- agregado final `error` cuando falla al menos una precarga
- conservación de los datos exitosos de queries aunque el agregado global termine en error
- error recuperable para operación inexistente o request no construible
- protección latest-only del agregado frente a finalizaciones tardías
- snapshot común de estado para construir los payloads de todas las precargas de una misma entrada

Momento de ejecución:
- durante `T0010-03`
- repetir en `T0010-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-state.test.tsx
```

### 4. Regresión final del runtime y gate global
Tipo:
- Integration test de regresión del subconjunto afectado del runtime

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-page-entry-preloads.test.tsx`
- `src/tests/read-runtime-config.test.ts`
- `src/tests/runtime-api-execution.test.ts` solo si la integración ajusta el contrato del ejecutor
- `src/tests/app-shell.test.tsx` solo si aparece impacto real en el arranque visible

Comportamiento que valida:
- continuidad del arranque y de la navegación visible sin `preloads`
- coherencia entre validación de config, store y ejecución automática
- comportamiento estable de `preloads: []`
- ausencia de dobles ejecuciones automáticas para una misma entrada de página
- continuidad del runtime frente a errores recuperables de precarga
- mantenimiento del acceso a datos finales a través de `queries.*`
- cumplimiento del gate global de coverage

Momento de ejecución:
- durante `T0010-04`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0010-01`, fijar primero por tests qué shape de `preloads` es válido e inválido antes de tocar tipos y validador.
2. En `T0010-02`, fijar primero por tests el shape del estado agregado y sus guards latest-only antes de cablear reducer y selectors.
3. En `T0010-03`, escribir primero los tests de integración del provider para arranque inicial, navegación, paralelismo, errores recuperables y tandas antiguas antes de implementar la orquestación.
4. En `T0010-04`, ejecutar la regresión del subconjunto relevante y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0010-01
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0010-02
```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
```

### T0010-03
```bash
pnpm exec vitest run src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-state.test.tsx
```

### T0010-04
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio sigue acotado a contrato JSON, store compartido y orquestación automática en memoria con `fetch` mockeado, sin flujo nuevo de navegador extremo a extremo ni UI declarativa final adicional.
