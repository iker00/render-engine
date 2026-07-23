# Design: Feature 0108 - simplificación de `items` y editor desde el formulario del dev editor

## Contexto

Hoy `props.items` de `select`, `radioGroup` y `checkboxGroup` acepta cinco shapes distintos (manual literal, manual escalar, manual objeto, dinámico escalar, dinámico objeto). El schema Zod del nodo declara `items: z.unknown()` y toda la validación estructural vive imperativamente en `validateSelectItemsContract` (`src/config/validate-form-nodes.ts`), que devuelve el `items` normalizado tras aceptar cualquiera de las cinco variantes. La resolución en runtime la centraliza `runtime-collection-sources.ts` (`resolveChoiceCollectionItems`, `resolveCollectionSource`), que rama en `values` vs `source` y luego en presencia de `label`/`value` para elegir proyección objeto o escalar.

Al ser `items: z.unknown()`, el JSON Schema derivado que consume el editor visual (dispatcher `PropertyFieldDispatcher`, feature 0107) no describe la forma de `items` y siempre cae al `RawJsonPropertyField` de solo lectura. Los tipos públicos `SelectManualObjectItemsSource`, `SelectDynamicItemsSource` y `SelectManualScalarItemsSource` (definidos en `runtime-config-types.ts` y re-exportados desde `runtime-config.ts`) modelan las variantes actuales; una comprobación grep confirma que no tienen consumidores fuera del propio `src/config`.

`src/dev/config.json` en la rama solo usa la variante manual literal para los tres nodos afectados; no hay uso vigente de manual objeto ni dinámico sin `itemType`, así que la migración del config local es una comprobación, no una reescritura.

La feature 0107 dejó introducido el patrón "selector de variante + subcampos de la variante activa" en `discriminated-union-property-field.tsx`, que detecta uniones por `properties.type` literal. Ese patrón se apoya sobre un discriminador literal `type` y no cubre por sí solo el caso de `items` (donde la variante externa no es una unión discriminada sobre `type`, y donde la variante manual literal es un array puro).

## Objetivos / No objetivos

### Objetivos
- Fijar el contrato Zod y de tipos públicos que garantiza los tres shapes objetivo (manual literal, manual escalar, dinámico unificado con `itemType` explícito) y rechaza el resto sin adaptador de compatibilidad.
- Fijar cómo se representan las tres formas en Zod v4 sin dejar la restricción condicional entre `itemType`, `label` y `value` fuera del schema, resolviendo la pregunta abierta señalada por la spec.
- Fijar la estrategia técnica para editar `props.items` desde el panel de propiedades del modo Editor sin duplicar el patrón visual de la feature 0107 ni introducir un segundo contrato de UI hardcodeado por tipo de nodo.
- Fijar el ámbito del cambio en `runtime-collection-sources` (que sigue trabajando con la colección resuelta y solo debe adaptarse al catálogo de shapes recortado, no a nueva semántica).
- Dejar cerrada la migración del `src/dev/config.json` versionado y el destino de los tipos públicos actuales antes de planificar.

### No objetivos
- Autocompletar `source` contra las queries del config o abrir un picker contextual para referencias string en el editor.
- Rediseñar la ficha de `items` de otros nodos (`list`, `table`, `repeater`), aunque compartan `runtime-collection-sources` como capa común.
- Ampliar el catálogo admitido para `source` o para las rutas de `label`/`value`.
- Introducir undo/redo específico del selector de modo o preservar historial de campos entre modos.
- Añadir selector de tipo por valor (`string`/`number`/`boolean` explícito) dentro de manual literal o manual escalar.

## Decisiones

### D1 — Contrato Zod: `z.union` externa con `z.discriminatedUnion` interna
`selectItemsSchema` se define como una unión externa de tres shapes; la variante dinámica es una `z.discriminatedUnion('itemType', [...])` interna:

```
selectItemsSchema = z.union([
  z.array(selectItemSchema),                                        // manual literal
  z.object({ values: z.array(z.union([z.string(), z.number()])) }).strict(), // manual escalar
  z.discriminatedUnion('itemType', [
    z.object({ source: z.string(), itemType: z.literal('scalar') }).strict(),
    z.object({ source: z.string(), itemType: z.literal('object'),
               label: z.string(), value: z.string() }).strict(),
  ]),
])
```

`selectNodeSchema.props.items`, `radioGroupNodeSchema.props.items` y `checkboxGroupNodeSchema.props.items` pasan de `z.unknown()` a `selectItemsSchema`. `selectItemsSchema` se exporta desde `runtime-config-zod.ts` y se reutiliza tal cual en los tres nodos.

