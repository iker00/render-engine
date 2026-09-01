# Tasks: variante `switch` en `button.props.variant`

## Notas de planificación (hallazgos de código que precisan el design)
- D4 del design asume que las funciones de estilo de `toggle` (`getToggleButtonClassName`/`getToggleKnobClassName`) ya viven en `runtime-node-styling.ts`. En el código actual son funciones privadas y no exportadas al final de `src/runtime/nodes/toggle-layout-node.tsx`. La tarea T4 debe **mover/exportar** ese marcado a un componente nuevo, no solo "reutilizar" algo ya centralizado.
- D7 del design asume un "vecindario ya existente de validación de fronteras de referencias sintéticas" en `src/config/` análogo al de `item.$key`/`item.$index`. Ese vecindario no existe: la frontera de `item.$key`/`item.$index` se resuelve enteramente en runtime (degradación silenciosa si `iterationContext` no trae el dato), no hay rechazo de bootstrap para esas formas. La tarea T2 añade la validación de frontera de `switch.next` como código nuevo en `validate-button-node.ts`, sin extender un módulo genérico preexistente.
- `switch.next` no es un caso especial dentro de un namespace ya reconocido (a diferencia de `item.$key`): `switch` no existe hoy como namespace en `runtime-reference-syntax.ts`. La tarea T2 lo da de alta como namespace nuevo completo.
- El panel de propiedades del editor de desarrollo deriva sus widgets del JSON Schema (enum → segmentado/select, boolean → switch, `boolean|string` sin rama dedicada → editor JSON crudo, igual que ya ocurre hoy con `toggle.props.defaultValue`). `variant` con 5 opciones sigue cayendo en el widget segmentado existente y `labelVisible` en el widget booleano existente, sin trabajo dedicado. `checked` cae en el mismo fallback genérico que ya sufre `defaultValue` hoy: no es una regresión de esta feature y no requiere una tarea de editor visual. No se crea ninguna tarea para el editor de desarrollo.

## Orden de ejecución
T1 → T2 → T3 → T4 → T5 → T6 (T4 y T5 no dependen entre sí ni de T2/T3, pero se ejecutan en este orden por claridad; T6 depende de T1, T3, T4 y T5).

Siguiente tarea a escoger tras cerrar la planificación: **T1**.

---

## T1 — Contrato y validación de bootstrap de `variant: 'switch'`, `checked` y `labelVisible`

### Objetivo
Extender el contrato público de `button` (tipos + esquema Zod) con el quinto valor de `variant` (`switch`) y los props nuevos `checked`/`labelVisible`, y añadir en `validate-button-node.ts` todas las reglas de validación cruzada de bootstrap que dependen únicamente de la config (sin tocar render ni resolución de referencias en vivo).

### Fuera de alcance
- Resolución en vivo de `checked` (vive en T6).
- `switch.next`: ni su reconocimiento sintáctico ni su frontera de uso (vive en T2).
- Cualquier cambio de render (vive en T6).
- Cualquier cambio en `validate-form-semantics.ts` (la regla "botón sin `action` fuera de `form`" no se toca; como `switch` siempre exige `action`, nunca la dispara un switch válido).

### Dependencias
Ninguna. Primera tarea de la feature.

### Interfaces
**Consume**: ninguno.

**Produce**:
- `ButtonLayoutNode['props'].variant?: 'solid' | 'outline' | 'ghost' | 'link' | 'switch'` (de `src/config/runtime-config-types.ts` y `src/config/runtime-config-zod.ts`, constante `supportedButtonVariants`) — consumido por: T2, T6
- `ButtonLayoutNode['props'].checked?: boolean | string` — consumido por: T6
- `ButtonLayoutNode['props'].labelVisible?: boolean` — consumido por: T6

