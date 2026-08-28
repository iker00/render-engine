# 0134 — Plan de implementación

## Orden de ejecución
T1 → T2 → T3 → T4 → T5 → T6 (secuencial). Dependencias técnicas reales: T2 depende de T1; T5 depende de T4. T3, T4 y T6 no dependen técnicamente de ninguna tarea previa, pero se ejecutan en este orden para mantener el plan lineal de una sola pasada de implementación; T6 se deja al final porque toca `property-field-dispatcher.tsx` (mismo fichero que T1) desde funciones distintas (`ObjectPropertyField`/`ArrayPropertyField`, no la rama `enum` que toca T1), minimizando el riesgo de conflicto de edición dentro del mismo fichero.

Próxima tarea recomendada al cerrar esta planificación: **T1**.

**Nota de esta revisión**: T1 y T2 se han corregido tras verificar contra una captura real del mock de Figma (ver `spec.md`, sección "Referencia visual") que el control segmented genérico y los swatches de color sí se presentan en la misma fila label-izquierda/control-derecha que el resto de campos genéricos — la versión anterior de este plan decía lo contrario y llegó a implementarse; esa implementación se ha revertido (guardada en un `git stash`, no perdida) precisamente por este desajuste. T6 es una tarea nueva de esta revisión (FR8).

---

## T1 — Segmented control genérico para enums acotados (FR1, FR2)

### Objetivo
En `PropertyFieldDispatcher`, el campo genérico de un JSON Schema con `enum` de entre 2 y 5 valores (ambos inclusive) se renderiza con `SegmentedTogglePropertyField` en vez de `EnumPropertyField`. Un enum de 1 valor o de 6+ valores sigue renderizando `EnumPropertyField` (`<select>`) exactamente igual que hoy.

### Fuera de alcance
- La convención de nombre `color` (FR3/FR4): se implementa en T2, que depende de esta tarea.
- Cualquier campo que ya resuelva a un widget de `WIDGET_REGISTRY` (`choice-items`, `layout-span`, `heading-level`, `tabs-orientation`, `icon`, `condition-group`): ya quedan excluidos de la rama `enum` sin cambio de código, porque el hook `x-widget` del dispatcher se evalúa antes que la rama `enum` (prioridad ya vigente en `PropertyFieldDispatcher`, líneas 89-140 actuales). No añadir ninguna comprobación redundante para esto.
- Traducción de las etiquetas de segmento: siguen siendo el valor literal del enum (`String(option)`), igual que hoy en `<select>`.
- Los tres usos ya existentes de `SegmentedTogglePropertyField` (`container` "Modo", `heading` "Nivel", `tabs` "Orientación"): no cambian de implementación ni de presentación.

### Dependencias
Ninguna. Primera tarea del plan.

### Impacto esperado en archivos
- Código:
  - `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`: importar `SegmentedTogglePropertyField`, `SegmentedToggleOption` y `PropertyFieldRow`; modificar la rama `enum` (líneas ~128-140 actuales) para que, cuando `enumOptions.length` esté entre 2 y 5, construya `segments` (`{ value: option, label: String(option) }` por cada opción, sin icono) y renderice el control envuelto en la misma fila label-izquierda/control-derecha que ya usa `EnumPropertyField` (ver decisión de diseño abajo), en vez de `EnumPropertyField`. Fuera de ese rango (1 o 6+), el comportamiento no cambia: sigue renderizando `EnumPropertyField` con los mismos props que hoy (incluido `required`).
  - **Decisión de diseño obligatoria** (spec.md, sección "Referencia visual" y FR1): a diferencia de los tres usos ya existentes de `SegmentedTogglePropertyField` (que no van en fila y no muestran label visible por ser bloques especiales), el campo segmented genérico de esta tarea SÍ se envuelve en `PropertyFieldRow` — mismo patrón que `EnumPropertyField` ya usa hoy (`<PropertyFieldRow htmlFor={id} label={label} required={required}>...</PropertyFieldRow>`). Como `SegmentedTogglePropertyField` no expone ningún elemento con un único `id` focuseable al que asociar `htmlFor` (su accesibilidad ya la resuelve el `aria-label` del propio `radiogroup`, igual que hoy), generar un `id` con `useId()` para satisfacer el prop `htmlFor` de `PropertyFieldRow` (obligatorio en su firma) aunque no corresponda a ningún elemento real del DOM — el `<label>` de la fila queda como texto visible informativo, sin asociación funcional de foco; esto es una limitación aceptada, no un bug a resolver en esta tarea. No pasar `required` a `SegmentedTogglePropertyField` (no lo soporta); el asterisco de obligatoriedad, si aplica, lo sigue mostrando `PropertyFieldRow` igual que para el resto de campos.
