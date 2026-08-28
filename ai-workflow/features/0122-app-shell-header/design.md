# Design: Feature 0122 - app-shell-header

## Contexto

`spec.md` fija el contrato funcional de `shell.header` (logo/título/menú con un nivel de desplegables/acciones,
persistente entre páginas, sin opt-out por página) y deja explícitamente para este documento: (a) la representación
interna del shell en el runtime, y (b) el shape exacto de `shell` para que una futura `sidebar` no obligue a
reestructurar `header`.

Puntos de partida relevantes del código y la documentación existente:

- `src/runtime/` renderiza siempre dentro del árbol de una página (`layout-renderer`/`layout-node-renderer`), atado al
  ciclo de vida de `pageEntry`. El shell, por contrato de spec, vive fuera de `pages[].layout` y se monta una única
  vez por sesión — no encaja en ese ciclo de vida y no debe forzarlo.
- `src/config/` valida cada bloque raíz con un módulo dedicado (`validate-preloads`, `validate-api-config`,
  `validate-layout-nodes`, `validate-actions-visibility`, `validate-form-nodes`), orquestados desde
  `validate-runtime-config`. Todo bloque raíz nuevo sigue ese patrón modular.
- `button.props.action` y `link.props.action` ya comparten literalmente los mismos schemas Zod exportados
  (`navigateToButtonActionSchema`, `goBackButtonActionSchema` en `runtime-config-zod.ts`), combinados con
  `z.discriminatedUnion('type', [...])`. Es el punto de reutilización directo para `menuItem.action`.
- `validateRuntimeUiAction` y `validateVisibility` (`validate-actions-visibility.ts`) son funciones ya compartidas por
  button/link/form, pero están acopladas a la idea de "acción dentro de una página": reciben `pageId` de la página en
  validación y construyen mensajes con el formato fijo `Page "{pageId}" has an invalid layout at "{path}"`. `shell` es
  el primer bloque raíz con acciones/visibility que **no** vive dentro de una página.
- El editor visual en modo desarrollo (`dev-mode-editor.md`) ya tiene una barra de dominio con 4 botones
  (`Layout`, `Api`, `Páginas`, `Tokens`); solo `Layout` es funcional (manipulación directa sobre el árbol renderizado).
  `EDITOR-VISUAL-ROADMAP.md` ya deja anotado que `Api`/`Páginas`/`Tokens`/`translations` serán "más bien CRUD de
  formularios/listas, no manipulación directa sobre un render" — la sección "Shell" que pide esta spec encaja en esa
  misma categoría (formulario de configuración, no canvas), no en la de `Layout`.
- El proyecto ya tiene precedente de widgets de formulario a medida enganchados al panel de propiedades sin duplicar
  el contrato: el selector de variante de acción (`DiscriminatedUnionPropertyField`, feature `0107`) y el hook
  `x-widget` para widgets cerrados no genéricos (`ChoiceItemsPropertyField`, feature `0108`).
- Dependencias actuales: `@dnd-kit/core` (drag-and-drop del canvas), `lucide-react`, `zod`, `@monaco-editor/react`. No
  hay ninguna librería de posicionamiento de popovers (`floating-ui`, `radix`, `headlessui`).

## Objetivos / No objetivos

### Objetivos
- Fijar el shape exacto de `shell`, `shell.header` y `menuItem` en `src/config/`, con la partición de validación
  correspondiente.
- Fijar dónde y cómo se renderiza el shell dentro de la composición existente de `src/app/`/`src/runtime/`, sin
  alterar el ciclo de vida de `layout-renderer` ni de `pageEntry`.
- Fijar cómo se deriva el estado "activo" del menú sin introducir un nuevo dominio de estado en `runtime-state/`.
- Fijar el enfoque técnico del desplegable de `menuItem.children` (sin nueva dependencia).
- Fijar cómo se integra la nueva sección "Shell" del editor visual con la barra de dominio ya existente y qué
  patrones genéricos del panel de propiedades se reutilizan frente a lo que exige un formulario a medida.
- Dejar el shape de `shell` preparado para que una futura `sidebar` sea aditiva, sin romper ni reestructurar
  `shell.header`.

### No objetivos
- No define comportamiento responsive/mobile del header ni de los desplegables (fuera de alcance de spec).
- No diseña ni implementa `sidebar` (feature futura, "Spec B").
- No resuelve el gap ya identificado de que el canvas de `link.children` no es editable visualmente (fuera de
  alcance de spec).
- No trocea el trabajo en tareas (corresponde a `generate-implementation-plan`).

## Decisiones

