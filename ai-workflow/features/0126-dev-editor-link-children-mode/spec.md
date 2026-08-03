# Spec: modo "elementos anidados" para `link` en el editor visual

## Objetivo

Permitir que, en modo Editor del editor visual de desarrollo, un nodo `link` pueda pasar de contenido de texto (
`props.label`) a un subárbol de nodos anidados (`children`) y viceversa, y que ese subárbol se edite por arrastre
exactamente igual que ya ocurre con `container`/`form`. Hoy la paleta solo crea `link` en modo texto y no existe ningún
mecanismo en el editor para activar el modo `children`: aunque las reglas de destino de drop ya reconocen a `link` como
contenedor válido, la mutación que aplica un drop nunca retira `props.label`, así que el commit se descarta siempre por
violar la exclusión mutua del schema (`label`/`children`) — el usuario ve que "no pasa nada" al intentar soltar un nodo
dentro de un link.

## Alcance

- Panel de propiedades de `link` (tanto en la pestaña `Layout` como en la lista de acciones de `shell.header`, que
  reutiliza el mismo panel): nuevo selector de "Contenido" con dos opciones, "Texto" y "Elementos anidados".
- Conversión de contenido: cambiar de modo reconstruye el contenido del `link` desde cero (igual que ya ocurre al
  cambiar de variante de acción), sin conservar campos del modo anterior.
- Canvas del editor: un `link` en modo "Elementos anidados" sin hijos (`children: []`) muestra el mismo placeholder
  vacío, seleccionable y droppable, que ya tienen `container`/`form` vacíos.
- Arrastrar nodos del catálogo cerrado ya vigente para `link` (`container`, `heading`, `paragraph`, `list`, `image`,
  `badge`, `alert`, `stat`, `divider`, `skeleton`, de forma recursiva) para insertar, reordenar y reanidar dentro de un
  `link` en modo "Elementos anidados", reutilizando las reglas de destino de drop ya vigentes y documentadas.
- Cambio de contrato de producción: `link` con `children: []` deja de ser un estado rechazado por
  `validateRuntimeConfig` y pasa a ser válido, renderizando un `<a>` vacío. Este cambio no es exclusivo del editor: el
  editor valida con el mismo validador que la configuración de producción, así que la regla se relaja también para
  cualquier config de producción.

## Fuera de alcance

- Ampliar el catálogo cerrado de tipos hijo admitidos dentro de `link` (`LINK_ALLOWED_CHILD_TYPES`): sigue siendo
  exactamente el mismo que ya documenta `link.md`.
- Cambiar las reglas de destino de drop ya vigentes para `link` (ciclos, anidar `link` dentro de otro `link`, etc.): se
  reutilizan tal cual.
- Nueva entrada en la paleta de nodos para crear un `link` directamente en modo "Elementos anidados": la paleta sigue
  creando siempre un `link` en modo texto por defecto; el modo "Elementos anidados" se alcanza únicamente desde el
  selector de contenido del panel de propiedades tras la creación.
- Inyección automática de `rel="noopener noreferrer"`, theming del anchor, o cualquier otro punto ya marcado como fuera
  de alcance en `link.md` que esta feature no toca.
- Deshacer/rehacer de la conversión de modo: sigue sin existir, igual que el resto de mutaciones del canvas.
- Cambios a `props.href`, `props.download`, `props.target` o `props.action`: su comportamiento y validación son
  independientes del modo de contenido y no cambian.

## Requisitos funcionales

1. El panel de propiedades de un nodo `link` muestra un selector "Contenido" con las opciones "Texto" y "Elementos
   anidados". El modo activo se detecta por la forma actual del nodo: presencia de `props.label` → "Texto"; presencia de
   `children` → "Elementos anidados".
2. Elegir "Elementos anidados" desde modo "Texto" reconstruye el nodo desde cero: retira `props.label`, `props.icon` e
   `props.iconPosition`, y añade `children: []`. `props.href`/`props.download`/`props.target`/`props.action` no se
   tocan.
3. Elegir "Texto" desde modo "Elementos anidados" reconstruye el nodo desde cero: retira `children` (y todo su subárbol)
   y añade `props.label` con el mismo valor por defecto que usa la paleta al crear un `link` nuevo (`"Enlace"`), sin
   `props.icon`. `props.href`/`props.download`/`props.target`/`props.action` no se tocan.
4. Un `link` en modo "Elementos anidados" con `children: []` se renderiza en modo Editor con el mismo placeholder
   visible (borde punteado y etiqueta) que ya usan `container`/`form` vacíos: seleccionable y válido como destino de
   drop para insertar el primer hijo.
5. Arrastrar un nodo de la paleta o un nodo existente del árbol sobre el placeholder vacío de un `link`, o entre sus
   hijos ya existentes, inserta/reordena/reanida siguiendo exactamente las mismas reglas de destino de drop que ya
   documenta `dev-mode-editor.md` para `link` (catálogo cerrado de tipos hijo, prevención de ciclos, prevención de
   `link` anidado dentro de otro `link`).
6. Borrar el último hijo restante de un `link` en modo "Elementos anidados" (vía el botón "Eliminar nodo" del panel de
   propiedades del hijo seleccionado) deja al `link` con `children: []`, mostrando de nuevo el placeholder vacío del
   punto 4. El borrado nunca se bloquea ni revierte automáticamente a modo "Texto".
