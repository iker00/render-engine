# Spec: 0106 — Indicador vertical y zonas de inserción intermedias en `container` grid (canvas modo Editor)

## Objetivo

Corregir la mecánica de arrastre del editor visual (`DevRuntime`, modo Editor) para un `container` con
`props.columns` (modo grid): (1) el indicador visual de las zonas de inserción límite ya existentes (antes del
primer hijo / después del último) debe mostrarse como una barra vertical, no como la franja horizontal de ancho
completo actual; (2) se deben añadir zonas de inserción intermedias entre cada par de hijos consecutivos de un
grid, hoy inexistentes, igualando la capacidad de reordenar/reanidar ya disponible en contenedores sin `columns`.
Ambos cambios deben respetar el invariante ya establecido por la feature 0105 (RF1): ninguna zona de inserción
puede alterar el orden ni la posición de columna/fila de los nodos reales respecto al modo Visual.

## Contexto

0105 corrigió que el orden visual de los hijos de un `container` grid en modo Editor no coincidiera con el modo
Visual. La solución adoptada fue renderizar únicamente las 2 zonas límite (antes del primer hijo, después del
último), forzadas a ocupar toda la fila del grid (`grid-column: 1 / -1`), evitando que una zona de inserción
compitiera por una celda real. Esto dejó una limitación conocida y documentada: no hay zona de inserción en
posición intermedia dentro de un grid (solo al principio o al final de la colección). Además, como esas 2 zonas
límite ocupan todo el ancho de la fila, su indicador visual (el `outline` que se aplica al arrastrar sobre ellas)
se percibe como una línea horizontal — algo confuso en un contenedor cuyos hijos se distribuyen en columnas
(lado a lado), donde una barra vertical comunica mejor la posición de inserción.

## Alcance

- Corregir el indicador visual de las 2 zonas límite ya existentes de un `container` en modo grid (antes del
  primer hijo, después del último) para que se muestren como una barra vertical, anclada al borde izquierdo del
  primer hijo o al borde derecho del último hijo según corresponda, con la altura de los elementos de la fila del
  grid donde se sitúan (no la altura completa del contenedor).
- Añadir zonas de inserción intermedias entre cada par de hijos consecutivos de un `container` en modo grid,
  mostradas también como barra vertical con la altura de la fila donde se ubican.
- Ninguna zona de inserción (límite o intermedia) debe desplazar la posición de columna/fila de los nodos reales
  respecto al modo Visual: se extiende el mismo invariante ya vigente desde 0105/RF1 a las nuevas zonas
  intermedias.
- Aplica tanto a `columns` fijo como a `columns` responsive por breakpoint (mapa `base`/`sm`/`md`/`lg`/`xl`/`2xl`).
- La estrategia técnica para posicionar estas zonas sin desplazar a los hijos reales (geometría real del grid, no
  solo posición ordinal en el array) se decide en la fase de diseño técnico (`generate-feature-design`), dado que
  existen varias estrategias razonables y el riesgo de reintroducir el bug de orden ya corregido en 0105 si se
  resuelve de forma ingenua.

## Fuera de alcance

- Cambios en el comportamiento de `container`, `tabs`, `form` o `accordion` en modo Visual/producción: el cambio
  es exclusivo del modo Editor.
- Cambios en las reglas de destino ya vigentes (qué tipos de nodo aceptan hijos, catálogo cerrado de `modal`/
  `link`, etc.): las nuevas zonas intermedias solo amplían las *posiciones* disponibles dentro de la misma
  colección de hermanos ya editable, no qué destinos son válidos.
- Cambios en el indicador de validez ya existente (`outline` verde/rojo según destino válido/inválido): se sigue
  aplicando igual, solo cambia la geometría del elemento sobre el que se aplica.
- Contenedores sin `columns` (flex/row o apilado vertical): sus zonas de inserción ya existen entre cada par de
  hijos y no cambian de comportamiento ni de orientación con esta feature.
