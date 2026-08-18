# 0136 — Normalización visual de widgets del editor visual (Columnas, Visibilidad, Icono, Shell, Traducciones)

## Objetivo

Extender el lenguaje visual del diseño de referencia que `0134` (F-B) ya aplicó a los campos genéricos del panel de
propiedades a los widgets dedicados y paneles que quedaron explícitamente fuera de esa entrega: el widget "Columnas" (
`layout.span`), el widget de Visibilidad (condición/grupo), el widget de Icono, y los paneles de nivel superior "Shell"
y "Traducciones". El resultado busca que todo el editor visual comparta la misma identidad: sin cajas con borde/fondo
agrupando campos, labels sin prefijos de contexto redundantes, y el mismo patrón de fila label-izquierda/control-derecha
donde aplique.

No introduce campos nuevos, no cambia el contrato JSON de `layout.span`, `visibility`/`when`, `icon`, `shell` ni
`translations`, y no toca el pipeline de commit/validación existente.

## Alcance

### Widget Columnas (`layout.span`, `LayoutSpanPropertyField`)

- Las seis filas fijas (`base`/`sm`/`md`/`lg`/`xl`/`2xl`) pasan de "una fila por breakpoint" a los 6 inputs numéricos en
  una única fila horizontal, con el nombre del breakpoint como label debajo de cada input.
- Se elimina el indicador `/ N` de cada input; el denominador sigue disponible únicamente en la leyenda de la barra de
  vista previa de ocupación ya existente (`0134`, FR7: "Vista previa en {breakpoint}: ocupa {span} de {N}.").
- "Quitar" pasa de botón de texto junto al input a un control "×" superpuesto en la esquina del propio input, visible
  solo cuando ese breakpoint tiene un valor explícito (los heredados, en gris, no lo muestran — igual que hoy).
- Se elimina la caja (`fieldset` con borde/fondo) que envuelve el widget; el título "Columnas" queda como cabecera de
  texto simple, sin caja, consistente con el resto del panel.

### Widget Visibilidad (`ConditionGroupPropertyField`)

- Se elimina el patrón de label `"${label} — Campo"` (por ejemplo `"Visibilidad — Referencia"`,
  `"Elemento de menú 1 — Visibilidad — Operador"`) en todos los usos del widget: la pestaña "Visibilidad" del nodo,
  cualquier `when` dentro de acciones (`executeOperations.operations`, `onSuccess`/`onError`), y el campo `visibility`
  de `menuItem`/`sidebarItem` en el panel Shell.
- El selector de forma ("Condición simple" / "Grupo (y/o)") y el selector de operador del grupo ("and"/"or") dejan de
  mostrar el label compuesto con el contexto; quedan como "Forma" y "Operador del grupo" sueltos.
- En modo "Condición simple" (una sola condición, sin ambigüedad), los campos internos (Referencia, Operador, itemField,
  Valor, Negar) quedan sin ningún prefijo.
- En modo "Grupo (y/o)", cada condición del grupo pasa a mostrar una cabecera de texto simple **"Condición N"** (N =
  posición, 1-indexado) en vez de repetir el prefijo en cada campo interno; los campos internos de esa condición quedan
  sueltos ("Referencia", "Operador", etc.), diferenciados entre sí solo por pertenecer a la sección de su propia "
  Condición N".
- Se elimina la caja del widget en todos sus niveles: el `fieldset` raíz con borde punteado, y el borde individual (
  `rounded border border-gray-200`) que hoy envuelve cada condición dentro de un grupo — la separación entre condiciones
  queda dada por la cabecera "Condición N" y el espaciado vertical, no por un borde.

### Widget Icono (`IconPickerPropertyField`)

