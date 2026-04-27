# Tasks: Runtime structure reorganization

## T0004-01

### Estado
Completada

### Objetivo
Separar el contrato tipado del runtime y la validación estructural en `src/config/`, manteniendo una superficie pública estable para el resto de la aplicación.

### Fuera de alcance
- Cambiar el shape funcional de `RuntimeConfig`, `RuntimePageConfig` o `LayoutNode`.
- Cambiar mensajes de error, códigos de error o criterios de validación.
- Añadir validaciones nuevas no descritas por la spec.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts`
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` si hace falta ajustar imports o tipos públicos
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-contract.md`

### Tests requeridos
- Confirmar que `validateRuntimeConfig` sigue aceptando layouts válidos con varios hermanos raíz.
- Confirmar que `validateRuntimeConfig` sigue aceptando `layout: []`.
- Confirmar que los errores por `initialPage` inexistente, `layout` inválido y nodos no soportados conservan el mismo comportamiento observable.
- Si cambia la superficie pública reexportada, confirmar que `readRuntimeConfig` sigue compilando y resolviendo resultados equivalentes.

### Criterios de finalización
- Los tipos del contrato viven fuera del archivo que contiene la lógica de validación.
- La validación estructural queda concentrada en un archivo propio.
- `src/config/runtime-config.ts` actúa como fachada pública mínima y coherente.
- Los tests relevantes de validación quedan en verde sin cambios de comportamiento.

### Cierre de implementación
Completado cuando la separación interna de `config/` está hecha, los tests relevantes pasan y no queda ninguna decisión arquitectónica abierta sobre la frontera de validación.

### Cierre documental
Pendiente de una pasada posterior para alinear arquitectura y contrato funcional. No se cierra en esta tarea.

## T0004-02

### Estado
Completada

### Objetivo
Reorganizar el renderer del runtime para introducir un punto central explícito de resolución `type -> pieza de render` y un archivo concreto por cada nodo soportado hoy.

### Fuera de alcance
- Añadir nodos nuevos.
- Cambiar estilos o semántica visible de `container`, `heading`, `paragraph` o `list`.
- Introducir una librería de componentes o un sistema de plugins.

### Dependencias
- `T0004-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/layout-renderer.tsx`
  - `src/runtime/layout-node-renderer.tsx`
  - `src/runtime/nodes/container-layout-node.tsx`
  - `src/runtime/nodes/heading-layout-node.tsx`
  - `src/runtime/nodes/paragraph-layout-node.tsx`
  - `src/runtime/nodes/list-layout-node.tsx`
  - `src/runtime/runtime-page.tsx`
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que el runtime sigue renderizando varios nodos raíz en el orden declarado.
- Confirmar que no aparece un `container` sintético alrededor de hermanos raíz.
- Confirmar que `layout: []` sigue produciendo una página vacía.
- Confirmar que `heading`, `paragraph` y `list` siguen tratándose como nodos hoja aunque reciban `children`.
- Confirmar que el render de `container` sigue usando la misma semántica de `direction` y `gap`.

### Criterios de finalización
- Existe un archivo central de dispatch del renderer por `node.type`.
- Cada nodo soportado tiene su propia pieza de render en `src/runtime/nodes/`.
- `LayoutFragment` deja de existir o su responsabilidad queda absorbida sin pérdida funcional.
- El render visible cubierto por tests permanece equivalente.

### Cierre de implementación
Completado cuando el renderer ya está reorganizado según el diseño, los tests de render pasan y no queda lógica de resolución de nodos mezclada con componentes triviales o redundantes.

### Cierre documental
Pendiente de una pasada posterior para actualizar documentación de arquitectura y runtime estable. No se cierra en esta tarea.

## T0004-03

### Estado
Completada

### Objetivo
Alinear consumidores, imports y regresión final para que la estructura reorganizada quede integrada sin cambios funcionales ni deuda oculta en tests.

### Fuera de alcance
- Reabrir la partición arquitectónica ya fijada en `design.md`.
- Introducir refactors laterales en `app/` no necesarios para adaptar imports o superficies públicas.
- Actualizar documentación funcional en esta misma tarea.

### Dependencias
- `T0004-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/app/bootstrap/read-runtime-config.ts`
  - `src/app/App.tsx` si necesita ajustar imports tipados
  - cualquier import residual en `src/runtime/` o `src/tests/` derivado de la nueva estructura
- Tests a crear o modificar:
  - `src/tests/app-bootstrap.test.tsx`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/main.test.tsx` solo si algún ajuste de imports lo hiciera necesario
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`

### Tests requeridos
- Confirmar que `readRuntimeConfig` sigue priorizando `data-config`, usando `dev-config` en desarrollo y devolviendo los mismos errores de arranque.
- Confirmar que `App` sigue renderizando únicamente la página resuelta por `initialPage`.
- Ejecutar una validación final del subconjunto relevante del runtime reorganizado.
- Ejecutar `pnpm test` para verificar el gate global de cobertura del proyecto.

### Criterios de finalización
- No quedan imports rotos ni superficies públicas ambiguas tras el refactor.
- Bootstrap, validación y renderer funcionan juntos con el mismo comportamiento observable.
- Los tests relevantes pasan durante la tarea y `pnpm test` confirma el gate global de cobertura.

### Cierre de implementación
Completado cuando la integración final del refactor está validada con tests relevantes y `pnpm test` queda en verde.

### Cierre documental
Pendiente de una pasada posterior de `update-app-documentation` sobre los documentos listados en el impacto documental.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0004-01`.

No se debe empezar `T0004-02` hasta cerrar `T0004-01`, ni empezar `T0004-03` hasta cerrar `T0004-02`.