Por qué esta forma frente a un único `z.union` plano o a un `.refine` sobre un objeto abierto:
- `z.discriminatedUnion('itemType', …)` interno hace explícita la restricción condicional entre `itemType`, `label` y `value` en el propio schema. No queda encapsulada en un `.refine` opaco y `toJSONSchema` produce un `oneOf` con cada rama declarando `itemType` como literal, útil también para el autocompletado de Monaco.
- Mantener la unión externa como `z.union` (no discriminada) evita inventar un discriminador visible en el JSON (manual literal es array, manual escalar es objeto sin `type`, dinámico ya trae `itemType`); un discriminador externo obligaría a cambiar el contrato observable del runtime, cosa que la spec descarta.
- Un `.refine` global sobre `z.unknown()` mantendría toda la validación imperativa; se descarta porque no genera un JSON Schema útil ni ayuda a la reutilización de patrones del editor.

Trade-off: la unión externa no discriminada obliga a intentar parseo por rama al fallar, y los mensajes crudos de Zod v4 pueden ser ruidosos. Se compensa manteniendo la traducción del error a `invalid-layout` con ruta canónica en `validateSelectItemsContract` (D2), como ya hacen otros nodos del proyecto.

### D2 — Validador imperativo: adelgazado, no eliminado
`validateSelectItemsContract` se reescribe para apoyarse en `selectItemsSchema` como fuente de la forma estructural y conserva únicamente las comprobaciones de dominio que Zod no expresa naturalmente:
- validez de `source` como referencia de colección (`validateCollectionSource`, `allowItemReference: true`), con la ruta exacta `${path}.source` en el error.
- validez de `label` y `value` como `isValidCollectionProjectionPath` en la variante dinámica objeto.
- homogeneidad `string`/`number` de `value` en manual literal (ya existente).

Los rechazos que hoy hace imperativamente (manual objeto, dinámico sin `itemType`, `itemType: 'scalar'` con `label`/`value` presentes, `itemType: 'object'` sin `label`/`value`) pasan a delegarse en el schema Zod; la función solo mapea el resultado a `enrichedInvalidLayout` con `code: invalid-layout` y la ruta apuntada al primer issue del `SafeParseError`. Se conserva la firma pública para no reabrir el resto del pipeline de `validate-form-nodes`.

Por qué mantener el envoltorio imperativo en lugar de eliminarlo:
- El resto del pipeline (`validate-form-nodes`, `validate-layout-nodes`) espera resultados `{status: 'ready', items} | {status: 'error', error}` con la ruta canónica del proyecto y `breadcrumb` enriquecido; Zod solo por sí mismo no produce ese contrato.
- Las validaciones de referencia de `source` y de `label`/`value` como projection path no viven en Zod y deben quedarse aquí para preservar mensajes específicos.

Alternativa descartada: mover todo a `.superRefine`/`.transform` dentro de Zod. Se rechaza porque duplicaría lógica de proyección y forzaría a cargar `validateCollectionSource` desde el módulo de schemas, rompiendo la dirección de dependencias actual.

### D3 — Tipos públicos: reforma alineada al nuevo contrato
Se rehace el bloque de tipos en `runtime-config-types.ts`:
- Se elimina `SelectManualObjectItemsSource` sin sustituto.
- `SelectDynamicItemsSource` pasa a ser una unión discriminada de dos interfaces: `SelectDynamicScalarItemsSource { source: string; itemType: 'scalar' }` y `SelectDynamicObjectItemsSource { source: string; itemType: 'object'; label: string; value: string }`. Se retira el `itemType?: 'scalar'` opcional actual.
- `SelectManualScalarItemsSource` se conserva sin cambios.
- `SelectLayoutNodeItems` pasa a ser `SelectLayoutNodeItem[] | SelectManualScalarItemsSource | SelectDynamicItemsSource`.
- Las re-exportaciones desde `runtime-config.ts` se actualizan en consecuencia; `SelectManualObjectItemsSource` desaparece del re-export.

Por qué renombrar/reformar y no dejar el alias antiguo:
- No hay consumidores fuera de `src/config` (verificado por grep), así que la reforma no obliga a puntos de compatibilidad.
- Mantener `itemType?` opcional dejaría el tipo desalineado del contrato objetivo y volvería a permitir modelar dinámico sin `itemType` en TypeScript aunque Zod lo rechace.

