# Design: Feature 2026-08-25-09-27 - form-steps

## Contexto
`steps` es un nodo estructural nuevo, exclusivo de `form`, que organiza un formulario en pasos secuenciales con navegación gateada por validación. Es el nodo más cercano en shape a `tabs` (`props.items` con `label`/`visibility`/`children`), pero diverge de él en dos puntos que el runtime actual no soporta directamente:

1. **Inicialización lazy por paso** — `tabs` dentro de `form` inicializa de forma eager los campos de **todos** los tabs al montar (`FormNode`, `collectResolvedFormFieldDefinitions` en `src/runtime/nodes/form-layout-node.tsx`). `steps` requiere lo contrario: solo el paso activo se inicializa, y cada paso siguiente se inicializa al activarse por primera vez.
2. **Validación parcial gateada** — hoy el motor solo valida el formulario completo en submit (`validateFormFields` se invoca una vez, con todos los campos visibles). `steps` necesita invocar ese mismo motor sobre un **subconjunto** de campos (los del paso activo) al pulsar "Siguiente", sin que el submit del formulario cambie de comportamiento.

`validateFormFields` (`src/runtime/runtime-form-validations.ts`) ya acepta una lista arbitraria de `ResolvedFormFieldDefinition[]` como parámetro — no está acoplada a "todos los campos del form". Esto significa que el motor de validación **no necesita cambios**: la pieza que falta es solo el mecanismo para resolver "los campos del paso actual" y para inicializar campos de forma progresiva en vez de eager.

`FormNode` centraliza hoy el descubrimiento de campos con una función recursiva privada (`collectResolvedFormFieldDefinitions`) que ya trata `container`, `repeater` y `tabs` como nodos "transparentes" (recorre sus hijos) y usa el resultado tanto para:
- decidir qué campos inicializar al montar (`fieldsNeedingInitialization`),
- renormalizar valores de campos de selección tras cambios de colección,
- recalcular el conjunto completo en `handleSubmit` para validar y construir el payload.

Este es el punto de fricción real del diseño: `steps` necesita comportarse como `tabs` para los dos últimos usos (submit y payload), pero necesita comportarse de forma opuesta para el primero (inicialización al montar).

## Objetivos / No objetivos

### Objetivos
- Definir el contrato de `props` de `steps` (items, variant, textos de navegación).
- Resolver el punto de fricción de ciclo de vida (init lazy por paso) sin romper el modelo de inicialización eager que ya usa `tabs`.
- Definir cómo se reutiliza el motor de validación existente para el gating de "Siguiente" sin introducir un segundo motor de validación.
- Definir el punto de extensión de `src/config/` para restringir `steps` a ser válido únicamente dentro de `form` (a diferencia de `tabs`, que sí es válido fuera de `form`).
- Fijar la estrategia visual de las tres variantes de forma coherente con `tabs` y con `conventions.md`.

### No objetivos
- Soporte en `dev-editor` (fuera de alcance de la spec).
- Cualquier cambio de comportamiento de `tabs` o `accordion`.
- Cualquier cambio en el motor de validación (`runtime-form-validations.ts`) más allá de su uso normal con un subconjunto de campos.
- Persistencia de paso activo, `defaultStep`, o generación dinámica de pasos (excluidos por la spec).

## Decisiones

### 1. Contrato de `props`
- `props.items: Array<{ label: string; visibility?: VisibilityRule; children?: Node[] }>` — mismo shape que `tabs.props.items`, sin campos adicionales. Reutilizar el shape exacto (en vez de inventar uno nuevo) minimiza superficie de validación nueva y reutiliza directamente `matchesVisibilityRule`/`resolveRuntimeTextReference` ya usados por `tabs`.
- `props.variant: 'horizontal' | 'vertical' | 'progress'`, default `'horizontal'`.
- Textos de navegación como props planas y opcionales: `props.backLabel`, `props.nextLabel`, `props.submitLabel` (default `"Back"`, `"Next"`, `"Submit"`). Se descarta un objeto anidado (`props.labels: { back, next, submit }`) porque no existe precedente de ese patrón en el catálogo (los nodos existentes usan props planas para textos configurables) y las tres props ya son autoexplicativas por nombre; un objeto anidado añadiría un nivel de validación extra sin beneficio claro.
- Los tres textos soportan interpolación `{{...}}` vía `resolveRuntimeTextReference`, igual que `tabs.props.items[].label`.
- `steps` no acepta `children` en su raíz (igual que `tabs`): solo `props.items[i].children`. No se añade a `nodeTypeAcceptsChildren` (`layout-placement-rules.ts`).