### 1. Shape de `shell` como contenedor de secciones de chrome, no aplanado
```
shell?: {
  header?: {
    logo?: { src?, alt, fetch? }   // mismo contrato de props que el nodo `image`
    title?: string                  // referencia de texto completa/literal/interpolada, como link.props.label
    menu?: MenuItem[]
    actions?: (LinkNodeActions | ButtonNodeActions)[]  // subconjunto: solo type 'link' | 'button'
  }
}
```
`shell` es un objeto que agrupa secciones de chrome (`header` hoy; `sidebar` mañana como hermano), cada una
independiente y opcional. `shell.header.logo` reutiliza literalmente el contrato de `props` ya validado del nodo
`image` (modo `src`/`alt` o `fetch`, mutuamente excluyentes) en vez de definir un shape de imagen paralelo.

**Alternativa descartada**: aplanar como `shell.headerLogo`, `shell.headerMenu`, `shell.headerActions`, etc. Se
descarta porque impide tratar "header" como una unidad al añadir `sidebar` y complica innecesariamente tanto el
validador como el formulario del editor (una sección de formulario por bloque agrupado es más natural que cuatro
bloques sueltos con prefijo compartido). Riesgo residual: ninguno; el bloque es aditivo puro y no colisiona con
ningún bloque raíz existente.

### 2. `menuItem` es un tipo propio, no una variante del catálogo general de nodos
`menuItem` no entra en la unión discriminada por `type` de `layout` (no es seleccionable en el canvas de `Layout`, no
acepta `container`/`repeater` como hijos). Solo dos de sus campos reutilizan literalmente contrato ya existente:
- `menuItem.href`: mismo contrato que `link.props.href` (literal o referencia dinámica completa).
- `menuItem.action`: mismo discriminated union ya exportado (`navigateToButtonActionSchema`, `goBackButtonActionSchema`)
  que ya usa `link.props.action`.

**Alternativa descartada**: modelar `menuItem` como una variante restringida del nodo `link` completo. Se descarta
porque `link` permite `children` como árbol de nodos visuales arbitrarios (container, heading, image, etc.), que no
es lo que representa un item de menú (label + icon + destino/trigger + hijos del mismo tipo restringido); reutilizar
`link` completo obligaría a despojarlo de la mayor parte de su contrato en el punto de uso, perdiendo claridad.

### 3. Profundidad de un nivel como dos tipos Zod distintos, no recursión con validación de profundidad
Se definen `menuItemSchema` (raíz, admite `children?: menuItemChildSchema[]`) y `menuItemChildSchema` (usado dentro de
`children`, no declara `children` en absoluto), ambos derivados de una base común (`label`, `icon`, `visibility`,
`href`/`action` mutuamente excluyentes vs. `children` como caso alternativo solo en el tipo raíz).

**Alternativa descartada**: un único `menuItemSchema` recursivo (`children?: menuItemSchema[]`) con una validación
cruzada aparte que rechace un tercer nivel. Se descarta porque codificaría la regla "máximo un nivel" como una
comprobación separada y silenciable en vez de como invariante del propio tipo, y porque acoplaría el tipo de
`shell.header.menu` al de un futuro `shell.sidebar.menu` que previsiblemente sí necesite recursión real (árbol
vertical). Con dos tipos separados, `shell.header` no comparte su schema de árbol con `sidebar`: cuando llegue esa
feature futura, definirá su propio tipo recursivo de verdad sin tocar el contrato ya estable de `header`. Trade-off
aceptado: pequeña duplicación de los campos base entre `menuItemSchema` y `menuItemChildSchema`, mitigada
factorizándolos en un `.extend()` o helper Zod compartido, sin duplicar las reglas de validación de acción/visibility
en sí (que siguen viviendo en los schemas ya reutilizados).

### 4. Validación en módulo dedicado `validate-shell.ts`, no dentro de `validate-actions-visibility.ts`
Nuevo módulo `src/config/validate-shell.ts`, orquestado desde `validate-runtime-config.ts` igual que `validate-preloads`,
que:
- reutiliza los mismos schemas Zod de acción (`navigateToButtonActionSchema`, `goBackButtonActionSchema`) y la misma
  semántica de "pageId debe existir en `pages`" ya usada por `button`/`link`.
- reutiliza la misma función `validateVisibility`/lógica de referencias para `menuItem.visibility` en la medida en que
  su contrato de entrada lo permita (sin `item.*`, como fija la spec).
- genera sus propios mensajes de error con un prefijo propio de `shell` (por ejemplo
  `Shell configuration is invalid at "shell.header.menu[0]..."`) en vez de reutilizar el formato
  `Page "{pageId}" has an invalid layout at ...` de `validateRuntimeUiAction`, porque ese formato asume una página
  como contexto y `shell` no vive dentro de ninguna.

