# Design: Runtime structure reorganization

## Objetivo del diseño
Traducir la spec de reorganización en una partición técnica concreta, austera y ejecutable, de modo que la implementación pueda mover el runtime actual a una estructura más legible sin alterar el contrato funcional vigente.

## Estado de partida
Hoy el refactor afecta sobre todo a dos concentraciones de responsabilidad:
- `src/config/runtime-config.ts` mezcla tipos del contrato, shape de errores y validación estructural.
- `src/runtime/layout-renderer.tsx` mezcla composición recursiva, resolución `type -> render`, estilos y render concreto de cada nodo soportado.

También existen consumidores directos de esas superficies:
- `src/app/bootstrap/read-runtime-config.ts`
- `src/runtime/runtime-page.tsx`
- tests en `src/tests/`

## Decisiones de diseño

### 1. Separación austera en `config/`
La frontera de configuración se dividirá por archivo, no por jerarquía profunda.

Estructura objetivo:

```txt
src/config/
  runtime-config.ts
  runtime-config-types.ts
  validate-runtime-config.ts
```

Responsabilidades:
- `runtime-config-types.ts`: tipos del contrato (`RuntimeConfig`, `RuntimePageConfig`, `LayoutNode`, `LayoutNodeType`, etc.) y shape de `RuntimeConfigError`/`RuntimeConfigValidationResult`.
- `validate-runtime-config.ts`: lógica de validación estructural y helpers privados asociados.
- `runtime-config.ts`: fachada pública mínima que reexporta los tipos y `validateRuntimeConfig`.

Razonamiento:
- La spec exige separar contrato y validación.
- Mantener una fachada pública estable evita churn innecesario en imports fuera de `config/`.
- No se introduce una carpeta `validation/` ni capas adicionales porque todavía no hay más validadores reales que justifiquen esa profundidad.

### 2. Renderer central con piezas por nodo en `runtime/`
El renderer declarativo se reorganizará alrededor de un punto central explícito de resolución por `type`.

Estructura objetivo:

```txt
src/runtime/
  layout-renderer.tsx
  layout-node-renderer.tsx
  runtime-page.tsx
  nodes/
    container-layout-node.tsx
    heading-layout-node.tsx
    list-layout-node.tsx
    paragraph-layout-node.tsx
```

Responsabilidades:
- `layout-renderer.tsx`: render de colecciones ordenadas de nodos y generación de keys para hermanos.
- `layout-node-renderer.tsx`: punto central `type -> pieza de render`.
- `nodes/*.tsx`: render concreto de cada nodo soportado hoy.
- `runtime-page.tsx`: composición de página sin asumir detalles internos del renderer.

Razonamiento:
- La spec pide una pieza central de composición y una pieza concreta por nodo soportado.
- La carpeta `nodes/` materializa solo código con uso real inmediato.
- `LayoutFragment` desaparece porque no encapsula comportamiento.

### 3. Sin carpetas futuras vacías
No se materializarán todavía carpetas como `events/`, `forms/`, `queries/` o `shared/` dentro de `src/runtime/`.

La implementación solo debe dejar claro en nombres y límites dónde encajarían futuras capacidades:
- nuevas piezas de render: `src/runtime/nodes/`
- resolución declarativa adicional del runtime: junto a `layout-node-renderer.tsx` o en un módulo hermano cuando exista otro punto de dispatch real
- nuevos validadores del contrato: junto a `src/config/validate-runtime-config.ts` o en módulos vecinos cuando haya más de un validador con responsabilidad propia

Razonamiento:
- La feature prepara crecimiento, pero la spec prohíbe estructura ceremonial sin uso.

### 4. Compatibilidad de comportamiento como restricción de diseño
El refactor no debe cambiar:
- shape soportado del JSON
- catálogo de nodos soportados
- render visible de una página válida
- resolución de `initialPage`
- clasificación de errores (`initial-page-not-found`, `invalid-layout`, `unsupported-node-type`, etc.)
- diferencia entre diagnóstico en desarrollo y degradación silenciosa en producción para errores `development-only`

Esto implica que la implementación debe preferir mover lógica y extraer piezas manteniendo:
- los mismos mensajes de error ya cubiertos por tests
- los mismos defaults de render y estilos actuales
- el soporte de varios hermanos raíz y `layout: []`

## Estrategia de implementación
La feature se implementará en dos refactors funcionales y una pasada final de alineación:

1. Separar `config/` internamente manteniendo la fachada pública estable.
2. Reorganizar `runtime/` para introducir el dispatcher central y componentes por nodo.
3. Ajustar imports, tests y validación final completa del runtime reorganizado.

Esta partición minimiza riesgo porque:
- el cambio de `config/` puede validarse antes de tocar el renderer
- el cambio de `runtime/` puede validarse sobre un contrato de tipos ya estabilizado
- la pasada final se limita a integración y regresión, no a rediseño

## Riesgos y mitigaciones
- Riesgo: romper imports transversales durante la separación de `config/`.
  Mitigación: mantener `src/config/runtime-config.ts` como fachada pública.

- Riesgo: introducir diferencias visibles en el orden o estructura DOM al dividir el renderer.
  Mitigación: preservar `layout-renderer.tsx` como punto de render de colecciones y cubrir orden, raíces hermanas y layouts vacíos con los tests existentes.

- Riesgo: crear componentes por nodo demasiado genéricos o con helpers artificiales.
  Mitigación: extraer solo piezas con responsabilidad directa; no introducir utilidades compartidas sin repetición real.

## Impacto documental posterior
Cuando el código esté implementado, la pasada documental debería revisar:
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