- Deshacer/rehacer de operaciones del canvas (sigue fuera de alcance general del editor visual).
- Selección múltiple de nodos o cualquier otra capacidad no relacionada con estos dos defectos.
- Nuevas reglas de validación estructural para `container` o `columns`.

## Requisitos funcionales

### RF1 — Orientación vertical de las zonas límite en `container` grid

- En modo Editor, dentro de un `container` con `props.columns` (modo grid), la zona "antes del primer hijo" se
  muestra como una barra vertical anclada al borde izquierdo de la posición del primer hijo, con la altura de los
  elementos de la fila donde se sitúa ese primer hijo.
- La zona "después del último hijo" se muestra como una barra vertical anclada al borde derecho de la posición
  del último hijo, con la altura de los elementos de la fila donde se sitúa ese último hijo (que puede ser
  distinta a la de la primera fila si el grid ocupa varias filas).
- Un `container` sin `columns` (flex/row o apilado vertical) no cambia: sus zonas de inserción existentes
  mantienen su orientación y comportamiento actuales.

### RF2 — Zonas de inserción intermedias en `container` grid

- En modo Editor, un `container` en modo grid ofrece, además de las 2 zonas límite, una zona de inserción entre
  cada par de hijos consecutivos según el orden real del array (`N - 1` zonas intermedias adicionales para `N`
  hijos), igual que ya ocurre hoy en contenedores sin `columns`.
- Las zonas intermedias se muestran como barra vertical, con la altura de los elementos de la fila donde se
  ubican, posicionadas entre los dos hijos que separan.
- Insertar o reordenar un nodo sobre una zona intermedia produce el mismo resultado en el `layout` que insertar en
  esa misma posición ordinal hoy vía Monaco: el nodo pasa a ocupar exactamente ese índice dentro de la colección
  de hermanos.
- Ningún hijo real cambia de posición de columna/fila respecto al modo Visual como efecto colateral de que exista
  una zona de inserción intermedia (mismo invariante que RF1 de 0105, extendido a estas nuevas zonas).

### RF3 — Consistencia con reglas ya vigentes

- Las zonas de inserción de un `container` grid (límite e intermedias) quedan sujetas exactamente a las mismas
  reglas de destino ya vigentes para el resto del árbol (tipos de nodo aceptados, prohibición de soltar sobre uno
  mismo o un descendiente, etc.), sin duplicarlas de forma divergente.
- Tanto reanidar un nodo ya existente del árbol como insertar uno nuevo desde la paleta sobre una zona intermedia
  de un `container` grid producen resultados equivalentes en fiabilidad, consistente con el comportamiento ya
  corregido en 0105/RF3 para el resto de contenedores.

## Requisitos no funcionales

- Ninguno de los cambios debe modificar el comportamiento observable del runtime en modo Visual o en producción.
- Ninguno de los cambios debe modificar el contrato JSON de `container` ni su validación previa al render.
- Se debe mantener la sincronización bidireccional e inmediata ya vigente entre canvas y buffer de Monaco.
- Se debe conservar el umbral mínimo de cobertura de tests del proyecto (80% sobre `src/`).
- El cálculo de posición de las nuevas zonas intermedias no debe introducir un recálculo perceptiblemente costoso
  durante el arrastre (la interacción de drag debe seguir sintiéndose fluida con el número de hijos habitual de un
  `container`).

## Criterios de aceptación

1. Con un `container` de `props.columns: 3` y 5 hijos heterogéneos (2 filas), la zona "antes del primer hijo" se
   muestra como barra vertical junto al borde izquierdo del primer hijo, con la altura de los elementos de la
   primera fila.
2. En el mismo `container`, la zona "después del último hijo" se muestra como barra vertical junto al borde
   derecho del último hijo, con la altura de los elementos de la fila donde se sitúa ese último hijo.
3. El mismo `container` expone 4 zonas de inserción intermedias adicionales (una entre cada par de hijos
   consecutivos), además de las 2 zonas límite.
