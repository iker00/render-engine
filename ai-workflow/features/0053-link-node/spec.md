# Spec: `link` node

## Objetivo
Añadir un nodo `link` al catálogo del runtime que se renderiza como un elemento `<a>` HTML semántico. Permite enlazar a URLs externas, iniciar descargas de documentos o ejecutar navegación interna entre páginas del runtime, con el mismo modelo declarativo del resto de nodos del catálogo.

## Alcance
- Nuevo nodo `link` con `props.label`, `props.href`, `props.download`, `props.target` y `props.action`.
- `props.href`: URL de destino para enlaces externos o descargas; admite literal o referencia dinámica (`queries.*`, `item.*`, etc.).
- `props.download`: string opcional que activa el atributo `download` del anchor y fija el nombre de fichero sugerido al navegador.
- `props.target`: string opcional que se pasa directamente como atributo `target` del anchor (ej. `"_blank"`). Sin valor, el anchor no lleva atributo `target`.
- `props.action`: opcional; admite únicamente `navigateTo` y `goBack` con el mismo contrato que en `button`.
- Validación previa al render en `src/config/`, integrada con el pipeline de validación existente.
- Soporte de `visibility`, `queryStateFeedback` y `layout.span` como cualquier otro nodo del catálogo.
- Añadir `link` al dispatcher central de nodos del renderer.

## Fuera de alcance
- Acciones `executeOperation`, `resetForm`, `openModal`, `closeModal`: no aplican a `link`.
- `link` sin `action` no actúa como submit implícito dentro de `form` (a diferencia de `button`).
- `link` no puede ser nodo raíz de `form.submitAction`.
- Configuración avanzada de `rel` o comportamiento de seguridad: si se añade `target: "_blank"` sin `rel`, el runtime no inyecta automáticamente `rel="noopener noreferrer"` en v1. Queda fuera de esta spec.
- Theming o variantes visuales configurables.

## Requisitos funcionales

### Props del nodo
| Prop | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `props.label` | string | Sí | Texto visible del enlace. Admite literal, referencia dinámica completa o interpolación `{{...}}`. |
| `props.href` | string | Condicional | URL de destino. Obligatorio si no hay `props.action`. Admite literal o referencia dinámica completa. |
| `props.download` | string | No | Nombre de fichero sugerido. Solo aplicable si `props.href` está presente. Activa el atributo `download` del anchor. |
| `props.target` | string | No | Valor del atributo `target` del anchor. Solo aplicable si `props.href` está presente. Sin valor, no se añade atributo `target`. |
| `props.action` | objeto | Condicional | Acción de navegación interna. Obligatorio si no hay `props.href`. Solo `navigateTo` o `goBack`. |

### Contratos de acción
- `navigateTo`: mismo contrato que en `button` (`pageId` obligatorio, `params` opcional).
- `goBack`: sin parámetros adicionales.

### Comportamiento de render
- El nodo se renderiza siempre como `<a>`.
- Si `props.href` está presente: el anchor usa `href` resuelto. Si `props.download` está presente, se añade el atributo `download` con el nombre de fichero. Si `props.target` está presente, se añade el atributo `target`.
- Si `props.action` está presente (`navigateTo` o `goBack`): el anchor previene el comportamiento por defecto del navegador y delega en el ejecutor común de acciones del runtime. No lleva atributo `href` estático.
- `props.href` y `props.action` son mutuamente excluyentes: no pueden declararse simultáneamente.
- `props.download` y `props.target` solo son aplicables junto a `props.href`; si aparecen sin él, el config se rechaza antes del render.

## Requisitos no funcionales
- Estilos con utilidades de Tailwind CSS; sin estilos inline.
- La resolución de referencias dinámicas en `props.href` y `props.label` sigue el mismo mecanismo que el resto del runtime.
- El nodo es hoja: si recibe `children`, esos datos no pasan al resultado normalizado.

## Criterios de aceptación
1. Un `link` con `props.href` literal renderiza un `<a href="...">` con el texto de `props.label`.
2. Un `link` con `props.href` dinámico (`queries.*` o `item.*`) resuelve la referencia y renderiza la URL resultante como `href`.
3. Un `link` con `props.download` y `props.href` renderiza el anchor con atributo `download` igual al valor declarado.
4. Un `link` con `props.target: "_blank"` renderiza el anchor con `target="_blank"`.
5. Un `link` sin `props.target` no incluye atributo `target` en el DOM.
6. Un `link` con `props.action: navigateTo` navega internamente al hacer clic sin recargar la página.
7. Un `link` con `props.action: goBack` ejecuta navegación hacia atrás del runtime.
8. Un `link` con `props.action` no incluye atributo `href` estático en el DOM.
9. La validación previa rechaza un `link` sin `props.href` ni `props.action`.
10. La validación previa rechaza un `link` con `props.href` y `props.action` simultáneos.
11. La validación previa rechaza `props.download` o `props.target` sin `props.href`.
12. La validación previa rechaza un `link` con `props.action.type` distinto de `navigateTo` o `goBack`.
13. La validación previa rechaza `props.action.pageId` apuntando a una página inexistente (igual que `button`).
14. El nodo soporta `visibility`, `queryStateFeedback` y `layout.span` como cualquier otro nodo del catálogo.

## Casos límite
- `props.href` resuelto a referencia no disponible o vacía: el anchor se renderiza con `href=""` (degradación segura, sin error de render).
- `props.download` presente con `props.href` vacío resuelto: el atributo `download` se incluye igualmente; la degradación es responsabilidad del navegador.
- `props.action: goBack` en la primera página del historial del runtime: mismo comportamiento que el `button` con `goBack` (el runtime no tiene histórico anterior; no se produce error visible).
- `props.label` interpolado con referencia no disponible: vaciado del placeholder, igual que el resto de strings interpolados en el runtime.

## Riesgos o preguntas abiertas
- Ninguno bloqueante en esta fase. Si en la implementación se detecta que añadir `rel="noopener noreferrer"` automático cuando `target="_blank"` es un requisito de seguridad crítico, puede abrirse como alcance adicional antes de cerrar la tarea correspondiente.

## Áreas de producto afectadas
- Catálogo de nodos: nuevo nodo `link`.
- Validación de configuración: nuevo shape en `src/config/`.
- Dispatcher central del renderer: registro del nuevo tipo.
- Ficha funcional `nodes/link.md` en `ai-workflow/docs/app-features/nodes/`.
- Índice de nodos `nodes/index.md`.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/nodes/index.md`: añadir entrada `link`.
- Nueva ficha `ai-workflow/docs/app-features/nodes/link.md`.
- `ai-workflow/features/index.md`: mover `0053-link-node` a completadas al terminar.
