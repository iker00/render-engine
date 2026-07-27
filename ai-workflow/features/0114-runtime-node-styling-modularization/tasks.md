# Tasks — 0114 — Runtime node styling modularization

Contrato de ejecución. Ordenado por dependencia. La siguiente tarea que debe abordarse siempre es la primera cuyo
estado no sea `done`.

## Referencia común para toda la feature

- Feature puramente mecánica: cero cambio de comportamiento, cero cambio de clases Tailwind devueltas, cero cambio de
  firma de función. Ningún import de los 32 ficheros consumidores (`src/app/app-shell.tsx`, `src/dev-runtime/dev-runtime.tsx`,
  `src/runtime/layout-node-renderer.tsx`, `src/runtime/runtime-page.tsx` y 28 componentes bajo `src/runtime/nodes/`)
  cambia en ninguna tarea de este plan.
- `src/runtime/runtime-node-styling.ts` (el barrel) es la única ruta pública. Todas las tareas 1-17 mueven código
  hacia módulos internos nuevos y dejan en el barrel una línea `export { ... } from './runtime-node-styling-<dominio>'`
  (o `export type { ... } from ...` para el tipo) por cada nombre movido, en sustitución de su implementación.
- **Regla transversal de imports internos**: ningún módulo interno nuevo (`src/runtime/runtime-node-styling-*.ts`)
  importa nunca desde el barrel `src/runtime/runtime-node-styling.ts`. Cuando un dominio depende de otro (p. ej. tabla
  reutilizando paginación de repeater), importa directamente el fichero del módulo interno correspondiente (p. ej.
  `./runtime-node-styling-repeater-pagination`), nunca vía el barrel. Esto evita por diseño cualquier ciclo de import
  entre el barrel y sus propios módulos constituyentes.
- Ningún módulo interno importa (directa o transitivamente) desde un módulo que a su vez dependa de él. El único grafo
  de dependencia entre módulos de dominio de este plan es: `base` ← `container`, `base` ← `repeater-pagination`,
  `repeater-pagination` ← `table`. El resto de módulos no tiene dependencias internas entre sí.
- Ninguna tarea de este plan reorganiza `src/tests/runtime/runtime-node-styling.test.ts` (1.798 líneas): sigue siendo
  un único fichero, con el mismo import desde `'../../runtime/runtime-node-styling'`, sin nuevas aserciones. Es la
  cobertura de regresión de las 18 tareas.
- Todas las funciones y el tipo movidos deben conservar exactamente el mismo nombre exportado, la misma firma y el
  mismo cuerpo (copia literal, sin reescritura). Las constantes y tipos privados (`Record<...>` de clases, interfaces
  de opciones) que solo use un dominio viajan con las funciones de ese dominio y dejan de ser accesibles desde el
  barrel (correcto: nunca lo fueron, no estaban en el `export` original).

### Mapa de módulos (autoridad de asignación función → fichero)

