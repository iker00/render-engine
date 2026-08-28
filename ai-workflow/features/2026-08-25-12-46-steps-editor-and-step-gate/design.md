# Design: Feature 2026-08-25-12-46 - steps-editor-and-step-gate

## Contexto
`steps` (`src/runtime/nodes/steps-layout-node.tsx`) es hoy el único nodo estructural con hijos por item (`props.items[i].children`) que no tiene soporte de edición visual: a diferencia de `tabs`, no acepta un `path` propio, así que sus hijos no son seleccionables ni arrastrables en el dev-editor. `TabsNode` ya resuelve exactamente este mismo problema con un mecanismo estable y testeado:

- `layout-node-path.ts` modela cada hijo de un item de `tabs` como un paso `{ field: 'tabItem', itemIndex, index }` en `LayoutNodePath`, con su propia serialización (`tabItem.{itemIndex}.{index}`) y resolución en `getNodeAtPath`.
- `layout-tree-mutations.ts` sabe leer/escribir esa colección (`withTabItemChildren`) y acepta un `tabItemIndex`/`toTabItemIndex` explícito en `insertNodeAt`/`movePathTo` para desambiguar en qué item se inserta o hacia qué item se mueve un nodo.
- `layout-drop-validity.ts` trata un `tabs` como destino "sin restricción de tipo" (como `container`) solo cuando el drop declara `targetTabItemIndex`, y sin ese índice lo rechaza.
- `TabsNode` (`tabs-layout-node.tsx`) recibe `path` y pasa a `LayoutRenderer` un `buildChildPath` que añade el paso `tabItem` y un `parentTabItemIndex`, que `layout-renderer.tsx` reenvía como `tabItemIndex` al wrapper de selección/drop de cada hijo.

Para el modo Editor sin gating, `accordion` (`accordion-layout-node.tsx`) ya resuelve el problema análogo: lee `useLayoutEditModeContext()` y usa `isEditMode` para forzar que su cuerpo esté siempre en el DOM, sin que eso dependa de su estado local `isOpen`.

Para `onNext`, la fachada de ejecución ya existe y es la misma que usan `button.props.action.executeOperation` y `form.submitAction`: `executeQueryOperation(operationName, options)` de `useRuntimeStateActions()`, expuesta en `src/queries/` y consumida hoy desde `form-layout-node.tsx` (`handleSubmit`) de forma `async`/`await`, devolviendo `{ status, data, error }` directamente sin que el llamador tenga que suscribirse aparte a `queries.*`.

Esta spec pide adaptar estos tres mecanismos ya vigentes a `steps`, no inventar ninguno nuevo.

## Objetivos / No objetivos

### Objetivos
- Definir el mecanismo concreto de path/mutación/validez de drop para los hijos de un item de `steps` (`stepItem`), como paralelo estructural de `tabItem`.
- Definir cómo `StepsNode` detecta modo Editor y qué gating deja de aplicar en ese modo.
- Definir el punto de integración exacto entre validación de campos del paso, ejecución de `onNext` y el disparo de `submitAction` del `form` padre, sin introducir un segundo motor de submit.

### No objetivos
- No se diseña ningún cambio de comportamiento de `tabs` o `accordion`; el mecanismo de `steps` es una copia estructural paralela, no una generalización de `tabItem`/`accordion` (ver Decisión D1 sobre la alternativa descartada).
- No se diseña un panel de propiedades dedicado a `steps` (sigue fuera de alcance, como ya fija la spec).
- No se diseña ningún mecanismo de reintento automático, merge de payloads, ni corrección del gap preexistente de `findInvalidActionTarget` (ver spec, riesgo residual).

## Decisiones

