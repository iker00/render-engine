# Tareas — 0136 Normalización visual de widgets del editor visual

## Convención transversal de "cabecera de texto simple, sin caja"

Todas las tareas de este plan eliminan una caja (`fieldset`/`div` con `border`/`rounded`/`bg-*`/`p-*`) y la
sustituyen por una cabecera de texto simple. Para minimizar la varianza entre tareas y agentes, se sigue esta
única convención en todo el plan:

- Donde ya existe un par `<fieldset>` + `<legend>`, se conserva esa pareja de elementos tal cual (no se
  sustituye por `<div>`/`<span>`); solo se retiran del `<fieldset>` las clases que dibujan la caja
  (`rounded`/`rounded-lg`/`border ...`/`bg-*`/`p-*`, incluida la variante `border-dashed`), dejando únicamente
  las clases de layout (`flex flex-col gap-*`). Las clases del `<legend>` (`px-1 text-xs font-medium
  text-gray-700`) no cambian.
- Donde no existe hoy ningún `<fieldset>`/`<legend>` que reutilizar (las cabeceras nuevas "Condición N",
  "Elemento de menú N", "Elemento de sidebar N", "Acción N" que sustituyen a un prefijo de label compuesto), se
  introduce un elemento de texto plano nuevo con la misma clase visual que un `<legend>` de este plan:
  `text-xs font-medium text-gray-700`.
- Ninguna tarea de este plan introduce sombras, fondos alternos, ni ningún otro recurso visual para marcar
  agrupación: la separación entre bloques queda dada únicamente por la cabecera de texto y el espaciado
  vertical (`gap-*`) ya presente en cada contenedor.

## Orden de ejecución

T1 → T2 → T3 → T4 → T5 → T6. El orden es estricto: cada tarea parte del estado dejado por la anterior y varias
tareas comparten ficheros de test que otra tarea posterior vuelve a tocar (ver "Dependencias" de cada una).

---

## T1 — Re-skin del widget Columnas (`LayoutSpanPropertyField`)

### Objetivo
Aplicar FR1, FR2 y FR3 de `spec.md` a `LayoutSpanPropertyField`: las seis filas fijas pasan a una única fila
horizontal de 6 inputs con el nombre del breakpoint debajo de cada input, se elimina el indicador `/ N`, "Quitar"
pasa de botón de texto a un control "×" superpuesto en la esquina del input (visible solo con valor explícito), y
se elimina la caja del widget siguiendo la convención transversal de este documento.

### Fuera de alcance
- Cualquier cambio a `normalizeResponsiveLayoutValue`, `commit-layout-span.ts`, `LayoutSpanWidgetContext` o
  `LayoutSpanOccupancyPreview`: su contrato de props y su comportamiento no cambian, solo cambia cómo
  `LayoutSpanPropertyField` los consume visualmente.
- El comportamiento de foco/blur que controla `previewedBreakpoint` (criterio de aceptación 3): no se toca su
  lógica, solo la disposición visual de los inputs que la disparan.
- Cualquier widget o panel fuera de `layout-span-property-field.tsx`.

### Dependencias
Ninguna. Puede ejecutarse primero sin bloquear ni ser bloqueada por el resto del plan.

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/property-fields/layout-span-property-field.tsx` (único fichero a
  modificar; reestructura el `return` para que las 6 filas se rendericen como columnas de una única fila
  flex/grid horizontal en vez de 6 filas verticales, retira el `<span>/{denominador}</span>`, sustituye el botón
  "Quitar" por un control "×" posicionado en la esquina del input vía `position: relative` en el contenedor de
  cada columna y `position: absolute` en el botón, y retira las clases de caja del `<fieldset>` raíz según la
  convención transversal).
- Tests: `src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx` (ampliación).
- Documentación a revisar tras el cierre (no se toca en esta tarea): `ai-workflow/docs/app-features/development/dev-mode-editor.md`,
  sección "Widget dedicado para `layout.span` (columnas por breakpoint)".

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Con un `spanValue` de tres claves explícitas (`base`/`md`/`xl`) sobre un `parentColumns` fijo, las 6 filas se
  renderizan en un único contenedor de fila horizontal (mismo `data-testid="layout-span-widget"` en el padre;
  los 6 `data-testid="layout-span-widget-row-{breakpoint}"` existentes se conservan como columnas dentro de esa
  fila, sin convertirse en filas apiladas verticalmente).
- Ningún nodo del DOM del widget contiene el texto `/ N` para ningún breakpoint (regresión: el denominador solo
  sigue visible en `LayoutSpanOccupancyPreview`, que no se toca en esta tarea).
- Los inputs con clave explícita (`data-explicit="true"`) muestran un control con `aria-label="Quitar {breakpoint}"`
  posicionado como overlay del propio input (no como botón de texto separado en la fila); los inputs heredados
  (`data-explicit="false"`) no muestran ningún control de quitar, igual que hoy.
- Pulsar el control "×" de una fila con valor explícito invoca `commitSpan` con el mismo resultado que hoy
  produce "Quitar" (borra esa clave del mapa, o commitea `undefined` si era la última clave explícita
  restante) — regresión byte a byte del comportamiento de `computeNextSpanOnRemove` ya cubierto, solo cambia el
  control que lo dispara.
- El `fieldset` raíz del widget no lleva ninguna clase de caja (`border`/`rounded`/`bg-*`); el título "Columnas"
  sigue presente como `<legend>` de texto simple.
- Foco en el input de `md` y posterior blur siguen moviendo `previewedBreakpoint` a `md` y de vuelta a `base`
  respectivamente (regresión sin cambios de comportamiento, solo confirma que la reestructuración horizontal no
  rompe los manejadores `onFocus`/`onBlur` por fila).
- Un `layout.span` como entero plano (sin mapa) sigue mostrando los 6 inputs con el valor uniforme heredado en
  gris y sin ningún control "×" visible en ninguno.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx
```

