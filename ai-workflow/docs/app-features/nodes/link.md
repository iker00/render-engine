> Cuándo leer: si la tarea toca el nodo `link` — enlace declarativo que navega a URLs externas, inicia descargas o ejecuta navegación interna del runtime.
> Tamaño: medio.
> Relacionados: [[button.md]], [[../navigation/navigate-actions.md]], [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[../config/validation.md]].

# Nodo `link`

Nodo hoja que se renderiza siempre como un elemento `<a>` HTML semántico. Permite enlazar a URLs externas, iniciar descargas de documentos, o ejecutar navegación interna entre páginas del runtime mediante acciones declarativas. El destino se declara con `props.href` o con `props.action`; ambas formas son mutuamente excluyentes.

## Props

| Prop | Tipo | Requerido | Descripción |
|---|---|---|---|
| `props.label` | `string` | sí | Texto visible del enlace. Admite literal, referencia dinámica completa o interpolación `{{...}}`. |
| `props.href` | `string` | condicional | URL de destino. Obligatorio si no hay `props.action`. Admite literal o referencia dinámica completa (`queries.*`, `item.*`, etc.). |
| `props.download` | `string` | no | Nombre de fichero sugerido al navegador. Activa el atributo `download` del anchor. Solo aplicable junto a `props.href`. |
| `props.target` | `string` | no | Valor del atributo `target` del anchor (p.ej. `"_blank"`). Solo aplicable junto a `props.href`. Sin valor, el anchor no lleva atributo `target`. |
| `props.action` | objeto | condicional | Acción de navegación interna. Obligatorio si no hay `props.href`. Solo acepta `navigateTo` o `goBack`. |

## Campos transversales

- `visibility`: oculta o muestra el nodo. Si evalúa como oculto, el anchor no se renderiza.
- `queryStateFeedback`: sustituye el nodo por el feedback correspondiente cuando el estado de la query no es la rama principal.
- `layout.span`: ocupa columnas dentro de un `container` con `columns` activo.

## Contratos de acción

Solo se permiten dos tipos de acción en `props.action`:

### `navigateTo`
- `props.action.pageId`: string obligatorio y no vacío. Debe apuntar a una página existente en `pages`.
- `props.action.params`: objeto plano opcional con claves no vacías y valores `string | number | boolean | null`.

### `goBack`
Sin parámetros adicionales. Ejecuta navegación hacia atrás del runtime.

## Comportamiento de render

- El nodo se renderiza siempre como `<a data-layout-node="link">`.
- Si `props.href` está presente: el anchor usa el valor resuelto como atributo `href`. Si `props.download` está declarado, se añade el atributo `download` con el nombre de fichero. Si `props.target` está declarado, se añade el atributo `target`.
- Si `props.action` está presente: el anchor previene el comportamiento por defecto del navegador al hacer clic y delega en el ejecutor común de acciones del runtime (`executeRuntimeUiAction`). No lleva atributo `href` estático en el DOM.
- `props.label` y `props.href` se resuelven como referencias de texto dinámicas con el mismo mecanismo que el resto del runtime (`resolveRuntimeTextReference`).
- El nodo es hoja: si recibe `children` en la configuración, esos datos no pasan al resultado normalizado.

## Casos límite

- **`props.href` resuelto a referencia no disponible o vacía**: el anchor se renderiza con `href=""`. La degradación es segura y no produce error de render.
- **`props.download` con `props.href` vacío resuelto**: el atributo `download` se incluye igualmente; la degradación es responsabilidad del navegador.
- **`props.action: goBack` en la primera página del historial del runtime**: mismo comportamiento que `button` con `goBack`; el runtime no tiene histórico anterior y no produce error visible.
- **`props.label` interpolado con referencia no disponible**: el placeholder se vacía, igual que en el resto de strings interpolados del runtime.
- **`target: "_blank"` sin `rel`**: en v1 el runtime no inyecta automáticamente `rel="noopener noreferrer"`.

## Validación previa al render

- `props.label` es obligatorio. Rechazo con diagnóstico `{path}.props.label`.
- `props.href` y `props.action` son mutuamente excluyentes. Si se declaran ambos, el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}`.
- Debe declararse al menos uno de `props.href` o `props.action`. Si ninguno está presente, el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}`.
- `props.download` sin `props.href` rechaza el config con `invalid-layout` y diagnóstico `{path}.props.download`.
- `props.target` sin `props.href` rechaza el config con `invalid-layout` y diagnóstico `{path}.props.target`.
- `props.action.type` distinto de `navigateTo` o `goBack` rechaza el config con `invalid-layout` y diagnóstico `{path}.props.action.type`.
- `props.action.pageId` apuntando a una página inexistente rechaza el config con `invalid-layout`, igual que en `button`.
- `props.action` de tipo `navigateTo` sin `pageId` rechaza el config con `invalid-layout`.
- `visibility`, `queryStateFeedback` y `layout.span` siguen el contrato transversal estándar.

## Lo que está fuera de alcance (v1)

- Acciones `executeOperation`, `resetForm`, `openModal`, `closeModal`: no aplican a `link`.
- `link` sin `action` no actúa como submit implícito dentro de `form`.
- `link` no puede ser nodo raíz de `form.submitAction`.
- Inyección automática de `rel="noopener noreferrer"` cuando `target="_blank"`.
- Theming o variantes visuales configurables.
- Configuración avanzada de `rel` u otros atributos del anchor.
