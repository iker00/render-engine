# Tasks: address-picker-node

## Orden de ejecución

T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9, estrictamente secuencial.

Cadena de dependencias real:
- T1 abre el tipo de nodo en el contrato (sin él, ningún test posterior puede declarar un `addressPicker` en un layout válido).
- T2 abre el hueco de estado donde viven las coordenadas.
- T3 (sintaxis) y T4 (resolución) habilitan `$lat`/`$lng` de punta a punta.
- T5 cierra la frontera de bootstrap de esas referencias, una vez existe el tipo de nodo (T1) y la forma de referencia (T3).
- T6 es un refactor puro que prepara la base de mapa reutilizable sin cambiar el comportamiento de `map`.
- T7 materializa el nodo (mapa clicable + texto), consumiendo T1, T2 y T6.
- T8 añade el disparo de geocodificación sobre el nodo ya renderizable.
- T9 añade el botón de geolocalización, que entrega coordenadas al camino de T8 sin duplicar el disparo.

Siguiente tarea a escoger tras cerrar esta planificación: **T1**.

## Decisiones de contrato fijadas en planificación

El design cierra la arquitectura pero deja tres puntos de contrato sin nombre concreto. Se fijan aquí para que ningún subagente los invente; no son rediseño, son nomenclatura derivada de precedentes ya vigentes en el repo:

1. **Literal del tipo de nodo: `addressPicker`** (camelCase), no `address-picker`. El catálogo real usa camelCase para tipos compuestos (`fileInput`, `fileManager`, `radioGroup`, `checkboxGroup`), mientras que las fichas documentales usan kebab-case (`file-input.md` documenta el tipo `fileInput`). La ficha de documentación se seguirá llamando `address-picker.md`.
2. **`props.geocodeOperation`** (string obligatorio): nombre de la operación del catálogo `api` que ejecuta la geocodificación inversa. Sigue el patrón de nomenclatura `{propósito}Operation` ya vigente en `fileManager` (`getOperation`, `uploadOperation`, `deleteOperation`). Su resultado se escribe, como cualquier operación, en `queries.{geocodeOperation}`.
3. **`props.addressPath`** (string obligatorio): ruta dot-notation relativa al `data` de la respuesta de `geocodeOperation` donde vive el texto de dirección (p. ej. `display_name` en Nominatim, `results.0.formatted_address` en Google). Semántica idéntica a `tokens.{tokenId}.refresh.responsePath`, que ya resuelve exactamente el mismo problema ("dónde está el valor dentro del body de respuesta"). Sin esta prop el nodo no puede saber qué parte de la respuesta es la dirección, y la spec exige que el proveedor sea configurable por instancia.

## Corrección verificada sobre el design

La **Decisión 4** del design asume que `validate-form-nodes.ts` expone (o puede exponer) un índice `fieldId → tipo de nodo` reutilizable. Verificado contra el código: **no existe en esa forma**. `validate-form-nodes.ts` es solo un fichero de re-exportación (15 líneas); el índice real vive en `validate-form-semantics.ts` como `fieldIds: Set<string> | null` dentro de `FormValidationContext`, es decir, **solo IDs, sin tipo**, y se construye en un recorrido en streaming de una sola pasada. Eso lo hace inservible para esta validación por dos motivos independientes: no guarda el tipo, y una referencia `$lat`/`$lng` puede aparecer en el árbol (o en `api.*`, que es global) **antes** de que el recorrido haya visto el nodo que declara ese `fieldId`.

T5 resuelve esto con una **pasada post-validación independiente** sobre el árbol ya tipado, exactamente el mecanismo que la feature previa `row-visibility-and-switch-checked` estableció en `src/config/validate-row-visibility-scope.ts` para un problema análogo (validar el scope de una familia de referencias que el recorrido principal no puede decidir). La decisión arquitectónica del design se mantiene intacta —se valida en bootstrap con `invalid-layout`, no se degrada en runtime—; solo cambia el módulo donde se implementa.

Se descartó la alternativa de convertir `fieldIds: Set<string>` en `Map<string, LayoutNodeType>` dentro de `validate-form-semantics.ts`: es viable (el `node.type` está en scope en los dos puntos de inserción, líneas ~257 y ~424, ya estrechado por el type-guard `isFormOnlyLeafNode`), pero no resuelve el problema real —el orden de recorrido— y obligaría a tocar dos puntos duplicados de un módulo grande para exponer un índice que la pasada de T5 puede construir por su cuenta en una sola función.

La **Decisión 2** resulta ser bastante más barata de lo que el design temía: `RuntimeFormFieldState` ya es un registro con metadatos (`value`, `error`, `touched`, `dirty`, `defaultValue?`), no un valor plano. Añadir `synthetic?: Record<string, unknown>` es un campo hermano más, y ningún consumidor existente itera valores de campo asumiendo forma plana: todos leen `.value` a través de `getFormFieldValue`/`selectFormFieldState`. El "riesgo residual de auditoría" que el design señalaba queda cerrado; T2 lo cubre con tests de no-regresión en lugar de con una auditoría abierta.

---

## T1 — Contrato y validación del nodo `addressPicker`

### Objetivo
Añadir `addressPicker` al contrato de configuración como nodo hoja de formulario, con su validación de shape y su restricción estructural a descendientes de `form`.

Cambios exactos:

1. **Tipo**: añadir `'addressPicker'` a `LayoutNodeType` y el interface `AddressPickerLayoutNode` a la unión discriminada de `LayoutNode` en `src/config/runtime-config-types.ts`, con `props`:
   - `fieldId: string` (obligatorio, no vacío).
   - `label: string` (obligatorio, misma semántica literal/referencia/interpolación que `input.props.label`).
   - `geocodeOperation: string` (obligatorio, no vacío).
   - `addressPath: string` (obligatorio, no vacío, dot-notation).
   - `center?: { lat: number; lng: number }`, `zoom?: number`, `height?: MapHeight` — **mismo contrato, mismos rangos y mismos tipos que `map`**, reutilizando los tipos ya exportados (`MapHeight`) en vez de declarar alias nuevos.
   - `defaultValue?: unknown` (mismo contrato que `input`: literal string o referencia dinámica completa).
   - `validations?` (mismo shape que `input` textual; en esta entrega solo `required` tiene semántica propia documentada, el resto se valida con el motor común ya existente).
2. **Validador de nodo**: nuevo `src/config/validate-address-picker-node.ts` con el esquema `Zod` y las comprobaciones de rango, siguiendo literalmente el patrón de `src/config/validate-map-node.ts` para `center`/`zoom`/`height` (`lat` en `[-90, 90]`, `lng` en `[-180, 180]`, `zoom` entero en `[0, 19]`, `height` en `sm|md|lg|xl`) y el de `validate-autocomplete-node.ts` para `fieldId`/`label`/`validations`/`defaultValue`. Conectarlo desde el dispatcher de validación de nodos (`validate-layout-nodes.ts`, mismo punto donde se conectan `map`/`autocomplete`).
3. **Reglas estructurales**: añadir `'addressPicker'` a `FORM_ONLY_LEAF_NODE_TYPES` y a `FORM_ALLOWED_DESCENDANT_TYPES` en `src/config/layout-placement-rules.ts`. Con eso, el rechazo fuera de `form` y la unicidad de `fieldId` dentro del `form` los aporta `validate-form-semantics.ts` sin tocar ese módulo.
4. **Referencia cruzada a `api`**: `props.geocodeOperation` debe apuntar a una operación existente en `api`; si no existe, rechazar el config con `invalid-layout` sobre `{path}.props.geocodeOperation`, con el mismo criterio ya aplicado a `button.props.action.operationName` y `form.submitAction.operationName`. Implementarlo en el mismo punto de `validate-runtime-config.ts` donde se comprueban esos `operationName`.
5. **Nodo hoja**: `children` declarado en un `addressPicker` se rechaza con `invalid-layout` sobre `{path}.children`, mismo criterio explícito que ya aplica `map`.

### Fuera de alcance
- No se renderiza nada: no se toca `src/runtime/` en esta tarea.
- No se valida ninguna referencia `$lat`/`$lng` (eso es T3 para la forma y T5 para la frontera).
- No se toca el estado de formulario (T2).
- No se añade soporte en `dev-editor` (panel de propiedades, paleta, drop rules): fuera de alcance por spec, igual que tuvo `map` en su entrega inicial.
- No se define ningún valor por defecto de `center`/`zoom`/`height` en validación: se copian tal cual si están presentes y los defaults se resuelven en el componente (T7), mismo reparto que ya usa `map`.

### Dependencias
Ninguna.

### Interfaces
**Consume:** ninguna firma de otra tarea.

**Produce:**
- Tipo `AddressPickerLayoutNode` con `props: { fieldId: string; label: string; geocodeOperation: string; addressPath: string; center?: { lat: number; lng: number }; zoom?: number; height?: MapHeight; defaultValue?: unknown; validations?: RuntimeFieldValidations }` — consumido por: T7, T8, T9.
- `validateAddressPickerNode(node: unknown, path: string, ctx: LayoutValidationCtx): LayoutNodeValidationResult` — consumido por: `validate-layout-nodes.ts` (integración en la misma tarea). La firma exacta debe replicar la ya usada por `validateMapNode` en el mismo dispatcher; si esa firma difiere, prevalece la del dispatcher real, no esta transcripción.
- Literal de tipo `'addressPicker'` dentro de `LayoutNodeType` — consumido por: T5, T7.