### D4 — Runtime: recorte, sin cambio semántico
`runtime-collection-sources.ts` sigue derivando la proyección por presencia de `label`/`value` en el shape ya validado; con el catálogo recortado esa rama ahora corresponde solo a dinámico objeto. La rama de manual objeto (`values` como array de objetos + `label`/`value`) desaparece porque el config ya no puede alcanzarla tras la validación.

Concretamente:
- `resolveCollectionSource` mantiene la comprobación `'values' in items` para manual escalar y el fallback a `source` para dinámico.
- `resolveChoiceCollectionItems` mantiene la comprobación `'label' in items && 'value' in items` para proyectar objeto en dinámico objeto; el resto (dinámico escalar) cae a proyección escalar.
- Se elimina cualquier rama muerta específica de manual objeto en el propio módulo o en helpers como `projectObjectCollectionToSelectItems` cuando el único llamador que quedaba era esa rama.

Por qué no reescribir la resolución sobre el nuevo `itemType`:
- La resolución se apoya en la forma del valor ya validado, no en `itemType` directamente. Un rediseño alrededor de `itemType` no aportaría nada frente al match por presencia de `label`/`value`, y complicaría la coexistencia con `list` (que sigue con su propio `ListLayoutNodeItems`).

### D5 — Editor de items: componente dedicado + hook de widget en el dispatcher
Se añade `ChoiceItemsPropertyField` en `src/dev-runtime/layout-canvas/property-fields/`, modelado sobre `DiscriminatedUnionPropertyField`:
- Selector de modo (`EnumPropertyField`) con `manualLiteral | manualScalar | dynamic` y etiquetas legibles en español ("Manual — literal", "Manual — escalar", "Dinámico").
- Detección del modo activo a partir del valor: `Array.isArray(value)` → manualLiteral; `value` objeto con `values` → manualScalar; `value` objeto con `source` → dynamic. Cualquier valor no reconocible se trata como manualLiteral vacío.
- Reset completo al cambiar de modo: se reconstruye el valor con la plantilla mínima del nuevo modo (`[]`, `{ values: [] }` o `{ source: '', itemType: 'scalar' }`) descartando el valor anterior. No hay historial cruzado entre modos.
- Sub-editor por modo:
  - manualLiteral: reutiliza `ArrayPropertyField` (implícito vía `PropertyFieldDispatcher`) con schema de item `{label, value}`.
  - manualScalar: reutiliza `ArrayPropertyField` con schema de item escalar; el valor se edita como texto y se apoya en la normalización a string ya existente en runtime.
  - dynamic: renderiza `source` como `TextPropertyField`, `itemType` como sub-selector (`EnumPropertyField`, dos opciones `scalar`/`object`), y muestra `label`/`value` como `TextPropertyField` solo cuando `itemType === 'object'`. Cambiar de `object` a `scalar` retira `label`/`value` del valor; el sentido inverso los añade como campos vacíos.

Para no duplicar la maquinaria del dispatcher se introduce un hook mínimo en `PropertyFieldDispatcher`: si el fragmento de schema declara `x-widget: '<clave>'`, el dispatcher delega en un registro `{ 'choice-items': ChoiceItemsPropertyField }` antes de aplicar sus patrones genéricos. El hook se limita a este registro cerrado y no admite widgets ad-hoc.

Por qué esta forma frente a alternativas:
- Reutilizar `DiscriminatedUnionPropertyField` tal cual no encaja: la unión externa no comparte un discriminador `type` literal en el JSON del config y una de las ramas es un array, no un objeto.
- Generalizar `getDiscriminatedUnionVariants` para aceptar un discriminador configurable (por ejemplo `itemType` o "presencia de `values`") sirve solo para el caso interno del dinámico, no para el mode externo. Se descarta como cambio invasivo del dispatcher sin cubrir el problema completo.
- Añadir un `type` sintético al valor solo dentro del panel (limpiado al hacer commit) obligaría a serialización/deserialización especial en un componente ya delicado; el widget dedicado evita ese acoplamiento.

Trade-off: se introduce un mecanismo de widgets en el dispatcher que no existía. Se acota al registro cerrado y al patrón "el schema declara `x-widget` explícitamente, no se infiere"; queda documentado como último recurso cuando los patrones genéricos no expresan el UX pedido.

