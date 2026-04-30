# Test Plan: Zod runtime config validation

## Objetivo
Validar que la migración del runtime config a una base apoyada en `Zod` preserva el contrato público actual, mejora la trazabilidad diagnóstica, mantiene las validaciones cruzadas relevantes y no rompe el gate global de cobertura del proyecto.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Paridad estructural del contrato con base `Zod`
Tipo:
- Unit tests de validación estructural del runtime config

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`

Comportamiento que valida:
- aceptación de configuraciones válidas con `api`, `pages`, `initialPage`, `preloads` y nodos soportados
- aceptación del catálogo vigente de nodos (`container`, `heading`, `paragraph`, `list`, `button`)
- aceptación de `layout: []` y de `preloads` omitido o vacío
- validación de `api.method`, `endpoint`, `query` y `body` con la semántica vigente
- rechazo de `GET` con `body`
- rechazo de `pages` no array, `preloads` inválido y shapes de nodo incompatibles
- aceptación estructural de `button.props.action.type` solo para `navigateTo | goBack`
- aceptación estructural de `button.props.action.pageId` como string no vacío cuando `type` es `navigateTo`, dejando para `T0012-03` la comprobación de que el destino exista en `pages`
- descarte de claves extra sin convertir configuraciones válidas en inválidas
- tratamiento de `children` en nodos hoja como dato ignorado, no como semántica soportada
- mantenimiento del error explícito para nodo no soportado

Momento de ejecución:
- durante `T0012-01`
- repetir en `T0012-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
```

### 2. Adaptación diagnóstica y frontera pública de errores
Tipo:
- Unit tests de mapping de errores estructurales
- Integration tests del borde de lectura del config cuando haga falta fijar mensajes visibles

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`

Comportamiento que valida:
- conservación de `code: invalid-layout` para shapes estructurales inválidos
- conservación de `code: unsupported-node-type` cuando falle el discriminante `type`
- conservación de `displayMode` estable entre errores siempre visibles y errores solo de desarrollo
- mensajes diagnósticos que incluyen rutas útiles del JSON para localizar el fallo, usando el path canónico del contrato cuando aplique como `layout[0].props.action.pageId`
- continuidad de `invalid-json` y `missing-config` en `readRuntimeConfig`
- ausencia de exposición de detalles internos de `Zod` en la API pública

Momento de ejecución:
- durante `T0012-02`
- repetir en `T0012-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### 3. Validaciones cruzadas preservadas tras la migración
Tipo:
- Unit tests de validación semántica sobre config ya parseado

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`

Comportamiento que valida:
- rechazo explícito de `initialPage` inexistente
- rechazo explícito de `button.props.action.pageId` inexistente cuando la acción es `navigateTo`
- aceptación de botones con destinos válidos
- continuidad de acciones `goBack` sin exigir `pageId`
- continuidad de configuraciones previas sin botones
- rechazo del config completo cuando una única referencia global válida estructuralmente pero inválida semánticamente rompe la coherencia del conjunto

Momento de ejecución:
- durante `T0012-03`
- repetir en `T0012-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### 4. Regresión final y gate global
Tipo:
- Integration test del subconjunto afectado del bootstrap y del validador

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`
- `src/tests/app-bootstrap.test.tsx` solo si el cierre descubre impacto real en la superficie visible del arranque

Comportamiento que valida:
- continuidad del arranque para configuraciones válidas
- rechazo previo al render para configuraciones inválidas
- coherencia entre parser estructural, adaptación de errores y validaciones cruzadas
- mantenimiento del gate global de coverage

Momento de ejecución:
- durante `T0012-04`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0012-01`, fijar primero por tests la paridad estructural y de normalización del contrato actual antes de sustituir la lógica manual por esquemas `Zod`.
2. En `T0012-02`, fijar por tests la semántica pública de los errores y la mejora diagnóstica antes de cerrar el adaptador desde `Zod`.
3. En `T0012-03`, fijar por tests las validaciones cruzadas que deben sobrevivir a la migración, especialmente `initialPage` y destinos `navigateTo`.
4. En `T0012-04`, ejecutar la regresión del subconjunto afectado y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0012-01
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
```

### T0012-02
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0012-03
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0012-04
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio sigue acotado al borde de validación del runtime config y al bootstrap en memoria; no introduce un flujo extremo a extremo dependiente de navegador real, backend real ni routing.
