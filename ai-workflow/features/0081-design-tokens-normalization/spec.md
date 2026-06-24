# 0081 — Normalización de design tokens

## Objetivo

Centralizar todos los valores de diseño visual del runtime en tokens semánticos declarados en `@theme` de
`src/app/index.css`, eliminando los colores crudos de Tailwind dispersos por componentes y normalizando la escala
tipográfica, los pesos, el espaciado de controles y las transiciones para que la apariencia general sea coherente con la
referencia visual de sede electrónica (`ai-workflow/design/sede.png`).

## Alcance

### 1. Paleta de color semántica

- Declarar en `@theme` seis roles semánticos con variantes por intensidad: `neutral`, `primary`, `success`, `warning`,
  `danger`, `info`.
- Cada rol debe incluir las variantes que los componentes actuales necesitan (50, 100, 200, 400, 500, 600, 700, 800 como
  mínimo; el design decidirá el rango exacto).
- Los tokens app-level existentes (`app-background`, `app-surface`, `app-surface-subtle`, `app-text`, `app-text-strong`,
  `app-text-muted`, `app-accent`, `app-accent-strong`, `app-danger`, `app-border-soft`, `app-border-strong`) se
  mantienen como tokens de capa de aplicación, pero sus valores deben ser coherentes con la nueva paleta semántica (por
  ejemplo, `app-accent` debe apuntar al mismo valor que `primary-600` o similar).
- Todos los colores crudos de Tailwind (`blue-600`, `red-500`, `gray-100`, etc.) hardcodeados en componentes del runtime
  deben sustituirse por referencias a los tokens semánticos.
- Los valores concretos de la paleta deben derivarse de la imagen de referencia `sede.png`: azul institucional como
  primary, grises equilibrados como neutral, y colores funcionales (success, warning, danger, info) armónicos con ese
  tono base.

### 2. Escala tipográfica normalizada

- Reducir la escala de headings para que sea proporcional a una aplicación de gestión, no a una landing page.
- La referencia visual de sede.png muestra headings contenidos: el título principal equivale aproximadamente a
  `text-xl`/`text-2xl`, los subtítulos de sección a `text-base`/`text-lg`.
- Los tamaños actuales (`text-4xl` para h1, `text-3xl` para h2, etc.) deben reducirse en al menos un escalón completo,
  ajustándose al design.
- Body text y labels deben mantenerse compactos (`text-sm` como base general).

### 3. Pesos tipográficos equilibrados

- Reducir el uso excesivo de `font-semibold` (600) a los elementos que realmente lo justifican: headings principales y
  elementos de énfasis.
- Los labels de campo, botones secundarios, controles de paginación y cabeceras de tabla deben usar `font-medium` (500)
  salvo que el design establezca lo contrario.
- El criterio concreto de qué elementos usan cada peso se fija en el design.

### 4. Espaciado de controles compacto

- Unificar el padding de inputs y botones a valores más contenidos y consistentes, eliminando la inversión actual donde
  el padding es mayor en móvil que en desktop.
- La referencia visual de sede.png muestra controles compactos y limpios.
- El criterio concreto de padding se fija en el design.

### 5. Transiciones unificadas

- Todos los elementos interactivos del runtime deben incluir `transition-colors` para que los cambios de estado (hover,
  focus) sean visualmente fluidos.
- Los elementos que hoy carecen de transición (tabs, links, file-manager) deben alinearse con los que ya la tienen (
  botones).

### 6. Centralización de estilos inline dispersos

- Varios nodos tienen clases de estilo hardcodeadas directamente en el JSX en lugar de usar funciones centralizadas
  de `runtime-node-styling.ts`: `accordion-layout-node.tsx`, `tabs-layout-node.tsx`, `link-layout-node.tsx`,
  `stat-layout-node.tsx`, `file-manager/*.tsx`.
- Los estilos de estos nodos deben migrarse a funciones centralizadas en `runtime-node-styling.ts` para que los tokens
  semánticos se apliquen de forma uniforme y el mantenimiento futuro no dependa de buscar clases dispersas por
  componentes.
- Esta migración no cambia comportamiento ni contrato; solo mueve la declaración de clases al módulo central de styling.

### 7. Token `rounded-card` no declarado

- La clase `rounded-card` se usa en `getImageNodeClassName`, `getTableContainerClassName` y `getModalPanelClassName`,
  pero no existe un token `--radius-card` en `@theme`.
- Debe declararse `--radius-card` en `@theme` con un valor coherente con el resto de radii (`--radius-shell`,
  `--radius-section`, `--radius-form`, `--radius-control`).

## Fuera de alcance

- Cambios en el contrato JSON de configuración: ningún campo nuevo, ningún campo eliminado, ningún cambio en validación
  Zod de props.
- Cambios en lógica de runtime: navegación, estado de formularios, queries, acciones, visibilidad.
- Theming declarativo desde JSON (sigue fuera de v1).
- Cambios en la fuente tipográfica (Source Sans 3 se mantiene).
- Cambios en tokens de layout (radii, shadows, container widths) salvo que el design los ajuste como parte de la
  coherencia visual.
- Nuevos componentes o nodos.

## Requisitos funcionales

1. Todos los colores visibles del runtime deben resolverse desde tokens declarados en `@theme`, no desde clases de color
   crudas de Tailwind.
