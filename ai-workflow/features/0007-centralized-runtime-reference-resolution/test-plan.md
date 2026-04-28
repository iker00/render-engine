# Test Plan: Centralized runtime reference resolution

## Objetivo
Validar que el runtime introduce una convención central para resolver referencias string contra el estado compartido por instancia, aplicándola en esta iteración solo a `heading.props.text` y `paragraph.props.text` sin romper el render estático existente ni el gate global de cobertura.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Contrato base de parsing y clasificación de referencias
Tipo:
- Unit tests del parser y de la clasificación inicial de referencias

Archivo principal:
- `src/tests/runtime-reference-resolution.test.tsx`

Comportamiento que valida:
- detección de referencias oficiales `forms.*` y `queries.*`
- clasificación de namespaces reservados `navigation.*`, `routeParams.*` y `params.*`
- escape literal con `\` para rutas que coinciden con una referencia oficial o reservada
- rechazo uniforme de rutas mal formadas
- mantenimiento de texto literal cuando no existe una referencia completa simple

Momento de ejecución:
- durante `T0007-01`
- repetir en `T0007-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx
```

### 2. Resolución contra el store compartido del runtime
Tipo:
- Unit tests o integration ligera del resolver sobre `RuntimeState`

Archivos principales:
- `src/tests/runtime-reference-resolution.test.tsx`
- `src/tests/runtime-state.test.tsx`

Comportamiento que valida:
- lectura de `forms.{formId}.{fieldId}` contra el valor actual compartido
- lectura de `queries.{queryName}` y de `queries.{queryName}.data|status|error`
- igualdad de resultado al leer la misma referencia varias veces dentro de la misma instancia
- distinción entre `missing` y `invalid`
- invalidación uniforme de subrutas fuera del catálogo oficial

Momento de ejecución:
- durante `T0007-02`
- repetir en `T0007-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/runtime-state.test.tsx
```

### 3. Integración visible en `heading` y `paragraph`
Tipo:
- Integration tests del renderer visible con provider del runtime

Archivos principales:
- `src/tests/runtime-reference-resolution.test.tsx`
- `src/tests/layout-renderer.test.tsx`

Comportamiento que valida:
- render de valores actuales de `forms.*` y `queries.*` dentro de `heading.props.text` y `paragraph.props.text`
- continuidad del render estático cuando el texto es literal
- degradación a vacío para referencias `missing`, `unsupported` e `invalid`
- render literal sin el carácter de escape
- ausencia de interpolación parcial dentro de strings
- diagnóstico de desarrollo con la ruta y la superficie consumidora

Momento de ejecución:
- durante `T0007-03`
- repetir en `T0007-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/layout-renderer.test.tsx
```

### 4. Regresión final del runtime y gate global
Tipo:
- Integration test de regresión del runtime relevante para la feature

Archivos principales:
- `src/tests/runtime-reference-resolution.test.tsx`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-state.test.tsx`
- `src/tests/app-shell.test.tsx` solo si la integración final requiere endurecer el montaje

Comportamiento que valida:
- continuidad del comportamiento actual cuando la configuración no usa referencias dinámicas
- compatibilidad entre resolver central, renderer visible y store compartido
- ausencia de regresión en el layout estático y en el aislamiento por instancia del runtime
- cumplimiento del gate global de coverage

Momento de ejecución:
- durante `T0007-04`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0007-01`, fijar primero el parser y la clasificación base de referencias antes de conectar el store.
2. En `T0007-02`, endurecer los tests del resolver sobre `RuntimeState` antes de implementar los lookups oficiales de `forms` y `queries`.
3. En `T0007-03`, escribir primero los tests visibles de `heading` y `paragraph`, incluyendo degradación y diagnóstico en desarrollo, antes de tocar los nodos.
4. En `T0007-04`, ejecutar la regresión final del subconjunto relevante y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0007-01
```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx
```

### T0007-02
```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/runtime-state.test.tsx
```

### T0007-03
```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/layout-renderer.test.tsx
```

### T0007-04
```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-state.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio no introduce navegación de navegador, integración remota real ni un flujo extremo a extremo completo que justifique e2e en esta fase.
