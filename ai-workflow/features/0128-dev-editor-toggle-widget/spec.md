# Spec — 0128 dev-editor-toggle-widget

## Objetivo
Crear un nuevo widget reutilizable de alternancia (segmentos tipo píldora) para el panel de propiedades del
editor visual (dev mode), y aplicarlo en tres sitios del catálogo de nodos para mejorar la edición de props hoy
genéricas o sin edición dedicada:
- `container`: alternancia entre "Grid" y "Columnas" para decidir si el contenedor usa `props.columns` (modo
  grid) o su comportamiento por defecto de apilado vertical.
- `heading`: selector de nivel con cinco segmentos fijos (H1–H5) que sustituye el campo numérico genérico de
  `props.level`.
- `tabs`: alternancia entre "Horizontal" y "Vertical" para `props.orientation`.

Los tres usos comparten el criterio de encajar bien en un control de segmentos tipo píldora: catálogo cerrado y
estable de 2 a 5 opciones.

### Referencia visual
Figma, archivo "render-engine", frame "columnas/grid": https://www.figma.com/design/HWPhfM5JqJovx8wyFTqaMY/render-engine?node-id=3-29

El mock fija el lenguaje visual base (contenedor tipo píldora, un segmento por opción, segmento activo resaltado
con fondo/borde propio, icono opcional a la izquierda de cada etiqueta) para el caso "Grid"/"Columnas". El widget
de nivel de heading (H1–H5) no tiene mock propio en Figma; reutiliza el mismo lenguaje visual sin icono por
segmento (ver Requisitos funcionales).

## Alcance
- Nuevo componente reutilizable de alternancia (segmentos tipo píldora) en el panel de propiedades del editor
  visual (dev mode), compartido entre los tres usos siguientes, sin duplicar su lógica de resaltado/commit.
- Integración en `container`: widget de dos segmentos ("Grid" / "Columnas") en la subsección `Props`, que decide
  la presencia de `props.columns`.
- Integración en `heading`: widget de cinco segmentos ("H1".."H5") en la subsección `Props`, que sustituye el
  campo numérico genérico de `props.level`.
- Integración en `tabs`: widget de dos segmentos ("Horizontal" / "Vertical") en la subsección `Props`, que
  sustituye el campo genérico de `props.orientation`.
- Iconos Lucide en los segmentos de `container` ("Grid" / "Columnas") y de `tabs` ("Horizontal" / "Vertical"); los
  segmentos de `heading` no llevan icono, solo etiqueta de texto.

## Fuera de alcance
- Cambios al contrato JSON del runtime (`container.props`, `heading.props.level`, `tabs.props.orientation`) o a
  su validación (`runtime-config-zod.ts`) — el widget solo cambia cómo se edita un valor ya válido en el schema
  existente.
- Cualquier cambio de comportamiento en producción o en modo Visual del editor — exclusivo del panel de
  propiedades en modo Editor.
- Edición de `direction: row` u otras combinaciones lineales de `container` — sigue disponible por los mecanismos
  ya existentes del panel (campo genérico) o desde Monaco; el widget de este spec solo cubre la alternancia
  Grid/Columnas.
- Representación de `heading.props.level` igual a `6` en el widget — nivel no cubierto por los cinco segmentos;
  sigue editable solo desde Monaco (ver Riesgos).
- Icon picker general reutilizable para otros nodos o props — los iconos de este widget son fijos por segmento,
  no un selector de icono libre.
- Otros props con catálogo cerrado identificados como candidatos pero descartados para esta feature por tener
  un catálogo que puede crecer en el futuro (lo que dejaría el widget de segmentos con demasiadas opciones o
  desbordado): `container.props.variant`, `container.props.justify`/`align`, `stat.props.variant`,
  `divider.props.variant`, `skeleton.props.variant`, `badge.props.variant`, variante de paginación de
  tabla/repeater. Quedan como candidatos para una feature futura independiente, no para esta.
