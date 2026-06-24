# 0081 — Tareas

Contrato de ejecución para `design-tokens-normalization`. Cada tarea debe ejecutarse en orden salvo que se indique
explícitamente que es independiente. Los IDs son estables; no renombrarlos al cerrar.

Referencias de diseño usadas a lo largo del plan:
- `design.md` D1-D2: paleta semántica completa y valores hex.
- `design.md` D3: anclaje de tokens app-level.
- `design.md` D4: token `--radius-card`.
- `design.md` D5: escala tipográfica de headings.
- `design.md` D6: matriz de pesos tipográficos.
- `design.md` D7: padding uniforme de controles.
- `design.md` D8: `transition-colors` unificado.
- `design.md` D9: esquema de funciones centralizadas por nodo.
- `design.md` D10: mapeo color crudo → token semántico.
- `design.md` D11: ámbito de cambio restringido a `src/runtime/`.

Convenciones de la sección `tests` por tarea:
- ficheros de test indicados como `(nuevo)` o `(ampliación)`.
- los comandos asumen ejecución desde la raíz del repo.
- las reglas universales de testing y el umbral del 80% global viven en `ai-workflow/standards/testing-rules.md` y no se
  repiten por tarea.

---

## T1 — Declarar paleta semántica y `--radius-card` en `@theme`

- estado: completado
- objetivo: añadir a `src/app/index.css` los seis roles semánticos (`neutral`, `primary`, `success`, `warning`,
  `danger`, `info`) con los diez pasos `50, 100, 200, 300, 400, 500, 600, 700, 800, 900` usando los valores hex de
  `design.md` D2, y declarar `--radius-card: 0.75rem` en el mismo bloque `@theme`. No tocar todavía los valores de los
  tokens app-level existentes ni ningún consumidor JSX/TS.
- fuera de alcance: cualquier consumo nuevo de las utilidades semánticas; modificación de tokens app-level; cambios en
  `runtime-node-styling.ts`; cambios en nodos.
- dependencias: ninguna.
- impacto esperado en archivos:
  - código: `src/app/index.css` (añadir 60 declaraciones `--color-<rol>-<step>` y la línea `--radius-card`).
  - tests: `src/tests/runtime/runtime-node-styling.test.ts` no se toca todavía (no hay consumidores nuevos en esta
    tarea).
  - documentación: ninguno.
- tests:
  - ficheros de test: ninguno; cubierto por: T3 en adelante, donde las funciones de `runtime-node-styling.ts` empiezan a
    devolver clases con los nuevos tokens y los tests de styling verifican el `className` resultante. El token
    `--radius-card` se verifica indirectamente cuando los tests de image/table/modal pasan con la clase `rounded-card`
    sin cambios.
  - comportamiento cubierto: declaración pura de tokens, sin consumidor; la suite completa (`pnpm test`) debe seguir
    pasando porque ningún `className` cambia.
  - comandos durante la implementación: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx`.
  - restricciones: no introducir comentarios CSS que documenten roles; los tokens deben ser autoexplicativos por nombre.
- documentación afectada: ninguno en esta tarea (las fichas se revisan en `update-app-documentation` tras T14).
- criterios de finalización:
  - `src/app/index.css` contiene las 60 nuevas variables `--color-<rol>-<step>` con los valores hex de la tabla D2 y la
    variable `--radius-card: 0.75rem`.
  - `pnpm test` sigue verde y la cobertura no baja del 80% global.
- cierre de implementación: los tokens están declarados, no hay consumidores nuevos, y `pnpm test` global pasa sin
  cambios funcionales observables.

---

## T2 — Anclar tokens app-level a la paleta semántica

- estado: completado
- objetivo: reescribir los valores de los tokens `--color-app-*` existentes en `@theme` para que apunten a la paleta
  semántica declarada en T1, siguiendo literalmente la tabla de D3 (`app-background → neutral-50`,
  `app-surface → #ffffff`, `app-surface-subtle → neutral-100`, `app-border-soft → neutral-200`,
  `app-border-strong → neutral-300`, `app-text → neutral-700`, `app-text-strong → neutral-900`,
  `app-text-muted → neutral-500`, `app-accent → primary-600`, `app-accent-strong → primary-700`,
  `app-danger → danger-600`). Eliminar las líneas comentadas obsoletas que conviven en el bloque actual.
- fuera de alcance: cualquier cambio en consumidores; cambios en los tokens semánticos; cambios en radios, sombras o
  tipografía.
- dependencias: T1.
- impacto esperado en archivos:
  - código: `src/app/index.css` (sustituir los valores hex de los `--color-app-*` por `var(--color-<rol>-<step>)` y
    eliminar las líneas comentadas duplicadas).
  - tests: no requiere cambios (los tests asertan nombres de clase `app-*`, no resoluciones de color).
  - documentación: ninguno.
- tests:
  - ficheros de test: ninguno; cubierto por: la suite existente que asierta `className` con tokens `app-*` debe seguir
    pasando sin cambios.
  - comportamiento cubierto: cambio de identidad cromática del accent (verde lima → azul institucional) sin alteración
    de contratos de className. Las funciones que devuelven `bg-app-surface`, `text-app-text-strong`, etc., conservan su
    salida exacta.
  - comandos durante la implementación: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`,
    `pnpm test --run src/tests/app/app-shell.test.tsx`.
  - restricciones: el valor de `app-surface` queda en `#ffffff` literal, no en `var(...)`, porque el diseño así lo
    establece y porque ningún paso de la rampa neutral cubre blanco puro.
