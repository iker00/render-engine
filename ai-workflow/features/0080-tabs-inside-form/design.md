# Design: Feature 0080 — Tabs como hijo de form

## Contexto

- `form.children` ya admite `container` y `accordion` como nodos estructurales intermedios. La spec exige extender ese catálogo con `tabs`.
- `form` no descubre sus campos por montaje del DOM: el handler de submit recorre el árbol de configuración mediante `collectResolvedFormFieldDefinitions` y `collectAllFormFieldIds` (`src/runtime/nodes/form-layout-node.tsx`). Hoy ambas funciones solo recursivan en `container` y `repeater`; `accordion` queda fuera intencionadamente porque sus campos solo participan tras montarse.
- El nodo `tabs` solo renderiza el panel activo en el DOM (`src/runtime/nodes/tabs-layout-node.tsx`). Los paneles inactivos no existen como nodos React.
- La spec exige una semántica intencionadamente distinta a la de `accordion`: todos los campos de todos los items con `visibility` verdadera deben participar en validación y submit, aunque su tab esté inactivo y por tanto no esté en el DOM.
- La validación previa al render vive en `src/config/validate-form-nodes.ts`. `validateFormNodesInCollection` ya recurre en `tabs.props.items[N].children` pero solo para detectar campos huérfanos. `validateFormChildren` (que aplica el allowlist de `form.children` y deduplica `fieldId`) no contempla `tabs`. `validateExecutionRequestParamsInCollection` (chequeo GET-con-body) tampoco recurre en `tabs`.
- El allowlist actual de `form.children` se enuncia en `src/config/runtime-config-zod.ts`, en el catálogo de nodos permitidos del schema de `form`, y se reaplica de forma semántica en `validateFormChildren`.

## Objetivos / No objetivos

### Objetivos
- Permitir `tabs` como hijo directo o transitivo de `form` reutilizando el contrato existente del nodo `tabs`.
- Que todos los campos de tabs con item `visibility` verdadera participen en validación, default values y payload del submit del formulario contenedor, independientemente del tab activo.
- Mantener la deduplicación de `fieldId` y el bloqueo de nodos prohibidos (`fileManager`) atravesando recursivamente los items de tabs dentro de form.
- Atravesar también los `tabs` dentro de form en la validación de GET-con-body de `executeOperation`, `executeOperations`, `onSuccess` y `onError`.

### No objetivos
- Cambiar la estrategia de render de `tabs` (sigue habiendo un solo panel en el DOM).
- Mostrar errores visuales en la barra de tabs ni auto-saltar al primer tab con errores.
- Alterar la semántica de `accordion` dentro de form.
- Tocar el comportamiento de `tabs` fuera de form.
- Introducir un nuevo tipo de contexto React para señalar "tabs dentro de form": no hace falta porque la lógica vive en el form, no en tabs.

## Decisiones

### D1. Extender el recorrido de campos del form para incluir tabs
Añadir un caso explícito para `tabs` en las dos funciones que ya recorren el árbol de configuración del formulario:
- `collectResolvedFormFieldDefinitions(node.children, state, iterationContext)`: cuando el nodo es `tabs`, iterar los items y, por cada item cuya `item.visibility` evalúe como visible con `matchesVisibilityRule`, recursar en `item.children`. Los items con `visibility` falsa quedan fuera del conjunto resuelto.
- `collectAllFormFieldIds(node.children)`: cuando el nodo es `tabs`, iterar todos los items sin filtrar visibilidad y recursar en `item.children` para incluir todos los `fieldId` configurados.

Justificación:
- Permite reutilizar toda la lógica vigente de inicialización, validación y submit del formulario sin tocar el render de `tabs`. Los campos de tabs inactivos quedan inicializados (`fieldsNeedingInitialization` los ve), participan en `validateFormFields` y aparecen en el payload aunque su panel no esté en el DOM.
- El cálculo de `hiddenFieldIds = collectAllFormFieldIds - visibleFieldIds` produce automáticamente la omisión del payload para items ocultos por `visibility` (porque entran en "all" pero no en "visible"), respetando la semántica existente de campos ocultos.
- Mantiene la asimetría intencional con `accordion`, que sigue sin participar en `collectResolvedFormFieldDefinitions` ni `collectAllFormFieldIds`. La spec lo exige.

Alternativas descartadas:
- Renderizar todos los paneles dentro de form (con CSS oculto los inactivos). Cambiaría el contrato de render del nodo `tabs` y obligaría a propagar contexto "estoy dentro de form" hasta `tabs`. Más invasivo y peor performance para tabs ricos visualmente. Se descarta.
- Pre-walk del árbol al iniciar el form para inyectar definiciones de campos en un store paralelo. Reimplementaría la inicialización lazy y duplicaría caminos de defaults. Se descarta.