- Cualquier otro nodo o prop además de `container` (Grid/Columnas), `heading` (nivel) y `tabs` (orientación) — el
  resto del catálogo no se ve afectado.

## Requisitos funcionales

### Widget reutilizable de alternancia
- Nuevo control visual reutilizable en el panel de propiedades: una fila de segmentos dentro de un contenedor
  tipo píldora, un segmento por opción, con el segmento activo resaltado visualmente frente a los inactivos.
- Cada segmento admite, opcionalmente, un icono Lucide a la izquierda de su etiqueta de texto.
- Seleccionar un segmento distinto del activo aplica inmediatamente el cambio correspondiente al config en
  memoria, siguiendo el mismo pipeline de commit y validación (`validateRuntimeConfig`) ya vigente para el resto
  de campos del panel.

### Uso en `container`: alternancia Grid / Columnas
- La subsección `Props` de un `container` muestra este widget con dos segmentos: "Grid" y "Columnas", cada uno
  con su icono Lucide correspondiente.
- El segmento activo se detecta a partir de la forma actual del nodo: `props.columns` presente (fijo o
  responsive) → "Grid" activo; `props.columns` ausente → "Columnas" activo.
- Seleccionar "Grid" desde "Columnas" añade `props.columns` con el valor por defecto `2` (entero fijo).
- Seleccionar "Columnas" desde "Grid" quita `props.columns` por completo, dejando el contenedor en su
  comportamiento por defecto ya documentado (apilado vertical), sin tocar `direction` si el nodo ya lo declaraba.
- El campo/widget ya existente para editar el valor concreto de `props.columns` (cantidad de columnas o mapa
  responsive) sigue disponible y visible solo cuando el segmento activo es "Grid".

### Uso en `heading`: selector de nivel
- La subsección `Props` de un `heading` sustituye el campo numérico genérico de `props.level` por este widget
  con cinco segmentos: "H1", "H2", "H3", "H4", "H5", mapeados a los valores enteros `1` a `5`.
- El segmento activo es el que coincide con el valor actual de `props.level`; si el valor actual es `6` o
  cualquier otro fuera de `1..5`, ningún segmento aparece activo.
- Seleccionar un segmento fija `props.level` al entero correspondiente.
- Los segmentos de este widget no muestran icono, solo su etiqueta de texto ("H1".."H5").

### Uso en `tabs`: orientación
- La subsección `Props` de un `tabs` sustituye el campo genérico de `props.orientation` por este widget con dos
  segmentos: "Horizontal" y "Vertical", cada uno con su icono Lucide correspondiente.
- El segmento activo se detecta a partir del valor actual de `props.orientation`; si el nodo no declara
  `orientation` (usa el default `"horizontal"` del runtime, ver [[../../docs/app-features/nodes/tabs.md]]), el
  widget muestra "Horizontal" activo.
- Seleccionar un segmento fija `props.orientation` al valor literal correspondiente (`"horizontal"` o
  `"vertical"`).

## Requisitos no funcionales
- El widget reutilizable se implementa como un único componente compartido entre los tres usos (`container`,
  `heading` y `tabs`), sin duplicar la lógica de segmentos/resaltado/commit entre las integraciones.
- Reutiliza el mismo mecanismo de extensión ya vigente para widgets dedicados del panel (hook `x-widget` sobre
  el schema, como ya hacen `choice-items` y `layout-span`), sin introducir un segundo mecanismo de registro.
- Un commit rechazado por validación sigue el mismo patrón ya documentado: el campo conserva el valor
  introducido, se muestra un aviso `role="alert"` con código/mensaje, y se limpia al guardar correctamente o al
  cambiar de nodo seleccionado.
- Los segmentos deben ser operables por teclado y con semántica accesible adecuada (roles/estados de selección
  coherentes con un control de tipo tab/radio-group), reutilizando patrones ya establecidos en el panel.
