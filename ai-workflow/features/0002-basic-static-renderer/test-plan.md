# Test Plan: Feature 0002 - basic-static-renderer

## Objetivo del plan
Validar que la aplicación deja de ser un shell provisional y pasa a interpretar una página estática declarada desde configuración, con contrato mínimo de layout, catálogo acotado de nodos soportados y manejo explícito de errores de configuración.

## Cobertura y gate global
- El gate de cierre sigue siendo el estándar global del repositorio: mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- `pnpm test` debe seguir siendo el comando que aplique ese gate al cierre de cada tarea y de la pasada completa.
- La skill de implementación debe tratar `pnpm test` como validación obligatoria en todas las tareas con código y `pnpm lint` + `pnpm build` como validaciones obligatorias al cerrar la tarea final de integración.

## Bloques de tests esperados

### 1. Unit tests de contrato y validación del runtime config
- Tipo:
  Unit tests.
- Tareas a las que aplica:
  `0002-T01`
- Qué valida:
  - Que una configuración con `pages`, `initialPage` y `layout` válidos se acepta.
  - Que una página ya no depende de `title` y `description` para ser válida en esta feature.
  - Que `initialPage` inexistente produce un error explícito.
  - Que un `layout` con forma inválida produce un error explícito.
  - Que un nodo con `type` no soportado queda clasificado como error de configuración, no como fallback silencioso.
- Archivos de test esperados:
  - `src/tests/read-runtime-config.test.ts`
  - un archivo adicional de tests unitarios del validador o resolvedor de página inicial en `src/tests/` si la separación de responsabilidades lo justifica.
- Comandos de validación:
  - `pnpm test`

### 2. Integration tests del renderer de layout estático
- Tipo:
  Integration tests.
- Tareas a las que aplica:
  `0002-T02`
- Qué valida:
  - Render completo de un árbol válido con `container`, `heading`, `paragraph` y `list`.
  - Respeto de la anidación declarativa mediante `container.children`.
  - Render de `heading.level` con jerarquía visible.
  - Render de `list.items` como colección estática de strings.
  - Comportamiento de nodos hoja cuando reciben `children` inesperados: no deben interpretarlos.
  - Comportamiento de `container` sin `children` o con `children` vacíos.
- Archivos de test esperados:
  - nuevos tests del renderer en `src/tests/`, por ejemplo `layout-renderer.test.tsx` o equivalente.
- Comandos de validación:
  - `pnpm test`

### 3. Integration tests del arranque visible de `App`
- Tipo:
  Integration tests.
- Tareas a las que aplica:
  `0002-T03`
- Qué valida:
  - Que `App` muestra la página indicada por `initialPage` cuando hay varias páginas declaradas.
  - Que las páginas no seleccionadas no se renderizan.
  - Que el arranque sigue funcionando tanto con `src/dev/config.json` como con `data-config`.
  - Que desaparece el shell provisional y el contenido visible pasa a salir de `layout`.
- Archivos de test esperados:
  - `src/tests/app-bootstrap.test.tsx`
  - `src/tests/app-shell.test.tsx` o su equivalente actualizado al nuevo runtime visible.
- Comandos de validación:
  - `pnpm test`
  - `pnpm build`

### 4. Tests de errores visibles en desarrollo y degradación en producción
- Tipo:
  Integration tests.
- Tareas a las que aplica:
  `0002-T03`
- Qué valida:
  - Error visible y diagnóstico en desarrollo cuando `initialPage` no existe.
  - Error visible y diagnóstico en desarrollo cuando `layout` es inválido.
  - Error visible y diagnóstico en desarrollo cuando aparece un nodo no soportado.
  - En producción, ausencia de mensaje genérico visible al usuario en esos casos.
  - En producción, ausencia de contenido inventado como sustitución del layout fallido.
- Archivos de test esperados:
  - ampliaciones sobre `src/tests/app-bootstrap.test.tsx` y/o tests de integración específicos del runtime visible en `src/tests/`.
- Comandos de validación:
  - `pnpm test`

## Tests e2e
- No aplican en esta feature.
- Razón:
  El alcance sigue siendo un renderer estático local sin navegación interactiva, formularios, mutaciones ni integración real con backend. Los riesgos relevantes quedan mejor cubiertos con unit e integration tests sobre el runtime y el arranque React.

## Secuencia recomendada de validación durante implementación
1. En `0002-T01`, empezar por tests de contrato/validación que fallen con el shape provisional actual y después ajustar tipos, parser y fixture.
2. En `0002-T02`, introducir primero tests del renderer para los cuatro nodos soportados y completar luego la implementación mínima del árbol estático.
3. En `0002-T03`, ampliar primero los tests de integración de `App` para la selección de `initialPage` y para los errores de desarrollo/producción, y después sustituir el shell provisional.
4. Al cerrar la feature implementada, ejecutar `pnpm lint`, `pnpm test` y `pnpm build`.

## Criterio de cierre de la feature
- No debe considerarse lista para pasar a documentación si cualquiera de estos puntos falla:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
  - gate de cobertura del 80% sobre `src/`