- documentación afectada: ninguno en esta tarea.
- criterios de finalización:
  - `src/app/index.css` no contiene valores hex en los tokens `--color-app-*` salvo `app-surface: #ffffff`; el resto
    referencia variables de la paleta semántica.
  - No quedan líneas comentadas dentro del bloque `@theme`.
  - `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: los tokens app-level pasan a ser alias de la paleta semántica y la app renderizada muestra
  el accent azul (cambio visual esperado y aceptado por la spec).

---

## T3 — Migrar maps de variantes de botón a paleta semántica

- estado: completado
- objetivo: reemplazar los cuatro maps de variantes de botón (`buttonSolidVariantClassMap`,
  `buttonOutlineVariantClassMap`, `buttonGhostVariantClassMap`, `buttonLinkVariantClassMap`) en
  `src/runtime/runtime-node-styling.ts` aplicando el mapeo `blue-* → primary-*`, `red-* → danger-*`,
  `green-* → success-*`, `yellow-* → warning-*`, `cyan-* → info-*`, `gray-* → neutral-*` de D10. Mantener intactas el
  resto de utilidades de los maps (`bg-transparent`, `hover:underline`, etc.). No tocar `getButtonVariantClassName` ni
  sus clases base en esta tarea.
- fuera de alcance: cambios de padding, peso tipográfico o tamaño de los botones (van en T4); cambios en otros nodos.
- dependencias: T1, T2.
- impacto esperado en archivos:
  - código: `src/runtime/runtime-node-styling.ts` (cuatro objetos `buttonXxxVariantClassMap`).
  - tests: `src/tests/runtime/runtime-node-styling.test.ts` (ampliación), `src/tests/layout-renderer/layout-renderer-button-styles.test.tsx`
    (ampliación) — actualizar aserciones de className que comprueben substrings de color crudo.
  - documentación: ninguno.
- tests:
  - ficheros de test:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-button-styles.test.tsx` (ampliación)
  - comportamiento cubierto:
    - `getButtonVariantClassName('primary', 'solid', false)` incluye `bg-primary-600`, `border-primary-600`,
      `hover:bg-primary-700`, `hover:border-primary-700` y NO incluye ninguna clase `blue-*`.
    - `getButtonVariantClassName('danger', 'outline', true)` incluye `border-danger-500`, `text-danger-600`,
      `hover:bg-danger-50` y NO incluye ninguna clase `red-*`.
    - `getButtonVariantClassName('warning', 'ghost', false)` incluye `text-warning-600`, `hover:bg-warning-100` y NO
      incluye `yellow-*`.
    - `getButtonVariantClassName('info', 'link', false)` incluye `text-info-600`, `hover:underline` y NO incluye
      `cyan-*`.
    - cobertura equivalente para los seis roles en al menos una variante por test; aserciones explícitas de
      "no incluye `gray-*`" sobre la variante `neutral`.
    - los tests del renderer en `layout-renderer-button-styles.test.tsx` que aserten variantes concretas pasan a usar
      los nuevos tokens semánticos.
  - comandos durante la implementación: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-button-styles.test.tsx`.
  - restricciones: mantener el mismo esquema de `bg-transparent`/`hover:bg-{role}-50` que en outline; no cambiar la
    ergonomía de `getButtonVariantClassName`.
- documentación afectada: `ai-workflow/docs/app-features/nodes/button.md` (referencia a colores semánticos).
- criterios de finalización:
  - los cuatro maps de variantes consumen exclusivamente tokens semánticos.
  - ninguna línea de `runtime-node-styling.ts` contiene `blue-`, `red-`, `green-`, `yellow-`, `cyan-` o `gray-`.
  - los tests ampliados pasan; `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: los botones del runtime se renderizan con los nuevos tokens y la verificación con
  `pnpm test --run src/tests/layout-renderer/layout-renderer-button-styles.test.tsx` está en verde.

---

## T4 — Reescala tipográfica, pesos y padding de controles en `runtime-node-styling.ts`

- estado: completado
- objetivo: aplicar las decisiones D5, D6 y D7 sobre `src/runtime/runtime-node-styling.ts` sin tocar nodos externos.
  Concretamente:
  - sustituir el contenido de `headingSizeClassMap` por la escala de D5
    (`h1: 'text-lg sm:text-xl'`, `h2: 'text-base sm:text-lg'`, `h3-4: 'text-sm sm:text-base'`,
    `h5-6: 'text-xs sm:text-sm'`).
  - modificar `getHeadingNodeClassName` para que el peso sea `font-semibold` solo en niveles 1 y 2 y `font-medium` en
    niveles 3-6 (matriz D6).
  - modificar `getFieldLabelClassName` para usar `font-medium`.
  - modificar `getTableFilterResetButtonClassName` para usar `font-medium`.
  - modificar la base de `getButtonVariantClassName` para que `font-semibold` sea aplicable solo cuando `variant ===
    'solid'`; para `outline`, `ghost`, `link` aplicar `font-medium`. Mantener `font-semibold` en
    `getPrimaryButtonNodeClassName` y `getSecondaryButtonNodeClassName` (siguen siendo CTA en su semántica D6).
  - eliminar la inversión móvil/desktop de padding en: `getFieldControlClassName`, `getTableFilterInputClassName`,
    `getPrimaryButtonNodeClassName`, `getSecondaryButtonNodeClassName`, `getTableFilterResetButtonClassName`,
    `getButtonVariantClassName`, `getRepeaterPaginationButtonClassName`. Aplicar D7:
    - inputs: `px-3 py-2` único.
    - botones primarios/secundarios y reset de filtro y base de variant: `px-3.5 py-2` único.
    - paginación: `px-3 py-1.5` único.
  - asegurar que cada función para elemento interactivo conserva o añade `transition-colors` (D8); en esta tarea solo
    afecta a las funciones de `runtime-node-styling.ts`.
