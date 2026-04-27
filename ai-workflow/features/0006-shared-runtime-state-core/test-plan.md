# Test Plan: Shared runtime state core

## Objetivo
Validar que el runtime incorpora un núcleo de estado compartido por instancia para navegación, formularios y queries sin romper el arranque actual en `initialPage`, manteniendo aislamiento entre instancias y el gate global de cobertura del proyecto.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada.

## Bloques de tests esperados

### 1. Store base del runtime compartido
Tipo:
- Unit test o integration ligera sobre provider, reducer y selectors del store del runtime

Archivo principal:
- `src/tests/` en un archivo nuevo específico para `runtime-state`

Comportamiento que valida:
- creación de un estado aislado por instancia
- shape inicial con dominios `navigation`, `forms` y `queries`
- inicialización de `navigation.currentPageId` desde `initialPage`
- presencia de historial interno mínimo desde la base
- reset total de la instancia al estado inicial

Momento de ejecución:
- durante `T0006-01`
- repetir en `T0006-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/<runtime-state-test>.test.tsx
```

### 2. Navegación interna apoyada en estado compartido
Tipo:
- Integration test del runtime visible y del provider del estado

Archivos principales:
- `src/tests/app-bootstrap.test.tsx`
- `src/tests/app-shell.test.tsx`
- `src/tests/<runtime-state-test>.test.tsx`

Comportamiento que valida:
- continuidad del arranque en `initialPage` cuando no hay interacción
- resolución de la página visible desde `navigation.currentPageId`
- navegación válida sin cambio de URL del navegador
- error controlado y conservación de la página previa al intentar navegar a una página inexistente

Momento de ejecución:
- durante `T0006-02`
- repetir en `T0006-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/<runtime-state-test>.test.tsx src/tests/app-bootstrap.test.tsx src/tests/app-shell.test.tsx
```

### 3. Dominio de formularios en estado compartido
Tipo:
- Unit test o integration ligera del dominio `forms` dentro del store

Archivo principal:
- `src/tests/<runtime-state-test>.test.tsx` o un archivo específico del dominio `forms`

Comportamiento que valida:
- organización por `forms.{formId}.{fieldId}`
- inicialización predecible con `defaultValue`
- actualización consistente de `value`
- presencia de `error`, `touched` y `dirty` en el shape base
- reset por formulario sin afectar a otros formularios
- persistencia del estado de formularios al cambiar de página dentro de la misma instancia

Momento de ejecución:
- durante `T0006-03`
- repetir en `T0006-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/<runtime-state-test>.test.tsx
```

### 4. Dominio de queries en estado compartido
Tipo:
- Unit test o integration ligera del dominio `queries` dentro del store

Archivo principal:
- `src/tests/<runtime-state-test>.test.tsx` o un archivo específico del dominio `queries`

Comportamiento que valida:
- organización por nombre de query compartida
- shape base `status/data/error`
- transición `idle -> loading -> success/error`
- conservación del último `data` válido durante recargas en `loading`
- persistencia del estado de queries al cambiar de página dentro de la misma instancia
- encapsulación del error con shape estable y orientado a UI

Momento de ejecución:
- durante `T0006-04`
- repetir en `T0006-05` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/<runtime-state-test>.test.tsx
```

### 5. Regresión final de integración e aislamiento
Tipo:
- Integration test del runtime completo sobre varias instancias y remontaje

Archivos principales:
- `src/tests/<runtime-state-test>.test.tsx`
- `src/tests/app-bootstrap.test.tsx`
- `src/tests/app-shell.test.tsx`
- `src/tests/layout-renderer.test.tsx`

Comportamiento que valida:
- aislamiento completo entre dos instancias montadas a la vez
- limpieza del estado al desmontar y remontar el runtime
- continuidad del render visible de la página activa
- ausencia de regresión en el renderer estático actual cuando no se usan todavía formularios ni queries reales

Momento de ejecución:
- durante `T0006-05`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/<runtime-state-test>.test.tsx src/tests/app-bootstrap.test.tsx src/tests/app-shell.test.tsx src/tests/layout-renderer.test.tsx
```

## Secuencia recomendada tests-first
1. En `T0006-01`, fijar primero el test del store base para cerrar shape, aislamiento por instancia e inicialización.
2. En `T0006-02`, endurecer las pruebas de bootstrap y navegación antes de mover la página activa al estado compartido.
3. En `T0006-03`, añadir tests del dominio `forms` antes de implementar sus acciones y selectors.
4. En `T0006-04`, añadir tests del dominio `queries`, especialmente la conservación del último `data` válido durante `loading`.
5. En `T0006-05`, ejecutar la regresión completa y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0006-01
```bash
pnpm exec vitest run src/tests/<runtime-state-test>.test.tsx
```

### T0006-02
```bash
pnpm exec vitest run src/tests/<runtime-state-test>.test.tsx src/tests/app-bootstrap.test.tsx src/tests/app-shell.test.tsx
```

### T0006-03
```bash
pnpm exec vitest run src/tests/<runtime-state-test>.test.tsx
```

### T0006-04
```bash
pnpm exec vitest run src/tests/<runtime-state-test>.test.tsx
```

### T0006-05
```bash
pnpm exec vitest run src/tests/<runtime-state-test>.test.tsx src/tests/app-bootstrap.test.tsx src/tests/app-shell.test.tsx src/tests/layout-renderer.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio no introduce routing de navegador, integración remota real ni un flujo de usuario completo que justifique e2e en esta fase.