- Tests:
  - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación)
  - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)
  - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación)
  - Cualquier otro fichero de `src/tests/dev-runtime/*.test.tsx` que verifique como `<select>` (`getByRole('combobox')` + selección de opción) uno de los campos afectados por esta regla con cardinalidad 2-5 (ver lista no exhaustiva en "Comportamiento cubierto" más abajo): ampliación, cambiando únicamente la forma de interacción (de `<select>`/`selectOptions` a `radiogroup`/`radio` con click), sin alterar el resto de la aserción (commit, preservación de otras props, etc.).
- Documentación a revisar (no se actualiza en esta fase, solo referencia): `ai-workflow/docs/app-features/development/dev-mode-editor.md` (secciones "Panel de propiedades (modo Editor)" y "Widget de alternancia por segmentos (pill toggle)").

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación)
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)
- `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Un schema `{ type: 'string', enum: [...] }` con 2, 3 y 5 opciones renderiza `role="radiogroup"` con un `role="radio"` por opción, en vez de `<select>`, envuelto en la misma fila label-izquierda/control-derecha que `EnumPropertyField` (el texto del `label` visible a la izquierda de la fila); el segmento cuyo `value` coincide con el valor actual tiene `aria-checked="true"`; pulsar un segmento distinto invoca `onChange` con ese valor.
- Un schema `enum` con exactamente 1 opción y otro con 6+ opciones siguen renderizando `<select>` (`role="combobox"`) con el mismo comportamiento de hoy, incluida la misma fila label-izquierda/control-derecha (caso límite explícito de la spec; sin cambio para este rango).
- El test existente que verifica `<select>` con un enum de 3 valores (`['a', 'b', 'c']`, en torno a la línea 84-103 actual) se ajusta a un enum de 6+ valores para seguir demostrando el fallback a `<select>` fuera del rango 2-5; se añade un test nuevo (o se reconvierte ese mismo caso) que confirme que un enum de 3 valores renderiza `SegmentedTogglePropertyField` dentro de la fila label-izquierda/control-derecha.
- El test existente que verifica la fila label-izquierda/control-derecha con un enum de 2 valores (`['a', 'b']`, en torno a la línea 734-750 actual) sigue siendo válido conceptualmente (la fila se mantiene), pero el control renderizado dentro de esa fila pasa de `<select>` a `radiogroup`; ajustar la aserción del control concreto sin eliminar la aserción de estructura de fila (label a la izquierda, control a la derecha, mismo ancho relativo `w-1/3`/`flex-1` ya usado por `PropertyFieldRow`).
- Un campo ya resuelto por el hook `x-widget` (por ejemplo el test existente de `x-widget: 'tabs-orientation'` con enum de 2 valores) sigue delegando en su widget dedicado sin pasar por la nueva rama segmented, y ese widget dedicado sigue sin fila (comportamiento de los tres usos fijos, sin cambio) — regresión explícita, sin cambio de código pero con test que lo confirme si no existe ya.
- Extremo a extremo: `stat.props.variant` (`accent`/`tinted`/`plain`, 3 opciones) se muestra como segmented en la pestaña `Props`, dentro de una fila label-izquierda ("variant") / control-derecha (criterio de aceptación 1), commitea a través del pipeline real preservando el resto de `props`, y un commit rechazado (`validateRuntimeConfig` mockeada) conserva el segmento elegido y muestra el aviso `role="alert"` sin regresión (criterio 9, parte "segmented").
- Extremo a extremo: `container.props.justify` (6 opciones) permanece como `<select>` con el estilo base ya vigente, sin verse afectado por esta regla (criterio de aceptación 2).
- Barrido de regresión: cada campo enum de 2-5 opciones ya cubierto por un test existente con `<select>` (lista de la spec: `container.props.align`, `container.props.wrap`, `container.props.variant`, `modal.props.size`, `button.props.variant`, `badge.props.variant`, `stat.props.variant`, `divider.props.variant`, `skeleton.props.variant`, `toggle.props.labelPosition`, y cualquier otro campo enum de 2-5 valores detectado al correr la suite completa tras el cambio) pasa a verificarse como `radiogroup`/`radio`.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx
pnpm test --run src/tests/dev-runtime
```