- fuera de alcance: cambios en colores (cubierto por T3); migración de estilos inline en nodos (T5-T13); ajustes a
  paginación de tabla (`getTablePaginationButtonClassName` ya delega en `getRepeaterPaginationButtonClassName`).
- dependencias: T1, T2, T3.
- impacto esperado en archivos:
  - código: `src/runtime/runtime-node-styling.ts` (constantes y varias funciones; sin cambios de firma).
  - tests: `src/tests/runtime/runtime-node-styling.test.ts` (ampliación), `src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx`
    (ampliación si los headings tienen aserciones de className), `src/tests/layout-renderer/layout-renderer-forms.test.tsx`
    (ampliación si hay aserciones de padding/label-weight), `src/tests/layout-renderer/layout-renderer-button-styles.test.tsx`
    (ampliación si aserta padding o weight).
  - documentación: ninguno.
- tests:
  - ficheros de test:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx` (ampliación si aplica)
    - `src/tests/layout-renderer/layout-renderer-forms.test.tsx` (ampliación si aplica)
    - `src/tests/layout-renderer/layout-renderer-button-styles.test.tsx` (ampliación si aplica)
  - comportamiento cubierto:
    - `getHeadingNodeClassName(1)` retorna substring `text-lg sm:text-xl` y `font-semibold`.
    - `getHeadingNodeClassName(2)` retorna `text-base sm:text-lg` y `font-semibold`.
    - `getHeadingNodeClassName(3)` y `(4)` retornan `text-sm sm:text-base` y `font-medium`.
    - `getHeadingNodeClassName(5)` y `(6)` retornan `text-xs sm:text-sm` y `font-medium`.
    - `getFieldLabelClassName()` incluye `font-medium` y no `font-semibold`.
    - `getFieldControlClassName(false)` incluye `px-3 py-2` y no incluye `sm:px-3.5` ni `py-3`.
    - `getPrimaryButtonNodeClassName()` y `getSecondaryButtonNodeClassName()` incluyen `px-3.5 py-2` y no incluyen
      `sm:px-3.5` ni `py-3`.
    - `getRepeaterPaginationButtonClassName()` incluye `px-3 py-1.5`.
    - `getButtonVariantClassName('primary', 'solid', false)` mantiene `font-semibold`; con `'ghost'` o `'outline'` o
      `'link'` retorna `font-medium`.
    - `getTableFilterInputClassName()` incluye `px-3 py-2` único.
    - `getTableFilterResetButtonClassName()` incluye `font-medium`.
  - comandos durante la implementación: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-forms.test.tsx`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-button-styles.test.tsx`.
  - restricciones: cualquier aserción del test existente que comprobaba la antigua inversión de padding
    (`px-4 py-3 sm:px-3.5 sm:py-2.5`) debe reescribirse a los nuevos valores; no añadir tests que comprueben tamaño en
    píxeles porque eso no es contrato del runtime.
- documentación afectada: `ai-workflow/docs/app-features/nodes/heading-paragraph-list.md`, `ai-workflow/docs/app-features/nodes/button.md`,
  `ai-workflow/docs/app-features/nodes/input.md`, `ai-workflow/docs/app-features/nodes/textarea.md`,
  `ai-workflow/docs/app-features/nodes/select.md`, `ai-workflow/docs/app-features/forms/`, `ai-workflow/docs/conventions.md`
  (peso tipográfico y padding orientativo).
- criterios de finalización:
  - los headings, labels, controles y botones devuelven los className previstos.
  - `runtime-node-styling.ts` no contiene la cadena `sm:px-3.5 sm:py-2.5` (la inversión queda eliminada).
  - los tests ampliados pasan; `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: las tres dimensiones (tipografía, peso, padding) están alineadas con D5/D6/D7 en la capa
  centralizada; los nodos externos aún pueden tener sus propias inversiones (se eliminan en T5-T13).

---

## T5 — Migrar `accordion-layout-node.tsx` a funciones centralizadas

- estado: completado
- objetivo: extraer las clases hoy inline en `src/runtime/nodes/accordion-layout-node.tsx` a cuatro funciones nuevas en
  `src/runtime/runtime-node-styling.ts`, siguiendo D9:
  - `getAccordionHeaderClassName()`: wrapper del `<button>` del header. Sustituye `bg-app-accent/10` por `bg-primary-50`,
    `hover:bg-app-accent/20` por `hover:bg-primary-100`, mantiene `focus-visible:ring-app-accent` reemplazándolo por
    `focus-visible:ring-primary-600`, añade `transition-colors` y aplica `font-medium` (D6).
  - `getAccordionChevronClassName(isOpen: boolean)`: clases del chevron incluyendo `text-primary-600` en lugar de
    `text-app-accent`, manteniendo la transición de transform existente y el sufijo `rotate-180` condicional.
  - `getAccordionBodyClassName()`: contenedor interno con `px-4 py-2 flex flex-col gap-5`.
  - `getAccordionBodyAnimationClassName(isOpen: boolean)`: alterna `animate-accordion-open` y `animate-accordion-close`.
  - sustituir las clases inline del `.tsx` por llamadas a esas funciones.