### 2. Restricción "solo dentro de `form`" en `src/config/`
- `tabs` es válido dentro y fuera de `form`; `steps` **no** — la spec lo exige explícitamente (FR1).
- El mecanismo existente para nodos "solo-form" es `FORM_ONLY_LEAF_NODE_TYPES` (`layout-placement-rules.ts`), consumido por `isFormOnlyLeafNode` en `validate-form-semantics.ts`. Ese set asume nodos hoja con `props.fieldId` (el type guard estrecha a `Extract<LayoutNode, { props: { fieldId: string } }>`), lo cual no encaja con `steps` (nodo estructural sin `fieldId`).
- Decisión: **no** añadir `steps` a `FORM_ONLY_LEAF_NODE_TYPES`. En su lugar, añadir un caso explícito `steps` en `validateFormNodesInCollection` (para el árbol fuera de `form.children`, donde hoy `tabs` recorre incondicionalmente sus items) que:
  - si `!context.inForm`, rechaza con un mensaje de error análogo a los ya existentes ("`steps` nodes must be descendants of a form node"),
  - si `context.inForm`, recorre `props.items[i].children` igual que hace el caso `tabs` ya existente.
- En `validateFormChildren` (recorrido específico de `form.children`, donde `context.inForm` ya es `true` por construcción), añadir `steps` a `FORM_ALLOWED_DESCENDANT_TYPES` y un caso de recorrido idéntico al de `tabs`.
- Esto mantiene el patrón existente (un caso explícito por tipo estructural en cada uno de los dos walkers) en vez de forzar `steps` dentro de una abstracción pensada para nodos hoja.

### 3. Ciclo de vida: inicialización lazy por paso
- `ResolvedFormFieldDefinition` (`runtime-form-validations.ts`) gana un campo opcional `stepGroup?: { nodeId: string; itemIndex: number }`, poblado únicamente cuando un campo se descubre dentro de `props.items[i].children` de un nodo `steps`.
- El recorrido recursivo de descubrimiento de campos (hoy función privada `collectResolvedFormFieldDefinitions` en `form-layout-node.tsx`) se extiende con un caso `steps` **idéntico al de `tabs`** (recorre todos los items con `visibility` visible, sin distinguir paso activo) — esto es intencional: para submit, payload y renormalización de choices, `steps` debe comportarse exactamente como `tabs`, porque en el momento del submit todos los pasos visibles ya están garantizados válidos (FR14 de la spec) y deben participar en el payload agregado igual que hoy hacen todos los tabs.
- La única diferencia de comportamiento vive en el consumidor, no en el recorrido: `fieldsNeedingInitialization` (el `useMemo` que alimenta el efecto de inicialización eager al montar el form) filtra explícitamente los campos con `stepGroup !== undefined`. Esos campos quedan fuera de la inicialización eager del form; su inicialización queda delegada al propio nodo `StepsNode`.
- Esta decisión evita introducir una segunda función de recorrido (una "shallow" y otra "deep"): habría duplicado la lógica de recursión sobre `container`/`repeater`/`tabs` anidados dentro de un paso, y habría dejado sin renormalizar los campos de selección de pasos ya inicializados (la pasada de renormalización de choices en `FormNode` sí debe ver los campos de `steps`, y al estar guardada tras un check de `fieldState === null` es un no-op seguro para campos aún no inicializados).
- El recorrido recursivo compartido (usado hoy solo dentro de `form-layout-node.tsx`) se extrae a un módulo reutilizable (junto a los helpers ya existentes en `resolve-form-field-definition.ts`, o un nuevo `runtime-form-field-collection.ts`) para que `StepsNode` pueda invocar la misma lógica sobre el subárbol de un paso concreto, sin duplicar el manejo de `container`/`repeater`/nodos anidados.
- `StepsNode` mantiene un `useEffect` con clave `[activeIndex]` que: calcula la definición de campos del paso activo con el recorrido compartido, filtra los ya presentes en store, e inicializa el resto vía `initializeForm(formId, ...)` — igual patrón que usa hoy `FormNode` para el conjunto completo, pero acotado al paso activo.

### 4. Validación gateada al pulsar "Siguiente"
- `StepsNode` resuelve los campos del paso activo con el mismo recorrido compartido de la decisión 3, filtra por visibilidad (`isLayoutNodeVisible`), e invoca `validateFormFields({ formId, fieldDefinitions, state, iterationContext })` — la misma función que usa `handleSubmit`, sin modificarla.
- Si `isValid` es `false`: escribe cada error con `setFormFieldError` (mismo patrón que el loop de `handleSubmit`) y no avanza `activeIndex`.
- Si `isValid` es `true`: avanza `activeIndex` al siguiente índice visible y, si ese índice supera `maxVisitedIndex`, lo actualiza.
- No se introduce ningún motor de validación nuevo ni ninguna variante de `validateFormFields`; la única pieza nueva es la resolución del subconjunto de campos, ya cubierta por la decisión 3.