### D1 — `stepItem` como paso de path paralelo a `tabItem`, no una generalización
`layout-node-path.ts` gana un nuevo miembro de `LayoutPathStep`: `{ field: 'stepItem'; itemIndex: number; index: number }`, con:
- rama de resolución en `getNodeAtPath` idéntica a la de `tabItem` pero leyendo `currentNode.type === 'steps'` y `props.items[itemIndex].children`,
- serialización `stepItem.{itemIndex}.{index}` en `serializeLayoutNodePath`/`deserializeLayoutNodePath` (mismo formato de 3 tokens que `tabItem`),
- un campo `stepItemIndex?: number` en `LayoutCanvasDropZone` y en su serialización de id (`serializeDropZoneId`/`parseDropZoneId`), paralelo a `tabItemIndex`.

**Alternativa descartada**: generalizar `tabItem`/`stepItem` en un único paso `{ field: 'item', nodeType, itemIndex, index }` compartido. Se descarta porque tocaría el contrato ya estable y testeado de `tabItem` (formato de serialización, ids de drop zone, opciones de mutación) en múltiples ficheros sin ninguna ganancia funcional, y la propia spec excluye explícitamente cualquier cambio de comportamiento de `tabs`. Un mecanismo paralelo mantiene el código y los tests de `tabs` completamente intactos, al coste de cierta duplicación estructural entre `tabItem` y `stepItem`.

### D2 — Mutaciones de árbol: `withStepItemChildren` y `stepItemIndex`/`toStepItemIndex`
`layout-tree-mutations.ts` gana un helper `withStepItemChildren` (espejo de `withTabItemChildren`) y las opciones `InsertNodeAtOptions`/las de `movePathTo` ganan `stepItemIndex`/`toStepItemIndex` (espejo de `tabItemIndex`/`toTabItemIndex`). `insertNodeAt` y `movePathTo` añaden una rama `parentNode.type === 'steps'` con la misma forma que la rama ya existente para `'tabs'` (exige el índice, valida que el item exista, opera sobre `withStepItemChildren`).

### D3 — Validez de drop: rama `steps` en `isValidDropTarget`
`layout-drop-validity.ts` añade una opción `targetStepItemIndex` y una rama `targetParentNode.type === 'steps'` estructuralmente idéntica a la rama ya existente de `'tabs'`: exige `targetStepItemIndex`, valida que esté en rango de `props.items`, y se trata como un aceptador sin restricción de tipo (igual que `container`), saltándose el chequeo genérico `nodeTypeAcceptsChildren` (que ya excluye a `steps` de su raíz, igual que ya excluye a `tabs`, así que no requiere cambios). `hasFormAncestor` no necesita cambios: como `steps` solo es válido dentro de `form`, el recorrido de ancestros ya vigente encuentra ese `form` sin lógica adicional.

### D4 — `StepsNode` gana `path` y lo propaga con `stepItem`
`steps-layout-node.tsx` añade la prop `path?: LayoutNodePath` (que hoy no tiene, a diferencia de `TabsNode`) y `layout-node-renderer.tsx` la pasa en su rama `steps`, igual que ya hace en la rama `tabs`. Dentro de `StepsNodeContent`, el panel del paso activo se renderiza con `LayoutRenderer` pasando `buildChildPath` (que añade un paso `stepItem` con `itemIndex: effectiveActiveIndex`) y `parentStepItemIndex` — el mismo patrón que `parentTabItemIndex`, que `layout-renderer.tsx` reenvía como `stepItemIndex` al wrapper de selección/hover de cada hijo (hoy ese wrapper ya acepta `tabItemIndex`; gana el análogo `stepItemIndex`). Esto resuelve directamente la selección individual de hijos exigida en el requisito 3 de la spec.