### Corrección de compatibilidad de tipos (hallazgo de revisión)
Extender `ButtonVariant` con `'switch'` deja incompleto `buttonVariantClassMaps: Record<ButtonVariant, Record<ButtonColor, string>>` en `src/runtime/runtime-node-styling-button.ts` (único uso exhaustivo de `ButtonVariant` como clave de `Record` en el código), lo que rompe `pnpm build` (`tsc --noEmit -p tsconfig.app.json`). Esta misma tarea debe:
- Acotar `buttonVariantClassMaps` a `Record<Exclude<ButtonVariant, 'switch'>, Record<ButtonColor, string>>`.
- Acotar el parámetro `variant` de `getButtonVariantClassName(color: ButtonColor, variant: Exclude<ButtonVariant, 'switch'>, fullWidth: boolean): string` al mismo tipo excluyente (T6 solo invoca este helper en la rama no-switch; la rama `switch` usa `getButtonSwitchClassName` de T5).

### Impacto esperado en archivos
- Código:
  - `src/config/runtime-config-zod.ts`: añadir `'switch'` a `supportedButtonVariants`; añadir `checked: z.union([z.boolean(), z.string()]).optional()` y `labelVisible: z.boolean().optional()` a `buttonNodeSchema.props` (mismo patrón que `defaultValue` de `toggle`, línea ~975).
  - `src/config/runtime-config-types.ts` (o el fichero donde se declara el tipo público `ButtonLayoutNode`, a confirmar en implementación si el nombre exacto difiere): añadir `checked?: boolean | string` y `labelVisible?: boolean` a `props`, y `'switch'` al tipo `ButtonVariant`.
  - `src/config/validate-button-node.ts`: en `validateButtonNode`, añadir a la construcción manual de `buttonProps` (líneas ~138-149) los campos `checked`/`labelVisible`; añadir las reglas cruzadas:
    - `variant === 'switch'` sin `checked` → config rechazado.
    - `variant !== 'switch'` (incluido ausente) con `checked` o `labelVisible` presentes → config rechazado.
    - `variant === 'switch'` con `icon` presente → config rechazado.
    - `variant === 'switch'` sin `action` → config rechazado (regla local a este módulo, no en `validate-form-semantics.ts`).
  - `src/runtime/runtime-node-styling-button.ts`: acotar `buttonVariantClassMaps` y la firma de `getButtonVariantClassName` a `Exclude<ButtonVariant, 'switch'>` (ver "Corrección de compatibilidad de tipos" en `Interfaces` arriba), para que `pnpm build` siga en verde tras extender `ButtonVariant`.
- Tests: ver sub-bloque `tests`.
- Documentación: ver `documentación afectada`.

### Tests
**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-button-styles.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)

**Comportamiento cubierto**:
- `button.props.variant: 'switch'` con `checked` boolean literal y `action` válido se acepta en bootstrap.
- `button.props.variant: 'switch'` con `checked` como referencia dinámica completa (`"item.isPrimary"`) se acepta en bootstrap.
- `button.props.variant: 'switch'` sin `checked` se rechaza en bootstrap.
- `button.props.checked` presente con `variant` distinto de `switch` (incluido `variant` ausente) se rechaza en bootstrap.
- `button.props.labelVisible` presente con `variant` distinto de `switch` se rechaza en bootstrap.
- `button.props.variant: 'switch'` con `props.icon` declarado se rechaza en bootstrap.
- `button.props.variant: 'switch'` sin `action` se rechaza en bootstrap.
- `button.props.variant: 'switch'` sin `action`, fuera de un `form`, se rechaza por la regla anterior (no por la regla genérica de "botón sin action fuera de form").
- `button.props.variant: 'switch'` con `action` presente, fuera de un `form`, se acepta en bootstrap (no dispara la regla genérica de "botón sin action fuera de form").
- `button.props.labelVisible: true` y `labelVisible` ausente se aceptan con `variant: 'switch'`.
- Botones existentes con `variant: 'solid' | 'outline' | 'ghost' | 'link'` o sin `variant` siguen aceptándose sin cambios (regresión).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/config-validation/runtime-config-validation-button-styles.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts
```

**Restricciones**: no modificar los tests existentes de estas dos suites que cubren `solid|outline|ghost|link`; solo añadir casos nuevos.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/button.md`

### Criterios de finalización
- Todas las combinaciones de aceptación/rechazo listadas en "Comportamiento cubierto" están cubiertas por test y en verde.
- `pnpm test --run` de ambos ficheros de test en verde.
- `pnpm build` (o al menos `tsc --noEmit -p tsconfig.app.json`) en verde tras extender `ButtonVariant` con `'switch'`.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T2 — Frontera de la referencia sintética `switch.next`