**Alternativa descartada**: generalizar `validateRuntimeUiAction`/`validateVisibility` para aceptar un `pageId`
opcional/nulo y una plantilla de mensaje parametrizable, y llamarlas directamente desde `shell`. Se descarta por ahora
porque tocaría funciones centrales ya usadas en muchos puntos críticos de validación (riesgo de regresión amplio)
para ganar una reutilización que hoy solo tiene un segundo consumidor. Queda anotado como refactor deseable de bajo
riesgo si aparece un tercer contexto no-página con acciones/visibility (candidato claro: `sidebar`).

**Riesgo residual explícito**: la política de mensajes de error de `shell` no será byte-a-byte idéntica a la de
`pages[].layout`. Es aceptable porque ya existe precedente de bloques raíz con su propia política de mensajes
(`tokens`, `preloads` raíz), pero debe quedar anotado para que `sidebar` no reabra el mismo dilema sin decidirlo.

### 5. Render del shell fuera de `layout-renderer`, como composición nueva en `src/app/`
Nuevo componente (p. ej. `AppShellHeader`, en un módulo nuevo bajo `src/runtime/`, ej. `src/runtime/runtime-shell/`)
montado una única vez por sesión de runtime en la composición raíz de `src/app/`, envolviendo (no formando parte de)
el `layout-renderer` de la página activa. Reutiliza sin reimplementar:
- la fachada de `runtime-state` (dominio de navegación) para leer el `pageId`/`pageEntry` activo — sin nuevo dominio
  de estado; el estado "activo" del menú es un valor derivado en cada render (ver decisión 8).
- `runtime-references` para resolver `title`, `menuItem.label` e icono con el mismo mecanismo de texto dinámico que
  el resto del runtime.
- `runtime-actions` (`executeRuntimeUiAction`, el mismo ejecutor que ya usa `link`) para disparar `navigateTo`/`goBack`
  de cada `menuItem`.
- los componentes de nodo ya existentes (`LinkLayoutNode`/`ButtonLayoutNode` o el dispatcher central) para renderizar
  cada entrada de `shell.header.actions`, en vez de reimplementar su presentación y su lógica de acción.

**Alternativa descartada**: extender `layout-renderer` para tratar `shell` como un "layout implícito" adicional que se
inyecta antes de cada página. Se descarta porque el shell no pertenece a ninguna página y su ciclo de vida (una vez
por sesión, no por `pageEntry`) es distinto del árbol de layout; mezclarlo complicaría la frontera hoy estable de
`layout-renderer`/`layout-node-renderer` sin necesidad real.

### 6. Desplegable de `menuItem.children` como componente propio, sin nueva dependencia
Componente propio (p. ej. `MenuItemDropdown`) con estado local `open` por trigger, posicionado con
`position: absolute` anclado a un contenedor `relative` (sin librería de colisión/flip). Patrón de accesibilidad:
`aria-haspopup="menu"`, `aria-expanded` en el trigger, `role="menu"`/`role="menuitem"` en el desplegable y sus hijos,
cierre por click fuera/Esc/selección de un hijo, navegación por flechas entre items — consistente con el patrón ya
usado por `accordion`/`tabs` (gestión de foco y `aria-expanded` locales).

**Alternativa descartada**: añadir `@floating-ui/react` (o similar) para posicionamiento robusto. Se descarta porque
el caso de uso real (un popover de un solo nivel anclado directamente bajo su trigger, sin necesidad de colisión con
los bordes del viewport declarada en spec) no lo justifica, y el proyecto evita dependencias nuevas sin necesidad
concreta. Se anota como opción a reconsiderar si un caso de uso futuro (`sidebar`, u otro popover) exige
posicionamiento más complejo.

### 7. Sección "Shell" del editor como quinto botón de dominio, formulario dedicado (no canvas, no panel de nodo)
Se añade un quinto botón en la barra de dominio ya existente (`Layout`, `Api`, `Páginas`, `Tokens`, **`Shell`**).
Seleccionarlo sustituye el área de canvas por un panel de formulario dedicado (p. ej. `ShellConfigPanel`), distinto
del panel de propiedades por nodo seleccionado que sigue existiendo solo para `Layout`. Encaja con la categorización
ya anotada en `EDITOR-VISUAL-ROADMAP.md`: `Api`/`Páginas`/`Tokens`/`translations` serán "CRUD de formularios/listas,
no manipulación directa sobre un render"; `Shell` es exactamente ese mismo tipo de superficie, y es el primero de esa
categoría en implementarse.