| Módulo nuevo | Símbolos públicos que re-exporta el barrel | Dependencia interna |
|---|---|---|
| `runtime-node-styling-base.ts` | `EffectiveResponsiveLayoutValue` (type), `normalizeResponsiveLayoutValue`, `getGridChildSpanClassName` | ninguna |
| `runtime-node-styling-app-shell.ts` | `getAppShellClassName`, `getAppShellContentClassName`, `getAppShellFrameClassName`, `getAppShellErrorEyebrowClassName`, `getAppShellErrorTitleClassName`, `getAppShellErrorBodyClassName`, `getRuntimePageClassName` | ninguna |
| `runtime-node-styling-content.ts` | `getHeadingTag`, `getHeadingNodeClassName`, `getParagraphNodeClassName`, `getListNodeClassName`, `getListItemClassName`, `getImageNodeClassName`, `getLinkNodeClassName` | ninguna |
| `runtime-node-styling-form-fields.ts` | `getFormNodeClassName`, `getFieldWrapperClassName`, `getFieldLabelClassName`, `getFieldControlClassName`, `getFieldErrorClassName`, `getChoiceGroupClassName`, `getChoiceOptionClassName` | ninguna |
| `runtime-node-styling-modal.ts` | `getModalOverlayClassName`, `getModalPanelClassName` | ninguna |
| `runtime-node-styling-accordion.ts` | `getAccordionHeaderClassName`, `getAccordionChevronClassName`, `getAccordionBodyClassName`, `getAccordionBodyAnimationClassName` | ninguna |
| `runtime-node-styling-tabs.ts` | `getTabsRootClassName`, `getTabsBarClassName`, `getTabsButtonClassName`, `getTabsPanelClassName` | ninguna |
| `runtime-node-styling-stat.ts` | `getStatAccentRootClassName`, `getStatAccentIconClassName`, `getStatAccentLabelClassName`, `getStatAccentValueClassName`, `getStatTintedRootClassName`, `getStatTintedIconClassName`, `getStatTintedLabelClassName`, `getStatTintedValueClassName`, `getStatPlainRootClassName`, `getStatPlainIconClassName`, `getStatPlainLabelClassName`, `getStatPlainValueClassName` | ninguna |
| `runtime-node-styling-badge.ts` | `getBadgePillClassName`, `getBadgeCircleDotClassName`, `getBadgeCircleLabelClassName` | ninguna |
| `runtime-node-styling-alert.ts` | `getAlertClassName`, `getAlertTitleClassName`, `getAlertIconClassName`, `getAlertBodyClassName` | ninguna |
| `runtime-node-styling-skeleton.ts` | `getSkeletonBaseClassName`, `getSkeletonAnimateClassName` | ninguna |
| `runtime-node-styling-input-icon.ts` | `getInputIconHolderClassName`, `getInputIconClassName`, `getInputWithIconClassName`, `getInputIconWrapperClassName` | ninguna |
| `runtime-node-styling-file-manager.ts` | `getFileManagerRowClassName`, `getFileManagerRowFileNameClassName`, `getFileManagerRowActionClassName`, `getFileManagerListErrorClassName`, `getFileManagerListEmptyClassName`, `getFileManagerListDividerClassName`, `getFileManagerErrorItemClassName`, `getFileManagerDropZoneClassName`, `getFileManagerDropZoneTextClassName`, `getFileManagerDropZoneProgressTrackClassName`, `getFileManagerDropZoneProgressFillClassName`, `getFileManagerDropZoneIconColorClassName` | ninguna |
| `runtime-node-styling-button.ts` | `getButtonNodeClassName`, `getPrimaryButtonNodeClassName`, `getSecondaryButtonNodeClassName`, `getButtonVariantClassName` | ninguna (delegación interna a su propio módulo) |
| `runtime-node-styling-container.ts` | `getContainerNodeSurface`, `getContainerNodeStyling` | `base` (importa `responsiveBreakpoints`) |
| `runtime-node-styling-repeater-pagination.ts` | `getRepeaterPaginationControlsClassName`, `getRepeaterPaginationButtonClassName`, `getRepeaterPaginationCurrentButtonClassName` | `base` (importa `getGridChildSpanClassName`) |
| `runtime-node-styling-table.ts` | `getTableContainerClassName`, `getTableScrollContainerClassName`, `getTableNodeClassName`, `getTableHeaderCellClassName`, `getTableFilterControlsClassName`, `getTableFilterFieldClassName`, `getTableFilterLabelClassName`, `getTableFilterInputClassName`, `getTableFilterResetButtonClassName`, `getTableSortButtonClassName`, `getTableBodyRowClassName`, `getTableCellClassName`, `getTablePaginationControlsClassName`, `getTablePaginationButtonClassName`, `getTablePaginationCurrentButtonClassName` | `repeater-pagination` (importa `getRepeaterPaginationButtonClassName`/`getRepeaterPaginationCurrentButtonClassName`) |

Total: 94 funciones + 1 tipo = 95 símbolos públicos, idéntico al inventario actual (verificado por `grep -n "^export function\|^export type" src/runtime/runtime-node-styling.ts` antes de empezar).

---

## Task 1 — Módulo base: utilidades responsive compartidas

- **ID**: 0114-T1
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-base.ts` moviendo desde el barrel, copia literal sin
  reescritura:
  - privados: `responsiveBreakpoints` (array), `gridChildSpanClassMap`, `responsiveGridChildSpanClassMaps`
  - públicos: tipo `EffectiveResponsiveLayoutValue`, función `normalizeResponsiveLayoutValue`, función
    `getGridChildSpanClassName`
  - El módulo importa `RuntimeResponsiveBreakpoint` y `RuntimeResponsiveLayoutValue` desde `'../config/runtime-config'`.
  - `responsiveBreakpoints` debe declararse con `export const` en este módulo (aunque el barrel no lo reexporte: no
    formaba parte del API público original) para que Task 15 (`container`) pueda importarlo directamente sin
    duplicar el array, cumpliendo el requisito de la spec de no duplicar utilidades responsive compartidas.
  - Actualizar el barrel: eliminar las seis declaraciones de su cuerpo y añadir en su lugar
    `export type { EffectiveResponsiveLayoutValue } from './runtime-node-styling-base'` y
    `export { normalizeResponsiveLayoutValue, getGridChildSpanClassName } from './runtime-node-styling-base'`.
- **Fuera de alcance**: cualquier otro dominio (container, repeater-pagination, etc.) permanece en el barrel hasta su
  propia tarea. No tocar `containerColumnsClassMap`, `responsiveContainerColumnsClassMaps` ni ningún mapa de columnas
  de container (son específicos de container, no compartidos; van en Task 15).
- **Dependencias**: ninguna. Primera tarea del plan.
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-base.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente), que ya
    ejercita `normalizeResponsiveLayoutValue` y `getGridChildSpanClassName` (fijo y responsive, clamp contra el padre)
    a través del barrel.
  - **Comportamiento cubierto**:
    - `normalizeResponsiveLayoutValue` sigue devolviendo el mismo objeto `EffectiveResponsiveLayoutValue` para valores
      numéricos fijos y para mapas parciales por breakpoint con y sin `fallback`.
    - `getGridChildSpanClassName` sigue devolviendo `null` cuando falta `span` o `parentGridColumns`, y las mismas
      clases `col-span-*`/`{breakpoint}:col-span-*` con el mismo clamp para valores fijos y responsive.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente; no añadir casos nuevos.
- **Documentación afectada**: ninguna hasta Task 18 (la estructura pública sigue siendo la misma ruta de barrel).
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-base.ts` existe con los tres símbolos exportados listados; el
    barrel ya no contiene su implementación; `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts` pasa.

