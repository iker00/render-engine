# Design: Feature 2026-08-24-13-02 - repeater-grid-mode

## Contexto
- `repeater` hoy nunca introduce markup propio: expande `props.template` por iteración como hermanos React vía un `Fragment` (`RepeaterNodeContent` en `src/runtime/nodes/repeater-layout-node.tsx`), independiente de la paginación local (`previousNext`/`numbered`/`scroll`).
- `container` ya posee todo el vocabulario de "modo grid" que pide esta feature: `props.columns` (fijo o responsive), `props.gap` (escala estable + compatibilidad heredada con CSS arbitrario), `props.align`, `props.justify`. Todo se construye en `getContainerNodeStyling` (`src/runtime/runtime-node-styling-container.ts`) y se valida con `containerNodeSchema` (`src/config/runtime-config-zod.ts`), que ya reutiliza `responsiveLayoutValueSchema` (el mismo shape que usa `layout.span`).
- La ocupación de celdas de un hijo (`layout.span`) es un mecanismo transversal que vive en `src/runtime/layout-node-renderer.tsx`: lee `parentGridColumns` del `RuntimeLayoutContext` (que `ContainerNode` publica vía `RuntimeLayoutContextProvider`) y envuelve cualquier nodo visible —excepto `repeater`, `modal` y `hidden`— en un `<div class="col-span-*">` mediante `getGridChildSpanClassName` cuando hay `layout.span` declarado y un grid ancestro activo. `repeater` está excluido hoy sin condición porque nunca es "una caja": un `Fragment` de N iteraciones no puede recibir un único `col-span`.
- Los controles de paginación del repeater ya leen `parentGridColumns` (`getRepeaterPaginationControlsClassName`, en `runtime-node-styling-repeater-pagination.ts`) para ocupar el ancho completo de fila cuando el repeater está anidado dentro de un `container` en modo grid ANCESTRO. Ese mecanismo es independiente del grid propio que introduce esta feature y no debe modificarse.
- El editor visual (`src/dev-runtime/layout-canvas/`) expone un property panel dirigido por schema: `layout-canvas-node-schema.ts` mapea tipo de nodo → schema Zod, y `property-field-dispatcher.tsx` resuelve el widget genéricamente a partir de la forma del JSON Schema, con overrides puntuales vía `x-widget` (ej. `container-columns-mode-property-field.tsx`). Existe además un resolver estático de "columnas del container ancestro más cercano" (`layout-canvas-ancestor-container-columns.ts`) que el panel usa para ofrecer opciones válidas de `layout.span` mientras se edita.

## Objetivos / No objetivos

### Objetivos
- Cerrar las dos decisiones técnicas señaladas como bloqueantes en `spec.md` ("Riesgos o preguntas abiertas").
- Definir un mecanismo de reutilización de código real entre `container` y `repeater` para la superficie de grid (`columns`, `gap`, `align`, `justify`), respondiendo directamente a la petición del usuario, sin forzar a ambos nodos a compartir concerns que no comparten.
- Mantener el invariante "`repeater` sin `columns` no introduce markup propio" byte-idéntico al comportamiento actual.

### No objetivos
- No tocar `direction`, `wrap` ni `variant: card` de `container`.
- No fijar aquí el widget exacto del property panel para cada campo nuevo; solo la estrategia (reutilizar el dispatcher schema-driven) y el módulo del editor afectado.
- No definir el shape final de tests ni trocear tareas; eso pertenece a `generate-implementation-plan`.

## Decisiones

### D1 — Extraer la construcción de clases de grid a código común
Se extrae la construcción de clases de `columns`/`gap`/`align`/`justify` (hoy privada dentro de `runtime-node-styling-container.ts`) a una función compartida en `runtime-node-styling-base.ts` —el módulo que ya concentra la mecánica transversal de grid junto a `getGridChildSpanClassName`—, con forma aproximada `getGridLayoutClassNames({ columns, gap, align, justify }): { classNames: string[]; style?: CSSProperties }`. `getContainerNodeStyling` pasa a delegar en ella para su rama grid y añade solo sus propios extras (`variant: card`, ausencia de `wrap` en modo grid). Un nuevo módulo de estilo de `repeater` —siguiendo el patrón ya establecido de un fichero por nodo, junto a `runtime-node-styling-repeater-pagination.ts`— delega en la misma función para construir la clase de su propio wrapper.

- Alternativa descartada: que `repeater` invoque directamente `getContainerNodeStyling` pasando `direction`/`wrap`/`variant` como `undefined`. Se descarta porque acopla la superficie de `repeater` a la firma completa de `container`, incluyendo props que `repeater` nunca soportará (contradice el "Alcance" de `spec.md`).
- Coste asumido: un refactor menor de `getContainerNodeStyling` y una función nueva en el módulo base; riesgo bajo, cubierto por los tests existentes de `container`.