- fuera de alcance: cualquier cambio funcional en el comportamiento abrir/cerrar, focus management o ARIA; cambios de
  animación; cambios en otros nodos.
- dependencias: T3, T4.
- impacto esperado en archivos:
  - código: `src/runtime/nodes/accordion-layout-node.tsx`, `src/runtime/runtime-node-styling.ts` (cuatro funciones
    nuevas, exportadas).
  - tests: `src/tests/runtime/runtime-node-styling.test.ts` (ampliación),
    `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación) — actualizar la aserción de
    `bg-app-accent/10` y `hover:bg-app-accent/20` y `focus-visible:ring-app-accent` a los nuevos tokens.
  - documentación: ninguno.
- tests:
  - ficheros de test:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación)
  - comportamiento cubierto:
    - `getAccordionHeaderClassName()` contiene `bg-primary-50`, `hover:bg-primary-100`, `focus-visible:ring-primary-600`,
      `transition-colors` y `font-medium`, y no contiene `bg-app-accent/10` ni `hover:bg-app-accent/20`.
    - `getAccordionChevronClassName(true)` incluye `rotate-180` y `text-primary-600`; `(false)` no incluye
      `rotate-180` pero sí `text-primary-600`.
    - `getAccordionBodyClassName()` incluye `flex flex-col gap-5 px-4 py-2`.
    - `getAccordionBodyAnimationClassName(true)` → `animate-accordion-open`; `(false)` → `animate-accordion-close`.
    - el nodo renderizado mantiene `data-accordion-header` y `aria-*` actuales (sin regresión).
  - comandos durante la implementación: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-accordion.test.tsx`.
  - restricciones: mantener el `data-layout-node="accordion"` y resto de atributos data-* sin cambios.
- documentación afectada: `ai-workflow/docs/app-features/nodes/accordion.md`.
- criterios de finalización:
  - `accordion-layout-node.tsx` no contiene literales de className más allá de los obligatorios para
    `data-layout-node`/`role`/`aria-*`.
  - los tests ampliados pasan; `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: el accordion sigue funcionando idéntico al usuario y todas sus clases se resuelven desde
  `runtime-node-styling.ts`.

---

## T6 — Migrar `tabs-layout-node.tsx` a funciones centralizadas

- estado: completado
- objetivo: extraer las clases inline de `src/runtime/nodes/tabs-layout-node.tsx` a funciones centralizadas en
  `src/runtime/runtime-node-styling.ts`, siguiendo D9:
  - `getTabsRootClassName(orientation: 'horizontal' | 'vertical')`: layout flex.
  - `getTabsBarClassName(orientation)`: bar (mantiene comportamiento actual de `flex flex-col w-48 shrink-0` en vertical
    y `flex flex-row overflow-x-auto` en horizontal).
  - `getTabsButtonClassName(isActive: boolean, orientation)`: cubre los dos casos del ternario actual con D6
    (`font-semibold` en active, `font-medium` en inactive) y D7 (`px-3 py-1.5`), D8 (`transition-colors`) y el mapeo
    D10:
    - active: `border-b-2 border-primary-600 text-primary-700 font-semibold ...`.
    - inactive: `text-app-text-muted hover:text-app-text-strong font-medium ...`.
    - cada variante incluye la rama `text-left whitespace-normal break-words` (vertical) o
      `shrink-0 whitespace-nowrap` (horizontal).
  - `getTabsPanelClassName()`: `flex-1`.
  - sustituir el JSX para consumir esas funciones.
- fuera de alcance: cambios funcionales de navegación de tab, ARIA, teclado o lógica de selección; cambios en otros
  nodos; cambios en formularios con tabs (la integración interna del form-tabs se mantiene).
- dependencias: T3, T4.
- impacto esperado en archivos:
  - código: `src/runtime/nodes/tabs-layout-node.tsx`, `src/runtime/runtime-node-styling.ts`.
  - tests: `src/tests/runtime/runtime-node-styling.test.ts` (ampliación),
    `src/tests/layout-renderer/layout-renderer-tabs.test.tsx` (ampliación si tiene aserciones de className activo).
  - documentación: ninguno.
- tests:
  - ficheros de test:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-tabs.test.tsx` (ampliación)
  - comportamiento cubierto:
    - `getTabsButtonClassName(true, 'horizontal')` incluye `border-primary-600`, `text-primary-700`, `font-semibold`,
      `transition-colors`, `px-3`, `py-1.5`, `shrink-0` y `whitespace-nowrap`.
    - `getTabsButtonClassName(false, 'vertical')` incluye `text-app-text-muted`, `hover:text-app-text-strong`,
      `font-medium`, `transition-colors`, `text-left`, `whitespace-normal`, `break-words`.
    - `getTabsRootClassName('horizontal')` y `('vertical')` exponen layouts opuestos correctos.
    - `getTabsBarClassName('vertical')` incluye `w-48 shrink-0`.
    - el render del nodo mantiene el `data-layout-node="tabs"` y los `data-layout-node="tabs-panel"` por panel.
  - comandos durante la implementación: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-tabs.test.tsx`,
    `pnpm test --run src/tests/runtime/runtime-form-tabs.test.tsx`.
  - restricciones: no cambiar el atributo `role` ni el manejo de teclado.
- documentación afectada: `ai-workflow/docs/app-features/nodes/tabs.md`.
- criterios de finalización:
  - `tabs-layout-node.tsx` no contiene clases Tailwind inline para color, peso ni padding (solo composición JSX
    estructural).
  - los tests ampliados pasan; `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: las tabs adoptan tokens semánticos y `transition-colors` sin cambio funcional perceptible.

