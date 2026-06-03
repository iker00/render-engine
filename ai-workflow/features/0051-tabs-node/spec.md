# Spec: `tabs` node (0051)

## Objetivo

Añadir un nuevo nodo declarativo `tabs` al catálogo del runtime que organiza contenido en paneles navegables por pestañas, con soporte de orientación horizontal y vertical, como nodo estructural de primera clase del runtime.

## Alcance

- Nuevo nodo `tabs` en el catálogo del runtime y en la validación previa al render.
- Props:
  - `props.orientation: "horizontal" | "vertical"` — orientación de la barra de tabs; por defecto `"horizontal"`.
  - `props.items: Array<{ label: string, children: Node[] }>` — cada item declara la etiqueta del tab y los nodos de su panel.
  - `props.defaultTab: number` — índice 0-basado del tab activo al montar; por defecto `0`.
- `label` soporta interpolación `{{...}}` con el sistema de referencias habitual del runtime.
- El tab activo es estado local del componente; no se expone al sistema de referencias ni al estado compartido del runtime.
- Solo el panel del tab activo se renderiza en el DOM; los demás no están presentes.
- Integración transversal estándar: `visibility`, `queryStateFeedback` y `layout.span` aplicados al nodo `tabs` completo.
- El nodo `tabs` puede aparecer en cualquier posición del árbol de layout, incluyendo dentro de `form`.

## Fuera de alcance

- Vinculación del tab activo a referencias declarativas del runtime (`queries.*`, `forms.*`).
- Control del tab activo mediante acciones UI (p. ej. `activateTab`).
- Visibilidad por tab individual — `visibility` solo aplica al nodo `tabs` completo.
- Tabs generados dinámicamente desde una colección de `queries.*`.
- Deshabilitar o cerrar tabs individuales.
- Persistencia del tab activo en navegación o `pageEntry`.
- Carga lazy de paneles (todos los paneles se declaran en el JSON de configuración).

## Requisitos funcionales

1. El nodo `tabs` declara sus paneles mediante `props.items`, un array donde cada item define `label` (string, soporta interpolación `{{...}}`) y `children` (array de nodos del catálogo).
2. `props.orientation` acepta `"horizontal"` (barra de tabs en la parte superior, contenido debajo) o `"vertical"` (barra de tabs a la izquierda, contenido a la derecha). El valor por defecto es `"horizontal"`.
3. `props.defaultTab` acepta un entero 0-basado que indica el panel activo al montar. El valor por defecto es `0`.
4. Al hacer clic en un tab de la barra, el panel correspondiente pasa a ser el activo y el anterior deja de estar en el DOM.
5. El estado del tab activo es local al componente y se reinicia al desmontarse.
6. Los `children` de cada item admiten cualquier nodo válido del catálogo, con las mismas reglas de composición que el resto del runtime (incluyendo `container`, `form`, `repeater`, nodos hoja, etc.).
7. El nodo `tabs` recibe y aplica `visibility`, `queryStateFeedback` y `layout.span` con la semántica transversal estándar del catálogo.

## Requisitos no funcionales

- Estilos implementados con utilidades de Tailwind CSS, sin estilos inline ni API visual configurable.
- Validación previa al render en `src/config/` rechaza contratos inválidos con diagnóstico de ruta explícita.
- La cobertura de tests no debe bajar del umbral global del 80% sobre `src/`.

## Criterios de aceptación

1. Un nodo `tabs` con `orientation: "horizontal"` muestra la barra de tabs en la parte superior y el panel activo debajo.
2. Un nodo `tabs` con `orientation: "vertical"` muestra la barra de tabs a la izquierda y el panel activo a la derecha.
3. Al hacer clic en un tab, el panel correspondiente aparece en el DOM y el anterior desaparece.
4. `props.defaultTab: 1` hace que el segundo tab sea el activo al montar.
5. Un label con `{{queries.someQuery.data.title}}` resuelve la referencia usando el sistema de interpolación del runtime.
6. `visibility` aplicado al nodo `tabs` oculta o muestra el nodo entero (barra + panel activo).
7. `queryStateFeedback` y `layout.span` aplicados al nodo `tabs` funcionan con la semántica estándar del runtime.
8. La validación previa rechaza `props.items` ausente o vacío.
9. La validación previa rechaza un item de `props.items` sin `label`.
10. La validación previa rechaza valores de `orientation` fuera del catálogo cerrado `"horizontal" | "vertical"`.
11. Un nodo `tabs` dentro de `form` se renderiza correctamente, permitiendo organizar campos de formulario en paneles.

## Casos límite

- Si `props.defaultTab` apunta a un índice fuera de rango, el runtime activa el primer tab (índice 0) sin error de runtime.
- Si `props.items` está vacío, el nodo no renderiza nada (degradación silenciosa, sin error de runtime).
- Si un item no declara `children` o lo declara como array vacío, el panel activo se muestra vacío.
- Si el nodo `tabs` tiene `visibility` que evalúa como oculto, ni la barra de tabs ni ningún panel se renderizan.
- Si `queryStateFeedback` está activo en un estado distinto de la rama principal, el nodo entero se sustituye por el feedback correspondiente.

## Áreas de producto afectadas

- Catálogo de nodos del runtime: nuevo nodo estructural `tabs`.
- Validación previa al render (`src/config/`): nuevo esquema y validaciones cruzadas.
- Dispatcher central de nodos (`src/runtime/`): registro del nuevo tipo.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/index.md`: añadir entrada `tabs.md` al catálogo.
- Nueva ficha `ai-workflow/docs/app-features/nodes/tabs.md`.

## Riesgos o preguntas abiertas

Ninguno. Las decisiones de producto y alcance quedan cerradas con esta spec.