### D2 — Reutilización del contrato de validación (Zod) y de su mapeo de errores
`repeaterNodeSchema.props` gana `columns` (mismo `responsiveLayoutValueSchema` que usa `container`), `gap` (mismo `z.string().optional()`), `align` (mismo enum `supportedContainerAlignValues`) y `justify` (mismo enum `supportedContainerJustifyValues`). Cero catálogos nuevos.

El mapeo de rutas de error para estos cuatro campos es hoy código casi idéntico en `validate-container-node.ts`. Se extrae un mapper nuevo (mismo patrón que los ya existentes `mapLayoutNodeIssue`/`mapQueryStateFeedbackIssue`/`mapVisibilityIssue`, importados por ambos validadores) que reconoce `issuePath[0] === 'props' && ['columns','gap','align','justify'].includes(issuePath[1])` y genera el mensaje `enrichedInvalidLayout` a partir del nombre del campo. Tanto `validate-container-node.ts` como `validate-repeater-node.ts` lo consumen.

- Alternativa descartada: duplicar los cuatro `if` de mapeo de error dentro de `validate-repeater-node.ts` tal cual existen en `validate-container-node.ts`. Se descarta porque `conventions.md` exige centralizar validaciones repetibles que forman parte del contrato del producto, y aquí el contrato es literalmente idéntico.
- Alternativa descartada: renombrar `supportedContainerAlignValues`/`supportedContainerJustifyValues` a nombres neutrales (`supportedGridAlignValues`, etc.) ya que pasan a ser compartidos. Se descarta para no ampliar el blast radius a todos los usos actuales de esas constantes; queda como trade-off cosmético aceptado, no como deuda funcional.

### D3 — `layout.span` sobre el propio nodo `repeater` (resuelve la pregunta abierta #1 de `spec.md`)
`layout.span` declarado directamente sobre `repeater` pasa a tener efecto sobre el wrapper de grid del propio repeater, pero **solo cuando ese repeater está en modo grid** (`props.columns` presente). Sin `columns`, se mantiene la exclusión actual sin cambios.

Mecanismo: en `layout-node-renderer.tsx`, la condición de exclusión pasa de `node.type === 'repeater'` (siempre) a `node.type === 'repeater' && node.props.columns === undefined`. El resto de la lógica —`getGridChildSpanClassName(node.layout?.span, parentGridColumns)`— no cambia: sigue leyendo el `parentGridColumns` del contexto del ANCESTRO (el `container` o `repeater` padre), exactamente igual que para cualquier otro nodo de una sola caja.

- Por qué: es la extensión mínima y simétrica de una regla ya existente ("nodo de una sola caja ⇒ elegible para span"), no una regla nueva especial para `repeater`. Antes de esta feature, `repeater` nunca era "una caja"; en modo grid, sí lo es.
- Alternativa descartada: mantener la exclusión total de `layout.span` sobre `repeater` incluso en modo grid, delegando siempre en el nodo raíz de `template` (como hoy). Se descarta porque el propio `spec.md` detecta la asimetría: ahora el repeater sí genera wrapper, así que negar el span sobre ese wrapper sería inconsistente con cómo se trata cualquier otro nodo con wrapper propio.
- Riesgo residual: ningún test existente fija hoy comportamiento de `layout.span` sobre `repeater` en modo grid (el modo no existía), así que no hay contrato previo que romper; el riesgo es solo de cobertura nueva, a resolver en `generate-implementation-plan`.

### D4 — Wrapper condicional y convivencia con el borde "sin markup propio" (resuelve la pregunta abierta #2 de `spec.md`)
Dentro de `RepeaterNodeContent`, la bifurcación es únicamente `node.props.columns !== undefined`:

- **Sin `columns`** (default): comportamiento actual byte-idéntico — `Fragment` de `LayoutRenderer` por iteración como hermanos, controles de paginación como hermano final. Cero cambio de código más allá de la propia bifurcación.
- **Con `columns`**: las iteraciones visibles (`visibleIterations`) se envuelven en un único `<div>` con las clases de D1, y ese `<div>` se envuelve a su vez en `RuntimeLayoutContextProvider` con `parentGridColumns: node.props.columns` —el mismo componente que ya usa `ContainerNode`—. Los controles de paginación/scroll se renderizan como hermanos de ese `<div>`, fuera de él, leyendo el `parentGridColumns` que `RepeaterNodeContent` ya recibe hoy como prop (el del ANCESTRO), preservando exactamente el spanning actual de los controles dentro de un grid padre.

