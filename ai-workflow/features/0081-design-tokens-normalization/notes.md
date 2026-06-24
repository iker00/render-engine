# 0081 — Notas de implementación y verificación visual

## Estado de la suite de tests

- Test Files: 105 passed
- Tests: 2304 passed
- Coverage global: 92.13% (umbral 80% superado)

## Verificación de criterio de aceptación 1 — Sin colores crudos en `src/runtime/`

Comando ejecutado:
```
grep -rE "(blue|red|green|yellow|cyan|gray)-[0-9]+" src/runtime/
```
Resultado: **0 coincidencias**. El criterio de aceptación 1 de la spec queda satisfecho.

## Registro de cambios por tarea

### T1 — Paleta semántica y `--radius-card`
- 60 variables `--color-<rol>-<step>` declaradas en `@theme` para los seis roles: neutral, primary, success, warning, danger, info (pasos 50–900).
- `--radius-card: 0.75rem` declarado, alineado con `--radius-section`.
- Tokens app-level existentes conservados sin tocar en esta tarea.

### T2 — Anclaje tokens app-level
- `--color-app-accent` pasa de verde lima (`#A6D82F`) a `var(--color-primary-600)` (`#2563eb`), alineado con la referencia sede.
- Resto de tokens app-level (`app-background`, `app-surface-subtle`, bordes, textos, danger) anclados a la paleta semántica mediante `var(--color-<rol>-<step>)`.
- `--color-app-surface` conserva `#ffffff` literal (blanco puro no presente en la rampa neutral).
- Ninguna línea comentada obsoleta permanece en el bloque `@theme`.

### T3 — Maps de variantes de botón
- Los cuatro maps (`solid`, `outline`, `ghost`, `link`) migrados a paleta semántica.
- Mapeo: `blue-* → primary-*`, `red-* → danger-*`, `green-* → success-*`, `yellow-* → warning-*`, `cyan-* → info-*`, `gray-* → neutral-*`.

### T4 — Escala tipográfica, pesos y padding
- `headingSizeClassMap` reducido: h1 → `text-lg sm:text-xl`, h2 → `text-base sm:text-lg`, h3-4 → `text-sm sm:text-base`, h5-6 → `text-xs sm:text-sm`.
- Pesos: `font-semibold` en h1-h2; `font-medium` en h3-h6, labels, paginación, filtros.
- Padding uniforme eliminando la inversión móvil/desktop: inputs `px-3 py-2`, botones `px-3.5 py-2`, paginación `px-3 py-1.5`.

### T5–T13 — Migración de estilos inline a funciones centralizadas
- Accordion, tabs, link, stat, badge, alert, skeleton, input icon, file-manager migrados a `runtime-node-styling.ts`.
- `transition-colors` garantizado en todos los elementos interactivos.
- Ningún componente bajo `src/runtime/nodes/` conserva clases de color crudas de Tailwind.

## Comparación visual con `sede.png`

La imagen de referencia (`ai-workflow/design/sede.png`) muestra una interfaz institucional con:

### Tono cromático
**Coherencia**: La paleta primary (#2563eb como step 600) replica con exactitud el azul institucional visible en los botones CTA, enlaces y elementos activos de sede.png. Los neutrales fríos (rampa slate) son correctos para texto, bordes y superficies. No se observa desviación tonal significativa respecto a la referencia.

**Cambio más notable**: El accent del runtime era verde lima (#A6D82F) y ahora es azul (#2563eb). El cambio es deliberado, esperado por la spec y alineado con sede.png.

### Jerarquía tipográfica
**Coherencia**: La reducción de la escala de headings (h1 techo en `text-xl`) produce una jerarquía de aplicación de gestión coherente con la densidad de sede.png. Los títulos ya no compiten con el contenido principal. Los labels y textos de apoyo se mantienen en `text-sm`, lo que refleja el tono compacto de la referencia.

**Nota**: La referencia sede.png tiene una escala tipográfica para hero/landing (título grande ~40px) que la spec descarta explícitamente para el runtime general. La escala elegida es correcta para el caso de uso de "aplicación de gestión".

### Densidad de controles
**Coherencia**: El padding uniforme (`px-3 py-2` para inputs, `px-3.5 py-2` para botones) produce controles de altura ~34px, coherente con la altura visual que muestra sede.png para inputs y botones del formulario. La inversión anterior (más alto en móvil que en desktop) queda eliminada.

### Estados interactivos
**Coherencia**: La adición de `transition-colors` en todos los elementos interactivos (tabs, links, file-manager row actions, accordion header) unifica el comportamiento visual con los botones, que ya lo tenían. No hay elementos interactivos sin transición de color.

### `rounded-card`
El token `--radius-card: 0.75rem` estaba previamente sin declarar (Tailwind v4 ignoraba la clase silenciosamente, dejando border-radius=0 en imagen, tabla y modal). Ahora produce radios de 12px en esos elementos, coherente con las esquinas medias que muestra sede.png en tarjetas internas.

### Sin regresiones funcionales detectadas
- Tests de comportamiento: 2304 pasan.
- Contratos JSON y props Zod: sin cambios.
- Navegación, estado de formularios, queries y acciones: sin cambios.
- Todos los `data-layout-node`, `aria-*` y atributos funcionales: sin cambios.

## Veredictos por criterio de aceptación

| # | Criterio | Estado |
|---|----------|--------|
| 1 | No quedan clases de color crudas en `src/runtime/` | Satisfecho (grep: 0 coincidencias) |
| 2 | Seis roles semánticos en `@theme` como utilidades de Tailwind | Satisfecho (60 tokens declarados) |
| 3 | Tokens app-level coherentes con paleta semántica | Satisfecho (anclan via `var()`) |
| 4 | Heading máximo `text-xl` en breakpoint grande | Satisfecho (h1: `text-lg sm:text-xl`) |
| 5 | Labels y botones secundarios con `font-medium` | Satisfecho |
| 6 | Padding uniforme sin inversión móvil/desktop | Satisfecho |
| 7 | Todos los elementos interactivos con `transition-colors` | Satisfecho |
| 8 | Nodos con estilos inline migrados a `runtime-node-styling.ts` | Satisfecho (accordion, tabs, link, stat, badge, alert, skeleton, input icon, file-manager) |
| 9 | `--radius-card` declarado y `rounded-card` funcional | Satisfecho |
| 10 | Coherencia visual con sede.png | Satisfecho (ver análisis comparativo arriba) |
| 11 | Todos los tests existentes pasan | Satisfecho (2304/2304, 92.13% coverage) |
