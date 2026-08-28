# Design: Feature 0132 - dev-editor-visibility-condition-widget

## Contexto
Hoy `visibility`/`when` (misma forma condición/grupo, ver [[../../docs/app-features/references/visibility.md]]) se
edita en el panel de propiedades del dev editor a través del pipeline genérico del dispatcher
(`src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`): `resolveUnionBranch`
(`property-field-schema-resolution.ts`) detecta en silencio si el valor actual tiene forma de condición o de
grupo (por sus `required` keys) y colapsa el `oneOf` a esa única rama antes de que el dispatcher genérico la
renderice como objeto — sin selector explícito de forma, sin ocultar campos irrelevantes por `operator`, y sin
editor real de `value` (cae al fallback genérico de campo por tipo JS, roto para número/booleano/null salvo que
el valor ya sea string).

El dev editor ya tiene un mecanismo establecido para sustituir este pipeline genérico por un widget dedicado: el
hook `x-widget` del dispatcher (`WIDGET_REGISTRY`, comprobado con prioridad sobre cualquier detección genérica,
incluida `resolveUnionBranch`). Cinco widgets ya siguen este patrón (`choice-items`, `layout-span`,
`heading-level`, `tabs-orientation`, `icon`, ver [[../../docs/app-features/development/dev-mode-editor.md]]): un
transform de schema sustituye el fragmento JSON Schema real por el sentinel `{ 'x-widget': '<clave>' }` antes de
que el panel lo pase al dispatcher; el schema que consume Monaco no se toca nunca (sigue siendo el `oneOf` real
completo derivado de Zod).

Verificación empírica hecha para este design (generando `toJSONSchema(buttonNodeSchema)` y contando ocurrencias):
- `visibilitySchema`/`whenConditionSchema` (`src/config/runtime-config-zod.ts`) es **una única instancia Zod
  compartida**, reutilizada en `node.visibility` de todos los nodos y en `when` de las 7 variantes de acción y de
  `executeOperations.operations[]`. A pesar de ser una instancia compartida, `toJSONSchema` la **inlinea por
  completo en cada ocurrencia** en vez de deduplicarla en `$defs`/`$ref` (el único `$defs` real en el schema de
  `button` es el de `runtimeApiBodySchema`, que sí es recursivo vía `z.lazy`). Cada ocurrencia de
  `visibility`/`when` es por tanto un fragmento de schema autocontenido: `oneOf` de dos ramas objeto, ambas con
  `operator` en su `required` (condición: `required: [reference, operator]`; grupo:
  `required: [operator, conditions]`), sin discriminador `type` — coincide con el comentario ya existente en
  `resolveUnionBranch` que documenta este caso como su ejemplo motivador.
- `visibility`/`when` aparecen en dos módulos de caché de schema independientes, ninguno compartido con Monaco:
  `layout-canvas-node-schema.ts` (`getNodeTypeJsonSchema`, alimenta el panel de propiedades de `Layout`) y
  `shell-config-panel-schema.ts` (`getMenuItemJsonSchema`/`getSidebarItemJsonSchema`, alimenta
  `MenuItemFieldsEditor`/`SidebarItemFieldsEditor`). `sidebarItemSchema` es en sí mismo recursivo (`z.lazy` para
  `children` anidado sin límite de profundidad), así que su JSON Schema generado sí introduce su propio
  `$defs`/`$ref` interno, no relacionado con `visibility`/`when` pero que un transform recursivo debe atravesar
  igualmente para alcanzar el `visibility` anidado dentro de la rama recursiva.
- `MenuItemFieldsEditor` **ya** enruta `visibility` a través de `PropertyFieldDispatcher` +
  `resolveUnionBranch(visibilitySchema, item.visibility)` (`menu-item-fields-editor.tsx`) — a diferencia de
  `icon`, que ahí se monta como componente directo porque nunca pasó por el dispatcher. `visibility` en Shell no
  necesita ese tratamiento especial: ya vive dentro del pipeline genérico.
- `dev-runtime-json-schema.ts` (el schema que alimenta el autocompletado de Monaco) es un módulo y un call path
  completamente separado de los dos anteriores — no se toca en este design, mismo precedente que `choice-items`.

## Objetivos / No objetivos

### Objetivos
- Fijar el mecanismo único de enganche del widget en las tres superficies (`node.visibility` en `Layout`, `when`
  de acciones, `visibility` de `menuItem`/`sidebarItem` en `Shell`) sin duplicar lógica de detección de forma,
  edición de condición o edición de `value`.
- Fijar el punto exacto donde se inyecta el sentinel `x-widget` y su alcance (qué módulos toca, cuáles quedan
  fuera).