**Restricciones**:
- No introducir un nuevo componente compartido para el control "×"; es exclusivo de este widget en esta tarea.
- No modificar `data-testid`/`data-explicit` ya existentes por fila: los tests de otras suites que dependan de
  `layout-span-widget-row-{breakpoint}` (por ejemplo en `layout-canvas-properties-panel.test.tsx`) no deben
  romperse por un cambio de nomenclatura.

### Criterios de finalización
- El widget "Columnas" cumple los criterios de aceptación 1, 2 y 3 de `spec.md`, y los casos límite de
  "Quitar el último breakpoint explícito" y "`layout.span` como entero plano" siguen sin regresión.

### Cierre de implementación
Código y tests de esta tarea completos, con `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx`
en verde y sin romper ninguna otra suite existente que monte este widget (`layout-canvas-properties-panel.test.tsx`,
`layout-canvas-properties-panel-commit-feedback.test.tsx`).

---

## T2 — Simplificación de labels y eliminación de caja del widget Visibilidad (`ConditionGroupPropertyField`)

### Objetivo
Aplicar FR4 y FR5 de `spec.md` a `condition-group-property-field.tsx`: el widget deja de construir cualquier
label interno como `"${label} — Campo"` con independencia del `label` que reciba desde fuera; el selector de
forma se muestra como "Forma"; en modo "Condición simple" los campos internos quedan sueltos sin prefijo; en
modo "Grupo (y/o)" el selector de operador se muestra como "Operador del grupo" y cada condición del grupo
muestra una cabecera de texto simple "Condición N" (N = posición 1-indexada) con sus campos sueltos debajo; se
elimina el `fieldset` raíz del widget y el borde individual que hoy envuelve cada condición dentro de un grupo,
siguiendo la convención transversal de este documento.

### Alcance de la reestructuración interna (para evitar reinterpretación)
- `ConditionGroupPropertyField`: retirar las clases de caja del `fieldset` raíz (convención transversal); el
  `legend`/`hideRootLegend` existentes no cambian.
- El selector de forma pasa de `label={`${label} — Forma`}` a `label="Forma"` (string literal, ya no depende de
  `label`).
- `GroupEditor`: el selector de operador pasa de `label={`${label} — Operador del grupo`}` a
  `label="Operador del grupo"` (string literal). Cada fila deja de recibir
  `label={`${label} — Condición ${index + 1}`}`; en su lugar `GroupEditor` pasa a `ConditionRowEditor` una nueva
  prop `headingText={`Condición ${index + 1}`}` (o nombre equivalente) que `ConditionRowEditor` renderiza como
  cabecera de texto simple (convención transversal) inmediatamente antes de sus campos, solo cuando esa prop
  está presente.
- `ConditionRowEditor`: los campos internos (`TextPropertyField`/`EnumPropertyField`/`ConditionValueTypedEditor`/
  `NumberPropertyField`/`BooleanPropertyField`) pasan de `label={`${label} — Campo`}` a labels literales sueltos:
  "Referencia", "Operador", "itemField", "Valor", "Negar" — sin ninguna concatenación con `label` ni con
  `headingText`. El `role="group"` que envuelve la fila conserva un nombre accesible: en modo grupo usa
  `headingText` (p. ej. `aria-label="Condición 1"`); en modo "Condición simple" (sin `headingText`, `onRemove`
  ausente) conserva el `label` recibido desde el nivel superior del widget como `aria-label` (p. ej.
  `"Visibilidad"`), sin mostrar ninguna cabecera visible en ese modo — esto no contradice FR4, que solo prohíbe
  el prefijo por-campo, no un nombre accesible de agrupación en modo simple.
- El borde individual del `div role="group"` (`rounded border border-gray-200 p-2`) se retira; queda como
  `flex flex-col gap-2` (sin `p-2`, salvo que el equipo de implementación detecte que el espaciado se ve pobre
  sin ningún separador — en ese caso, y solo como fallback documentado por la propia spec, se admite añadir una
  línea divisoria fina (`border-t`) entre condiciones consecutivas de un mismo grupo, nunca una caja cerrada;
  esta decisión queda a criterio de quien implementa esta tarea, sin que sea necesario reabrir `spec.md`).

### Fuera de alcance
- Cualquier lógica de detección de forma (`isGroupShape`), reconciliación por operador
  (`reconcileForOperatorChange`, `sanitizeRowForOperator`) o tipos de valor (`detectValueType`,
  `VALUE_TYPE_DEFAULTS`): no cambian.
- El label que cada punto de montaje externo (dispatcher genérico, `menu-item-fields-editor.tsx`,
  `sidebar-item-fields-editor.tsx`) pasa hoy como `label` a este widget: no se toca en esta tarea (sigue siendo,
  p. ej., `"Elemento de menú 1 — Visibilidad"` hasta que T5 lo simplifique). Esta tarea solo garantiza que ese
  `label`, sea cual sea, deja de propagarse como prefijo de los campos internos.