### Objetivo
Dar de alta `switch.next` como referencia sintética reconocida por el pipeline neutral de sintaxis (`runtime-reference-syntax.ts`) y añadir en `validate-button-node.ts` el rechazo de bootstrap cuando `switch.next` aparece fuera de `props.action.query`/`body`/`headers`/`operations[].query`/`operations[].body`/`operations[].headers` del mismo `button` con `variant: 'switch'`.

### Fuera de alcance
- Resolución en vivo del valor de `switch.next` contra un dato real de contexto (vive en T3).
- Cualquier cambio de render.

### Dependencias
T1 (necesita `variant` extendido con `'switch'` para saber, en bootstrap, si un botón concreto es un switch).

### Interfaces
**Consume**:
- `ButtonLayoutNode['props'].variant?: 'solid' | 'outline' | 'ghost' | 'link' | 'switch'` (de T1)

**Produce**:
- `parseRuntimeReference(value: string, options?: ParseRuntimeReferenceOptions): RuntimeReferenceParseResult` (firma real existente en `src/config/runtime-reference-syntax.ts`; `ParseRuntimeReferenceOptions` hoy es `{ allowItemReference?: boolean; allowRowReference?: boolean }`, `RuntimeReferenceParseResult = RuntimeLiteralReference | RuntimeSupportedReference | RuntimeUnsupportedReference | RuntimeInvalidReference`) — extendida con una nueva opción `allowSwitchNextReference?: boolean` en `ParseRuntimeReferenceOptions`, con `'switch'` añadido a `RuntimeReferenceNamespace`, a `RuntimeSupportedReference['namespace']` y a `RuntimeUnsupportedReference['namespace']` (mismo patrón que `item`/`row`: con `allowSwitchNextReference: true` y forma exacta `switch.next` resuelve `status: 'supported'`; sin la opción, `status: 'unsupported'`) — consumido por: T3
- Regla de rechazo en bootstrap en `validate-button-node.ts` para `switch.next` fuera de su superficie soportada — sin firma reutilizable, sin consumidores directos dentro de este plan.

### Impacto esperado en archivos
- Código:
  - `src/config/runtime-reference-syntax.ts`:
    - añadir `'switch'` a `RuntimeReferenceNamespace`.
    - añadir `'switch'` a la unión `namespace` de `RuntimeSupportedReference` y de `RuntimeUnsupportedReference`.
    - añadir `'switch'` al grupo reconocido por `REFERENCE_PATTERN` y por `hasRecognizedNamespace`.
    - añadir `allowSwitchNextReference?: boolean` a `ParseRuntimeReferenceOptions`.
    - en `parseRuntimeReference`, añadir una rama `if (namespace === 'switch') { ... }` (paralela a la de `item`/`row`, antes de `isSupportedNamespace`/`isReservedNamespace`) que devuelve `status: 'supported'` cuando `options.allowSwitchNextReference` es `true` y `status: 'unsupported'` en caso contrario.
    - en `hasValidReferenceShape`, añadir el caso temprano `namespace === 'switch' && path.length === 1 && path[0] === 'next'` (mismo patrón que `item.$key`/`item.$index`/`row.$index`), y un `case 'switch': return false` en el `switch (namespace)` exhaustivo (líneas ~189-223) para las formas que no cumplen esa shape exacta (p. ej. `switch.foo`, `switch` sin segmento, `switch.next.extra`).
  - `src/config/validate-button-node.ts`: en `validateButtonNode`, escanear (como literal string, análogo a como ya se comprueban otras superficies de `query`/`body`/`headers`/`operations[]` en este mismo módulo) las apariciones de `switch.next` dentro de `props.action.query`/`body`/`headers` y, si `props.action.type === 'executeOperations'`, dentro de cada `operations[].query`/`body`/`headers`; rechazar si aparece en un botón cuyo `variant` no es `'switch'`, o en cualquier otra superficie del propio nodo (`props.checked`, `node.visibility.reference`) o de cualquier otro nodo.
