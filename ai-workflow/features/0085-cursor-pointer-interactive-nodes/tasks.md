# Tasks — 0085 cursor pointer en nodos interactivos

Contrato de ejecución para añadir `cursor-pointer` (clase Tailwind) a todos los nodos interactivos clickables del
runtime. El cambio es exclusivamente visual; no toca contrato JSON, validación ni lógica funcional.

Punto único de aplicación: las funciones de estilo de `src/runtime/runtime-node-styling.ts`. El nodo `button` (
`getButtonVariantClassName`) ya incluye `cursor-pointer` y queda fuera del trabajo (verificación implícita: no se
modifica).

## Próxima tarea

T2.

## T1 — cursor-pointer en helpers compartidos de controles interactivos

- **ID**: T1
- **Estado**: completada
- **Objetivo**: añadir `cursor-pointer` como clase Tailwind a las funciones de estilo centralizadas de
  `runtime-node-styling.ts` que producen el className de los siguientes controles clickables: botón de `tabs`, cabecera
  de `accordion`, botón base de paginación de `repeater` (que también sirve a `table` por delegación y a la variante
  `scroll` "Mostrar más"), botón ordenable de cabecera de `table`, botón "Reiniciar filtros" de `table` y overlay del
  `modal`. En el caso del overlay del `modal`, además, fijar `cursor-auto` (o equivalente) en el className del panel
  interior para evitar que el panel herede `cursor: pointer` del backdrop por el cascade del navegador (regresión visual
  que el spec prohíbe en su criterio 11).
- **Fuera de alcance**:
    - Helpers del nodo `fileManager` (T2).
    - `getButtonVariantClassName` (`button` ya incluye `cursor-pointer`).
    - Estilos inline o CSS ad hoc fuera de `runtime-node-styling.ts`.
    - Cambios en contrato JSON, validación o lógica funcional.
    - Cambios en estilos de estados deshabilitados: la convivencia con `disabled:cursor-not-allowed` debe mantenerse
      intacta en los helpers de paginación; no se añade ni se altera el comportamiento de los estados disabled.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
    - Código:
        - `src/runtime/runtime-node-styling.ts` (modificar las funciones `getTabsButtonClassName`,
          `getAccordionHeaderClassName`, `getRepeaterPaginationButtonClassName`, `getTableSortButtonClassName`,
          `getTableFilterResetButtonClassName`, `getModalOverlayClassName`, `getModalPanelClassName`).
          `getRepeaterPaginationCurrentButtonClassName` y `getTablePaginationButtonClassName` heredan automáticamente
          del helper base; no necesitan edición adicional pero sí cobertura de test.
    - Tests:
        - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación: nuevos casos `it(...)` dentro de los describe ya
          existentes por helper).
    - Documentación: ninguno. Las fichas de `ai-workflow/docs/app-features/nodes/` no documentan el cursor de hover como
      parte del contrato.
- **Tests**:
    - **Ficheros de test**:
        - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación).
    - **Comportamiento cubierto**:
        - `getTabsButtonClassName(true, 'horizontal')` incluye `cursor-pointer`.
        - `getTabsButtonClassName(false, 'horizontal')` incluye `cursor-pointer`.
        - `getTabsButtonClassName(true, 'vertical')` incluye `cursor-pointer`.
        - `getTabsButtonClassName(false, 'vertical')` incluye `cursor-pointer`.
        - `getAccordionHeaderClassName()` incluye `cursor-pointer`.
        - `getRepeaterPaginationButtonClassName()` incluye `cursor-pointer` y conserva `disabled:cursor-not-allowed`.
        - `getRepeaterPaginationCurrentButtonClassName()` incluye `cursor-pointer` (heredado del base).
        - `getTablePaginationButtonClassName()` incluye `cursor-pointer` (delegación al base).
        - `getTablePaginationCurrentButtonClassName()` incluye `cursor-pointer` (delegación al base).
        - `getTableSortButtonClassName()` incluye `cursor-pointer` en ambos estados (`isActive=true` e
          `isActive=false`).
        - `getTableFilterResetButtonClassName()` incluye `cursor-pointer`.
        - `getModalOverlayClassName()` incluye `cursor-pointer`.
        - `getModalPanelClassName('md')` (y al menos otro tamaño, p. ej. `'sm'`) NO incluye `cursor-pointer` y sí
          incluye una utilidad que neutralice la herencia (`cursor-auto` o equivalente). El test debe afirmar
          explícitamente la utilidad elegida para que la decisión quede congelada.
        - `getButtonVariantClassName` no se modifica y sigue conteniendo `cursor-pointer` (test de control, una sola
          comprobación basta para evitar regresión por refactor accidental).
    - **Comandos durante la implementación**:
        - `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`
    - **Restricciones**:
        - Las nuevas aserciones se añaden dentro de los `describe` existentes por familia de helper (no crear nuevos
          `describe` de alto nivel).
        - No usar snapshots; cada nueva aserción usa `expect(cn).toContain('cursor-pointer')` o su negación explícita,
          alineado con el estilo del fichero.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**:
    - Todos los helpers listados emiten `cursor-pointer` (o `cursor-auto` en el panel del modal) en sus clases finales.
    - El fichero `runtime-node-styling.ts` no introduce estilos inline ni clases ad hoc fuera de las funciones
      afectadas.
    - `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts` en verde.
    - `pnpm test` global en verde, manteniendo el umbral del 80% de cobertura.