- `inject-condition-group-widget-sentinel.ts` y el hook `x-widget` del dispatcher: no cambian.

### Dependencias
Ninguna dependencia funcional. Se ejecuta antes de T4 y T5 porque T5 depende de que esta tarea ya elimine la
composición interna del prefijo (ver T5).

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/property-fields/condition-group-property-field.tsx` (único fichero de
  código a modificar).
- Tests:
  - `src/tests/dev-runtime/condition-group-property-field.test.tsx` (ampliación — cobertura propia y aislada
    del widget).
  - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación — actualizar
    aserciones de texto que hoy esperan el prefijo compuesto en el `x-widget: 'condition-group'`).
  - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación — misma actualización de
    aserciones en los casos end-to-end del widget de condición/grupo).
  - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación — misma
    actualización de aserciones en el caso de rechazo de commit del widget de condición/grupo).
  - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación — actualizar aserciones del caso de
    Visibilidad de `menuItem`/`menuItemChild` que hoy comprueban el prefijo compuesto).
  - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación — mismo motivo para `sidebarItem`).
  - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación — mismo motivo en el caso end-to-end de
    `menuItem`).
- Documentación a revisar tras el cierre (no se toca en esta tarea): `ai-workflow/docs/app-features/development/dev-mode-editor.md`,
  sección "Widget de condición/grupo (`visibility`/`when`)".

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/condition-group-property-field.test.tsx` (ampliación)
- `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación)
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)
- `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación)
- `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación)
- `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación)
- `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación)

**Comportamiento cubierto**:
- El selector de forma se renderiza con nombre de grupo accesible "Forma" (no `"${label} — Forma"`) con
  independencia del `label` recibido por el widget.
- En modo "Condición simple", los campos internos usan los nombres accesibles literales "Referencia",
  "Operador", "itemField" (solo con `arrayContains`), "Valor" (o "Valor — Tipo" del selector de tipo, que
  también deja de llevar prefijo) y "Negar" — ninguno contiene el `label` del widget ni ningún guion largo `—`
  seguido del nombre de campo.
- En modo "Grupo (y/o)" con 2 condiciones: el selector de operador de grupo tiene nombre accesible "Operador del
  grupo"; cada condición muestra una cabecera de texto visible con el literal exacto "Condición 1"/"Condición 2"
  antes de sus campos; los campos internos de cada condición usan los mismos nombres bare que en modo simple,
  sin repetir "Condición N" en cada uno.
- Ningún `div` de una condición dentro de un grupo lleva clases de borde (`border`); la separación entre
  condiciones consecutivas del mismo grupo se confirma solo por la presencia de la cabecera "Condición N" y el
  espaciado (o, si se optó por el fallback documentado, por una única línea `border-t` sin clases de caja
  cerrada).
- El `fieldset` raíz del widget no lleva clases de caja (`border`/`rounded`/`bg-*`) en ningún punto de montaje.
- Regresión: montar el mismo widget dentro de un `menuItem`/`sidebarItem` de Shell (vía
  `shell-menu-list-editor.test.tsx`/`shell-sidebar-list-editor.test.tsx`/`shell-config-panel.test.tsx`) produce
  el mismo tratamiento sin prefijo, sin ninguna variante compuesta tipo "Elemento de menú 1 — Visibilidad —
  Referencia".
- Regresión: el flujo de commit real (transición de forma, cambio de operador, rechazo por
  `validateRuntimeConfig` mockeada con `role="alert"`) sigue funcionando exactamente igual que hoy; solo cambia
  el texto/estructura de los labels y la ausencia de bordes, nunca el resultado del commit.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/condition-group-property-field.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx
pnpm test --run src/tests/dev-runtime/shell-menu-list-editor.test.tsx
pnpm test --run src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx
pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx
```

**Restricciones**:
- Los seis ficheros de test "ampliación" fuera del propio `condition-group-property-field.test.tsx` no
  necesitan casos nuevos: solo se actualizan las aserciones de texto/estructura ya existentes que dependían del
  prefijo compuesto o del borde retirado, sin añadir cobertura de comportamiento no relacionado con esta tarea.
- No renombrar `data-testid`s existentes de esos ficheros salvo que el propio cambio de esta tarea lo exija.

### Criterios de finalización
- El widget "Visibilidad" cumple los criterios de aceptación 4, 5 y 6 de `spec.md`, y los casos límite de
  "grupo con una única condición" y "`mode`/`operator` fuera de catálogo" siguen sin regresión.

### Cierre de implementación
Código y tests de esta tarea completos, con los siete comandos anteriores en verde.

---

## T3 — Re-skin del widget Icono (`IconPickerPropertyField`)

### Objetivo
Aplicar FR6 de `spec.md`: `IconPickerPropertyField` se monta dentro de `PropertyFieldRow` (label a la
izquierda, buscador + chip de previsualización + "Quitar icono" a la derecha), con la cuadrícula desplegándose
debajo a todo lo ancho cuando está abierta. Un único cambio en este componente compartido se refleja
automáticamente en sus tres puntos de montaje (dispatcher genérico `x-widget: 'icon'`, `MenuItemFieldsEditor`,
`SidebarItemFieldsEditor`) sin tocar esos otros ficheros.