---

## T7 — Migrar `link-layout-node.tsx` a función centralizada

- estado: completado
- objetivo: añadir `getLinkNodeClassName()` en `runtime-node-styling.ts` con
  `inline-flex items-center text-primary-600 underline hover:text-primary-800 transition-colors font-medium` (D6, D8,
  D10) y reemplazar el `className="text-blue-600 underline hover:text-blue-800"` actual en
  `src/runtime/nodes/link-layout-node.tsx`.
- fuera de alcance: cambios en `href`, `download`, `target`, manejo de acción `navigateTo/goBack`, propagación de
  referencias o accesibilidad.
- dependencias: T3, T4.
- impacto esperado en archivos:
  - código: `src/runtime/nodes/link-layout-node.tsx`, `src/runtime/runtime-node-styling.ts`.
  - tests: `src/tests/runtime/runtime-node-styling.test.ts` (ampliación),
    `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` (ampliación si aserta `text-blue-600`).
  - documentación: ninguno.
- tests:
  - ficheros de test:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` (ampliación si aplica)
  - comportamiento cubierto:
    - `getLinkNodeClassName()` incluye `text-primary-600`, `hover:text-primary-800`, `underline`, `transition-colors`,
      `font-medium` y no incluye `text-blue-600` ni `hover:text-blue-800`.
    - el render del nodo `link` mantiene su href/aria y la nueva clase aplicada al `<a>`.
  - comandos durante la implementación: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx`.
  - restricciones: el `IconNode` interno conserva su className local (`size-4 shrink-0 inline-block align-middle mr-1`)
    porque no es color ni peso ni padding; queda fuera del scope de centralización.
- documentación afectada: `ai-workflow/docs/app-features/nodes/link.md`.
- criterios de finalización:
  - el `<a>` renderizado no contiene ninguna clase `blue-*`.
  - los tests ampliados pasan; `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: link aplica color primary, hover primary-800 y transición unificada.

---

## T8 — Migrar `stat-layout-node.tsx` a funciones centralizadas

- estado: completado
- objetivo: extraer los maps y clases inline de `src/runtime/nodes/stat-layout-node.tsx` a funciones centralizadas en
  `runtime-node-styling.ts` siguiendo D9 y aplicar el mapeo D10:
  - `getStatAccentRootClassName(color: ButtonColor)`: contenedor base `border-l-4 pl-4 py-2` + `border-{role}-500` o
    `border-neutral-400` para `neutral`.
  - `getStatAccentIconClassName(color)`: `size-8 shrink-0 text-{role}-500` (`neutral` → `text-neutral-400`).
  - `getStatAccentLabelClassName()`: `text-sm font-medium text-app-text-muted`.
  - `getStatAccentValueClassName()`: `text-2xl font-semibold text-app-text-strong` (peso D6 baja de `font-bold` a
    `font-semibold`).
  - `getStatTintedRootClassName(color)`: `rounded-lg p-4 bg-{role}-100` (`neutral` → `bg-neutral-100`).
  - `getStatTintedIconClassName(color)`: `size-8 shrink-0 text-{role}-600` (`neutral` → `text-neutral-600`).
  - `getStatTintedLabelClassName(color)`: `text-sm font-medium text-{role}-700` (cambio D10: 600 → 700 para AA).
  - `getStatTintedValueClassName(color)`: `text-2xl font-semibold text-{role}-800` (peso D6).
  - sustituir el JSX para consumir las funciones eliminando los maps locales (`borderClassMap`, `iconColorClassMap`,
    `tintedBgClassMap`) y sus variantes.
- fuera de alcance: cambios en props del nodo, validación Zod, repeater, item.* o interpolación.
- dependencias: T3, T4.
- impacto esperado en archivos:
  - código: `src/runtime/nodes/stat-layout-node.tsx`, `src/runtime/runtime-node-styling.ts`.
  - tests: `src/tests/runtime/runtime-node-styling.test.ts` (ampliación),
    `src/tests/layout-renderer/layout-renderer-stat.test.tsx` (ampliación) — actualizar todas las aserciones que
    comprueban substrings de color crudo a tokens semánticos.
  - documentación: ninguno.
- tests:
  - ficheros de test:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-stat.test.tsx` (ampliación)
  - comportamiento cubierto:
    - cada función `getStat*ClassName(color)` retorna las clases esperadas por la tabla D10 para los seis colores.
    - aserción explícita "no incluye `blue-*`/`green-*`/`red-*`/`yellow-*`/`cyan-*`/`gray-*`" en el render de cada
      variante.
    - variante accent default (`color === undefined`) usa `border-neutral-400`, label `text-app-text-muted` y value
      `text-app-text-strong`.
    - variante tinted con `color === 'success'` aplica `bg-success-100`, label `text-success-700`,
      value `text-success-800`.
  - comandos durante la implementación: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-stat.test.tsx`.
  - restricciones: mantener `data-layout-node="stat"` y la composición de label + value sin cambios estructurales.
- documentación afectada: `ai-workflow/docs/app-features/nodes/stat.md`.
- criterios de finalización:
  - `stat-layout-node.tsx` no contiene literales de color Tailwind crudos.
  - los tests ampliados pasan; `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: las dos variantes del stat consumen únicamente la paleta semántica.

---