**Restricciones**:
- No añadir un `optionLabels` ni ninguna traducción de las etiquetas de segmento: siempre `String(option)`.
- Envolver siempre el campo segmented genérico en `PropertyFieldRow` (ver decisión de diseño arriba); no reproducir el patrón sin fila de los tres usos fijos preexistentes para este caso genérico.
- El último comando (`pnpm test --run src/tests/dev-runtime`) es el que revela exhaustivamente qué otros ficheros de test rompen por el cambio de cardinalidad 2-5; usarlo para localizar y corregir toda regresión no listada explícitamente arriba, sin dejar ningún test en rojo.

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md` (sección "Panel de propiedades (modo Editor)": un enum de 2-5 opciones pasa a usar `SegmentedTogglePropertyField` en vez de `<select>` dentro de la misma fila label-izquierda/control-derecha ya documentada para los campos simples).

### Criterios de finalización
- Un enum de 2 a 5 opciones en cualquier tipo de nodo y cualquier subsección (`Props`, `Diseño`) se muestra como `SegmentedTogglePropertyField`; un enum de 1 o de 6+ opciones sigue como `<select>`.
- Ningún campo ya resuelto por `WIDGET_REGISTRY` se ve afectado.
- La suite completa de `src/tests/dev-runtime` pasa sin ningún `<select>` residual para un campo enum de 2-5 opciones no cubierto por un widget dedicado.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T2 — Swatches de color por convención de nombre (FR3, FR4)

### Objetivo
Cualquier propiedad `props.color` (nombre de campo literalmente `color`) cuyo schema declare un `enum` se muestra como una fila de muestras de color (`ColorSwatchPropertyField`) en vez de `<select>` o segmented, con independencia de su número de opciones. Cada muestra corresponde a uno de los seis nombres semánticos fijos del catálogo del editor (`neutral`/`primary`/`success`/`warning`/`danger`/`info`); un valor actual fuera de ese catálogo no marca ninguna muestra como activa y no bloquea el resto del panel.

### Fuera de alcance
- Cualquier campo enum llamado distinto de `color` (por ejemplo `alert.props.type`, mismo catálogo de 6 nombres pero campo `type`): sigue las reglas de T1/`<select>`, sin cambio en esta tarea.
- Sincronización en código con la paleta de estilos del runtime de producción (`runtime-node-styling-*.ts`): la paleta de swatches del editor es una lista fija propia, deliberadamente no acoplada a esos módulos ni importada desde ellos.
- Cualquier campo `color` fuera de `props` (no existe hoy en el contrato, no se contempla).

### Dependencias
T1 (debe estar cerrada; el hook `x-widget` que resuelve `color-swatch` tiene prioridad sobre la rama `enum` de T1 por construcción del dispatcher, y esta tarea verifica esa exclusión).

### Impacto esperado en archivos
- Código:
  - Nuevo: `src/dev-runtime/layout-canvas/property-fields/color-swatch-palette.ts` — módulo puro (sin React) que exporta `COLOR_SWATCH_NAMES` (tupla `readonly` con los seis nombres, en este orden: `'neutral'`, `'primary'`, `'success'`, `'warning'`, `'danger'`, `'info'`, declarados de forma independiente en este módulo, no importados desde `runtime-config-zod.ts` ni desde ningún módulo de `src/runtime/`) y `COLOR_SWATCH_CLASS_BY_NAME` (`Record` de cada nombre a una clase Tailwind de color sólido para el swatch, p. ej. `bg-*-500`).
  - Nuevo: `src/dev-runtime/layout-canvas/property-fields/color-swatch-property-field.tsx` — componente `ColorSwatchPropertyField({ label, value, onChange, hideRootLegend })` (misma firma que el resto de `WIDGET_REGISTRY`): renderiza siempre las seis muestras de `COLOR_SWATCH_NAMES` en ese orden fijo (no derivadas del schema/`enum` del campo), envuelto en `PropertyFieldRow` (mismo patrón y misma decisión de diseño que T1: `label` a la izquierda vía `PropertyFieldRow`, `id` de `useId()` para su `htmlFor` sin target focuseable real). Dentro de la celda de control de la fila: un `role="radiogroup"` (`aria-label={label}`) con un `role="radio"` por muestra (`aria-checked`, nombre accesible = nombre semántico vía `aria-label` propio de cada muestra, no solo el color visual), y a la derecha de las seis muestras un `<span>` de texto con el nombre semántico de la muestra actualmente activa (p. ej. `primary`) — FR4. La muestra activa es la que coincide con `value`; si `value` no está en `COLOR_SWATCH_NAMES`, ninguna muestra queda activa (`activeValue` efectivo `null`), el `<span>` del nombre no se renderiza (ausente del DOM, no vacío) y el resto del control sigue operativo. Roving tabindex + `ArrowRight`/`ArrowLeft` con ajuste circular, mismo patrón que `SegmentedTogglePropertyField` (puede reutilizar su lógica de teclado/roving tabindex como referencia, pero no delega el render en él porque necesita pintar un color sólido por muestra en vez de icono+texto). `onSelect` no dispara `onChange` si se reselecciona la muestra ya activa (idempotencia).
  - `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`: registrar `'color-swatch': ColorSwatchPropertyField` en `WIDGET_REGISTRY`.
  - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`: nueva función `resolveColorSwatchPropsSchema(propsSchema)`, mismo patrón que `resolveIconPropsSchema` (líneas ~205-216 actuales) pero comprobando además que `properties.color` declare un `enum` (`Array.isArray(properties.color.enum)`) antes de sustituirlo por `{ 'x-widget': 'color-swatch' }`; si `color` no existe o no es un `enum`, la función es un no-op. Encadenarla en `renderTabContent`, dentro del bloque `if (key === 'props' && effectiveSchema)`, junto a la llamada ya existente a `resolveIconPropsSchema` (línea ~542-544 actual).