### Alcance de la reestructuración interna (para evitar reinterpretación)
- Añadir un id estable al input de búsqueda vía `useId()` (mismo patrón que `inputIdPrefix` en
  `layout-span-property-field.tsx`), manteniendo el `aria-label="Buscar icono"` existente sin cambios.
- Sustituir el `<div className="flex items-center gap-2">` que hoy envuelve el input de búsqueda, el chip de
  previsualización y el botón "Quitar icono" por `<PropertyFieldRow htmlFor={searchInputId} label={label}>`,
  moviendo ese mismo contenido (sin cambios internos) dentro de sus `children`.
- La nota "Valor actual: ..." (para un valor no reconocido) y el bloque de la cuadrícula + paginación
  (`open && (...)`) permanecen como hermanos de `PropertyFieldRow` dentro del `div` contenedor raíz del widget
  (`containerRef`), en el mismo orden relativo que hoy, de forma que ocupan el ancho completo del widget y no
  quedan constreñidos a la columna derecha de la fila.
- No se introduce ningún prop nuevo en `IconPickerPropertyFieldProps`; el `label` ya recibido es el que se pasa
  a `PropertyFieldRow`.

### Fuera de alcance
- Paginación, navegación por teclado, apertura/cierre por foco/click-fuera/Escape, catálogo de iconos: ninguno
  cambia de comportamiento.
- `MenuItemFieldsEditor`, `SidebarItemFieldsEditor` y el dispatcher genérico: no se tocan en esta tarea (el
  texto del `label` que le pasan hoy no cambia aquí; su simplificación es FR8, tarea T5).
- El texto compuesto del label recibido en Shell (p. ej. `"Elemento de menú 1 — Icono"`) sigue siendo el mismo
  hasta que T5 lo simplifique; esta tarea solo cambia la disposición visual, no el contenido del `label`.

### Dependencias
Ninguna dependencia funcional con T1/T2. Se ejecuta después de T2 porque comparte ficheros de test de Shell
(`shell-menu-list-editor.test.tsx`, `shell-sidebar-list-editor.test.tsx`, `shell-config-panel.test.tsx`) que T2
ya deja en su estado post-FR4/FR5, evitando conflictos de fusión al tocarlos de nuevo aquí.

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/property-fields/icon-picker-property-field.tsx` (único fichero de
  código a modificar).
- Tests:
  - `src/tests/dev-runtime/icon-picker-property-field.test.tsx` (ampliación — cobertura propia y aislada).
  - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación — regresión de
    montaje vía `x-widget: 'icon'`, si sus aserciones dependen de la estructura DOM anterior).
  - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación — regresión del widget `icon`
    end-to-end, si sus aserciones dependen de la estructura DOM anterior).
  - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación — regresión del
    caso de rechazo de commit del widget `icon`, si aplica).
  - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación — regresión del widget `icon` montado
    en una fila de menú, si aplica).
  - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación — regresión del widget `icon`
    montado en una fila de sidebar, si aplica).
  - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación — regresión end-to-end del widget `icon`
    en Shell, si aplica).
- Documentación a revisar tras el cierre (no se toca en esta tarea): `ai-workflow/docs/app-features/development/dev-mode-editor.md`,
  sección "Widget de búsqueda y selección de iconos Lucide" (incluidas sus subsecciones "Integración en
  `Layout`" e "Integración en `Shell`").

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/icon-picker-property-field.test.tsx` (ampliación)
- `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación)
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)
- `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación)
- `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación)
- `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación)
- `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación)

**Comportamiento cubierto**:
- El texto de `label` recibido por el widget es visible a la izquierda del buscador (nuevo nodo de label
  asociado por `htmlFor`/`id` al input de búsqueda), en la misma fila que el input, el chip de previsualización
  (cuando hay un valor reconocido) y el botón "Quitar icono" (cuando hay valor).
- Al abrir la cuadrícula (foco en el buscador o `ArrowDown`), el `role="grid"` se renderiza debajo de esa fila,
  no dentro de la columna derecha — ocupa el ancho completo del contenedor del widget.
- Regresión completa de paginación, navegación por teclado en dos ejes, apertura/cierre por click-fuera/Escape,
  selección de celda y "Quitar icono": mismo comportamiento que antes de esta tarea, ya cubierto por
  `icon-picker-property-field.test.tsx` — solo se ajustan selectores/aserciones que dependieran de la estructura
  DOM anterior (p. ej. buscar el input directamente bajo el contenedor raíz en vez de dentro de la fila).
- Regresión en los tres puntos de montaje (dispatcher genérico `x-widget: 'icon'` en el canvas,
  `MenuItemFieldsEditor`, `SidebarItemFieldsEditor`): el mismo cambio de disposición se refleja sin tocar esos
  ficheros de origen, confirmado desde sus respectivos ficheros de test.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/icon-picker-property-field.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx
pnpm test --run src/tests/dev-runtime/shell-menu-list-editor.test.tsx
pnpm test --run src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx
pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx
```

**Restricciones**:
- Reutilizar `src/tests/dev-runtime/lucide-react-mock.ts` tal cual (sin tocarlo) en cualquier assertion nueva o
  modificada, igual que ya hace `icon-picker-property-field.test.tsx`.
