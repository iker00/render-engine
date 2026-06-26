# Spec: link con children

## Objetivo

Permitir que el nodo `link` acepte `children` como alternativa a `props.label`, habilitando la creación de enlaces con contenido estructurado y visualmente rico en lugar de texto plano.

## Alcance

- El nodo `link` acepta un campo `children` al nivel del nodo (igual que `container`, `accordion`, etc.).
- `children` y `props.label` son mutuamente excluyentes: debe declararse exactamente uno de los dos.
- `props.icon` solo es aplicable cuando se usa `props.label`. Con `children`, `props.icon` no aplica y su presencia rechaza el config.
- Los nodos permitidos como `children` forman un subconjunto cerrado de nodos visuales no interactivos: `container`, `heading`, `paragraph`, `list`, `image`, `badge`, `alert`, `stat`, `divider`, `skeleton`.
- La restricción es recursiva: un `container` dentro de `children` de un `link` tampoco puede contener nodos prohibidos, y así en cualquier nivel de profundidad.
- Ambos modos de destino (`props.href` y `props.action`) siguen funcionando igual independientemente del modo de contenido (`label` o `children`).
- El resto del contrato del nodo `link` (visibilidad, `queryStateFeedback`, `layout.span`) no cambia.

## Fuera de alcance

- Nodos interactivos o con semántica propia conflictiva como children: `button`, `link`, `form`, `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `modal`, `file-manager`, `tabs`, `accordion`, `repeater`.
- `props.icon` con `children`.
- Más de un nivel de exclusión (no se abre una lista positiva diferente en cada nivel; la lista permitida es siempre la misma en cualquier nivel de profundidad).
- Ningún cambio en el comportamiento de navegación, resolución de referencias ni visibilidad del nodo.
- Ningún cambio visual (estilos, theming, variantes) en el propio anchor que envuelve los children.

## Requisitos funcionales

1. Si `children` está declarado, el nodo `link` se renderiza como `<a>` cuyo contenido son los nodos hijos renderizados en lugar de texto.
2. Si `children` está declarado, `props.label` no debe estar presente. Si ambos están presentes, el config se rechaza.
3. Si `children` está declarado, `props.icon` no debe estar presente. Si ambos están presentes, el config se rechaza.
4. Si ni `children` ni `props.label` están presentes, el config se rechaza (la exigencia de contenido sigue en pie).
5. Los nodos hijos permitidos son: `container`, `heading`, `paragraph`, `list`, `image`, `badge`, `alert`, `stat`, `divider`, `skeleton`. Cualquier otro tipo rechaza el config con diagnóstico de ruta exacta.
6. La restricción de tipos permitidos se aplica recursivamente: los descendants a cualquier nivel dentro de `children` también deben ser del subconjunto permitido.
7. Con `children`, el anchor sigue teniendo el mismo comportamiento de render que con `label`: `props.href` o `props.action` funcionan igual, incluidos `props.target`, `props.download` y el href decorativo de navegación interna.
8. La validación previa al render rechaza `children` con nodos fuera del subconjunto en cualquier nivel de profundidad.

## Requisitos no funcionales

- La validación recursiva de `children` debe seguir el mismo mecanismo que ya usan nodos estructurales del catálogo para validar sus children (reutilizar la infraestructura existente en `validate-layout-nodes`).
- El error de diagnóstico debe incluir la ruta exacta del nodo prohibido dentro de `children`.
- La cobertura de tests del nodo `link` tras esta feature debe mantenerse por encima del umbral global del proyecto (80% sobre `src/`).

## Criterios de aceptación

1. Un nodo `link` con `children` (subconjunto permitido, cualquier profundidad razonable) se renderiza como `<a>` con el contenido HTML de esos hijos.
2. Un nodo `link` con `children` y con `props.label` presente es rechazado en validación previa con diagnóstico de ruta.
3. Un nodo `link` con `children` y con `props.icon` presente es rechazado en validación previa con diagnóstico de ruta.
4. Un nodo `link` sin `children` ni `props.label` es rechazado en validación previa (comportamiento existente preservado).
5. Un nodo `link` con un hijo prohibido (p.ej. `button`) es rechazado con diagnóstico que incluye la ruta del nodo prohibido.
6. Un nodo `link` con un `container` que a su vez contiene un `button` es rechazado con diagnóstico de la ruta del `button`.
7. Un nodo `link` con `children` y `props.href` se renderiza con el `href` correcto en el anchor.
8. Un nodo `link` con `children` y `props.action: navigateTo` se renderiza con el href decorativo `#/{pageId}` y delega el clic al runtime igual que sin `children`.
9. `props.icon` con `props.label` sigue funcionando igual que antes (no regresión).
10. Un nodo `link` con `props.label` (sin `children`) funciona exactamente igual que antes de esta feature (no regresión completa).

## Casos límite

- **`children` vacío** (`children: []`): se rechaza en validación previa; el contenido del anchor no puede estar vacío.
- **`children` con un solo nodo `divider`**: se acepta (es del subconjunto permitido), aunque visualmente resulte en un anchor que solo contiene un divisor.
- **`children` con `container` sin hijos propios**: se acepta si el `container` no declara tipos prohibidos; el render produce un anchor con un contenedor vacío.
- **`children` con `skeleton`**: se acepta; el nodo `skeleton` es visual y no interactivo.
- **`container` dentro de `children` con `variant: card`**: se acepta; `variant` es una propiedad de presentación del `container`, no modifica las restricciones.
- **`repeater` dentro de `children`**: se rechaza con diagnóstico de ruta.
- **`link` dentro de `children` de otro `link`**: se rechaza (no se pueden anidar anchors en HTML; el tipo `link` está prohibido en children).
- **`props.download` con `children`**: se acepta si `props.href` está declarado (el comportamiento de `download` es independiente del contenido del anchor).
- **`props.target: "_blank"` con `children`**: se acepta; el comportamiento es idéntico al caso con `label`.

## Áreas de producto afectadas

- Nodo `link`: contrato, validación previa, render.
- Validación transversal de layout: extensión de la validación recursiva para contemplar el subconjunto de nodos permitidos en `children` de `link`.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/link.md`: actualizar contrato de props, comportamiento de render, validación y casos límite.
- `ai-workflow/docs/app-features/nodes/index.md`: actualizar la nota que describe `link` como nodo hoja (pasa a aceptar `children` condicionalmente).

## Riesgos o preguntas abiertas

Ninguno. El alcance está cerrado.