- Debe mantenerse el umbral mínimo global de cobertura de tests del 80% sobre `src/`.
- Sin cambios de comportamiento observable en producción ni en modo Visual del editor.

## Criterios de aceptación
1. Seleccionar un `container` sin `props.columns` muestra el widget con "Columnas" activo.
2. Seleccionar un `container` con `props.columns` declarado (fijo o responsive) muestra el widget con "Grid"
   activo.
3. Pulsar "Grid" en un `container` sin `columns` añade `props.columns: 2` y muestra el campo/widget existente de
   columnas.
4. Pulsar "Columnas" en un `container` con `columns` declarado quita `props.columns` por completo y oculta el
   campo/widget de columnas; `direction`, si existía, no cambia.
5. Seleccionar un `heading` con `props.level` entre `1` y `5` muestra el widget con el segmento correspondiente
   activo, y el campo numérico genérico de `level` ya no aparece.
6. Seleccionar un `heading` con `props.level` igual a `6` (o fuera de `1..5`) muestra el widget sin ningún
   segmento activo.
7. Pulsar un segmento H1–H5 fija `heading.props.level` al entero correspondiente.
8. Un commit rechazado por validación en cualquiera de los tres usos conserva el estado visual introducido y
   muestra el aviso `role="alert"` ya documentado, sin modificar el config aplicado.
9. El resto del comportamiento ya documentado del panel de propiedades (sincronización con Monaco, guardia de
   cambios aplicados, exclusión mutua con el panel de Monaco) sigue funcionando sin regresión al usar este
   widget en los tres usos.
10. Seleccionar un `tabs` sin `props.orientation` declarado (default `horizontal`) muestra el widget con
    "Horizontal" activo.
11. Seleccionar un `tabs` con `props.orientation: "vertical"` muestra el widget con "Vertical" activo.
12. Pulsar el segmento contrario al activo en el widget de `tabs` fija `props.orientation` al valor literal
    correspondiente.

## Casos límite
- Un `container` con `props.columns` como mapa responsive (no entero fijo): el widget sigue detectando "Grid"
  como activo; alternar a "Columnas" y de vuelta a "Grid" no restaura el mapa anterior, siembra de nuevo el
  valor por defecto `2` como entero fijo (mismo patrón de reconstrucción desde cero que ya usa el selector de
  modo de contenido de `link`).
- Un `heading` con `props.level` igual a `6`: ningún segmento activo; fijar ese nivel solo es posible desde
  Monaco, no desde este widget (ver Riesgos).
- Cambiar de nodo seleccionado mientras hay un aviso de commit rechazado pendiente en el widget: el aviso se
  descarta al cambiar de selección, igual que el resto de campos del panel.
- Un `container` con `direction: row` y sin `columns`: el widget muestra "Columnas" activo (por ausencia de
  `columns`), sin indicar visualmente que además usa `direction: row`; ese campo sigue editable por separado,
  fuera de este widget.
- Un `tabs` sin `props.orientation` declarado: el widget se muestra con "Horizontal" activo (por el default
  documentado del nodo), y seleccionar "Horizontal" de nuevo no introduce la clave explícitamente si ya no
  estaba (comportamiento a fijar en implementación sin cambiar el resultado observable: ambos casos son
  equivalentes para el runtime).

## Riesgos o preguntas abiertas
- `heading.props.level` igual a `6` (o cualquier valor fuera de `1..5`) no tiene representación en el widget: el
  usuario debe usar Monaco para fijarlo o para partir de un nodo con ese nivel. Limitación aceptada
  explícitamente al fijar cinco segmentos en vez de cubrir todo el rango `1..6`.
- Los iconos Lucide concretos para "Grid"/"Columnas" y para "Horizontal"/"Vertical" se terminan de fijar como
  detalle de implementación en `generate-implementation-plan`, sin que esto cambie el comportamiento ya fijado
  en esta spec.