- Los seis ficheros de test fuera del propio `icon-picker-property-field.test.tsx` solo se tocan si sus
  aserciones existentes realmente dependen de la estructura DOM previa del widget; si ya son agnósticas a esa
  estructura (por ejemplo, si solo consultan por `role="grid"`/`aria-label` sin asumir el wrapper del input), se
  dejan intactos.

### Criterios de finalización
- El widget "Icono" cumple los criterios de aceptación 7 y 8 de `spec.md`, y el caso límite de "valor de icono
  no reconocido" sigue sin regresión, ahora dentro de la fila estándar.

### Cierre de implementación
Código y tests de esta tarea completos, con los siete comandos anteriores en verde.

---

## T4 — Eliminación de cajas raíz en el panel Shell (`ShellMenuListEditor`, `SidebarItemListEditor`, `ShellActionsListEditor`)

### Objetivo
Aplicar FR7 de `spec.md`: eliminar la caja completa del nivel raíz de `ShellMenuListEditor` ("Menú"), del nivel
raíz de `SidebarItemListEditor` ("Elementos del sidebar") y de `ShellActionsListEditor` ("Acciones"), siguiendo
la convención transversal de este documento. Los niveles ya anidados sin caja completa (desplegable de
`menuItem`, "Hijos del elemento de sidebar N") no cambian.

### Fuera de alcance
- Cualquier campo individual dentro de las filas (`MenuItemFieldsEditor`, `SidebarItemFieldsEditor`) y la caja
  individual por acción de `ShellActionsListEditor`: es FR8, tarea T5.
- Lógica de arrastrar-y-soltar (`ShellTreeDndContext`, `moveShellSubtree`, `isValidShellTreeDestination`),
  colapso/expansión de filas (`useShellCollapseState`), o el pipeline de commit (`ShellConfigPanel`): ninguno
  cambia.
- Los niveles anidados con guía de indentación (`ml-2 border-l border-gray-200 pl-4`) de
  `ShellMenuChildrenListEditor` y de `SidebarItemListEditor` en `path !== ''`: ya están en el estilo objetivo,
  no se tocan.

### Dependencias
Se ejecuta después de T2 y T3: los tres ficheros de test de Shell (`shell-menu-list-editor.test.tsx`,
`shell-sidebar-list-editor.test.tsx`, `shell-config-panel.test.tsx`) que esta tarea vuelve a tocar ya deben
reflejar el estado post-FR4/FR5/FR6 dejado por T2/T3, para evitar conflictos de fusión.

### Impacto esperado en archivos
- Código:
  - `src/dev-runtime/shell-config-panel/shell-menu-list-editor.tsx` (retirar las clases de caja del `fieldset`
    raíz de `ShellMenuListEditor`; el `fieldset` de `ShellMenuChildrenListEditor` no se toca).
  - `src/dev-runtime/shell-config-panel/sidebar-item-list-editor.tsx` (retirar las clases de caja del
    `fieldsetClassName` cuando `isRoot` es `true`; la rama `else` — nivel anidado — no se toca).
  - `src/dev-runtime/shell-config-panel/shell-actions-list-editor.tsx` (retirar las clases de caja del
    `fieldset` raíz; la caja individual por acción, línea `key={index}` del `.map`, no se toca en esta tarea).
- Tests:
  - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación).
  - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación).
  - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación — cubre el smoke de `ShellActionsListEditor`
    dentro del panel real).
- Documentación a revisar tras el cierre (no se toca en esta tarea): `ai-workflow/docs/app-features/development/dev-mode-editor.md`,
  sección "Sección Shell" → subsección "Contenido del panel".

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación)
- `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación)
- `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación)

**Comportamiento cubierto**:
- El `fieldset` raíz de `ShellMenuListEditor` ("Menú") no lleva clases de caja (`border`/`rounded`/`bg-*`); su
  `<legend>` "Menú" sigue presente y visible.
- El `fieldset` raíz de `SidebarItemListEditor` cuando `path === ''` ("Elementos del sidebar") no lleva clases de
  caja; su `<legend>` sigue presente y visible.
- Regresión: un nivel anidado de `SidebarItemListEditor` (`path !== ''`, "Hijos del elemento de sidebar N")
  conserva exactamente su indentación con guía vertical (`ml-2 border-l border-gray-200 pl-4`) sin cambios — no
  gana ni pierde ningún estilo por esta tarea.
- El `fieldset` raíz de `ShellActionsListEditor` ("Acciones") no lleva clases de caja; su `<legend>` "Acciones"
  sigue presente y visible; la caja individual de cada acción (`div` por `key={index}`) sigue con sus clases de
  caja actuales sin cambios (se retira en T5).
- Regresión completa: arrastrar/reordenar/anidar en Menú y Sidebar, colapso/expansión de filas, alta/borrado de
  items, y el pipeline de commit real de `ShellConfigPanel` (incluida la separación de `DndContext` por árbol)
  siguen funcionando exactamente igual — ninguna de estas suites cambia de comportamiento, solo de clases CSS en
  los tres `fieldset` raíz mencionados.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/shell-menu-list-editor.test.tsx