### 5. Estado local de navegación
- `StepsNode` sigue el mismo patrón que `TabsNodeContent` (`useState` local, corrección "adjusting state during render" cuando el paso activo deja de ser visible — cubre FR13).
- Se añaden dos piezas de estado local: `activeIndex` (paso mostrado) y `maxVisitedIndex` (el índice más alto alcanzado mediante un "Siguiente" válido). La indicación de pasos clicables en `horizontal`/`vertical` solo permite navegar a índices visibles con posición ≤ posición de `maxVisitedIndex` dentro de `visibleIndices` — esto es lo que impide saltar a un paso todavía no alcanzado (FR7 vs. restricción explícita de la spec).
- "Atrás" mueve `activeIndex` al índice visible anterior; nunca requiere validación (retroceder es siempre libre).
- Igual que `tabs`, los índices se manejan sobre el array original (`visibleIndices` filtra por posición, pero el índice guardado es el del array de `props.items`), preservando el mismo criterio ya documentado para `tabs`.

### 6. Submit del último paso
- El botón del último paso visible se renderiza como `<button type="submit">{submitLabel}</button>` dentro del `<form>` ya existente (igual que un `button` sin `action` hoy). No se introduce ningún mecanismo de submit nuevo: la navegación nativa del `<form>` dispara `FormNode.handleSubmit` sin cambios.
- Los botones "Atrás" y "Siguiente" son `type="button"` con `onClick` propio, para no disparar submit nativo accidentalmente.
- Cuando solo hay un item visible, no se renderizan "Atrás"/"Siguiente"; solo el botón de envío (edge case ya listado en la spec).

### 7. Estilo y variantes
- Se sigue el patrón de `divider-layout-node.tsx` (lookup map) adaptado: dado que las tres variantes difieren en **estructura interactiva** (qué se renderiza como indicador, no solo qué clases se aplican), la resolución por variante se centraliza en `runtime-node-styling.ts` como un lookup `Record<Variant, (props) => ReactNode>` para la porción de indicador únicamente. El esqueleto común (panel + fila de navegación + lógica de gating) se declara una sola vez en `StepsNode`, evitando repetir JSX por rama `if/else` tal como exige `conventions.md`.
- `horizontal` y `vertical` reutilizan la técnica de "tab conectado" ya documentada para `tabs` (borde perimetral del panel, técnica de fusión visual con el paso activo), para mantener coherencia visual entre ambos nodos de navegación por paneles.
- El indicador de paso en `horizontal`/`vertical` usa un marcador numerado circular por paso (número de orden 1-based sobre los pasos visibles), con estilo `accent`/`primary` para el paso activo y pasos ya visitados, y estilo neutro para pasos no alcanzados todavía — coherente con la paleta semántica ya usada por otros nodos (`badge`, `stat`).
- `progress` no renderiza indicador de pasos individuales; solo un texto tipo "Paso X de Y" (interpolado con el índice 1-based dentro de `visibleIndices` y su longitud total) y el botón "Atrás".
- Los botones de navegación auto-generados reutilizan el mismo helper de estilo de `button-layout-node.tsx` (según `conventions.md`, ya es el precedente vigente de "delegación en un único helper"), en vez de declarar clases nuevas — "Siguiente"/"Enviar" con variante primaria, "Atrás" con variante secundaria.

## Riesgos y trade-offs
- **Riesgo de regresión en `form-layout-node.tsx`**: las cinco funciones de recorrido (`collectResolvedFormFieldDefinitions`, `collectAllFormFieldIds`, `collectHiddenFieldDefinitions`, `collectHiddenNodeFieldIds`, `collectSelectEmptySubmitValues`) son compartidas por todos los formularios, no solo los que usan `steps`. Añadir un caso `steps` a las cinco es mecánico (copia del caso `tabs`), pero cualquier error ahí afecta potencialmente a formularios sin `steps`. Mitigación: cobertura de test explícita sobre formularios que combinan `steps` con `tabs`/`container`/`repeater` en el mismo form, y sobre formularios sin `steps` para confirmar que no cambia su comportamiento.
- **Divergencia de ciclo de vida** entre `tabs` (eager) y `steps` (lazy) mediante un campo `stepGroup` que solo un consumidor (el filtro de inicialización) interpreta: es una solución quirúrgica, pero introduce una asimetría en `ResolvedFormFieldDefinition` que debe documentarse bien en el código para que no se interprete como dato sin uso.
- **Extracción del recorrido compartido**: mover lógica hoy privada de `form-layout-node.tsx` a un módulo reutilizable es un refactor de bajo riesgo funcional (mismo comportamiento, distinto punto de import) pero toca un fichero central; se cubre con los tests existentes de `tabs`/`form` sin modificarlos, más los nuevos de `steps`.
- **Coherencia visual `steps` vs `tabs`**: reutilizar la técnica de "tab conectado" es una decisión de producto razonable pero no validada visualmente con el usuario; si no encaja bien al implementarse, es un ajuste de CSS local, no un problema de arquitectura.

## Migración o despliegue
No aplica: `steps` es un nodo nuevo, aditivo, sin cambios de contrato para configuraciones existentes. Los formularios que no lo usan no ven cambio de comportamiento.

## Preguntas abiertas
Ninguna bloqueante. El punto de fricción técnico central de la spec (inicialización lazy vs. motor de validación existente) queda resuelto en las decisiones 3 y 4.
