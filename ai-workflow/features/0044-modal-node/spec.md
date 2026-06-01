# `0044-modal-node` — Nodo modal declarativo

## Objetivo

Añadir un nodo `modal` al catálogo del runtime que permita mostrar contenido en una ventana flotante superpuesta al contenido de la página, gestionada mediante acciones declarativas de botón y configurable con estado inicial de apertura por nodo.

## Alcance

- Nuevo nodo `modal` declarable en el árbol `layout` de cualquier página.
- Dos nuevas acciones de botón: `openModal` y `closeModal`, que referencian un modal por su `id`.
- Estado de apertura local al runtime: solo un modal abierto a la vez.
- Tres mecanismos de cierre: ESC, click en el overlay exterior, acción `closeModal`.
- Prop `defaultOpen` para que un modal cargue abierto en la entrada a la página.
- Catálogo cerrado de tamaños: `sm | md | lg` con `md` como valor por defecto.
- `form` es un nodo hijo válido dentro de `modal`, con la misma semántica de ciclo de vida que fuera.
- Extensión de la validación de config para `modal.id` únicos y referencias válidas desde `openModal.modalId` y `closeModal.modalId`.
- Soporte de `visibility` y `queryStateFeedback` como propiedades transversales del nodo.

## Fuera de alcance

- Stack de múltiples modales abiertos simultáneamente.
- Integración con el hash del navegador (deep-linking).
- Cierre automático del modal al completar el submit de un formulario interno.
- `modal` como hijo de `form.children`.
- `defaultOpen: true` en un modal declarado dentro de `repeater.props.template` (ambiguo cuando hay múltiples instancias).
- Theming o variantes visuales más allá del catálogo de `size`.
- Cabecera o pie de página como partes nombradas e independientes del nodo.

## Requisitos funcionales

### Contrato del nodo `modal`

- `id`: string obligatorio, único en toda la configuración.
- `props.size`: string opcional con catálogo cerrado `sm | md | lg`; default efectivo `md` cuando no se declara.
- `props.defaultOpen`: boolean opcional; cuando `true`, el modal se muestra abierto al entrar a la página que lo contiene; default `false`.
- `children`: colección ordenada de nodos hijos; admite `container`, `form`, `heading`, `paragraph`, `list`, `image`, `table`, `button` y `repeater`.
- El nodo `modal` puede declararse dentro de `repeater.props.template`.

### Acción `openModal`

- `action.type: "openModal"`.
- `action.modalId`: string obligatorio, referencia al `id` de un nodo `modal` declarado en la misma configuración.
- Abre el modal referenciado. Si ya hay otro modal abierto, lo cierra antes de abrir el nuevo.

### Acción `closeModal`

- `action.type: "closeModal"`.
- `action.modalId`: string obligatorio, referencia al `id` de un nodo `modal` declarado en la misma configuración.
- Cierra el modal referenciado si está abierto. Si el modal ya está cerrado, la acción no produce efecto ni error visible.

### Estado y ciclo de vida

- El estado de apertura del modal es local al runtime; no se persiste ni se sincroniza con el hash del navegador.
- Solo puede haber un modal abierto a la vez. Abrir un modal mientras hay otro ya abierto cierra el anterior.
- Al navegar a otra página, todos los modales se cierran.
- En cada entrada a una página, los modales con `defaultOpen: true` inician en estado abierto y los demás en estado cerrado.

### Mecanismos de cierre

- **ESC**: cierra el modal actualmente abierto.
- **Click en el overlay** (zona fuera del panel del modal): cierra el modal.
- **Acción `closeModal`**: cierra el modal referenciado mediante un botón.

### `form` dentro de `modal`

- Un nodo `form` como hijo de `modal` mantiene exactamente el mismo ciclo de vida, reglas de submit, reset y validación que cualquier otro `form` del runtime.
- Su `id` debe ser único en toda la configuración al igual que cualquier otro `form`.

### `modal` dentro de `repeater.props.template`

- Cada iteración del repeater genera su propia instancia de modal con estado de apertura independiente.
- Un botón dentro del template que llama `openModal` con un `modalId` abre la instancia del modal del item actual, no la de otras iteraciones. La resolución del item correcto es implícita por contexto, igual que ocurre con `item.*` en otros nodos descendientes del template.
- La regla "solo un modal abierto a la vez" sigue aplicándose globalmente: abrir el modal de la fila 3 cierra el de la fila 7 si estuviera abierto.
- Las referencias `item.*` dentro de los `children` del modal se resuelven en el contexto del item de su iteración, igual que en cualquier otro descendiente del template.
- `defaultOpen: true` no está soportado cuando el modal está dentro de `repeater.props.template`.