### Impacto esperado en archivos
- Código:
  - `src/config/runtime-config-types.ts` (modificación: tipo y unión).
  - `src/config/validate-address-picker-node.ts` (nuevo).
  - `src/config/validate-layout-nodes.ts` (modificación: dispatch del nodo nuevo).
  - `src/config/layout-placement-rules.ts` (modificación: dos sets).
  - `src/config/validate-runtime-config.ts` (modificación: comprobación de `geocodeOperation` contra `api`).
  - `src/config/validation-breadcrumb.ts` (modificación: añadir `addressPicker` al conjunto `fieldIdTypes` de la línea 9, para que el breadcrumb de un error lo identifique como `addressPicker(fieldId: "x")` y no como `addressPicker[índice]`. Ese conjunto está hoy desincronizado con `FORM_ONLY_LEAF_NODE_TYPES` — le falta `autocomplete` —; **no** corregir esa omisión preexistente aquí, es un defecto ajeno a esta feature).
  - `src/config/runtime-config.ts` (modificación solo si el tipo nuevo debe re-exportarse como parte de la fachada pública, igual que los demás nodos).
- Tests: `src/tests/config-validation/runtime-config-validation-address-picker.test.ts` (nuevo).
- Documentación afectada: ninguna en esta tarea. La ficha `ai-workflow/docs/app-features/nodes/address-picker.md` y la fila del catálogo se escriben cuando el nodo tiene comportamiento observable (a partir de T7); documentar solo el contrato aquí dejaría una ficha describiendo un nodo que todavía no se renderiza.

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-address-picker.test.ts` (nuevo)

#### Comportamiento cubierto
- Un `form` con un `addressPicker` que declara `fieldId`, `label`, `geocodeOperation` (existente en `api`) y `addressPath` válidos se acepta en bootstrap.
- `props.fieldId` ausente o vacío rechaza el config con `invalid-layout` y ruta exacta `{path}.props.fieldId`.
- `props.label` ausente rechaza el config con ruta exacta `{path}.props.label`.
- `props.geocodeOperation` ausente o vacío rechaza el config con ruta exacta `{path}.props.geocodeOperation`.
- `props.geocodeOperation` que referencia una operación inexistente en `api` rechaza el config con ruta exacta `{path}.props.geocodeOperation` (comprobación cruzada, no de shape).
- `props.addressPath` ausente o vacío rechaza el config con ruta exacta `{path}.props.addressPath`.
- `props.center.lat` fuera de `[-90, 90]` y `props.center.lng` fuera de `[-180, 180]` rechazan con ruta exacta `.props.center.lat` / `.props.center.lng`.
- `props.zoom` no entero, negativo o mayor que `19` rechaza con ruta exacta `.props.zoom`.
- `props.height` fuera de `sm|md|lg|xl` rechaza con ruta exacta `.props.height`.
- `props.center`, `props.zoom` y `props.height` ausentes se aceptan (todos opcionales) y el nodo normalizado no inventa valores por defecto para ellos.
- `children` declarado en un `addressPicker` rechaza con ruta exacta `{path}.children`.
- Un `addressPicker` declarado en la raíz de `pages[].layout` (fuera de cualquier `form`) rechaza el config con `invalid-layout`, igual que `input`/`select`/`autocomplete`.
- Un `addressPicker` anidado dentro de un `container` que a su vez está dentro de un `form` se acepta (descendiente indirecto, no solo hijo directo).
- Dos `addressPicker` con el mismo `fieldId` dentro del mismo `form` rechazan el config con el mensaje de `fieldId` duplicado ya existente; dos con el mismo `fieldId` en formularios distintos se aceptan.
- Un `addressPicker` y un `input` con el mismo `fieldId` dentro del mismo `form` rechazan el config (la unicidad es por `form`, no por tipo de nodo).
- `props.validations.required: true` se acepta; una regla incompatible con un campo de texto (por ejemplo `minSelections`) se rechaza con la ruta exacta, igual que en `input`.
- Regresión: un config sin ningún `addressPicker` sigue validando exactamente igual (caso de control con `input` + `map` en el mismo layout).

#### Comandos durante la implementación
```
pnpm test --run src/tests/config-validation/runtime-config-validation-address-picker.test.ts
```

#### Restricciones
- Las aserciones deben ir contra `validateRuntimeConfig` como extremo público, no contra `validateAddressPickerNode` directamente, para que los tests sobrevivan a un renombrado del helper interno.
- Reutilizar los builders de config ya existentes en `src/tests/config-validation/helpers.ts` en lugar de construir fixtures nuevas a mano.
- No añadir aquí ningún caso con referencias `$lat`/`$lng`: en este punto todavía son rutas inválidas y el test fijaría una expectativa que T3 invalida.

### Documentación afectada
Ninguna en esta tarea (ver justificación en "Impacto esperado en archivos").

### Criterios de finalización
- `addressPicker` es un tipo de nodo válido del contrato, aceptado solo dentro de `form`.
- Todas las reglas de shape y la referencia cruzada a `api` están cubiertas por tests en verde.
- Ningún fichero de `src/runtime/` ha sido modificado.

### Cierre de implementación
Código y tests de la tarea completos, `pnpm test --run` del fichero de la tarea en verde y sin regresiones en la suite de `config-validation`.

---

## T2 — Metadatos sintéticos por campo en el dominio `forms` del store

### Objetivo
Abrir en `runtime-state/` el hueco donde un campo de formulario puede guardar metadatos sintéticos junto a su valor, sin cambiar la forma del valor efectivo para ningún consumidor existente.

Cambios exactos:

1. **Tipo**: añadir `synthetic?: Record<string, unknown>` a `RuntimeFormFieldState` en `src/runtime/runtime-state/runtime-state-types.ts`, como campo hermano opcional de `value`/`error`/`touched`/`dirty`/`defaultValue`.
2. **Acción**: añadir a `RuntimeStateAction` la variante `{ type: 'forms/set-synthetic'; payload: { formId: string; fieldId: string; synthetic: Record<string, unknown> } }`.
3. **Reducer** (`runtime-state-reducer.ts`): manejar `forms/set-synthetic` fusionando por clave sobre el `synthetic` existente del campo (`{ ...campo.synthetic, ...payload.synthetic }`), sin tocar `value`, `error`, `touched` ni `dirty`. Si el campo todavía no existe en store, la acción es un no-op (mismo criterio defensivo que ya aplican las demás acciones de `forms` sobre campos ausentes; replicar el que exista realmente en el módulo).
4. **Preservación**: `forms/set-value` **conserva** el `synthetic` existente del campo (editar el texto no borra las coordenadas — requisito funcional 10 de la spec). `forms/reset` y `forms/remove` lo limpian junto con el resto del estado del campo, sin caso especial.
5. **Fachada**: añadir `setFormFieldSynthetic` a `useRuntimeStateActions` (`use-runtime-state.ts`), con la misma forma que `setFormFieldValue`, incluida la derivación de clave por scope (`deriveScopedStateKey(formId, options?.scopeChain ?? EMPTY_INSTANCE_SCOPE)`) — sin esa derivación, dos iteraciones de un `repeater` compartirían coordenadas.
6. **Selector**: añadir a `runtime-state-selectors.ts` un selector de lectura del metadato sintético de un campo, siguiendo el estilo de los selectores de formulario ya presentes.

### Fuera de alcance
- No se escribe ninguna coordenada: ningún nodo usa todavía `synthetic` (lo hace T7).
- No se toca la resolución de referencias (T3/T4).
- No se cambia la forma del valor efectivo: `getFormFieldValue` sigue devolviendo `value` tal cual, sin envolverlo.
- No se añade `synthetic` al payload de submit ni a ninguna serialización: las coordenadas solo viajan si una operación las referencia explícitamente por `$lat`/`$lng`.

### Dependencias
Ninguna funcional sobre T1, pero se implementa después para mantener el orden del plan.

### Interfaces
**Consume:** ninguna firma de otra tarea.

**Produce:**
- Campo `synthetic?: Record<string, unknown>` en `RuntimeFormFieldState` — consumido por: T4, T7.
- Acción `{ type: 'forms/set-synthetic'; payload: { formId: string; fieldId: string; synthetic: Record<string, unknown> } }` — consumido por: T7 (a través de la fachada).
- `setFormFieldSynthetic(formId: string, fieldId: string, synthetic: Record<string, unknown>, options?: { scopeChain?: RuntimeInstanceScope }): void` — consumido por: T7, T9.
- `selectFormFieldSynthetic(state: RuntimeState, formId: string, fieldId: string): Record<string, unknown> | null` — consumido por: T4.

### Impacto esperado en archivos
- Código:
  - `src/runtime/runtime-state/runtime-state-types.ts` (modificación).
  - `src/runtime/runtime-state/runtime-state-reducer.ts` (modificación).
  - `src/runtime/runtime-state/runtime-state-selectors.ts` (modificación).
  - `src/runtime/runtime-state/use-runtime-state.ts` (modificación).
- Tests: `src/tests/runtime-state/runtime-state-forms-synthetic.test.tsx` (nuevo).
- Documentación afectada: ninguna en esta tarea; el comportamiento observable de `$lat`/`$lng` se documenta al cerrar T4/T5.

### Tests

#### Ficheros de test
- `src/tests/runtime-state/runtime-state-forms-synthetic.test.tsx` (nuevo)

#### Comportamiento cubierto
- Despachar `forms/set-synthetic` sobre un campo ya inicializado guarda las claves en `state.forms[formId][fieldId].synthetic` sin alterar `value`, `error`, `touched` ni `dirty`.
- Dos despachos sucesivos con claves distintas fusionan (no sustituyen) el objeto `synthetic`; un segundo despacho con la misma clave sobrescribe solo esa clave.
- `forms/set-value` posterior a `forms/set-synthetic` **conserva** `synthetic` intacto (requisito 10 de la spec: editar el texto no altera las coordenadas).
- `forms/set-error` posterior a `forms/set-synthetic` conserva `synthetic` intacto.
- `forms/reset` del formulario limpia `synthetic` junto con el resto del estado del campo.
- `forms/remove` del formulario elimina el formulario completo, incluido `synthetic`.
- `forms/set-synthetic` sobre un campo inexistente en store no crea el campo ni lanza (no-op verificable sobre el estado resultante).
- Un campo inicializado sin coordenadas tiene `synthetic` `undefined` (no un objeto vacío): ningún consumidor existente ve una clave nueva.
- `setFormFieldSynthetic` a través de la fachada escribe bajo la clave derivada por scope: dos llamadas con el mismo `formId`/`fieldId` y `scopeChain` distintos producen dos entradas independientes en el store, y ninguna pisa a la otra.
- Regresión: un formulario que nunca usa `synthetic` produce exactamente el mismo estado que antes del cambio para `initialize`, `set-value`, `set-error`, `reset` y `remove`.

#### Comandos durante la implementación
```
pnpm test --run src/tests/runtime-state/runtime-state-forms-synthetic.test.tsx
```

#### Restricciones
- Reutilizar el harness de estado ya establecido en la carpeta (`src/tests/runtime-state/helpers.tsx` y `read-runtime-state-snapshot.ts`) en vez de montar un provider a mano.
- No modificar los ficheros de test existentes de `runtime-state/`: la no-regresión se comprueba ejecutando la carpeta completa, no reescribiendo sus casos.
- Al cerrar la tarea, ejecutar además `pnpm test --run src/tests/runtime-state/` para confirmar que ningún test de formularios existente cambia de resultado.

### Documentación afectada
Ninguna en esta tarea.

### Criterios de finalización
- `RuntimeFormFieldState` admite metadatos sintéticos opcionales por campo, aislados por scope.
- Editar valor o error de un campo nunca destruye sus metadatos; resetear o desmontar el formulario sí.
- La carpeta `src/tests/runtime-state/` pasa entera sin regresiones.

### Cierre de implementación
Código y tests de la tarea completos, comandos de la tarea en verde y `src/tests/runtime-state/` sin regresiones.

---

## T3 — Sintaxis de referencia `forms.{formId}.{fieldId}.$lat` / `.$lng`

### Objetivo
Reconocer en `src/config/runtime-reference-syntax.ts` las dos formas sintéticas exactas de coordenadas como referencias soportadas, bajo opción explícita, manteniendo cerrada la navegación anidada general bajo `forms.*`.

Cambios exactos:

1. Añadir a `ParseRuntimeReferenceOptions` la opción `allowFormCoordinateReference?: boolean`, mismo estilo que `allowItemReference`/`allowRowReference`/`allowSwitchNextReference`.
2. Añadir las constantes de segmento sintético `FORM_LAT_SYNTHETIC_SEGMENT = '$lat'` y `FORM_LNG_SYNTHETIC_SEGMENT = '$lng'`, junto a las ya existentes (`ITEM_KEY_SYNTHETIC_SEGMENT`, etc.).
3. En `hasValidReferenceShape`, aceptar `namespace === 'forms' && path.length === 3 && (path[2] === '$lat' || path[2] === '$lng')` **antes** de la comprobación `REFERENCE_SEGMENT_PATTERN` (que rechaza `$`), exactamente en el mismo punto donde ya se tratan `item.$key`/`item.$index`/`row.$index`/`switch.next`. El resto del caso `forms` (`path.length === 2`) queda intacto.
4. `hasValidReferenceShape` necesita conocer la opción: propagar `options` a esa función (o resolver la forma sintética en `parseRuntimeReference` antes de llamarla). El criterio es: **sin** `allowFormCoordinateReference`, `forms.f.c.$lat` devuelve `status: 'invalid'` (exactamente lo que devuelve hoy); **con** la opción, `status: 'supported'` con `path: ['f', 'c', '$lat']`.
5. Formas que siguen siendo inválidas **incluso con la opción activa**, por ser variantes de la forma exacta: `forms.f.c.$lat.extra`, `forms.f.$lat`, `forms.f.c.$latitude`, `forms.f.c.$lng.0`, `forms.f.c.$other`, y cualquier `forms.{a}.{b}.{c}` con tercer segmento no sintético (la navegación anidada general bajo `forms.*` sigue cerrada).

### Fuera de alcance
- No se resuelve ningún valor: `runtime-references/` no se toca (T4).
- No se activa la opción en ninguna superficie de validación de config: T5 decide dónde se admite.
- No se abre navegación anidada general bajo `forms.*`.
- No se añade ninguna forma sintética adicional (`$accuracy`, `$address`…): solo las dos que pide la spec.

### Dependencias
T1 (orden del plan; no hay acoplamiento de código, pero los tests de T5 necesitan ambas).

### Interfaces
**Consume:**
- `parseRuntimeReference(value: string, options?: { allowItemReference?: boolean; allowRowReference?: boolean; allowSwitchNextReference?: boolean }): RuntimeReferenceParseResult` (contrato vigente que esta tarea amplía).

**Produce:**
- `parseRuntimeReference(value: string, options?: { allowItemReference?: boolean; allowRowReference?: boolean; allowSwitchNextReference?: boolean; allowFormCoordinateReference?: boolean }): RuntimeReferenceParseResult` — consumido por: T4, T5.

### Impacto esperado en archivos
- Código: `src/config/runtime-reference-syntax.ts` (modificación).
- Tests: `src/tests/config-validation/runtime-config-validation-address-picker-reference-syntax.test.ts` (nuevo), siguiendo el precedente de nombre y alcance de `runtime-config-validation-group-reference-syntax.test.ts`.
- Documentación afectada: ninguna en esta tarea; el catálogo de referencias se actualiza al cerrar T5, cuando la frontera de superficies ya existe.

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-address-picker-reference-syntax.test.ts` (nuevo)

