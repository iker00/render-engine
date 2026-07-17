> Cuándo leer: si la tarea toca el editor de configuración en vivo, el drawer lateral, el editor visual del `layout` (canvas de arrastrar y soltar), la preservación de estado al aplicar cambios, el autocompletado JSON Schema o el comportamiento de recarga por HMR en desarrollo.
> Tamaño: grande.
> Relacionados: [[local-config.md]], [[../config/validation.md]], [[../config/structure.md]], [[../nodes/index.md]].

# Editor de configuración en vivo (dev mode)

## Objetivo
Permitir editar el JSON de configuración directamente en el navegador durante el desarrollo, validarlo con el mismo validador del runtime y aplicarlo para ver el resultado al instante, sin recargar la página ni depender de backend. Junto al editor de texto Monaco, el drawer ofrece también un editor visual del árbol `layout` de la página activa mediante manipulación directa sobre el propio preview renderizado (ver [[#Editor visual del layout (pestaña Visual)]]).

## Activación
El editor solo existe si el host monta `<DevRuntime />` desde `src/dev-runtime/dev-runtime.tsx`. La decisión se toma en el bootstrap (`main.tsx`) y responde a dos condiciones:

- Si `import.meta.env.DEV` es `true` (modo desarrollo), `DevRuntime` se monta siempre.
- Si el bundle es producción (`import.meta.env.DEV === false`) pero el elemento raíz contiene el atributo HTML `data-enable-dev-mode`, `DevRuntime` también se monta.

En producción sin el atributo, `main.tsx` monta `<App />` directamente y Monaco ni el wrapper aparecen en el bundle inicial. El atributo se evalúa una sola vez en el bootstrap; modificarlo en DevTools después de cargar la página no tiene efecto.

## Arranque
`DevRuntime` reutiliza la misma frontera de bootstrap que el runtime: prioridad `data-config` en el elemento root, con `src/dev/config.json` como respaldo. Si el JSON inicial es inválido, la frontera de error de bootstrap existente aplica antes de que el editor sea utilizable.

## Interfaz
- **Botón flotante** siempre visible en esquina inferior derecha mientras el wrapper esté montado, independientemente de la página activa del runtime.
- **Drawer lateral derecho** que se superpone al runtime sin alterar su ancho ni layout interno.
- **Dos pestañas** en la cabecera del drawer, **Visual** y **JSON**, mutuamente excluyentes (solo una está montada en el DOM a la vez). Por defecto, al abrir el drawer, la pestaña activa es **JSON** (comportamiento de apertura sin cambios respecto a antes de que existiera la pestaña Visual). El panel de errores y la barra de acciones (Copiar / Aplicar) permanecen visibles en ambas pestañas. Cambiar de pestaña no descarta el estado de ninguna de las dos vistas: ambas leen y escriben el mismo estado en memoria (`currentConfig` / `editorBuffer`), así que la sincronización entre canvas y Monaco es inmediata también al cambiar de pestaña.
- **Atajo de teclado** `Ctrl/Cmd+Shift+J` para abrir y cerrar; `Esc` para cerrar cuando está abierto.
- Al abrir el drawer por primera vez en la sesión, el contenido del editor es el JSON inicial formateado (formato original, no la forma normalizada interna del validador).
- Los cambios en el editor persisten en memoria entre cierres y aperturas del panel en la misma sesión. Recargar la página descarta cambios sin aplicar.

## Autocompletado JSON Schema
El editor Monaco registra un JSON Schema derivado del schema Zod raíz (`runtimeConfigRootSchema` en `src/config/runtime-config-root-zod.ts`) usando el método built-in `toJSONSchema` de Zod v4. No se usa la librería externa `zod-to-json-schema` porque no es compatible con Zod v4 (el package está instalado como dependencia pero no se importa). El schema cubre el contrato completo del runtime config incluyendo la unión discriminada de nodos por `type`, y las propiedades opcionales `translations` y `tokens` con sus definiciones completas.

## Acción Aplicar
1. Parsea el texto del editor como JSON; si falla, muestra el error de sintaxis en el panel adjunto y no actualiza el runtime.
2. Valida el JSON parseado con `validateRuntimeConfig`; si falla, muestra `error.code` y `error.message` en el panel adjunto con la ruta canónica tal cual la devuelve el validador.
3. Si la validación es correcta, migra el estado existente al nuevo config (ver § Preservación de estado) y re-renderiza el runtime con el nuevo JSON activo.
4. Tras un aplicar exitoso, `hasPendingChanges` queda en `false` y el buffer del editor se mantiene como está (no se re-serializa el config normalizado, para evitar romper un segundo aplicar).

## Acción Copiar al portapapeles
Copia el texto actual del editor, no el JSON activo del runtime. Usa `navigator.clipboard.writeText` cuando está disponible; si no, cae al fallback `document.execCommand('copy')`.

## Preservación de estado al aplicar
Cuando se aplica un nuevo config (vía botón Aplicar, vía HMR — ver § HMR — o vía una mutación confirmada desde el editor visual — ver § Editor visual del layout), `migrateRuntimeStateAcrossConfig` calcula el estado migrado antes de actualizar `currentConfig`:

- **Formularios**: los `formId` que siguen existiendo en el nuevo árbol se conservan con solo los `fieldId` que también sigan existiendo. Los `formId` o `fieldId` que desaparecen se descartan silenciosamente.
- **Queries**: las queries cacheadas cuyos nombres siguen declarados en `api` se preservan intactas (`data`, `status`, `error`, `requestSignature`). Las eliminadas desaparecen.
- **Navegación**: si la página activa sigue existiendo en `pages`, la navegación se conserva con sus `params` y un histórico reducido a una entrada. Si no existe, degrada a `initialPage` del nuevo config con `params: {}`.
- **PageEntry**: se recalcula coherentemente con la navegación migrada.
- **Translations**: `i18n.translations` se reconstruye desde el bloque `translations` del nuevo config. Si el nuevo config no declara `translations`, se usa un objeto vacío. `i18n.activeLanguage` se preserva del estado previo.
- **Tokens**: el estado de `tokens` se reconstruye desde el bloque `tokens` del nuevo config con la misma semántica que el bootstrap inicial (cada token con su `value` del config, `status: 'ready'`, `failedAttempts: 0`). Si el nuevo config no declara `tokens`, se usa un objeto vacío.

El dispatch de migración de estado se lanza antes de actualizar `currentConfig` para que los `layoutEffect` del provider vean el estado migrado desde el primer render con el nuevo config.

## HMR: recarga automática al editar config.json en disco
Cuando `src/dev/config.json` cambia en disco durante el desarrollo, Vite's HMR actualiza el módulo y `DevRuntime` recibe un nuevo `initialConfig`. Un `useEffect` en `DevRuntimeReady` detecta el cambio de referencia de `initialConfig` y aplica automáticamente el nuevo config con la misma migración de estado que el botón Aplicar. El editor se reinicia (buffer a `null`) para mostrar el nuevo JSON en la próxima apertura.

Esto permite editar `config.json` directamente en el editor de código y ver el resultado en el navegador sin tocar el drawer. El estado de la sesión (navegación, formularios, queries) se preserva en la medida en que el nuevo config lo permita.

## Guardia de cambios aplicados (unsaved changes guard)
Cuando el usuario pulsa el botón Aplicar y la validación es exitosa, se activa una guardia que intercepta cualquier intento de descargar la página (recargar, navegar fuera, cerrar la pestaña, etc.) mostrando un diálogo nativo del navegador que advierte al usuario de que perderá los cambios aplicados si continúa.

### Activación
La guardia se activa exactamente en el primer Aplicar exitoso de la sesión. Una vez activada, permanece activa hasta que la página se descargue realmente, aunque:
- Se apliquen cambios adicionales (segundo Aplicar exitoso, HMR).
- Se cierre el drawer del editor.
- Se navegue dentro del runtime por hash (la navegación interna por hash no descarga la página y no desactiva la guardia).

### Comportamiento
- **Activación correcta**: Tras un Aplicar exitoso (validación pasada, config aceptado), el diálogo nativo del navegador aparece al recargar, navegar fuera, cerrar la pestaña, etc.
- **Errores de validación o sintaxis**: Un Aplicar fallido por JSON inválido o validación estructural no activa la guardia. El usuario debe aplicar un cambio válido para activarla.
- **Cancelar el diálogo**: Si el usuario elige "quedarse en la página" cuando el navegador lo pregunta, la página no se descarga y los cambios aplicados se conservan.
- **Confirmar el diálogo**: Si el usuario elige "abandonar la página", la descarga prosigue normalmente y el runtime se reinicia desde `config.json` del disco, perdiendo los cambios aplicados de la sesión.

### Límites de la guardia
- El diálogo muestra un mensaje genérico del navegador; no es personalizable (política de seguridad de navegadores modernos).
- Solo intercepta descargas reales de la página (recargar, navegar a URL distinta, cerrar pestaña). No aplica a la navegación interna del runtime por hash.
- No persiste la configuración aplicada en `localStorage`, `sessionStorage` o disco; es únicamente para avisar al usuario durante la sesión.
- No existe ningún elemento visual adicional (banner, badge, indicador) más allá del diálogo nativo.

## Editor visual del layout (pestaña Visual)

### Objetivo y alcance
Capa de edición visual del árbol `layout` de la página activa mediante manipulación directa sobre el propio preview ya renderizado (no un panel de árbol tipo "layers" separado del render), como alternativa a escribir JSON a mano. Cubre únicamente el `layout` de una página; `api`, `pages` (alta/baja/`initialPage`), `tokens` y `translations` quedan fuera de esta entrega.

### Selector de página
Un `<select>` en la cabecera del canvas permite elegir qué página de `config.pages` se muestra y edita, sin necesidad de navegar el runtime para cambiar de página. El canvas monta su propia instancia aislada de `RuntimeStateProvider`, independiente del runtime de preview de fondo: puede editar cualquier página sin depender de a qué página haya navegado el runtime visible detrás del drawer. Cambiar de página con un nodo seleccionado limpia la selección (y, con ella, el breadcrumb y el panel de propiedades).

### Selección y hover
Click sobre un nodo renderizado lo selecciona; hover lo resalta sin cambiar la selección. La selección se identifica por un `path` estructural resuelto contra el árbol real, no por índice DOM. Si el nodo seleccionado deja de existir en el árbol (por ejemplo, se borró desde Monaco y se aplicó, o quedó fuera de una mutación del propio canvas), la selección se limpia automáticamente en vez de referenciar un nodo inexistente.

### Breadcrumb de ancestros
Al seleccionar un nodo se muestra la cadena de ancestros hasta la raíz del `layout` de la página (por ejemplo `container > form > heading`), con la etiqueta `type`, o `type (id)` cuando el nodo declara `id`. Cada segmento salvo el último (el nodo ya seleccionado) es clicable y cambia la selección a ese ancestro, permitiendo editar las propiedades de un `container` o `form` padre y no solo de las hojas.

### Panel de propiedades
Con un nodo seleccionado se muestra un panel lateral con las secciones `Props`, `Layout`, `Visibilidad` y `Estado de consulta` (`queryStateFeedback`), mostrando solo las que el `type` del nodo seleccionado declara según su schema Zod individual. Los campos se generan dinámicamente a partir del mismo JSON Schema derivado (`toJSONSchema` de Zod v4) que ya alimenta el autocompletado de Monaco — no existe un segundo contrato de UI hardcodeado por tipo de nodo. Editar cualquier campo actualiza el estado en memoria de inmediato y se refleja tanto en el canvas como en el buffer de Monaco, sin necesidad de pulsar ningún botón "Aplicar" adicional. Un campo `layout.span` declarado como mapa responsive por breakpoint se edita con merge superficial sobre el objeto existente: cambiar un breakpoint no borra los demás ya declarados que no sean visibles en el viewport actual del canvas.

### Reordenar y reanidar por arrastre
Arrastrar un nodo existente dentro del canvas permite reordenarlo entre hermanos o reanidarlo bajo un `container`/`form`/`modal`/`link`/`accordion`/`tabs` distinto. Un destino que violaría alguna regla estructural se señala visualmente como inválido durante el arrastre (indicador de color) y no se acepta al soltar; el `layout` no cambia en ese caso.

### Paleta de nodos e inserción
Una paleta lateral, siempre visible dentro de la pestaña Visual, lista el catálogo completo de tipos de nodo soportados con una etiqueta legible. Arrastrar una entrada de la paleta hasta una posición del canvas inserta ahí una instancia mínimamente válida de ese tipo (valores por defecto estáticos y literales, sin referencias dinámicas ni dependencia de queries o formularios existentes), sujeta a las mismas reglas de destino que el reordenamiento.

### Eliminar nodo
Con un nodo seleccionado, un botón "Eliminar nodo" en la cabecera del panel de propiedades borra ese nodo y todo su subárbol del `layout`, y limpia la selección. No hay confirmación modal, deshacer/rehacer ni atajo de teclado dedicado (por ejemplo `Supr`) — quedan fuera de esta primera entrega.

### Reglas de destino de drop
La validez de un destino (tanto para reordenar/reanidar como para insertar desde la paleta) reutiliza exactamente las mismas reglas estructurales ya vigentes para el contrato JSON (ver [[../config/structure.md]]), sin duplicarlas de forma divergente:
- solo `container`, `form`, `modal`, `link`, `accordion` y una pestaña concreta de `tabs` aceptan hijos.
- `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `fileInput`, `toggle` y `hidden` solo son válidos como descendientes de un `form`, en cualquier profundidad (incluso a través de un `container`/`accordion`/`tabs` intermedio).
- un `button` sin `action` solo es válido como descendiente de un `form`.
- `modal` y `link` conservan su catálogo cerrado propio de tipos hijo admitido (el mismo ya vigente en producción), no el catálogo abierto de `container`.
- `repeater` nunca acepta un drop de hijos fuera de la única instancia de `props.template` que representa en modo edición.
- arrastrar un nodo sobre sí mismo o sobre uno de sus propios descendientes se trata siempre como destino inválido (evita ciclos).

### `repeater`, `accordion`, `tabs` y `modal` en modo edición
Estos cuatro nodos gestionan su propio subárbol de forma especial dentro del canvas, sin afectar a su comportamiento en producción:
- **`repeater`**: se muestra siempre como exactamente una instancia editable de `props.template` (con el primer elemento real de la colección resuelta como contexto `item.*` si hay datos, o un contexto vacío si la colección está vacía), sin controles de paginación. No se editan instancias repetidas por separado; el resultado de cualquier edición dentro de esa instancia se escribe siempre sobre `props.template`.
- **`accordion`**: su cuerpo y sus `children` están siempre presentes en el DOM del canvas, con independencia de `defaultOpen` o de si se ha clicado la cabecera (en producción, un accordion colapsado no renderiza su contenido). La cabecera sigue alternando `aria-expanded` con normalidad.
- **`modal`**: su panel y sus `children` están siempre presentes en el DOM del canvas, con independencia de `defaultOpen` o de si se ha disparado `openModal` (en producción, un modal cerrado no renderiza nada).
- **`tabs`**: no se fuerza ninguna visibilidad adicional (el usuario ya puede cambiar de pestaña con la cabecera interactiva, que sigue funcionando igual); solo se garantiza que los nodos de la pestaña activa direccionan correctamente sus mutaciones sobre `props.items[i].children`.

Limitación conocida: un `tabItem` de `tabs` o un cuerpo de `accordion` completamente vacíos (sin ningún hijo) todavía no exponen una zona droppable propia equivalente al placeholder de contenedores vacíos descrito abajo; para insertar el primer nodo en esos casos hace falta arrastrar hasta un hijo ya existente de esa pestaña/cuerpo, o editar el JSON desde Monaco.

### Contenedores y formularios vacíos
Un `container` o `form` sin `children` (o con `children: []`) se renderiza en el canvas con un placeholder visible (borde punteado y etiqueta), seleccionable y válido como destino de drop para insertar el primer hijo. Ese placeholder no existe en el render de producción del mismo `layout`: el nodo vacío sigue sin mostrar nada fuera del modo edición.

### Sincronización con Monaco
Cualquier cambio hecho en el canvas (mover, insertar, borrar, editar propiedades) se confirma mediante el mismo pipeline de commit del canvas: valida el `layout` resultante con `validateRuntimeConfig` (el mismo validador que ya usa el botón Aplicar) y, solo si es válido, migra el estado del runtime y actualiza `currentConfig`. A diferencia del botón Aplicar (que deja el buffer de Monaco intacto tras aplicar), el commit del canvas parchea únicamente la clave `layout` de la página activa sobre el último texto crudo válido conocido, dejando intacto el resto del documento (`api`, `initialPage`, `tokens`, `translations`, y cualquier otra página, incluidos bloques con forma cruda como `preloads`). Un `form.onSuccess`/`form.onError` declarado a nivel superior se serializa anidado dentro de `submitAction`, igual que exige el contrato normalizado. Si la mutación resultante no fuera válida, se descarta sin tocar ningún estado — la validación de destino de drop y las reglas estructurales ya evitan que esto ocurra en el flujo normal, pero el commit es la última barrera de seguridad. Un commit exitoso desde el canvas activa la misma guardia de cambios aplicados (§ Guardia de cambios aplicados) que el botón Aplicar, y sobrescribe deliberadamente cualquier cambio sin aplicar que hubiera pendiente en Monaco en ese momento.

### Límites del editor visual
- No hay deshacer/rehacer (undo/redo) de las operaciones del canvas; Monaco sigue disponible como red de seguridad manual.
- No hay selección múltiple de nodos, duplicar/copiar un nodo, ni atajos de teclado dedicados.
- El panel de propiedades no incluye pickers contextuales para referencias string (`queries.x`, `forms.x`, `params.x`, `{{...}}`); esos campos se editan como texto plano, igual que el resto de propiedades del schema.
- Edita únicamente `layout`; `api`, `pages` (alta/baja/`initialPage`), `tokens` y `translations` quedan fuera de esta entrega.
- Persiste solo en memoria de sesión, con el mismo límite ya vigente para Monaco (ver § Límites siguiente).

## Límites
- No persiste cambios entre sesiones del navegador (`localStorage`/`sessionStorage` fuera de alcance).
- No descarga el JSON como archivo.
- No resalta errores de validación inline en Monaco; solo los muestra en el panel adjunto.
- No permite varias instancias simultáneas del editor.
- No modifica el contrato observable del runtime ni su frontera pública de errores.