- Tests:
  - Nuevo: `src/tests/dev-runtime/color-swatch-palette.test.ts`
  - Nuevo: `src/tests/dev-runtime/layout-canvas-property-field-color-swatch.test.tsx`
  - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación)
  - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)
  - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación)

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/color-swatch-palette.test.ts` (nuevo)
- `src/tests/dev-runtime/layout-canvas-property-field-color-swatch.test.tsx` (nuevo)
- `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación)
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)
- `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación)

**Comportamiento cubierto**:
- `color-swatch-palette.ts`: `COLOR_SWATCH_NAMES` tiene exactamente los seis nombres en el orden fijo especificado; `COLOR_SWATCH_CLASS_BY_NAME` tiene una entrada por cada nombre de `COLOR_SWATCH_NAMES`, ninguna vacía.
- `ColorSwatchPropertyField` aislado (sin dispatcher): se renderiza dentro de una fila label-izquierda/control-derecha (mismo marcado que `PropertyFieldRow` produce para el resto de campos genéricos, con el texto de `label` visible a la izquierda); renderiza siempre las seis muestras con independencia de `value`; `aria-checked` solo en la muestra cuyo valor coincide con `value`; `aria-label` de cada muestra es su nombre semántico; junto a las muestras se muestra un texto con el nombre semántico de la muestra activa (p. ej. "primary"), ausente del DOM cuando ninguna muestra está activa; `value` fuera del catálogo (p. ej. `"morado"` o `undefined`) no marca ninguna muestra como activa ni muestra el texto de nombre, sin lanzar error; click en una muestra distinta invoca `onChange` con su nombre; reseleccionar la muestra ya activa no invoca `onChange`; `ArrowRight`/`ArrowLeft` mueven el foco y seleccionan la muestra adyacente con ajuste circular en ambos extremos; roving tabindex (solo la activa, o la primera si ninguna lo está, es parada de `Tab`).
- Dispatcher: un schema con `{ 'x-widget': 'color-swatch' }` delega en `ColorSwatchPropertyField` en vez de en cualquier rama genérica (enum/string/object).
- `resolveColorSwatchPropsSchema`: sustituye `properties.color` por el sentinel solo cuando ese campo declara `enum`; no-op si `color` no existe en `properties` o si existe pero no es `enum`.
- Extremo a extremo (criterio de aceptación 3): `stat.props.color` y `badge.props.color` (mismo catálogo de 6 nombres) se muestran como fila de swatches, no como segmented ni `<select>`, pese a tener 6 opciones — confirma la exclusión de FR2 frente a T1 en el caso límite en que la cardinalidad por sí sola habría dado `<select>` (6 opciones, fuera del rango 2-5 de T1), y frente al caso en que coincidiera con el rango 2-5 si se usa un schema sintético de prueba con 3 valores para demostrar que la convención de nombre gana también en ese caso.
- Extremo a extremo (criterio de aceptación 4): `alert.props.type` (mismo catálogo de 6 nombres, campo `type`) permanece como `<select>` restilado — no cumple ni la convención de nombre (FR3) ni la cardinalidad de FR1 (6 opciones).
- Extremo a extremo (criterio de aceptación 8): elegir una muestra distinta en `stat.props.color` commitea el cambio a través del pipeline real, se refleja en el contenido renderizado y en el buffer de Monaco, actualiza la muestra activa y actualiza el texto del nombre semántico junto a las muestras al nuevo valor.
- Extremo a extremo (criterio 9, parte "swatch"): un commit rechazado (`validateRuntimeConfig` mockeada) en el widget de swatches conserva la muestra elegida y muestra el aviso `role="alert"`, con limpieza al reintentar con éxito o al cambiar de nodo — mismo criterio que el resto del panel.
- Caso límite: un valor de `color` presente en el config pero fuera del catálogo (por ejemplo editado a mano en Monaco) no bloquea el panel: la fila de swatches se muestra sin ninguna marcada activa y el resto de campos de esa pestaña siguen editables.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/color-swatch-palette.test.ts
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-color-swatch.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx
```