### D5 — Detección de modo Editor y gating suspendido
`StepsNode` llama a `useLayoutEditModeContext()` igual que `AccordionNode`, derivando `isEditMode`. Dos puntos cambian cuando `isEditMode` es `true`:
- **Indicador clicable** (`horizontal`/`vertical`): `isClickable` pasa de `position <= maxVisitedPosition` a `isEditMode || position <= maxVisitedPosition` — cualquier paso visible es clicable sin tocar `maxVisitedIndex` (que sigue siendo irrelevante en modo Editor, ya que no se usa para nada más).
- **`handleNext`**: en modo Editor, se salta tanto `validateFormFields` como cualquier ejecución de `onNext` (ver D7) y avanza `activeIndex` directamente al siguiente paso visible, sin tocar `maxVisitedIndex`. Esto cubre los requisitos 4, 6 y 7 de la spec (navegación libre, sin gating de validación, sin disparo real de `onNext`) con el mismo criterio que ya usa `accordion` para mantener su contenido accesible en modo Editor.

El botón del último paso en modo Editor no necesita ningún cambio adicional más allá de no ejecutar `onNext` (cubierto por el mismo guard de D5/D7): el propio submit del `form` ya está suprimido de forma centralizada en modo Editor (mecanismo ya vigente, documentado en dev-mode-editor.md § Modo Editor: supresión de comportamiento propio), así que un `requestSubmit()` disparado en modo Editor no tiene ningún efecto observable adicional al que ya tiene hoy un botón de submit dentro de un `form` en modo Editor.

### D6 — Contrato de `onNext` y validación
`props.items[i].onNext` se añade al esquema `Zod` de `steps` como objeto opcional con el mismo shape que ya existe factorizado para la variante `executeOperation` de `button.props.action`/`form.submitAction` (`operationName` obligatorio no vacío, `query`/`body`/`headers` opcionales), reutilizando ese fragmento existente en vez de duplicar el shape una tercera vez. La validación cruzada añade dos comprobaciones ya existentes para los otros consumidores de `executeOperation`, aplicadas ahora también a `steps.props.items[i].onNext`:
- `operationName` debe existir en `api` (mismo chequeo que ya usan `button.props.action.operationName`/`form.submitAction.operationName`).
- si la operación referenciada es `GET`, `onNext` no puede declarar `body` (mismo chequeo que ya se aplica a `button.props.action`/`form.submitAction` sobre operaciones `GET`).

### D7 — Integración paso intermedio: `handleNext` async con gating por query
`handleNext` pasa a ser `async`. Tras superar la validación de campos existente (sin cambios), si `activeItem.onNext` está declarado:
1. Se marca `isOnNextPending = true` (estado local del componente) — controla el `disabled`/indicador de carga de "Siguiente" (requisito 11).
2. Se llama a `executeQueryOperation(onNext.operationName, { snapshotState, requestParams: { query, body, headers }, iterationContext })` — la misma fachada y la misma forma de payload que usa hoy `button.props.action.executeOperation` (no la forma de `form.submitAction`: `onNext` no es un submit, así que no lleva `hiddenFormFields`/`emptySubmitValues`/`fileInputSources` — la omisión de campos ocultos es explícitamente exclusiva de submit según `queries/execution.md`).
3. Si `result.status === 'success'`, se procede exactamente como hoy sin `onNext` (avanza `activeIndex`/`maxVisitedIndex`).
4. Si `result.status === 'error'`, se guarda `result.error.message` en un estado local `onNextError` (por instancia de `steps`, no por paso) y no se avanza.
5. `isOnNextPending` vuelve a `false` en ambos casos.

`onNextError` se limpia al iniciar un nuevo intento y cuando `effectiveActiveIndex` cambia (efecto), para que el mensaje de error solo sea visible mientras el usuario sigue en el paso que lo produjo (requisito 16, y evita que un mensaje de un intento previo se vea junto a un paso distinto). Se renderiza junto a `steps-navigation`.

