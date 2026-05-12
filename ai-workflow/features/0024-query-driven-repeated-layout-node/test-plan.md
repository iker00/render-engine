# Test Plan: Query-driven repeated layout node

## Estado de revisión

El contrato ya está suficientemente cerrado para implementar y testear:

- `repeater` será el nuevo nodo público, separado de `container`
- la fuente de colección queda limitada a `queries.{queryName}.data` o `queries.{queryName}.data.*`
- el contexto local por iteración usa `item` e `item.*`
- la identidad por iteración depende de `props.items.key` como ruta relativa obligatoria

## Objetivo
Validar que el runtime puede expandir un subárbol completo por cada item de una colección remota, resolver `item.*` con semántica estable, mantener compatibles `queryStateFeedback`, `visibility`, navegación, requests y formularios dentro del subárbol iterado, y degradar con seguridad cuando falten datos o la colección no sea utilizable.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Contrato y validación previa al render de `repeater`
Tipo:
- Unit tests de validación estructural y semántica del config

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el shape público ya parseado

Comportamiento que valida:
- aceptación del nuevo nodo `repeater` con `props.items.source`, `props.items.key` y `props.template`
- rechazo de `source` fuera de `queries.{queryName}.data` o `queries.{queryName}.data.*`
- rechazo de `key` vacía, mal formada o expresada como referencia global en vez de ruta relativa
- rechazo de `template` ausente o no array
- rechazo de combinaciones ambiguas como `children` junto a `template`
- compatibilidad hacia atrás de configuraciones previas sin `repeater`

Momento de ejecución:
- durante `T0024-01`
- repetir en `T0024-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### 2. Resolución central de `item.*` y visibilidad dentro de iteración
Tipo:
- Unit tests de parser y resolver de referencias
- Unit tests del helper de visibilidad efectiva

Archivos principales:
- `src/tests/runtime-reference-resolution.test.tsx`
- `src/tests/runtime-layout-visibility.test.ts`

Comportamiento que valida:
- resolución de `item` como valor completo del item actual
- resolución de `item.*` con rutas simples, anidadas y con índices sobre arrays
- degradación a `missing` cuando la ruta es válida pero el dato no existe o no es navegable
- comportamiento estable cuando `item.*` se usa fuera de un contexto de iteración
- continuidad de `forms.*`, `queries.*` y `params.*`
- soporte de `item.*` dentro de `visibility.reference` sin alterar la precedencia con `queryStateFeedback`

Momento de ejecución:
- durante `T0024-02`
- repetir en `T0024-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/runtime-layout-visibility.test.ts
```

### 3. Expansión visible del árbol con `repeater`
Tipo:
- Integration tests del renderer con store compartido y queries controladas en memoria

Archivos principales:
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-state.test.tsx` solo si conviene fijar desde el harness existente transiciones de la query origen

Comportamiento que valida:
- render de una iteración por cada item de una colección resuelta
- preservación del orden de la colección
- lectura correcta de `item.*` por `heading` y `paragraph` dentro de cada iteración
- degradación a cero iteraciones cuando la query no existe, falla, aún no ofrece datos o resuelve un valor no array
- continuidad de `queryStateFeedback` y `visibility` sobre el propio `repeater` y sobre sus descendientes
- diagnóstico y degradación segura cuando la key por item es nula, no escalar o duplicada

Momento de ejecución:
- durante `T0024-03`
- repetir en `T0024-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
```

### 4. Acciones, formularios y consumidores descendientes dentro de `repeater`
Tipo:
- Integration tests del runtime con navegación, requests declarativos y formularios renderizados

Archivos principales:
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/runtime-api-execution.test.ts`
- `src/tests/runtime-state.test.tsx`
- `src/tests/layout-renderer.test.tsx`

Comportamiento que valida:
- `navigateTo.params` resueltos desde `item.*` para la iteración correcta
- `executeOperation` con `query`, `body` y `headers` resueltos desde el item actual
- `form.submitAction` dentro del `repeater` resolviendo `query`, `body` y `headers` desde el item actual sin romper `resetOnSuccess`
- `defaultValue` de campos dentro del `repeater` usando `item.*` en su primera inicialización efectiva
- continuidad de `forms.*`, `queries.*` y `params.*` dentro del subárbol iterado
- uso de consumidores descendientes de colección dentro del `template` cuando reutilizan referencias relativas al item actual
- degradación local de consumidores parciales sin romper la iteración ni el resto del árbol

Momento de ejecución:
- durante `T0024-04`
- repetir en `T0024-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-button-navigation.test.tsx src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx
```

### 5. Regresión final y gate global
Tipo:
- Integration test de regresión del subconjunto afectado del runtime

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`
- `src/tests/runtime-reference-resolution.test.tsx`
- `src/tests/runtime-layout-visibility.test.ts`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/runtime-api-execution.test.ts`

Comportamiento que valida:
- coherencia entre validación del config, resolución de `item.*`, renderer y consumidores interactivos
- compatibilidad hacia atrás de pantallas que no usan `repeater`
- estabilidad del runtime cuando la query origen no tiene datos válidos o devuelve datos parciales
- cobertura integrada de `button.props.action` y `form.submitAction` dentro de `repeater`
- continuidad de `queryStateFeedback` como mecanismo único de loading, error, empty e idle alrededor de la query origen
- continuidad de la semántica lazy de formularios dentro del subárbol repetido
- mantenimiento del gate global de coverage

Momento de ejecución:
- durante `T0024-05`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-reference-resolution.test.tsx src/tests/runtime-layout-visibility.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-api-execution.test.ts
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0024-01`, fijar primero por tests el shape exacto de `repeater`, sus rechazos y la compatibilidad hacia atrás.
2. En `T0024-02`, escribir primero los tests de `item.*` dentro y fuera de contexto antes de extender parser y resolver.
3. En `T0024-03`, fijar primero los tests de render iterado, degradación a cero iteraciones y keys antes de cablear el renderer.
4. En `T0024-04`, fijar primero los tests de navegación, request params y `defaultValue` basados en `item.*` antes de conectar consumidores interactivos.
5. En `T0024-05`, repetir la regresión del subconjunto afectado y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0024-01
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0024-02
```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/runtime-layout-visibility.test.ts
```

### T0024-03
```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
```

### T0024-04
```bash
pnpm exec vitest run src/tests/runtime-button-navigation.test.tsx src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx
```

### T0024-05
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-reference-resolution.test.tsx src/tests/runtime-layout-visibility.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-api-execution.test.ts
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio sigue acotado a contrato JSON, resolución de referencias, renderer React, estado compartido, navegación interna y construcción declarativa de requests ya cubribles con tests de integración del repositorio sin exigir navegador real, URL externa ni backend real.
