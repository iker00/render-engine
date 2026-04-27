# Test Plan: Feature 0003 - layout-array-page-structure

## Objetivo del plan
Validar la migración del contrato de página para que `layout` deje de ser un nodo raíz único y pase a ser una colección ordenada de elementos declarativos, preservando la validación explícita, el render observable del runtime y el manejo actual de errores entre desarrollo y producción.

## Cobertura y gate global
- El gate de cierre sigue siendo el estándar global del repositorio: mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- `pnpm test` sigue siendo obligatorio al cierre de cada tarea con código.
- La tarea final debe cerrar además con `pnpm lint`, `pnpm test` y `pnpm build`.
- La implementación no debe darse por válida si el cambio de contrato reduce la cobertura por debajo del umbral global.

## Bloques de tests esperados

### 1. Unit tests del contrato y validador de colecciones de layout
- Tipo:
  Unit tests.
- Tareas a las que aplica:
  `0003-T01`
- Qué valida:
  - Que una página válida con `layout` como array de elementos hermanos se acepta.
  - Que `layout: []` se acepta como caso válido.
  - Que el shape antiguo `layout` como objeto se rechaza con error explícito.
  - Que un elemento inválido o un `type` no soportado falla tanto en la raíz como en `children`.
  - Que `initialPage` inexistente sigue produciendo su error explícito.
- Archivos de test esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
- Comandos de validación:
  - `pnpm test`

### 2. Integration tests del renderer con múltiples hermanos raíz
- Tipo:
  Integration tests.
- Tareas a las que aplica:
  `0003-T02`
- Qué valida:
  - Render de varios elementos raíz en el mismo orden en que aparecen en `layout`.
  - Conservación del comportamiento de anidación de `container.children`.
  - Resolución correcta de `layout: []` sin contenido inventado.
  - Ausencia de un wrapper de layout `container` sintético alrededor de la raíz de página.
- Archivos de test esperados:
  - `src/tests/layout-renderer.test.tsx`
- Comandos de validación:
  - `pnpm test`

### 3. Integration tests del arranque de `App` con el contrato migrado
- Tipo:
  Integration tests.
- Tareas a las que aplica:
  `0003-T03`
- Qué valida:
  - Que `App` renderiza correctamente páginas con varios hermanos raíz desde `src/dev/config.json`.
  - Que `data-config` sigue teniendo prioridad y también soporta el nuevo shape de `layout`.
  - Que la migración no rompe la resolución de `initialPage`.
  - Que el runtime visible sigue sin renderizar páginas no seleccionadas.
- Archivos de test esperados:
  - `src/tests/app-bootstrap.test.tsx`
  - `src/tests/app-shell.test.tsx`
  - `src/tests/main.test.tsx` si hace falta reforzar el punto de entrada real
- Comandos de validación:
  - `pnpm test`
  - `pnpm build`

### 4. Tests de errores de configuración con la raíz migrada
- Tipo:
  Integration tests.
- Tareas a las que aplica:
  `0003-T03`
- Qué valida:
  - Error visible y diagnóstico en desarrollo cuando `layout` se declara como objeto.
  - Error visible y diagnóstico en desarrollo cuando un elemento raíz o anidado es inválido.
  - Error visible y diagnóstico en desarrollo cuando aparece un `type` no soportado dentro de la colección migrada.
  - En producción, ausencia de mensaje genérico visible y ausencia de contenido inventado ante esos fallos.
- Archivos de test esperados:
  - ampliaciones sobre `src/tests/app-bootstrap.test.tsx`
  - ampliaciones sobre `src/tests/read-runtime-config.test.ts` si la clasificación del error necesita cobertura adicional en la frontera de bootstrap
- Comandos de validación:
  - `pnpm test`

## Tests e2e
- No aplican en esta feature.
- Razón:
  El cambio es una migración de contrato y renderer local dentro del mismo runtime estático, sin navegación interactiva, backend real ni flujos usuario-servidor que justifiquen e2e.

## Secuencia recomendada de validación durante implementación
1. En `0003-T01`, empezar por tests del validador que fallen con `layout` como objeto y exijan `layout` como array, incluyendo el caso vacío y errores anidados.
2. En `0003-T02`, introducir o ajustar tests del renderer para múltiples hermanos raíz, orden visible y ausencia de contenedor sintético antes de adaptar `RuntimePage`.
3. En `0003-T03`, ampliar primero los tests de `App` y bootstrap para las dos fuentes de configuración y para los errores visibles/silenciosos del contrato migrado.
4. Al cerrar la feature implementada, ejecutar `pnpm lint`, `pnpm test` y `pnpm build`.

## Criterio de cierre de la feature
- No debe considerarse lista para pasar a documentación si cualquiera de estos puntos falla:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
  - gate de cobertura del 80% sobre `src/`