#### Comportamiento cubierto
- Con `allowFormCoordinateReference: true`, `forms.contacto.direccion.$lat` parsea como `kind: 'reference'`, `status: 'supported'`, `namespace: 'forms'`, `path: ['contacto', 'direccion', '$lat']`. Caso simétrico con `$lng`.
- Sin la opción (opciones vacías), `forms.contacto.direccion.$lat` parsea como `status: 'invalid'`; mismo resultado con `$lng`.
- Con la opción activa siguen siendo `status: 'invalid'`: `forms.contacto.direccion.$lat.extra`, `forms.contacto.$lat`, `forms.contacto.direccion.$latitude`, `forms.contacto.direccion.$other`, `forms.contacto.direccion.otro` (tercer segmento no sintético).
- Con la opción activa, `forms.contacto.direccion` (dos segmentos) sigue parseando como `supported` con `path` de longitud 2: la forma clásica no cambia.
- Con la opción activa, `forms` a secas y `forms.contacto` siguen siendo `invalid`.
- El escape literal sigue funcionando: `\forms.contacto.direccion.$lat` devuelve `kind: 'literal'` con el valor sin la barra.
- Regresión: con la opción activa, `item.$key`, `item.$index`, `row.$index` y `switch.next` conservan exactamente el mismo resultado de parseo que sin ella (la opción nueva no interfiere con las demás formas sintéticas).
- Regresión: `queries.x.data.a.b`, `params.userId`, `tokens.t.value`, `t.clave` y `group.param` conservan su resultado de parseo con y sin la opción activa.

#### Comandos durante la implementación
```
pnpm test --run src/tests/config-validation/runtime-config-validation-address-picker-reference-syntax.test.ts
```

#### Restricciones
- Estos tests sí llaman directamente a `parseRuntimeReference`: es la superficie pública del módulo de sintaxis y el precedente `runtime-config-validation-group-reference-syntax.test.ts` hace exactamente eso.
- No añadir casos que dependan de un layout completo ni de `validateRuntimeConfig`: esta tarea valida gramática, no superficies (eso es T5).

### Documentación afectada
Ninguna en esta tarea.

### Criterios de finalización
- Las dos formas exactas parsean como soportadas solo bajo opción explícita.
- Todas las variantes cercanas siguen siendo inválidas.
- Ninguna otra familia de referencias cambia de comportamiento.

### Cierre de implementación
Código y tests de la tarea completos y comando de la tarea en verde.

---

## T4 — Resolución en runtime de `$lat` / `$lng` contra el estado del campo

### Objetivo
Resolver las dos referencias sintéticas contra `synthetic.lat`/`synthetic.lng` del registro de campo, con la misma política de dato ausente que el resto de referencias bien formadas sin valor.

Cambios exactos:

1. En `src/runtime/runtime-references/runtime-reference-resolver.ts`, activar la opción nueva en la llamada a `parseRuntimeReference` (junto a `allowItemReference`/`allowRowReference`/`allowSwitchNextReference`) con valor **constante `true`**: en runtime la referencia siempre es resoluble si hay dato; la frontera de superficies se cierra en bootstrap (T5), no aquí. Este criterio es deliberado y distinto del de `switch.next`, cuyo valor solo existe durante el click que lo produce.
2. En la rama `reference.namespace === 'forms'`, antes del retorno actual: si `reference.path.length === 3`, leer el metadato sintético del campo (misma resolución de clave por scope que ya usa la rama: `deriveScopedStateKey(formId, scope)` + `selectFormFieldState`) y devolver `{ found: true, value }` cuando la clave correspondiente (`lat` para `$lat`, `lng` para `$lng`) existe y es un número finito; en cualquier otro caso (campo ausente, `synthetic` ausente, clave ausente) devolver `{ found: false }`.
3. La rama de dos segmentos (`forms.{formId}.{fieldId}`) no cambia: sigue devolviendo `getFormFieldValue(...)`.

### Fuera de alcance
- No se escribe ninguna coordenada (T7).
- No se cambia la política de degradación de referencias no resolubles en ninguna superficie: `found: false` ya tiene tratamiento definido por consumidor (string vacío en superficies visibles, `request-build-failed` en payloads).
- No se habilita `$lat`/`$lng` en superficies visibles ni en `visibility`: eso lo impide T5 en bootstrap.

### Dependencias
T2 (necesita `synthetic` y su selector) y T3 (necesita que la forma parsee como soportada).

### Interfaces
**Consume:**
- `parseRuntimeReference(value: string, options?: { allowItemReference?: boolean; allowRowReference?: boolean; allowSwitchNextReference?: boolean; allowFormCoordinateReference?: boolean }): RuntimeReferenceParseResult` (de T3)
- `selectFormFieldSynthetic(state: RuntimeState, formId: string, fieldId: string): Record<string, unknown> | null` (de T2)

**Produce:** ninguna firma nueva exportada. El comportamiento ampliado de `resolveRuntimeReference` lo consumen T8 (a través de la construcción del request de la operación de geocodificación) y cualquier operación declarada por el usuario, pero la firma pública del resolver no cambia.

### Impacto esperado en archivos
- Código: `src/runtime/runtime-references/runtime-reference-resolver.ts` (modificación).
- Tests: `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación).
- Documentación afectada: `ai-workflow/docs/app-features/references/reference-resolution.md` — añadir `forms.{formId}.{fieldId}.$lat` y `.$lng` al catálogo de referencias soportadas y abrir su sección "Frontera específica". La frontera de superficies concretas se completa al cerrar T5; esta tarea documenta catálogo y semántica de resolución.

### Tests

#### Ficheros de test
- `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación)

#### Comportamiento cubierto
- Con un campo cuyo estado tiene `synthetic: { lat: 42.81, lng: -1.64 }`, `forms.contacto.direccion.$lat` resuelve a `42.81` y `.$lng` a `-1.64`, como números (no strings).
- Con el mismo campo, `forms.contacto.direccion` sigue resolviendo al texto del campo, sin verse afectado por la presencia de `synthetic`.
- Con un campo existente **sin** `synthetic`, `forms.contacto.direccion.$lat` se trata como dato ausente (misma aserción que ya usa el fichero para referencias bien formadas sin dato).
- Con un campo existente cuyo `synthetic` tiene solo `lat`, `.$lat` resuelve y `.$lng` se trata como dato ausente.
- Con un `formId` o `fieldId` inexistentes, `.$lat` se trata como dato ausente (no lanza).
- Con `synthetic.lat` no numérico o no finito (`'42'`, `NaN`, `null`), la referencia se trata como dato ausente: nunca se propaga un valor no numérico a un payload de coordenadas.
- Dentro de un scope de instancia (cadena de scope no vacía, caso `repeater`), `.$lat` resuelve las coordenadas de **esa** iteración: dos scopes distintos con coordenadas distintas resuelven valores distintos, y el scope vacío no ve ninguna de las dos.
- Regresión: los casos ya existentes del fichero para `forms.*`, `queries.*`, `params.*`, `item.*`, `row.*` y `switch.next` siguen pasando sin modificación.

#### Comandos durante la implementación
```
pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx
```

#### Restricciones
- Añadir los casos nuevos en un `describe` propio (por ejemplo `'forms.*.$lat / $lng synthetic references'`) sin reordenar ni modificar los bloques existentes.
- Reutilizar los builders de estado ya presentes en el fichero para construir el campo con `synthetic`; no introducir un harness paralelo.
- No añadir en este fichero ningún caso de bootstrap ni de superficie admitida (pertenecen a T5).

### Documentación afectada
- `ai-workflow/docs/app-features/references/reference-resolution.md` (catálogo + semántica de resolución y degradación de las dos formas nuevas).

### Criterios de finalización
- Las dos referencias resuelven el dato correcto por scope y degradan a ausente en todos los casos sin dato o con dato no numérico.
- El valor efectivo del campo sigue resolviendo igual que antes.

### Cierre de implementación
Código y tests de la tarea completos, comando de la tarea en verde y sin regresiones en `src/tests/runtime/runtime-reference-resolution.test.tsx`.

---

## T5 — Frontera de bootstrap: dónde se admite `$lat` / `$lng`

### Objetivo
Cerrar en validación previa al render qué superficies admiten las referencias de coordenadas y contra qué campos, con una pasada post-validación sobre el árbol ya tipado.

Cambios exactos:

1. **Nuevo módulo** `src/config/validate-address-picker-references.ts`, modelado sobre `src/config/validate-row-visibility-scope.ts` (mismo estilo de pasada independiente, mismo estilo de error), que exporte:
   ```ts
   export function validateAddressPickerReferences(
     config: RuntimeConfig,
   ): { status: 'error'; error: RuntimeConfigError } | null
   ```
2. **Índice**: recorrer `config.pages[*].layout` construyendo `Map<formId, Map<fieldId, LayoutNodeType>>` para todos los `form` de la configuración (`form.id` es único en toda la config, así que el índice es global y sirve también para referencias declaradas en `api.*`, que no cuelgan de ningún árbol de página). El índice debe recorrer el mismo conjunto de contenedores que ya atraviesa la validación de formularios: `container`, `accordion`, `tabs`/`steps` (`props.items[i].children`), `repeater.props.template`, `modal`, `group`, `link`, y los `fallback` de `queryStateFeedback`.
3. **Superficies admitidas** (una referencia `$lat`/`$lng` bien formada es válida aquí): `api.{op}.query` y `api.{op}.body`, `button.props.action.query`/`body` y `operations[].query`/`body`, `form.submitAction.query`/`body` y `operations[].query`/`body`. En estas superficies se parsea con `allowFormCoordinateReference: true`.
4. **Superficies no admitidas** (cualquier `forms.*.$lat`/`.$lng` se rechaza): cualquier superficie visible o interpolable, `defaultValue` de cualquier campo, `visibility.reference` y `when.reference`, orígenes de colección, y todas las superficies de `headers`. En ellas se parsea sin la opción, con lo que la forma cae en `status: 'invalid'` y el rechazo lo produce la validación ya existente de cada superficie — no hace falta código nuevo por superficie, pero **sí** un test por familia que lo demuestre.
5. **Comprobación semántica** en las superficies admitidas, con dos errores distintos y mensajes propios:
   - `formId` inexistente, o `fieldId` inexistente dentro de ese `form`: `invalid-layout` con la ruta exacta de la clave del payload.
   - `fieldId` existente pero cuyo nodo **no** es de tipo `addressPicker`: `invalid-layout` con la ruta exacta, y mensaje que nombre explícitamente que solo un `addressPicker` expone coordenadas.
6. **Integración** en `src/config/validate-runtime-config.ts`: llamar a `validateAddressPickerReferences(config)` en el mismo bloque de pasadas cruzadas donde ya se llama a `validateRowVisibilityScope`, propagando el error tal cual si lo devuelve.

### Fuera de alcance
- No se toca `validate-form-semantics.ts`: su recorrido en streaming no puede decidir esta regla (ver "Corrección verificada sobre el design").
- No se amplía `parseRuntimeReference` (ya lo hizo T3).
- No se habilitan `$lat`/`$lng` en `headers` ni en `visibility`: decisión explícita del design, verificada por tests de rechazo.
- No se valida que la operación referenciada por `props.geocodeOperation` use realmente las coordenadas: un `addressPicker` cuya operación no referencia `$lat`/`$lng` es un config válido (aunque poco útil), igual que hoy un `autocomplete` puede tener una operación que no referencia su texto.
- No se toca `src/queries/runtime-api-payload-resolver.ts`. Ese módulo decide la omisión de campos ocultos y la sustitución por `emptySubmitValue` comprobando `reference.namespace === 'forms' && reference.path.length === 2` en varios puntos; una referencia de coordenadas tiene `path.length === 3` y queda fuera de ambas mecánicas **por construcción**, que es justo el comportamiento correcto (las coordenadas no son un campo omitible ni sustituible). No hay nada que cambiar ahí; el comportamiento se verifica end-to-end en T8, no aquí.

### Dependencias
T1 (necesita el tipo `'addressPicker'` para distinguirlo en el índice) y T3 (necesita la opción de parseo).

### Interfaces
**Consume:**
- `parseRuntimeReference(value: string, options?: { allowItemReference?: boolean; allowRowReference?: boolean; allowSwitchNextReference?: boolean; allowFormCoordinateReference?: boolean }): RuntimeReferenceParseResult` (de T3)
- Literal de tipo `'addressPicker'` dentro de `LayoutNodeType` (de T1)
- `invalidLayout(mensaje: string): { status: 'error'; error: RuntimeConfigError }` desde `./runtime-config-validation-errors` (contrato vigente, ya usado por `validate-row-visibility-scope.ts`; si su firma real difiere, prevalece la del módulo).