- Tests: ver sub-bloque `tests`.
- Documentación: ver `documentación afectada`.

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación)
- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)

**Comportamiento cubierto**:
- `parseRuntimeReference('switch.next', { allowSwitchNextReference: true })` reconoce la referencia como válida.
- `parseRuntimeReference('switch.next', {})` (sin `allowSwitchNextReference`) no la reconoce como soportada.
- `parseRuntimeReference('switch.nextx')` / `parseRuntimeReference('switch.next.extra')` / `parseRuntimeReference('switch')` no son formas válidas de `switch.next` (rutas inválidas).
- Un `button.props.variant: 'switch'` con `switch.next` en `props.action.body`/`query`/`headers` se acepta en bootstrap.
- Un `button.props.variant: 'switch'` con `action.type: 'executeOperations'` y `switch.next` en `operations[].body`/`query`/`headers` se acepta en bootstrap.
- Un `button` con `variant` distinto de `'switch'` (incluido ausente) que referencia `switch.next` en `props.action.query`/`body`/`headers` se rechaza en bootstrap.
- Un `button.props.variant: 'switch'` que referencia `switch.next` en `props.checked` se rechaza en bootstrap.
- Un `button.props.variant: 'switch'` que referencia `switch.next` en `node.visibility.reference` se rechaza en bootstrap.
- Un `switch.next` referenciado en la `action` de otro nodo (no el propio botón switch) se rechaza en bootstrap.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx
pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts
```

**Restricciones**: no introducir un módulo de validación de fronteras nuevo y genérico; la regla de frontera de `switch.next` vive junto al resto de validación específica de `button` en `validate-button-node.ts`, como código propio de esta feature (no hay módulo previo del que "heredar" el patrón literal).

### Documentación afectada
- `ai-workflow/docs/app-features/references/reference-resolution.md`

### Criterios de finalización
- Todos los casos de "Comportamiento cubierto" cubiertos por test y en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T3 — Propagación de `switchNextValue` y resolución en vivo de `switch.next`

### Objetivo
Añadir un campo de contexto local opcional `switchNextValue?: boolean` como hermano de `iterationContext` en toda la cadena de opciones que hoy transporta `iterationContext` desde el disparador de una acción hasta `resolveRuntimeReference`, y hacer que `resolveRuntimeReference` resuelva `switch.next` a partir de ese campo cuando está presente.

### Fuera de alcance
- Calcular el valor de `switchNextValue` a partir del `checked` resuelto de una instancia concreta de botón (vive en T6, que es quien invoca esta cadena con el valor ya calculado).
- Cualquier cambio de render.

### Dependencias
T2 (necesita que `parseRuntimeReference` ya reconozca `switch.next` con la opción `allowSwitchNextReference`).

### Interfaces
**Consume**:
- `parseRuntimeReference(value: string, options?: ParseRuntimeReferenceOptions): RuntimeReferenceParseResult` con `ParseRuntimeReferenceOptions` incluyendo `allowSwitchNextReference?: boolean` y `'switch'` reconocido como namespace `supported`/`unsupported` (de T2)

**Produce**:
- `resolveRuntimeReference(value: string, state?: RuntimeState, options?: { iterationContext?: RuntimeIterationContext; switchNextValue?: boolean; localPlaceholders?: Record<string, string> }): RuntimeReferenceResolutionResult` (en `src/runtime/runtime-references/runtime-reference-resolver.ts`, extendida con `switchNextValue`) — consumido por: T6
- `executeQueryOperation(operationName: string, options?: { fetch?: typeof fetch; snapshotState?: RuntimeState; requestParams?: RuntimeApiRequestParams; iterationContext?: RuntimeIterationContext; switchNextValue?: boolean; hiddenFormFields?: RuntimeApiHiddenFormFields; emptySubmitValues?: RuntimeApiEmptySubmitValues; fileInputSources?: RuntimeApiFileInputSources }): Promise<unknown>` (en `src/runtime/runtime-state/use-runtime-state.ts`, misma firma existente extendida solo con `switchNextValue`) — consumido por: T6

### Impacto esperado en archivos
- Código (añadir `switchNextValue?: boolean` como campo hermano de `iterationContext` en cada punto de esta cadena, y reenviarlo sin transformarlo hasta el resolver):
  - `src/runtime/runtime-state/use-runtime-state.ts`: tipo de opciones de `executeQueryOperation`.
  - `src/runtime/runtime-state/runtime-state-query-execution.ts`: `executeQueryOperationWithSnapshot`.
  - `src/queries/runtime-api-types.ts`: `BuildRuntimeApiRequestOptions` y `BuildInlineRuntimeApiRequestOptions`.
  - `src/queries/runtime-api-request.ts`: el objeto `resolveOptions` (línea ~85) que se pasa a `resolveEndpoint`/`resolveQuery`/`resolveBody`/`resolveHeaders`, y la función `resolveEndpoint` (línea ~184) que desestructura `iterationContext` para reenviarlo a `resolveRuntimeReference`.
  - `src/queries/runtime-api-payload-resolver.ts` (confirmar en implementación si el fichero vive exactamente en esta ruta): `ResolvePayloadValueOptions`, y los tres puntos que desestructuran `iterationContext` para reenviarlo (`resolvePayloadValue`, `resolveFileValueOverride`, `resolveHeaderTemplateValue`).
  - `src/runtime/runtime-references/runtime-reference-resolver.ts`: `ResolveRuntimeReferenceOptions` (añadir `switchNextValue?: boolean`); en `resolveRuntimeReference`, derivar `allowSwitchNextReference: options.switchNextValue !== undefined` al invocar `parseRuntimeReference` (mismo patrón que `allowItemReference: options.iterationContext !== undefined`); en `resolveSupportedReferenceValue`, añadir la rama que reconoce `namespace === 'switch' && path.length === 1 && path[0] === 'next'` y devuelve `options.switchNextValue`.
- Tests: ver sub-bloque `tests`.
- Documentación: ver `documentación afectada`.

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación)
- `src/tests/runtime/runtime-api-execution.test.ts` (ampliación)

**Comportamiento cubierto**:
- `resolveRuntimeReference('switch.next', state, { switchNextValue: true })` resuelve a `true`.
- `resolveRuntimeReference('switch.next', state, { switchNextValue: false })` resuelve a `false`.
- `resolveRuntimeReference('switch.next', state, {})` (sin `switchNextValue`) no resuelve como referencia soportada (comportamiento equivalente a dato no disponible).
- Una operación disparada vía `executeQueryOperation(operationName, { requestParams: { body: { isPrimary: 'switch.next' } }, switchNextValue: true })` produce un body efectivo con `isPrimary: true`; con `switchNextValue: false`, `isPrimary: false`.
- `switchNextValue` convive sin conflicto con `iterationContext` en la misma llamada (caso `repeater`: `item.*` y `switch.next` resueltos simultáneamente en el mismo `body`).
- Sin `switchNextValue` en las opciones, el comportamiento de resolución de referencias existente (`item.*`, `queries.*`, `forms.*`, `params.*`) no cambia (regresión).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx
pnpm test --run src/tests/runtime/runtime-api-execution.test.ts
```

