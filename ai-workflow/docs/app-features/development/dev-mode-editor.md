> Cuándo leer: si la tarea toca el editor de configuración en vivo, el drawer lateral, el editor visual del `layout` (canvas de arrastrar y soltar), la sección `Shell`, la sección `Api` (CRUD de operaciones y de `preloads` globales/de página), la sección `Traducciones` (gestión manual y sincronización con el proveedor externo PlataGes), el botón "Guardar" y el atajo Ctrl+S/Cmd+S hacia un backend externo, la preservación de estado al aplicar cambios, el autocompletado JSON Schema o el comportamiento de recarga por HMR en desarrollo.
> Tamaño: grande.
> Relacionados: [[local-config.md]], [[../config/validation.md]], [[../config/structure.md]], [[../nodes/index.md]], [[../nodes/table.md]], [[../shell/header.md]], [[../shell/sidebar.md]], [[../auth/tokens.md]], [[../references/visibility.md]], [[../queries/execution.md]], [[../queries/preloads.md]], [[../navigation/navigate-actions.md]].

# Editor de configuración en vivo (dev mode)

## Objetivo
Permitir editar el JSON de configuración directamente en el navegador durante el desarrollo, validarlo con el mismo validador del runtime y aplicarlo para ver el resultado al instante, sin recargar la página ni depender de backend. Junto al editor de texto Monaco, una **barra de herramientas flotante** persistente ofrece también un editor visual del árbol `layout` de la página activa mediante manipulación directa sobre el propio preview real renderizado — no un árbol duplicado, sino el mismo contenido que ve el usuario — con controles para cambiar de página, seleccionar modo Visual/Editor, abrir la paleta de nodos y acceder a Monaco (ver [[#Barra flotante]] y [[#Editor visual del layout]]). La barra incluye también un botón "Guardar" (con atajo Ctrl+S/Cmd+S) que persiste el config activo hacia un backend externo (ver [[#Botón Guardar]]), y cuatro secciones de dominio con panel de formulario dedicado en vez de canvas: `Shell` (ver [[#Sección Shell (dominio de configuración)]]), `Api` (ver [[#Sección Api (dominio de configuración)]]) con CRUD de operaciones del bloque `api` y de entradas de `preloads` globales/de página, `Traducciones` (ver [[#Sección Traducciones (dominio de configuración)]]), esta última con gestión manual del bloque `translations` y sincronización de solo lectura con un proveedor externo de gestión de textos, y `Páginas` (ver [[#Sección Páginas (dominio de configuración)]]) para alta/baja de páginas, edición de `title` y designación de `initialPage`.

## Activación
El editor solo existe si el host monta `<DevRuntime />` desde `src/dev-runtime/dev-runtime.tsx`. La decisión se toma en el bootstrap (`main.tsx`) y responde a dos condiciones:

- Si `import.meta.env.DEV` es `true` (modo desarrollo), `DevRuntime` se monta siempre.
- Si el bundle es producción (`import.meta.env.DEV === false`) pero el elemento raíz contiene el atributo HTML `data-enable-dev-mode`, `DevRuntime` también se monta.

En producción sin el atributo, `main.tsx` monta `<App />` directamente y Monaco ni el wrapper aparecen en el bundle inicial. El atributo se evalúa una sola vez en el bootstrap; modificarlo en DevTools después de cargar la página no tiene efecto.

## Arranque
`DevRuntime` reutiliza la misma frontera de bootstrap que el runtime: prioridad `data-config` en el elemento root, con `src/dev/config.json` como respaldo. Si el JSON inicial es inválido, la frontera de error de bootstrap existente aplica antes de que el editor sea utilizable.

## Interfaz

### Barra flotante de herramientas
Una barra de herramientas persistente permanece siempre visible en la base central de la pantalla mientras `DevRuntime` esté montado, independientemente de la página activa del runtime y del modo vigente. Contiene (de izquierda a derecha):

1. **Selector de página**: dropdown que lista todas las páginas disponibles en `config.pages`. Cambiar la selección navega el runtime a esa página (con el mismo mecanismo que una navegación interna por hash), en cualquiera de los dos modos. Al navegar, se limpia cualquier nodo seleccionado en modo Editor.
2. **Selector de pestaña de dominio**: seis botones, en este orden: `Layout`, `Api`, `Páginas`, `Tokens`, `Traducciones`, `Shell`. `Layout`, `Api`, `Páginas`, `Traducciones` y `Shell` son funcionales; solo `Tokens` sigue renderizándose deshabilitada con `aria-disabled` y el título "Próximamente", sin acción al interactuar. Ver [Sección Shell (dominio de configuración)](#sección-shell-dominio-de-configuración), [Sección Api (dominio de configuración)](#sección-api-dominio-de-configuración), [Sección Traducciones (dominio de configuración)](#sección-traducciones-dominio-de-configuración) y [Sección Páginas (dominio de configuración)](#sección-páginas-dominio-de-configuración) para el comportamiento de cada una.
3. **Botón "Añadir elemento"**: abre la paleta flotante de nodos (ver sección [[#Paleta flotante de nodos]]), desde la que se puede arrastrar un nodo hasta el contenido para insertarlo. Su estado (abierto/cerrado) se refleja visualmente en la barra.
4. **Botón de acceso a Monaco** (icono `{}`): abre el panel flotante de Monaco (ver sección [[#Panel flotante de Monaco]]). Su estado se refleja visualmente en la barra.
5. **Toggle Visual/Editor**: dos botones (`Visual`, `Editor`) que controlan el modo. Al arrancar, el modo por defecto es `Visual`. Solo pueden estar activos alternativamente. El toggle modifica el comportamiento del árbol renderizado sin necesidad de recarga (ver [[#Modo Visual]] y [[#Modo Editor]]).
6. **Botón "Guardar"**: persiste el config activo hacia un backend externo, con atajo de teclado Ctrl+S/Cmd+S equivalente. Siempre visible, en cualquier dominio y modo (ver [[#Botón Guardar]]).

### Modo Visual
Por defecto al arrancar `DevRuntime`, el contenido se comporta exactamente igual que en producción: navegación por `link`/`button`, envío de formularios, ejecución de queries, campos de formulario editables. No hay selección, breadcrumb, panel de propiedades ni indicadores de arrastre visibles. Esta es la experiencia del usuario final, reflejada en el mismo árbol real renderizado.

### Modo Editor
Al activar "Editor" desde la barra, se habilita la edición visual directa sobre el contenido:
- **Selección**: hacer click sobre un nodo lo selecciona; hover lo resalta sin cambiar la selección. La selección se identifica por un `path` estructural resuelto contra el árbol real.
- **Panel de selección**: al seleccionar un nodo, aparece un panel fijo acoplado al borde derecho de la pantalla mostrando su cabecera, la fila de identidad y el panel de propiedades en pestañas del nodo seleccionado (ver [[#Cabecera y fila de identidad del panel de propiedades]] y [[#Barra de pestañas del panel de propiedades]]). El panel ocupa entre el 90% y el 100% de la altura del viewport y dispone de scroll vertical interno cuando su contenido excede esa altura. El panel no reduce el ancho disponible del contenido renderizado.
- **Cierre del panel de selección**: la cabecera del panel incluye un botón-icono "Cerrar" compacto. Al pulsarlo, el panel se oculta y la selección del nodo se limpia (desaparece el resaltado de selección). Además, con el panel de selección abierto y el panel de Monaco cerrado, pulsar `Esc` produce el mismo efecto (cierra el panel y limpia la selección).
- **Breadcrumb de ancestros**: cadena clicable de ancestros desde el nodo seleccionado hasta la raíz del layout (ej: `container > form > heading`), en la cabecera del panel. Clicar un segmento cambia la selección a ese ancestro.
- **Panel de propiedades**: el contenido editable del nodo se organiza en las pestañas `Props`, `Diseño`, `Visibilidad` y `Queries`, generadas dinámicamente desde el schema Zod del nodo — solo existen las que el nodo tiene contenido para mostrar. Editar cualquier campo actualiza el estado en memoria e inmediatamente se refleja tanto en el contenido renderizado como en el buffer de Monaco.
- **Supresión de comportamiento propio**: en modo Editor, el contenido renderizado **no ejecuta ninguna acción declarativa** (`navigateTo`, `goBack`, `executeOperation(s)`, `openModal`/`closeModal`, `resetForm`, envío de `form`) y los campos de formulario quedan inertes a su interacción nativa (no se puede teclear ni marcar directamente sobre el campo). La única vía para cambiar configuración en modo Editor es el canvas (arrastre, borrado) o el panel de propiedades del nodo seleccionado.
- **Excepción explícita**: la interactividad local de la cabecera de `accordion` (expandir/colapsar) y de `tabs` (cambiar de pestaña visible) sigue funcionando en modo Editor, necesaria para acceder y seleccionar nodos anidados bajo cabeceras distintas. El cuerpo de `accordion` y el panel de `modal` están siempre presentes en el DOM en modo Editor con independencia de su estado.
- **Arrastre**: arrastrar un nodo existente lo reordena o reanida; arrastrar desde la paleta inserta un nodo nuevo. Ambas operaciones están sujetas a las mismas reglas de destino ya vigentes (ver sección [[#Reglas de destino de drop]]).
- **Borrado**: con un nodo seleccionado, un botón en el panel de propiedades borra ese nodo y todo su subárbol, y limpia la selección.

### Panel flotante de Monaco
El editor de texto Monaco se renderiza como un panel deslizante `fixed` en el lado derecho. Se activa desde el botón `{}` de la barra. Incluye:
- El editor Monaco con autocompletado JSON Schema (mismo que siempre).
- Panel de errores cuando hay validación o sintaxis inválida.
- Barra de acciones: botones "Copiar" y "Aplicar", con indicador visual de cambios pendientes.
- Botón "Cerrar" (o presionar `Esc`) para cerrar el panel.

### Exclusión mutua entre panel de selección y panel de Monaco
El lado derecho de la pantalla muestra como máximo uno de los dos paneles a la vez:
- Seleccionar un nodo en modo Editor mientras el panel de Monaco está abierto cierra automáticamente el panel de Monaco y muestra el panel de selección del nodo elegido.
- Abrir el panel de Monaco desde el botón de la barra mientras hay un nodo seleccionado con su panel visible cierra el panel de selección (limpiando la selección, igual que el botón "Cerrar") y muestra el panel de Monaco.
- Con el panel de Monaco abierto, pulsar `Esc` sigue cerrando el panel de Monaco exactamente igual que antes; no afecta a la selección si la hubiera.

### Paleta flotante de nodos
Cuando se activa "Añadir elemento" desde la barra, aparece una paleta flotante lateral mostrando el catálogo completo de tipos de nodo. Desde la paleta se puede arrastrar cualquier tipo hasta una posición válida del contenido para insertarlo como nodo nuevo con valores por defecto. La paleta permanece abierta hasta que se cierra desde su botón de cierre o se vuelve a clicar "Añadir elemento".

### Botón Guardar
Persiste hacia un backend externo el config activo ya aplicado y válido (`currentConfig`, el mismo que gestiona
la guardia de cambios aplicados) — nunca el buffer de Monaco sin aplicar. Disponible desde cualquier dominio de
la barra (`Layout`, `Shell`, `Api`, `Traducciones`) y en cualquiera de los dos modos (Visual/Editor).

- **Habilitación**: el botón está habilitado solo cuando la operación de guardado está declarada en la config de
  endpoints externos (ver [[local-config.md#Config de endpoints externos]]) con un `tokenId` que resuelve a un
  `tokens.*` existente en el config activo. En caso contrario permanece visible pero deshabilitado, con un
  `title` explicando la causa (operación no declarada, o token declarado sin correspondencia en `tokens.*`).
- **Atajo Ctrl+S/Cmd+S**: equivalente al click del botón. Captura el evento con `preventDefault` mientras
  `DevRuntime` está montado, para suprimir el diálogo nativo "Guardar página" del navegador — incluso cuando el
  botón está deshabilitado (el atajo siempre suprime el diálogo nativo, pero solo dispara el envío si "Guardar"
  está habilitado). El listener es global (`document`), no está acotado a que ningún panel tenga el foco.
- **Envío**: serializa `currentConfig` como JSON minificado y lo envía a la URL/`path` de la operación de
  guardado configurada, con el token resuelto como cabecera `Authorization: Bearer`.
- **Feedback**: mientras la petición está en curso, el botón queda deshabilitado y muestra un indicador
  `role="status"` ("Guardando...") — evita un segundo envío por doble click o Ctrl+S repetido. Un guardado
  exitoso muestra una confirmación `role="status"` ("Configuración guardada"). Un guardado fallido (red, HTTP,
  incluido 401/403, o un rechazo de negocio del backend) muestra un aviso `role="alert"` con el mensaje recibido
  o uno genérico — `currentConfig` no cambia en ningún caso.
- **Cambiar de página/dominio con un guardado en curso**: no cancela la petición; el resultado (éxito o error) se
  sigue mostrando cuando llegue.
- **Sin segunda validación**: `currentConfig` ya pasó `validateRuntimeConfig` al aplicarse, así que Guardar no lo
  vuelve a validar antes de enviarlo.

### Estado del editor entre modos
- **Alternar Visual ⇄ Editor sin cambiar de página**: la selección y el overlay se conservan (al volver a Editor, se ve el mismo nodo seleccionado que en la última vez que se estuvo en Editor).
- **Cambiar de página**: se limpia toda selección previa, independientemente del modo.
- **Cambiar de pestaña de dominio fuera de `Layout`**: se limpia la selección, ya que esas pestañas no contienen `layout` que editar en esta feature. Al entrar en `Shell`, `Api`, `Traducciones` o `Páginas`, el canvas, el overlay de selección y la paleta de nodos de `Layout` desaparecen del área central y se sustituyen por el panel correspondiente (ver [Sección Shell (dominio de configuración)](#sección-shell-dominio-de-configuración), [Sección Api (dominio de configuración)](#sección-api-dominio-de-configuración), [Sección Traducciones (dominio de configuración)](#sección-traducciones-dominio-de-configuración) y [Sección Páginas (dominio de configuración)](#sección-páginas-dominio-de-configuración)) hasta volver a `Layout`.

Los cambios en el editor (canvas y Monaco) persisten en memoria entre cierres y aperturas de paneles en la misma sesión. Recargar la página descarta cambios sin aplicar.

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

## Editor visual del layout

### Objetivo y alcance
Capa de edición visual del árbol `layout` mediante manipulación directa sobre el **mismo contenido real renderizado** (no un árbol duplicado, no un panel de árbol tipo "layers"), activable mediante el toggle Visual/Editor de la barra flotante. En modo Editor, el usuario edita e interactúa con el mismo árbol que renderiza el runtime en producción, sin la intermediación de una segunda copia o lienzo separado. Cubre únicamente el `layout` de una página; `tokens` queda fuera de esta entrega. `shell`, `api`/`preloads`, `translations` y `pages` (alta/baja/`initialPage`) tienen su propio panel de formulario dedicado, fuera del modelo de canvas/selección de `Layout` (ver [Sección Shell](#sección-shell-dominio-de-configuración), [Sección Api](#sección-api-dominio-de-configuración), [Sección Traducciones](#sección-traducciones-dominio-de-configuración) y [Sección Páginas](#sección-páginas-dominio-de-configuración)).

### Selector de página en la barra
El selector de página de la barra flotante cambia la página activa del runtime real (navegación por hash, con los parámetros transportados según el mecanismo estándar). Funciona en ambos modos (Visual y Editor), permitiendo ver y editar cualquier página disponible sin necesidad de cerrar el editor o cambiar de modo. Cambiar de página con un nodo seleccionado en modo Editor limpia la selección.

### Selección y hover (modo Editor)
Click sobre un nodo renderizado en modo Editor lo selecciona; hover lo resalta visualmente sin cambiar la selección. La selección se identifica por un `path` estructural resuelto contra el árbol real renderizado, no por índice DOM. Si el nodo seleccionado deja de existir en el árbol (por ejemplo, se borró desde Monaco y se aplicó), la selección se limpia automáticamente sin intentar referenciar un nodo inexistente.

### Cabecera y fila de identidad del panel de propiedades
La cabecera del panel de propiedades muestra, de arriba abajo: el breadcrumb de ancestros hasta la raíz del `layout` de la página (por ejemplo `container > form > heading`), con la etiqueta `type`, o `type (id)` cuando el nodo declara `id`, y el `type` del nodo seleccionado como titular destacado. Cada segmento del breadcrumb salvo el último (el nodo ya seleccionado, destacado y no clicable) es clicable y cambia la selección a ese ancestro, permitiendo editar las propiedades de un `container` o `form` padre y no solo de las hojas. A la derecha del titular, dos botones-icono compactos con nombre accesible explícito: eliminar nodo (ver [[#Eliminar nodo (modo Editor)]]) y cerrar (oculta el panel y limpia la selección, ver [[#Modo Editor]]).

Bajo la cabecera, y visible con cualquier pestaña del panel activa, una fila "id" en modo solo lectura muestra el `id` del nodo si lo declara, o un placeholder atenuado si no — no es editable ni enfocable como campo de formulario. El breadcrumb solo se muestra cuando el panel se monta con un árbol de página disponible; en un contexto sin él (la lista de acciones de `Shell`, ver [Sección Shell](#sección-shell-dominio-de-configuración)) la cabecera omite el breadcrumb, mostrando solo titular y botones.

### Barra de pestañas del panel de propiedades
El contenido editable del nodo seleccionado se organiza en una barra de pestañas bajo la cabecera, con semántica `tablist`/`tab`/`tabpanel` (`aria-selected` en la pestaña activa, panel asociado por `aria-controls`/`aria-labelledby`, navegación con flecha izquierda/derecha entre pestañas con ajuste circular en los extremos — activación al mover el foco). Solo se renderiza el contenido de la pestaña activa; el resto no está montado en el DOM.

Las cuatro pestañas posibles, siempre en este orden cuando existen, son `Props`, `Diseño`, `Visibilidad` y `Queries` — corresponden respectivamente a las subsecciones `props`, `layout`, `visibility` y `queryStateFeedback` del schema Zod del nodo. Una pestaña solo existe si el nodo tiene contenido para ella:
- `Props`, `Visibilidad` y `Queries` existen cuando el schema del `type` del nodo declara esa subsección.
- `Diseño` existe solo cuando el nodo seleccionado tiene al menos un `container` ancestro, a cualquier profundidad, con `props.columns` declarado; sin ese ancestro no aparece en absoluto (ver [[#Widget dedicado para layout.span (columnas por breakpoint)]]). En un contexto sin árbol de página (la lista de acciones de `Shell`) `Diseño` no existe nunca, con independencia del `type`.

La barra se muestra igual con una única pestaña disponible (por ejemplo un nodo `hidden`, cuyo schema solo declara `props`). Cada cambio de nodo seleccionado (click en el canvas, click en un segmento del breadcrumb, selección tras insertar desde la paleta) activa siempre la primera pestaña disponible del nuevo nodo — no se conserva la pestaña activa del nodo anterior. Dentro del mismo nodo, cambiar de pestaña no descarta un aviso de commit rechazado pendiente en otra pestaña (ver [[#Feedback cuando un cambio del panel de propiedades no se puede guardar]]): al volver a esa pestaña el aviso y el valor tecleado siguen visibles; solo seleccionar otro nodo los limpia.

Los bloques que escriben el nodo completo en vez de una única subsección — el [selector de modo de contenido de `link`](#selector-de-modo-de-contenido-de-link-texto--elementos-anidados), el [selector "Modo" de `container`](#widget-de-alternancia-por-segmentos-pill-toggle), el [selector "Acción de envío" de `form`](#selector-de-variante-para-uniones-discriminadas-por-type-acciones) y el [widget de filas/columnas/celdas de `table`](#selección-de-celdas-nodo-y-widget-de-filascolumnas-de-table-modo-editor) — se muestran siempre al principio de la pestaña `Props`, antes de los campos generados por el dispatcher para esa pestaña, y solo mientras `Props` está activa.

Dentro de una pestaña, cada campo simple (input de texto, input numérico, select, textarea, interruptor booleano, segmented, swatches de color) se presenta como una fila con la etiqueta a la izquierda (ancho aproximado de un tercio, con un mínimo en píxeles) y el control a la derecha ocupando el resto, sin scroll horizontal en ningún ancho de panel. Un campo booleano genérico se edita con un interruptor on/off (`role="switch"`, `aria-checked`) en vez de un checkbox nativo; el pipeline de commit y el criterio de aviso ante un commit rechazado no cambian por este control (ver [[#Feedback cuando un cambio del panel de propiedades no se puede guardar]]). Los widgets dedicados (`layout-span`, `choice-items`, icon picker, segmented, swatches de color, condición/grupo, clave-valor, acordeón de `queryStateFeedback`) conservan su presentación propia dentro de su pestaña — ver [[#Widget de alternancia por segmentos (pill toggle)]] y [[#Swatches de color por convención de nombre]] para cuándo un enum genérico pasa a uno de esos dos controles en vez de `<select>`.

### Panel de propiedades (modo Editor)
Los campos de cada pestaña se generan dinámicamente a partir del mismo JSON Schema derivado (`toJSONSchema` de Zod v4) que ya alimenta el autocompletado de Monaco — no existe un segundo contrato de UI hardcodeado por tipo de nodo. Editar cualquier campo actualiza el estado en memoria de inmediato y se refleja tanto en el contenido renderizado como en el buffer de Monaco, sin necesidad de pulsar ningún botón "Aplicar" adicional. Un campo `layout.span` declarado como mapa responsive por breakpoint se edita con merge superficial sobre el objeto existente: cambiar un breakpoint no borra los demás ya declarados que no sean visibles en el viewport actual.

Un array editable declarado con `minItems` en su schema (por ejemplo `tabs.props.items`, con mínimo de una pestaña, o `submitAction.operations` cuando la variante es `executeOperations`, con el mismo mínimo) bloquea el botón "Quitar" de cada entrada mientras la longitud actual del array sea igual a ese mínimo, para no dejar el nodo en un estado estructuralmente inválido. Al pulsar "Añadir" sobre un array de objetos, el nuevo elemento se rellena con un valor por cada propiedad `required` de su sub-schema (usando el `default` declarado en el sub-schema cuando existe, o `''`/`0`/`false` según el tipo en caso contrario) en vez de un objeto vacío. Para el nodo `tabs` en particular, cada entrada de `props.items` en este panel expone únicamente `label` y `visibility`: `children` (el subárbol de contenido de la pestaña) queda excluido del editor genérico porque no es representable como campo de formulario — ese contenido solo se edita arrastrando nodos sobre la pestaña en el canvas o directamente desde Monaco — y una pestaña nueva creada con "Añadir" recibe la etiqueta por defecto "Nueva pestaña".

Cuando la pestaña `Diseño` existe, el campo `layout.span` se edita siempre mediante su widget dedicado (ver [[#Widget dedicado para layout.span (columnas por breakpoint)]]), no como un campo numérico o de mapa genérico.

El contenido raíz de cada pestaña y cualquier grupo anidado que el editor genérico de objetos o de arrays produce (por ejemplo un campo de tipo mapa por breakpoint, o una lista de objetos como `tabs.props.items`) se muestran en lista plana, sin caja con borde ni fondo alrededor. Un grupo que ya tiene un título propio lo conserva como texto de cabecera simple (mayúsculas pequeñas, gris, sin fondo); el contenido raíz de una pestaña, cuyo título va oculto porque la pestaña activa ya cumple ese rol, no gana ningún título nuevo. Los widgets dedicados con presentación propia (`layout-span`, `choice-items`, icon picker, condición/grupo, clave-valor, acordeón de `queryStateFeedback`) conservan su propia estructura de presentación; `layout-span` y condición/grupo, además, han perdido su propia caja envolvente ([[#Widget dedicado para layout.span (columnas por breakpoint)]] y [[#Widget de condición/grupo (visibility/when)]]), coherente con la ausencia general de caja del resto del panel.

Editar cualquier campo actualiza el estado en memoria de inmediato y se refleja tanto en el contenido renderizado como en el buffer de Monaco — con la excepción de un commit rechazado por validación, ver [[#Feedback cuando un cambio del panel de propiedades no se puede guardar]].

### Selector de variante para uniones discriminadas por `type` (acciones)
Cuando el sub-schema de un campo es una unión discriminada por la propiedad literal `type` — el caso de `button.props.action`, `link.props.action` y `form.submitAction` — el panel renderiza un selector desplegable con una opción por variante (etiqueta legible en español, p. ej. "Navegar a página" para `navigateTo`, "Ejecutar operación" para `executeOperation`) más "Sin acción" cuando el campo es opcional. El catálogo de variantes ofrecidas depende únicamente del schema del nodo, sin lista paralela en el editor:
- `button.props.action`: las 7 variantes soportadas por el runtime (`navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal`, `closeModal`) más "Sin acción".
- `link.props.action`: solo `navigateTo` y `goBack` más "Sin acción".
- `form.submitAction`: solo `executeOperation` y `executeOperations` más "Sin acción". Cada entrada de sus listas opcionales `onSuccess`/`onError`, y cada entrada de `executeOperations.operations`, ofrece de nuevo las 7 variantes.

Debajo del selector se muestran únicamente los campos propios de la variante activa. Elegir una variante distinta reconstruye el valor desde cero con los valores por defecto de esa variante (ningún campo de la variante anterior sobrevive al cambio) y elegir "Sin acción" deja la propiedad completamente sin definir. Una condición `when` declarada en una entrada de `executeOperations.operations` o de `onSuccess`/`onError` se edita reutilizando el mismo [widget de condición/grupo](#widget-de-condicióngrupo-visibilitywhen) que `visibility`, sin un editor duplicado.

`form.submitAction` ("Acción de envío") es el único de los tres campos anteriores que no vive dentro del schema `props` del nodo: el panel lo muestra igualmente al principio de la subsección `Props`, antes de cualquier campo generado por el dispatcher para esa subsección — como `form` no declara ningún `props` propio, esa subsección existe únicamente para alojar este selector.

Tanto el bloque del selector ("Acción"/"Acción de envío") como, dentro de él, el sub-grupo de campos propios de la variante activa se muestran sin caja con borde ni fondo; el título del bloque se conserva como texto de cabecera simple, con el mismo estilo tipográfico que cualquier otra cabecera de grupo del panel (mayúsculas pequeñas, gris, sin fondo).

### Selector de modo de contenido de `link`: Texto / Elementos anidados
El panel de propiedades de un nodo `link` (tanto en la pestaña `Layout` como al reutilizarse dentro de la lista de
acciones de `shell.header`) muestra, al principio de la subsección `Props` — antes de sus campos generados por el
dispatcher, y solo visible mientras esa subsección está activa —, un selector "Contenido" con dos opciones: "Texto"
y "Elementos anidados". Sigue el mismo patrón visual y de
interacción que el [selector de variante para uniones discriminadas por `type`](#selector-de-variante-para-uniones-discriminadas-por-type-acciones)
de arriba, pero no es una instancia de ese mismo mecanismo: `link` no tiene un `type` discriminante en su schema
para las dos formas de contenido, así que el modo activo se detecta a partir de la forma del propio nodo —
presencia de `props.label` → "Texto"; presencia de `children` → "Elementos anidados" — en vez de leer un campo
`type` literal.

Elegir una opción reconstruye el nodo desde cero, igual que el selector de variante de acción:
- **"Texto" → "Elementos anidados"**: retira `props.label`, `props.icon` e `props.iconPosition`, y añade
  `children: []` (que activa el placeholder vacío descrito en
  [[#Contenedores, formularios y links vacíos (modo Editor)]]).
- **"Elementos anidados" → "Texto"**: retira `children` (y todo su subárbol), y añade `props.label` con el mismo
  valor por defecto que usa la paleta al crear un `link` nuevo (`"Enlace"`), sin `props.icon`.

En ambos sentidos, `props.href`, `props.download`, `props.target` y `props.action` sobreviven sin cambios: el modo
de contenido es independiente del destino del enlace. Una vez en modo "Elementos anidados", el subárbol se edita
arrastrando nodos del catálogo cerrado ya vigente para `link` (ver [[#Reglas de destino de drop (modo Editor)]] y
[[../nodes/link.md]]) sobre el placeholder vacío o entre los hijos ya existentes — igual que ya ocurre con
`container`/`form`. La paleta de nodos no cambia: sigue creando siempre un `link` nuevo en modo "Texto"; el modo
"Elementos anidados" solo se alcanza desde este selector tras la creación.

### Widget dedicado para `props.items` de `select`, `radioGroup` y `checkboxGroup`
`props.items` de estos tres nodos comparte un contrato de tres shapes (manual literal, manual escalar, dinámico unificado con `itemType`) que no encaja en el patrón de selector de variante anterior porque las variantes no comparten un discriminador `type` literal en el JSON (manual literal es un array puro, manual escalar y dinámico son objetos con claves distintas). Para este caso el panel usa un widget dedicado (`ChoiceItemsPropertyField`) en vez de los detectores genéricos del dispatcher:
- Un selector de modo con tres opciones legibles ("Manual — literal", "Manual — escalar", "Dinámico"). El modo activo se detecta a partir de la forma del propio valor: array → manual literal, objeto con `values` → manual escalar, objeto con `source` → dinámico; cualquier valor no reconocible (por ejemplo `null`) cae a manual literal vacío sin lanzar error.
- Cambiar de modo reemplaza el valor por completo con la plantilla mínima del nuevo modo (`[]`, `{ values: [] }` o `{ source: '', itemType: 'scalar' }`); no se conserva ningún campo del modo anterior.
- **Manual literal**: lista editable de pares `label`/`value` como texto libre, con controles "Añadir" y "Quitar" por entrada.
- **Manual escalar**: lista editable de valores como texto libre, con los mismos controles "Añadir"/"Quitar".
- **Dinámico**: campo `source` como texto libre, sub-selector `itemType` (`scalar`/`object`), y campos `label`/`value` que solo aparecen cuando `itemType === 'object'`. Cambiar `itemType` de `object` a `scalar` retira `label`/`value` del valor; el sentido inverso los reintroduce como campos vacíos.

Este widget no incluye picker contextual para `source`: se edita como texto plano, igual que el resto de referencias string del panel.

El dispatcher se apoya para esto en un hook `x-widget`: si el fragmento de schema efectivo declara `{ 'x-widget': 'choice-items' }`, delega la edición completa en `ChoiceItemsPropertyField` antes de aplicar cualquier patrón genérico. El hook resuelve contra un registro cerrado dentro del propio dispatcher (sin API para inyectar widgets desde fuera); cualquier otro valor de `x-widget`, o su ausencia, deja el campo en los patrones genéricos de siempre. Para llegar hasta ahí, el panel de propiedades sustituye el sub-schema `items` derivado de Zod por ese sentinel solo en la subsección `Props` de `select`, `radioGroup` y `checkboxGroup` (mismo precedente que `resolveTabsPropsSchema` para `tabs.props.items`); el schema que consume Monaco no cambia y sigue siendo el Zod real con el `oneOf` completo.

### Widget dedicado para `layout.span` (columnas por breakpoint)
`layout.span` (entero plano o mapa responsive por breakpoint) se edita en la subsección `Layout` con un widget dedicado (`LayoutSpanPropertyField`, registrado en el mismo `WIDGET_REGISTRY` del dispatcher bajo `'layout-span'`) en vez del campo numérico/mapa genérico, reutilizando el mismo hook `x-widget` que `choice-items`.

- **Visibilidad**: la subsección `Layout` completa (no solo `span`) solo se muestra cuando el nodo seleccionado tiene al menos un `container` ancestro, a cualquier profundidad, con `props.columns` declarado (fijo o responsive). Sin ese ancestro no hay ningún campo de respaldo para `layout.span` — ni el widget ni el editor genérico —, la subsección desaparece por completo del panel. El contenedor de referencia es siempre el `container` ancestro más cercano en el árbol, no el primero encontrado subiendo niveles.
- **Seis inputs en una sola fila**: las seis claves `base`, `sm`, `md`, `lg`, `xl`, `2xl`, en ese orden, se muestran como seis inputs numéricos horizontales, con el nombre del breakpoint como label debajo de cada uno, tenga o no valor explícito. Sin cabecera `fieldset` con caja: el título "Columnas" es texto de cabecera simple. No hay indicador `/ N` por input — el denominador de columnas efectivo del `container` ancestro solo aparece en la leyenda de la barra de vista previa de ocupación (ver más abajo), resuelto con la misma cascada mobile-first que ya usa el runtime para `container.props.columns` responsive (ver [[../nodes/container.md#reglas-de-render]]) — sin una segunda implementación de esa cascada.
- **Valor heredado vs. explícito**: un input sin clave propia en el mapa de `layout.span` muestra en estilo atenuado el valor resultante de aplicar al propio `layout.span` esa misma cascada mobile-first (heredado del breakpoint declarado anterior más cercano, o `1` si ninguno lo está) y no muestra el control "×". Editar un input fija su valor como clave explícita (merge superficial `{ ...value, [breakpoint]: n }`) y hace aparecer un control "×" superpuesto en su esquina; pulsarlo borra la clave y el input vuelve a mostrar su valor heredado en gris. Quitar la única clave explícita restante commitea `layout.span` como `undefined` en vez de dejar un mapa vacío `{}`.
- **Conversión entero → mapa**: si `layout.span` es un entero plano al montar el widget, la primera edición de cualquier fila lo convierte a mapa responsive sembrando `{ base: <entero previo> }` antes de aplicar el cambio del usuario sobre esa base.
- **Validación por fila**: cada valor se valida con el mismo pipeline (`validateRuntimeConfig`) que el resto del panel antes de aplicarse. Un commit rechazado (por ejemplo, fuera de rango `1..N` para ese breakpoint) conserva el valor tecleado en esa fila y muestra un aviso `role="alert"` con el código y mensaje del error, con el mismo criterio de limpieza que el resto del panel (ver [[#Feedback cuando un cambio del panel de propiedades no se puede guardar]]): desaparece al guardar correctamente esa misma fila o al cambiar de nodo seleccionado. El aviso es independiente por fila.
- **Fuera de alcance**: el widget nunca ofrece un control para "simplificar" un `layout.span` ya convertido a mapa de vuelta a un único entero; un `layout.span` que siga siendo entero plano solo puede editarse como tal desde Monaco.
- **Barra de vista previa de ocupación**: bajo la fila de seis inputs, una barra horizontal dividida en `N` segmentos
  (el denominador resuelto del `container` ancestro en el breakpoint previsualizado) muestra resaltados los primeros
  `span` segmentos, junto a una leyenda de texto ("Vista previa en {breakpoint}: ocupa {span} de {N}.") — único lugar
  donde se ve el denominador `N`, ya que los inputs no lo muestran individualmente. El breakpoint previsualizado es
  `base` por defecto; dar foco a uno de los seis inputs cambia la vista previa a su breakpoint mientras el foco
  permanezca ahí, y perderlo (sin que otro input del mismo widget lo capture) la devuelve a `base`. Es estado
  puramente visual del widget: cambiar de pestaña, de nodo seleccionado o de breakpoint previsualizado no dispara
  ningún commit adicional. Un span resuelto mayor que `N` (posible si el `container` reduce sus columnas en un
  breakpoint superior sin que `layout.span` se haya ajustado) no desborda la barra: el recuento de segmentos
  resaltados se recorta a `N`, pero la leyenda sigue mostrando el `span` real sin recortar. Un `layout.span` como
  entero plano (sin mapa por breakpoint) sigue mostrando la vista previa para `base`, coherente con el valor uniforme
  heredado en los seis inputs, y sin ningún "×" visible.

### Widget de alternancia por segmentos (pill toggle)
Un control reutilizable (`SegmentedTogglePropertyField`) cubre cualquier prop con catálogo cerrado y estable de 2 a 5
opciones: una fila de segmentos dentro de un contenedor tipo píldora, un segmento por opción, con el segmento activo
resaltado frente a los inactivos y, opcionalmente, un icono Lucide a la izquierda de la etiqueta de cada segmento.
Implementa la semántica ARIA `radiogroup`/`radio` con roving tabindex (solo el segmento activo, o el primero si
ninguno lo está, es parada de `Tab`) y navegación con flecha izquierda/derecha que mueve el foco al segmento
adyacente y lo selecciona de inmediato, con ajuste circular en ambos extremos. Un `activeValue` nulo (ningún
segmento activo) es un estado válido que el control nunca infiere por sí mismo — lo decide cada integración concreta
a partir de la forma del nodo o del valor de la prop. Cada selección sigue el mismo pipeline de commit/validación y
el mismo criterio de aviso `role="alert"` que el resto del panel (ver
[[#Feedback cuando un cambio del panel de propiedades no se puede guardar]]).

Además de los tres usos fijos descritos abajo, el dispatcher genérico de propiedades usa el mismo componente para
cualquier campo de tipo `enum` cuyo catálogo declare entre 2 y 5 valores (ambos inclusive), en cualquier pestaña
(`Props`/`Diseño`) y cualquier tipo de nodo, siempre que ese campo no resuelva ya a un widget dedicado del
`WIDGET_REGISTRY` (`layout-span`, `choice-items`, `icon`, `heading-level`, `tabs-orientation`, `condition-group`) ni
a la convención de nombre de las [swatches de color](#swatches-de-color-por-convención-de-nombre) — esas rutas de
resolución son mutuamente excluyentes con esta y tienen prioridad. Un enum de 1 o de 6+ valores no se ve afectado y
sigue como `<select>`. A diferencia de los tres usos fijos siguientes (que no van en fila y no muestran ningún label
visible, por ser bloques especiales fuera de la iteración genérica de campos), este uso genérico se presenta dentro
de la misma fila label-izquierda/control-derecha que cualquier otro campo simple del dispatcher, con el segmento
etiquetado tal cual el valor literal del enum (sin traducción). Ejemplos existentes cubiertos por esta regla:
`container.props.align`/`wrap`/`variant`, `modal.props.size`, `button.props.variant`, `badge.props.variant`,
`stat.props.variant`, `divider.props.variant`, `skeleton.props.variant`, `toggle.props.labelPosition`.

Tres usos concretos en el panel de propiedades comparten además este componente de forma fija, sin pasar por la
regla genérica anterior (bloques especiales, sin fila ni label visible):
- **`container` — "Modo" (Grid / Columnas)**: se muestra al principio de la subsección `Props`, antes de sus campos
  generados por el dispatcher y solo visible mientras esa subsección está activa — mismo lugar y mismo alcance de
  escritura de nodo completo que el
  [selector de modo de contenido de `link`](#selector-de-modo-de-contenido-de-link-texto--elementos-anidados). El
  segmento activo se detecta por la presencia de `props.columns` (declarado, fijo o responsive → "Columnas";
  ausente → "Grid"), sin considerar `direction`. Pulsar "Columnas" desde "Grid" siembra `props.columns: 2` (entero
  fijo), preservando el resto de `props` (incluida `direction`, si existía). Pulsar "Grid" desde "Columnas" quita
  `props.columns` por completo, sin tocar `direction` ni el resto de `props`. Un `props.columns` responsive no se
  recuerda: alternar a "Grid" y de vuelta a "Columnas" siembra de nuevo `2` como entero fijo, no el mapa anterior.
  Mientras el segmento activo es "Columnas", el campo/widget ya existente para editar el valor concreto de
  `columns` sigue visible en `Props`; mientras es "Grid", ese campo desaparece por completo de `Props` en vez de
  mostrarse vacío o inválido.
- **`heading` — "Nivel" (H1..H5)**: widget `x-widget: 'heading-level'` en la subsección `Props`, sustituye el campo
  numérico genérico de `props.level`. Cinco segmentos fijos sin icono (solo etiqueta de texto), mapeados a los
  enteros `1` a `5`. Un `props.level` igual a `6` o cualquier otro valor fuera de `1..5` deja el widget sin ningún
  segmento activo; ese nivel solo es editable desde Monaco.
- **`tabs` — "Orientación" (Horizontal / Vertical)**: widget `x-widget: 'tabs-orientation'` en la subsección
  `Props`, sustituye el campo genérico de `props.orientation`. Dos segmentos con icono Lucide. Si el nodo no
  declara `orientation` (default `"horizontal"` del runtime, ver [[../nodes/tabs.md]]), el widget muestra
  "Horizontal" activo sin que eso implique que la clave se escribe explícitamente al reseleccionar ese mismo
  segmento.

### Swatches de color por convención de nombre
Cualquier propiedad dentro de `props` cuyo nombre de campo sea literalmente `color` y cuyo schema declare un `enum`
se edita con una fila de muestras de color (`ColorSwatchPropertyField`) en vez de `<select>` o segmented, con
independencia del número de opciones de ese enum — a diferencia de la regla genérica de segmented de arriba, esta
convención de nombre tiene prioridad y no está sujeta al rango 2-5. Cubre hoy `stat.props.color` y
`badge.props.color`; un campo `type` con el mismo catálogo de valores pero otro nombre (por ejemplo
`alert.props.type`) no la cumple y sigue las reglas genéricas normales (`<select>` o segmented según su cardinalidad).

- **Enganche**: mismo hook `x-widget` del dispatcher (clave `'color-swatch'` en `WIDGET_REGISTRY`), inyectado por
  convención de nombre de campo (`resolveColorSwatchPropsSchema`) igual que el widget de icono — sin lista explícita
  de tipos de nodo que mantener. Solo aplica si el campo `color` declara un `enum`; un `color` con otra forma queda
  fuera de esta regla.
- **Paleta fija**: seis muestras siempre en el mismo orden — `neutral`, `primary`, `success`, `warning`, `danger`,
  `info` — con independencia del orden o el número de opciones del `enum` real del campo. Es una paleta propia del
  editor, declarada de forma independiente de la resolución de estilos del runtime de producción (aunque
  visualmente coherente con el catálogo semántico que ya comparten `stat.props.color`/`badge.props.color`/
  `button.props.color`); si la paleta semántica de producción cambia en el futuro, esta paleta del editor no se
  actualiza automáticamente.
- **Selección**: click, o `Enter`/flecha izquierda-derecha con foco en una muestra, aplica ese nombre con el mismo
  pipeline de commit/validación que el resto del panel. La muestra activa se distingue con un anillo; junto a la
  fila se muestra como texto el nombre semántico actualmente seleccionado (por ejemplo "primary").
- **Accesibilidad**: `role="radiogroup"`/`role="radio"` con `aria-checked` por muestra y `aria-label` igual al
  nombre semántico (no solo el color visual), con roving tabindex (la muestra activa, o la primera si ninguna lo
  está, es la única parada de `Tab`) y navegación circular con flecha izquierda/derecha — misma semántica que
  `SegmentedTogglePropertyField`, aunque el componente no lo reutiliza directamente (pinta un color sólido por
  muestra en vez de un icono+texto).
- **Valor fuera de catálogo**: un valor de `color` presente en el config pero fuera de las seis muestras fijas (por
  ejemplo editado a mano en Monaco) no bloquea el panel: ninguna muestra se marca activa y no se muestra ningún
  texto de nombre semántico junto a la fila.

### Widget de búsqueda y selección de iconos Lucide
Un componente compartido (`IconPickerPropertyField`) sustituye el input de texto libre en todo campo `icon` del
panel: input de búsqueda más una cuadrícula de resultados con el icono ya renderizado y su nombre, en vez de
tener que conocer o adivinar el nombre exacto en PascalCase. Es puramente presentacional (`{ label, value,
onChange }`, sin conocimiento propio de `x-widget` ni de los schemas de `Shell`) y se monta desde dos vías
distintas sin duplicar su lógica de filtrado, preview o commit (ver [[#Integración en `Layout`]] y
[[#Integración en `Shell`]] más abajo). El buscador se monta dentro de la misma fila label-izquierda/control-derecha
(`PropertyFieldRow`) que usan los campos genéricos de texto/número/enum/booleano: el `label` recibido queda a la
izquierda, con el buscador y el chip de previsualización a la derecha; la cuadrícula, al abrirse, se sigue
desplegando debajo a todo el ancho de la fila.

- **Catálogo**: derivado una sola vez al cargar el módulo desde el registro canónico `icons` de `lucide-react`
  (no su namespace completo, que además expone un alias `Icon`-suffixed por cada icono — p. ej. `Home` y
  `HomeIcon` resuelven al mismo componente — y helpers no-icono como `createLucideIcon`) — mismo criterio de
  validez que ya usa `IconNode` para resolver nombre→componente en el runtime.
- **Apertura bajo demanda**: la cuadrícula permanece desmontada por defecto, con independencia del valor actual,
  y solo aparece al enfocar el input de búsqueda (`aria-haspopup="grid"`/`aria-expanded`). Mientras está cerrada,
  un chip de previsualización (icono ya renderizado + nombre) sigue mostrando el valor actualmente reconocido
  junto al input, si lo hay — es la única señal visible del valor con la cuadrícula oculta.
- **Filtro**: substring case-insensitive sobre el nombre; sin coincidencias, la cuadrícula queda vacía sin
  ningún mensaje de error y el input sigue editable. Cambiar el texto de búsqueda siempre reinicia a la primera
  página del nuevo resultado filtrado.
- **Cuadrícula paginada**: 4 columnas fijas, 60 celdas por página — el catálogo completo (del orden de mil
  setecientas entradas) no se monta de una sola vez. Los controles "Anterior"/"Siguiente" solo aparecen cuando
  el resultado visible ocupa más de una página.
- **Selección**: click o `Enter` sobre una celda aplica ese nombre con el mismo pipeline de commit/validación
  (`validateRuntimeConfig`) que el resto del panel. Reseleccionar la celda ya activa no repite el commit
  (idempotente, sin `onChange`), pero sigue cerrando la cuadrícula y devolviendo el foco al input de búsqueda,
  igual que cualquier otra selección.
- **Accesibilidad de tipo grid**: `role="grid"`/`role="row"`/`role="gridcell"` con `aria-selected` en la celda
  activa — no `listbox` lineal — y roving tabindex (la celda seleccionada, o la primera si ninguna lo está, es
  la única parada de `Tab`). Navegación en dos ejes dentro de la página visible: flecha izquierda/derecha entre
  celdas de la misma fila, arriba/abajo entre filas de la misma columna, con clamp en los bordes de la página
  (sin wraparound ni avance automático a la página siguiente/anterior). `ArrowDown` desde el input abre la
  cuadrícula si estaba cerrada y mueve el foco a la primera celda visible en una sola interacción. `Escape`
  (desde el input o desde cualquier celda) cierra la cuadrícula y devuelve el foco al input sin aplicar ningún
  cambio; un click fuera del widget también la cierra, sin mover el foco.
- **Valor actual no reconocido**: si no coincide con ningún nombre del catálogo, se muestra sin preview de
  icono — misma degradación silenciosa que en producción — conservando el texto en una nota "Valor actual: …",
  sin ninguna celda resaltada ni bloqueo de la búsqueda ni del resto del panel.
- **Control de limpieza**: botón "Quitar icono" visible siempre que el valor sea un string no vacío; aplica
  `undefined` al pulsarlo.

#### Integración en `Layout`
El hook `x-widget` del dispatcher (`WIDGET_REGISTRY`, clave `'icon'`) resuelve a este widget, pero a diferencia
del resto de entradas de ese registro (`layout-span`, `heading-level`, `tabs-orientation`, `choice-items`, todas
activadas por `node.type`), el sentinel `{ 'x-widget': 'icon' }` se inyecta por convención de nombre de campo
(`resolveIconPropsSchema`): cualquier nodo cuyo schema `props` generado declare una propiedad `icon` recibe el
widget, sin una lista explícita de tipos que mantener. Cubre hoy los seis nodos que ya declaran `props.icon`
(`button`, `heading`, `paragraph`, `link`, `stat`, `input`); un nodo futuro que reutilice esa misma forma
(`icon: z.string().optional()`) lo hereda automáticamente sin cambios en el dispatcher.

#### Integración en `Shell`
`MenuItemFieldsEditor` y `SidebarItemFieldsEditor` (ver [Sección Shell](#sección-shell-dominio-de-configuración))
montan el mismo componente directamente para el campo `icon` de `menuItem`/`menuItemChild` y `sidebarItem`,
sustituyendo su input de texto libre anterior — el hook `x-widget` es exclusivo del dispatcher de `Layout`, así
que aquí la integración es una sustitución de componente directa, no un registro adicional. Mismo comportamiento
de filtro, selección y limpieza que en `Layout`, con el mismo pipeline de commit del panel `Shell` (ver
[Pipeline de commit](#pipeline-de-commit)).

### Widget de condición/grupo (`visibility`/`when`)
Un componente compartido (`ConditionGroupPropertyField`) sustituye el editor genérico anterior para la forma unión
condición/grupo que usan `node.visibility`, `when` de `executeOperations.operations`/`onSuccess`/`onError` (ver
[selector de variante para uniones discriminadas por `type`](#selector-de-variante-para-uniones-discriminadas-por-type-acciones))
y `visibility` de `menuItem`/`menuItemChild`/`sidebarItem` en `Shell` — mismo componente en las tres superficies,
sin editor duplicado ni lógica de detección de forma, de edición de condición o de edición de `value` repetida
entre ellas (ver [[../references/visibility.md]] para el contrato funcional completo de esta forma).

- **Enganche**: mismo hook `x-widget` del dispatcher de `Layout` que ya usan `choice-items`/`layout-span`/
  `heading-level`/`tabs-orientation`/`icon` (clave `'condition-group'` en `WIDGET_REGISTRY`). El sentinel
  `{ 'x-widget': 'condition-group' }` sustituye cualquier propiedad llamada literalmente `visibility` o `when` en
  el JSON Schema derivado, en el origen cacheado (`getNodeTypeJsonSchema` para `Layout`; `getMenuItemJsonSchema` y
  `getSidebarItemJsonSchema` para `Shell`), recorriendo `properties`/`items`/`oneOf`/`anyOf`/`$defs` — incluida la
  rama recursiva de `sidebarItem.children` a cualquier profundidad. El schema que consume Monaco no se toca: sigue
  mostrando el `oneOf` real completo, mismo criterio que el resto de widgets de este registro.
- **Sin caja, labels sin prefijo de contexto**: el widget no se envuelve en ningún `fieldset` con borde/fondo, ni a
  nivel raíz ni por condición individual dentro de un grupo — solo cabeceras de texto simple y espaciado vertical.
  El selector de forma se muestra como "Forma" sueltamente (nunca `"${label} — Forma"`); en modo "Grupo (y/o)", el
  selector de operador del grupo se muestra como "Operador del grupo". Ninguno de los campos internos del widget
  lleva el prefijo `"${label} — Campo"` que tenía antes, con independencia del punto de montaje (pestaña
  Visibilidad, `when` de operaciones, `visibility` de `menuItem`/`sidebarItem` en `Shell`).
- **Selector de forma**: dos opciones explícitas ("Condición simple", "Grupo (y/o)"), visibles siempre que se edita
  un valor de esta forma. La opción activa se detecta a partir de la forma del propio `value` al montar (un objeto
  con `conditions` y `operator` en `and`/`or` → grupo; cualquier otro caso, incluido valor ausente → condición
  simple), sin reutilizar `resolveUnionBranch`. Cambiar de "Condición simple" a "Grupo (y/o)" construye un grupo
  `and` con la condición actual como única fila; cambiar de "Grupo (y/o)" a "Condición simple" aplica la primera
  condición del grupo como nuevo valor, descartando el resto de filas si había más de una.
- **Grupo (y/o)**: control de dos segmentos (`SegmentedTogglePropertyField`) para el `operator` del grupo
  (`and`/`or`), y una fila por condición de `conditions`. Cada fila muestra una cabecera de texto simple "Condición
  N" (N = posición 1-indexada) en vez de repetir el prefijo en cada campo interno, sin borde individual alrededor de
  la fila — la separación entre condiciones la da la cabecera más el espaciado vertical. Botón "Añadir" al final que
  agrega una condición con valores mínimos válidos; botón "Quitar" por fila, deshabilitado mientras `conditions`
  tenga longitud 1 (un grupo no puede quedar vacío; sigue mostrando "Condición 1" aunque el botón esté deshabilitado).
  Sin límite superior de filas.
- **Fila de condición** (compartida entre "Condición simple" y cada fila de grupo): en modo "Condición simple" los
  campos internos quedan sueltos, sin cabecera "Condición N" (esa cabecera solo aparece por fila dentro de un
  grupo). `reference` (texto) y `negate` (booleano) siempre visibles; selector de `operator` con el catálogo
  completo (`equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan`, `lessThan`, `arrayContains`); `itemField`
  (texto) visible únicamente con `operator: 'arrayContains'`; `value` visible con cualquier `operator` salvo
  `isTruthy`/`isFalsy`.
- **Editor de `value`**: con `operator` en `equals`/`notEquals`/`arrayContains`, un selector de cuatro tipos
  (Texto/Número/Booleano/Null, mismo `SegmentedTogglePropertyField`) detectado por el tipo JS del valor actual
  (string/number/boolean/null; ausente o no reconocible degrada a Texto vacío sin convertir el valor previo) con el
  control correspondiente debajo (input de texto, input numérico, control booleano de dos estados, o ningún campo
  para Null); cambiar de tipo reconstruye `value` con el valor por defecto de ese tipo (`''`, `0`, `false`, `null`).
  Con `operator` en `greaterThan`/`lessThan`, `value` se edita directamente como input numérico simple, sin
  selector de tipo.
- **Reconstrucción al cambiar de `operator`** de una fila: a `isTruthy`/`isFalsy` elimina `value` (queda ausente,
  no `undefined`); a `arrayContains` desde otro operador siembra `value: ''` si no había ya un valor válido, sin
  tocar `itemField`; desde `arrayContains` a cualquier otro elimina `itemField` si estaba declarado; a
  `greaterThan`/`lessThan` con un `value` que no sea ya numérico lo reconstruye a `0`. Entre `equals`/`notEquals`/
  `arrayContains` entre sí, `value` se conserva tal cual.
- **Commit y validación**: cada cambio (forma, operador de grupo, alta/baja de fila, cualquier campo de una fila,
  tipo o contenido de `value`) sigue el mismo pipeline (`validateRuntimeConfig`) y el mismo criterio de aviso
  `role="alert"` ante un commit rechazado que el resto del panel (ver
  [Feedback cuando un cambio del panel de propiedades no se puede guardar](#feedback-cuando-un-cambio-del-panel-de-propiedades-no-se-puede-guardar)
  y, para `Shell`, [Feedback cuando un cambio no se puede guardar](#feedback-cuando-un-cambio-no-se-puede-guardar)).
- **Fuera de alcance**: no anida grupos dentro de grupos (el contrato no lo soporta); `reference` sigue como texto
  libre, sin picker contextual.

### Editor clave-valor (`params`, `query`, `headers`, `body`)
Los campos de tipo mapa abierto `string → string` (`navigateTo.params`, y `query`/`headers` de `executeOperation`/`executeOperations`, de cada operación del panel `Api` y de cada entrada de `preloads`) se editan con un formulario de filas clave-valor: cada fila tiene un input de clave y un input de valor, con un botón "Quitar" por fila y un botón "Añadir" al final que crea una fila con clave y valor vacíos. Renombrar la clave de una fila conserva su valor; todos los valores se tratan como texto plano (sin coerción a número o booleano), lo que ya cubre literales, interpolación `{{...}}` y referencias dinámicas.

`body` (de `executeOperation`/`executeOperations`, de una operación del panel `Api` o de una entrada de `preloads`) usa el mismo editor con una excepción por clave: si el valor actual de una clave concreta ya es un array o un objeto anidado, esa fila muestra el mismo textarea de solo lectura que el editor usa como último recurso para cualquier valor no representable como campo de formulario, sin afectar al resto de claves de ese mismo `body` ni al selector de variante. Añadir una clave nueva siempre la crea como texto vacío.

El criterio de qué fila es editable como texto plano frente a solo lectura es configurable por punto de montaje del widget compartido (`KeyValuePropertyField`): por defecto (`query`, `headers`, `body`) solo un valor anidado (objeto o array) degrada a solo lectura, igual que se describe arriba. `navigateTo.params` (`NavigateParamsPropertyField`) usa un criterio más estricto: cualquier valor que no sea ya un string (number, boolean, null, además de objeto/array) degrada esa fila concreta a solo lectura, sin afectar a la edición del resto de filas del mismo `params` — un `navigateTo.params` con algún valor no-string (por ejemplo, editado a mano en Monaco) no rompe el editor.

### Acordeón dedicado para `queryStateFeedback.states` (pestaña `Queries`)
La subsección `states` de la pestaña `Queries` (`queryStateFeedback.states`) se edita con un widget dedicado (`QueryStateFeedbackAccordionPropertyField`, registrado en el mismo `WIDGET_REGISTRY` del dispatcher bajo `'query-state-feedback-accordion'`) en vez del editor genérico de objeto, siguiendo el mismo hook `x-widget` que `layout-span`/`choice-items`. El campo `query` (nombre de la query observada) no cambia: sigue siendo la primera fila de la pestaña, como campo de texto simple, ajeno a este widget. Ver [[../references/query-state-feedback.md]] para el contrato funcional completo de `queryStateFeedback` (sin cambios en esta feature).

- **Filas explícitas por estado presente**: el acordeón muestra una fila por cada clave ya presente en `states`, siempre en el orden fijo `idle → loading → error → empty → success` con independencia del orden de declaración en el JSON — nunca las cinco claves posibles de golpe. Un `states` ausente o vacío no muestra ninguna fila.
- **Alta bajo demanda**: un selector "Añadir estado…" al final del acordeón ofrece solo las claves de `states` que todavía no están presentes; queda deshabilitado (sin desmontarse) cuando las cinco ya están presentes. Añadir una clave la inserta con el modo por defecto que reproduce el comportamiento implícito ya vigente para ese estado (`success` → `Mostrar`; `idle`/`loading`/`error`/`empty` → `Ocultar`, misma tabla que ya describe [[../references/query-state-feedback.md]]), de forma que el commit no cambia comportamiento visible hasta que el usuario elija otro modo, y la fila nueva se expande automáticamente.
- **Quitar una fila**: cada fila tiene un botón "Quitar" con nombre accesible propio (`Quitar estado {state}`) que borra esa clave de `states` — vuelve al comportamiento implícito para ese estado — y hace desaparecer la fila. Quitar la última fila presente commitea `queryStateFeedback` sin la clave `states` en absoluto, nunca un objeto vacío `{}`.
- **Fila expandible/colapsable**: la cabecera de cada fila es un botón con `aria-expanded` reflejando su estado, operable con `Enter`/`Espacio` como cualquier botón nativo, y hermano (no anidado) del botón "Quitar" de esa misma fila. Colapsar una fila no descarta su modo ni su contenido; solo oculta el selector de modo. Las filas ya presentes al montar el widget arrancan expandidas.
- **Selector de modo por fila** (widget de segmentos ya descrito en [[#Widget de alternancia por segmentos (pill toggle)]]): las tres opciones `Mostrar`/`Ocultar`/`Fallback` siempre visibles y seleccionables, reflejando el modo actual de esa regla. Un `mode` fuera de catálogo (por ejemplo, introducido a mano en Monaco) no rompe el widget ni el resto del acordeón: la fila se muestra sin ningún segmento activo hasta que el usuario elige uno explícitamente.
- **`Fallback` presente pero inerte**: elegir `Fallback` en una fila es una acción válida que commitea `{ mode: 'fallback', fallback: [...] }`. Si la regla de esa fila ya tenía un array `fallback` (por ejemplo editado antes desde Monaco), se preserva sin cambios; si no había ninguno, se usa `fallback: []`. Mientras el modo está activo, la fila muestra una nota fija ("El contenido de fallback todavía no se edita desde este panel. Usa el editor Monaco para modificarlo.") sin ningún control de inserción, edición o borrado de nodos — insertar/editar/reordenar/borrar el contenido de `fallback` queda fuera de alcance de esta entrega, diferido a una futura que reutilice o no el canvas de arrastrar-soltar fuera del árbol principal de `layout`.
- **El array `fallback` sobrevive a un ida-y-vuelta de modo sin pasar por Monaco**: cambiar una fila de `Fallback` a `Mostrar` u `Ocultar` y volver después a `Fallback` dentro de la misma sesión de edición del nodo conserva el mismo array `fallback` que tenía antes de salir de ese modo, aunque el modo intermedio no lo llevara en el config. Esto se sostiene con una caché de `fallback` por estado (`fallbackCacheByState`) que vive en `LayoutCanvasPropertiesPanel`, no en el propio widget, junto con el conjunto de filas expandidas (`expandedStates`) — ambos expuestos al widget vía un contexto propio (`QueryStateFeedbackAccordionWidgetContext`). Igual que la expansión/colapso, esta caché sobrevive a un cambio de pestaña dentro del mismo nodo (el widget se desmonta al cambiar de pestaña, por eso no puede vivir en su propio `useState`) pero se reinicia por completo al cambiar de nodo seleccionado — nunca se filtra de un nodo a otro.
- **Commit y validación**: cada cambio (añadir/quitar fila, cambiar de modo) sigue el mismo pipeline (`validateRuntimeConfig`) y el mismo criterio de aviso `role="alert"` ante un commit rechazado que el resto del panel — ver [[#Feedback cuando un cambio del panel de propiedades no se puede guardar]]. Un commit rechazado conserva el cambio tal como lo dejó el usuario en el acordeón, sin revertir en silencio.

### Feedback cuando un cambio del panel de propiedades no se puede guardar
Cada pestaña del panel (`Props`, `Diseño`, `Visibilidad`, `Queries`) valida su cambio contra el config completo antes de aplicarlo, igual que el resto de mutaciones del canvas. Si el commit se rechaza — por ejemplo, al elegir una variante de acción cuyo campo obligatorio (`operationName`, `pageId`, `formId`, `modalId`) queda vacío hasta que el usuario lo rellena — el campo no revierte en silencio a su valor anterior: sigue mostrando el cambio tal cual lo dejó el usuario, y justo debajo aparece un aviso (`role="alert"`) con el código y el mensaje del error de validación. El aviso desaparece en cuanto un cambio posterior de esa misma pestaña se guarda correctamente, o al seleccionar otro nodo — cambiar a otra pestaña y volver no lo descarta (ver [[#Barra de pestañas del panel de propiedades]]). El config aplicado (`currentConfig` y el buffer de Monaco) no cambia mientras el aviso esté visible — el gate de validación que ya usa el botón Aplicar de Monaco no se relaja en ningún caso.

### Reordenar y reanidar por arrastre (modo Editor)
En modo Editor, arrastrar un nodo existente permite reordenarlo entre hermanos o reanidarlo bajo un `container`/`form`/`modal`/`link`/`accordion`/`tabs` distinto del árbol real renderizado. Un destino que violaría alguna regla estructural se señala visualmente como inválido durante el arrastre (indicador de color) y no se acepta al soltar; el `layout` no cambia en ese caso.

Dentro de un `container` con `props.columns` (modo grid, fijo o responsive por breakpoint), los hijos reales conservan siempre la misma posición de columna/fila que en modo Visual: las zonas de inserción del editor nunca ocupan una celda del grid. En vez de participar en el flujo del grid como un hijo más, las zonas se renderizan como una capa overlay superpuesta (`position: absolute`, sin afectar al flujo) medida a partir de la posición real de los hijos. Un `container` en modo grid con `N` hijos expone `N + 1` zonas de inserción: una antes del primer hijo, una después del último y una entre cada par de hijos consecutivos, igual que ya ocurre en contenedores sin `columns`.

Cada zona se muestra como una barra vertical fina (no como la franja horizontal de ancho completo de un contenedor apilado), con la altura de los elementos de la fila donde se ubica:
- La zona antes del primer hijo se ancla al borde izquierdo de ese hijo, con la altura de su fila.
- La zona después del último hijo se ancla al borde derecho de ese hijo, con la altura de su fila.
- Una zona intermedia entre dos hijos de la misma fila se centra en el hueco entre ambos, con la altura del hijo situado a su derecha.
- Una zona intermedia entre el último hijo de una fila y el primero de la fila siguiente (salto de fila por wrap) se ancla al borde izquierdo de ese primer hijo de la fila siguiente, comunicando que la inserción ocurre al principio de esa fila.

Insertar o reordenar un nodo sobre cualquiera de estas zonas (límite o intermedia) coloca el nodo en esa posición ordinal exacta dentro de la colección de hermanos, sin desplazar la posición de columna/fila de ningún otro hijo real respecto al modo Visual. Esto aplica tanto a reanidar un nodo ya existente del árbol como a insertar uno nuevo desde la paleta. Un `container` sin `columns` (flex/row o apilado vertical) no cambia: conserva el mismo número y orientación de zonas de inserción que tenía antes.

### Paleta flotante de nodos (modo Editor)
Cuando se abre "Añadir elemento" desde la barra, aparece una paleta flotante mostrando el catálogo completo de tipos de nodo soportados con una etiqueta legible. Arrastrar una entrada de la paleta hasta una posición válida del contenido renderizado inserta ahí una instancia mínimamente válida de ese tipo (valores por defecto estáticos y literales, sin referencias dinámicas ni dependencia de queries o formularios existentes), sujeta a las mismas reglas de destino que el reordenamiento. La paleta permanece abierta hasta que se cierra.

### Panel de inserción: `repeater`, `accordion`, `tabs` y `modal` en modo Editor
Estos cuatro nodos gestionan su propio subárbol de forma especial en modo Editor sobre el árbol real:
- **`repeater`**: se muestra como exactamente una instancia editable de `props.template` (con el primer elemento real de la colección resuelta como contexto `item.*` si hay datos, o un contexto vacío si la colección está vacía), sin controles de paginación. No se editan instancias repetidas por separado; cualquier edición dentro de esa instancia se escribe siempre sobre `props.template`.
- **`accordion`**: su cuerpo y sus `children` están siempre presentes en el DOM, con independencia de `defaultOpen` o de si se ha clicado la cabecera (en producción, un accordion colapsado no renderiza su contenido). La cabecera sigue alternando `aria-expanded` con normalidad.
- **`modal`**: su panel y sus `children` están siempre presentes en el DOM, con independencia de `defaultOpen` o de si se ha disparado `openModal` (en producción, un modal cerrado no renderiza nada).
- **`tabs`**: no se fuerza ninguna visibilidad adicional (el usuario ya puede cambiar de pestaña con la cabecera interactiva, que sigue funcionando igual); solo se garantiza que los nodos de la pestaña activa direccionan correctamente sus mutaciones.

**Limitación conocida**: un `tabItem` de `tabs` o un cuerpo de `accordion` completamente vacíos (sin ningún hijo) todavía no exponen una zona droppable propia equivalente al placeholder de contenedores vacíos descrito abajo; para insertar el primer nodo en esos casos hace falta arrastrar hasta un hijo ya existente de esa pestaña/cuerpo, o editar el JSON desde Monaco.

### Selección de celdas-nodo y widget de filas/columnas de `table` (modo Editor)
Una celda-nodo (`image`, `list`, `button`, `container`, `heading`, `paragraph` o `link` — ver [[../nodes/table.md]]) de una `table` gana un path estructural propio por posición fila/columna (modo manual) o por columna-plantilla (modo dinámico), al mismo nivel que ya tienen `template` de `repeater` o `tabItem` de `tabs`. Antes de esta capacidad, todas las celdas-nodo de todas las `table` de la página compartían un path vacío: el click no seleccionaba nada y el hover resaltaba simultáneamente todas las celdas-nodo de todas las tablas.

- **Selección y hover**: click sobre una celda-nodo la selecciona de forma unívoca y abre el mismo panel de propiedades (pestañas según su schema) que cualquier otro nodo del `layout`. El breadcrumb de la cabecera incluye la `table` como ancestro. El hover queda acotado a esa celda concreta, sin afectar a otras celdas de la misma tabla ni de otras tablas de la página.
- **Contenido anidado**: un `container` que ya vive dentro de una celda-nodo mantiene seleccionables a sus propios hijos a cualquier profundidad y sigue exactamente las mismas [reglas de destino de drop](#reglas-de-destino-de-drop-modo-editor) que cualquier otro `container` del `layout` (insertar desde la paleta, reordenar, reanidar) — no es un mecanismo nuevo, es la extensión natural de reglas ya vigentes en cuanto la celda tiene un path real.
- **La celda-nodo en sí nunca es origen ni destino de arrastre**: no se puede reordenar arrastrando una celda, y la paleta flotante de nodos no gana ninguna capacidad de soltar directamente sobre una celda para asignarle tipo — esa asignación es exclusiva del selector de tipo del widget descrito abajo. Una celda en modo "Texto" nunca es destino de drop.
- **Modo dinámico**: una celda-nodo de `rows.cells` es una plantilla compartida por todas las filas que genera la query, mismo comportamiento que `repeater.props.template` — editarla (tipo o props, en el widget o en el canvas) edita la plantilla completa; no existe edición de una fila generada individualmente.

Un widget dedicado ("Filas y columnas") edita `props.headers`, `props.rows` y `props.columns` de `table` como una unidad coordinada, sustituyendo por completo su edición genérica: al estar acoplados por contrato (cada fila debe corresponder exactamente con `headers`; `columns[].id` debe existir en `headers`), el widget commitea el nodo completo en cada operación, con el mismo criterio de aviso `role="alert"` ante un commit rechazado que el resto del panel. Sigue el mismo patrón sin caja ni fondo, cabeceras de texto simple en mayúsculas pequeñas y grises que el resto del panel — sin la disposición `role="grid"` que la spec dejaba abierta como opción: a los ~370px de ancho del panel, una cuadrícula fila×columna con un selector de 8 opciones por celda resultó inmanejable, así que el widget usa secciones apiladas verticalmente en su lugar:

- **Selector "Modo de filas"** (Manual / Dinámico, segmented toggle): cambiar de modo reconstruye `props.rows` desde cero con la forma mínima válida del nuevo modo; no se conserva contenido del modo anterior (mismo criterio que el selector de modo de `container` o el de contenido de `link`).
- **Modo Manual**: una sección "Columnas" — lista de headers editables con alta/renombrado/baja, sin reordenamiento (reordenar una columna movería la misma posición en `headers` y en cada fila a la vez); "Quitar columna" se deshabilita con una única columna restante. Renombrar un header sincroniza la entrada de `columns[]` asociada por `id`, si existe. Debajo, una sección "Filas": lista reordenable por arrastre (con botones "Subir"/"Bajar" como alternativa por teclado, ya que ninguna superficie de arrastre del proyecto implementa reordenamiento por teclado de `@dnd-kit`) de un ítem-acordeón por fila, colapsado por defecto mostrando el índice de fila y, si su primera celda es de tipo texto, su valor como preview corto. Expandir una fila muestra el selector de tipo por celda (ver abajo) para cada columna, en el mismo orden que `headers`. Alta de columna añade una celda de texto vacío en cada fila existente; baja de columna quita la celda correspondiente de cada fila. Sin filas (`rows: []`) es un estado válido con la opción de añadir la primera.
- **Modo Dinámico**: sin sección "Columnas" separada — `headers` y las celdas-plantilla de `rows.cells` tienen correspondencia 1:1 en este modo, así que una única lista reordenable por arrastre de columnas-plantilla es la superficie de alta/baja/renombrado/reordenamiento/tipo; colapsada, cada ítem muestra el header y una insignia con el tipo de celda activo. Debajo, el campo `source` como texto libre.
- **Selector de tipo por celda**: dropdown "Texto" más el catálogo de nodos permitido para celda de tabla, mismo patrón de reconstrucción-desde-cero que el [selector de variante de acción](#selector-de-variante-para-uniones-discriminadas-por-type-acciones); el tipo se elige libremente por celda individual. Mientras el tipo activo es "Texto", el mismo control expone un campo de texto libre para su valor (literal, referencia dinámica completa o interpolación `{{...}}`, igual que cualquier otro string del panel). En modo dinámico, dado que una celda dinámica vacía no es un valor válido por contrato, tanto "Añadir columna" como volver a "Texto" siembran un placeholder de texto no vacío en vez de una cadena vacía real (en la implementación actual, un guion largo `—`) — el usuario puede sobrescribirlo libremente como cualquier otro campo de texto.
- **Controles "Ordenable"/"Filtrable" por columna** (feature dev-editor-table-column-filter-sort-toggles): cada entrada de header en Modo Manual y cada ítem de la lista de columnas-plantilla en Modo Dinámico gana, junto a su input de nombre, dos interruptores `role="switch"` — "Ordenable" y "Filtrable" — que reflejan y editan `table.props.columns[].sortable`/`.filterable` para esa columna (identificada por su header ya confirmado, no por el texto que el usuario esté escribiendo sin confirmar en el input de renombrado). Marcar cualquiera de los dos crea la entrada de `columns[]` si no existía para ese `id`; desmarcarlo quita solo esa clave y, si la entrada deja de declarar `sortable: true` y `filterable: true`, se elimina de `columns[]` por completo (columna pasiva). Los dos checks son independientes entre sí. Mientras "Filtrable" está activo aparece debajo un campo de texto "Placeholder del filtro" que edita `filterPlaceholder`; desactivar "Filtrable" oculta el campo y descarta el texto ya escrito junto con la clave — sin caché de sesión, volver a activar "Filtrable" en la misma columna lo muestra vacío. Ambos modos reutilizan el mismo componente (`TableColumnFlagsField`), sin caja ni fondo, coherente con el resto del widget.

### Eliminar nodo (modo Editor)
Con un nodo seleccionado en modo Editor, un botón "Eliminar nodo" en el panel de propiedades borra ese nodo y todo su subárbol del `layout`, y limpia la selección. No hay confirmación modal, deshacer/rehacer ni atajo de teclado dedicado (por ejemplo `Supr`) — quedan fuera de esta primera entrega.

**Excepción — celda-nodo de `table`**: a diferencia del comportamiento general, "Eliminar nodo" sobre una celda-nodo seleccionada no la borra de su fila (haría desaparecer una posición y rompería la correspondencia con `headers`): la revierte in situ a una celda de texto vacío (cadena vacía en modo manual; en modo dinámico, el mismo placeholder de texto no vacío que usa "Añadir columna" — ver arriba). La selección se limpia igual que en el caso general.

### Reglas de destino de drop (modo Editor)
La validez de un destino (tanto para reordenar/reanidar como para insertar desde la paleta) reutiliza exactamente las mismas reglas estructurales ya vigentes para el contrato JSON (ver [[../config/structure.md]]), sin duplicarlas de forma divergente:
- solo `container`, `form`, `modal`, `link`, `accordion` y una pestaña concreta de `tabs` aceptan hijos.
- `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `fileInput`, `toggle` y `hidden` solo son válidos como descendientes de un `form`, en cualquier profundidad (incluso a través de un `container`/`accordion`/`tabs` intermedio).
- un `button` sin `action` solo es válido como descendiente de un `form`.
- `modal` y `link` conservan su catálogo cerrado propio de tipos hijo admitido (el mismo ya vigente en producción), no el catálogo abierto de `container`.
- `repeater` nunca acepta un drop de hijos fuera de la única instancia de `props.template` que representa en modo edición.
- `table` no acepta hijos por arrastre en absoluto — ni entre sus propias celdas ni desde la paleta directamente sobre una celda: el tipo de cada celda se fija exclusivamente desde el [widget dedicado de filas/columnas](#selección-de-celdas-nodo-y-widget-de-filascolumnas-de-table-modo-editor). Un `container` que ya vive dentro de una celda-nodo sí sigue las reglas de destino normales de cualquier `container`, en cuanto tiene un path real.
- arrastrar un nodo sobre sí mismo o sobre uno de sus propios descendientes se trata siempre como destino inválido (evita ciclos).

### Contenedores, formularios y links vacíos (modo Editor)
Un `container`, `form` o `link` (en modo "Elementos anidados", ver [[#Selector de modo de contenido de `link`: Texto / Elementos anidados]]) sin `children` (o con `children: []`) en modo Editor se renderiza con un placeholder visible (borde punteado y etiqueta — "Enlace vacío" en el caso de `link`), seleccionable y válido como destino de drop para insertar el primer hijo. Ese placeholder no existe en el render de producción del mismo `layout`: el nodo vacío sigue sin mostrar nada fuera de modo Editor. En producción, un `link` con `children: []` es un config válido (ver [[../nodes/link.md]]) y se renderiza como un `<a>` sin contenido interior.

## Modo Editor: supresión de comportamiento propio

En modo Editor, el contenido renderizado se comporta de forma especial para permitir edición sin interferencia de acciones declarativas:

### Acciones declarativas suprimidas
Ninguna acción declarativa se ejecuta en modo Editor:
- Buttons con `action.navigateTo` no navegano.
- Buttons con `action.goBack` no retroceden.
- Forms no se envían ni ejecutan su `submitAction`.
- Queries declaradas en `submitAction` o `onSuccess`/`onError` no se ejecutan.
- `openModal`/`closeModal` no funcionan.
- `resetForm` no limpia el formulario.

Estas acciones se suprimen de forma centralizada en el punto de disparo, sin necesidad de cambiar ningún nodo individual. El único efecto observable es que hacer click sobre un `button` con acción lo selecciona en lugar de ejecutar la acción.

### Campos de formulario inertizados
Los siete tipos de campo (`input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `toggle`, `fileInput`) quedan deshabilitados en modo Editor:
- Teclear sobre un `input`/`textarea` no cambia su valor.
- Marcar un `checkbox`/`radio`/`toggle` no cambia su estado.
- Cambiar la selección de un `select` no refleja la elección.
- Activar un `radioGroup`/`checkboxGroup` no marca/desmarca opciones.
- Estos controles no responden a activación vía `<label>` (clicar la etiqueta de un checkbox no lo marca).

El único mecanismo para cambiar un valor de campo en modo Editor es el panel de propiedades del nodo seleccionado, que edita directamente el config en memoria.

### Excepción explícita: interactividad local de `accordion` y `tabs`
La interactividad local de cabecera se preserva en modo Editor:
- Clicar la cabecera de un `accordion` sigue alternando `aria-expanded` y su cuerpo se muestra/oculta (aunque el cuerpo esté siempre en el DOM para que se pueda seleccionar cualquier nodo anidado).
- Clicar una pestaña de `tabs` sigue cambiando la pestaña visible.

Estas interacciones no son acciones declarativas ni comportamiento de usuario sobre campos (son estado local del propio componente), así que se permiten para poder acceder y seleccionar nodos anidados bajo cabeceras/pestañas distintas en modo Editor.

## Sincronización entre canvas y Monaco

Cualquier cambio hecho en modo Editor (mover, insertar, borrar, editar propiedades) se confirma mediante el mismo pipeline de commit: valida el `layout` resultante con `validateRuntimeConfig` (el mismo validador que ya usa el botón Aplicar) y, solo si es válido, migra el estado del runtime y actualiza `currentConfig`. A diferencia del botón Aplicar de Monaco (que deja el buffer intacto tras aplicar), el commit del canvas parchea únicamente la clave `layout` de la página activa sobre el último texto crudo válido conocido, dejando intacto el resto del documento (`api`, `initialPage`, `tokens`, `translations`, y cualquier otra página, incluidos bloques con forma cruda como `preloads`). Un `form.onSuccess`/`form.onError` declarado a nivel superior se serializa anidado dentro de `submitAction`, igual que exige el contrato normalizado. Si la mutación resultante no fuera válida, se descarta sin tocar ningún estado — la validación de destino de drop y las reglas estructurales ya evitan que esto ocurra en el flujo normal, pero el commit es la última barrera de seguridad. Un commit exitoso desde el canvas activa la misma guardia de cambios aplicados (§ Guardia de cambios aplicados) que el botón Aplicar, y sobrescribe deliberadamente cualquier cambio sin aplicar que hubiera pendiente en Monaco en ese momento.

La sincronización entre canvas y Monaco es bidireccional e inmediata: cambios en el canvas se reflejan en el buffer de Monaco, y cambios directamente editados en Monaco se reflejan en el canvas tras pulsar "Aplicar".

## Sección Shell (dominio de configuración)

### Objetivo y alcance
Formulario de configuración para `shell.header` (ver [[../shell/header.md]]) y `shell.sidebar` (ver
[[../shell/sidebar.md]] para el shape funcional completo), accesible seleccionando `Shell` en el selector de
pestaña de dominio de la barra flotante. A diferencia de `Layout`, esta sección no manipula un árbol renderizado
por selección directa: sustituye el área de canvas por un panel de formulario dedicado (`ShellConfigPanel`). No
hay selección de nodo, breadcrumb ni panel de propiedades por nodo seleccionado — el panel de propiedades completo
de `Layout` solo se reutiliza puntualmente dentro de la lista de acciones del header (ver más abajo).

### Sub-vistas Header/Sidebar
El panel se organiza en dos sub-vistas mutuamente excluyentes mediante un `role="tablist"` con dos
`role="tab"` ("Header", "Sidebar") controlando `aria-selected`/`aria-controls` hacia sus respectivos
`role="tabpanel"`. "Header" es la sub-vista activa por defecto al montar el editor. Igual que el
cuerpo de `accordion` y el panel de `modal` en modo Editor (ver [[#Excepción explícita:
interactividad local de `accordion` y `tabs`]]), **ambos `tabpanel` permanecen siempre montados en
el DOM**: la sub-vista no activa se oculta con una clase Tailwind (`hidden`), nunca dejando de
renderizarse. Como consecuencia, cambiar de sub-vista y volver nunca reinicia nada propio de la
sub-vista que se deja de ver — ni el estado de colapso de sus filas, ni un aviso de commit
rechazado (`role="alert"`) pendiente en uno de sus campos, ni ningún otro estado local — porque
nunca llegó a desmontarse.

### Contenido del panel
Sin caja con borde ni fondo en ninguno de los tres niveles raíz del panel ("Menú", "Elementos del sidebar",
"Acciones"): cada título es texto de cabecera simple, mismo lenguaje visual que el resto del editor de propiedades
(ver [[#Widget dedicado para layout.span (columnas por breakpoint)]] y línea 182 más arriba). Los niveles ya
anidados que usan indentación con guía vertical en vez de una caja completa (el desplegable de `menuItem`, "Hijos
del elemento de sidebar N") no cambian — nunca tuvieron una caja que quitar. Cada `menuItem`/`sidebarItem`
expandido muestra una cabecera de texto simple con su `labelText` vigente ("Elemento de menú N" / "Elemento de
sidebar N") y sus campos (Etiqueta, Icono, Modo, Href o Acción, Visibilidad) sueltos debajo, sin el prefijo
`"${labelText} — Campo"` que llevaba cada campo antes. Cada acción de `shell.header.actions` muestra igual una
cabecera "Acción N" con el campo "Tipo" suelto debajo, sin caja individual alrededor de la acción.

El `tabpanel` "Header" agrupa:
- **Toggle "Header activo"**: activarlo crea `shell.header: {}` (header vacío, sin renderizar nada visible hasta
  añadir campos); desactivarlo quita únicamente la clave `shell.header`, conservando `shell.sidebar` intacto si
  estaba activo. El bloque `shell` solo desaparece del config por completo cuando ambos toggles ("Header activo" y
  "Sidebar activo") quedan desactivados a la vez.
- **Logo**: mismo editor genérico de `props` que ya usa el nodo `image` (selector `src`/`fetch`, mutuamente
  excluyentes).
- **Título**: campo de texto simple.
- **Lista de menú**: alta, edición y borrado de `menuItem` mediante controles de formulario estándar. Cada item
  expone un selector de modo (`Sin acción`, `href`, `action`, `Con submenú`) que determina qué campos adicionales se
  muestran, más los campos comunes `label`, `icon` (con el [widget de búsqueda y selección de iconos
  Lucide](#widget-de-búsqueda-y-selección-de-iconos-lucide)) y `visibility` (este último con el
  [widget de condición/grupo](#widget-de-condicióngrupo-visibilitywhen) que usa también el panel de propiedades de
  `Layout`). Un item en modo "Con submenú" expone su propia lista
  anidada de hijos con los mismos controles, sin permitir un tercer nivel (los hijos no ofrecen la opción "Con
  submenú").
- **Lista de acciones**: alta, edición y borrado de nodos `link`/`button`, reutilizando el panel de propiedades
  completo ya existente para nodos de `Layout` con su misma barra de pestañas (`Props`/`Visibilidad`/`Queries`; sin
  `Diseño`, ya que esta lista no tiene árbol de página — ver [[#Barra de pestañas del panel de propiedades]]). Se
  reordena con botones subir/bajar, no con arrastre.

El `tabpanel` "Sidebar" agrupa:
- **Toggle "Sidebar activo"**: activarlo crea `shell.sidebar: { items: [] }` sin afectar a `shell.header` ya
  configurado; desactivarlo quita únicamente la clave `shell.sidebar`, conservando `shell.header` intacto si
  estaba activo.
- **Toggle "Modo rail por defecto"**: edita `shell.sidebar.defaultCollapsed` (ver [[../shell/sidebar.md]]) con el
  mismo control booleano genérico que el resto del panel; ausente equivale a `false` (sidebar expandido al
  arrancar la sesión).
- **Lista de elementos de sidebar**: alta, edición y borrado de `sidebarItem` mediante un único componente
  recursivo que se renderiza a sí mismo para los `children` de cualquier item, sin límite de profundidad (a
  diferencia de la lista de menú del header, que solo admite un nivel anidado). Cada item expone el mismo selector
  de modo (`Sin acción`, `href`, `action`, `Con hijos`) y los mismos campos comunes `label`, `icon` (mismo [widget de
  búsqueda y selección de iconos Lucide](#widget-de-búsqueda-y-selección-de-iconos-lucide) que la lista de menú del
  header) y `visibility` (mismo [widget de condición/grupo](#widget-de-condicióngrupo-visibilitywhen) que la lista
  de menú del header); un item en modo "Con hijos" expone inline su propia lista anidada de hijos, con los mismos controles, pudiendo
  a su vez anidar otro nivel de "Con hijos" sin tope.

### Reordenar por arrastre
En la lista de menú del header (`shell.header.menu`), arrastrar admite tanto reordenar dentro del mismo nivel como
anidar o mover un item entre niveles, dentro de un único árbol de arrastre que cubre toda la lista raíz y todos
sus `children` a la vez:
- Soltar sobre una zona intermedia (entre dos items, antes del primero o después del último, tanto en la raíz
  como dentro de un desplegable) reordena en esa posición, dentro del mismo nivel o moviendo el item a otro nivel
  distinto (por ejemplo, sacar un item de un desplegable a la raíz, o llevar un item de la raíz al desplegable de
  otro item, soltándolo en una de sus zonas intermedias).
- Soltar sobre el cuerpo de otro `menuItem` lo anida como su hijo (al final de sus `children` si ya tenía, o
  sustituyendo su `href`/`action` por un nuevo `children` con ese único elemento si estaba en modo hoja). El tope
  es un único nivel de anidado: un `menuItem` raíz (profundidad 0) puede recibir un nuevo hijo, pero un
  `menuItemChild` (profundidad 1) nunca puede convertirse a su vez en destino de anidado ni moverse a un
  desplegable ajeno si eso lo dejaría a profundidad 2 — ese intento se rechaza al soltar, sin cambiar el config.
- Al mover un item que tiene sus propios hijos (o al moverlos a ellos individualmente), el estado de colapso de
  cada fila implicada se conserva en su nueva posición.

En la lista de elementos de sidebar (`shell.sidebar.items`), arrastrar admite el mismo repertorio que la lista de
menú del header — reordenar dentro del mismo nivel, anidar sobre el cuerpo de otro `sidebarItem` (sustituyendo su
`href`/`action` por un `children` si estaba en modo hoja, o añadiéndose al final si ya tenía hijos) y mover un item
entre niveles distintos — dentro de un único árbol de arrastre que cubre la lista raíz y todos sus `children` a
cualquier profundidad. A diferencia del menú del header, `sidebarItem` no tiene tope de anidado: un item puede
recibir un hijo, y ese hijo a su vez anidar otro nivel, sin límite de profundidad, igual que ya ocurría con la
edición manual. Un intento de anidar un item dentro de su propio descendiente se rechaza al soltar, sin cambiar el
config. Al mover un item con sus propios hijos, el estado de colapso de cada fila implicada se conserva en su
nueva posición.

La lista de menú del header y la de elementos de sidebar mantienen árboles de arrastre completamente
independientes entre sí: no es posible arrastrar un item de uno al otro, ya que cada árbol vive en su propio
`DndContext` sin ninguna zona de destino compartida entre ambos. El resto de edición (añadir, quitar, editar
campos) usa siempre controles de formulario estándar.

La resolución del punto de soltado usa distancia al centro (no solapamiento literal de píxeles): el destino que
gana es el que tiene el centro más cercano al elemento arrastrado, no el primero cuyo rectángulo se solape con él.
Esto es lo que hace viable reordenar en la práctica pese a que la zona de "anidar" ocupa el cuerpo entero de cada
fila y la zona de "reordenar" es una franja mucho más fina entre filas: sin este criterio, casi cualquier soltado
cerca de una fila resolvería a "anidar" en vez de a la posición intermedia buscada.

### Colapsar/expandir `menuItem` y `menuItemChild`
Cada fila de la lista de menú (raíz o dentro de un desplegable) tiene su propio control de colapso independiente,
identificado por su posición en el árbol (`0`, `1`, ... para items raíz; `0.0`, `0.1`, ... para los hijos del item
`0`). El control es un único botón situado justo a la derecha del asa de arrastre (⠿), en la misma línea, que
muestra el `icon` (si existe) y el `label` de la fila tal cual están configurados — sin resolver referencias
`{{...}}`, igual que el breadcrumb de `Layout` — junto a un icono de flecha que indica el estado. No hay un botón
de colapso separado ni una fila resumen aparte: pulsar sobre el propio nombre (en cualquier parte del botón) es lo
que colapsa o expande la fila. Al montar el editor, todas las filas empiezan colapsadas; un item recién creado con
"Añadir elemento de menú"/"Añadir elemento de desplegable" (o el hijo que se seedea al cambiar el modo de un item
a "Con submenú") se expande automáticamente para poder rellenar sus campos sin un clic extra. Colapsar una fila:
- Oculta el formulario completo de esa fila (etiqueta, icono, modo y campos del modo activo, visibilidad); el
  nombre de la fila sigue visible en el botón de colapso, que no desaparece.
- No afecta a los hijos del item: si un `menuItem` en modo "Con submenú" se colapsa, su lista de hijos sigue
  visible e interactiva debajo, indentada.
- No oculta un aviso de commit rechazado (`role="alert"`) pendiente en esa fila: se sigue mostrando igual
  colapsada o expandida.
- Es independiente por fila: colapsar un item no afecta al estado de colapso de ningún otro.

Un `menuItem` en modo "Con submenú" muestra además, junto al botón de colapso, un icono indicador de rama (no es
el `icon` propio del item) tanto colapsado como expandido; un item en cualquier otro modo nunca lo muestra.

### Colapsar/expandir `sidebarItem`
Cada fila de la lista de elementos de sidebar, a cualquier profundidad (raíz, hijo, nieto, ...), tiene su propio
control de colapso independiente, identificado por su posición en el árbol (`0`, `1`, ... para items raíz; `0.0`,
`0.1`, ... para los hijos del item `0`; `0.0.1`, ... para los nietos, y así sucesivamente sin límite de
profundidad — a diferencia de la lista de menú del header, que solo admite un nivel anidado). Mismo patrón que el
menú del header: un único botón junto al asa de arrastre, con el `icon`/`label` de la fila y un icono de flecha
de estado; pulsar sobre el nombre colapsa o expande, sin botón ni fila resumen separados. Al montar el editor,
todas las filas empiezan colapsadas; un item recién creado con "Añadir elemento de sidebar" (o el hijo que se
seedea al cambiar el modo de un item a "Con hijos") se expande automáticamente para poder rellenar sus campos sin
un clic extra. Colapsar una fila:
- Oculta el formulario completo de esa fila (etiqueta, icono, modo y campos del modo activo, visibilidad); el
  nombre de la fila sigue visible en el botón de colapso, que no desaparece.
- No afecta a los hijos del item: si un `sidebarItem` en modo "Con hijos" se colapsa, su lista de hijos sigue
  visible e interactiva debajo, indentada, a cualquier profundidad.
- No oculta un aviso de commit rechazado (`role="alert"`) pendiente en esa fila: se sigue mostrando igual
  colapsada o expandida.
- Es independiente por fila: colapsar un item no afecta al estado de colapso de ningún otro, sea cual sea su
  profundidad relativa.

Un `sidebarItem` en modo "Con hijos" muestra además, junto al botón de colapso, un icono indicador de rama (no es
el `icon` propio del item) tanto colapsado como expandido, a cualquier profundidad — sin la restricción "solo
raíz" que tiene el indicador equivalente del menú del header; un item en cualquier otro modo nunca lo muestra.

### Feedback cuando un cambio no se puede guardar
Cada cambio del formulario (logo, título, una fila de menú o de acciones) se valida contra el config completo antes
de aplicarse, con el mismo pipeline (`validateRuntimeConfig`) que ya usa el commit del canvas de `Layout`. Si el
commit se rechaza, el campo no revierte en silencio: conserva el valor introducido y muestra debajo un aviso
(`role="alert"`) con el código y el mensaje del error, hasta que un cambio posterior de ese mismo campo se guarda
correctamente.

### Pipeline de commit
El commit de Shell parchea únicamente la clave raíz `shell` sobre el último texto crudo válido conocido, dejando
intacto el resto del documento (`layout` de cada página, `api`, `initialPage`, `tokens`, `translations`) — mismo
patrón que ya usa el commit del canvas de `Layout` sobre la clave `layout`, aplicado aquí a una clave raíz distinta.
Un commit exitoso desde Shell activa la misma guardia de cambios aplicados (ver [[#Guardia de cambios aplicados]]) que el resto de commits del editor.

## Sección Api (dominio de configuración)

### Objetivo y alcance
Panel de formulario dedicado (`ApiConfigPanel`), accesible seleccionando `Api` en el selector de pestaña de dominio
de la barra flotante — mismo tipo de sección que `Shell` y `Traducciones`: sin selección de nodo, breadcrumb ni
panel de propiedades por nodo, sustituye por completo el área de canvas. Cubre dos superficies distintas del config
que antes solo se editaban a mano en Monaco: CRUD completo de las operaciones declaradas en el bloque raíz `api`
(ver [[../queries/execution.md]]), y CRUD de las entradas de `preloads` tanto a nivel `shell`/raíz de la aplicación
como a nivel de la página activa (ver [[../queries/preloads.md]]). Toda mutación confirmada desde este panel pasa
por el mismo pipeline commit/validación/patch de clave raíz que ya usan `Layout`, `Shell` y `Traducciones`.

### Sub-vistas Operaciones/Preloads
El panel se organiza en dos sub-vistas mutuamente excluyentes mediante un `role="tablist"` con dos `role="tab"`
("Operaciones", "Preloads") controlando `aria-selected`/`aria-controls` hacia sus respectivos `role="tabpanel"`.
"Operaciones" es la sub-vista activa por defecto al montar el panel. Igual que las sub-vistas Header/Sidebar de
`Shell` (ver [[#Sub-vistas Header/Sidebar]]), **ambos `tabpanel` permanecen siempre montados en el DOM**: la
sub-vista no activa se oculta con una clase Tailwind, nunca dejando de renderizarse — cambiar de sub-vista y volver
no reinicia ningún estado local propio de la que se deja de ver (por ejemplo, un aviso de commit rechazado
pendiente en un campo).

### Sub-vista "Operaciones"
- **Listado**: una entrada por clave ya declarada en `api` (FR5), mostrando su clave y un botón "Borrar operación"
  (FR7, sin confirmación). Con `api` vacío o sin declarar, el panel muestra `"Sin operaciones declaradas."` en vez de
  lista (FR4).
- **Campos por operación** (`ApiOperationFieldsEditor`, FR9): método (`SegmentedTogglePropertyField` con las cinco
  opciones `GET`/`POST`/`PUT`/`PATCH`/`DELETE`), endpoint (texto libre), y los mapas `query`/`headers` con el mismo
  [editor clave-valor](#editor-clave-valor-params-query-headers-body) que el resto del panel. `body` se oculta por
  completo mientras el método activo es `GET`, y reaparece al cambiar a un método que lo admite — mismo criterio ya
  usado por el selector "Modo" de `container` (Grid/Columnas): un campo que dejaría de tener sentido con la
  selección actual desaparece en vez de quedar visible-pero-inválido. Cuando `body` es visible, sigue la misma
  degradación por clave que el resto del editor (FR10): un valor plano-objeto se edita con el editor clave-valor, y
  cualquier otra forma válida (string, número, booleano, null, array) cae a una vista de solo lectura.
- **Alta de operación** (FR6): formulario "Añadir operación" con Clave, Método (por defecto `GET`) y Endpoint. Una
  clave vacía o ya existente en `api` se rechaza con un aviso local (mismo componente de aviso que usa
  "Añadir entrada" en `Traducciones`) antes de intentar ningún commit. La operación se crea solo con `method` y
  `endpoint`; `query`/`headers`/`body` se añaden después editando la operación ya creada.
- **Sin renombrado de clave** (FR8): no hay control para cambiar la clave de una operación ya existente; para
  "renombrarla" hay que borrarla y crear una nueva.
- **Feedback por campo**: cada campo (método, endpoint, query, headers, body) de cada operación tiene su propio
  aviso de commit rechazado, aislado por operación y por campo — un rechazo en un campo de una operación no afecta
  al resto de campos de esa operación ni a otras operaciones.

### Sub-vista "Preloads"
Dos secciones independientes, cada una una instancia del mismo componente (`PreloadsListEditor`, FR11-FR15) sin
implementación paralela:
- **"Precargas globales"**: edita el bloque raíz `preloads` (precargas de aplicación, ver
  [[../queries/preloads.md#Precargas globales de aplicación (`preloads` raíz)]]).
- **"Precargas de la página activa"**: edita `preloads` de la página que el selector de página de la barra tiene
  activa en ese momento. Se remonta por completo (`key` por `pageId`) en cada cambio de página, de forma que un alta
  a medio rellenar en una página nunca sobrevive al cambiar a otra.

Cada instancia comparte:
- **Listado**: una entrada por preload ya declarado, con un botón "Borrar precarga" (FR13, sin confirmación). Con la
  lista vacía o sin declarar, el panel muestra `"Sin precargas configuradas."` (FR11).
- **Campos por entrada** (`PreloadEntryFieldsEditor`, FR14/FR15): un desplegable `operationName` restringido
  exclusivamente a `Object.keys(api)` — nunca ofrece una clave que no esté ya declarada en `api` (FR14) — más
  `requestParams` (`query`/`headers`/`body`) con el mismo editor clave-valor y la misma degradación de `body` por
  método (oculto solo cuando la operación referenciada existe y su `method` es `GET`) que la sub-vista
  "Operaciones".
- **Referencia rota** (`operationName` que ya no tiene operación declarada en `api`, por ejemplo tras borrarla): el
  desplegable simplemente no tiene ninguna opción para ese valor — no se inyecta una opción de respaldo ni se fuerza
  otro valor sobre la entrada — mientras el resto de la fila (`requestParams`) sigue editable con normalidad. La
  validación cruzada ya existente (`validate-preloads.ts`) sigue detectando esa referencia rota exactamente igual
  que antes de esta feature; el panel no intenta autocorregirla.
- **Alta de entrada** (FR12): formulario "Añadir precarga" con un desplegable `operationName` (mismo catálogo de
  `api`) y botón "Añadir precarga". Sin ninguna operación declarada en `api`, el intento de alta se rechaza con un
  aviso local antes de cualquier commit. La entrada se crea con `requestParams: {}`.

### Pipeline de commit
Tres pipelines de commit independientes, todos con el mismo criterio de validar antes de aplicar y de no tocar
ninguna otra clave del documento:
- **`api`**: parchea únicamente la clave raíz `api` sobre el último texto crudo válido conocido — mismo patrón
  exacto que el commit de `Shell`/`Traducciones` sobre sus respectivas claves raíz.
- **Precargas globales**: parchea la clave raíz `preloads` de la misma forma. Una lista de precargas vaciada por
  completo desde el panel elimina la clave `preloads` del documento en vez de dejar `"preloads": []`.
- **Precargas de página**: reutiliza el mismo mecanismo de parcheo por página que ya usa el canvas de `Layout` para
  sustituir solo la clave `preloads` de la página activa dentro de `pages`, dejando intacto el `layout` de esa misma
  página y el resto del documento. Igual que las precargas globales, una lista vaciada por completo elimina la clave
  `preloads` de esa página en vez de dejarla como array vacío.

Un commit exitoso desde cualquiera de las tres superficies activa la misma guardia de cambios aplicados (ver
[[#Guardia de cambios aplicados]]) que el resto de commits del editor.

### Fuera de alcance de la sección Api
- Sin pickers contextuales conscientes de qué referencias (`queries.*`, `forms.*`, `params.*`, `item.*`) están
  disponibles en cada punto — el valor de cada fila de `query`/`body`/`headers`/`requestParams` sigue siendo texto
  libre, igual que en el resto del panel.
- Sin edición de `when` u otras condiciones de una entrada de `preloads` más allá de `operationName` y
  `requestParams`.
- Sin autocorrección de una referencia rota (`operationName` de un preload apuntando a una operación borrada): el
  comportamiento de validación ante esa referencia se mantiene igual que antes de esta sección.
- Sin deshacer/rehacer ni confirmación modal en el borrado de una operación o de una entrada de preload.

## Sección Traducciones (dominio de configuración)

### Objetivo y alcance
Panel de formulario dedicado (`TranslationsConfigPanel`) para el bloque raíz `translations`, accesible seleccionando
`Traducciones` en el selector de pestaña de dominio de la barra flotante — mismo tipo de sección que `Shell`: sin
selección de nodo, breadcrumb ni panel de propiedades por nodo, sustituye por completo el área de canvas. Cubre dos
necesidades: gestión manual de entradas (alta, edición, borrado, añadir columna de idioma) y sincronización de solo
lectura con un proveedor externo de gestión de textos (PlataGes) para buscar textos ya existentes y para refrescar en
bloque las entradas ya sincronizadas. Toda mutación confirmada pasa por el mismo pipeline commit/validación/patch de
clave raíz que ya usan `Layout` y `Shell` (`commitTranslationsMutation` en `dev-runtime.tsx`, análogo a
`commitShellMutation`: parchea solo la clave `translations` sobre el último texto crudo válido conocido vía
`patchRootKey`, valida con `validateRuntimeConfig` y solo entonces migra estado y aplica). A diferencia de `shell`,
`translations` nunca embebe nodos de `layout`, por lo que no existe divergencia raw/normalizado que gestionar. Un
commit exitoso desde este panel activa la misma guardia de cambios aplicados que el resto del editor.

### Tabla de entradas
Con `translations` sin declarar, vacío (`{}`) o con al menos una clave sin ninguna entrada, el panel muestra
`"Sin traducciones definidas"` en vez de tabla. Con al menos una entrada, una tabla muestra una fila por clave
existente y una columna por cada código de idioma presente en la unión de todas las entradas (más cualquier columna
de idioma añadida localmente y todavía sin persistir, ver más abajo). Cada celda es un input de texto que commitea
al perder el foco (`blur`), no en cada pulsación: si el valor no cambió respecto al ya persistido, no dispara ningún
commit; si el valor editado queda vacío, la clave de ese idioma se elimina de la entrada en vez de persistir una
cadena vacía. Un commit rechazado por validación deja el valor tecleado en la celda (no revierte en silencio) y
muestra debajo un aviso (`role="alert"`, `CommitRejectionBanner`) independiente por celda.

### Alta, borrado y columnas de idioma
Los bloques "Añadir entrada", "Añadir idioma" y "Buscar y añadir" (búsqueda + resultados) no tienen caja con borde ni
fondo — cada título es texto de cabecera simple, mismo lenguaje visual que el resto del editor. Sus campos (Clave,
una fila por idioma en "Añadir entrada"; Código de idioma en "Añadir idioma"; Buscar texto en la búsqueda) usan la
misma fila label-izquierda/control-derecha (`PropertyFieldRow`) que los campos genéricos del panel de propiedades de
`Layout`, en vez de label encima del input. La tabla principal de edición de claves/idiomas no se ve afectada por
este cambio.
- **Alta manual**: formulario "Añadir entrada" con un campo de clave y un campo de texto por cada columna de idioma
  conocida en ese momento (todos opcionales). Una clave vacía o ya existente en `translations` se rechaza con un
  aviso local (mismo componente `CommitRejectionBanner`) antes de intentar ningún commit — no llega a invocar
  `onCommitTranslationsMutation`.
- **Borrado**: botón "Borrar" por fila; elimina la clave completa de `translations`. Sin validación cruzada de
  referencias `{{translations.clave}}` existentes en otro punto del config antes de borrar — el runtime ya degrada
  de forma controlada ante una clave no resoluble. Borrar la última entrada deja `translations` como objeto vacío
  `{}`, sin eliminar la clave raíz.
- **La clave de una entrada existente no es editable**: para "renombrarla" hay que borrar la entrada y crear una
  nueva.
- **Añadir idioma nuevo**: control a nivel de panel (no por entrada) que añade una columna nueva, vacía para todas
  las filas existentes, disponible de inmediato en alta y edición manual. Un código vacío o ya existente entre las
  columnas actuales se rechaza con aviso local. La columna es únicamente estado local del panel hasta que la primera
  edición de una celda bajo esa columna la persiste en `translations`; no hay commit al pulsar "Añadir idioma".

### Resolución de URL y token desde la config de endpoints
Ambas acciones de sincronización requieren una `baseUrl` y un Bearer JWT, resueltos de forma independiente cada una
desde la [config de endpoints externos](./local-config.md#config-de-endpoints-externos): "Buscar y añadir" contra
la operación `searchTexts` y "Refrescar todo" contra `getTranslationsBatch`. Ya no hay un desplegable de selección
de token en el panel — el token se resuelve automáticamente vía el `tokenId` declarado para cada operación, contra
los `tokens.*` del config activo (ver [[../auth/tokens.md]]); sigue siendo un uso puramente interno del editor, no
una superficie nueva de interpolación `{{tokens.*}}` en el config.

Sin la operación correspondiente declarada en la config de endpoints, o con un `tokenId` que no resuelve contra
ningún `tokens.*` del config activo, la acción afectada queda deshabilitada con un mensaje explicando la causa,
junto a su botón — de forma independiente para cada una: es válido tener "Buscar y añadir" habilitada y "Refrescar
todo" deshabilitada, o viceversa.

### Acción "Buscar y añadir"
Campo de texto más botón "Buscar" (deshabilitado sin la operación resuelta o mientras una búsqueda está en curso,
con indicador `role="status"` de carga). Llama a `provider.searchTexts` con el texto introducido; los resultados
(identificador + texto en el idioma por defecto del proveedor) se listan con un checkbox de selección por resultado.
Un resultado cuyo identificador ya es una clave existente en `translations` se muestra marcado "Ya existe" con su
checkbox deshabilitado. Una búsqueda sin resultados muestra `"Sin resultados"` sin tratarse como error. Pulsar
"Añadir seleccionados" crea, para cada resultado marcado, una entrada nueva con clave = identificador (convertido a
string) y solo el idioma por defecto del proveedor (`es`) poblado con el texto devuelto — el resto de idiomas quedan
vacíos —, en un único commit para todos los seleccionados a la vez. Tras un commit exitoso la lista de resultados se
limpia; un fallo de red o HTTP (incluido 401/403, mapeado a un mensaje de error de autenticación) se muestra con
`role="alert"` sin modificar `translations`.

### Acción "Refrescar todo"
Bloque "Refrescar todo" sin caja con borde ni fondo, con el mismo título de cabecera simple que el resto del panel.
Botón deshabilitado sin la operación resuelta o mientras un refresco ya está en curso (evita disparar dos refrescos
simultáneos con doble clic). Al pulsarlo:
1. Recopila las claves de `translations` que son literalmente un entero válido (`isNumericTranslationKey`, regex
   `^\d+$`) — incluida cualquier clave creada a mano que por coincidencia sea un número; las no numéricas se
   excluyen siempre. Sin ninguna clave numérica, no se envía ninguna petición y se muestra el aviso "Sin claves
   refrescables".
2. Envía esa lista completa en un único lote a `provider.getTranslationsBatch`. Un fallo de red o HTTP se muestra
   con `role="alert"` y no aplica ningún cambio a `translations` (ni parcial ni total) — el commit solo se intenta
   tras una respuesta exitosa del proveedor, garantizando la atomicidad exigida por la spec.
3. Por cada identificador que la respuesta sí incluye, sobrescribe el texto de cada idioma devuelto usando una tabla
   fija código de idioma del proveedor → código de idioma de la app (`1 → "es"`, `2 → "eu"`, fijada en código, no
   configurable); un código de idioma en la respuesta que no está en esa tabla se ignora para esa entrada sin afectar
   al resto de idiomas mapeados de la misma entrada.
4. Claves numéricas enviadas que no aparecen en la respuesta se dejan exactamente igual que antes — "Refrescar todo"
   nunca borra ninguna entrada de `translations`, tenga o no correspondencia en el proveedor externo.

### Proveedor externo integrado (PlataGes)
El cliente HTTP concreto (`createPlatagesTranslationsProvider`, interfaz `TranslationsProvider`) vive en un módulo
propio (`src/dev-runtime/translations-panel/translations-provider.ts`), separado del resto del panel, para que
sustituir este proveedor por otro en el futuro sea un cambio localizado a ese módulo sin tocar la UI, el pipeline de
commit ni la gestión manual de entradas. El transporte HTTP y el mapeo de errores viven en un cliente compartido
(`platages-http-client.ts`), reutilizado también por el proveedor de guardado de Guardar (ver [[#Botón Guardar]]).
`DevEditorLayer` construye la instancia una sola vez por `baseUrl` (memoizada, se reconstruye solo si la `baseUrl`
resuelta cambia) y la pasa explícitamente al panel vía la prop `provider` (opcional en el tipo del componente, para
que llamadores/tests que no ejercitan "Buscar" o "Refrescar todo" no necesiten suministrarla).

Expone dos operaciones, ambas `POST` con `Authorization: Bearer <token>`:
- búsqueda de textos por coincidencia parcial (`.../buscartextos`), payload `{ BuscarTextosEntradaDTO: { ParteTexto } }`;
- obtención de traducciones por lote de identificadores (`.../obtenertextos`), payload `{ ObtenerTextosEntradaDTO: { IdTextos } }`.

La `baseUrl` usada es la declarada en la config de endpoints (ver
[[local-config.md#Config de endpoints externos]]) cuando esa config existe — que es siempre el caso cuando alguna
de las dos acciones está habilitada, ya que sin config de endpoints ambas quedan deshabilitadas. **El `path` de cada
operación sigue fijo dentro de este módulo** (las mismas rutas `.../buscartextos`/`.../obtenertextos` de siempre):
el campo `path` que la config de endpoints declara para `searchTexts`/`getTranslationsBatch` no se usa para
construir la URL de estas dos llamadas — a diferencia de la operación de guardado, cuyo `path` sí se usa íntegro
(ver [[#Botón Guardar]]).

Un `401`/`403` de cualquiera de las dos se mapea a un mensaje de error de autenticación fijo; cualquier otro fallo
HTTP usa el `message` del cuerpo de error si lo trae, o un mensaje genérico con el código HTTP; un fallo de red
(`fetch` rechazada) usa un mensaje genérico de "no se pudo contactar". El proveedor expone además en su API real una
tercera operación de gestión de configuración, que sí está integrada por esta feature a través de Guardar (ver
[[#Botón Guardar]]), como cliente aparte (`save-config-provider.ts`).

### Fuera de alcance de la sección Traducciones
- No hay flujo de escritura hacia el proveedor externo: la sincronización es siempre de lectura desde PlataGes hacia
  `translations`, nunca al revés.
- El panel no edita ni gestiona los `tokens.*` en sí (eso sigue siendo exclusivo de la sección Tokens, `0078`); solo
  consume los ya declarados para elegir cuál usar como Bearer.
- Sin paginación propia sobre los resultados de "Buscar"; el panel muestra la respuesta del proveedor tal cual.
- Sin deshacer/rehacer ni confirmación modal en el borrado de una entrada.

## Sección Páginas (dominio de configuración)

### Objetivo y alcance
Panel de formulario dedicado (`PagesConfigPanel`) para `config.pages`/`config.initialPage`, accesible seleccionando
`Páginas` en el selector de pestaña de dominio de la barra flotante — mismo tipo de sección que `Shell`/
`Traducciones`: sin selección de nodo, breadcrumb ni panel de propiedades por nodo, sustituye por completo el área
de canvas. Permite crear páginas, eliminarlas, editar su `title` y designar cuál es la `initialPage` vigente, sin
depender de editar el JSON a mano en Monaco. No cubre el `layout` ni los `preloads` de una página (eso sigue siendo
terreno de `Layout`), ni reordenar `pages` ni renombrar el `id` de una página ya existente.

### Listado y creación de páginas
Una tabla lista todas las páginas de `config.pages` en su orden actual, con una fila por página y columnas `Id`
(solo lectura), `Título` (editable), `Inicial` (radio de designación) y una acción "Eliminar". Debajo, un
formulario "Crear página" con campos `Id` y `Título` (ambos texto libre); el botón "Crear" permanece deshabilitado
mientras `id` — tras recortar espacios sobrantes al principio/final — esté vacío o coincida exactamente con el `id`
de una página ya existente (comparación sensible a mayúsculas/minúsculas), mostrando el motivo como texto bajo el
formulario sin necesidad de pasar por Monaco. Crear una página añade una entrada `{ id, layout: [] }` — con `title`
solo si se rellenó, recortado — al final de `pages`, sin `preloads` y sin marcarla automáticamente como
`initialPage`; el formulario se limpia y la pestaña activa no cambia (el usuario permanece en `Páginas`).

### Edición de título
El campo `Título` de cada fila es un input de texto libre que commitea al perder el foco (`blur`), no en cada
pulsación: si el valor no cambió respecto al persistido, no dispara ningún commit; dejarlo vacío retira la clave
`title` de esa página en vez de persistir una cadena vacía. Un commit rechazado por validación conserva el valor
tecleado (no revierte en silencio) y muestra debajo un aviso (`role="alert"`, `CommitRejectionBanner`)
independiente por fila.

### Designación de página inicial
La columna `Inicial` es un grupo de radios (uno por página, mutuamente excluyente) que marca cuál es la
`initialPage` vigente; la fila de la página activa muestra además una marca visual "Inicial". Seleccionar otra
página aplica el cambio de inmediato sobre `config.initialPage`, reflejado en Monaco y en el resto del editor sin
recargar. Un commit rechazado muestra el mismo aviso `role="alert"` junto a la fila afectada, sin cambiar la
selección visual del radio.

### Borrado de página y confirmación
El botón "Eliminar" de una fila queda deshabilitado con un motivo explícito (mostrado como `title` del botón) en
dos casos: si es la única página restante de `pages`, o si es la `initialPage` vigente (hay que reasignar
`initialPage` a otra página primero). En cualquier otro caso, pulsarlo abre un diálogo de confirmación
(`role="alertdialog"`, `aria-modal`, foco atrapado dentro del panel con `Tab`/`Shift+Tab`, cierre por `Esc` o click
fuera del panel, devolviendo el foco al elemento que tenía antes de abrirse) con los botones "Cancelar" y
"Eliminar". Confirmar retira esa página de `pages` en un único commit; si el runtime tenía esa página activa,
migra su estado de navegación reutilizando `migrateRuntimeStateAcrossConfig` (degrada a `initialPage` con
`params: {}`, mismo mecanismo ya documentado en [[#Preservación de estado al aplicar]], sin lógica nueva). Un
commit rechazado muestra el aviso `role="alert"` junto a la fila de esa página.

Antes de confirmar, si existen referencias `navigateTo` con ese `pageId` en el `layout` de cualquier página, en
`shell.header` o en `shell.sidebar`, el diálogo añade un aviso listando cuántas hay y en qué fuente (por página,
"en el menú del header", "en el sidebar"). El escaneo es un recorrido estructural genérico sobre el config —
cuenta cualquier objeto con la forma exacta `{ type: 'navigateTo', pageId }` sin conocer nombres de campo de acción
concretos (`props.action`, `submitAction`, `onSuccess`, `onError`, `operations`, etc.) — y el aviso es puramente
informativo: no bloquea el borrado ni repara las referencias, que quedan huérfanas tras confirmar.

### Pipeline de commit
Las mutaciones de alta/baja/edición de `title` parchean únicamente la clave raíz `pages` sobre el último texto
crudo válido conocido (`commitPagesMutation`/`patchRawConfigTextWithPages` en `dev-runtime.tsx`); designar
`initialPage` parchea la clave raíz `initialPage` (`commitInitialPageMutation`/`patchRootKey`) — mismo patrón que
`Shell`/`Traducciones` sobre sus respectivas claves. A diferencia de esas dos, `pages[]` puede llevar `preloads` con
su propia divergencia raw/normalizado (ver [[#Sincronización entre canvas y Monaco]]): el parcheo de `pages`
preserva el `layout`/`preloads` crudo de cada página ya existente que el panel no tocó — solo aplica el `title`
mutado por encima —, y escribe tal cual una página nueva (`{ id, layout: [], title? }`, ya compatible con el
formato crudo). Un commit exitoso desde `Páginas` activa la misma guardia de cambios aplicados (ver
[[#Guardia de cambios aplicados]]) que el resto de commits del editor.

## Límites del editor visual

### Alcance funcional
- No hay deshacer/rehacer (undo/redo) de las operaciones del canvas; Monaco sigue disponible como red de seguridad manual.
- No hay selección múltiple de nodos, duplicar/copiar un nodo, ni atajos de teclado dedicados.
- El panel de propiedades no incluye pickers contextuales para referencias string (`queries.x`, `forms.x`, `params.x`, `{{...}}`); esos campos se editan como texto plano, igual que el resto de propiedades del schema.
- El canvas de esta sección edita únicamente `layout`; `tokens` queda fuera de esta entrega (feature futura independiente). `shell`, `api`/`preloads`, `translations` y `pages` (alta/baja/`initialPage`) ya tienen panel de formulario dedicado propio (ver [Sección Shell](#sección-shell-dominio-de-configuración), [Sección Api](#sección-api-dominio-de-configuración), [Sección Traducciones](#sección-traducciones-dominio-de-configuración) y [Sección Páginas](#sección-páginas-dominio-de-configuración)), fuera del modelo de canvas/selección de `Layout`.

### Persistencia y entorno
- No persiste cambios entre sesiones del navegador (`localStorage`/`sessionStorage` fuera de alcance). Los cambios aplicados viven solo en memoria de sesión, igual que el buffer de Monaco.
- No descarga el JSON como archivo.
- Recargar la página descarta todos los cambios sin aplicar.
- No resalta errores de validación inline en Monaco; solo los muestra en el panel flotante adjunto.
- No permite varias instancias simultáneas del editor sobre el mismo runtime.
- No modifica el contrato observable del runtime en producción ni su frontera pública de errores.

### Vistas del contenido
- El árbol editado en modo Editor es el **mismo árbol renderizado en modo Visual y en producción** — no existe una vista paralela o simulada. Cuando se edita en modo Editor, el usuario ve de inmediato cómo quedaría el resultado.
- Con `repeater` expandido en Visual, al cambiar a modo Editor se colapsa a una única instancia de plantilla (porque en modo Editor solo se muestra la plantilla editable, no todas las instancias iteradas). Cambiar la plantilla en modo Editor se refleja en todas las iteraciones al volver a Visual.