## T9 — Migrar `badge-layout-node.tsx` a funciones centralizadas

- estado: completado
- objetivo: añadir a `runtime-node-styling.ts`:
  - `getBadgePillClassName(color)`: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-{role}-100 text-{role}-700`.
  - `getBadgeCircleDotClassName(color)`: `inline-block h-2 w-2 rounded-full bg-{role}-500` (todos a step 500, ver D10).
  - `getBadgeCircleLabelClassName()`: `text-sm`.
  - sustituir los maps locales (`pillClassMap`, `dotClassMap`) y las clases inline en
    `src/runtime/nodes/badge-layout-node.tsx`.
- fuera de alcance: cambios de variantes admitidas, validación Zod, integración repeater.
- dependencias: T3, T4.
- impacto esperado en archivos:
  - código: `src/runtime/nodes/badge-layout-node.tsx`, `src/runtime/runtime-node-styling.ts`.
  - tests: `src/tests/runtime/runtime-node-styling.test.ts` (ampliación),
    `src/tests/layout-renderer/layout-renderer-badge.test.tsx` (ampliación).
  - documentación: ninguno.
- tests:
  - ficheros de test:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-badge.test.tsx` (ampliación)
  - comportamiento cubierto:
    - cada función retorna las clases D10 esperadas para los seis colores.
    - pill `warning` consume `bg-warning-100 text-warning-700`.
    - circle dot `neutral` consume `bg-neutral-500` (cambio respecto al original `bg-gray-400`, alineado con D10).
    - aserción "no incluye `gray-*`/`blue-*`/...".
  - comandos durante la implementación: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-badge.test.tsx`.
- documentación afectada: `ai-workflow/docs/app-features/nodes/badge.md`.
- criterios de finalización:
  - `badge-layout-node.tsx` no contiene clases de color crudas.
  - los tests ampliados pasan; `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: badge consume paleta semántica en sus dos variantes.

---

## T10 — Migrar `alert-layout-node.tsx` a funciones centralizadas

- estado: completado
- objetivo: añadir a `runtime-node-styling.ts`:
  - `getAlertClassName(color)`: `flex items-start gap-3 rounded-md p-4 bg-{role}-100` (`neutral` → `bg-neutral-100`).
  - `getAlertTitleClassName(color)`: `text-{role}-700 font-medium` (D6).
  - `getAlertIconClassName(color)`: `text-{role}-700 size-5 shrink-0`.
  - `getAlertBodyClassName(color)`: `text-{role}-700 text-sm` (mensaje).
  - sustituir el objeto `alertColorClassMap` y las clases inline en `src/runtime/nodes/alert-layout-node.tsx`.
- fuera de alcance: cambios en el icono por tipo (mapping `alertTypeIconMap` se mantiene), en la prop `title` opcional o
  en la validación.
- dependencias: T3, T4.
- impacto esperado en archivos:
  - código: `src/runtime/nodes/alert-layout-node.tsx`, `src/runtime/runtime-node-styling.ts`.
  - tests: `src/tests/runtime/runtime-node-styling.test.ts` (ampliación),
    `src/tests/layout-renderer/layout-renderer-alert.test.tsx` (ampliación).
  - documentación: ninguno.
- tests:
  - ficheros de test:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-alert.test.tsx` (ampliación)
  - comportamiento cubierto:
    - `getAlertClassName('danger')` incluye `bg-danger-100`.
    - `getAlertTitleClassName('success')` incluye `text-success-700 font-medium`.
    - alert `info` consume `bg-info-100 text-info-700`.
    - aserción "no incluye `cyan-*`/`yellow-*`/...".
  - comandos durante la implementación: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-alert.test.tsx`.
- documentación afectada: `ai-workflow/docs/app-features/nodes/alert.md`.
- criterios de finalización:
  - `alert-layout-node.tsx` no contiene clases de color crudas.
  - los tests ampliados pasan; `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: alert consume paleta semántica en sus seis tipos.

---

## T11 — Migrar `skeleton-layout-node.tsx` a funciones centralizadas

- estado: completado
- objetivo: añadir a `runtime-node-styling.ts`:
  - `getSkeletonBaseClassName()`: `bg-neutral-200`.
  - `getSkeletonAnimateClassName(animate: boolean)`: `'animate-pulse'` cuando `animate === true`, `''` cuando no.
  - sustituir las tres composiciones de clases en `src/runtime/nodes/skeleton-layout-node.tsx` (líneas, círculo,
    rectángulo) para consumir las nuevas funciones en lugar de las cadenas literales `bg-gray-200`.
- fuera de alcance: cambios en `variant` o tamaño, en composición de líneas múltiples ni en el atributo
  `data-layout-node="skeleton"`.
- dependencias: T3, T4.
- impacto esperado en archivos:
  - código: `src/runtime/nodes/skeleton-layout-node.tsx`, `src/runtime/runtime-node-styling.ts`.
  - tests: `src/tests/runtime/runtime-node-styling.test.ts` (ampliación),
    `src/tests/layout-renderer/layout-renderer-skeleton.test.tsx` (ampliación) — actualizar aserciones de `bg-gray-200`
    a `bg-neutral-200`.
  - documentación: ninguno.
- tests:
  - ficheros de test:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-skeleton.test.tsx` (ampliación)
  - comportamiento cubierto:
    - `getSkeletonBaseClassName()` retorna exactamente `bg-neutral-200`.
    - cada variante del nodo (`text`, `circle`, `rect`) renderiza con `bg-neutral-200` y, cuando `animate === true`,
      con `animate-pulse`.
    - aserción "no incluye `gray-200`".
  - comandos durante la implementación: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-skeleton.test.tsx`.
- documentación afectada: `ai-workflow/docs/app-features/nodes/skeleton.md`.
- criterios de finalización:
  - `skeleton-layout-node.tsx` no contiene `bg-gray-200`.
  - los tests ampliados pasan; `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: skeleton placeholder consume el token neutro semántico.