- Por qué: reutiliza el mismo patrón proveedor/consumidor de contexto que `container` ya usa para propagar `parentGridColumns` a sus hijos, satisfaciendo el requisito del spec de reusar "el mismo mecanismo ya documentado", sin tocar la resolución de `item.*`, keys, ni las variantes de paginación, que siguen operando igual sobre `visibleIterations` — el grid es una envoltura puramente visual añadida después de calcular qué iteraciones son visibles.
- Alternativa descartada: que `repeater` renderizara siempre un wrapper (con o sin `columns`), usando `display: contents` cuando no hay grid, para unificar el código. Se descarta porque cambia el árbol DOM siempre —aunque sea con `display:contents`— rompiendo el invariante literal "sin markup propio" que varios tests fijan hoy explícitamente para el caso sin grid; el spec exige preservar ese caso sin regresión.
- Trade-off aceptado: la bifurcación añade una rama a un componente ya complejo (paginación + scroll + modal ids). Se acepta porque la alternativa (unificar ambos caminos) es más arriesgada para el invariante existente.

### D5 — Modo edición (`isEditMode`) del canvas
El wrapper de grid de D4 se aplica también en modo edición, envolviendo la única iteración de muestra que ya renderiza `RepeaterNode` cuando `isEditMode` es `true`, en vez de mantener el `return` temprano sin wrapper. Es la misma lógica de estilo de D1, sin paginación (ya se omite en edición hoy).

- Por qué: `ContainerNode` no distingue entre modo visual y modo edición para su propio styling; tratar el grid del repeater como excepción solo en edición introduciría una asimetría no justificada ni por el spec ni por el código existente (ver el comentario ya presente en `layout-node-renderer.tsx` sobre no remontar el subárbol de un nodo al cambiar de modo).
- Área afectada (sin detalle de fichero, corresponde a planificación): el resolver estático de "columnas del container ancestro más cercano" que usa el property panel del editor debe reconocer también a un `repeater` en modo grid como ancestro de columnas, igual que a un `container`, para que las opciones de `layout.span` que ofrece el panel al editar el nodo raíz de `props.template` sean correctas.
- Riesgo residual: no se ha verificado a nivel de código si el dispatcher de property fields (`x-widget`) expondrá los nuevos campos de `repeater` sin trabajo adicional más allá de extender el schema Zod (D2). La estrategia general —dispatcher genérico + mismos sub-schemas— ya está decidida y reduce la superficie esperada; la verificación puntual se hace en `generate-implementation-plan` antes de trocear las tareas de editor.

### D6 — Clamp de `layout.span` del nodo raíz del `template` dentro del grid del repeater
No requiere mecanismo nuevo: al proveer `parentGridColumns = node.props.columns` vía el mismo `RuntimeLayoutContextProvider` de D4, el mecanismo ya existente en `layout-node-renderer.tsx` / `getGridChildSpanClassName` clampa automáticamente el `layout.span` del nodo raíz visible de cada iteración exactamente igual que hoy lo hace para hijos directos de un `container`. Se documenta como decisión explícita porque el spec lo pide como requisito funcional (#5, #8), pero es consecuencia directa de D4, no un mecanismo nuevo.

## Riesgos y trade-offs
- `repeater-layout-node.tsx` es ya el fichero más complejo del catálogo de nodos (paginación, scroll, modal ids, keys). Añadir la bifurcación de grid incrementa su complejidad. Mitigación: la rama grid delega toda la construcción de clases en el helper compartido de D1, manteniendo `RepeaterNodeContent` centrado en orquestación, no en estilo.
- Riesgo de regresión confinado: la rama sin `columns` es byte-idéntica a hoy, así que ningún test que fije "repeater no tiene wrapper" debería verse afectado; toda la superficie nueva de riesgo está en la rama con `columns`, que no tenía comportamiento previo que romper.
- Trade-off de nombres (D2): las constantes `supportedContainerAlignValues`/`supportedContainerJustifyValues` quedan compartidas por `repeater` sin renombrarse; aceptado para no ampliar el blast radius.
- Riesgo de editor (D5): alcance exacto del property panel no verificado a nivel de fichero; riesgo bajo por la estrategia general ya decidida, pero requiere una verificación puntual antes de planificar las tareas de editor.

## Migración o despliegue
No aplica: `repeater.props.columns` es un campo opcional nuevo. Cualquier configuración existente sin `columns` sigue sin cambios de comportamiento; no hay migración de datos ni de contratos previos.

## Preguntas abiertas
Ninguna bloqueante para planificar. El riesgo residual de D5 sobre el alcance exacto del dispatcher de property fields del editor se resuelve verificando ese código al inicio de `generate-implementation-plan`, antes de trocear las tareas que tocan el editor — no requiere una decisión de arquitectura adicional, solo confirmar el punto de extensión ya elegido.