El panel reutiliza los widgets genéricos ya existentes donde el shape coincide exactamente, sin duplicar UI:
- el selector de variante de acción (`DiscriminatedUnionPropertyField`, patrón de `0107`) para `menuItem.action`/
  `href` (mismas opciones "Sin acción"/"Navegar a página"/"Volver atrás" que ya usa `link.props.action`).
- el editor de condición `visibility` (simple/grupo) ya usado en el panel de propiedades, para `menuItem.visibility`.
- el mismo `@dnd-kit/core` ya usado por el canvas de `Layout`, para reordenar `shell.header.menu` dentro de un mismo
  nivel, con un `SortableContext` por nivel (uno para la lista raíz, uno por cada padre con `children` abierto en el
  formulario) en vez de un único contexto para todo el árbol.
- el mismo pipeline de commit del canvas (`validateRuntimeConfig` + parcheo de una única clave sobre el último texto
  crudo válido conocido), parcheando la clave `shell` en vez de `layout`.

No reutiliza el panel de propiedades por nodo seleccionado como contenedor completo, porque `shell.header` no es un
nodo del árbol de `layout` ni tiene una única instancia seleccionable a la vez: es un formulario de configuración
global con listas anidadas (menú con hasta dos niveles, acciones) que no encaja en el modelo "un nodo seleccionado".

**Alternativa descartada**: modelar el toggle y los campos de Shell como un nodo sintético más dentro del árbol de
`layout`, seleccionable como cualquier otro nodo del canvas. Se descarta porque la propia spec ya fija que la sección
Shell sustituye el área de canvas por un formulario, no por selección sobre un árbol renderizado.

**Riesgo anotado, no bloqueante**: usar `SortableContext` anidados por nivel (en vez de un único contexto para todo
el árbol, como probablemente hace hoy el canvas de `Layout` vía `path` estructural) es un patrón nuevo dentro del
editor. Riesgo medio de fricción de integración con `@dnd-kit/core`; queda para validar en la tarea de implementación
correspondiente, no bloquea la planificación.

### 8. Estado "activo" del menú como valor derivado, no como estado persistido
El resaltado de "activo" (raíz y padres de un hijo activo) se calcula de forma pura en cada render de
`AppShellHeader`, recorriendo `shell.header.menu` (raíz + un nivel de `children`) y comparando cada
`menuItem.action.navigateTo.pageId` contra el `pageId` de la `pageEntry` activa, ya expuesto por `runtime-state`. No
se persiste ni se introduce un nuevo dominio en el store: se recalcula en cada navegación exactamente igual que ya se
deriva hoy otro estado visual reactivo del runtime (por ejemplo `queryStateFeedback`).

## Riesgos y trade-offs

- **Mensajes de error de `shell` con formato propio** (decisión 4): riesgo bajo, ya hay precedente de bloques raíz
  con política de mensajes propia (`tokens`, `preloads`).
- **Desplegable a medida sin librería** (decisión 6): riesgo medio de bugs de accesibilidad (gestión de foco,
  click-outside, Esc) si no se cubre bien con tests; mitigación: exigir en la tarea de implementación tests
  explícitos de teclado y de `aria-expanded`.
- **`SortableContext` anidados por nivel en el editor** (decisión 7): riesgo medio de fricción de integración con
  `@dnd-kit/core`; no bloqueante para planificar, pero debe validarse temprano en la implementación de esa tarea.
- **`menuItem` (header) y el futuro tipo de árbol de `sidebar` no serán el mismo tipo TS/Zod** (decisiones 1 y 3):
  intencional, pero implica que solo compartirán los campos base de "leaf item" (label/icon/href/action/visibility),
  no el árbol completo. Debe quedar anotado para que la spec/design de `sidebar` no asuma reutilización 1:1 del tipo
  completo de `menuItem`.
- **Menú/desplegable oculto por `visibility`**: la spec ya deja explícito que un padre con todos sus `children`
  ocultos sigue siendo un disparador de desplegable válido (comportamiento por defecto, no una decisión técnica de
  este documento).

## Migración o despliegue

No aplica. `shell` es un bloque raíz nuevo y opcional; su ausencia (o `shell.header` ausente/vacío) reproduce
exactamente el comportamiento actual del runtime. No hay datos ni configuración existente que migrar.

## Preguntas abiertas

Ninguna bloqueante para planificar. Las incertidumbres identificadas (comportamiento responsive/mobile, shape de
`sidebar`, ocultación automática de un padre con todos sus hijos ocultos) ya están recogidas como riesgos residuales
no bloqueantes en `spec.md` y en la sección "Riesgos y trade-offs" de este documento; no introducen ninguna nueva
decisión técnica pendiente para `generate-implementation-plan`.