---

## Task 2 — Módulo app-shell

- **ID**: 0114-T2
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-app-shell.ts` moviendo, copia literal: `getAppShellClassName`,
  `getAppShellContentClassName`, `getAppShellFrameClassName`, `getAppShellErrorEyebrowClassName`,
  `getAppShellErrorTitleClassName`, `getAppShellErrorBodyClassName`, `getRuntimePageClassName`. Ninguna de estas
  funciones tiene parámetros ni depende de ningún tipo externo ni de otro módulo interno. Actualizar el barrel:
  eliminar su implementación y añadir `export { getAppShellClassName, getAppShellContentClassName,
  getAppShellFrameClassName, getAppShellErrorEyebrowClassName, getAppShellErrorTitleClassName,
  getAppShellErrorBodyClassName, getRuntimePageClassName } from './runtime-node-styling-app-shell'`.
- **Fuera de alcance**: cualquier otro dominio.
- **Dependencias**: ninguna (no depende de Task 1; se ejecuta en este orden por convención del plan).
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-app-shell.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente), que ya
    ejercita las siete clases del shell y de la página raíz.
  - **Comportamiento cubierto**:
    - Cada una de las siete funciones sigue devolviendo exactamente la misma cadena de clases Tailwind que antes de
      la extracción.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-app-shell.ts` existe con las siete funciones exportadas; el
    barrel ya no contiene su implementación; el test de regresión pasa.

---

## Task 3 — Módulo de contenido simple (heading/paragraph/list/image/link)

- **ID**: 0114-T3
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-content.ts` moviendo, copia literal: privado
  `headingSizeClassMap`; públicos `getHeadingTag`, `getHeadingNodeClassName`, `getParagraphNodeClassName`,
  `getListNodeClassName`, `getListItemClassName`, `getImageNodeClassName`, `getLinkNodeClassName`. Ninguna depende de
  otro módulo interno ni de tipos externos más allá de los parámetros primitivos ya usados hoy. Actualizar el barrel:
  eliminar su implementación y añadir `export { getHeadingTag, getHeadingNodeClassName, getParagraphNodeClassName,
  getListNodeClassName, getListItemClassName, getImageNodeClassName, getLinkNodeClassName } from
  './runtime-node-styling-content'`.
- **Fuera de alcance**: cualquier otro dominio, incluido `table` (aunque también sea "contenido", tabla tiene su
  propia tarea por volumen y por su dependencia de `repeater-pagination`).
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-content.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente), que ya
    ejercita `getHeadingTag` (niveles 1-6 y clamp fuera de rango), `getHeadingNodeClassName` (peso por nivel),
    `getParagraphNodeClassName`, `getListNodeClassName`, `getListItemClassName`, `getImageNodeClassName` y
    `getLinkNodeClassName`.
  - **Comportamiento cubierto**:
    - Las siete funciones siguen devolviendo exactamente las mismas clases/tag que antes de la extracción, incluido
      el fallback de `getHeadingNodeClassName` a `headingSizeClassMap[6]` para niveles fuera de `1..6`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-content.ts` existe con las siete funciones exportadas; el barrel
    ya no contiene su implementación; el test de regresión pasa.

---

## Task 4 — Módulo de campos de formulario

- **ID**: 0114-T4
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-form-fields.ts` moviendo, copia literal: `getFormNodeClassName`,
  `getFieldWrapperClassName`, `getFieldLabelClassName`, `getFieldControlClassName`, `getFieldErrorClassName`,
  `getChoiceGroupClassName`, `getChoiceOptionClassName`. El módulo importa `ChoiceGroupOptionLayout` desde
  `'../config/runtime-config'` (usado por `getChoiceGroupClassName`/`getChoiceOptionClassName`). Actualizar el
  barrel: eliminar su implementación y añadir `export { getFormNodeClassName, getFieldWrapperClassName,
  getFieldLabelClassName, getFieldControlClassName, getFieldErrorClassName, getChoiceGroupClassName,
  getChoiceOptionClassName } from './runtime-node-styling-form-fields'`.
- **Fuera de alcance**: cualquier otro dominio, incluidos `input-icon` (Task 12) y `file-manager` (Task 13), que
  también son campos de formulario pero tienen tarea propia.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-form-fields.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente).
  - **Comportamiento cubierto**:
    - Las siete funciones siguen devolviendo las mismas clases, incluido `getFieldControlClassName` con y sin
      `hasError`, y `getChoiceGroupClassName`/`getChoiceOptionClassName` con `optionLayout` `'vertical'` (default) e
      `'inline'`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-form-fields.ts` existe con las siete funciones exportadas; el
    barrel ya no contiene su implementación; el test de regresión pasa.

---

## Task 5 — Módulo modal