2. Los seis roles semánticos (`neutral`, `primary`, `success`, `warning`, `danger`, `info`) deben funcionar como
   utilidades estándar de Tailwind: `bg-primary-600`, `text-danger-100`, `border-success-500`, etc.
3. La escala de headings debe ser más compacta, proporcional al estilo de aplicación de gestión de sede.png.
4. Los pesos tipográficos deben diferenciarse entre elementos de énfasis (`font-semibold`) y elementos funcionales (
   `font-medium`).
5. El padding de controles debe ser uniforme y no invertir la relación móvil/desktop.
6. Todos los elementos interactivos deben tener transiciones de color suaves.
7. La apariencia general tras los cambios debe ser coherente con la referencia visual de sede.png en tono, densidad y
   jerarquía.

## Requisitos no funcionales

1. No debe haber regresión funcional: el comportamiento de todos los nodos, formularios, queries y acciones debe ser
   idéntico antes y después.
2. Los tests existentes de snapshot o className pueden necesitar actualización para reflejar los nuevos nombres de
   clase, pero no deben cambiar aserciones de comportamiento.
3. El rendimiento de render no debe verse afectado (los tokens CSS custom de Tailwind v4 se resuelven en build time sin
   coste runtime adicional).

## Criterios de aceptación

1. No queda ninguna clase de color cruda de Tailwind (`blue-*`, `red-*`, `green-*`, `yellow-*`, `gray-*`, `cyan-*`) en
   archivos bajo `src/runtime/`.
2. Todos los roles semánticos están declarados en `@theme` con sus variantes y son consumibles como utilidades de
   Tailwind.
3. Los tokens app-level (`app-accent`, `app-danger`, etc.) son coherentes con la paleta semántica (usan los mismos
   valores base).
4. La escala de headings no supera `text-2xl` para el nivel más alto (h1) en su breakpoint más grande, o el valor que el
   design fije.
5. Los labels de campo y botones secundarios usan `font-medium`, no `font-semibold`, o el peso que el design fije.
6. El padding de inputs y botones es uniforme entre móvil y desktop (sin inversión).
7. Todos los elementos interactivos (botones, tabs, links, file-manager actions) incluyen `transition-colors`.
8. Los nodos que hoy tienen estilos inline en JSX (accordion, tabs, link, stat, file-manager) usan funciones
   centralizadas de `runtime-node-styling.ts`.
9. El token `--radius-card` existe en `@theme` y `rounded-card` se resuelve correctamente en image, table y modal.
10. La aplicación renderizada con la config de desarrollo es visualmente coherente con sede.png en tono general,
   jerarquía tipográfica y densidad de controles.
11. Todos los tests existentes pasan (con actualizaciones de className donde aplique).

## Casos límite

1. **Skeleton**: usa `gray-200` como placeholder de carga. Debe mapearse a un token neutro apropiado (ej: `neutral-200`)
   que mantenga el contraste bajo necesario para un placeholder.
2. **File-manager drop zone**: usa colores variados por estado (`idle`, `drag-over`, `uploading`, `success`, `error`).
   Cada estado debe mapearse a tokens semánticos coherentes sin perder la diferenciación visual entre estados.
3. **Button link variant**: usa `border-transparent` y solo color de texto. El token de color debe aplicarse solo al
   texto sin introducir fondo ni borde visible.
4. **Stat variante tinted**: usa fondos suaves (`bg-blue-100`) y textos medios (`text-blue-600`). Necesita variantes de
   intensidad suficientes en cada rol para mantener esta diferenciación.
5. **Tokens app-level duplicados**: `app-accent` y `primary-600` podrían apuntar al mismo valor. El design debe decidir
   si se unifican o si `app-accent` sigue siendo un alias semántico independiente.
6. **Estilos inline en nodos**: accordion, tabs, link, stat y file-manager tienen estilos directamente en JSX. Al
   migrarlos a `runtime-node-styling.ts`, hay que verificar que no se pierdan clases condicionales (ej: tab
   active/inactive, stat accent/tinted, file-manager por fase DnD).
7. **`rounded-card` sin token**: actualmente Tailwind puede estar generando un valor por defecto o ignorando la clase.
   Al declarar `--radius-card` en `@theme`, verificar que el radio resultante es coherente con el existente en
   producción.

## Riesgos o preguntas abiertas

1. **Valores exactos de la paleta**: los valores concretos de cada token (hex/oklch) se fijarán en `design.md`. La spec
   no los compromete; solo fija la estructura y los roles.
2. **Escala tipográfica exacta**: los tamaños concretos por nivel de heading se fijarán en `design.md`.
3. **Cobertura de tests visuales**: no hay tests de snapshot visual actualmente; la verificación de coherencia con
   sede.png será manual.

## Áreas de producto afectadas

- Shell de aplicación (app-shell)
- Todos los nodos del catálogo que usan color semántico: button, badge, alert, stat, link, tabs, skeleton, file-manager
- Controles de formulario: input, textarea, select, radioGroup, checkboxGroup
- Controles de paginación: repeater, table
- Capa centralizada de styling: `runtime-node-styling`

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/` — fichas de nodos que referencien colores o styling concreto
- `ai-workflow/docs/conventions.md` — sección de estilos, si se añade convención sobre uso de tokens semánticos
- `ai-workflow/docs/current-state.md` — estado del área de theming
