# Spec: 0105 — Corrección de bugs del editor visual (canvas) en modo Editor

## Objetivo

Corregir tres defectos del editor visual de layout (modo Editor de `DevRuntime`, introducido en 0102/0103/0104) que
degradan la fiabilidad de la edición directa sobre el contenido renderizado: (1) el orden visual de los hijos de un
`container` en modo grid (`columns`) no coincide con el modo Visual; (2) el nodo `tabs` no permite gestionar sus
pestañas de forma fiable desde el editor y expone edición de hijos por una vía que no le corresponde; (3) no es posible
reanidar un nodo ya existente del árbol dentro de un `container`, `form`, `accordion` o pestaña de `tabs` que ya tiene
contenido, aunque insertar un nodo nuevo desde la paleta en el mismo destino sí funciona.

## Alcance

- Corregir el render en modo Editor de `container` con `props.columns` (modo grid) para que el orden y posición de los
  nodos coincida exactamente con el modo Visual/producción.
- Corregir el editor de propiedades del nodo `tabs` (edición de `props.items`) para que:
    - el control "Añadir" cree una pestaña nueva válida (con etiqueta por defecto) en vez de fallar en silencio.
    - el control "Quitar" elimine la pestaña seleccionada correctamente, bloqueando la eliminación de la última pestaña
      restante (mínimo 1, según validación ya vigente del nodo).
    - el campo `children` de cada pestaña deje de exponerse en ese editor genérico de propiedades: los hijos de una
      pestaña se gestionan exclusivamente seleccionándolos en el canvas.
- Corregir la reanidación por arrastre de un nodo ya existente del árbol hacia un `container`, `form`, `accordion` o
  pestaña activa de `tabs` que ya contiene hijos, para que el resultado sea equivalente al de insertar un nodo nuevo
  desde la paleta en el mismo destino.
- Esto aplica de forma consistente independientemente de si el contenedor destino ya tiene 0, 1 o varios hijos.

## Fuera de alcance

- Cualquier control dedicado nuevo sobre la propia barra visual de pestañas (botones "+"/"x" directamente en la barra):
  se descarta a favor de reparar el editor de propiedades genérico ya existente para arrays.
- Deshacer/rehacer de las operaciones del canvas (sigue fuera de alcance general del editor visual).
- Selección múltiple de nodos o cualquier otra capacidad no relacionada con estos tres defectos.
- Cambios en el comportamiento de `container`, `tabs`, `form` o `accordion` en modo Visual/producción: los tres defectos
  son exclusivos del modo Editor.
- Cambios en la validación estructural de destino ya vigente (qué tipos aceptan hijos, catálogo cerrado de `modal`/
  `link`, etc.): el bug de reanidación es sobre la mecánica del drop, no sobre qué destinos son válidos.
- Nuevas reglas de validación para `tabs.props.items` más allá de exigir al menos una pestaña (ya vigente).

## Requisitos funcionales

### RF1 — Orden visual correcto en `container` con columnas (modo Editor)

- En modo Editor, un `container` con `props.columns` (modo grid) debe mostrar sus nodos hijos en el mismo orden y
  posición de columna/fila que en modo Visual, para cualquier número de hijos y cualquier configuración de `columns` (
  fija o responsive).
- Los indicadores de zona de arrastre ("drop zones") que el editor añade sobre un `container` en modo grid no deben
  alterar el orden ni la posición visual de los nodos reales del árbol.
- El mismo `container`, alternado entre modo Visual y modo Editor sin ninguna edición intermedia, debe verse visualmente
  idéntico salvo por la presencia de los indicadores propios del modo Editor (selección, hover, zonas de drop).

### RF2 — Gestión de pestañas de `tabs` desde el panel de propiedades

- Al seleccionar un nodo `tabs` en modo Editor, el panel de propiedades permite añadir una nueva pestaña mediante el
  control "Añadir" ya existente para arrays; la pestaña añadida es válida de inmediato (cumple la validación de
  `tabs.props.items`, incluyendo `label` con un valor por defecto no vacío) y se refleja tanto en la barra de tabs del
  canvas como en el buffer de Monaco.
- El panel de propiedades permite eliminar una pestaña existente mediante el control "Quitar" ya existente para arrays.
  Si solo queda una pestaña, "Quitar" no permite dejar `props.items` vacío (se bloquea o no se ofrece, de forma
  coherente con cómo el panel trata hoy cualquier otro array obligatorio con mínimo de un elemento).
- Al eliminar la pestaña actualmente activa en el canvas, el nodo `tabs` activa automáticamente la primera pestaña
  restante, con la misma semántica ya vigente para pestañas ocultas por `visibility`.
- El campo `children` de cada entrada de `props.items` deja de generarse como campo editable dentro del panel de
  propiedades de `tabs`. El resto de campos del item (`label`, `visibility`) se mantienen editables igual que hoy.
- La gestión de los hijos de una pestaña (añadir, mover, eliminar) sigue realizándose exclusivamente mediante selección
  directa de esos nodos en el canvas (drag-and-drop, paleta y "Eliminar nodo" del panel de propiedades del nodo hijo
  seleccionado), sin cambios respecto al comportamiento ya vigente para el resto de nodos del árbol.

### RF3 — Reanidar nodos existentes dentro de contenedores con contenido