- **ID**: 0114-T5
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-modal.ts` moviendo, copia literal: privado
  `modalPanelSizeClassMap`; públicos `getModalOverlayClassName`, `getModalPanelClassName`. Actualizar el barrel:
  eliminar su implementación y añadir `export { getModalOverlayClassName, getModalPanelClassName } from
  './runtime-node-styling-modal'`.
- **Fuera de alcance**: cualquier otro dominio.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-modal.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente).
  - **Comportamiento cubierto**:
    - `getModalOverlayClassName` sigue devolviendo la misma clase fija; `getModalPanelClassName` sigue devolviendo la
      misma clase para `'sm'`, `'lg'` y el fallback a `'md'` (default y valor no reconocido).
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-modal.ts` existe con las dos funciones exportadas; el barrel ya
    no contiene su implementación; el test de regresión pasa.

---

## Task 6 — Módulo accordion

- **ID**: 0114-T6
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-accordion.ts` moviendo, copia literal: `getAccordionHeaderClassName`,
  `getAccordionChevronClassName`, `getAccordionBodyClassName`, `getAccordionBodyAnimationClassName`. Actualizar el
  barrel: eliminar su implementación y añadir `export { getAccordionHeaderClassName, getAccordionChevronClassName,
  getAccordionBodyClassName, getAccordionBodyAnimationClassName } from './runtime-node-styling-accordion'`.
- **Fuera de alcance**: cualquier otro dominio.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-accordion.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente).
  - **Comportamiento cubierto**:
    - Las cuatro funciones siguen devolviendo las mismas clases, incluida la rama `isOpen`/`!isOpen` de
      `getAccordionChevronClassName` y `getAccordionBodyAnimationClassName`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-accordion.ts` existe con las cuatro funciones exportadas; el
    barrel ya no contiene su implementación; el test de regresión pasa.

---

## Task 7 — Módulo tabs

- **ID**: 0114-T7
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-tabs.ts` moviendo, copia literal: `getTabsRootClassName`,
  `getTabsBarClassName`, `getTabsButtonClassName`, `getTabsPanelClassName`. Actualizar el barrel: eliminar su
  implementación y añadir `export { getTabsRootClassName, getTabsBarClassName, getTabsButtonClassName,
  getTabsPanelClassName } from './runtime-node-styling-tabs'`.
- **Fuera de alcance**: cualquier otro dominio.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-tabs.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente).
  - **Comportamiento cubierto**:
    - Las cuatro funciones siguen devolviendo las mismas clases para orientación `'horizontal'` y `'vertical'`, y
      `getTabsButtonClassName` sigue diferenciando activo/inactivo por orientación.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-tabs.ts` existe con las cuatro funciones exportadas; el barrel ya
    no contiene su implementación; el test de regresión pasa.

---

## Task 8 — Módulo stat

- **ID**: 0114-T8
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-stat.ts` moviendo, copia literal: privados
  `statAccentBorderClassMap`, `statAccentIconClassMap`, `statTintedBgClassMap`, `statTintedIconClassMap`,
  `statTintedLabelClassMap`, `statTintedValueClassMap`; públicos `getStatAccentRootClassName`,
  `getStatAccentIconClassName`, `getStatAccentLabelClassName`, `getStatAccentValueClassName`,
  `getStatTintedRootClassName`, `getStatTintedIconClassName`, `getStatTintedLabelClassName`,
  `getStatTintedValueClassName`, `getStatPlainRootClassName`, `getStatPlainIconClassName`,
  `getStatPlainLabelClassName`, `getStatPlainValueClassName`. El módulo importa `ButtonColor` desde
  `'../config/runtime-config'`. Actualizar el barrel: eliminar su implementación y añadir `export {
  getStatAccentRootClassName, getStatAccentIconClassName, getStatAccentLabelClassName, getStatAccentValueClassName,
  getStatTintedRootClassName, getStatTintedIconClassName, getStatTintedLabelClassName, getStatTintedValueClassName,
  getStatPlainRootClassName, getStatPlainIconClassName, getStatPlainLabelClassName, getStatPlainValueClassName } from
  './runtime-node-styling-stat'`.
- **Fuera de alcance**: cualquier otro dominio.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-stat.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente), que ya
    ejercita las tres variantes (`accent`, `tinted`, `plain`) para los seis `ButtonColor`.
  - **Comportamiento cubierto**:
    - Las doce funciones siguen devolviendo exactamente las mismas clases por color y variante, incluido que
      `getStatPlainRootClassName`/`Icon`/`Label`/`Value` son color-agnósticas (no aceptan `color`).
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-stat.ts` existe con las doce funciones exportadas; el barrel ya
    no contiene su implementación; el test de regresión pasa.

---

## Task 9 — Módulo badge

- **ID**: 0114-T9
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-badge.ts` moviendo, copia literal: privados
  `badgePillBgClassMap`, `badgePillTextClassMap`, `badgeCircleDotClassMap`; públicos `getBadgePillClassName`,
  `getBadgeCircleDotClassName`, `getBadgeCircleLabelClassName`. El módulo importa `ButtonColor` desde
  `'../config/runtime-config'`. Actualizar el barrel: eliminar su implementación y añadir `export {
  getBadgePillClassName, getBadgeCircleDotClassName, getBadgeCircleLabelClassName } from
  './runtime-node-styling-badge'`.
- **Fuera de alcance**: cualquier otro dominio.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-badge.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente).
  - **Comportamiento cubierto**:
    - Las tres funciones siguen devolviendo exactamente las mismas clases por `ButtonColor`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-badge.ts` existe con las tres funciones exportadas; el barrel ya
    no contiene su implementación; el test de regresión pasa.