### D6 — Ruta del schema hasta el widget: adaptador por nodo tipo `resolveTabsPropsSchema`
Se añade `resolveChoiceLikePropsSchema` junto al `resolveTabsPropsSchema` existente en el panel de propiedades. Para `select`, `radioGroup` y `checkboxGroup`, sustituye el sub-schema `props.items` derivado de Zod por el sentinel `{ 'x-widget': 'choice-items' }`, sin `oneOf`/`anyOf` remanente.

- El JSON Schema que se pasa a `PropertyFieldDispatcher` para la sección `Props` queda con `items` opaco al pattern matching genérico y el hook del D5 dispara `ChoiceItemsPropertyField`.
- El JSON Schema que se pasa a Monaco (`runtimeConfigRootSchema` → `toJSONSchema`) no cambia: sigue el schema Zod real, con el `oneOf` completo y el discriminador interno `itemType`, para no degradar el autocompletado del editor de texto.
- `resolveUnionBranch` sobre el sentinel devuelve el propio sentinel (no hay `oneOf`/`anyOf`), por lo que la propagación a través de `ObjectPropertyField` no lo pierde.

Por qué así:
- Precedente vigente: `resolveTabsPropsSchema` ya adapta el schema por tipo de nodo dentro del propio panel.
- Alterar `PropertyFieldDispatcher` para detectar por tipo de nodo rompería su carácter agnóstico de nodo (D5 del design 0107).

### D7 — Palette defaults: manual literal vacío
El generador de nodos de la paleta (`layout-canvas-node-palette-defaults.ts`) pasa a insertar `props: { fieldId, label, items: [] }` para `select`, `radioGroup` y `checkboxGroup`, en lugar del actual `items: [{ label: 'Opción 1', value: 'opcion-1' }]`. Cumple RF10 y evita valores placeholder que el usuario debería borrar antes de configurar.

## Riesgos y trade-offs

- **Ruido de errores Zod v4 en unión externa no discriminada.** Un `items` con clave inesperada puede ser rechazado por cualquiera de las tres ramas, y el primer issue de Zod puede apuntar a una rama poco intuitiva. Mitigación: `validateSelectItemsContract` traduce el resultado al `invalid-layout` con la ruta canónica del proyecto (D2). No se cambia el contrato de errores hacia consumidores.
- **`x-widget` como nuevo hook genérico en el dispatcher.** Riesgo de derivar hacia un catálogo de widgets custom. Mitigación: registro cerrado, documentado como último recurso, cambios futuros deben cumplir el mismo umbral que justificó el actual (patrón imposible de expresar con los detectores existentes).
- **Divergencia entre schema visto por el panel y schema visto por Monaco.** El panel usa `resolveChoiceLikePropsSchema` (sentinel), Monaco usa el schema Zod real. Trade-off aceptado: Monaco gana autocompletado del oneOf completo; el panel gana un UX coherente. La única diferencia observable está aislada al fragmento `items` de los tres nodos afectados.
- **Pérdida de campos extra en migración de manual objeto ya declarada por la spec.** Sin adaptador de compatibilidad, un config existente que declare manual objeto queda rechazado en bootstrap. El comportamiento es intencional (rechazo limpio) y se documenta en la ficha del nodo.
- **`SelectManualObjectItemsSource` eliminado del re-export público.** Si alguna herramienta externa lo consumía por accidente (fuera del `src/`), rompería. La spec y el grep en `src/` justifican asumir el coste; se puede añadir un `@deprecated` puntual si se decidiese suavizar, pero la spec pide rechazo limpio.

## Migración o despliegue

- **`src/dev/config.json` versionado en la rama:** revisado en el propio design. Solo aparece manual literal para `select`, `radioGroup`, `checkboxGroup`; no hay manual objeto ni dinámico sin `itemType`. No hace falta migración de datos en este fichero. Se deja explícito en `tasks.md` que las tareas de implementación revisen esto una segunda vez tras cerrar la validación, por si el fichero cambia mientras dure la implementación.
- **Configs externos no controlados por este repo:** fuera de alcance por la spec; la ruptura es explícita.
- **Sin flag de despliegue.** El cambio va con la merge de la feature. No se necesita coexistencia con el contrato antiguo.

## Preguntas abiertas

Ninguna que bloquee planificación. Los tres puntos que la spec dejaba abiertos quedan resueltos:
- forma Zod del dinámico unificado → D1 (discriminatedUnion interna).
- destino de los tipos públicos `SelectManualObjectItemsSource`, `SelectDynamicItemsSource`, `SelectManualScalarItemsSource` → D3 (reforma alineada, sin alias).
- migración de `src/dev/config.json` → confirmada innecesaria en el estado actual.