pnpm test --run src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx
pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx
```

**Restricciones**:
- No introducir ningún `data-testid` nuevo para verificar la ausencia de caja; basta con aserciones sobre
  `className` (p. ej. `not.toContain('border')`) o sobre el `className` completo esperado del `fieldset`.

### Criterios de finalización
- El panel Shell cumple el criterio de aceptación 9 de `spec.md`.

### Cierre de implementación
Código y tests de esta tarea completos, con los tres comandos anteriores en verde.

---

## T5 — Simplificación de labels y caja por-fila en el panel Shell (`MenuItemFieldsEditor`, `SidebarItemFieldsEditor`, `ShellActionsListEditor`)

### Objetivo
Aplicar FR8 de `spec.md`: `MenuItemFieldsEditor` y `SidebarItemFieldsEditor` sustituyen el prefijo
`"${labelText} — Campo"` de cada uno de sus campos (Etiqueta, Icono, Modo, Href/Acción, Visibilidad) por una
cabecera de texto simple con el `labelText` vigente ("Elemento de menú N" / "Elemento de sidebar N"), quedando
los campos internos sin prefijo repetido. `ShellActionsListEditor` elimina la caja individual por acción y
sustituye `"Acción N — Tipo"` por una cabecera "Acción N" con el campo "Tipo" suelto debajo.

### Alcance de la reestructuración interna (para evitar reinterpretación)
- `MenuItemFieldsEditor`/`SidebarItemFieldsEditor`: al inicio del `<div className="flex flex-col gap-2">` que
  devuelven, añadir un nodo de texto plano con el `labelText` recibido (convención transversal: clase
  `text-xs font-medium text-gray-700`). Cada campo pasa de `label={`${labelText} — Campo`}` a un literal bare:
  "Etiqueta", "Icono" (label pasado a `IconPickerPropertyField`, que T3 ya monta en `PropertyFieldRow`), "Modo",
  "Href", "Acción" (label del `DiscriminatedUnionPropertyField`) y "Visibilidad" (label pasado al
  `PropertyFieldDispatcher`, que T2 ya deja de propagar como prefijo interno).
- `ShellActionsListEditor`: en el `.map` de `actions`, retirar las clases de caja del `div` por acción
  (convención transversal — pasa a `flex flex-col gap-2`, sin `rounded border border-gray-200 p-2`); añadir un
  nodo de texto plano "Acción N" (misma clase que arriba) antes del `EnumPropertyField`; el `EnumPropertyField`
  pasa de `label={`Acción ${index + 1} — Tipo`}` a `label="Tipo"`.

### Fuera de alcance
- Cualquier lógica de `computeMenuItemMode`/`computeSidebarItemMode`, transición de modo
  (`handleModeChange`), o el resto del pipeline de commit de Shell: no cambia.
- Los botones "Subir"/"Bajar"/"Añadir acción" de `ShellActionsListEditor`: no cambian.
- `LayoutCanvasPropertiesPanel` montado dentro de cada acción (`link`/`button`): fuera de alcance, ya normalizado
  por `0133`/`0134`.

### Dependencias
Depende de T2 (la simplificación del label "Visibilidad" solo produce el resultado esperado —sin ningún guion
compuesto residual— porque `ConditionGroupPropertyField` ya dejó de anteponer el `label` recibido a sus campos
internos) y de T4 (mismos ficheros fuente/test de Shell; se ejecuta después para no reabrir el mismo diff).

### Impacto esperado en archivos
- Código:
  - `src/dev-runtime/shell-config-panel/menu-item-fields-editor.tsx`.
  - `src/dev-runtime/shell-config-panel/sidebar-item-fields-editor.tsx`.
  - `src/dev-runtime/shell-config-panel/shell-actions-list-editor.tsx`.
- Tests:
  - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación).
  - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación).
  - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación).
- Documentación a revisar tras el cierre (no se toca en esta tarea): `ai-workflow/docs/app-features/development/dev-mode-editor.md`,
  sección "Sección Shell" → subsección "Contenido del panel".

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación)
- `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación)
- `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Un item de menú expandido (fila raíz o `menuItemChild` dentro de un desplegable) muestra una cabecera de texto
  con el literal exacto "Elemento de menú N" (raíz) sobre sus campos, y cada campo interno usa su nombre
  accesible bare: "Etiqueta", "Icono", "Modo", y "Href" o "Acción" según el modo activo, y "Visibilidad" — ninguno
  contiene el literal "Elemento de menú N" repetido ni ningún guion largo `—`.
- Un item de sidebar expandido a cualquier profundidad muestra la cabecera "Elemento de sidebar N" (con el
  mismo esquema de numeración por profundidad ya existente, p. ej. "Elemento de sidebar 1.2") y los mismos
  campos internos bare sin prefijo repetido.
- Una acción (`link`/`button`) de `shell.header.actions` muestra una cabecera "Acción N" sin caja individual
  alrededor de la acción; el campo antes etiquetado `"Acción N — Tipo"` ahora tiene nombre accesible bare "Tipo".
- Regresión: el flujo de commit real de cada fila (edición de Etiqueta/Icono/Modo/Href/Acción/Visibilidad,
  transición de modo, rechazo de commit con `role="alert"` conservando el valor intentado) sigue funcionando
  exactamente igual — solo cambia el texto de los nombres accesibles y la presencia/ausencia de caja.
- Regresión: el campo `visibility` de un `menuItem`/`sidebarItem` sigue montando `ConditionGroupPropertyField`
  correctamente (forma, operador, condiciones) con el nuevo label bare "Visibilidad", sin ninguna variante
  compuesta "Elemento de menú 1 — Visibilidad — ..." en ningún nivel (cierra el criterio de aceptación 6 en
  conjunto con T2).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/shell-menu-list-editor.test.tsx
pnpm test --run src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx
pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx
```