4. Arrastrar un nodo existente del árbol sobre una zona intermedia lo reanida/reordena en esa posición exacta, sin
   desplazar la posición de columna/fila del resto de hijos reales respecto al modo Visual.
5. Insertar un nodo nuevo desde la paleta sobre una zona intermedia de un `container` grid produce el mismo
   resultado que reordenar un nodo existente sobre esa misma zona.
6. El mismo `container`, alternado entre modo Visual y modo Editor sin ninguna edición intermedia, se ve
   visualmente idéntico salvo por los indicadores propios del modo Editor (selección, hover, zonas de drop).
7. Un `container` sin `columns` (flex/row o vertical) conserva el mismo número y orientación de zonas de inserción
   que tenía antes de esta feature.
8. Un `container` grid con `columns` responsive (mapa por breakpoint) mantiene el comportamiento correcto de RF1 y
   RF2 en cualquier breakpoint activo.
9. Ninguno de los casos anteriores dispara un error no controlado ni deja el `layout` en un estado inconsistente
   cuando el destino señalado durante el arrastre era válido.

## Casos límite

- `container` grid vacío (placeholder): sigue usando el placeholder de contenedor vacío ya existente (bloque con
  borde punteado), no una barra fina; no le aplica la orientación vertical/horizontal descrita en RF1/RF2.
- `container` grid con una sola fila (todos los hijos caben en la misma fila): las zonas límite e intermedias
  comparten la misma altura, la de esa única fila.
- `container` grid con varias filas por wrap: la zona entre el último hijo de una fila y el primer hijo de la fila
  siguiente conecta dos hijos que no están lado a lado visualmente. El tratamiento visual concreto de esta zona
  "de salto de fila" (p. ej. altura a usar, si se ancla a la fila de origen o a la de destino) se decide en la
  fase de diseño técnico; el requisito funcional que debe cumplirse pase lo que pase es que insertar ahí coloca el
  nodo exactamente en ese índice ordinal sin desplazar a ningún otro hijo real de posición.
- `container` grid con columnas responsive y arrastre en curso: el número, orientación y altura de las zonas deben
  mantenerse correctos en cualquier breakpoint activo, incluso si cambia el número de columnas efectivas.
- Arrastrar un nodo hacia sí mismo o hacia uno de sus propios descendientes sigue tratándose como destino inválido
  (regla ya vigente, sin cambios).
- Arrastrar el primer hijo de una colección grid hacia la última zona intermedia (o viceversa) reanida en la
  posición correcta sin duplicar ni perder nodos.

## Riesgos o preguntas abiertas

- La geometría exacta para posicionar zonas intermedias sin que participen como celdas propias del grid (evitando
  reintroducir el bug de orden corregido en 0105) admite varias estrategias técnicas razonables (por ejemplo,
  elementos superpuestos posicionados por medición real del layout, frente a otras formas de anclar la zona al
  borde del hijo adyacente sin ocupar su propia celda). Esta decisión se traslada a `generate-feature-design` antes
  de planificar tareas.
- El tratamiento visual de la zona "de salto de fila" en un grid con wrap (ver casos límite) queda como decisión
  de diseño técnico, no de producto: cualquier tratamiento visual razonable es aceptable siempre que cumpla el
  requisito funcional de posición ordinal correcta sin desplazar hijos reales.

## Áreas de producto afectadas (alto nivel)

- Editor visual de configuración en modo desarrollo (`development/dev-mode-editor.md`), específicamente el modo
  Editor del canvas: render de zonas de inserción de `container` en modo grid y su indicador visual durante el
  arrastre.

## Documentación probablemente afectada (alto nivel)

- `ai-workflow/docs/app-features/development/dev-mode-editor.md`: la sección "Reordenar y reanidar por arrastre
  (modo Editor)" describe hoy la limitación de solo 2 zonas límite en grid y la ausencia de posiciones intermedias;
  debe actualizarse para reflejar el nuevo comportamiento y retirar esa limitación conocida.