- **Cierre de implementación**: código de T1 y tests asociados completos y validados.

## T2 — cursor-pointer en helpers del nodo fileManager

- **ID**: T2
- **Estado**: completada
- **Objetivo**: añadir `cursor-pointer` a los puntos de estilo centralizados del nodo `fileManager` que cubren los
  controles clickables descritos por la spec: botones de acción de fila Ver / Descargar / Eliminar y la zona DnD de
  subida. Para la zona DnD, el cursor debe ser `pointer` en las fases interactivas (`idle`, `drag-over`, `success`,
  `error`) y conservar el actual `cursor-not-allowed` en la fase `uploading`. Las acciones de fila se aplican vía
  `getFileManagerRowActionClassName`: la variante `primary` (Ver, Descargar como `<a>`) debe ganar `cursor-pointer`; la
  variante `danger` (Eliminar como `<button>`) ya lo incluye y no se modifica; la variante `disabled` (Ver/Descargar sin
  URL resoluble, render como `<span>`) NO recibe `cursor-pointer`, alineado con el caso límite de "controles sin acción
  efectiva" de la spec.
- **Fuera de alcance**:
    - Helpers de T1.
    - Cambios en `file-manager-drop-zone.tsx`, `file-manager-row.tsx` u otros consumidores del helper: el className
      final se compone desde el helper centralizado y no requiere edición del componente.
    - Cambios en validaciones, lógica de subida, fases de DnD o cualquier otro comportamiento del fileManager.
    - Migrar la clase wrapper de la zona DnD (la cadena literal `relative flex flex-col items-center justify-center ...`
      en `file-manager-drop-zone.tsx`) al helper: la zona ya compone el cursor desde el mapa de fases, así que basta con
      modificar el mapa.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
    - Código:
        - `src/runtime/runtime-node-styling.ts` (modificar `getFileManagerRowActionClassName` para la variante `primary`
          y el mapa interno `fileManagerDropZonePhaseClassMap` consumido por `getFileManagerDropZoneClassName`).
    - Tests:
        - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación).
    - Documentación: ninguno. La ficha `ai-workflow/docs/app-features/nodes/file-manager.md` no documenta el cursor como
      parte del contrato.
- **Tests**:
    - **Ficheros de test**:
        - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación).
    - **Comportamiento cubierto**:
        - `getFileManagerRowActionClassName('primary')` incluye `cursor-pointer`.
        - `getFileManagerRowActionClassName('danger')` sigue incluyendo `cursor-pointer` (test de control para evitar
          regresión por refactor).
        - `getFileManagerRowActionClassName('disabled')` NO incluye `cursor-pointer`.
        - `getFileManagerDropZoneClassName('idle')` incluye `cursor-pointer`.
        - `getFileManagerDropZoneClassName('drag-over')` incluye `cursor-pointer`.
        - `getFileManagerDropZoneClassName('success')` incluye `cursor-pointer`.
        - `getFileManagerDropZoneClassName('error')` incluye `cursor-pointer`.
        - `getFileManagerDropZoneClassName('uploading')` NO incluye `cursor-pointer` y sigue incluyendo
          `cursor-not-allowed`.
    - **Comandos durante la implementación**:
        - `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`
    - **Restricciones**:
        - Las aserciones se añaden dentro de los `describe` ya existentes (`getFileManagerRowActionClassName`,
          `getFileManagerDropZoneClassName`).
        - No tocar el componente `file-manager-drop-zone.tsx`: el helper sigue siendo el único punto de composición del
          cursor.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**:
    - `getFileManagerRowActionClassName('primary')` y todas las fases interactivas de `getFileManagerDropZoneClassName`
      emiten `cursor-pointer`.
    - La fase `uploading` conserva `cursor-not-allowed` sin `cursor-pointer`.
    - La variante `disabled` de las acciones de fila no recibe `cursor-pointer`.
    - `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts` en verde.
    - `pnpm test` global en verde, manteniendo el umbral del 80% de cobertura.
- **Cierre de implementación**: código de T2 y tests asociados completos y validados.
