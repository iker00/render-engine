> Cuándo leer: si la tarea toca el editor de configuración en vivo, el drawer lateral, el editor visual del `layout` (canvas de arrastrar y soltar), la preservación de estado al aplicar cambios, el autocompletado JSON Schema o el comportamiento de recarga por HMR en desarrollo.
> Tamaño: grande.
> Relacionados: [[local-config.md]], [[../config/validation.md]], [[../config/structure.md]], [[../nodes/index.md]].

# Editor de configuración en vivo (dev mode)

## Objetivo
Permitir editar el JSON de configuración directamente en el navegador durante el desarrollo, validarlo con el mismo validador del runtime y aplicarlo para ver el resultado al instante, sin recargar la página ni depender de backend. Junto al editor de texto Monaco, una **barra de herramientas flotante** persistente ofrece también un editor visual del árbol `layout` de la página activa mediante manipulación directa sobre el propio preview real renderizado — no un árbol duplicado, sino el mismo contenido que ve el usuario — con controles para cambiar de página, seleccionar modo Visual/Editor, abrir la paleta de nodos y acceder a Monaco (ver [[#Barra flotante]] y [[#Editor visual del layout]]).

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
2. **Selector de pestaña de dominio**: cuatro botones (`Layout`, `Api`, `Páginas`, `Tokens`). Solo `Layout` es funcional; las otras tres se renderizan como deshabilitadas o con indicación "Próximamente", sin acción al interactuar. En esta feature solo `Layout` permite edición visual.
3. **Botón "Añadir elemento"**: abre la paleta flotante de nodos (ver sección [[#Paleta flotante de nodos]]), desde la que se puede arrastrar un nodo hasta el contenido para insertarlo. Su estado (abierto/cerrado) se refleja visualmente en la barra.
4. **Botón de acceso a Monaco** (icono `{}`): abre el panel flotante de Monaco (ver sección [[#Panel flotante de Monaco]]). Su estado se refleja visualmente en la barra.
5. **Toggle Visual/Editor**: dos botones (`Visual`, `Editor`) que controlan el modo. Al arrancar, el modo por defecto es `Visual`. Solo pueden estar activos alternativamente. El toggle modifica el comportamiento del árbol renderizado sin necesidad de recarga (ver [[#Modo Visual]] y [[#Modo Editor]]).

### Modo Visual
Por defecto al arrancar `DevRuntime`, el contenido se comporta exactamente igual que en producción: navegación por `link`/`button`, envío de formularios, ejecución de queries, campos de formulario editables. No hay selección, breadcrumb, panel de propiedades ni indicadores de arrastre visibles. Esta es la experiencia del usuario final, reflejada en el mismo árbol real renderizado.

### Modo Editor
Al activar "Editor" desde la barra, se habilita la edición visual directa sobre el contenido:
- **Selección**: hacer click sobre un nodo lo selecciona; hover lo resalta sin cambiar la selección. La selección se identifica por un `path` estructural resuelto contra el árbol real.
- **Panel de selección**: al seleccionar un nodo, aparece un panel fijo acoplado al borde derecho de la pantalla mostrando el breadcrumb de ancestros y el panel de propiedades del nodo seleccionado. El panel ocupa entre el 90% y el 100% de la altura del viewport y dispone de scroll vertical interno cuando su contenido excede esa altura. El panel no reduce el ancho disponible del contenido renderizado.
- **Cierre del panel de selección**: el panel incluye un botón "Cerrar" visible en su cabecera. Al pulsarlo, el panel se oculta y la selección del nodo se limpia (desaparece el resaltado de selección). Además, con el panel de selección abierto y el panel de Monaco cerrado, pulsar `Esc` produce el mismo efecto (cierra el panel y limpia la selección).
- **Breadcrumb de ancestros**: cadena clicable de ancestros desde el nodo seleccionado hasta la raíz del layout (ej: `container > form > heading`). Clicar un segmento cambia la selección a ese ancestro.
- **Panel de propiedades**: muestra las secciones `Props`, `Layout`, `Visibilidad` y `Estado de consulta` generadas dinámicamente desde el schema Zod del nodo. Editar cualquier campo actualiza el estado en memoria e inmediatamente se refleja tanto en el contenido renderizado como en el buffer de Monaco.
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

### Estado del editor entre modos
- **Alternar Visual ⇄ Editor sin cambiar de página**: la selección y el overlay se conservan (al volver a Editor, se ve el mismo nodo seleccionado que en la última vez que se estuvo en Editor).
- **Cambiar de página**: se limpia toda selección previa, independientemente del modo.
- **Cambiar de pestaña de dominio fuera de `Layout`**: se limpia la selección, ya que esas pestañas no contienen `layout` que editar en esta feature.

Los cambios en el editor (canvas y Monaco) persisten en memoria entre cierres y aperturas de paneles en la misma sesión. Recargar la página descarta cambios sin aplicar.

## Autocompletado JSON Schema
El editor Monaco registra un JSON Schema derivado del schema Zod raíz (`runtimeConfigRootSchema` en `src/config/runtime-config-root-zod.ts`) usando el método built-in `toJSONSchema` de Zod v4. No se usa la librería externa `zod-to-json-schema` porque no es compatible con Zod v4 (el package está instalado como dependencia pero no se importa). El schema cubre el contrato completo del runtime config incluyendo la unión discriminada de nodos por `type`.

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
Capa de edición visual del árbol `layout` mediante manipulación directa sobre el **mismo contenido real renderizado** (no un árbol duplicado, no un panel de árbol tipo "layers"), activable mediante el toggle Visual/Editor de la barra flotante. En modo Editor, el usuario edita e interactúa con el mismo árbol que renderiza el runtime en producción, sin la intermediación de una segunda copia o lienzo separado. Cubre únicamente el `layout` de una página; `api`, `pages` (alta/baja/`initialPage`), `tokens` y `translations` quedan fuera de esta entrega.

### Selector de página en la barra
El selector de página de la barra flotante cambia la página activa del runtime real (navegación por hash, con los parámetros transportados según el mecanismo estándar). Funciona en ambos modos (Visual y Editor), permitiendo ver y editar cualquier página disponible sin necesidad de cerrar el editor o cambiar de modo. Cambiar de página con un nodo seleccionado en modo Editor limpia la selección.

### Selección y hover (modo Editor)
Click sobre un nodo renderizado en modo Editor lo selecciona; hover lo resalta visualmente sin cambiar la selección. La selección se identifica por un `path` estructural resuelto contra el árbol real renderizado, no por índice DOM. Si el nodo seleccionado deja de existir en el árbol (por ejemplo, se borró desde Monaco y se aplicó), la selección se limpia automáticamente sin intentar referenciar un nodo inexistente.

### Breadcrumb de ancestros
El overlay flotante junto al nodo seleccionado muestra la cadena de ancestros hasta la raíz del `layout` de la página (por ejemplo `container > form > heading`), con la etiqueta `type`, o `type (id)` cuando el nodo declara `id`. Cada segmento salvo el último (el nodo ya seleccionado) es clicable y cambia la selección a ese ancestro, permitiendo editar las propiedades de un `container` o `form` padre y no solo de las hojas.

### Panel de propiedades (modo Editor)
Con un nodo seleccionado en modo Editor, el overlay flotante muestra un panel con las secciones `Props`, `Layout`, `Visibilidad` y `Estado de consulta` (`queryStateFeedback`), mostrando solo las que el `type` del nodo seleccionado declara según su schema Zod individual. Los campos se generan dinámicamente a partir del mismo JSON Schema derivado (`toJSONSchema` de Zod v4) que ya alimenta el autocompletado de Monaco — no existe un segundo contrato de UI hardcodeado por tipo de nodo. Editar cualquier campo actualiza el estado en memoria de inmediato y se refleja tanto en el contenido renderizado como en el buffer de Monaco, sin necesidad de pulsar ningún botón "Aplicar" adicional. Un campo `layout.span` declarado como mapa responsive por breakpoint se edita con merge superficial sobre el objeto existente: cambiar un breakpoint no borra los demás ya declarados que no sean visibles en el viewport actual.

Un array editable declarado con `minItems` en su schema (por ejemplo `tabs.props.items`, con mínimo de una pestaña, o `submitAction.operations` cuando la variante es `executeOperations`, con el mismo mínimo) bloquea el botón "Quitar" de cada entrada mientras la longitud actual del array sea igual a ese mínimo, para no dejar el nodo en un estado estructuralmente inválido. Al pulsar "Añadir" sobre un array de objetos, el nuevo elemento se rellena con un valor por cada propiedad `required` de su sub-schema (usando el `default` declarado en el sub-schema cuando existe, o `''`/`0`/`false` según el tipo en caso contrario) en vez de un objeto vacío. Para el nodo `tabs` en particular, cada entrada de `props.items` en este panel expone únicamente `label` y `visibility`: `children` (el subárbol de contenido de la pestaña) queda excluido del editor genérico porque no es representable como campo de formulario — ese contenido solo se edita arrastrando nodos sobre la pestaña en el canvas o directamente desde Monaco — y una pestaña nueva creada con "Añadir" recibe la etiqueta por defecto "Nueva pestaña".

Editar cualquier campo actualiza el estado en memoria de inmediato y se refleja tanto en el contenido renderizado como en el buffer de Monaco — con la excepción de un commit rechazado por validación, ver [[#Feedback cuando un cambio del panel de propiedades no se puede guardar]].

### Selector de variante para uniones discriminadas por `type` (acciones)
Cuando el sub-schema de un campo es una unión discriminada por la propiedad literal `type` — el caso de `button.props.action`, `link.props.action` y `form.submitAction` — el panel renderiza un selector desplegable con una opción por variante (etiqueta legible en español, p. ej. "Navegar a página" para `navigateTo`, "Ejecutar operación" para `executeOperation`) más "Sin acción" cuando el campo es opcional. El catálogo de variantes ofrecidas depende únicamente del schema del nodo, sin lista paralela en el editor:
- `button.props.action`: las 7 variantes soportadas por el runtime (`navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal`, `closeModal`) más "Sin acción".
- `link.props.action`: solo `navigateTo` y `goBack` más "Sin acción".
- `form.submitAction`: solo `executeOperation` y `executeOperations` más "Sin acción". Cada entrada de sus listas opcionales `onSuccess`/`onError`, y cada entrada de `executeOperations.operations`, ofrece de nuevo las 7 variantes.

Debajo del selector se muestran únicamente los campos propios de la variante activa. Elegir una variante distinta reconstruye el valor desde cero con los valores por defecto de esa variante (ningún campo de la variante anterior sobrevive al cambio) y elegir "Sin acción" deja la propiedad completamente sin definir. Una condición `when` declarada en una entrada de `executeOperations.operations` o de `onSuccess`/`onError` se edita reutilizando el mismo control que `visibility` (condición simple o grupo `and`/`or`), sin un editor duplicado.

### Widget dedicado para `props.items` de `select`, `radioGroup` y `checkboxGroup`
`props.items` de estos tres nodos comparte un contrato de tres shapes (manual literal, manual escalar, dinámico unificado con `itemType`) que no encaja en el patrón de selector de variante anterior porque las variantes no comparten un discriminador `type` literal en el JSON (manual literal es un array puro, manual escalar y dinámico son objetos con claves distintas). Para este caso el panel usa un widget dedicado (`ChoiceItemsPropertyField`) en vez de los detectores genéricos del dispatcher:
- Un selector de modo con tres opciones legibles ("Manual — literal", "Manual — escalar", "Dinámico"). El modo activo se detecta a partir de la forma del propio valor: array → manual literal, objeto con `values` → manual escalar, objeto con `source` → dinámico; cualquier valor no reconocible (por ejemplo `null`) cae a manual literal vacío sin lanzar error.
- Cambiar de modo reemplaza el valor por completo con la plantilla mínima del nuevo modo (`[]`, `{ values: [] }` o `{ source: '', itemType: 'scalar' }`); no se conserva ningún campo del modo anterior.
- **Manual literal**: lista editable de pares `label`/`value` como texto libre, con controles "Añadir" y "Quitar" por entrada.
- **Manual escalar**: lista editable de valores como texto libre, con los mismos controles "Añadir"/"Quitar".
- **Dinámico**: campo `source` como texto libre, sub-selector `itemType` (`scalar`/`object`), y campos `label`/`value` que solo aparecen cuando `itemType === 'object'`. Cambiar `itemType` de `object` a `scalar` retira `label`/`value` del valor; el sentido inverso los reintroduce como campos vacíos.

Este widget no incluye picker contextual para `source`: se edita como texto plano, igual que el resto de referencias string del panel.

El dispatcher se apoya para esto en un hook `x-widget`: si el fragmento de schema efectivo declara `{ 'x-widget': 'choice-items' }`, delega la edición completa en `ChoiceItemsPropertyField` antes de aplicar cualquier patrón genérico. El hook resuelve contra un registro cerrado dentro del propio dispatcher (sin API para inyectar widgets desde fuera); cualquier otro valor de `x-widget`, o su ausencia, deja el campo en los patrones genéricos de siempre. Para llegar hasta ahí, el panel de propiedades sustituye el sub-schema `items` derivado de Zod por ese sentinel solo en la subsección `Props` de `select`, `radioGroup` y `checkboxGroup` (mismo precedente que `resolveTabsPropsSchema` para `tabs.props.items`); el schema que consume Monaco no cambia y sigue siendo el Zod real con el `oneOf` completo.

### Editor clave-valor (`params`, `query`, `headers`, `body`)
Los campos de tipo mapa abierto `string → string` (`navigateTo.params`, `executeOperation`/`executeOperations`'s `query` y `headers`) se editan con un formulario de filas clave-valor: cada fila tiene un input de clave y un input de valor, con un botón "Quitar" por fila y un botón "Añadir" al final que crea una fila con clave y valor vacíos. Renombrar la clave de una fila conserva su valor; todos los valores se tratan como texto plano (sin coerción a número o booleano), lo que ya cubre literales, interpolación `{{...}}` y referencias dinámicas.

`body` usa el mismo editor con una excepción por clave: si el valor actual de una clave concreta ya es un array o un objeto anidado, esa fila muestra el mismo textarea de solo lectura que el editor usa como último recurso para cualquier valor no representable como campo de formulario, sin afectar al resto de claves de ese mismo `body` ni al selector de variante. Añadir una clave nueva siempre la crea como texto vacío.

### Feedback cuando un cambio del panel de propiedades no se puede guardar
Cada subsección del panel (`Props`, `Layout`, `Visibilidad`, `Estado de consulta`) valida su cambio contra el config completo antes de aplicarlo, igual que el resto de mutaciones del canvas. Si el commit se rechaza — por ejemplo, al elegir una variante de acción cuyo campo obligatorio (`operationName`, `pageId`, `formId`, `modalId`) queda vacío hasta que el usuario lo rellena — el campo no revierte en silencio a su valor anterior: sigue mostrando el cambio tal cual lo dejó el usuario, y justo debajo aparece un aviso (`role="alert"`) con el código y el mensaje del error de validación. El aviso desaparece en cuanto un cambio posterior de esa misma subsección se guarda correctamente, o al seleccionar otro nodo. El config aplicado (`currentConfig` y el buffer de Monaco) no cambia mientras el aviso esté visible — el gate de validación que ya usa el botón Aplicar de Monaco no se relaja en ningún caso.

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

### Eliminar nodo (modo Editor)
Con un nodo seleccionado en modo Editor, un botón "Eliminar nodo" en el panel de propiedades borra ese nodo y todo su subárbol del `layout`, y limpia la selección. No hay confirmación modal, deshacer/rehacer ni atajo de teclado dedicado (por ejemplo `Supr`) — quedan fuera de esta primera entrega.

### Reglas de destino de drop (modo Editor)
La validez de un destino (tanto para reordenar/reanidar como para insertar desde la paleta) reutiliza exactamente las mismas reglas estructurales ya vigentes para el contrato JSON (ver [[../config/structure.md]]), sin duplicarlas de forma divergente:
- solo `container`, `form`, `modal`, `link`, `accordion` y una pestaña concreta de `tabs` aceptan hijos.
- `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `fileInput`, `toggle` y `hidden` solo son válidos como descendientes de un `form`, en cualquier profundidad (incluso a través de un `container`/`accordion`/`tabs` intermedio).
- un `button` sin `action` solo es válido como descendiente de un `form`.
- `modal` y `link` conservan su catálogo cerrado propio de tipos hijo admitido (el mismo ya vigente en producción), no el catálogo abierto de `container`.
- `repeater` nunca acepta un drop de hijos fuera de la única instancia de `props.template` que representa en modo edición.
- arrastrar un nodo sobre sí mismo o sobre uno de sus propios descendientes se trata siempre como destino inválido (evita ciclos).

### Contenedores y formularios vacíos (modo Editor)
Un `container` o `form` sin `children` (o con `children: []`) en modo Editor se renderiza con un placeholder visible (borde punteado y etiqueta), seleccionable y válido como destino de drop para insertar el primer hijo. Ese placeholder no existe en el render de producción del mismo `layout`: el nodo vacío sigue sin mostrar nada fuera de modo Editor.

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

## Límites del editor visual

### Alcance funcional
- No hay deshacer/rehacer (undo/redo) de las operaciones del canvas; Monaco sigue disponible como red de seguridad manual.
- No hay selección múltiple de nodos, duplicar/copiar un nodo, ni atajos de teclado dedicados.
- El panel de propiedades no incluye pickers contextuales para referencias string (`queries.x`, `forms.x`, `params.x`, `{{...}}`); esos campos se editan como texto plano, igual que el resto de propiedades del schema.
- Edita únicamente `layout`; `api`, `pages` (alta/baja/`initialPage`), `tokens` y `translations` quedan fuera de esta entrega (son features futuras independientes).

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