---

## Task 10 — Módulo alert

- **ID**: 0114-T10
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-alert.ts` moviendo, copia literal: privados `alertBgClassMap`,
  `alertTextClassMap`; públicos `getAlertClassName`, `getAlertTitleClassName`, `getAlertIconClassName`,
  `getAlertBodyClassName`. El módulo importa `ButtonColor` desde `'../config/runtime-config'`. Actualizar el barrel:
  eliminar su implementación y añadir `export { getAlertClassName, getAlertTitleClassName, getAlertIconClassName,
  getAlertBodyClassName } from './runtime-node-styling-alert'`.
- **Fuera de alcance**: cualquier otro dominio.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-alert.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente).
  - **Comportamiento cubierto**:
    - Las cuatro funciones siguen devolviendo exactamente las mismas clases por `ButtonColor`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-alert.ts` existe con las cuatro funciones exportadas; el barrel
    ya no contiene su implementación; el test de regresión pasa.

---

## Task 11 — Módulo skeleton

- **ID**: 0114-T11
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-skeleton.ts` moviendo, copia literal:
  `getSkeletonBaseClassName`, `getSkeletonAnimateClassName`. Actualizar el barrel: eliminar su implementación y
  añadir `export { getSkeletonBaseClassName, getSkeletonAnimateClassName } from './runtime-node-styling-skeleton'`.
- **Fuera de alcance**: cualquier otro dominio.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-skeleton.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente).
  - **Comportamiento cubierto**:
    - `getSkeletonBaseClassName` sigue devolviendo la misma clase fija; `getSkeletonAnimateClassName` sigue
      devolviendo `'animate-pulse'` con `true` y cadena vacía con `false`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-skeleton.ts` existe con las dos funciones exportadas; el barrel
    ya no contiene su implementación; el test de regresión pasa.

---

## Task 12 — Módulo de icono de input

- **ID**: 0114-T12
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-input-icon.ts` moviendo, copia literal:
  `getInputIconHolderClassName`, `getInputIconClassName`, `getInputWithIconClassName`,
  `getInputIconWrapperClassName`. Actualizar el barrel: eliminar su implementación y añadir `export {
  getInputIconHolderClassName, getInputIconClassName, getInputWithIconClassName, getInputIconWrapperClassName } from
  './runtime-node-styling-input-icon'`.
- **Fuera de alcance**: cualquier otro dominio.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-input-icon.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente).
  - **Comportamiento cubierto**:
    - Las cuatro funciones siguen devolviendo las mismas clases, incluida la rama `position` (`'left'`/`'right'`) de
      `getInputIconHolderClassName` y la rama `hasError` de `getInputIconWrapperClassName`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-input-icon.ts` existe con las cuatro funciones exportadas; el
    barrel ya no contiene su implementación; el test de regresión pasa.

---

## Task 13 — Módulo file manager

- **ID**: 0114-T13
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-file-manager.ts` moviendo, copia literal: privados
  `fileManagerDropZonePhaseClassMap`, `fileManagerDropZoneTextClassMap`, `fileManagerDropZoneIconColorClassMap`;
  públicos `getFileManagerRowClassName`, `getFileManagerRowFileNameClassName`, `getFileManagerRowActionClassName`,
  `getFileManagerListErrorClassName`, `getFileManagerListEmptyClassName`, `getFileManagerListDividerClassName`,
  `getFileManagerErrorItemClassName`, `getFileManagerDropZoneClassName`, `getFileManagerDropZoneTextClassName`,
  `getFileManagerDropZoneProgressTrackClassName`, `getFileManagerDropZoneProgressFillClassName`,
  `getFileManagerDropZoneIconColorClassName`. Actualizar el barrel: eliminar su implementación y añadir `export {
  getFileManagerRowClassName, getFileManagerRowFileNameClassName, getFileManagerRowActionClassName,
  getFileManagerListErrorClassName, getFileManagerListEmptyClassName, getFileManagerListDividerClassName,
  getFileManagerErrorItemClassName, getFileManagerDropZoneClassName, getFileManagerDropZoneTextClassName,
  getFileManagerDropZoneProgressTrackClassName, getFileManagerDropZoneProgressFillClassName,
  getFileManagerDropZoneIconColorClassName } from './runtime-node-styling-file-manager'`.
- **Fuera de alcance**: cualquier otro dominio.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-file-manager.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente).
  - **Comportamiento cubierto**:
    - Las doce funciones siguen devolviendo las mismas clases, incluidas todas las variantes de
      `getFileManagerRowActionClassName` (`'primary'`/`'danger'`/`'disabled'`), todas las fases de
      `getFileManagerDropZoneClassName` (`idle`/`drag-over`/`uploading`/`success`/`error`, con fallback a `idle`) y
      todos los `intent` de `getFileManagerDropZoneTextClassName`/`getFileManagerDropZoneIconColorClassName`
      (`muted`/`info`/`success`).
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-file-manager.ts` existe con las doce funciones exportadas; el
    barrel ya no contiene su implementación; el test de regresión pasa.

