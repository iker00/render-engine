# Spec — Simplificación de `items` y editor de items desde el formulario del dev editor

## Objetivo

Reducir la complejidad del contrato `items` de `select`, `radioGroup` y `checkboxGroup` de cinco shapes a tres,
retirando las variantes redundantes o ambiguas, y añadir edición completa de `props.items` desde el panel de propiedades
del editor visual (modo Editor de `DevRuntime`), sin depender del editor Monaco. Hoy `props.items` de los tres nodos
está tipado como `z.unknown()` en el schema Zod del nodo y cae siempre al fallback de solo lectura ("Este valor no se
puede editar de forma segura desde el formulario. Usa el editor JSON (Monaco) para modificarlo.").

## Alcance

### Simplificación del contrato de `items`

- Nodos afectados: `select`, `radioGroup`, `checkboxGroup` (los tres comparten shapes de `items`).
- Contrato objetivo — tres shapes:
    1. **Manual literal**: array `[{label, value}]` con `value` `string | number` homogéneo dentro del mismo campo. Sin
       cambios respecto al contrato actual.
    2. **Manual escalar**: `{ values: Array<string | number> }`. Sin cambios respecto al contrato actual.
    3. **Dinámico unificado**: `{ source, itemType, label?, value? }`, donde:
        - `source` mantiene el mismo catálogo actual: `queries.{queryName}.data`, `queries.{queryName}.data.*` o
          `item.*`.
        - `itemType` es obligatorio y limitado al enum cerrado `scalar | object`.
        - Si `itemType: 'scalar'`, ni `label` ni `value` pueden declararse.
        - Si `itemType: 'object'`, `label` y `value` son obligatorios y aceptan ruta relativa histórica (por ejemplo
          `name`) o interpolación parcial con `{{...}}` (por ejemplo `{{name}} ({{code}})`), con la misma semántica
          actual del shape dinámico objeto.
- Shapes retirados:
    - **Manual objeto** (`{ values: Array<object>, label, value }`) queda fuera del contrato. Los configs que lo usen
      deben migrarse a manual literal precomponiendo `label` y `value` por item, aceptando la pérdida de campos extra
      por item que hoy podían referenciarse vía `item.*`.
    - Los dos shapes dinámicos separados actuales (`{ source, itemType: 'scalar' }` y `{ source, label, value }`)
      desaparecen como formas independientes y se cubren mediante el dinámico unificado. Los configs con la variante
      objeto deben añadir `itemType: 'object'` explícito para pasar la validación.
- Compatibilidad: rechazo limpio en bootstrap. `validateRuntimeConfig` debe rechazar cualquier config que use un shape
  retirado o el dinámico unificado sin `itemType` explícito, con `code: invalid-layout` y la ruta exacta del nodo
  afectado.
- Semántica de resolución en runtime: la superficie que hoy resuelve los shapes de items en `runtime-collection-sources`
  debe adaptarse al nuevo contrato sin ampliar el catálogo de referencias soportadas ni cambiar la degradación por dato
  ausente.

### Editor de items en el dev editor

- El panel de propiedades del modo Editor debe permitir configurar `props.items` de los tres nodos íntegramente desde el
  formulario, sin depender de Monaco.
- Selector de modo con las tres opciones del contrato objetivo: manual literal, manual escalar, dinámico. No existe
  estado "Sin definir" en el selector; un nodo recién insertado desde la paleta arranca en modo manual literal con lista
  vacía.
- Al cambiar de modo, el valor se reconstruye con los campos por defecto del nuevo modo y se descartan los campos del
  anterior, sin conservar historial entre modos.
- **Modo manual literal**: lista editable de pares `{label, value}` con controles Añadir y Quitar por entrada. `label` y
  `value` se editan como texto libre; el runtime ya normaliza a string valores numéricos, por lo que no es necesario un
  selector de tipo por valor.
- **Modo manual escalar**: lista editable de valores primitivos como texto, con controles Añadir y Quitar por entrada.
- **Modo dinámico**: campo `source` (texto libre), selector `itemType` con dos opciones (`scalar` | `object`), y campos
  `label` y `value` (texto libre) que se muestran solo cuando `itemType === 'object'`.
- El editor reutiliza el mecanismo genérico de selector de variante ya introducido por la feature `0107` para acciones (
  `discriminated-union-property-field.tsx`).
- Cualquier cambio en el panel se refleja de inmediato en el contenido renderizado y en el buffer de Monaco, con la
  misma sincronización que el resto de campos del panel de propiedades (§ Sincronización canvas ↔ Monaco de
  `dev-mode-editor.md`).

## Fuera de alcance

- Autocompletado de `source` contra las queries declaradas en `api`: `source` se edita como texto libre, igual que el
  resto de referencias string en el panel (convención ya vigente del editor, "no incluye pickers contextuales para
  referencias string").
- Selector de tipo por valor (string/number/boolean explícitos) dentro del modo manual literal o del modo manual
  escalar: todos los valores se editan como texto y se apoya en la normalización de string ya existente en runtime.
- Deshacer/rehacer específico del selector de modo.
- Cambios en el contrato `items` fuera de la simplificación descrita; en particular, el catálogo de `source` admisible
  no cambia.
- Cambios en el shape de `defaultValue`, `validations`, `multiple`, `placeholder`, `optionLayout` o cualquier otro
  `prop` distinto de `items`.
- Editor de items para nodos distintos de `select`, `radioGroup` y `checkboxGroup`. `repeater.props.items` es una
  estructura distinta (`{source, key}`) y no se ve afectada por esta feature.
- Validación estructural de `table.props.rows` (filas fijas manuales) contra su schema real. Queda fuera; se decidirá en
  otra feature.
- Adaptador silencioso de compatibilidad para los shapes retirados o para dinámico sin `itemType`; el rechazo en
  bootstrap es limpio.

## Requisitos funcionales

1. `validateRuntimeConfig` debe aceptar únicamente los tres shapes definidos como contrato objetivo para
   `select.props.items`, `radioGroup.props.items` y `checkboxGroup.props.items`, y rechazar cualquier otro shape.
2. La resolución de items en runtime debe producir para los consumidores el mismo listado normalizado que hoy en los
   casos que sobreviven al contrato objetivo.
3. Un config existente que use manual objeto debe fallar `validateRuntimeConfig` con `code: invalid-layout` y ruta
   exacta del nodo.
4. Un config existente que use un shape dinámico sin `itemType` explícito debe fallar `validateRuntimeConfig` con
   `code: invalid-layout` y ruta exacta del nodo.
5. Un config que declare `itemType: 'scalar'` con `label` o `value` presentes, o `itemType: 'object'` sin `label` o
   `value`, debe fallar `validateRuntimeConfig` con `code: invalid-layout` y ruta exacta.
6. El panel de propiedades del modo Editor debe mostrar un selector de modo para `props.items` con las tres opciones y,
   para el modo dinámico, un sub-selector `itemType`.
7. Cambiar el modo del selector reconstruye `props.items` con los campos por defecto del nuevo modo, descartando la
   estructura del modo anterior.
8. Añadir y quitar entradas en modo manual literal y manual escalar debe reflejarse de inmediato en el runtime y en el
   buffer de Monaco.
9. Editar `source`, `itemType`, `label` o `value` en modo dinámico debe reflejarse de inmediato en el runtime y en el
   buffer de Monaco.
10. Un nodo recién insertado desde la paleta debe arrancar con `props.items` en modo manual literal y lista vacía.

## Requisitos no funcionales

- Mantener la convención ya vigente del panel: las referencias string se editan como texto plano, sin pickers
  contextuales.
- No introducir un segundo contrato de UI hardcodeado por tipo de nodo: la resolución del selector de modo se apoya en
  el schema Zod y en el mecanismo genérico ya usado por la feature `0107`.
- Mantener accesibilidad equivalente al resto de controles del panel (labels asociados a controles, botones con
  `aria-label` donde ya sea convención).
- No degradar el rendimiento percibido del panel cuando `items` en modo manual literal o manual escalar tiene decenas de
  entradas.

## Criterios de aceptación

- Un config con `select.props.items` en modo manual literal, manual escalar o dinámico (`scalar` u `object`) bien
  formado pasa `validateRuntimeConfig` y se renderiza correctamente en runtime, sin regresión visible respecto al estado
  actual.
- Un config con manual objeto o con dinámico sin `itemType` explícito falla `validateRuntimeConfig` con
  `code: invalid-layout` y ruta exacta al `props.items` del nodo.
- El panel de propiedades permite configurar íntegramente `props.items` de `select`, `radioGroup` y `checkboxGroup` en
  los tres modos sin abrir Monaco, y el resultado serializado coincide con el contrato objetivo.
- Cambiar de modo en el selector limpia los campos del modo anterior y muestra los campos por defecto del nuevo.
- En modo dinámico, cambiar `itemType` de `object` a `scalar` retira `label` y `value` del valor; cambiar de `scalar` a
  `object` los reintroduce como campos vacíos por defecto.
- Insertar un nodo `select`, `radioGroup` o `checkboxGroup` desde la paleta produce un `props.items` en modo manual
  literal con lista vacía; guardar este estado directamente falla al pasar a runtime solo si el resto del contrato
  requiere que `items` esté no vacío (comportamiento ya vigente para el shape manual literal actual).
- Las fichas `nodes/select.md`, `nodes/choice-groups.md` y, si aplica, `references/reference-resolution.md` se
  actualizan para reflejar el contrato objetivo, sin mencionar los shapes retirados como soportados.

## Casos límite

- Nodo cuyo `props.items` en modo manual literal está vacío: el runtime ya soporta hoy colecciones vacías (sin opciones
  renderizadas). El editor no impone longitud mínima aquí.
- `label` o `value` con referencias interpolables (`{{...}}`) en modo dinámico `object`: se comportan exactamente como
  hoy en el shape dinámico objeto, sin cambios semánticos.
- Cambiar el selector de modo con datos parciales: el reemplazo es completo; no se preserva ninguna parte del valor
  anterior. Esto es intencional para evitar valores híbridos ambiguos.
- Config donde el mismo nodo declara conjuntamente formas retiradas (por ejemplo `values` y `source` a la vez): rechazo
  por `validateRuntimeConfig` como shape no reconocido; ya no existe una rama que acepte esa combinación.
- `select.multiple: true` con `props.items` en modo dinámico `scalar`: la semántica de valor múltiple no cambia; el
  runtime solo depende de la colección resuelta, no del shape declarado.
- Nodo dentro de `repeater` con `source: item.*`: sigue soportado exactamente igual, tanto en modo dinámico `scalar`
  como en modo dinámico `object`.

## Áreas de producto afectadas a alto nivel

- Contrato JSON de `select`, `radioGroup`, `checkboxGroup` (validación y tipos públicos).
- Resolución de items en runtime (`runtime-collection-sources`).
- Editor visual del layout, específicamente el panel de propiedades del modo Editor.
- Documentación funcional de los tres nodos afectados y, si procede, de la resolución de referencias.

## Documentación probablemente afectada a alto nivel

- `ai-workflow/docs/app-features/nodes/select.md`
- `ai-workflow/docs/app-features/nodes/choice-groups.md`
- `ai-workflow/docs/app-features/references/reference-resolution.md` si el cambio afecta a las superficies que enumera
  para `label`/`value` y `source`
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` para el nuevo comportamiento del panel de propiedades
  sobre `props.items`
- `ai-workflow/docs/current-state.md` si el cambio de contrato modifica la "última feature relevante" del catálogo de
  nodos

## Riesgos o preguntas abiertas

- Migración del `src/dev/config.json` versionado en el repo: si usa manual objeto o dinámico objeto sin `itemType`
  explícito, deja de validar en cuanto la feature aterrice; la migración debe cubrirse en las tareas de implementación
  como parte del cambio de contrato, para que el arranque en modo desarrollo local siga funcionando.
- Los tipos públicos `SelectManualObjectItemsSource`, `SelectDynamicItemsSource` y `SelectManualScalarItemsSource` en
  `runtime-config-types.ts` están hoy exportados desde `runtime-config.ts`, aunque no se consumen dentro del propio
  código de runtime. Retirarlos o renombrarlos forma parte del cambio de contrato; la ficha `nodes/select.md` documenta
  explícitamente los nombres actuales de shapes y debe actualizarse a los tres nuevos.
- Representación exacta del dinámico unificado en Zod v4 con la restricción condicional entre `itemType`, `label` y
  `value` (por ejemplo `z.discriminatedUnion('itemType', [...])` interno o `.refine`): decisión técnica a resolver en
  `design.md`, sin impacto en la spec funcional.