- El picker se envuelve en el mismo componente de fila label-izquierda/control-derecha (`PropertyFieldRow`) que ya usan
  los campos genéricos de texto/número/enum/booleano: label "Icono" (o el label de contexto vigente en cada sitio) a la
  izquierda, buscador + chip de previsualización a la derecha. La cuadrícula de resultados, al abrirse, se sigue
  desplegando debajo, ocupando el ancho completo de la fila.
- Es un único cambio en el componente compartido: se refleja automáticamente en sus tres puntos de montaje actuales (el
  hook `x-widget: 'icon'` del dispatcher genérico en `Layout`, y los dos usos directos en `MenuItemFieldsEditor`/
  `SidebarItemFieldsEditor` del panel Shell) sin tocar esos otros archivos más que por el efecto de FR de labels
  descrito abajo.

### Panel Shell (`shell-config-panel/`)

- Se elimina la caja completa (`fieldset` con `rounded border p-2`) del nivel raíz de: `ShellMenuListEditor` ("Menú"),
  `SidebarItemListEditor` en su nivel raíz ("Elementos del sidebar"), y `ShellActionsListEditor` ("Acciones"). Cada
  título queda como cabecera de texto simple, sin caja.
- Los niveles ya anidados que usan una guía de indentación en vez de una caja completa (el desplegable de `menuItem`/
  `menuItemChild`, sin legend propio hoy; "Hijos del elemento de sidebar N" en `SidebarItemListEditor`) no cambian — no
  tienen una caja de fondo/borde que eliminar, ya están en el estilo objetivo.
- `ShellActionsListEditor` elimina además la caja individual que envuelve cada acción (`link`/`button`); "Acción N" pasa
  de repetirse en el label del campo ("Acción N — Tipo") a una cabecera de texto simple "Acción N" con el campo "Tipo"
  suelto debajo.
- `MenuItemFieldsEditor` y `SidebarItemFieldsEditor` eliminan el prefijo `"${labelText} — Campo"` de cada uno de sus
  campos (Etiqueta, Icono, Modo, Href/Acción, Visibilidad) y lo sustituyen por una cabecera de texto simple con el
  `labelText` vigente de esa fila ("Elemento de menú N" / "Elemento de sidebar N"), con los campos internos sueltos
  debajo.

### Panel Traducciones (`translations-panel/`)

- Se elimina la caja (`fieldset`/`div` con `rounded border p-2`) de los bloques "Añadir entrada", "Añadir idioma", "
  Buscar y añadir" (búsqueda + resultados) y "Refrescar todo" (lista + acción). Cada título queda como cabecera de texto
  simple.