Trade-off asumido:
- Cuando el submit falla por un `required` de un campo en un tab inactivo, el error queda en el store pero el nodo de input no está montado y por tanto el usuario no ve el mensaje hasta que conmuta de tab. Está dentro de los no objetivos de la spec (indicación visual y auto-switch quedan explícitamente fuera).

### D2. No alterar el render de `tabs`
El componente `TabsNode` sigue renderizando únicamente el panel activo. No se propaga ningún contexto adicional de form a `tabs` y no se introducen variantes condicionales en su render.

Justificación:
- Toda la semántica nueva se resuelve en el dominio del form (recorrido de configuración + store). Mantener `tabs` agnóstico simplifica el cambio, evita regresiones en uso fuera de form y respeta el no objetivo de cambiar el comportamiento de `tabs` fuera de form.

### D3. Ampliar la validación previa al render para `form.children` con `tabs`
Cambios concretos en `src/config/validate-form-nodes.ts` y, si procede, en `src/config/runtime-config-zod.ts`:
- Añadir `tabs` al allowlist semántico de `validateFormChildren` (mensaje de error y rama de aceptación).
- En `validateFormChildren`, tras aceptar un nodo `tabs`, iterar `node.props.items` y, por cada item, recursar `validateFormChildren(item.children, ...path...)` reutilizando el contexto del form (`currentFormId`, `fieldIds`). Esto cubre deduplicación de `fieldId` entre items y rechazo de `fileManager` dentro de tabs.
- En `validateExecutionRequestParamsInCollection`, añadir el caso `tabs` para recursar `node.props.items[N].children` y verificar GET-con-body en operaciones declaradas dentro de tabs.
- Si el zod schema de `form` declara explícitamente el discriminated set de tipos de `children`, añadir `tabs` allí también para que el error de tipo no permitido se detecte antes incluso de llegar a la validación semántica. Si el shape se valida por el catálogo general de nodos y el allowlist solo está en `validateFormChildren`, basta con tocar la capa semántica.

Justificación:
- Reproduce el mismo patrón ya usado para `container` y `accordion`, manteniendo la consistencia del recorrido y los mensajes `invalid-layout` con rutas canónicas (`...props.items[N].children[M]...`).
- `validateFormNodesInCollection` (la pasada externa) ya recurre en `tabs.props.items[N].children` para campos huérfanos cuando no hay form ancestro; ese recorrido sigue siendo correcto y no requiere cambios.

Trade-off asumido:
- El recorrido se duplica en dos planos (general y form-children) por la separación actual de responsabilidades del validador. No se intenta unificarlo en esta feature; alinear ambos recorridos sería refactor independiente.

### D4. Estrategia para `tabs.props.items[].visibility` en el recorrido del form
`collectResolvedFormFieldDefinitions` ya recibe `state` y la `iterationContext`, así que puede llamar a `matchesVisibilityRule(item.visibility, state, iterationContext)` (mismo helper que usa `TabsNode`) para decidir qué items contribuyen al conjunto resuelto.

`collectAllFormFieldIds` es síncrona, sin estado, y representa el universo configurado del form. Mantenerla sin filtros preserva su contrato actual y produce el `hiddenFieldIds` correcto sin lógica adicional.

Justificación:
- La asimetría entre las dos funciones es intencional y replica cómo se evalúan los campos hoy ocultos por `visibility` a nivel de campo.

## Riesgos y trade-offs
- Riesgo bajo: defaults dinámicos en campos de tabs inactivos. `resolveFieldDefaultValue` se ejecuta con `state` actual al inicializar el form; si el defaultValue depende de una `queries.*` aún no resuelta, se aplica el `fallbackValue` igual que hoy ocurre con cualquier campo no resuelto. Mitigación: ninguna específica; el comportamiento es el mismo que para fields hermanos del mismo form.
- Riesgo medio: errores de validación invisibles cuando el campo problemático vive en un tab inactivo. La spec lo acepta explícitamente. Mitigación: documentar el comportamiento en `forms/lifecycle.md` y `nodes/tabs.md` para que el usuario entienda por qué el submit puede fallar sin error visible.
- Riesgo bajo: la doble pasada de recorrido (configuración + DOM) puede divergir si en el futuro tabs muta su shape. Mitigación: cubrir con tests específicos de `collectResolvedFormFieldDefinitions` y `collectAllFormFieldIds` recursando tabs.
- Trade-off: se mantiene la asimetría histórica entre `accordion` (no recorrido) y `tabs` (recorrido). Es la diferencia semántica que la spec exige, no un defecto del diseño.

## Migración o despliegue
- No hay migración de datos ni cambios de contrato observables que rompan configuraciones existentes.
- Configuraciones previas con `tabs` fuera de form siguen siendo válidas y se comportan igual.
- Configuraciones que hoy fallarían por declarar `tabs` dentro de form pasarán a aceptarse; no hay riesgo de regresión silenciosa porque la transición es de error → válido.

## Preguntas abiertas
Ninguna bloqueante.
