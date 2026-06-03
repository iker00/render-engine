> Cuándo leer: nodo `modal` para mostrar contenido en ventana flotante, acciones `openModal` y `closeModal` en botones, ciclo de vida y estado de apertura.
> Tamaño: medio.
> Relacionados: [[button.md]], [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[form.md]].

# `modal`

## Contrato (props del nodo)
- `id`: string obligatorio, único en toda la configuración.
- `props.size`: string opcional con catálogo cerrado `sm | md | lg`; valor default `md` cuando no se declara.
- `props.defaultOpen`: boolean opcional; cuando `true`, el modal se abre al entrar a la página que lo contiene; default `false`.
- `props.label`: string opcional. Si se declara, se aplica como `aria-label` del panel del diálogo; si no se declara, el panel recibe el fallback literal `aria-label="Diálogo"`.
- `children`: colección ordenada de nodos hijos; admite `container`, `form`, `heading`, `paragraph`, `list`, `image`, `table`, `button`, `repeater` y `accordion`.

## Reglas de render
- `modal` renderiza un overlay semitransparente que cubre el viewport y un panel flotante centrado superpuesto al contenido de fondo.
- Solo puede haber un modal abierto a la vez. Abrir un modal mientras hay otro ya abierto cierra el anterior automáticamente.
- Tres mecanismos cierran el modal: pulsar ESC, hacer clic en el overlay exterior y ejecutar una acción `closeModal` desde un botón.
- `props.size` traduce a tres anchos visuales diferenciados: `sm` (estrecho), `md` (estándar) y `lg` (ancho).
- `props.defaultOpen: true` abre el modal automáticamente al entrar a la página, sin interacción previa del usuario.
- Un `form` dentro de `modal` mantiene exactamente el mismo ciclo de vida, reglas de validación y semántica de submit que cualquier otro `form` del runtime.
- El foco se atrapa dentro del panel mientras está abierto; al cerrar, se restaura el foco al elemento que lo tenía antes de abrir.
- El contenido de fondo queda bloqueado de interacción mientras el modal está abierto.
- `modal` soporta `node.visibility` y `node.queryStateFeedback` con la misma semántica que el resto de nodos. Si queda oculto, no se renderiza ni puede abrirse.
- El panel del modal renderiza `role="dialog"` y `aria-modal="true"` para comunicar a los lectores de pantalla que se trata de un diálogo modal. El nombre accesible se obtiene de `props.label` cuando está declarado; si no, se aplica el fallback `aria-label="Diálogo"`. El valor de `props.label` es un string literal (no admite interpolación dinámica).

## Comportamiento en `repeater.props.template`
- Cada iteración del repeater genera su propia instancia de modal con estado de apertura independiente.
- Un botón dentro del template que dispara `openModal` abre solo la instancia de modal de su iteración.
- La resolución del modal correcto es implícita por contexto, igual que ocurre con `item.*` en otros nodos descendientes del template.
- La regla global "solo un modal abierto a la vez" sigue aplicándose entre todas las iteraciones: abrir el modal de la fila 3 cierra cualquier modal de otra fila que estuviera abierto.
- Las referencias `item.*` dentro de los `children` del modal resuelven el item de su iteración.
- `props.defaultOpen: true` **no es soportado** cuando el modal se declara dentro de `repeater.props.template`.

## Validación específica
- Si `modal.id` se repite en cualquier página o en la misma página, el config completo se rechaza antes del render.
- Si `props.size` recibe un valor fuera de `sm | md | lg`, el config completo se rechaza antes del render.
- Si `props.defaultOpen` recibe un valor no booleano, el config completo se rechaza antes del render.
- Si `props.label` recibe un valor no string (número, boolean, objeto), el config completo se rechaza antes del render.
- Una acción `openModal.modalId` o `closeModal.modalId` que apunta a un `id` inexistente rechaza el config completo antes del render.
- `props.defaultOpen: true` dentro de `repeater.props.template` (a cualquier profundidad) rechaza el config completo antes del render.
- Si `modal.children` contiene nodos fuera de `container`, `form`, `heading`, `paragraph`, `list`, `image`, `table`, `button`, `repeater` y `accordion`, el config completo se rechaza antes del render.

## Acciones de botón relacionadas
- [[button.md#openmodal]] — abre el modal referenciado por `modalId`.
- [[button.md#closemodal]] — cierra el modal referenciado por `modalId`.

## Casos límite
- **Modal sin `children`**: válido; renderiza un panel vacío.
- **`closeModal` sobre un modal ya cerrado**: no produce efecto ni error visible.
- **`defaultOpen: true` + `visibility: false` al cargar**: el modal no se renderiza; la visibilidad tiene precedencia sobre `defaultOpen`.
- **Botón fuera del modal que cierra ese modal**: válido; la acción `closeModal` funciona desde cualquier ubicación.
- **`form` con `persistOnUnmount: false` dentro de `modal`**: al cerrar el modal el formulario mantiene su estado si el nodo modal sigue en el árbol; al navegar a otra página el formulario pierde estado según el comportamiento habitual.
- **Navegar a otra página**: todos los modales se cierran automáticamente.
- **Modal sin `props.label` y sin heading hijo**: el fallback `aria-label="Diálogo"` garantiza nombre accesible siempre.
- **Modal dentro de `repeater`**: cada instancia de modal tiene su propio panel con `role="dialog"` y el mismo `aria-label` derivado de `props.label` o del fallback.