**Restricciones**:
- No importar ningún nombre de color desde `runtime-config-zod.ts` ni desde `src/runtime/runtime-node-styling-*.ts` en `color-swatch-palette.ts`: la lista de seis nombres se declara de forma independiente en ese módulo (ver spec, riesgo 2).
- No derivar las muestras mostradas del `enum` real del schema del campo: siempre las seis fijas de `COLOR_SWATCH_NAMES`, en ese orden.

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md` (nueva subsección para el widget de swatches, análoga a "Widget de búsqueda y selección de iconos Lucide"; referencia cruzada desde "Widget de alternancia por segmentos" para dejar clara la exclusión frente a FR1).

### Criterios de finalización
- `stat.props.color`/`badge.props.color` se muestran como swatches en cualquier caso (6 opciones hoy), nunca como segmented ni `<select>`.
- `alert.props.type` (mismo catálogo de valores, campo `type`) permanece como `<select>`.
- Un valor de color fuera de catálogo degrada sin romper el panel.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T3 — Interruptor tipo píldora para booleanos (FR5)

### Objetivo
Todo campo booleano resuelto por el dispatcher genérico (`BooleanPropertyField`) se muestra como un interruptor on/off (`role="switch"`, `aria-checked`) en vez del checkbox actual, conservando el mismo pipeline de commit y la misma fila label-control (`PropertyFieldRow`).

### Fuera de alcance
- Cualquier cambio en `PropertyFieldDispatcher` (la rama `boolean` ya delega en `BooleanPropertyField` sin cambios; esta tarea solo toca el componente).
- Cualquier campo booleano cubierto por un widget dedicado (no existe hoy ningún caso así en el catálogo).

### Dependencias
Ninguna (independiente de T1/T2; se ejecuta en este punto del plan por orden lineal).

### Impacto esperado en archivos
- Código:
  - `src/dev-runtime/layout-canvas/property-fields/boolean-property-field.tsx`: sustituir el `<input type="checkbox">` por un `<button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)}>` con estilo de píldora (Tailwind: track + thumb deslizante según `value`), manteniendo el `id`/`useId()` actual para que `PropertyFieldRow`'s `htmlFor` lo siga asociando correctamente, y manteniendo el mismo wrapper `PropertyFieldRow` sin cambios.
- Tests:
  - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación)
  - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación)

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación)
- `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Los tres casos existentes que verifican `type="checkbox"` para un schema `boolean` (en torno a las líneas 71-83, 544-548 y 752-763 actuales de `layout-canvas-property-field-dispatcher.test.tsx`) se actualizan para verificar en su lugar `role="switch"` y `aria-checked` reflejando `value`; el resto de cada aserción (invocación de `onChange` con el valor invertido al hacer click, asociación `label`/`id` vía `htmlFor`, posición en la fila label-izquierda/control-derecha) se mantiene sin cambio de comportamiento.
- Click sobre el interruptor invoca `onChange` con el booleano invertido, igual que el checkbox anterior.
- El campo sigue siendo accesible por su `label` (`getByLabelText`) igual que antes.
- Extremo a extremo (criterio de aceptación 5): un campo booleano genérico de cualquier nodo se muestra como interruptor on/off y sigue commiteando igual que antes, a través del pipeline real.
- Extremo a extremo (criterio 9, parte "interruptor"): un commit rechazado (`validateRuntimeConfig` mockeada) en un campo booleano conserva el valor elegido por el usuario y muestra el aviso `role="alert"`, con la misma limpieza que el resto del panel — si no existe ya cobertura de rechazo para un campo booleano en `layout-canvas-properties-panel-commit-feedback.test.tsx`, añadir un caso nuevo con un nodo/campo booleano real del catálogo.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx
```

**Restricciones**:
- No cambiar la firma de `BooleanPropertyField` (`{ label, value, onChange }`) ni su envoltorio `PropertyFieldRow`.
- No añadir lógica de teclado adicional: `<button>` ya maneja `Enter`/`Space` nativamente.

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md` (sección "Panel de propiedades (modo Editor)": no describe hoy el control booleano de forma explícita; si al revisar la ficha durante `update-app-documentation` se detecta una mención al checkbox, actualizarla ahí — no se toca en esta fase).

### Criterios de finalización
- Todo campo booleano genérico se muestra como `role="switch"` con `aria-checked` correcto y sigue commiteando igual que antes.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T4 — Re-skin de las filas del widget `layout.span` (FR6)

### Objetivo
Las seis filas fijas (`base`/`sm`/`md`/`lg`/`xl`/`2xl`) de `LayoutSpanPropertyField` adoptan un contenedor tipo tarjeta (en vez del `fieldset` sin estilo de tarjeta actual) y tipografía/espaciados coherentes con el resto del panel ya restilado, conservando el mismo indicador `/ N` y el mismo botón "Quitar" (con estilo actualizado). El comportamiento (valor heredado en gris, clave explícita, conversión entero→mapa, validación por fila) no cambia.

