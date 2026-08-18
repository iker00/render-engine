# 0135 — Editor por-estado en acordeón para `queryStateFeedback` (F-C del rediseño)

## Objetivo

Tercera y última entrega del rediseño del panel de propiedades del editor visual (F-C, sucesora de
`0133-dev-editor-node-panel-tabs` [F-A] y `0134-dev-editor-property-field-widget-skin` [F-B]): sustituir el editor
genérico que hoy muestra la pestaña `Queries` para la subsección `queryStateFeedback` por un editor dedicado en formato
acordeón, con una fila por estado (`idle`/`loading`/`error`/`empty`/`success`) que se puede añadir o quitar
explícitamente, y dentro de cada fila un selector de modo (`Mostrar`/`Ocultar`/`Fallback`). No cambia el contrato JSON
de `queryStateFeedback`, su validación, ni el pipeline de commit ya vigente en el resto del panel.

Con esta entrega se cierra el rediseño en tres partes: F-A dejó la estructura en pestañas y el estilo base, F-B restiló
los widgets genéricos y dedicados existentes, y F-C reemplaza el último hueco — la pestaña `Queries`, que hasta ahora
seguía mostrando el editor genérico de objeto/array sin ningún tratamiento especial.

## Contexto del campo `queryStateFeedback`

Cualquier nodo soportado puede declarar opcionalmente
`queryStateFeedback: { query: string, states?: { idle?, loading?, error?, empty?, success? } }`. Cada clave presente en
`states` es una regla con exactamente un modo: `{ mode: 'show' }`, `{ mode: 'hide' }` o
`{ mode: 'fallback', fallback: LayoutNode[] }`. Una clave ausente usa el comportamiento implícito ya documentado:
`success → show`, el resto → `hide`. Ver `ai-workflow/docs/app-features/references/query-state-feedback.md` para el
detalle funcional completo (no cambia en esta feature).

`fallback` es un array de `LayoutNode[]` arbitrarios (el mismo catálogo recursivo que `layout`). Hoy no existe en el
editor visual ningún mecanismo capaz de mostrar o editar nodos de ese catálogo dentro de un campo de propiedades — el
dispatcher genérico solo sabe tratar tipos JSON Schema simples (string, number, boolean, enum, objetos/arrays de forma
conocida). Construir un editor de nodos embebido reutilizando el canvas de arrastrar-soltar es una decisión de alcance
mayor, deliberadamente diferida (ver "Fuera de alcance").

## Alcance

- Sustituir, dentro de la pestaña `Queries`, el editor genérico de la subsección `states` por un acordeón con una fila
  por estado.
- El campo `query` (nombre de la query observada) sigue siendo un campo de texto simple, con el mismo estilo de fila ya
  vigente desde F-A/F-B — sin cambios de comportamiento en esta entrega.
- Añadir y quitar filas de estado explícitamente (ver FR2/FR3).
- Selector de modo por fila con las tres opciones reales del contrato: `Mostrar`, `Ocultar`, `Fallback`.
- El modo `Fallback` es seleccionable y produce un commit válido, pero no ofrece en esta entrega ninguna forma de editar
  el contenido de `fallback` — ver FR5.
- Mismo pipeline de commit/validación y mismo criterio de aviso ante rechazo (`role="alert"`) que el resto del panel ya
  restilado.

## Fuera de alcance

- **Edición del contenido de `fallback`**: insertar, editar, reordenar o borrar los `LayoutNode[]` de un estado en modo
  `fallback`. Queda explícitamente diferido a una entrega futura; mientras tanto ese contenido solo se edita en Monaco,
  igual que hoy. Esta feature garantiza que la opción `Fallback` esté presente y sea seleccionable sin destruir
  contenido existente, pero no construye ningún editor de nodos.
- Convertir `query` en un selector/autocompletado sobre el catálogo de `api`/`preloads`: sigue siendo texto libre, igual
  que hoy.
- Cualquier cambio al contrato JSON de `queryStateFeedback`, a su validación (`validate-runtime-config` y afines) o a su
  semántica funcional en el runtime de producción (prioridad frente a `visibility`, tratamiento de `idle`, etc.).
- Reordenar las filas del acordeón por el usuario: el orden mostrado es siempre
  `idle → loading → error → empty → success`, fijo, con independencia del orden de declaración en el JSON.