**Produce:**
- `validateAddressPickerReferences(config: RuntimeConfig): { status: 'error'; error: RuntimeConfigError } | null` — consumido por: `validateRuntimeConfig` (integración en la misma tarea), sin consumidores en tareas posteriores.

### Impacto esperado en archivos
- Código:
  - `src/config/validate-address-picker-references.ts` (nuevo).
  - `src/config/validate-runtime-config.ts` (modificación: importación + llamada en el bloque de pasadas cruzadas).
- Tests: `src/tests/config-validation/runtime-config-validation-address-picker-references.test.ts` (nuevo).
- Documentación afectada:
  - `ai-workflow/docs/app-features/references/reference-resolution.md` (completar la "Frontera específica" abierta en T4 con la lista exacta de superficies admitidas y rechazadas).
  - `ai-workflow/docs/app-features/config/validation.md` (regla nueva de bootstrap: `$lat`/`$lng` solo sobre un `fieldId` de tipo `addressPicker` del `form` indicado, y solo en superficies de payload).

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-address-picker-references.test.ts` (nuevo)

#### Comportamiento cubierto
- Una operación `api` cuyo `body` referencia `forms.contacto.direccion.$lat` y `.$lng`, con un `addressPicker` de `fieldId: 'direccion'` dentro del `form` `contacto`, se acepta en bootstrap. Caso simétrico con `query`.
- La misma referencia en `form.submitAction.body` del propio formulario se acepta; en `form.submitAction.operations[i].body` (plural) también.
- La misma referencia en `button.props.action.body` de un botón que vive **fuera** del formulario se acepta (la validez depende del campo referenciado, no de dónde viva el consumidor); igual en `button.props.action.operations[i].query`.
- `forms.contacto.noExiste.$lat` se rechaza con `invalid-layout` y ruta exacta de la clave del payload.
- `forms.noExiste.direccion.$lat` se rechaza con ruta exacta.
- `forms.contacto.nombre.$lat`, donde `nombre` es un `input` del mismo `form`, se rechaza con ruta exacta y mensaje que nombra el requisito de `addressPicker`. Caso simétrico con un `autocomplete` y con un `select`.
- Un `addressPicker` declarado dentro de un `repeater.props.template` dentro del `form` se indexa correctamente: una referencia a su `fieldId` se acepta. Igual para uno declarado dentro de `tabs.props.items[i].children`, dentro de `steps.props.items[i].children` y dentro de un `container` anidado.
- Rechazo por superficie no admitida, un caso por familia, todos con ruta exacta: `heading.props.text` con la referencia como valor completo; `input.props.defaultValue`; `visibility.reference`; `api.{op}.headers`; `form.submitAction.headers`; `repeater.props.items.source`.
- Variantes de forma inválida siguen rechazándose también en superficie admitida: `forms.contacto.direccion.$lat.extra` y `forms.contacto.direccion.$other` en `api.body`.
- Regresión: una operación cuyo `body` referencia `forms.contacto.direccion` (sin sufijo sintético) se sigue aceptando exactamente igual, apunte a un `addressPicker` o a cualquier otro campo.
- Regresión: un config sin ninguna referencia `$lat`/`$lng` y sin ningún `addressPicker` valida igual que antes (caso de control que ejercita la pasada nueva sin materia).

#### Comandos durante la implementación
```
pnpm test --run src/tests/config-validation/runtime-config-validation-address-picker-references.test.ts
```

#### Restricciones
- Las aserciones van contra `validateRuntimeConfig`, no contra `validateAddressPickerReferences` directamente, para ejercitar también el orden de integración con las demás pasadas cruzadas.
- Fijar el mensaje literal del error de "campo no es `addressPicker`" en el test, para bloquear regresiones de wording; el resto de casos puede aserir sobre código y ruta.
- Reutilizar los builders de `src/tests/config-validation/helpers.ts`.

### Documentación afectada
- `ai-workflow/docs/app-features/references/reference-resolution.md`
- `ai-workflow/docs/app-features/config/validation.md`

### Criterios de finalización
- `$lat`/`$lng` solo se aceptan en superficies de payload y solo sobre campos `addressPicker` existentes.
- Cada familia de superficie no admitida tiene un test que demuestra el rechazo.
- La pasada está integrada en `validateRuntimeConfig`.

### Cierre de implementación
Código y tests de la tarea completos, comando de la tarea en verde y carpeta `src/tests/config-validation/` sin regresiones.

---

## T6 — Extraer la base de mapa reutilizable de `MapNode`

### Objetivo
Extraer el contenedor común de mapa (import del CSS de Leaflet, `MapContainer`, `TileLayer` de OpenStreetMap y resolución de altura/centro/zoom por defecto) a un módulo compartido, y reescribir `MapNode` sobre él **sin ningún cambio de comportamiento observable**, para que T7 no duplique ese esqueleto ni el side-effect del CSS.

Cambios exactos:

1. **Nuevo módulo** `src/runtime/nodes/map-shell.tsx` que contenga el `import 'leaflet/dist/leaflet.css'` como side-effect y exporte:
   ```ts
   export function MapShell({ center, zoom, height, className, children }: MapShellProps): JSX.Element
   ```
   con `MapShellProps = { center?: { lat: number; lng: number }; zoom?: number; height?: MapHeight; className?: string; children?: ReactNode }`. Aplica los mismos defaults que hoy tiene `MapNode` (`DEFAULT_MAP_CENTER = { lat: 42.8125, lng: -1.6458 }`, `DEFAULT_MAP_ZOOM = 13`, `DEFAULT_MAP_HEIGHT = 'md'`), resuelve la clase de altura con `getMapHeightClassName` y renderiza `<MapContainer center={[lat, lng]} zoom={zoom} className={...}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution=... />{children}</MapContainer>`, conservando literalmente la URL y el `attribution` actuales y la composición de clase `w-full {heightClass}`.
2. **Reescribir** `src/runtime/nodes/map-layout-node.tsx` para renderizar `<MapShell center={...} zoom={...} height={...}>` con sus marcadores como `children`, eliminando de ese fichero el import del CSS, las tres constantes de default y el `MapContainer`/`TileLayer` inline. La lógica de marcadores (estáticos, `markerSources`, paleta cíclica, popups) **no se toca**.
3. **No** cambiar el registro de `map` en `src/runtime/nodes/node-components-map.ts`: `map-layout-node.tsx` sigue siendo el módulo diferido y ahora arrastra `map-shell.tsx` como dependencia estática suya, manteniendo el CSS y Leaflet dentro del chunk diferido.

### Fuera de alcance
- No se añade ninguna capacidad nueva al mapa (marcador clicable, eventos, `invalidateSize`): eso llega en T7 como responsabilidad del nodo nuevo, no de la base compartida.
- No se cambia la política de code-splitting ni `vite.config.ts`.
- No se modifica `runtime-node-styling-map.ts` ni la resolución de iconos.
- No se cambia ningún comportamiento observable de `map`: esta tarea debe pasar con los tests existentes de `map` **sin modificarlos**.

### Dependencias
Ninguna funcional; se ordena aquí porque T7 la consume.

### Interfaces
**Consume:**
- `getMapHeightClassName(height: MapHeight): string` (contrato vigente en `src/runtime/runtime-node-styling-map.ts`).

**Produce:**
- `MapShell(props: { center?: { lat: number; lng: number }; zoom?: number; height?: MapHeight; className?: string; children?: ReactNode }): JSX.Element` — consumido por: T7 (y por `MapNode` en esta misma tarea).

### Impacto esperado en archivos
- Código:
  - `src/runtime/nodes/map-shell.tsx` (nuevo).
  - `src/runtime/nodes/map-layout-node.tsx` (modificación: refactor sobre `MapShell`).
- Tests: ninguno nuevo. Se verifica con los existentes `src/tests/layout-renderer/layout-renderer-map.test.tsx`, `src/tests/runtime/runtime-map-marker-sources.test.ts`, `src/tests/runtime/runtime-node-styling-map.test.ts` y `src/tests/dev-runtime/runtime-nodes-bundle.test.ts`, sin modificarlos.
- Documentación afectada: ninguna. Es un refactor interno sin cambio de contrato ni de comportamiento observable; `map.md` sigue siendo exacto salvo la mención al fichero donde vive el `import` del CSS, que no es contrato de producto.

### Tests

#### Ficheros de test
- Ninguno nuevo. Cubierto por: `src/tests/layout-renderer/layout-renderer-map.test.tsx`, `src/tests/runtime/runtime-map-marker-sources.test.ts`, `src/tests/runtime/runtime-node-styling-map.test.ts` y `src/tests/dev-runtime/runtime-nodes-bundle.test.ts` (suites existentes, sin modificar).

#### Comportamiento cubierto
- Refactor puro: el comportamiento cubierto es exactamente el que ya cubren las suites existentes de `map` (centro/zoom/altura por defecto y explícitos, marcadores estáticos, `markerSources` con paleta cíclica, popups, aislamiento de bundle de Leaflet). El criterio de éxito es que **todas pasen sin ninguna edición**.
- Si alguna de esas suites obliga a editarse para pasar, el refactor ha cambiado comportamiento observable y debe corregirse la implementación, no el test.

#### Comandos durante la implementación
```
pnpm test --run src/tests/layout-renderer/layout-renderer-map.test.tsx
pnpm test --run src/tests/runtime/runtime-map-marker-sources.test.ts
pnpm test --run src/tests/runtime/runtime-node-styling-map.test.ts
pnpm test --run src/tests/dev-runtime/runtime-nodes-bundle.test.ts
```

#### Restricciones
- Prohibido modificar cualquiera de los cuatro ficheros de test listados: son el contrato de no-regresión de esta tarea.
- El `import 'leaflet/dist/leaflet.css'` debe quedar en **un solo** módulo (`map-shell.tsx`), no repetido en los dos nodos.
- No añadir props a `MapShell` que ningún consumidor use todavía ("por si acaso" para T7): si T7 necesita algo más, lo añade T7.

### Documentación afectada
Ninguna.

### Criterios de finalización
- `MapShell` existe y es el único lugar con el esqueleto de mapa y el CSS de Leaflet.
- `MapNode` se apoya en él y las cuatro suites listadas pasan sin editarse.

### Cierre de implementación
Refactor completo, los cuatro comandos en verde y ningún test modificado.

---

## T7 — Nodo `AddressPickerNode`: mapa clicable, marcador y campo de texto

### Objetivo
Renderizar el nodo de punta a punta con sus dos interacciones locales: click en el mapa que coloca/mueve el marcador y fija las coordenadas en el estado del campo, y campo de texto editable que escribe el valor efectivo del campo. Sin geocodificación todavía.

Cambios exactos:

1. **Componente** `src/runtime/nodes/address-picker-layout-node.tsx` que renderice, dentro de un contenedor con utilidades de Tailwind y tokens globales:
   - `<MapShell center zoom height>` (de T6) con un `<Marker>` en la posición actual **solo si hay coordenadas fijadas**; sin coordenadas, ningún marcador.
   - Un manejador de click sobre el mapa que, al pulsar un punto, fija `{ lat, lng }` en el estado sintético del campo vía `setFormFieldSynthetic(formId, fieldId, { lat, lng }, { scopeChain })`. El click se captura con el mecanismo de eventos de `react-leaflet` (componente hijo con `useMapEvents`), no con listeners manuales sobre el DOM.
   - Un `<label htmlFor>` asociado a un `<input type="text">` cuyo valor es `forms.{formId}.{fieldId}` y cuyo `onChange` llama a `setFormFieldValue`, exactamente igual que `input` textual.
   - El error de validación del campo, renderizado con el mismo patrón y `aria-describedby` que usan los demás campos del catálogo.
2. **Punto único de cambio de posición**: toda escritura de coordenadas del nodo pasa por **una sola función interna** (p. ej. `applyMarkerPosition({ lat, lng })`) que el click invoca. T8 colgará el disparo de geocodificación de ese mismo punto y T9 entregará ahí sus coordenadas; no debe existir un segundo camino de escritura de coordenadas.
3. **Registro**: añadir `addressPicker` a `src/runtime/nodes/node-components-map.ts` con el mismo patrón dual que `map` (entrada en `eagerMap` con import estático, y en `lazyMap` con `React.lazy(() => import('./address-picker-layout-node').then((m) => ({ default: m.AddressPickerNode })))`), y añadir el `case 'addressPicker':` en el dispatcher `src/runtime/layout-node-renderer.tsx`, junto a los casos ya existentes de `map` y `autocomplete`.
4. **Ciclo de vida de campo**: el nodo participa como campo estándar (inicialización lazy con `defaultValue`, `required`, inclusión/omisión de payload por visibilidad). `defaultValue` siembra **solo el texto**; nunca coordenadas.

### Fuera de alcance
- No se ejecuta ninguna operación `api` (T8): al clicar, solo se fijan coordenadas y se pinta el marcador.
- No hay botón de geolocalización (T9).
- No hay estado de carga ni error de geocodificación (T8).
- No se permite arrastrar el marcador: solo click en el mapa.
- No se añade soporte en `dev-editor`.
- No se llama a `invalidateSize()` ante remounts: mismo límite v1 ya aceptado por `map`.

### Dependencias
T1 (tipo y contrato), T2 (estado sintético y su fachada), T6 (`MapShell`).

### Interfaces
**Consume:**
- Tipo `AddressPickerLayoutNode` con `props: { fieldId: string; label: string; geocodeOperation: string; addressPath: string; center?: { lat: number; lng: number }; zoom?: number; height?: MapHeight; defaultValue?: unknown; validations?: RuntimeFieldValidations }` (de T1)
- `setFormFieldSynthetic(formId: string, fieldId: string, synthetic: Record<string, unknown>, options?: { scopeChain?: RuntimeInstanceScope }): void` (de T2)
- `MapShell(props: { center?: { lat: number; lng: number }; zoom?: number; height?: MapHeight; className?: string; children?: ReactNode }): JSX.Element` (de T6)

**Produce:**
- `AddressPickerNode(props: { node: AddressPickerLayoutNode; formId: string; iterationContext?: RuntimeIterationContext; scopeChain?: RuntimeInstanceScope }): JSX.Element` — consumido por: T8 y T9, que amplían este mismo componente. La forma exacta de las props de contexto (`formId`, `scopeChain`, `iterationContext`) debe replicar la que el dispatcher ya pasa a los demás nodos de formulario; si difiere, prevalece la del dispatcher real.
- Punto interno único de cambio de posición del marcador — consumido por: T8 (cuelga el disparo) y T9 (entrega coordenadas).

### Impacto esperado en archivos
- Código:
  - `src/runtime/nodes/address-picker-layout-node.tsx` (nuevo).
  - `src/runtime/nodes/node-components-map.ts` (modificación: registro eager/lazy).
  - Dispatcher central de render de nodos (modificación: rama del tipo nuevo; el fichero exacto es el que ya despacha `map`/`autocomplete`).
- Tests: `src/tests/layout-renderer/layout-renderer-address-picker.test.tsx` (nuevo).
- Documentación afectada: ninguna todavía. La ficha se escribe al cerrar T9, cuando el nodo tiene su comportamiento completo; documentarlo en tres pasadas parciales produciría una ficha que describe estados intermedios que nunca se entregan.

### Tests

#### Ficheros de test
- `src/tests/layout-renderer/layout-renderer-address-picker.test.tsx` (nuevo)

#### Comportamiento cubierto
- Un `form` con un `addressPicker` renderiza un mapa, un label asociado por `htmlFor`/`id` y un campo de texto; el campo de texto empieza vacío si no hay `defaultValue`.
- Sin coordenadas fijadas, no se renderiza ningún marcador.
- Un click en el mapa renderiza un marcador en ese punto y deja `synthetic.lat`/`synthetic.lng` del campo con las coordenadas del punto pulsado, verificado sobre el estado del runtime.
- Un segundo click en otro punto **mueve** el marcador (sigue habiendo exactamente un marcador) y actualiza las coordenadas.
- Un click en el mapa **no** modifica el texto del campo (la geocodificación no existe todavía en esta tarea).
- Escribir en el campo de texto actualiza `forms.{formId}.{fieldId}` con cada carácter, igual que un `input`.
- Escribir en el campo de texto tras haber clicado **no** altera `synthetic.lat`/`synthetic.lng` ni mueve el marcador (requisito 10 de la spec).
- `props.defaultValue` literal siembra el texto inicial del campo y **no** crea coordenadas ni marcador.
- `props.validations.required` con texto vacío bloquea el submit y muestra el mensaje de error asociado al campo; con texto no vacío, el submit procede.
- El valor del campo viaja al payload de submit como texto cuando `submitAction.body` lo referencia con `forms.{formId}.{fieldId}`, igual que cualquier campo de texto.
- `props.center`/`props.zoom`/`props.height` declarados se aplican al mapa; ausentes, se usan los defaults compartidos (mismo criterio que `map`).
- Dentro de un `repeater` de dos iteraciones, clicar en el mapa de la primera iteración fija coordenadas solo en esa iteración: la segunda conserva su estado independiente (sin marcador y sin coordenadas).
- El nodo aparece registrado en el mapa de componentes con el mismo patrón dual que el resto del catálogo (caso análogo al que ya cubre `src/tests/runtime/runtime-node-components-map.test.tsx` para otros nodos diferidos).

#### Comandos durante la implementación
```
pnpm test --run src/tests/layout-renderer/layout-renderer-address-picker.test.tsx
```

#### Restricciones
- Reutilizar el harness de render de formularios ya establecido en `src/tests/layout-renderer/` (el mismo que usan `layout-renderer-forms-fields.test.tsx` y `layout-renderer-autocomplete.test.tsx`); no montar un provider propio.
- Para simular clicks en el mapa, reutilizar el enfoque de `src/tests/layout-renderer/layout-renderer-map.test.tsx`, que mockea `react-leaflet` con `vi.mock`: extender ese mismo estilo de mock para exponer el evento de click del mapa, en vez de introducir una segunda estrategia de doble para la librería.
- No añadir snapshots del nodo completo.
- No añadir aquí ningún caso con `executeQueryOperation` ni con `navigator.geolocation`.

### Documentación afectada
Ninguna en esta tarea.

### Criterios de finalización
- El nodo se renderiza a través del renderer central y se comporta como campo de formulario estándar.
- El click en el mapa es el único camino que fija coordenadas, y nunca toca el texto.
- El texto es editable sin afectar a las coordenadas.

### Cierre de implementación
Código y tests de la tarea completos, comando de la tarea en verde y sin regresiones en `src/tests/layout-renderer/`.

---

## T8 — Disparo centralizado de la geocodificación inversa

### Objetivo
Ejecutar la operación `props.geocodeOperation` como reacción única al cambio de posición del marcador, aplicar su resultado al texto del campo con control de frescura, y reflejar carga y error inline.

Cambios exactos:

1. **Nuevo módulo** `src/runtime/runtime-geocode-trigger.ts`, modelado sobre `src/runtime/runtime-search-trigger.ts` (vive fuera de `runtime-actions/` por el mismo motivo: no traduce una acción declarada en el config), que exporte un hook:
   ```ts
   export function useAddressGeocodeTrigger(params: UseAddressGeocodeTriggerParams): UseAddressGeocodeTriggerResult
   ```
   con `UseAddressGeocodeTriggerParams = { operationName: string; position: { lat: number; lng: number } | null; iterationContext?: RuntimeIterationContext }` y `UseAddressGeocodeTriggerResult = { status: 'idle' | 'loading' | 'success' | 'error'; lastFiredRequestSignature: string | null }`.
   - Dispara `executeQueryOperation(operationName, { iterationContext })` cada vez que `position` cambia a un valor no nulo (comparando por valor `lat`/`lng`, no por identidad de objeto, para no redisparar en cada render).
   - **Sin debounce**: a diferencia de `autocomplete`, el disparo no viene de tecleo sino de un gesto discreto.
   - No pasa `requestParams`: las coordenadas viajan por las referencias `$lat`/`$lng` que la operación declare en su `body`/`query` (requisito 13 de la spec: no existe un mecanismo de transporte paralelo). Esto exige que el estado sintético del campo ya esté escrito **antes** de disparar; el orden lo garantiza T7, que escribe las coordenadas y solo entonces cambia `position`.
   - Tras resolver, registra la `requestSignature` vigente leyéndola con `readRuntimeState()`, con el mismo criterio y por la misma razón de carrera que documenta `runtime-search-trigger.ts`.
2. **Aplicación del resultado** en `address-picker-layout-node.tsx`: cuando la query de `geocodeOperation` está en `success` y su `requestSignature` global coincide con la última disparada por esta instancia, extraer el texto navegando `props.addressPath` sobre `queries.{geocodeOperation}.data` y escribirlo en el campo con `setFormFieldValue`. Si la ruta no resuelve a un escalar textual, tratarlo como resultado sin dirección: **no** sobrescribir el texto y mostrar el error inline (requisito 16 y caso límite "fuera de cobertura").
3. **Estado de carga**: mientras la geocodificación está en curso, el campo de texto se muestra deshabilitado con un indicador visual; el resto del formulario sigue operativo.
4. **Error inline**: si la query termina en `error`, mostrar un mensaje inline asociado al campo, con el mismo patrón visual y de accesibilidad que el error de validación, sin sobrescribir el texto y sin bloquear el resto del formulario. El usuario puede seguir editando el texto y seguir clicando en el mapa inmediatamente después.
5. **Frescura**: un resultado cuya `requestSignature` no coincide con la última disparada por esta instancia se ignora por completo (ni texto, ni error), mismo criterio ya aceptado y documentado para `autocomplete`.

### Fuera de alcance
- No hay botón de geolocalización (T9).
- No se implementa cancelación real de peticiones ni `AbortController`: la política es descarte de respuestas obsoletas por `requestSignature`, tal como fija el design.
- No se añade caché ni reintentos propios más allá del comportamiento estándar de `queries.*`.
- No se toca `src/queries/`: el nodo no construye `fetch`, URLs ni `RequestInit`.
- No se implementa geocodificación directa (texto → coordenadas) en ningún caso.

### Dependencias
T7 (necesita el nodo y su punto único de cambio de posición) y T4 (sin la resolución de `$lat`/`$lng`, el `body` de la operación no llevaría coordenadas).

### Interfaces
**Consume:**
- `AddressPickerNode(props: { node: AddressPickerLayoutNode; formId: string; iterationContext?: RuntimeIterationContext; scopeChain?: RuntimeInstanceScope }): JSX.Element` (de T7)
- `executeQueryOperation(operationName: string, options?: { fetch?: typeof fetch; snapshotState?: RuntimeState; requestParams?: RuntimeApiRequestParams; iterationContext?: RuntimeIterationContext; switchNextValue?: boolean; hiddenFormFields?: RuntimeApiHiddenFormFields; emptySubmitValues?: RuntimeApiEmptySubmitValues; fileInputSources?: RuntimeApiFileInputSources })` desde `useRuntimeStateActions()` (contrato vigente).
- `selectQueryRequestSignature(state: RuntimeState, queryName: string): string | null` (contrato vigente, ya usado por `runtime-search-trigger.ts`).

**Produce:**
- `useAddressGeocodeTrigger(params: { operationName: string; position: { lat: number; lng: number } | null; iterationContext?: RuntimeIterationContext }): { status: 'idle' | 'loading' | 'success' | 'error'; lastFiredRequestSignature: string | null }` — consumido por: `address-picker-layout-node.tsx` en esta misma tarea; T9 no lo llama directamente, entrega coordenadas al punto de T7 y el disparo ocurre por reacción.

### Impacto esperado en archivos
- Código:
  - `src/runtime/runtime-geocode-trigger.ts` (nuevo).
  - `src/runtime/nodes/address-picker-layout-node.tsx` (modificación: consumo del hook, aplicación del resultado, estados de carga y error).
- Tests:
  - `src/tests/runtime/runtime-geocode-trigger.test.tsx` (nuevo).
  - `src/tests/layout-renderer/layout-renderer-address-picker.test.tsx` (ampliación: casos end-to-end de texto, carga y error).
- Documentación afectada:
  - `ai-workflow/docs/app-features/queries/execution.md` (nueva superficie de disparo de operaciones, la quinta, junto a `preloads`, botón, submit y `autocomplete`).

### Tests

#### Ficheros de test
- `src/tests/runtime/runtime-geocode-trigger.test.tsx` (nuevo)
- `src/tests/layout-renderer/layout-renderer-address-picker.test.tsx` (ampliación)

#### Comportamiento cubierto

En `src/tests/runtime/runtime-geocode-trigger.test.tsx` (unidad del hook):
- Con `position: null`, el hook no dispara ninguna ejecución.
- Al pasar `position` de `null` a `{ lat, lng }`, el hook llama a `executeQueryOperation` exactamente una vez con el `operationName` recibido.
- Un rerender con un objeto `position` nuevo pero de **mismos** valores `lat`/`lng` no vuelve a disparar (comparación por valor, no por identidad).
- Un cambio de `position` a coordenadas distintas dispara de nuevo.
- El hook no pasa `requestParams` a `executeQueryOperation` (las coordenadas viajan por referencias declarativas).
- Tras resolver, `lastFiredRequestSignature` refleja la `requestSignature` vigente de esa query.
- Dos disparos sucesivos rápidos dejan `lastFiredRequestSignature` con la firma del **último** disparo.
- El hook expone `status: 'loading'` mientras la ejecución está en curso y `'error'` cuando la query termina en error.

En `src/tests/layout-renderer/layout-renderer-address-picker.test.tsx` (end-to-end, con fetch mockeado):
- Click en el mapa con una `geocodeOperation` configurada cuyo `body` referencia `forms.{formId}.{fieldId}.$lat`/`.$lng`: la petición efectiva emitida lleva las coordenadas del punto pulsado en el body (verificado sobre el mock de `fetch`). Este es el criterio de aceptación central de la spec.
- Al resolver esa operación con éxito, el campo de texto muestra el valor extraído por `props.addressPath` del `data` devuelto (incluido un `addressPath` anidado con varios segmentos).
- Mientras la operación está en curso, el campo de texto está deshabilitado o muestra indicador de carga, y otro campo del mismo formulario sigue siendo editable.
- Si la operación termina en error de red o HTTP, aparece un error inline asociado al campo, el texto previo del campo **no** se sobrescribe, y el mapa y el resto del formulario siguen usables (un click posterior vuelve a disparar).
- Si la respuesta es válida pero `props.addressPath` no resuelve a texto (caso "fuera de cobertura"), el texto no se sobrescribe y se muestra el error inline.
- Tras un error de geocodificación, el usuario puede seguir escribiendo en el campo de texto libremente (caso límite de la spec).
- Clicks rápidos sucesivos en dos puntos: solo el resultado correspondiente al último click se aplica al texto; una respuesta obsoleta que llega después no pisa el texto ya aplicado.
- Editar el texto a mano no dispara ninguna ejecución de la operación (no hay geocodificación directa).
- Submit de un formulario cuyo `submitAction.body` referencia `forms.{formId}.{fieldId}.$lat`/`.$lng` de un `addressPicker` **oculto por `visibility`**: las claves de coordenadas **no** se omiten del payload (la omisión de campos ocultos solo aplica a referencias de dos segmentos) y no producen `request-build-failed` por esa vía. Si el `addressPicker` nunca fijó posición, esas claves sí fallan como cualquier referencia sin dato, con la semántica estándar de `request-build-failed`.
- Regresión: los casos de T7 (marcador, texto, `required`, `repeater`) siguen pasando.

#### Comandos durante la implementación
```
pnpm test --run src/tests/runtime/runtime-geocode-trigger.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-address-picker.test.tsx
```

#### Restricciones
- Reutilizar el patrón de mock de `fetch` y de aserción sobre el request efectivo ya establecido en `src/tests/runtime/runtime-api-execution.test.ts` y en los tests de submit; no inventar un doble de red nuevo.
- El test de frescura debe controlar el orden de resolución de las dos respuestas de forma determinista (promesas resueltas manualmente), no con temporizadores reales.
- No usar `vi.useFakeTimers` para simular debounce: este disparo no tiene debounce.
- No aserir sobre detalles visuales del indicador de carga más allá de su efecto observable (campo deshabilitado o indicador accesible presente).

### Documentación afectada
- `ai-workflow/docs/app-features/queries/execution.md`

### Criterios de finalización
- Un cambio de posición del marcador es el único disparador de la geocodificación.
- El resultado fresco actualiza el texto; el obsoleto se descarta; el error se muestra inline sin romper nada.
- El nodo no construye red por su cuenta en ningún camino.

### Cierre de implementación
Código y tests de la tarea completos, ambos comandos en verde y sin regresiones en `src/tests/layout-renderer/` ni `src/tests/runtime/`.

---

## T9 — Botón de geolocalización del navegador

### Objetivo
Añadir el botón que pide la posición al navegador y entrega esas coordenadas al mismo punto de cambio de posición que usa el click del mapa, con error inline propio cuando el permiso se deniega o la API no está disponible.

Cambios exactos:

1. **Nuevo hook** `src/runtime/use-browser-geolocation.ts` que encapsule `navigator.geolocation.getCurrentPosition` y exponga:
   ```ts
   export function useBrowserGeolocation(): { request: () => void; status: 'idle' | 'requesting' | 'error'; position: { lat: number; lng: number } | null }
   ```
   - Éxito: expone `{ lat, lng }` de `coords` y vuelve a `status: 'idle'`.
   - `PERMISSION_DENIED`, `POSITION_UNAVAILABLE`, `TIMEOUT` y ausencia de `navigator.geolocation`: todos producen `status: 'error'` con el **mismo** tratamiento de UI, sin distinguir causa (decisión explícita del design).
   - Pasa un `timeout` finito a `getCurrentPosition` para que el botón no quede bloqueado indefinidamente si el diálogo de permiso nunca se responde (caso límite de la spec).
   - No pasa por `src/queries/`: es una API del navegador, no red.
2. **Botón** en `address-picker-layout-node.tsx`, con texto accesible, que llama a `request()`. Cuando el hook entrega una posición, el nodo la aplica **por el mismo punto interno único de cambio de posición** que usa el click del mapa (T7): coloca/mueve el marcador y, por reacción, dispara la geocodificación de T8. El botón nunca llama a `executeQueryOperation` ni escribe coordenadas por un camino propio (requisito 7 de la spec).
3. **Error inline del botón**: cuando `status: 'error'`, se muestra un mensaje junto al botón, anunciado con el mismo patrón de accesibilidad que los demás errores inline del nodo, sin bloquear el formulario ni el uso del mapa. Este error es local al nodo y **no** sigue el shape tipado de `queries.*.error`; se documenta explícitamente como tal.
4. **Estado de petición**: mientras `status: 'requesting'`, el botón refleja que la petición está en curso sin bloquear el resto del formulario.

### Fuera de alcance
- No se usa `watchPosition` ni seguimiento continuo de la posición.
- No se diferencian mensajes por código de error de geolocalización.
- No se persiste ni se consulta el estado de permiso (`navigator.permissions`).
- No se añade soporte en `dev-editor`.
- No se modifica el camino de disparo de T8: el botón solo entrega coordenadas.

### Dependencias
T8 (el disparo ya debe estar colgado del punto de cambio de posición para que el botón lo herede sin duplicar lógica).

### Interfaces
**Consume:**
- Punto interno único de cambio de posición del marcador de `AddressPickerNode` (de T7).
- `useAddressGeocodeTrigger(params: { operationName: string; position: { lat: number; lng: number } | null; iterationContext?: RuntimeIterationContext }): { status: 'idle' | 'loading' | 'success' | 'error'; lastFiredRequestSignature: string | null }` (de T8, indirectamente: el botón no lo llama, solo provoca el cambio de `position`).

**Produce:**
- `useBrowserGeolocation(): { request: () => void; status: 'idle' | 'requesting' | 'error'; position: { lat: number; lng: number } | null }` — sin consumidores directos fuera de `address-picker-layout-node.tsx`; forma parte del contrato de esta tarea.

### Impacto esperado en archivos
- Código:
  - `src/runtime/use-browser-geolocation.ts` (nuevo).
  - `src/runtime/nodes/address-picker-layout-node.tsx` (modificación: botón, estados y error inline).
- Tests:
  - `src/tests/runtime/runtime-browser-geolocation.test.tsx` (nuevo).
  - `src/tests/layout-renderer/layout-renderer-address-picker.test.tsx` (ampliación: flujo end-to-end del botón).
- Documentación afectada:
  - `ai-workflow/docs/app-features/nodes/address-picker.md` (nueva ficha completa del nodo: contrato de `props`, validación, interacciones, referencias `$lat`/`$lng`, estados de carga y error, límites v1).
  - `ai-workflow/docs/app-features/nodes/index.md` (fila nueva en "Nodos de formulario" y mención en las reglas estructurales transversales de nodos exclusivos de `form`).
  - `ai-workflow/docs/app-features/forms/index.md` (referencia al nuevo nodo en el listado de nodos de formulario).
  - `ai-workflow/docs/app-features/forms/lifecycle.md` (añadir `addressPicker` a los tipos admitidos en `form.children`).
  - `ai-workflow/docs/current-state.md` (fila "Catálogo de nodos").

### Tests

#### Ficheros de test
- `src/tests/runtime/runtime-browser-geolocation.test.tsx` (nuevo)
- `src/tests/layout-renderer/layout-renderer-address-picker.test.tsx` (ampliación)

#### Comportamiento cubierto

En `src/tests/runtime/runtime-browser-geolocation.test.tsx` (unidad del hook, con `navigator.geolocation` simulado):
- `request()` con éxito expone `position: { lat, lng }` tomada de `coords` y deja `status: 'idle'`.
- `request()` con `PERMISSION_DENIED` deja `status: 'error'` y `position: null`.
- `request()` con `POSITION_UNAVAILABLE` y con `TIMEOUT` dejan el mismo `status: 'error'`, sin distinguir causa.
- Con `navigator.geolocation` ausente, `request()` deja `status: 'error'` sin lanzar excepción.
- Mientras la petición está pendiente, `status` es `'requesting'`.
- `getCurrentPosition` se invoca con un `timeout` finito en sus opciones (el botón no puede quedar colgado indefinidamente).
- Una segunda llamada a `request()` tras un error vuelve a intentar y puede terminar en éxito (el error no deja el hook inutilizable).

En `src/tests/layout-renderer/layout-renderer-address-picker.test.tsx` (end-to-end):
- Con permiso concedido, pulsar el botón coloca el marcador en la posición devuelta y dispara la misma operación de geocodificación que un click en el mapa: la petición efectiva lleva esas coordenadas en el body y el texto se actualiza con la dirección resuelta.
- Con permiso denegado, aparece un error inline junto al botón, el resto del formulario sigue operativo y un click posterior en el mapa sigue funcionando y sigue disparando la geocodificación.
- Con `navigator.geolocation` ausente, el comportamiento observable es el mismo que con permiso denegado.
- El botón tiene texto accesible y es localizable por rol y nombre accesible.
- La operación de geocodificación se dispara exactamente **una vez** por uso exitoso del botón (no dos veces por tener dos orígenes de coordenadas): verifica que el disparo está centralizado.
- Un uso del botón después de un click en el mapa mueve el marcador al nuevo punto y aplica la dirección del último origen, sin mezclar resultados.
- Regresión: todos los casos de T7 y T8 siguen pasando.

#### Comandos durante la implementación
```
pnpm test --run src/tests/runtime/runtime-browser-geolocation.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-address-picker.test.tsx
```

#### Restricciones
- Simular `navigator.geolocation` sustituyendo la propiedad en el objeto global dentro del propio test y restaurándola en `afterEach`; no introducir un mock global permanente en `src/tests/setup.ts`.
- El caso "diálogo sin respuesta" se cubre comprobando que se pasa un `timeout` finito y que un callback de error por `TIMEOUT` se trata como error, no dejando un test dependiente de tiempo real.
- Reutilizar el harness y el mock de red ya usados en los casos de T8 dentro del mismo fichero.
- Al cerrar esta tarea, ejecutar la suite completa `pnpm test` para confirmar el gate global de cobertura del 80% sobre `src/`, dado que la feature añade varios módulos nuevos.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/address-picker.md` (nueva)
- `ai-workflow/docs/app-features/nodes/index.md`
- `ai-workflow/docs/app-features/forms/index.md`
- `ai-workflow/docs/app-features/forms/lifecycle.md`
- `ai-workflow/docs/current-state.md`

### Criterios de finalización
- El botón obtiene la posición y la entrega al mismo camino que el click, sin duplicar el disparo.
- Permiso denegado y API ausente muestran el mismo error inline sin bloquear nada.
- La suite completa pasa y el gate de cobertura se mantiene.

### Cierre de implementación
Código y tests de la tarea completos, ambos comandos en verde y `pnpm test` completo en verde, cerrando la pasada de implementación de la feature.