### Fuera de alcance
- La barra de vista previa de ocupación (FR7): se implementa en T5, que depende de esta tarea.
- Cualquier cambio de comportamiento, de `data-testid`, de `aria-label` o de la estructura de datos del widget: solo cambian clases Tailwind y, si hace falta, el elemento contenedor (manteniendo semántica equivalente).

### Dependencias
Ninguna (independiente de T1/T2/T3; se ejecuta en este punto del plan por orden lineal).

### Impacto esperado en archivos
- Código:
  - `src/dev-runtime/layout-canvas/property-fields/layout-span-property-field.tsx`: restyle visual únicamente. Mantener sin cambios: `data-testid="layout-span-widget"`, `data-testid="layout-span-widget-row-{breakpoint}"`, `data-explicit`, el patrón de `id` (`${inputIdPrefix}-${breakpoint}`), el `aria-label` `"Quitar {breakpoint}"` del botón, y `data-testid="layout-span-widget-${breakpoint}-error"` de `CommitRejectionBanner`. Adoptar un contenedor tipo tarjeta (`rounded-lg border border-gray-200 bg-white p-3` o equivalente ya usado en el resto del panel restilado) en vez del `fieldset` sin tarjeta actual, y ajustar tipografía/espaciado de cada fila y del botón "Quitar" al lenguaje visual ya vigente en el resto del panel (mismos criterios de color/tamaño de texto que `PropertyFieldRow`/`CommitRejectionBanner`).
- Tests: ninguno nuevo; cubierto por la suite ya existente como regresión de comportamiento (ver más abajo).

### Tests

**Ficheros de test**: ninguno (nuevo/ampliación); cubierto por: `src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx` y `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (suite ya existente, ejecutada como regresión — ninguna de sus aserciones depende de clases Tailwind, solo de `data-testid`/`aria-label`/`role`, que esta tarea no puede tocar).

**Comportamiento cubierto**:
- N/A (tarea puramente visual; el contrato observable ya está cubierto por la suite existente citada arriba, que debe seguir en verde sin ninguna modificación).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx
```

**Restricciones**:
- No modificar ningún `data-testid`, `aria-label`, `role` ni el patrón de `id` que la suite existente consulta (ver lista en "Impacto esperado en archivos").
- QA visual manual recomendada en el editor en modo desarrollo (spec, sección "Riesgos"): confirmar visualmente el widget "Columnas" sobre al menos un nodo con `layout.span` de mapa responsive antes de dar la tarea por cerrada; esto no sustituye ni añade un test automatizado.

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md` (sección "Widget dedicado para `layout.span` (columnas por breakpoint)").

### Criterios de finalización
- El widget "Columnas" adopta el contenedor tipo tarjeta y la tipografía del diseño de referencia sin alterar ningún `data-testid`/`aria-label`/`role` existente.
- La suite existente (`layout-canvas-property-field-layout-span.test.tsx`, `layout-canvas-properties-panel.test.tsx`) sigue en verde sin modificaciones.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T5 — Barra de vista previa de ocupación del widget `layout.span` (FR7)

### Objetivo
Bajo las seis filas del widget "Columnas", se muestra una barra horizontal dividida en `N` segmentos (denominador resuelto del breakpoint previsualizado) con los segmentos correspondientes al span resuelto destacados, más una leyenda de texto ("Vista previa en {breakpoint}: ocupa {span} de {N}."). El breakpoint previsualizado es `base` por defecto; recibir foco en el input de otra fila cambia la vista previa a esa fila mientras el foco permanezca ahí, y vuelve a `base` al perderlo si ninguna otra fila lo captura.

### Fuera de alcance
- Cualquier persistencia de la vista previa: es estado puramente visual local al widget, nunca se commitea ni sobrevive a un cambio de nodo/pestaña (ya lo garantiza el remount existente por `key={`${key}-${serializedPath}`}` en `layout-canvas-properties-panel.tsx`, sin cambios ahí).
- El re-skin de las filas (FR6): ya cerrado por T4.

### Dependencias
T4 (mismo fichero; T5 parte del contenedor y las filas ya restiladas por T4).

### Impacto esperado en archivos
- Código:
  - Nuevo: `src/dev-runtime/layout-canvas/property-fields/layout-span-occupancy-preview.tsx` — componente presentacional puro `LayoutSpanOccupancyPreview({ breakpoint, span, denominator }: { breakpoint: RuntimeResponsiveBreakpoint; span: number; denominator: number })`: renderiza `denominator` segmentos horizontales (`data-testid="layout-span-occupancy-preview"` en el contenedor), con `Math.min(Math.max(span, 0), denominator)` segmentos destacados desde el primero (clamp sin desbordar cuando `span > denominator`), y un párrafo de leyenda con el texto exacto `Vista previa en {breakpoint}: ocupa {span} de {denominator}.` (el número de `span` mostrado en el texto es el valor resuelto real, sin clamp — solo el número de segmentos pintados se recorta).
  - `src/dev-runtime/layout-canvas/property-fields/layout-span-property-field.tsx`: añadir estado local `previewedBreakpoint` (`useState<RuntimeResponsiveBreakpoint>('base')`); en cada fila, añadir al `<input>` existente `onFocus={() => setPreviewedBreakpoint(breakpoint)}` y `onBlur={() => setPreviewedBreakpoint('base')}` (ver nota de orden de eventos en Restricciones); renderizar `<LayoutSpanOccupancyPreview breakpoint={previewedBreakpoint} span={effectiveSpans[previewedBreakpoint]} denominator={denominators[previewedBreakpoint]} />` después de las seis filas, dentro del mismo contenedor tipo tarjeta.
- Tests:
  - Nuevo: `src/tests/dev-runtime/layout-canvas-property-field-layout-span-occupancy-preview.test.tsx`
  - `src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx` (ampliación)

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-property-field-layout-span-occupancy-preview.test.tsx` (nuevo)
- `src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx` (ampliación)