**Restricciones**: no añadir `switchNextValue` a `RuntimeIterationContext`; debe quedar como campo hermano independiente en cada nivel de opciones, tal como fija D1 del design.

### Documentación afectada
- `ai-workflow/docs/app-features/references/reference-resolution.md`
- `ai-workflow/docs/app-features/queries/execution.md`

### Criterios de finalización
- Todos los casos de "Comportamiento cubierto" cubiertos por test y en verde.
- Ningún test preexistente de `iterationContext`/resolución de referencias queda roto.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T4 — Componente presentacional compartido del control `switch`

### Objetivo
Extraer el marcado accesible `<button role="switch" aria-checked>` + `<span>` de knob, hoy autocontenido dentro de `toggle-layout-node.tsx`, a un componente presentacional propio y reutilizable, y hacer que `toggle-layout-node.tsx` lo consuma en vez de su JSX local.

### Fuera de alcance
- Cualquier lógica de campo de formulario (wrapper, label, tooltip, error) de `toggle`: permanece en `toggle-layout-node.tsx`, el componente extraído no la conoce.
- El helper de color para `button` con `variant: 'switch'` (vive en T5); el componente extraído no conoce `color`.
- Uso del componente desde `button-layout-node.tsx` (vive en T6).

### Dependencias
Ninguna (independiente de T1/T2/T3; se secuencia aquí por agrupación temática con T5/T6).