**Guard de respuesta obsoleta**: como `handleNext` es `async`, el paso activo puede cambiar mientras la promesa está en curso (el usuario puede pulsar "Atrás" — que la spec no bloquea durante `loading` — o el paso activo puede reactivarse automáticamente por un cambio de `visibility`, requisito 18). El cierre `async` captura el índice de paso para el que se invocó antes del `await`; al resolver, compara ese índice capturado contra una `ref` que siempre refleja el paso activo vigente (una variable de estado capturada antes del `await` quedaría obsoleta por construcción). Si difieren, el resultado se descarta sin avanzar el paso ni mostrar el error — cumple literalmente el requisito 18 ("el resultado de esa query, cuando llegue, no tiene ningún efecto sobre la navegación").

### D8 — Integración último paso: `requestSubmit()` en vez de un segundo pipeline de submit
El botón del último paso se renderiza hoy siempre como `<button type="submit">`, dependiendo del submit nativo del `<form>` para llegar a `handleSubmit` de `form-layout-node.tsx`. Decisión: cuando `activeItem.onNext` está declarado, ese botón se renderiza como `type="button"` con un `onClick` que:
1. ejecuta la misma validación de campos del paso que `handleNext` (sin declarar el paso "avanzado", ya que es el último),
2. si es válida, ejecuta `onNext` con el mismo gating de D7 (pending/error/guard de respuesta obsoleta),
3. si `onNext` resuelve en éxito, llama a `event.currentTarget.form?.requestSubmit()` para disparar un submit nativo real, reutilizando sin modificar el pipeline completo ya existente de `form-layout-node.tsx` (validación de todo el árbol, `submitAction`, `onSuccess`/`onError`, `resetOnSuccess`).

Cuando el item no declara `onNext`, el botón sigue siendo exactamente `type="submit"` sin ningún `onClick` interceptor: cero cambio de comportamiento para el caso ya existente (requisito 14).

**Alternativa descartada**: que `StepsNode` llame él mismo a `executeQueryOperation` para el `submitAction` y fusione resultados con el de `onNext`. Se descarta porque la propia spec prohíbe explícitamente cualquier mecanismo de merge, y porque duplicaría en `steps-layout-node.tsx` la omisión de campos ocultos, `emptySubmitValue`, `resetOnSuccess` y `onSuccess`/`onError` que deben seguir centralizados en `form-layout-node.tsx` como única fuente de verdad del submit.

## Riesgos y trade-offs
- **Duplicación estructural `tabItem`/`stepItem`**: aceptada explícitamente en D1 para no arriesgar el comportamiento ya estable de `tabs`. Si en el futuro aparece un tercer nodo con la misma necesidad, sería el momento de reconsiderar una generalización real.
- **`isOnNextPending` es un único flag por instancia de `steps`, no por paso**: si el usuario pulsa "Atrás" mientras `onNext` está en curso, el botón "Siguiente"/"Enviar" del nuevo paso activo queda deshabilitado hasta que la petición en vuelo resuelva, aunque ese paso no tenga relación con la operación en curso. Es una limitación de UX menor y consciente, no un bug de datos (el guard de D7 impide cualquier efecto incorrecto sobre la navegación); no se diseña un flag por paso porque solo puede haber un `onNext` en vuelo a la vez y no lo pide ningún criterio de aceptación.
- **Riesgo preexistente ya señalado por la spec**: `findInvalidActionTarget` no valida hoy `operationName` de acciones anidadas dentro de `tabs.props.items[i].children`/`steps.props.items[i].children`. `onNext` no depende de esa validación (cuelga de `props.items[i]`, no de `children`), así que esta feature no lo agrava ni lo corrige.

## Migración o despliegue
No aplica: no hay datos persistidos que migrar ni contrato previo que romper. `onNext` es un campo nuevo opcional; un config existente sin él sigue funcionando sin cambios (requisito 14).

## Preguntas abiertas
Ninguna bloqueante. Las decisiones D1-D8 fijan el mecanismo concreto para las tres incertidumbres técnicas que dejaba abierta la spec (`stepItem`, detección de modo Editor en `StepsNode`, integración validación → `onNext` → `submitAction`).