---

## Task 14 — Módulo de botones

- **ID**: 0114-T14
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-button.ts` moviendo, copia literal: privados
  `buttonSolidVariantClassMap`, `buttonOutlineVariantClassMap`, `buttonGhostVariantClassMap`,
  `buttonLinkVariantClassMap`, `buttonVariantClassMaps`; públicos `getButtonNodeClassName`,
  `getPrimaryButtonNodeClassName`, `getSecondaryButtonNodeClassName`, `getButtonVariantClassName`. El módulo importa
  `ButtonColor` y `ButtonVariant` desde `'../config/runtime-config'`. `getButtonNodeClassName` sigue delegando en
  `getSecondaryButtonNodeClassName` **dentro del mismo módulo** (sin import entre ficheros, ambas viven en
  `runtime-node-styling-button.ts`). Actualizar el barrel: eliminar su implementación y añadir `export {
  getButtonNodeClassName, getPrimaryButtonNodeClassName, getSecondaryButtonNodeClassName, getButtonVariantClassName }
  from './runtime-node-styling-button'`.
- **Fuera de alcance**: `getTablePaginationButtonClassName`/`getTablePaginationCurrentButtonClassName` (tabla, Task
  17) y `getRepeaterPaginationButtonClassName`/`getRepeaterPaginationCurrentButtonClassName` (Task 16), que no son
  botones de acción sino controles de paginación con su propio dominio.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-button.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente).
  - **Comportamiento cubierto**:
    - `getButtonNodeClassName()` sigue devolviendo exactamente el mismo resultado que `getSecondaryButtonNodeClassName()`
      (delegación byte a byte).
    - `getButtonVariantClassName` sigue devolviendo la misma combinación de clases para las cuatro variantes
      (`solid`/`outline`/`ghost`/`link`) cruzadas con los seis `ButtonColor`, y respeta `fullWidth`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-button.ts` existe con las cuatro funciones exportadas y la
    delegación interna intacta; el barrel ya no contiene su implementación; el test de regresión pasa.

---

## Task 15 — Módulo container (depende de Task 1)

- **ID**: 0114-T15
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-container.ts` moviendo, copia literal: privados
  `containerGapClassMap`, `containerColumnsClassMap`, `responsiveContainerColumnsClassMaps`, `containerAlignClassMap`,
  `containerJustifyClassMap`, `containerWrapClassMap`, interfaces `ContainerNodeStylingOptions`,
  `ContainerNodeStyling`, tipo `ContainerGapStyle`, interface `ContainerNodeSurfaceOptions`, función privada
  `getResponsiveClassNames`; públicos `getContainerNodeSurface`, `getContainerNodeStyling`. El módulo importa
  `CSSProperties` desde `'react'` y `RuntimeResponsiveBreakpoint`, `RuntimeResponsiveLayoutValue` desde
  `'../config/runtime-config'`. `getResponsiveClassNames` (usada solo por `getContainerNodeStyling` para las clases
  de `columns`) necesita `responsiveBreakpoints`: importarlo directamente desde `'./runtime-node-styling-base'`
  (creado en Task 1) — no duplicar el array. Actualizar el barrel: eliminar su implementación y añadir `export {
  getContainerNodeSurface, getContainerNodeStyling } from './runtime-node-styling-container'`.
- **Fuera de alcance**: `getGridChildSpanClassName` y el resto del módulo base (ya movidos en Task 1, este módulo solo
  los consume).
- **Dependencias**: Task 1 (`runtime-node-styling-base.ts` debe existir con `responsiveBreakpoints` exportado).
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-container.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente), que ya
    ejercita `getContainerNodeSurface` (con/sin `withinForm`, con/sin `columns`, `direction: 'row'` vs otro) y
    `getContainerNodeStyling` (flex vs grid, `variant: 'card'`, `align`/`justify`/`wrap`, `gap` con alias y con
    valor arbitrario vía `style['--runtime-container-gap']`).
  - **Comportamiento cubierto**:
    - Ambas funciones siguen devolviendo exactamente las mismas clases y el mismo `style` que antes de la extracción,
      incluida la rama de `gap` arbitrario que añade `'gap-[var(--runtime-container-gap)]'` y el objeto `style`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente. No reintroducir una copia local de
    `responsiveBreakpoints`: debe importarse desde `runtime-node-styling-base.ts`.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-container.ts` existe con las dos funciones exportadas e importa
    `responsiveBreakpoints` desde el módulo base sin duplicarlo; el barrel ya no contiene su implementación; el test
    de regresión pasa.

---

## Task 16 — Módulo de paginación de repeater (depende de Task 1)