### Interfaces
**Consume**: ninguno.

**Produce**:
- `SwitchControl(props: { checked: boolean; onClick: () => void; trackClassName: string; knobClassName: string; ariaLabel?: string; ariaDescribedBy?: string }): JSX.Element` (nuevo fichero `src/runtime/nodes/switch-control.tsx`) — consumido por: T6 (y por `toggle-layout-node.tsx`, refactorizado en esta misma tarea)

### Impacto esperado en archivos
- Código:
  - Nuevo: `src/runtime/nodes/switch-control.tsx` — exporta `SwitchControl`, con el JSX exacto `<button type="button" role="switch" aria-checked={checked} aria-label={ariaLabel} aria-describedby={ariaDescribedBy} onClick={onClick} className={trackClassName}><span className={knobClassName} /></button>` (atributos `aria-label`/`aria-describedby` ausentes del DOM cuando su prop es `undefined`, no como string `"undefined"`).
  - `src/runtime/nodes/toggle-layout-node.tsx`: sustituir el JSX local del control por `<SwitchControl checked={value} onClick={handleClick} trackClassName={getToggleButtonClassName(value)} knobClassName={getToggleKnobClassName(value)} ariaDescribedBy={hasError ? \`${formContext.formId}-${node.props.fieldId}-error\` : undefined} />`; las funciones `getToggleButtonClassName`/`getToggleKnobClassName` se mantienen en este fichero (o se mueven a `switch-control.tsx` si resulta más natural durante la implementación, siempre que sigan siendo específicas de `toggle` y no las importe `button-layout-node.tsx` directamente — el helper de `button` es propio, ver T5).
- Tests: ver sub-bloque `tests`.
- Documentación: ninguna (refactor interno, sin cambio de contrato observable de `toggle`).

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-switch-control.test.tsx` (nuevo)

**Comportamiento cubierto**:
- `SwitchControl` renderiza `role="switch"` y `aria-checked` igual al valor de `checked` (`true`/`false`).
- Un click invoca la función `onClick` recibida.
- `trackClassName`/`knobClassName` se aplican literalmente al `<button>` y al `<span>` respectivamente.
- `ariaLabel` ausente no añade el atributo `aria-label` al DOM; presente, lo añade con ese valor exacto.
- `ariaDescribedBy` ausente no añade el atributo `aria-describedby` al DOM; presente, lo añade con ese valor exacto.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/runtime/runtime-switch-control.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-toggle.test.tsx
```

**Restricciones**: no añadir ni modificar casos en `layout-renderer-toggle.test.tsx`; esa suite existente debe seguir en verde sin cambios como prueba de no regresión del refactor.

### Documentación afectada
- ninguno

### Criterios de finalización
- `runtime-switch-control.test.tsx` en verde.
- `layout-renderer-toggle.test.tsx` sigue en verde sin haberse modificado.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T5 — Helper de estilo de color para el switch de `button`

### Objetivo
Añadir en `runtime-node-styling-button.ts` un helper puro que resuelva las clases del track/knob del switch de `button` según `checked` y `color`: `checked: true` se tiñe con el color semántico, `checked: false` usa siempre el mismo tratamiento neutro.

### Fuera de alcance
- Cualquier uso de este helper desde `button-layout-node.tsx` (vive en T6).
- Estilos de `toggle` (no tiene `color`, no se toca).

### Dependencias
Ninguna (independiente de T1/T2/T3/T4; se secuencia aquí por agrupación temática con T4/T6).

### Interfaces
**Consume**: ninguno.

**Produce**:
- `getButtonSwitchClassName(checked: boolean, color: ButtonColor): { trackClassName: string; knobClassName: string }` (nuevo, en `src/runtime/runtime-node-styling-button.ts`) — consumido por: T6