- Los formularios sueltos de estos bloques ("Clave" + una fila por idioma en "Añadir entrada"; "Código de idioma" en "
  Añadir idioma"; "Buscar texto" en la búsqueda) pasan del patrón actual (label encima del input) al mismo patrón de
  fila label-izquierda/control-derecha usado en el resto del panel.
- La tabla principal de edición de claves/idiomas (`<table>`) no se toca: es un patrón de tabla, no un formulario de
  campos, y queda fuera de esta normalización.

## Fuera de alcance

- Cualquier cambio de contrato JSON (`layout.span`, `visibility`/`when`, `icon`, `shell`, `translations`) o de su
  validación.
- Cambios de comportamiento de commit, de la lógica de detección de forma/operador del widget de Visibilidad, del
  pipeline de arrastrar-y-soltar de Shell, o de la sincronización con el proveedor externo de Traducciones.
- La tabla principal de edición de claves/idiomas del panel Traducciones.
- Cualquier widget o panel no mencionado explícitamente en el Alcance (el resto de campos genéricos, `choice-items`, el
  acordeón `queryStateFeedback`, el selector "Contenido" de `link`, el resto de la pestaña `Layout`/`Api`/`Páginas`/
  `Tokens`) — ya quedaron en su estado objetivo tras `0133`/`0134`/`0135` y no cambian.
- Cambios en el runtime de producción, en Monaco o en la validación de configuración.

## Requisitos funcionales

### FR1 — Re-skin del widget Columnas

Las seis filas de `LayoutSpanPropertyField` se muestran como una única fila de 6 inputs numéricos (uno por breakpoint),
con el nombre del breakpoint como label debajo de cada input, sin el indicador `/ N`. El comportamiento no visual (valor
heredado en gris para breakpoints sin clave explícita, conversión entero→mapa en la primera edición, validación por
input, integración con la barra de vista previa ya existente) no cambia.

### FR2 — Control "Quitar" del widget Columnas

Un input con valor explícito para su breakpoint muestra un control "×" en su esquina; los inputs con valor heredado no
lo muestran. Activar ese control commitea la misma operación de borrado que hoy (quitar la clave del mapa `layout.span`,
o `undefined` si era la última clave explícita restante).

### FR3 — Eliminación de la caja del widget Columnas

El widget deja de envolverse en un `fieldset` con borde/fondo. "Columnas" se muestra como cabecera de texto simple, sin
caja alrededor de la fila de inputs ni de la barra de vista previa.

### FR4 — Simplificación de labels del widget Visibilidad

`ConditionGroupPropertyField` deja de construir sus labels internos como `"${label} — Campo"`. El selector de forma se
muestra como "Forma"; en modo condición simple, los campos internos se muestran sueltos ("Referencia", "Operador", "
itemField", "Valor", "Negar"); en modo grupo, el selector de operador se muestra como "Operador del grupo" y cada
condición del grupo muestra una cabecera de texto simple "Condición N" (N = posición 1-indexada) con sus campos internos
sueltos debajo. Esta regla aplica de forma idéntica en cualquier punto de montaje del widget (pestaña Visibilidad,
`when` de operaciones, `visibility` de `menuItem`/`sidebarItem` en Shell), sin lista de excepciones por contexto.

### FR5 — Eliminación de la caja del widget Visibilidad

Se elimina tanto el `fieldset` raíz del widget como el borde individual que hoy envuelve cada condición dentro de un
grupo. La separación visual entre condiciones de un mismo grupo queda dada por la cabecera "Condición N" y el espaciado,
sin ningún borde.

### FR6 — Re-skin del widget Icono

`IconPickerPropertyField` se monta dentro de la fila estándar label-izquierda/control-derecha (`PropertyFieldRow`) en
vez de renderizar su propio layout sin label visible. El label recibido por el widget (`"Icono"` en el dispatcher
genérico de `Layout`, o el label de contexto vigente tras aplicar FR4/FR8 en Shell) se muestra a la izquierda; el
buscador y el chip de previsualización quedan a la derecha, con la cuadrícula desplegándose debajo a todo lo ancho
cuando está abierta. El resto de la interacción (paginación, navegación por teclado, cierre por click-fuera/Escape,
botón "Quitar icono") no cambia.

### FR7 — Eliminación de cajas raíz en el panel Shell

Se elimina la caja completa del nivel raíz de `ShellMenuListEditor` ("Menú"), del nivel raíz de
`SidebarItemListEditor` ("Elementos del sidebar") y de `ShellActionsListEditor` ("Acciones"); cada título queda como
cabecera de texto simple. Los niveles ya anidados sin caja completa (desplegable de `menuItem`, "Hijos del elemento de
sidebar N") no cambian.

### FR8 — Simplificación de labels y caja por-fila en el panel Shell

`MenuItemFieldsEditor` y `SidebarItemFieldsEditor` sustituyen el prefijo `"${labelText} — Campo"` de cada uno de sus
campos por una cabecera de texto simple con el `labelText` vigente ("Elemento de menú N" / "Elemento de sidebar N"),
quedando los campos internos (Etiqueta, Icono, Modo, Href/Acción, Visibilidad) sin prefijo repetido.
`ShellActionsListEditor` elimina la caja individual por acción y sustituye `"Acción N — Tipo"` por una cabecera "Acción
N" con el campo "Tipo" suelto.

### FR9 — Eliminación de cajas en el panel Traducciones

Se elimina la caja de los bloques "Añadir entrada", "Añadir idioma", "Buscar y añadir" y "Refrescar todo"; cada título
queda como cabecera de texto simple. La tabla principal de edición no se ve afectada.

### FR10 — Filas label-izquierda/control-derecha en el panel Traducciones

Los campos de los formularios "Añadir entrada" (Clave, una fila por idioma), "Añadir idioma" (Código de idioma) y "
Buscar texto" pasan del patrón label-encima-de-input al mismo patrón de fila label-izquierda/control-derecha (
`PropertyFieldRow` o su mismo lenguaje visual) usado en el resto del panel.

## Requisitos no funcionales

- Solo utilidades de Tailwind CSS; sin dependencias nuevas ni estilos inline.
- Sin cambios de comportamiento de commit, validación o accesibilidad de foco/teclado más allá de lo descrito en cada
  FR (los widgets mantienen su semántica ARIA existente — `role="switch"`, `role="grid"`/`gridcell`, roving tabindex,
  `aria-alert` de rechazo de commit — sin regresiones).
- Cambios acotados al editor de desarrollo (`src/dev-runtime/`); cero impacto en el runtime de producción y en el modo
  Visual.
- Se mantiene el umbral global de cobertura del 80%.

## Criterios de aceptación

1. El widget "Columnas" de un nodo con `layout.span` de tres claves explícitas (`base`, `md`, `xl`) muestra los 6 inputs
   en una sola fila, con el nombre de cada breakpoint debajo, sin ningún texto `/ N`, y sin caja alrededor.
2. Los inputs de `base`, `md` y `xl` (valor explícito) muestran un control "×"; los de `sm`, `lg`, `2xl` (heredado, en
   gris) no lo muestran. Pulsar el "×" de `md` commitea el mismo resultado que hoy tiene "Quitar" (borra la clave `md`
   del mapa).
3. La barra de vista previa de ocupación (`0134`, FR7) sigue funcionando sin cambios: foco en un input cambia el
   breakpoint previsualizado, blur lo devuelve a `base`.
4. En la pestaña "Visibilidad" de un nodo con una condición simple, los campos se muestran como "Referencia", "
   Operador", etc., sin ningún prefijo "Visibilidad —" ni caja alrededor.
5. Cambiar la forma a "Grupo (y/o)" con 2 condiciones muestra dos bloques encabezados "Condición 1" y "Condición 2",
   cada uno con sus campos sueltos debajo y sin borde individual; el operador del grupo se muestra como "Operador del
   grupo" sin prefijo.
6. El mismo widget de Visibilidad montado dentro de un `menuItem` en el panel Shell (campo `visibility`) muestra el
   mismo tratamiento sin prefijo — sin "Elemento de menú 1 — Visibilidad — Referencia" ni ninguna variante compuesta.
7. Cualquier campo `icon` de la pestaña `Props`/`Diseño` de `Layout` muestra "Icono" a la izquierda del buscador, con la
   cuadrícula desplegándose debajo al abrir.
8. Los campos `icon` de un item de menú y de un item de sidebar en el panel Shell muestran el label a la izquierda del
   buscador, heredado del mismo cambio de FR6, sin trabajo adicional en esos ficheros más allá de FR8.
9. El panel Shell no muestra ninguna caja con borde/fondo en el nivel raíz de "Menú", "Elementos del sidebar" ni "
   Acciones"; el desplegable de un `menuItem` y los niveles anidados del sidebar mantienen su indentación con guía
   vertical, sin caja completa.
10. Un item de menú expandido muestra una cabecera "Elemento de menú 1" con sus campos (Etiqueta, Icono, Modo, Href o
    Acción, Visibilidad) sueltos debajo, sin ningún prefijo repetido por campo.
11. Una acción (`link`/`button`) de `shell.header.actions` muestra una cabecera "Acción 1" con el campo "Tipo" suelto
    debajo, sin caja individual alrededor de la acción.
12. El panel Traducciones no muestra ninguna caja con borde/fondo en "Añadir entrada", "Añadir idioma", "Buscar y
    añadir" ni "Refrescar todo"; sus campos (Clave, cada idioma, Código de idioma, Buscar texto) se muestran en fila
    label-izquierda/control-derecha.
13. La tabla principal de edición de claves/idiomas de Traducciones no cambia de aspecto.
14. Un commit rechazado en cualquiera de los controles restilados (Columnas, Visibilidad, Icono, campos de Shell, campos
    de Traducciones) conserva el valor elegido y muestra el mismo aviso `role="alert"` que ya existe, sin regresión de
    comportamiento.

## Casos límite

- Quitar el último breakpoint explícito de "Columnas" sigue commiteando `layout.span` como `undefined`, no un mapa
  vacío (comportamiento ya existente).
- Un `layout.span` como entero plano (sin mapa) sigue mostrando los 6 inputs con ese valor uniforme heredado en gris,
  sin ningún "×" visible, coherente con FR2.
- Un grupo de Visibilidad con una única condición (`conditions.length === 1`) sigue mostrando la cabecera "Condición 1"
  aunque el botón "Quitar condición" quede deshabilitado (comportamiento ya existente, solo cambia el label de la
  cabecera).
- Un `mode`/`operator` fuera de catálogo introducido a mano en Monaco sigue degradando sin romper el panel, igual que
  hoy; solo cambia el texto de los labels que lo envuelven.
- Una fila de menú/sidebar colapsada no muestra ningún campo (comportamiento ya existente); la cabecera "Elemento de
  menú N"/"Elemento de sidebar N" solo es visible cuando la fila está expandida, igual que hoy los campos.
- Un valor de icono no reconocido sigue mostrando la nota "Valor actual" sin preview y sin bloquear la búsqueda, ahora
  dentro de la fila estándar con label a la izquierda.
- Una lista de idiomas vacía en "Añadir entrada" (solo la fila "Clave") pierde igualmente la caja, sin depender de
  cuántas filas de idioma haya.

## Riesgos o preguntas abiertas

- Alcance amplio: toca 3 widgets dedicados más 2 paneles completos (Shell y Traducciones), varios de ellos con lógica de
  arrastrar-y-soltar o de sincronización externa que no debe verse afectada por el cambio puramente visual. Conviene una
  pasada de QA visual e interactiva sobre cada panel durante la implementación (colapsar/expandir filas, arrastrar en
  Shell, guardar y refrescar en Traducciones), no solo una revisión estática.
- La eliminación del borde individual por-condición dentro de un grupo de Visibilidad (FR5) es una decisión de esta
  spec, no una preferencia explícita verificada contra un mock de Figma — se apoya en la cabecera "Condición N" más
  espaciado como único separador visual, coherente con la ausencia de cajas ya aplicada al resto del panel por `0134`
  /FR8. Si en implementación se ve pobre sin ningún separador, una alternativa de bajo riesgo es una línea divisoria
  fina entre condiciones (no una caja cerrada) — decisión que puede tomarse en `generate-implementation-plan` sin
  reabrir esta spec.

## Áreas de producto afectadas (alto nivel)

- Editor visual del `layout` en modo Editor: widget `layout.span` ("Columnas"), widget de Visibilidad (condición/grupo),
  widget de Icono.
- Panel Shell del editor visual: listas de Menú/Sidebar/Acciones y sus editores de campos por item.
- Panel Traducciones del editor visual: formularios de alta de entrada/idioma y de búsqueda/refresco.

## Documentación probablemente afectada (alto nivel)

- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (secciones del widget de Columnas, del widget de
  Visibilidad, del widget de Icono, del panel Shell y del panel Traducciones).
