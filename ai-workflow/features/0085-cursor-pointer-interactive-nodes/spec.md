# Spec: cursor pointer en nodos interactivos

## Objetivo

Garantizar que todos los elementos interactivos clickables del runtime muestren `cursor: pointer` al posicionar el ratón
sobre ellos. El cambio es exclusivamente visual: no altera el contrato JSON, la validación ni la lógica funcional de
ningún nodo.

## Alcance

Los siguientes nodos y controles deben mostrar `cursor: pointer`:

- **`button`**: el elemento botón en todas sus variantes (`solid`, `outline`, `ghost`, `link`) y colores.
- **`tabs`**: cada botón de la barra de tabs en orientación `horizontal` y `vertical`.
- **`accordion`**: el elemento de cabecera clicable.
- **Controles de paginación de `repeater`**: botones de las variantes `previousNext` (Anterior, Siguiente), `numbered` (
  Primera, Anterior, páginas numeradas, Siguiente, Última) y el botón "Mostrar más" de la variante `scroll`.
- **Controles de paginación de `table`**: ídem a los de `repeater`.
- **Cabeceras de columna `sortable` en `table`**: el control interactivo que cicla la ordenación.
- **Botón "Reiniciar filtros" en `table`**: el control que limpia los filtros activos.
- **Botones de acción de `fileManager`**: Ver, Descargar, Eliminar.
- **Zona de carga DnD del `fileManager`**: la zona de arrastrar-y-soltar debe indicar visualmente que es un destino de
  acción.
- **Overlay/backdrop del `modal`**: el área exterior que cierra el modal al hacer clic.

## Fuera de alcance

- **`link` node**: el elemento `<a>` obtiene `cursor: pointer` del navegador por defecto; no requiere cambio.
- **`input`, `textarea`**: usan `cursor: text` por convención; no se modifican.
- **Controles nativos de formulario** (`select`, `input[type=radio]`, `input[type=checkbox]`): el navegador gestiona su
  cursor; fuera de esta feature.
- **Labels de `radioGroup`/`checkboxGroup`**: fuera de esta feature.
- Ningún cambio en el contrato JSON de ningún nodo.
- Ningún cambio en validación ni lógica funcional.

## Requisitos funcionales

1. El cursor del ratón debe cambiar a `pointer` al hacer hover sobre cualquier elemento del alcance.
2. El cursor debe aplicarse usando la clase Tailwind `cursor-pointer`, sin estilos inline ni CSS ad hoc.
3. Si existe un punto de estilo centralizado ya en uso para un control (p. ej. en `runtime-node-styling` o en las clases
   base del componente), el `cursor-pointer` se añade en ese mismo punto en lugar de dispersarse.
4. El cambio aplica a todas las variantes visuales de cada nodo (colores, orientaciones, tamaños, estados enabled) sin
   excepciones.

## Requisitos no funcionales

1. Sin regresión funcional en ningún nodo del runtime.
2. El umbral de cobertura global del 80% sobre `src/` debe seguir cumpliéndose tras el cambio.
3. Cambio compatible con Tailwind v4 y el sistema de tokens globales del proyecto.

## Criterios de aceptación

1. Hover sobre un `button` (cualquier variante/color) → cursor `pointer`.
2. Hover sobre un botón de la barra de `tabs` (horizontal y vertical) → cursor `pointer`.
3. Hover sobre la cabecera de un `accordion` → cursor `pointer`.
4. Hover sobre cualquier control de paginación de `repeater` (Anterior, Siguiente, página numerada, Primera, Última,
   Mostrar más) → cursor `pointer`.
5. Hover sobre cualquier control de paginación de `table` (mismas variantes) → cursor `pointer`.
6. Hover sobre una cabecera de columna `sortable` en `table` → cursor `pointer`.
7. Hover sobre "Reiniciar filtros" en `table` → cursor `pointer`.
8. Hover sobre los botones Ver, Descargar, Eliminar en `fileManager` → cursor `pointer`.
9. Hover sobre la zona DnD del `fileManager` → cursor `pointer`.
10. Hover sobre el backdrop del `modal` → cursor `pointer`.
11. No hay regresión visual ni funcional en ningún otro nodo.

## Casos límite

- **Controles de paginación deshabilitados** (p. ej. "Anterior" en la primera página): si los controles están
  renderizados pero inactivos (sin acción), se permite mantener el cursor actual (`default` o `not-allowed`); no es
  necesario añadir `pointer` a controles sin acción efectiva.
- **Tab oculto por `visibility`**: no se renderiza, no aplica.
- **Modal cerrado**: el backdrop no existe en el DOM, no aplica.
- **Botón de `fileManager` cuando la operación está deshabilitada (`false`)**: el botón no se renderiza, no aplica.
- **`button` dentro de un `modal` o `repeater`**: mismo comportamiento que en cualquier otro contexto.

## Riesgos o preguntas abiertas

Ninguno.