- Cambios en otras pestañas (`Props`, `Diseño`, `Visibilidad`) o en otros paneles (`Shell`, `Traducciones`).
- Fidelidad pixel-perfect adicional contra el archivo de Figma más allá del lenguaje visual ya establecido por F-A/F-B:
  la API de Figma sigue con rate limit al escribir esta spec (mismo bloqueo que ya dejó constancia `0134/spec.md`), así
  que el acordeón se apoya en el lenguaje visual ya vigente (tarjeta, tipografía, espaciados) en vez de en una
  inspección literal del archivo.

## Requisitos funcionales

### FR1 — El acordeón sustituye al editor genérico de `states`

Con un nodo seleccionado que declara `queryStateFeedback` y la pestaña `Queries` activa, la subsección `states` se
muestra como un acordeón en vez de como el editor de objeto genérico actual. El campo `query` no cambia: sigue siendo la
primera fila de la pestaña, como campo de texto.

### FR2 — Filas explícitas, con alta bajo demanda

El acordeón muestra inicialmente solo una fila por cada clave que ya existe en `states` en el config actual, en el orden
fijo `idle → loading → error → empty → success`. Un control "Añadir estado" permite elegir, de entre las claves de
`states` que todavía no están presentes, cuál añadir. Añadir una clave la inserta con un modo inicial que reproduce el
comportamiento implícito ya vigente para ese estado (`success` → `Mostrar`; `idle`/`loading`/`error`/`empty` →
`Ocultar`), de forma que el commit resultante no cambia el comportamiento visible hasta que el usuario elija
explícitamente otro modo.

### FR3 — Quitar una fila

Cada fila tiene un control "Quitar" que borra esa clave de `states` (vuelve al comportamiento implícito para ese estado)
y hace desaparecer la fila del acordeón. Si `states` queda sin ninguna clave tras quitar la última fila, la clave
`states` se omite por completo del nodo en el config (no se deja un objeto vacío).

### FR4 — Selector de modo por fila

Cada fila expandida muestra un selector con las tres opciones `Mostrar`/`Ocultar`/`Fallback`, siempre las tres visibles
y seleccionables, reflejando el modo actual de esa regla. Cambiar de modo actualiza el estado en memoria y dispara el
mismo pipeline de commit que el resto del panel.

### FR5 — Modo `Fallback` presente pero inerte

Elegir `Fallback` en una fila es una acción válida: produce un commit con `{ mode: 'fallback', fallback: [...] }`. Si la
regla de esa fila ya tenía un array `fallback` (por ejemplo editado antes desde Monaco), ese array se preserva sin
cambios al pasar a este modo desde el acordeón. Si no existía ningún array previo, se usa `fallback: []`. Mientras el
modo `Fallback` está activo, la fila muestra un texto que indica que el contenido de fallback no se edita todavía desde
este panel (remite a Monaco), sin ningún control de inserción, edición o borrado de nodos.

### FR6 — Cambiar de modo no destruye `fallback` en frío

Cambiar el modo de una fila de `Fallback` a `Mostrar` u `Ocultar` y volver después a `Fallback` (sin pasar por Monaco
entretanto) conserva el mismo array `fallback` que tenía antes de salir de ese modo — el acordeón no lo vacía ni lo
reescribe mientras el usuario solo cambia de modo ida y vuelta dentro de la misma sesión de edición del nodo.

### FR7 — Commit y feedback de rechazo

Cada cambio (añadir/quitar fila, cambiar de modo) sigue el mismo pipeline de commit que el resto del panel (
`validateRuntimeConfig` antes de aplicar). Un commit rechazado conserva el cambio tal como lo dejó el usuario en el
acordeón (no revierte en silencio) y muestra el mismo aviso `role="alert"` ya usado en el resto del panel, con la misma
limpieza al reintentar con éxito o al cambiar de nodo.

### FR8 — Accesibilidad del acordeón

Cada fila es expandible/colapsable mediante un control con semántica de botón, `aria-expanded` reflejando su estado, y
operable por teclado (activación con `Enter`/`Espacio`, igual que cualquier botón nativo). El selector de modo dentro de
una fila expandida sigue las mismas convenciones de accesibilidad ya establecidas por los controles restilados en F-B (
rol y navegación coherentes con un control de elección acotada).

## Requisitos no funcionales

- El acordeón debe mantener el lenguaje visual ya establecido por F-A (`0133`) y F-B (`0134`) en el resto del panel
  restilado: tarjeta, tipografía y espaciados coherentes, sin introducir un lenguaje visual nuevo solo para esta
  pestaña.