- Fijar la responsabilidad y estructura interna del componente widget lo suficiente para que la planificación
  pueda trocear tareas sin reabrir estas decisiones.

### No objetivos
- No decide las etiquetas de UI exactas — la spec ya las deja como detalle de implementación no bloqueante.
- No cambia `validateRuntimeConfig`, el contrato de `visibility`/`when` ni ninguna regla funcional de
  [[../../docs/app-features/references/visibility.md]].
- No decide clases Tailwind concretas más allá de qué componentes reutilizables aplican
  (`SegmentedTogglePropertyField`).

## Decisiones

### D1 — Mecanismo de enganche: nueva entrada `x-widget` en el registro existente, sin tocar el dispatcher
Se añade una entrada `condition-group` a `WIDGET_REGISTRY` (`property-field-dispatcher.tsx`), resuelta por un
nuevo componente `ConditionGroupPropertyField`. No se modifica `resolveUnionBranch` ni el orden de resolución del
dispatcher.

**Por qué funciona sin tocar `resolveUnionBranch`**: al sustituir el fragmento de schema real de `visibility`/
`when` por el sentinel plano `{ 'x-widget': 'condition-group' }` (mismo patrón que `icon`: sustitución completa,
no fusión), `getUnionBranches` dentro de `resolveUnionBranch` no encuentra `oneOf`/`anyOf` en ese fragmento y
devuelve el schema sin tocar (rama ya existente `if (!branches || branches.length === 0) return schema`). El
dispatcher, al recibir ese mismo fragmento, resuelve el hook `x-widget` **antes** de cualquier detección
genérica y delega en `ConditionGroupPropertyField`. Es el mismo mecanismo, sin excepción especial, que ya usan
`choice-items`/`layout-span`/`heading-level`/`tabs-orientation`/`icon`.

**Alternativa descartada — adaptar `resolveUnionBranch` para reconocer este caso ad hoc**: más código y rompe el
precedente de que `x-widget` gana siempre antes de cualquier resolución genérica; no aporta nada que la
sustitución de schema no resuelva ya.

**Alternativa descartada — integración directa de componente en `Shell` (como `icon` ahí)**: innecesaria.
`MenuItemFieldsEditor`/`SidebarItemFieldsEditor` ya enrutan `visibility` a través de `PropertyFieldDispatcher` +
`resolveUnionBranch`, así que inyectar el sentinel en el schema que ya consumen esos editores basta —  no hace
falta tocar esos dos ficheros salvo, si acaso, para verificar que su import de `resolveUnionBranch` sigue siendo
necesario tras el cambio.

### D2 — Punto de inyección del sentinel: en el origen del schema cacheado, con recorrido recursivo
Un nuevo transform (`injectConditionGroupWidgetSentinel` o nombre equivalente) se aplica una sola vez, justo
después de `toJSONSchema(...)` y antes de cachear, en cada uno de los puntos de generación de schema consumidos
por los paneles:
- `layout-canvas-node-schema.ts` → `getNodeTypeJsonSchema`.
- `shell-config-panel-schema.ts` → `getMenuItemJsonSchema` y `getSidebarItemJsonSchema` (los dos únicos getters de
  ese módulo cuyo schema puede contener `visibility`; `getShellHeaderJsonSchema`/`getShellSidebarJsonSchema` no lo
  necesitan salvo que su propio schema anide `menuItem`/`sidebarItem` sin resolver — a confirmar en planificación
  contra el schema real, sin bloquear este design).

El transform recorre recursivamente `properties`, `items`, `oneOf`, `anyOf` y `$defs` de cualquier fragmento
objeto, y sustituye por completo cualquier propiedad **cuya clave sea literalmente `visibility` o `when`** por
`{ 'x-widget': 'condition-group' }`, sin inspeccionar la forma del fragmento que sustituye. Debe atravesar
`$defs` explícitamente porque `sidebarItemSchema` es recursivo (`z.lazy`) y un `visibility` dentro de la rama
`children` anidada puede vivir detrás de un `$ref` a `$defs`.

**Por qué en el origen cacheado y no a nivel de panel** (como sí hacen `resolveIconPropsSchema`/
`resolveTabsPropsSchema` en `layout-canvas-properties-panel.tsx`): `visibility`/`when` aparecen a profundidades y
en subsecciones distintas por tipo de nodo — el propio nodo (subsección `Visibilidad`), dentro de `props.action`
en sus 7 variantes (subsección `Props`), dentro de `executeOperations.operations[]` (también `Props`), y dentro
del bloque `submitAction` de `form` (tratado aparte del resto de subsecciones, pasado entero a
`PropertyFieldDispatcher`). El patrón de parcheo a nivel de panel que ya existe solo cubre un nivel fijo dentro de
`props`; replicarlo en cada subsección duplicaría el criterio de detección tres o cuatro veces. Inyectar una vez
en el origen cubre automáticamente cualquier subsección o bloque que lo consuma después, sin tocar
`layout-canvas-properties-panel.tsx` en absoluto para este propósito.