---

## T12 — Migrar icon holder e icono del `input-layout-node.tsx` a funciones centralizadas

- estado: completado
- objetivo: añadir a `runtime-node-styling.ts`:
  - `getInputIconHolderClassName()`: `flex items-center justify-center px-3 bg-neutral-50 border-r border-app-border-soft shrink-0`.
  - `getInputIconClassName()`: `text-app-text-muted size-4 pointer-events-none`.
  - `getInputWithIconClassName()`: las clases del `<input>` interno cuando hay icono — `flex-1 min-w-0 bg-white px-3 py-2
    text-sm leading-5 text-app-text placeholder:text-app-text-muted focus-visible:outline-none` (aplica padding D7
    uniforme).
  - `getInputIconWrapperClassName(hasError)`: clases del span wrapper que actualmente se construyen como array
    `flex items-stretch w-full rounded-control border ...` con borde rojo o app cuando hasError.
  - sustituir los literales actuales en `src/runtime/nodes/input-layout-node.tsx`.
- fuera de alcance: cambios en la prop `icon`, en el handling de error, en el field wrapper general o en la composición
  con label.
- dependencias: T3, T4.
- impacto esperado en archivos:
  - código: `src/runtime/nodes/input-layout-node.tsx`, `src/runtime/runtime-node-styling.ts`.
  - tests: `src/tests/runtime/runtime-node-styling.test.ts` (ampliación),
    `src/tests/layout-renderer/layout-renderer-forms.test.tsx` (ampliación) — actualizar aserciones de `bg-gray-50` y
    `text-gray-400` a los tokens nuevos.
  - documentación: ninguno.
- tests:
  - ficheros de test:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-forms.test.tsx` (ampliación)
  - comportamiento cubierto:
    - `getInputIconHolderClassName()` incluye `bg-neutral-50`, `border-r`, `border-app-border-soft`.
    - `getInputIconClassName()` incluye `text-app-text-muted`.
    - el input con icono renderiza con padding uniforme `px-3 py-2`.
    - aserción "no incluye `bg-gray-50` ni `text-gray-400`".
  - comandos durante la implementación: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-forms.test.tsx`.
