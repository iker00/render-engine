# Test Plan: Nested query data reference navigation

## Objetivo
Validar que el runtime amplía la resolución central de referencias para navegar subrutas dentro de `queries.{queryName}.data` sin abrir otras ramas de `queries`, sin romper la degradación textual existente y sin bajar el gate global de cobertura.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Contrato base de parsing para rutas anidadas de queries
Tipo:
- Unit tests del parser y de la clasificación de referencias

Archivo principal:
- `src/tests/runtime-reference-resolution.test.tsx`

Comportamiento que valida:
- aceptación de `queries.{queryName}.data.{segmentosAnidados}`
- continuidad del contrato actual para `queries.{queryName}`, `.data`, `.status` y `.error`
- rechazo uniforme de ramas anidadas en `status` y `error`
- rechazo uniforme de rutas mal formadas bajo `queries`
- mantenimiento del escape literal con `\` para rutas anidadas

Momento de ejecución:
- durante `T0008-01`
- repetir en `T0008-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx
```

### 2. Resolución central sobre objetos, arrays y datos ausentes
Tipo:
- Unit tests del resolver con apoyo de estado real del runtime

Archivos principales:
- `src/tests/runtime-reference-resolution.test.tsx`
- `src/tests/runtime-state.test.tsx`

Comportamiento que valida:
- navegación correcta por objetos anidados
- navegación correcta por arrays e índices posicionales
- recorrido mixto objeto -> array -> objeto
- tratamiento de segmentos numéricos como índice solo sobre arrays y como clave literal sobre objetos
- resultado `missing` para query inexistente, `data` nulo o indefinido, clave ausente, índice fuera de rango o intento de profundizar dentro de un primitivo
- continuidad de las rutas ya soportadas por `0007`

Momento de ejecución:
- durante `T0008-02`
- repetir en `T0008-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/runtime-state.test.tsx
```

### 3. Integración visible en superficies textuales existentes
Tipo:
- Integration tests del renderer visible con provider del runtime

Archivos principales:
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-reference-resolution.test.tsx`

Comportamiento que valida:
- render de valores anidados de `queries.*.data.*` en `heading.props.text` y `paragraph.props.text`
- continuidad del texto literal y del escape literal
- degradación a vacío para referencias anidadas `missing` o `invalid`
- degradación a vacío para resultados resueltos que sean objeto, array, `null` o `undefined`
- diagnóstico de desarrollo coherente con la ruta completa original y la superficie consumidora

Momento de ejecución:
- durante `T0008-03`
- repetir en `T0008-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/layout-renderer.test.tsx
```

### 4. Regresión final del runtime y gate global
Tipo:
- Integration test de regresión del subconjunto del runtime afectado

Archivos principales:
- `src/tests/runtime-reference-resolution.test.tsx`
- `src/tests/runtime-state.test.tsx`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/app-shell.test.tsx` solo si la integración final revela una regresión real en el montaje

Comportamiento que valida:
- continuidad del comportamiento actual cuando la configuración no usa navegación anidada
- compatibilidad entre parser, resolver, selectores y superficies textuales
- continuidad de `queries.{queryName}`, `.data`, `.status` y `.error`
- ausencia de regresión en el store compartido por instancia y en el render estático del layout
- cumplimiento del gate global de coverage

Momento de ejecución:
- durante `T0008-04`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0008-01`, fijar primero el shape válido e inválido de `queries.{queryName}.data.*` antes de tocar el lookup real.
2. En `T0008-02`, endurecer los tests del resolver para objetos, arrays, segmentos numéricos ambiguos y casos `missing` antes de implementar la navegación.
3. En `T0008-03`, escribir primero los tests visibles de render, degradación y diagnóstico para rutas anidadas antes de ajustar la integración.
4. En `T0008-04`, ejecutar la regresión final del subconjunto relevante y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0008-01
```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx
```

### T0008-02
```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/runtime-state.test.tsx
```

### T0008-03
```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/layout-renderer.test.tsx
```

### T0008-04
```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio sigue acotado a resolución runtime en memoria y a superficies textuales ya existentes, sin navegador real, red real ni flujo extremo a extremo nuevo.