**Alcance explícito — qué NO toca**: `dev-runtime-json-schema.ts` (schema de autocompletado de Monaco) queda sin
modificar; Monaco sigue mostrando el `oneOf` real completo, mismo precedente que `choice-items`.

**Riesgo aceptado**: la detección es por **nombre de campo**, no por forma estructural del fragmento. Verificado
contra `src/config/runtime-config-zod.ts` que hoy `visibility`/`when` son exclusivos de este contrato (ningún
otro campo del schema se llama así). Es el mismo criterio ya vigente para `icon` (D5 de features previas); un
campo futuro no relacionado que reutilizara alguno de esos dos nombres heredaría el widget por error — riesgo
bajo, ya aceptado como convención del proyecto.

### D3 — El widget no deriva su contenido del schema; construye su propia UI y sus propios defaults
`ConditionGroupPropertyField` recibe `{ label, value, onChange }` (mismo contrato que el resto de
`WIDGET_REGISTRY`) y no tiene visibilidad sobre ningún fragmento JSON Schema real — tras la sustitución (D1) no
queda `oneOf`/`required` que leer. Construye internamente:
- la detección de forma inicial (condición vs grupo) a partir de la forma de `value`, igual que hace hoy
  `resolveUnionBranch` (mismo criterio: `conditions` presente → grupo; si no, condición), sin reutilizar esa
  función (que opera sobre schema+valor, no solo valor).
- sus propias plantillas de valor por defecto por `operator`/tipo de `value` (no derivadas de
  `buildDefaultValueForSchema`, que ya no tiene schema real del que partir para esta unión).
- la reconciliación de `value`/`itemField` al cambiar `operator`, según las reglas ya fijadas en spec
  ("Reconstrucción al cambiar de operador").

Cada cambio sigue notificando vía el mismo `onChange` que ya usan las tres integraciones — el pipeline de
validación (`validateRuntimeConfig`) y el aviso `role="alert"` ante commit rechazado siguen viviendo en el
llamador (panel de `Layout` o `Shell`), no en el widget, igual que el resto de entradas del registro.

### D4 — Descomposición interna: una fila de condición reutilizada entre modo simple y filas de grupo
El widget se estructura internamente como: selector de forma → (condición simple **o** grupo). El grupo reutiliza
`SegmentedTogglePropertyField` para su `operator` (`and`/`or`) y renderiza N filas con un único sub-componente de
fila de condición (`reference`/`negate`/`operator`/`value` condicional/`itemField` condicional), el mismo
sub-componente usado para el modo "Condición simple". El selector de tipo de `value` (Texto/Número/Booleano/Null)
también reutiliza `SegmentedTogglePropertyField`. Esto cumple el requisito no funcional de la spec de no duplicar
lógica de edición de condición ni de `value` entre modos o integraciones.

## Riesgos y trade-offs
- **Detección por nombre de campo** (D2): riesgo bajo y ya documentado; ver D2.
- **Responsabilidad concentrada en un único componente** (selector de forma + grupo + condición + editor de
  `value` de 4 tipos + reconciliación por operador): mitigado por la descomposición interna (D4); no se propone
  dividirlo en varias entradas del registro porque la spec exige explícitamente un único componente reutilizado
  sin duplicar lógica entre las tres superficies.
- **Recorrido recursivo hasta `$defs`** (D2) es una superficie no ejercitada hoy por ningún `x-widget` existente
  (ninguno de los cinco actuales convive con un schema recursivo como el de `sidebarItem`). Riesgo de que el
  transform no alcance correctamente el `visibility` anidado en la rama `children` recursiva si la implementación
  no lo cubre explícitamente — se señala aquí para que la planificación incluya un caso de test dedicado
  (`sidebarItem.children[].visibility` a profundidad ≥ 2 recibe el widget).

## Migración o despliegue
No aplica. Cambio interno a la capa de edición visual del dev editor; sin persistencia, sin migración de datos,
sin cambio de contrato ni de comportamiento en producción o modo Visual.

## Preguntas abiertas
Ninguna bloqueante. La única duda técnica señalada por `spec.md` (mecanismo de enganche en las tres superficies)
queda resuelta en D1/D2. Las etiquetas de UI siguen como detalle de implementación no bloqueante, ya señalado
como tal por la propia spec.