**Comportamiento cubierto**:
- `LayoutSpanOccupancyPreview` aislado: renderiza exactamente `denominator` segmentos; exactamente `min(span, denominator)` de ellos llevan la clase/estado "destacado" (los primeros, en orden); con `span > denominator` (p. ej. `span=5`, `denominator=3`) se pintan solo 3 segmentos destacados de los 3 totales, sin overflow ni segmento adicional; el texto de la leyenda es exactamente `Vista previa en {breakpoint}: ocupa {span} de {denominator}.` incluido el caso `span > denominator` (el texto muestra el `span` real, no el recortado); `span=0` no destaca ningún segmento sin lanzar error.
- `LayoutSpanPropertyField` (ampliación): al montar, la vista previa muestra `base` por defecto (criterio de aceptación 6, con un nodo de tres claves explícitas `base`/`md`/`xl`); dar foco al input de la fila `md` cambia la vista previa a `md` (criterio 7); perder el foco de `md` sin mover el foco a otra fila del widget devuelve la vista previa a `base` (criterio 7); mover el foco directamente de la fila `md` a la fila `lg` dentro del mismo widget deja la vista previa en `lg` (nunca pasa visiblemente por `base` de forma persistente entre ambos, ver Restricciones); un nodo con `layout.span` como entero plano sigue mostrando la vista previa para `base` con el valor uniforme heredado en las seis filas (caso límite de la spec); cambiar de pestaña o de nodo seleccionado con una fila enfocada no dispara ningún commit adicional — la vista previa es estado puramente visual (regresión: ningún `onCommitNodeUpdate` adicional se invoca por el cambio de foco).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-layout-span-occupancy-preview.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx
```

**Restricciones**:
- Implementación de foco/blur sin `relatedTarget`: `onBlur` de cualquier fila siempre fija `previewedBreakpoint` a `'base'`, y `onFocus` de cualquier fila siempre lo fija a su propio breakpoint. El orden nativo del DOM (blur del elemento saliente antes que focus del entrante) y el batching de React garantizan que mover el foco de una fila a otra deje la vista previa en la fila entrante, sin necesidad de inspeccionar `event.relatedTarget` ni de lógica adicional — no implementar un mecanismo distinto.
- No commitear ni levantar `previewedBreakpoint` al estado de `layout-canvas-properties-panel.tsx`: vive enteramente dentro de `LayoutSpanPropertyField`.

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md` (sección "Widget dedicado para `layout.span` (columnas por breakpoint)": añadir la descripción de la barra de vista previa).

### Criterios de finalización
- La barra de vista previa refleja `base` por defecto, cambia con el foco de cada fila y vuelve a `base` al perderlo sin que otra fila lo capture, con clamp visual correcto cuando el span resuelto excede `N`.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T6 — Eliminación de la caja con borde/fondo de los grupos de campos genéricos (FR8)

### Objetivo
El contenido raíz de cada pestaña del panel (`Props`/`Diseño`/`Visibilidad`/`Queries`), cualquier grupo anidado generado por `ObjectPropertyField`/`ArrayPropertyField`, y el bloque del selector de variante de acciones (`DiscriminatedUnionPropertyField`) pierden la caja con borde/fondo que hoy los envuelve. Un grupo con título (`legend`) ya visible hoy lo conserva como texto de cabecera simple (mismo estilo tipográfico ya usado: mayúsculas pequeñas, gris, sin fondo ni caja); el contenido raíz de cada pestaña (título ya oculto hoy vía `hideRootLegend`) no gana ningún título nuevo.