### Impacto esperado en archivos
- Código: `src/runtime/runtime-node-styling-button.ts` — nueva función `getButtonSwitchClassName`, siguiendo el mismo patrón de lookup (`Record<ButtonColor, string>` para el estado `checked: true`; una única clase fija para `checked: false`) que ya usa `getButtonVariantClassName` en este mismo fichero.
- Tests: ver sub-bloque `tests`.
- Documentación: ninguna (detalle de implementación de estilo, sin contrato observable propio más allá de lo ya recogido en `button.md` vía T6).

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)

**Comportamiento cubierto**:
- `getButtonSwitchClassName(true, color)` produce una clase de track distinta para cada uno de los seis colores semánticos (`neutral | primary | success | warning | danger | info`).
- `getButtonSwitchClassName(false, color)` produce siempre la misma clase de track neutra, con independencia del `color` recibido.
- El `knobClassName` devuelto es válido (no vacío) tanto en `checked: true` como en `checked: false`.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/runtime/runtime-node-styling.test.ts
```

**Restricciones**: ninguna.

### Documentación afectada
- ninguno

### Criterios de finalización
- Todos los casos de "Comportamiento cubierto" cubiertos por test y en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T6 — Render de `variant: 'switch'` en `button-layout-node.tsx`

### Objetivo
Bifurcar el render de `ButtonNode` cuando `node.props.variant === 'switch'`: resolver `checked` con el mecanismo de referencia dinámica completa/literal ya existente en el runtime, renderizar el control mediante `SwitchControl` con las clases de `getButtonSwitchClassName`, aplicar la regla de nombre accesible (`aria-label` solo cuando `labelVisible` es `false`), y disparar la `action` configurada calculando `switchNextValue` como la negación del `checked` resuelto en el momento del click y pasándolo a la ejecución de la operación.

### Fuera de alcance
- Cualquier lógica de `disabled`: el switch no introduce estado deshabilitado; el click siempre dispara la `action`.
- Reordenar o tocar el render de las variantes `solid|outline|ghost|link` más allá de envolver la rama existente en la bifurcación por `variant`.

### Dependencias
T1, T3, T4, T5.

### Interfaces
**Consume**:
- `ButtonLayoutNode['props'].variant?: 'solid' | 'outline' | 'ghost' | 'link' | 'switch'` (de T1)
- `ButtonLayoutNode['props'].checked?: boolean | string` (de T1)
- `ButtonLayoutNode['props'].labelVisible?: boolean` (de T1)
- `resolveRuntimeReference(value: string, state?: RuntimeState, options?: { iterationContext?: RuntimeIterationContext; switchNextValue?: boolean; localPlaceholders?: Record<string, string> }): RuntimeReferenceResolutionResult` (de T3)
- `executeQueryOperation(operationName: string, options?: { fetch?: typeof fetch; snapshotState?: RuntimeState; requestParams?: RuntimeApiRequestParams; iterationContext?: RuntimeIterationContext; switchNextValue?: boolean; hiddenFormFields?: RuntimeApiHiddenFormFields; emptySubmitValues?: RuntimeApiEmptySubmitValues; fileInputSources?: RuntimeApiFileInputSources }): Promise<unknown>` (de T3)
- `SwitchControl(props: { checked: boolean; onClick: () => void; trackClassName: string; knobClassName: string; ariaLabel?: string; ariaDescribedBy?: string }): JSX.Element` (de T4)
- `getButtonSwitchClassName(checked: boolean, color: ButtonColor): { trackClassName: string; knobClassName: string }` (de T5)

**Produce**: ninguno (tarea final de render de esta feature; sin consumidores dentro de este plan).

### Impacto esperado en archivos
- Código: `src/runtime/nodes/button-layout-node.tsx`
  - Al inicio del render, si `node.props.variant === 'switch'`: resolver `checked` con el mismo mecanismo boolean-o-referencia-completa ya usado por el runtime para `defaultValue` de campos de formulario (localizar el helper existente durante la implementación; no crear un resolutor nuevo — degradación a `false` cuando la referencia no tiene dato disponible, según la política general ya fijada por `reference-resolution.md`).
  - Resolver `label` igual que hoy (mismo mecanismo ya usado por las demás variantes).
  - Calcular `trackClassName`/`knobClassName` con `getButtonSwitchClassName(checkedValue, color)`.
  - Renderizar: `SwitchControl` con `checked={checkedValue}`, `onClick={handleSwitchClick}`, `trackClassName`, `knobClassName`, `ariaLabel={labelVisible === false ? label : undefined}`, `ariaDescribedBy={undefined}` (el switch de `button` no tiene estado de error de formulario); si `labelVisible !== false`, renderizar además el texto de `label` visible junto al control (wrapper mínimo, sin introducir `labelPosition`).
  - `handleSwitchClick`: recalcula `checkedValue` en el momento del click (no usa un valor cacheado de un render anterior) y dispara la `action` configurada reutilizando el mismo camino de ejecución que ya usan `solid|outline|ghost|link` (`executeQueryOperation`/lifecycle `onSuccess`/`onError` existente), añadiendo `switchNextValue: !checkedValue` a las opciones de ejecución.
  - El resto del componente (resolución de `solid|outline|ghost|link`, `fullWidth`, `icon`) no cambia.
- Tests: ver sub-bloque `tests`.
- Documentación: ver `documentación afectada`.

### Tests
**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-button-styles.test.tsx` (ampliación)
- `src/tests/runtime/runtime-button-lifecycle-actions.test.tsx` (ampliación)