### Propiedades transversales

- `modal` soporta `node.visibility` y `node.queryStateFeedback` con la misma semántica que el resto de nodos.
- Si un `modal` con `defaultOpen: true` queda oculto por `visibility` o no alcanza su rama principal por `queryStateFeedback`, no se renderiza y no está abierto. Cuando la condición lo vuelve visible por primera vez en una entrada de página, se renderiza en estado abierto.

## Requisitos no funcionales

- El overlay y el panel del modal deben ser accesibles mediante teclado: foco atrapado dentro del panel mientras está abierto y cierre por ESC.
- El modal debe bloquear la interacción con el contenido de fondo mientras está abierto.
- El estilo del modal debe implementarse con utilidades de Tailwind CSS, sin estilos inline.

## Criterios de aceptación

1. Un botón con `action.type: "openModal"` y `action.modalId` válido abre el modal con ese `id` al hacer clic.
2. Un botón con `action.type: "closeModal"` y `action.modalId` válido cierra el modal referenciado al hacer clic.
3. Pulsar ESC cierra el modal actualmente abierto.
4. Hacer clic en el overlay cierra el modal.
5. Un modal con `defaultOpen: true` aparece abierto al cargar la página que lo contiene, sin interacción previa del usuario.
6. Al abrir un modal cuando hay otro ya abierto, el anterior se cierra y el nuevo se muestra.
7. Al navegar a otra página, el modal se cierra.
8. `props.size: "sm"`, `"md"` y `"lg"` producen paneles con anchura visible diferenciada.
9. Un `form` dentro de un modal puede enviarse con su `submitAction` sin diferencia funcional respecto a un formulario fuera del modal.
10. La configuración se rechaza antes del render si `modal.id` se repite en la misma configuración.
11. La configuración se rechaza antes del render si `openModal.modalId` o `closeModal.modalId` referencian un `id` que no existe en la configuración.
12. La configuración se rechaza antes del render si `props.size` recibe un valor fuera del catálogo `sm | md | lg`.
13. La configuración se rechaza antes del render si `props.defaultOpen` recibe un valor no booleano.
14. Un modal con `visibility` que evalúa a `false` no se renderiza y no puede abrirse.
15. El foco queda atrapado dentro del panel del modal mientras está abierto.
16. Un botón dentro de `repeater.props.template` que llama `openModal` abre solo el modal de su propia iteración.
17. Abrir el modal de la iteración N cierra el modal de la iteración M si estuviera abierto (regla global de uno a la vez).
18. Las referencias `item.*` dentro de los `children` de un modal dentro de repeater resuelven correctamente el item de su iteración.

## Casos límite

- **Modal sin `children`**: válido; muestra un panel vacío.
- **`closeModal` sobre un modal ya cerrado**: no produce efecto ni error visible.
- **`defaultOpen: true` + `visibility` que evalúa a `false` al cargar**: el modal no se renderiza; la visibilidad tiene precedencia sobre `defaultOpen`.
- **Botón con `closeModal` declarado fuera del modal que referencia**: válido; cierra ese modal si está abierto.
- **`form` con `persistOnUnmount: false` dentro de `modal`**: al cerrar el modal el formulario mantiene su estado si el nodo modal sigue en el árbol; al navegar a otra página el formulario pierde su estado según el comportamiento habitual de desmontaje.
- **`modal` con `defaultOpen: true` dentro de `repeater.props.template`**: no soportado; la configuración se rechaza antes del render.

## Áreas de producto afectadas

- **Catálogo de nodos**: nuevo nodo `modal`.
- **Catálogo de acciones de botón**: nuevas acciones `openModal` y `closeModal`.
- **Validación de config**: unicidad de `modal.id`, validez de referencias desde `openModal.modalId` y `closeModal.modalId`.
- **Estado del runtime**: nuevo dominio para el estado de apertura de modales.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/index.md`: añadir fila `modal.md`.
- `ai-workflow/docs/app-features/nodes/button.md`: añadir acciones `openModal` y `closeModal` al catálogo.
- `ai-workflow/docs/current-state.md`: actualizar última feature relevante del área de catálogo de nodos.

## Riesgos o preguntas abiertas

Ninguno.