7. La validación previa al render (`validateRuntimeConfig`) deja de rechazar `link` con `children: []`. Esta regla se
   relaja de forma global, no solo para configs producidos desde el editor.
8. En producción (fuera del editor), un `link` con `children: []` se renderiza como un `<a>` sin contenido interior, con
   `href`/`action` funcionando exactamente igual que con cualquier otro contenido.
9. La paleta de nodos no cambia: sigue ofreciendo una única entrada `link` que crea el nodo en modo "Texto" con los
   mismos valores por defecto que hoy.

## Requisitos no funcionales

- El cambio de modo de contenido debe reflejarse de inmediato tanto en el contenido renderizado como en el buffer de
  Monaco, siguiendo el mismo pipeline de commit ya vigente para el resto de campos del panel de propiedades (
  `validateRuntimeConfig` antes de aplicar).
- Si el commit de un cambio de modo o de una operación de arrastre resultara inválido por cualquier motivo no cubierto
  explícitamente arriba, debe descartarse sin tocar el estado aplicado, igual que ya hace el resto del canvas.
- El selector de "Contenido" debe seguir el mismo patrón visual y de interacción que el selector de variante de acción
  ya existente (`button.props.action`, `link.props.action`, `form.submitAction`), para no introducir un segundo patrón
  de UI distinto para el mismo tipo de decisión.

## Criterios de aceptación

- Crear un `link` desde la paleta, cambiarlo a "Elementos anidados" desde el panel de propiedades, y arrastrar un
  `heading` sobre el placeholder vacío resultante inserta el `heading` como único hijo del `link`, visible tanto en el
  canvas como en Monaco.
- Con el `link` anterior ya con un hijo, arrastrar un segundo nodo permitido (p. ej. `paragraph`) entre las zonas de
  inserción disponibles lo añade en la posición esperada, sin alterar el primer hijo.
- Arrastrar un tipo no permitido (p. ej. `button`) sobre un `link` en modo "Elementos anidados" se rechaza visualmente
  durante el arrastre y no se acepta al soltar, igual que ya documenta `dev-mode-editor.md`.
- Cambiar un `link` con `children` poblados de vuelta a "Texto" descarta todo el subárbol y deja el nodo con
  `props.label: "Enlace"`, sin `children`.
- Borrar el único hijo restante de un `link` en modo "Elementos anidados" deja `children: []` y el placeholder vacío
  reaparece, sin que el borrado quede bloqueado.
- Aplicar desde Monaco un config con un `link` cuyo `children` sea `[]` ya no se rechaza; el runtime (fuera del editor)
  renderiza ese `link` como un anchor sin contenido.
- Un `link` con `children` poblados y `props.action: { type: 'navigateTo', pageId: '...' }` sigue calculando su `href`
  decorativo (`#/{pageId}`) igual que hoy, independientemente del modo de contenido.
- El resto del catálogo de nodos (`container`, `form`, `modal`, `accordion`, etc.) no cambia su comportamiento de
  edición.

## Casos límite

- Un `link` con `props.icon` + `props.label`: cambiar a "Elementos anidados" retira `icon` e `iconPosition` junto con
  `label`, sin dejar rastro de ninguno de los tres.
- Un `link` con `props.download` y/o `props.target` declarados junto a `props.href`: sobreviven sin cambios al alternar
  entre "Texto" y "Elementos anidados", en ambas direcciones.
- Un `link` con `props.action` (sin `props.href`): sobrevive sin cambios al alternar de modo; el `href` decorativo
  calculado en modo "Elementos anidados" con `children: []` sigue el mismo mecanismo ya documentado (`#/{pageId}` para
  `navigateTo`, historial canónico para `goBack`).
- Un `link` en modo "Elementos anidados" con un único hijo `divider` (caso ya aceptado hoy en producción): sigue
  aceptado; no hay cambio de comportamiento.
- Intentar anidar un `link` dentro de los `children` de otro `link` (directamente o a través de un `container`
  intermedio): sigue rechazado, sin cambios respecto a la regla ya vigente.
- Un `link` en modo "Elementos anidados" cuyo único hijo es un `container` con `variant: card` sin hijos propios: sigue
  aceptado, sin cambios respecto al caso ya documentado.
- Aplicar desde Monaco (no desde el canvas) un `link` que declare simultáneamente `props.label` y `children` sigue
  rechazado con el mismo diagnóstico ya vigente (`link nodes cannot have both props.label and children.`); esta feature
  no toca esa regla, solo la de `children: []`.
- Un `link` con `children: []` dentro de un `repeater.props.template`, o como hijo de un `tabItem`/cuerpo de
  `accordion`: se comporta igual que cualquier otro nodo vacío en esas posiciones, sin reglas especiales adicionales.

## Riesgos o preguntas abiertas

Ninguna pendiente: las tres decisiones de producto bloqueantes (mecanismo de activación del modo "Elementos anidados",
comportamiento al vaciar el último hijo, y relajación de la regla `children` vacío) se han resuelto en la fase de
aclaración de esta spec.

## Áreas de producto afectadas a alto nivel

- Nodo `link` (contrato JSON y validación previa al render).
- Editor de configuración en vivo — modo Editor, panel de propiedades, canvas del editor visual del layout.

## Documentación probablemente afectada a alto nivel

- `ai-workflow/docs/app-features/nodes/link.md` (regla de `children` vacío, casos límite).
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (selector de contenido de `link`, extensión del
  placeholder vacío a `link`).