- En modo Editor, arrastrar un nodo ya existente del árbol y soltarlo dentro de un `container`, `form`, `accordion` o la
  pestaña activa de un `tabs` debe reanidarlo correctamente como hijo de ese destino, con independencia de si el destino
  ya contiene 0, 1 o varios hijos, y con independencia de la posición relativa del nodo arrastrado respecto al destino
  en el árbol original (antes o después, mismo padre o padre distinto, incluyendo el propio padre actual del nodo
  arrastrado).
- El resultado de esta operación debe ser equivalente en fiabilidad al de insertar un nodo nuevo desde la paleta en el
  mismo destino: ningún drop válido según las reglas de destino ya vigentes debe fallar silenciosamente ni insertar el
  nodo en una posición distinta a la señalada visualmente durante el arrastre.
- Si durante el arrastre el destino señalado deja de ser válido en el momento de soltar (caso ya cubierto por las reglas
  de destino vigentes), el `layout` no cambia, igual que hoy.

## Requisitos no funcionales

- Ninguna de las tres correcciones debe modificar el comportamiento observable del runtime en modo Visual o en
  producción.
- Ninguna de las tres correcciones debe modificar el contrato JSON de `container`, `tabs`, `form` o `accordion`, ni su
  validación previa al render.
- Las correcciones deben mantener la sincronización bidireccional e inmediata ya vigente entre canvas y buffer de
  Monaco.
- Se debe conservar el umbral mínimo de cobertura de tests del proyecto (80% sobre `src/`).

## Criterios de aceptación

1. Con un `container` de `props.columns: 3` y 5 hijos heterogéneos, el modo Editor muestra los 5 hijos en el mismo orden
   y en las mismas posiciones de columna/fila que el modo Visual.
2. Insertar un nuevo hijo (desde la paleta) en un `container` con columnas en modo Editor no desordena visualmente los
   hijos ya existentes.
3. Seleccionar un nodo `tabs` en modo Editor y pulsar "Añadir" en `props.items` produce una pestaña nueva visible en la
   barra con una etiqueta por defecto, sin error silencioso, reflejada en el buffer de Monaco.
4. Pulsar "Quitar" sobre una pestaña de `tabs` con más de una pestaña la elimina correctamente de la barra y del buffer
   de Monaco.
5. Con `tabs` teniendo exactamente una pestaña, el control "Quitar" no permite dejar `props.items` vacío.
6. Eliminar la pestaña activa de `tabs` activa automáticamente la primera pestaña restante.
7. El panel de propiedades de un nodo `tabs` no muestra ningún campo editable correspondiente a
   `props.items[].children`.
8. Seleccionar un nodo hijo dentro del panel de una pestaña de `tabs` y pulsar "Eliminar nodo" en su propio panel de
   propiedades lo elimina, igual que para cualquier otro nodo del árbol.
9. Arrastrar un nodo existente hacia un `container` que ya tiene al menos un hijo lo reanida correctamente como nuevo
   hijo de ese `container`, en la posición señalada durante el arrastre.
10. Arrastrar un nodo existente hacia la pestaña activa de un `tabs` que ya tiene al menos un hijo lo reanida
    correctamente dentro de esa pestaña.
11. Arrastrar un nodo existente hacia un `accordion` o `form` que ya tiene al menos un hijo lo reanida correctamente.
12. Arrastrar un nodo existente hacia un destino situado antes de su posición original dentro de la misma colección de
    hermanos (y viceversa, hacia un destino situado después) reanida correctamente sin excepciones ni resultados en una
    posición distinta a la señalada.
13. Ninguno de los casos anteriores dispara un error no controlado ni deja el `layout` en un estado sin cambios cuando
    el destino señalado durante el arrastre era válido.

## Casos límite

- `container` en modo grid con columnas responsive (mapa por breakpoint) y arrastre en curso: el orden debe mantenerse
  correcto en cualquier breakpoint activo.
- `container` en modo grid vacío (placeholder) al que se le añade el primer hijo: debe posicionarse correctamente sin
  depender de zonas de drop previas.
- `tabs` con una única pestaña: "Quitar" debe quedar bloqueado o sin efecto, sin excepción ni estado inconsistente.
- Arrastrar un nodo hacia sí mismo o hacia uno de sus propios descendientes sigue tratándose como destino inválido (
  regla ya vigente, sin cambios).
- Arrastrar el primer hijo de una colección hacia el final de esa misma colección (y viceversa) reanida en la posición
  correcta sin duplicar ni perder nodos.
- Reanidar un nodo existente dentro de la pestaña actualmente activa de un `tabs` que tiene varias pestañas: el nodo
  debe aparecer en la pestaña visible en el momento del drop, no en otra.

## Riesgos o preguntas abiertas

Ninguna pregunta bloqueante pendiente tras la fase de aclaración.

## Áreas de producto afectadas (alto nivel)

- Editor visual de configuración en modo desarrollo (`development/dev-mode-editor.md`), específicamente el modo Editor
  del canvas: render de `container` en modo grid, panel de propiedades del nodo `tabs`, y mecánica de arrastre para
  reanidar nodos existentes.

## Documentación probablemente afectada (alto nivel)

- `ai-workflow/docs/app-features/development/dev-mode-editor.md`: puede necesitar una nota aclaratoria sobre la
  exclusión de `children` en el panel de propiedades de `tabs` y sobre el comportamiento correcto de reanidación por
  arrastre, si no queda ya implícito en el texto vigente.