- documentación afectada: `ai-workflow/docs/app-features/nodes/input.md`.
- criterios de finalización:
  - `input-layout-node.tsx` no contiene literales de color crudos en holder ni icono.
  - los tests ampliados pasan; `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: input con icono adopta tokens semánticos en todas sus subpartes.

---

## T13 — Migrar `file-manager` a funciones centralizadas

- estado: completado
- objetivo: extraer todas las clases inline de `src/runtime/nodes/file-manager/*.tsx` a funciones centralizadas en
  `runtime-node-styling.ts` siguiendo D9 y aplicar el mapeo D10. Funciones a añadir:
  - row: `getFileManagerRowClassName()` (sustituye `border-gray-200` por `border-app-border-soft`),
    `getFileManagerRowFileNameClassName()` (`text-app-text`),
    `getFileManagerRowActionClassName(variant: 'primary' | 'danger' | 'disabled')` (mapea el actual
    `text-blue-600 hover:text-blue-800` a `text-primary-600 hover:text-primary-800`, el actual
    `text-red-500 hover:text-red-700` a `text-danger-600 hover:text-danger-700`, y el placeholder deshabilitado
    `text-gray-300` a `text-neutral-300`).
  - list/error: `getFileManagerListErrorClassName()` (`text-sm text-danger-600`),
    `getFileManagerListEmptyClassName()` (`text-sm text-app-text-muted`),
    `getFileManagerListDividerClassName()` (`divide-y divide-app-border-soft`),
    `getFileManagerErrorItemClassName()` (`text-sm text-danger-600`).
  - drop zone: `getFileManagerDropZoneClassName(phase: 'idle' | 'drag-over' | 'uploading' | 'success' | 'error')`
    con el mapeo D10 (idle → `border-neutral-300 bg-neutral-50 hover:bg-neutral-100`, drag-over →
    `border-primary-500 bg-primary-50`, uploading → `border-info-400 bg-info-50 cursor-not-allowed`, success →
    `border-success-500 bg-success-50`, error → `border-danger-400 bg-danger-50`).
  - drop zone textos/iconos: `getFileManagerDropZoneTextClassName(intent: 'muted' | 'info' | 'success')`,
    `getFileManagerDropZoneProgressTrackClassName()` (`w-full bg-info-200 rounded h-2`),
    `getFileManagerDropZoneProgressFillClassName()` (`bg-info-600 h-2 rounded transition-all`),
    `getFileManagerDropZoneIconColorClassName(intent: 'muted' | 'info' | 'success')`.
  - sustituir todos los className inline de los cinco subcomponentes
    (`file-manager-row.tsx`, `file-manager-list.tsx`, `file-manager-error-list.tsx`, `file-manager-drop-zone.tsx`) por
    llamadas a estas funciones. Añadir `transition-colors` a los botones de acción de fila (D8).
- fuera de alcance: cambios en la lógica de subida secuencial, validaciones client-side, paginación, hook
  `use-file-manager`, normalización de nombres o integración con queries; preservar todos los textos visibles tal cual.
- dependencias: T3, T4.
- impacto esperado en archivos:
  - código: `src/runtime/nodes/file-manager/file-manager-row.tsx`,
    `src/runtime/nodes/file-manager/file-manager-list.tsx`,
    `src/runtime/nodes/file-manager/file-manager-error-list.tsx`,
    `src/runtime/nodes/file-manager/file-manager-drop-zone.tsx`, `src/runtime/runtime-node-styling.ts`.
  - tests: `src/tests/runtime/runtime-node-styling.test.ts` (ampliación),
    `src/tests/layout-renderer/layout-renderer-file-manager.test.tsx` (ampliación si añade aserciones de className por
    fase), `src/tests/runtime/runtime-file-manager-hook.test.tsx` (ampliación si aplica).
  - documentación: ninguno.
- tests:
  - ficheros de test:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-file-manager.test.tsx` (ampliación)
  - comportamiento cubierto:
    - cada función `getFileManagerDropZoneClassName(phase)` retorna las clases esperadas por D10 para las cinco fases.
    - `getFileManagerRowActionClassName('primary')` incluye `text-primary-600 hover:text-primary-800`,
      `transition-colors`; `('danger')` incluye `text-danger-600 hover:text-danger-700`, `transition-colors`;
      `('disabled')` incluye `text-neutral-300` y atributo aria coherente.
    - `getFileManagerListErrorClassName()` incluye `text-danger-600`.
    - `getFileManagerDropZoneProgressFillClassName()` incluye `bg-info-600`.
    - aserción "no incluye `blue-*`/`red-*`/`green-*`/`gray-*`" en todas las funciones.
    - el render del nodo `fileManager` mantiene drag-over, uploading, success y error en sus fases observables sin
      regresión funcional (al menos un test smoke que dispara `dragenter` y comprueba la clase).
  - comandos durante la implementación: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-file-manager.test.tsx`,
    `pnpm test --run src/tests/runtime/runtime-file-manager-hook.test.tsx`.
  - restricciones: no añadir nuevos `data-*` ni renombrar los existentes; los textos visibles (Subiendo ficheros…,
    Límite alcanzado, etc.) se preservan al pie de la letra.
- documentación afectada: `ai-workflow/docs/app-features/nodes/file-manager.md`.
- criterios de finalización:
  - ningún fichero bajo `src/runtime/nodes/file-manager/` contiene clases Tailwind crudas de color (`blue-`, `red-`,
    `green-`, `yellow-`, `cyan-`, `gray-`).
  - los tests ampliados pasan; `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: el file-manager opera idéntico para el usuario, con paleta semántica y transiciones
  unificadas en todos sus subcomponentes.

---

## T14 — Verificación visual y registro en `notes.md`

- estado: completado
- objetivo: ejecutar la aplicación en modo desarrollo, comparar visualmente el resultado con
  `ai-workflow/design/sede.png` y registrar en `ai-workflow/features/0081-design-tokens-normalization/notes.md` los
  hallazgos comparativos (coherencia en tono, jerarquía tipográfica, densidad de controles; cualquier desviación
  observada). También ejecutar el grep de control para garantizar que no quedan colores crudos bajo `src/runtime/`
  (criterio de aceptación 1 de la spec). El alcance del grep queda explícitamente limitado a `src/runtime/` por D11.
- fuera de alcance: actualización de la documentación funcional (`ai-workflow/docs/`); cambios de código adicionales;
  ajustes de tokens.
- dependencias: T5-T13 (todos los nodos migrados).
- impacto esperado en archivos:
  - código: ninguno.
  - tests: ninguno (la suite ya pasó tarea a tarea).
  - documentación: `ai-workflow/features/0081-design-tokens-normalization/notes.md` (nuevo o ampliación), `status.yaml`
    (transición de fase a `documentation` al cerrar).
- tests:
  - ficheros de test: ninguno; cubierto por: la suite completa (`pnpm test`) acumulada de T1-T13.
  - comportamiento cubierto: nada nuevo; esta tarea es de verificación visual e higiene.
  - comandos durante la implementación: `pnpm test`, `grep -rE "(blue|red|green|yellow|cyan|gray)-[0-9]+" src/runtime/`
    (debe retornar 0 coincidencias) y `pnpm dev` para inspección manual.
  - restricciones: no introducir cambios de código en esta tarea; si la comparación visual descubre regresiones,
    abrirlas como nuevas iteraciones de las tareas afectadas (T3-T13), no parchear directamente.
- documentación afectada: `notes.md` de la feature (registro de hallazgos). Las fichas de
  `ai-workflow/docs/app-features/nodes/` y `conventions.md` se actualizan después en
  `update-app-documentation`, fuera de `tasks.md`.
- criterios de finalización:
  - `grep -rE "(blue|red|green|yellow|cyan|gray)-[0-9]+" src/runtime/` retorna 0 líneas.
  - `pnpm test` global verde y cobertura ≥ 80%.
  - `notes.md` registra la comparación con sede.png y deja constancia explícita de regresiones o de su ausencia.
- cierre de implementación: la feature está completamente implementada y verificada visualmente; `status.yaml` puede
  pasar a `phase: documentation`, `validation.tests_green: true`, `validation.coverage_gate_passed: true`,
  `feature_status: implemented`.

---

## Próxima tarea recomendada

T1 — Declarar paleta semántica y `--radius-card` en `@theme`.