**Restricciones**:
- No renombrar `labelText`/`lowercaseRowLabel` ni los `aria-label` de los botones de "Quitar"/colapso que ya usan
  `labelText` (p. ej. `Quitar elemento de menú N`, `Expandir/Colapsar Elemento de menú N`): esos ya son bare y
  quedan fuera de esta tarea.

### Criterios de finalización
- El panel Shell cumple los criterios de aceptación 6 (en conjunto con T2), 10 y 11 de `spec.md`.

### Cierre de implementación
Código y tests de esta tarea completos, con los tres comandos anteriores en verde.

---

## T6 — Panel Traducciones: eliminación de cajas y filas label-izquierda/control-derecha

### Objetivo
Aplicar FR9 y FR10 de `spec.md` a `translations-config-panel.tsx`: eliminar la caja de los bloques "Añadir
entrada", "Añadir idioma", "Buscar y añadir" (búsqueda + resultados) y "Refrescar todo" (lista + acción), cada
uno con su cabecera de texto simple; y convertir los campos de esos formularios (Clave, una fila por idioma en
"Añadir entrada"; Código de idioma en "Añadir idioma"; Buscar texto) al patrón de fila label-izquierda/
control-derecha (`PropertyFieldRow`). La tabla principal de edición no se toca.

### Alcance de la reestructuración interna (para evitar reinterpretación)
El fichero actual agrupa hoy "Buscar y añadir" y "Refrescar todo" dentro de un único `<div>` con caja compartido
(la búsqueda y el botón de refresco no son hoy dos bloques visualmente separados), y la lista de resultados de
la búsqueda es un tercer `<div>` con caja independiente, situado después. Esta tarea reestructura esos tres
`<div>` en exactamente dos bloques sin caja, cada uno con su propia cabecera de texto simple:
- **"Buscar y añadir"**: agrupa el formulario de búsqueda (input "Buscar texto" + botón "Buscar" + estado de
  carga/error) y, cuando `searchResults !== null`, la lista de resultados y el botón "Añadir seleccionados" —
  todo bajo una única cabecera "Buscar y añadir", sin caja.
- **"Refrescar todo"**: agrupa el botón "Refrescar todo", su estado de carga, el mensaje de no-disponibilidad,
  el aviso de "sin claves refrescables", el error de red y el `CommitRejectionBanner` de refresco — bajo una
  cabecera "Refrescar todo", sin caja.

Para cada campo de formulario convertido a fila (Clave, cada idioma en "Añadir entrada"; Código de idioma en
"Añadir idioma"; Buscar texto), se sustituye el `<div className="flex flex-col gap-1"><label>...</label>
<input/></div>` actual por `<PropertyFieldRow htmlFor={idExistente} label={textoDelLabelActual}>` envolviendo el
`<input>` correspondiente (los `id` ya existentes — `translations-add-key`, `translations-add-lang-{lang}`,
`translations-add-language-code`, `translations-search-text` — se conservan tal cual como `htmlFor`/`id`). En
"Buscar texto", el botón "Buscar" permanece junto al input dentro del mismo `children` de `PropertyFieldRow`
(a la derecha), igual que hoy están agrupados en un `<div className="flex gap-2">`.

"Añadir entrada" y "Añadir idioma" conservan su `<fieldset>`/`<legend>` existente tal cual — no se toca ningún
elemento ni clase de esos dos, salvo lo indicado en "Precisión obligatoria" a continuación. "Buscar y añadir" y
"Refrescar todo" no tienen hoy `<fieldset>`/`<legend>` propio (son `<div>`s planos); siguiendo la convención
transversal de este documento, **no se introduce ningún `<fieldset>` nuevo** para ninguno de los dos — se añade
un nodo de texto plano (`text-xs font-medium text-gray-700`) como cabecera dentro de cada `<div>` existente, al
que además se le retiran las clases de caja.

**Precisión obligatoria sobre dónde vive la caja de cada bloque** (verificado contra el fichero actual, para
evitar que se busque la caja en el elemento equivocado):
- En "Añadir entrada" y "Añadir idioma", el `<fieldset>` interno ya tiene hoy `className="flex flex-col gap-2"`
  (sin ninguna clase de caja) — la caja visible de esos dos bloques está en las clases
  `rounded border border-gray-200 p-2` del `<form>` que envuelve a ese `<fieldset>`. La convención transversal
  se aplica aquí retirando esas clases del `<form>` (dejándolo en `className="flex flex-col gap-2"` o
  equivalente), no del `<fieldset>`, que no necesita ningún cambio de clase.
- En "Buscar y añadir" y "Refrescar todo", la caja vive directamente en el `<div>` contenedor de cada bloque (no
  hay `<fieldset>` de por medio hoy); ahí sí se retiran las clases de caja del propio `<div>` tal como describe
  el párrafo anterior.

### Fuera de alcance
- La tabla principal de edición de claves/idiomas (`<table>`, líneas 387–449 del fichero actual): no se toca en
  ningún aspecto visual ni de comportamiento (criterio de aceptación 13).
- Cualquier lógica de commit (`onCommitTranslationsMutation`), validación local (`localValidationError`),
  resolución de `searchResolution`/`refreshResolution`, o las funciones puras del fichero
  (`collectLanguages`, `computeColumns`, `cellDraftKey`, etc.): no cambian.