- No debe empeorar el tiempo de commit ni introducir un patrón de validación distinto al ya usado en el resto del panel.
- La feature debe dejar explícitamente preparado el terreno para que una entrega futura añada edición de contenido
  `fallback` sin tener que rediseñar la estructura del acordeón (la fila en modo `Fallback` ya existe como punto de
  extensión).

## Criterios de aceptación

1. Un nodo con `queryStateFeedback.states` vacío o ausente muestra el acordeón sin ninguna fila y con el control "Añadir
   estado" disponible ofreciendo las 5 claves.
2. Un nodo con `states: { success: { mode: 'show' } }` muestra una única fila (`success`) ya presente, con modo
   `Mostrar` seleccionado; el resto de claves están disponibles para añadir.
3. Añadir la fila `error` con el control "Añadir estado" inserta `states.error = { mode: 'hide' }` en el config (
   comportamiento implícito preservado) y el commit se refleja en el contenido renderizado y en el buffer de Monaco.
4. Cambiar la fila `error` de `Ocultar` a `Mostrar` commitea `states.error = { mode: 'show' }` a través del pipeline
   real.
5. Cambiar la fila `error` a `Fallback` sin `fallback` previo commitea
   `states.error = { mode: 'fallback', fallback: [] }` y la fila muestra el texto de "no editable desde este panel
   todavía"; no aparece ningún control de edición de nodos.
6. Un nodo cuyo config ya trae
   `states.empty = { mode: 'fallback', fallback: [{ type: 'paragraph', props: { text: 'Sin datos' } } ] }` (editado
   previamente en Monaco) muestra la fila `empty` en modo `Fallback` con ese array intacto; cambiar el modo a `Ocultar`
   y volver a `Fallback` sin editar Monaco entre medias conserva ese mismo array.
7. Quitar la última fila presente en `states` hace que `queryStateFeedback` quede como `{ query: '...' }` sin la clave
   `states` en el config resultante.
8. Un commit rechazado (`validateRuntimeConfig` mockeada) al cambiar el modo de una fila conserva el modo elegido por el
   usuario en el acordeón y muestra el aviso `role="alert"`, con la misma limpieza que el resto del panel al reintentar
   con éxito o cambiar de nodo.
9. El campo `query` conserva su comportamiento actual (fila de texto simple, sin cambios) durante toda esta feature.

## Casos límite

- Un nodo con `queryStateFeedback` cuyo `query` está vacío o pendiente de rellenar (si esto es posible en el flujo
  actual del panel) no bloquea el acordeón de `states`: ambos campos son independientes.
- Un config con una clave de `states` que ya no es válida contra el schema actual (por ejemplo, un `mode` desconocido
  introducido a mano en Monaco) no debe romper el panel: se documenta y prueba el mismo criterio de degradación ya
  aplicado en F-B para valores fuera de catálogo (el panel sigue operativo; ese campo concreto puede quedar en un estado
  neutro hasta que el usuario lo corrija).
- Añadir las 5 claves posibles hace que el control "Añadir estado" quede sin opciones restantes (deshabilitado u oculto,
  a decidir en planificación de implementación) sin romper el resto del acordeón.
- Cambiar de nodo seleccionado mientras una fila está expandida no debe filtrar ese estado de expansión al nuevo nodo —
  mismo criterio de aislamiento por nodo que ya aplica al resto del panel (remount por `key`).

## Riesgos o preguntas abiertas

- **Edición de `fallback` diferida**: esta spec deja explícitamente sin resolver cómo se editará el contenido de
  `fallback` en el futuro (reutilizar el canvas de arrastrar-soltar, un editor JSON acotado, u otra alternativa). Cuando
  se aborde, probablemente necesitará su propia fase de `design.md` por la complejidad de reutilizar el mecanismo de
  canvas fuera del árbol principal de `layout`.
- **Fidelidad visual contra Figma**: la API de Figma seguía con rate limit al escribir esta spec (mismo bloqueo ya
  registrado en `0134/spec.md`); si al planificar la implementación el acceso ya está disponible y revela un tratamiento
  visual específico para esta pestaña, esta spec podría necesitar un ajuste menor de estilo (no de comportamiento).

## Áreas de producto afectadas

- Modo desarrollo local del editor visual (`development/`), específicamente el panel de propiedades y su pestaña
  `Queries`.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (sección del panel de propiedades / pestaña `Queries`,
  y la referencia cruzada a `query-state-feedback.md` si aplica).