- **ID**: 0114-T16
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-repeater-pagination.ts` moviendo, copia literal:
  `getRepeaterPaginationControlsClassName`, `getRepeaterPaginationButtonClassName`,
  `getRepeaterPaginationCurrentButtonClassName`. El módulo importa `RuntimeResponsiveLayoutValue` desde
  `'../config/runtime-config'`. `getRepeaterPaginationControlsClassName` llama a `getGridChildSpanClassName`:
  importarla directamente desde `'./runtime-node-styling-base'` (creado en Task 1), nunca desde el barrel. Actualizar
  el barrel: eliminar su implementación y añadir `export { getRepeaterPaginationControlsClassName,
  getRepeaterPaginationButtonClassName, getRepeaterPaginationCurrentButtonClassName } from
  './runtime-node-styling-repeater-pagination'`.
- **Fuera de alcance**: `getTablePaginationButtonClassName`/`getTablePaginationCurrentButtonClassName` (Task 17, que
  consumirá este módulo por delegación).
- **Dependencias**: Task 1 (`runtime-node-styling-base.ts` debe existir con `getGridChildSpanClassName` exportado).
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-repeater-pagination.ts`; modificar
    `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente), que ya
    ejercita las tres funciones, incluido `getRepeaterPaginationControlsClassName` con `parentGridColumns` `null`,
    `undefined` y con valor (aportando la clase de span).
  - **Comportamiento cubierto**:
    - Las tres funciones siguen devolviendo exactamente las mismas clases, incluida la relación
      `getRepeaterPaginationCurrentButtonClassName` = `getRepeaterPaginationButtonClassName()` con los cuatro
      `.replace(...)` encadenados sin cambios.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-repeater-pagination.ts` existe con las tres funciones
    exportadas e importa `getGridChildSpanClassName` desde el módulo base; el barrel ya no contiene su
    implementación; el test de regresión pasa.

---

## Task 17 — Módulo tabla (depende de Task 16)

- **ID**: 0114-T17
- **Estado**: pending
- **Objetivo**: Crear `src/runtime/runtime-node-styling-table.ts` moviendo, copia literal: `getTableContainerClassName`,
  `getTableScrollContainerClassName`, `getTableNodeClassName`, `getTableHeaderCellClassName`,
  `getTableFilterControlsClassName`, `getTableFilterFieldClassName`, `getTableFilterLabelClassName`,
  `getTableFilterInputClassName`, `getTableFilterResetButtonClassName`, `getTableSortButtonClassName`,
  `getTableBodyRowClassName`, `getTableCellClassName`, `getTablePaginationControlsClassName`,
  `getTablePaginationButtonClassName`, `getTablePaginationCurrentButtonClassName`. Las dos últimas delegan
  íntegramente en `getRepeaterPaginationButtonClassName`/`getRepeaterPaginationCurrentButtonClassName`: importarlas
  directamente desde `'./runtime-node-styling-repeater-pagination'` (creado en Task 16), nunca desde el barrel.
  Actualizar el barrel: eliminar su implementación y añadir `export { getTableContainerClassName,
  getTableScrollContainerClassName, getTableNodeClassName, getTableHeaderCellClassName,
  getTableFilterControlsClassName, getTableFilterFieldClassName, getTableFilterLabelClassName,
  getTableFilterInputClassName, getTableFilterResetButtonClassName, getTableSortButtonClassName,
  getTableBodyRowClassName, getTableCellClassName, getTablePaginationControlsClassName,
  getTablePaginationButtonClassName, getTablePaginationCurrentButtonClassName } from './runtime-node-styling-table'`.
- **Fuera de alcance**: el propio módulo `repeater-pagination` (ya creado en Task 16, este módulo solo lo consume).
- **Dependencias**: Task 16 (`runtime-node-styling-repeater-pagination.ts` debe existir con las funciones de botón de
  paginación exportadas).
- **Impacto esperado en archivos**:
  - Código: crear `src/runtime/runtime-node-styling-table.ts`; modificar `src/runtime/runtime-node-styling.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: `src/tests/runtime/runtime-node-styling.test.ts` (existente), que ya
    ejercita las quince funciones, incluida `getTableSortButtonClassName` con `isActive` `true`/`false` (default) y
    la delegación de `getTablePaginationButtonClassName`/`getTablePaginationCurrentButtonClassName` hacia repeater.
  - **Comportamiento cubierto**:
    - Las quince funciones siguen devolviendo exactamente las mismas clases; `getTablePaginationButtonClassName()`
      sigue siendo idéntico a `getRepeaterPaginationButtonClassName()` y `getTablePaginationCurrentButtonClassName()`
      sigue siendo idéntico a `getRepeaterPaginationCurrentButtonClassName()`.
  - **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`.
  - **Restricciones**: no modificar ninguna aserción existente.