- `translations-provider.ts` y `translations-panel-helpers.ts`: no se tocan.

### Dependencias
Ninguna dependencia funcional con T1–T5; puede ejecutarse en paralelo conceptualmente, pero se deja en último
lugar del plan por no compartir ningún fichero con el resto de tareas.

### Impacto esperado en archivos
- Código: `src/dev-runtime/translations-panel/translations-config-panel.tsx` (único fichero de código a
  modificar).
- Tests: `src/tests/dev-runtime/translations-config-panel.test.tsx` (ampliación).
- Documentación a revisar tras el cierre (no se toca en esta tarea): `ai-workflow/docs/app-features/development/dev-mode-editor.md`,
  sección "Sección Traducciones" → subsecciones "Alta, borrado y columnas de idioma", "Acción 'Buscar y añadir'"
  y "Acción 'Refrescar todo'".

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/translations-config-panel.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Ninguno de los cuatro bloques ("Añadir entrada", "Añadir idioma", "Buscar y añadir", "Refrescar todo") lleva
  clases de caja (`border`/`rounded`/`bg-*`) en su contenedor; cada uno muestra su título como cabecera de texto
  simple.
- El campo "Clave" y cada fila de idioma de "Añadir entrada", el campo "Código de idioma" de "Añadir idioma" y
  el campo "Buscar texto" se renderizan con su `label` a la izquierda y su `input` (más, en el caso de "Buscar
  texto", el botón "Buscar") a la derecha, en la misma fila.
- Con una lista de idiomas vacía en "Añadir entrada" (solo la fila "Clave", sin ninguna columna de idioma
  todavía), el bloque sigue sin caja y sin ningún fallback distinto — regresión del caso límite ya documentado
  en `spec.md`.
- "Buscar y añadir" muestra la lista de resultados de búsqueda (cuando `searchResults !== null`, incluido el
  caso "Sin resultados") y el botón "Añadir seleccionados" bajo la misma cabecera que el formulario de búsqueda,
  sin caja separada entre el formulario y los resultados.
- "Refrescar todo" muestra el botón, su estado de carga, el mensaje de no-disponibilidad, el aviso "Sin claves
  refrescables", el error de red y el `CommitRejectionBanner` de refresco bajo su propia cabecera, sin
  compartir contenedor visual con "Buscar y añadir".
- Regresión completa: alta de entrada (rechazo de clave vacía/duplicada), edición de celda en `blur`, borrado de
  entrada, alta de idioma (rechazo de código vacío/duplicado/ya-pendiente), "Buscar y añadir" contra el
  `provider` mockeado (carga, sin resultados, ya-existe, error), "Refrescar todo" contra el `provider` mockeado
  (sin claves numéricas, llamada con claves correctas, idioma no mapeado ignorado, error de red) — todo el
  comportamiento ya cubierto por la suite actual sigue produciendo el mismo resultado funcional, solo cambia la
  disposición visual de los campos y la ausencia de caja.
- La tabla principal de edición de claves/idiomas no cambia de aspecto ni de comportamiento (criterio de
  aceptación 13, regresión explícita).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/translations-config-panel.test.tsx
```

**Restricciones**:
- Reutilizar `PropertyFieldRow` de `src/dev-runtime/layout-canvas/property-fields/property-field-row.tsx`
  (import cross-módulo con precedente ya existente en el resto de `src/dev-runtime/shell-config-panel/`, cuyos
  editores importan varios campos de `layout-canvas/property-fields/` como `TextPropertyField`/
  `IconPickerPropertyField`/`EnumPropertyField`; `translations-config-panel.tsx` no importa hoy nada de ahí,
  pero el patrón de reutilizar esos componentes compartidos desde fuera de `layout-canvas/` ya es una
  convención establecida en el proyecto); no crear una copia local del componente.
- No modificar los `id` de los inputs existentes usados hoy por `aria-label`/`htmlFor`/tests
  (`translations-add-key`, `translations-add-lang-{lang}`, `translations-add-language-code`,
  `translations-search-text`).

### Criterios de finalización
- El panel Traducciones cumple los criterios de aceptación 12 y 13 de `spec.md`, y el caso límite de "lista de
  idiomas vacía en Añadir entrada" sigue sin regresión.

### Cierre de implementación
Código y tests de esta tarea completos, con `pnpm test --run src/tests/dev-runtime/translations-config-panel.test.tsx`
en verde.

---

## Cierre transversal del plan

Tras cerrar T1–T6, el criterio de aceptación 14 de `spec.md` (un commit rechazado en cualquiera de los controles
restilados conserva el valor elegido y muestra el mismo aviso `role="alert"`) queda cubierto de forma
distribuida por las suites de cada tarea (T1–T3 en el canvas, T4–T5 en Shell, T6 en Traducciones) — no requiere
una tarea propia. El umbral global de cobertura del 80% (`pnpm test`) es gate de cierre de la pasada completa de
implementación, no de cada tarea individual.

Siguiente paso tras cerrar este documento: revisión automática vía `review-implementation-plan` (sub-agente,
disparada por esta misma skill) y, si el veredicto es "aprobado", implementación tarea a tarea con
`implement-task-test-first`, siguiendo el orden T1 → T2 → T3 → T4 → T5 → T6.
