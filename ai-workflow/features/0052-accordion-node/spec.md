# Spec: `accordion` node (0052)

## Objetivo

Añadir un nuevo nodo declarativo `accordion` al catálogo del runtime que representa una única sección colapsable (cabecera + cuerpo). Varias instancias de `accordion` pueden coordinarse mediante un `groupId` compartido para garantizar que solo una esté expandida a la vez. Sin `groupId`, cada instancia es completamente independiente.

## Alcance

- Nuevo nodo `accordion` en el catálogo del runtime y en la validación previa al render.
- Props:
  - `props.label`: string obligatorio; texto visible de la cabecera. Soporta interpolación `{{...}}` con el sistema de referencias habitual del runtime.
  - `props.defaultOpen`: boolean opcional; si `true`, la sección arranca expandida. Default `false`.
  - `props.groupId`: string opcional. Si se declara, solo puede haber un `accordion` con el mismo `groupId` expandido a la vez en toda la página. Sin `groupId`, la instancia es independiente.
- `children`: colección ordenada de nodos hijos; admite cualquier nodo válido del catálogo (`container`, `form`, `heading`, `paragraph`, `list`, `image`, `table`, `button`, `repeater`, `modal`, `tabs`, `accordion`).
- El estado abierto/cerrado es local al componente y se reinicia al desmontarse.
- Integración transversal estándar: `visibility`, `queryStateFeedback` y `layout.span` aplicados al nodo `accordion` completo.
- El nodo `accordion` puede aparecer en cualquier posición del árbol de layout, incluyendo dentro de `form` y dentro de `repeater.props.template`.

## Fuera de alcance

- Acciones UI para abrir o cerrar un accordion desde un botón externo (`openAccordion`, `closeAccordion`).
- Exposición del estado abierto/cerrado al sistema de referencias del runtime (`queries.*`, `forms.*`).
- Animación o transición de apertura/cierre configurable desde JSON.
- Visibilidad o deshabilitación de la cabecera de forma independiente al nodo completo.
- Persistencia del estado abierto en navegación o `pageEntry`.
- Generación dinámica de ítems desde una colección de `queries.*` (forma multi-ítem).

## Requisitos funcionales

1. El nodo `accordion` renderiza siempre su cabecera (`props.label`) como área interactiva que el usuario puede pulsar para expandir o contraer el cuerpo.
2. Al pulsar la cabecera de un accordion cerrado, el cuerpo aparece en el DOM y el accordion queda expandido.
3. Al pulsar la cabecera de un accordion ya expandido, el cuerpo desaparece del DOM y el accordion queda cerrado (comportamiento toggle).
4. `props.defaultOpen: true` hace que el accordion arranque expandido sin interacción previa del usuario.
5. Cuando varios accordions comparten el mismo `props.groupId`, expandir uno colapsa automáticamente cualquier otro del mismo grupo que estuviera abierto. Solo puede haber uno expandido por grupo en todo momento.
6. Un accordion sin `props.groupId` abre y cierra de forma completamente independiente del resto de accordions de la página.
7. El estado del accordion es local al componente y se reinicia al desmontarse (p. ej., al navegar a otra página).
8. `props.label` soporta interpolación `{{...}}` con el sistema de referencias del runtime.
9. El nodo `accordion` recibe y aplica `visibility`, `queryStateFeedback` y `layout.span` con la semántica transversal estándar del catálogo.

## Requisitos no funcionales

- Estilos implementados con utilidades de Tailwind CSS, sin estilos inline ni API visual configurable.
- La cabecera debe ser semánticamente un elemento interactivo accesible (botón o elemento con `role="button"`) con atributo `aria-expanded` que refleja el estado abierto/cerrado.
- Validación previa al render en `src/config/` rechaza contratos inválidos con diagnóstico de ruta explícita.
- La cobertura de tests no debe bajar del umbral global del 80% sobre `src/`.

## Criterios de aceptación

1. Un accordion con `props.defaultOpen: false` (o sin declarar) arranca cerrado; al pulsar la cabecera se expande; al volver a pulsarla se contrae.
2. Un accordion con `props.defaultOpen: true` arranca expandido; al pulsar la cabecera se contrae.
3. Dos accordions con el mismo `props.groupId`: al expandir uno, el otro se contrae automáticamente.
4. Un accordion sin `props.groupId` puede estar expandido al mismo tiempo que cualquier otro accordion de la página.
5. Un `props.label` con `{{queries.someQuery.data.title}}` resuelve la referencia usando el sistema de interpolación del runtime.
6. `visibility` aplicado al nodo `accordion` oculta o muestra el nodo entero (cabecera + cuerpo).
7. `queryStateFeedback` y `layout.span` aplicados al nodo `accordion` funcionan con la semántica estándar del runtime.
8. La validación previa rechaza un `accordion` sin `props.label`.
9. La validación previa rechaza `props.defaultOpen` con un valor no booleano.
10. La validación previa rechaza `props.groupId` con un valor que no sea string.
11. Un accordion dentro de `form` renderiza correctamente y permite anidar campos de formulario en su cuerpo.
12. La cabecera del accordion expone `aria-expanded="true"` cuando está expandido y `aria-expanded="false"` cuando está contraído.

## Casos límite

- **Varios accordions del mismo grupo con `defaultOpen: true`**: solo el primero en orden de declaración en el JSON arranca expandido; los demás arrancan cerrados.
- **Un único accordion con `groupId`**: se comporta exactamente igual que sin `groupId`; el grupo de uno no impone restricción adicional.
- **Accordion sin `children` o con `children` vacío**: válido; al expandirse muestra el cuerpo vacío, sin error de runtime.
- **Accordion con `visibility` que evalúa como oculto**: ni la cabecera ni el cuerpo se renderizan; el estado abierto/cerrado no es relevante.
- **Accordion con `queryStateFeedback` en un estado distinto de la rama principal**: el nodo entero se sustituye por el feedback correspondiente; la cabecera no se muestra.
- **Accordion dentro de `repeater.props.template`**: cada iteración genera su propia instancia con estado independiente. Si declara `groupId`, todas las instancias de todas las iteraciones participan en el mismo grupo de página (expandir una fila puede colapsar una de otra fila con el mismo `groupId`).
- **Navegar a otra página**: todos los accordions pierden su estado local; al volver a entrar, aplica `defaultOpen` desde cero.

## Áreas de producto afectadas

- Catálogo de nodos del runtime: nuevo nodo estructural `accordion`.
- Validación previa al render (`src/config/`): nuevo esquema y validaciones cruzadas.
- Dispatcher central de nodos (`src/runtime/`): registro del nuevo tipo.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/index.md`: añadir entrada `accordion.md` al catálogo.
- Nueva ficha `ai-workflow/docs/app-features/nodes/accordion.md`.

## Riesgos o preguntas abiertas

Ninguno. Las decisiones de producto y alcance quedan cerradas con esta spec.