**Comportamiento cubierto**:
- `button` con `variant: 'switch'`, `checked: true` renderiza `role="switch"` con `aria-checked="true"`; `checked: false` con `aria-checked="false"`.
- `button` con `variant: 'switch'`, `checked: "item.isPrimary"` dentro de `repeater.props.template` resuelve `aria-checked` de forma independiente por fila según el `item.isPrimary` de cada una.
- `checked` con referencia bien formada sin dato disponible renderiza `aria-checked="false"`.
- `checked` literal fijo (`true`/`false`) mantiene siempre ese estado visual entre renders.
- `variant: 'switch'`, `color: <cada uno de los seis valores>` tiñe el track solo cuando `checked: true`; con `checked: false` el track usa siempre la misma clase neutra con independencia del `color`.
- `labelVisible: false` no renderiza el texto de `label` en el DOM visible, pero el control expone `aria-label` igual al `label` resuelto.
- `labelVisible` ausente y `labelVisible: true` renderizan el texto de `label` visible junto al control, sin `aria-label` propio en el control.
- Click en un `button` `variant: 'switch'` dispara la `action` configurada (`executeOperation`); dentro de `repeater`, resuelve `item.*` de la fila que originó el click.
- `action.body: { isPrimary: 'switch.next' }`: con `checked` resuelto en `false` en el momento del click, el body enviado lleva `isPrimary: true`; con `checked` resuelto en `true`, lleva `isPrimary: false`.
- Click en un switch ya `checked: true` dispara igualmente su `action`, con `switch.next` resolviendo `false` en ese payload (sin ningún `disabled` aplicado al control).
- Un `onSuccess` que relanza la query del listado se comporta igual que en cualquier otro `button` (mismo camino de ejecución, sin lógica especial de exclusividad en el switch).
- Un `button` con `variant: 'switch'` fuera de cualquier `form` se renderiza y dispara su `action` con normalidad.
- Botones existentes con `variant: 'solid' | 'outline' | 'ghost' | 'link'` (o sin `variant`) no cambian su render ni su comportamiento de click (regresión).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/layout-renderer/layout-renderer-button-styles.test.tsx
pnpm test --run src/tests/runtime/runtime-button-lifecycle-actions.test.tsx
```

**Restricciones**: no modificar los casos existentes de estas dos suites que cubren `solid|outline|ghost|link`; solo añadir casos nuevos para `switch`.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/button.md`
- `ai-workflow/docs/current-state.md` (si cambia el resumen de la fila "Catálogo de nodos")

### Criterios de finalización
- Todos los casos de "Comportamiento cubierto" cubiertos por test y en verde.
- Todos los criterios de aceptación de `spec.md` verificables por test están cubiertos por T1, T2, T3 o esta tarea.
- `pnpm test` global sigue cumpliendo el umbral de cobertura del 80% sobre `src/`.

### Cierre de implementación
Código y tests de esta tarea completos y validados.
