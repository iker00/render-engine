# Test Plan: Sede electronica visual alignment

## Objetivo
Validar que el runtime abandona la base visual oscura actual y adopta una gramática institucional clara, reusable y responsive sin cambiar el contrato funcional del renderer, los formularios ni la navegación interna.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final de integración visual.

## Unit tests esperados

### 1. Tokens y slots visuales del runtime
Archivo principal:
- `src/tests/runtime-node-styling.test.ts`

Comportamiento a validar:
- existencia de slots o helpers estables para shell, contenido, tipografía, superficies, campos y acciones
- continuidad de la compatibilidad de `container.props.gap` con alias y valor arbitrario
- adopción de colores, radios, bordes y densidad alineados con el baseline claro institucional
- ausencia de una API nueva de estilos declarativos en el JSON

Momento de ejecución:
- durante `T0026-01`
- ampliar en `T0026-02`
- repetir en `T0026-03` y `T0026-04` como regresión del sistema visual

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-node-styling.test.ts
```

## Integration tests esperados

### 2. Shell de aplicación y superficies de error
Archivos principales:
- `src/tests/app-shell.test.tsx`
- `src/tests/app-bootstrap.test.tsx`

Comportamiento a validar:
- el shell visible renderiza el runtime dentro de una composición clara y centrada
- la app deja de depender del contenedor oscuro previo
- los errores de bootstrap siguen mostrando una jerarquía legible dentro del shell nuevo
- el shell expone clases responsive estables para padding, ancho y respiración del contenido en móvil, tablet y desktop
- la selección de `initialPage` y la degradación silenciosa en producción mantienen su semántica vigente

Momento de ejecución:
- durante `T0026-01`
- repetir en `T0026-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/app-shell.test.tsx src/tests/app-bootstrap.test.tsx
```

### 3. Contenido visible y jerarquía de lectura
Archivo principal:
- `src/tests/layout-renderer.test.tsx`

Comportamiento a validar:
- `heading` conserva su tag semántico por `level` y adopta la nueva jerarquía visual
- `paragraph` y `list` mantienen contenido y orden, pero con una apariencia coherente con la referencia clara
- `container` sigue soportando `direction` y `gap` mientras expresa la nueva composición
- los wrappers visibles que estructuran el contenido exponen clases responsive estables cuando esa jerarquía dependa de breakpoints
- páginas con varios nodos raíz conservan orden lógico de lectura y no dependen de wrappers sintéticos nuevos

Momento de ejecución:
- durante `T0026-02`
- repetir en `T0026-04` como regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx
```

### 4. Formularios, controles y acciones visibles
Archivos principales:
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/runtime-state.test.tsx` solo si se endurecen aserciones de formulario visible

Comportamiento a validar:
- `form` funciona como superficie principal clara del trámite
- `input`, `textarea` y `select` comparten labels, borde, focus y error coherentes
- `radioGroup` y `checkboxGroup` mantienen controles nativos con una densidad y alineación consistentes
- los botones siguen ejecutando `navigateTo`, `goBack`, `executeOperation` y `resetForm` con la misma semántica actual
- la jerarquía visual de acciones distingue CTA principal de acciones auxiliares sin romper comportamiento, fijando por tests la convención de submit implícito primario y acciones explícitas auxiliares dentro de `form`
- la tarjeta principal y la barra final de acciones exponen clases responsive estables para móvil, tablet y desktop

Momento de ejecución:
- durante `T0026-03`
- repetir en `T0026-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx
```

### 5. Integración visible con configuración de desarrollo
Archivos principales:
- `src/tests/app-shell.test.tsx`
- `src/tests/app-bootstrap.test.tsx`
- `src/tests/layout-renderer.test.tsx`

Comportamiento a validar:
- la configuración local de `src/dev/config.json` sigue siendo válida, conserva los flujos de desarrollo existentes y añade una página representativa de la nueva gramática visual
- pantallas con y sin formulario mantienen una jerarquía de lectura coherente
- las pantallas representativas ejercitan la adaptación responsive mediante clases verificables en tests
- la integración final no reintroduce el baseline oscuro previo ni rompe la selección de página activa

Momento de ejecución:
- durante `T0026-04`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/app-shell.test.tsx src/tests/app-bootstrap.test.tsx src/tests/layout-renderer.test.tsx
```

## Regresión final y gate global

### 6. Subconjunto visual afectado completo
Tipo:
- integración y regresión final del runtime afectado por la feature

Archivos principales:
- `src/tests/runtime-node-styling.test.ts`
- `src/tests/app-shell.test.tsx`
- `src/tests/app-bootstrap.test.tsx`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-button-navigation.test.tsx`

Comportamiento que valida:
- coherencia entre tokens, shell, contenido, formularios y acciones visibles
- continuidad funcional del renderer y de la navegación interna
- mantenimiento del contrato actual de formularios y acciones pese al rediseño visual
- ausencia de regresión hacia el shell oscuro y técnico previo
- mantenimiento del gate global de coverage

Momento de ejecución:
- durante `T0026-04`

Comandos recomendados:

```bash
pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/app-shell.test.tsx src/tests/app-bootstrap.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0026-01`, fijar primero por tests la base de tokens y la nueva composición del shell.
2. En `T0026-02`, endurecer los tests de `runtime-node-styling` y `layout-renderer` antes de cerrar la gramática de contenido y contenedores.
3. En `T0026-03`, fijar primero las aserciones visibles de formularios, controles y botones antes de cerrar el restyling del catálogo interactivo.
4. En `T0026-04`, repetir la regresión del subconjunto visual completo y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0026-01
```bash
pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/app-shell.test.tsx src/tests/app-bootstrap.test.tsx
```

### T0026-02
```bash
pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx
```

### T0026-03
```bash
pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx
```

### T0026-04
```bash
pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/app-shell.test.tsx src/tests/app-bootstrap.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El alcance es una realineación visual del runtime React ya cubierto por tests de integración locales; no introduce routing de navegador, backend nuevo ni una interacción externa que justifique navegador real.