### Fuera de alcance
- Cualquier agrupación de campos por categoría (tipo `IDENTIDAD`/`CONTENIDO`/`APARIENCIA` del mock de Figma): fuera de alcance de esta feature (ver spec.md, Fuera de alcance).
- Los widgets dedicados con presentación propia (`choice-items`, icon picker, condición/grupo, editor clave-valor, `layout-span`): su propia estructura interna no se toca en esta tarea, salvo que internamente deleguen en `ObjectPropertyField`/`ArrayPropertyField` para alguno de sus propios sub-campos, en cuyo caso ese sub-campo delegado hereda el cambio sin ninguna acción adicional (es la misma función, ya modificada).
- Cualquier cambio de comportamiento, `data-testid`, `role` o estructura de datos: solo cambian clases Tailwind del `<fieldset>`/`<legend>` de los tres componentes listados en Impacto esperado.

### Dependencias
Ninguna dependencia técnica real con T1-T5. Se ejecuta en último lugar porque comparte fichero con T1 (`property-field-dispatcher.tsx`), aunque modifica funciones distintas (`ObjectPropertyField`/`ArrayPropertyField`, no la rama `enum`).

### Impacto esperado en archivos
- Código:
  - `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`: en `ObjectPropertyField` (líneas ~310-334 actuales), quitar `rounded-md border border-gray-200 bg-white p-2` de la clase del `<fieldset>` (conservar `flex flex-col gap-2` o equivalente para el espaciado vertical entre campos); la lógica de `hideRootLegend` (legend `sr-only` vs. visible) no cambia. En `ArrayPropertyField` (líneas ~229-296 actuales), mismo cambio: quitar el borde/fondo/padding de caja del `<fieldset>`, conservando el espaciado vertical; la clase del `<legend>` (siempre visible) no cambia.
  - `src/dev-runtime/layout-canvas/property-fields/discriminated-union-property-field.tsx`: en el `<fieldset className="flex flex-col gap-2 rounded border border-gray-200 p-2">` (línea ~94 actual), quitar `rounded border border-gray-200 p-2`, conservando `flex flex-col gap-2`. Alinear la clase del `<legend>` (línea ~95 actual, hoy `"px-1 text-xs font-medium text-gray-700"`) al mismo estilo tipográfico ya usado por `ObjectPropertyField`/`ArrayPropertyField` para sus propias etiquetas de subsección (`"px-1 text-[11px] font-medium uppercase tracking-wide text-gray-500"`), para que "Acción"/"Acción de envío" se vea igual que cualquier otra cabecera de grupo tras esta tarea.
- Tests: ninguno nuevo; cubierto por la suite ya existente como regresión de comportamiento (ver más abajo). Si al ejecutar la suite completa aparece algún test que consulte explícitamente clases de borde/fondo del `fieldset` (poco habitual en este proyecto, que consulta por `data-testid`/`role`/`aria-label`), ajustarlo para dejar de depender de esas clases sin cambiar lo que verifica funcionalmente.

### Tests

**Ficheros de test**: ninguno (nuevo/ampliación) previsto de antemano; cubierto por: toda la suite de `src/tests/dev-runtime` como regresión de comportamiento — ninguna aserción existente debería depender de las clases de borde/fondo retiradas, solo de `data-testid`/`role`/`aria-label`/contenido de texto.

**Comportamiento cubierto**:
- N/A (tarea puramente visual). El contrato observable de cada grupo (qué campos contiene, si su título es visible u oculto) no cambia; el gate de esta tarea es que la suite completa siga en verde.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime
```

**Restricciones**:
- No tocar la lógica de `hideRootLegend` en `ObjectPropertyField` ni la visibilidad del `legend` en `ArrayPropertyField`/`DiscriminatedUnionPropertyField`: solo las clases de caja (borde/fondo/padding) y, en `DiscriminatedUnionPropertyField`, la tipografía del `legend` para igualarla al resto.
- QA visual manual recomendada en el editor en modo desarrollo: confirmar visualmente que un nodo con un campo `Acción` (p. ej. `button.props.action`) y un `container` con `props.columns` responsive se ven sin caja y con el título en texto plano antes de dar la tarea por cerrada; esto no sustituye ni añade un test automatizado.

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md` (secciones "Panel de propiedades (modo Editor)" y "Selector de variante para uniones discriminadas por `type` (acciones)").

### Criterios de finalización
- El contenido raíz de cada pestaña, cualquier grupo anidado y el bloque de selector de variante de acciones se muestran sin caja con borde/fondo, conservando su título visible (si lo tenían) como texto de cabecera simple.
- La suite completa de `src/tests/dev-runtime` sigue en verde sin ninguna aserción que dependa de las clases retiradas.

### Cierre de implementación
Código y tests de la tarea completos y validados.