- **Documentación afectada**: ninguna hasta Task 18.
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-node-styling-table.ts` existe con las quince funciones exportadas e importa
    la delegación de paginación desde `runtime-node-styling-repeater-pagination.ts`; el barrel ya no contiene su
    implementación; el test de regresión pasa.

---

## Task 18 — Barrel final y verificación global

- **ID**: 0114-T18
- **Estado**: pending
- **Objetivo**: Con las 17 tareas anteriores cerradas, `src/runtime/runtime-node-styling.ts` debe quedar como un
  barrel puro: únicamente las 17 líneas `export { ... } from './runtime-node-styling-<dominio>'` (una de ellas
  `export type { EffectiveResponsiveLayoutValue } from './runtime-node-styling-base'`), sin ninguna declaración de
  función, constante, interfaz ni import de `'react'`/`'../config/runtime-config'` residual (esos imports viven ya
  solo en los módulos internos que los necesitan). Esta tarea:
  1. Revisa el barrel y elimina cualquier import o código muerto que haya quedado sin usar tras las 17 extracciones.
  2. Confirma con `grep -n "^export function\|^export type" src/runtime/runtime-node-styling.ts` que el barrel ya no
     declara ninguna función/tipo directamente (el comando no debe devolver resultados, porque todo pasa ahora por
     `export { ... } from ...`).
  3. Confirma que el conjunto de símbolos re-exportados por el barrel (nombres, no implementación) es exactamente el
     mismo conjunto de 94 funciones + 1 tipo inventariado al inicio del plan (comparar contra el "Mapa de módulos" de
     este documento).
  4. Ejecuta la verificación global de la feature.
- **Fuera de alcance**: crear o mover ninguna función adicional (todo el contenido ya se movió en Tasks 1-17); tocar
  cualquiera de los 32 ficheros consumidores; reorganizar `src/tests/runtime/runtime-node-styling.test.ts`.
- **Dependencias**: Tasks 1-17, todas cerradas.
- **Impacto esperado en archivos**:
  - Código: modificar `src/runtime/runtime-node-styling.ts` (limpieza final, sin crear módulos nuevos).
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna a modificar en esta tarea (se declara como afectada para la pasada posterior de
    `update-app-documentation`, ver más abajo).
- **Tests**:
  - **Ficheros de test**: ninguno (nuevo ni ampliación); cubierto por: la suite completa existente de `pnpm test`
    (mapa completo en `ai-workflow/docs/test-index.md`), con foco explícito en
    `src/tests/runtime/runtime-node-styling.test.ts` como regresión byte a byte de esta feature.
  - **Comportamiento cubierto**:
    - Ninguno de los 32 ficheros consumidores cambia: `git diff --name-only` tras las 18 tareas no debe listar
      ninguno de `src/app/app-shell.tsx`, `src/dev-runtime/dev-runtime.tsx`, `src/runtime/layout-node-renderer.tsx`,
      `src/runtime/runtime-page.tsx` ni ningún fichero bajo `src/runtime/nodes/` (solo debe listar
      `src/runtime/runtime-node-styling.ts` modificado y los 17 módulos internos nuevos).
    - No existe ningún ciclo de import entre los módulos internos: revisión manual del grafo declarado en
      "Referencia común" (`base` ← `container`, `base` ← `repeater-pagination`, `repeater-pagination` ← `table`, sin
      aristas de vuelta) y confirmación de que ningún módulo interno importa desde el barrel.
    - `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts` pasa sin cambiar ninguna aserción respecto al
      estado previo a la feature.
    - `pnpm test` completo pasa, incluido el umbral mínimo de cobertura del 80% sobre `src/`.
    - `pnpm build` completa sin errores (incluye chequeo de tipos de todos los módulos nuevos y del barrel).
    - `pnpm lint` pasa sin error sobre los 17 módulos nuevos y el barrel.
  - **Comandos durante la implementación**: en este orden, todos deben terminar en éxito:
    `git diff --name-only` (inspección manual del listado), `grep -n "^export function\|^export type"
    src/runtime/runtime-node-styling.ts` (debe devolver vacío), `pnpm lint`, `pnpm build`, `pnpm test`.
  - **Restricciones**: no añadir tests nuevos para "cubrir" la reorganización; la regresión de la suite existente
    es la validación completa de esta tarea. No dejar el barrel con una sola línea `export * from` que oculte qué
    módulo aporta cada símbolo: mantener las 17 líneas explícitas por dominio para trazabilidad futura.
- **Documentación afectada**: `ai-workflow/docs/architecture.md` (la línea que describe `runtime-node-styling`
  como fichero único), `ai-workflow/docs/app-features/runtime/organization.md` (sección "Styling", que hoy describe
  un único fichero), `ai-workflow/docs/app-features/runtime/design-tokens.md` y `ai-workflow/docs/conventions.md`
  (referencias a `runtime-node-styling.ts` como "único helper"), a actualizar manualmente en una pasada posterior de
  `update-app-documentation`. `ai-workflow/docs/test-index.md` no se ve afectado porque el fichero de test no se
  reorganiza en esta feature.
- **Criterios de finalización**:
  - Cierre de implementación: el barrel es un barrel puro de 17 líneas de re-export; los cinco comandos de
    verificación (`grep`, `pnpm lint`, `pnpm build`, `pnpm test`, inspección de `git diff --name-only`) terminan en
    éxito y sin listar ningún fichero fuera de `src/runtime/runtime-node-styling*.ts`.

---

## Cierre de la feature

Cuando las Tasks 1-18 queden en `done`, la feature está completa a nivel de implementación:
`src/runtime/runtime-node-styling.ts` pasa de 1.245 líneas a un barrel corto, los 94 funciones + 1 tipo siguen
siendo importables desde la misma ruta con la misma firma y comportamiento, ninguno de los 32 ficheros consumidores
cambió su import, no hay ciclos entre los módulos internos y la suite de tests (incluido el umbral de cobertura del
80%) sigue en verde. Queda pendiente, fuera de este `tasks.md`, la actualización manual de la documentación listada
en Task 18 vía `update-app-documentation`.
