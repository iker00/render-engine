# Design: Feature 0126 - dev-editor-link-children-mode

## Contexto

`link` es hoy el único nodo del catálogo cuyo contenido puede tomar dos formas mutuamente excluyentes:
texto (`props.label`, con `props.icon`/`props.iconPosition` opcionales) o un subárbol (`children`). Esa
exclusión mutua **no está codificada como unión discriminada de Zod**: `linkNodeSchema`
(`src/config/runtime-config-zod.ts`) declara `props.label` y el `children` de nivel de nodo como campos
independientes y opcionales; toda la validación cruzada (exclusión mutua, `icon`/`iconPosition` solo en
modo texto, `children` no vacío, catálogo cerrado de tipos hijo) vive de forma imperativa en
`validateLinkNode` (`src/config/validate-link-node.ts`), después del `safeParse`.

Esto tiene tres consecuencias relevantes para el diseño:

1. El dispatcher genérico del panel de propiedades (`property-field-dispatcher.tsx`) detecta selectores de
   variante únicamente cuando el JSON Schema generado expone un `oneOf`/`anyOf` con discriminador literal
   `type` (`getDiscriminatedUnionVariants` en `property-field-schema-resolution.ts`). Como `link` no tiene
   ese discriminador para `label` vs `children`, el mecanismo que ya renderiza el selector de
   `button.props.action`/`link.props.action`/`form.submitAction` **no puede extenderse de forma nativa**
   para cubrir este caso: no hay una unión que detectar.
2. Las reglas de destino de drop (`layout-placement-rules.ts`, `layout-drop-validity.ts`) y la mutación que
   aplica un drop (`insertIntoParentNode`/`withChildren` en `layout-tree-mutations.ts`) ya tratan a `link`
   exactamente igual que a `container`/`form`/`modal`/`accordion`: insertan sobre `children ?? []` sin
   inspeccionar ni exigir la ausencia de `props.label`. El motivo real de que "no pase nada" hoy al soltar un
   nodo sobre un `link` no es esa mutación — es que no existe ningún mecanismo en el editor para llevar a un
   `link` a un estado `children` presente (aunque sea `[]`) sin pasar por Monaco, y hoy `children: []` está
   además rechazado por validación.
3. El placeholder vacío de contenedor (`EmptyContainerPlaceholder`, `isEmptyPlaceholderCandidate`,
   `EmptyPlaceholderNodeType` en `src/runtime/layout-renderer.tsx`) está acoplado a un union hardcodeado
   `'container' | 'form'`, más estrecho que `hasChildren()` (que ya incluye `link` y `modal`).

## Objetivos / No objetivos

### Objetivos
- Definir el mecanismo concreto por el que el panel de propiedades ofrece un selector "Contenido" para
  `link`, dado que no puede reutilizar la maquinaria de unión discriminada por `type`.
- Precisar qué mutación exacta ejecuta la conversión de modo (qué campos toca, en qué commit, con qué
  contrato de reconstrucción) y confirmar que no requiere tocar la capa de arrastre/drop existente.
- Acotar el cambio necesario en el placeholder vacío del canvas para incluir a `link`.
- Localizar el punto exacto de relajación de la regla `children: []` y confirmar que no hay más puntos de
  rechazo equivalentes (Zod-level o runtime) que deban tocarse en paralelo.

### No objetivos
- No se rediseña el dispatcher genérico de propiedades ni su detección de uniones discriminadas por `type`.
- No se generaliza el mecanismo de placeholder vacío a todos los tipos que aceptan `children`
  (`nodeTypeAcceptsChildren`); se extiende solo lo necesario para `link`. Generalizarlo es una mejora
  transversal independiente, fuera del contrato funcional de esta feature.
- No se modifica `insertIntoParentNode`, `withChildren`, `isValidDropTarget` ni `LINK_ALLOWED_CHILD_TYPES`:
  el análisis confirma que ya son correctos para este caso una vez resuelto el punto anterior.
- No se toca el componente de render de producción del nodo `link` en `src/runtime/nodes/`: su rama de
  render ya condiciona por presencia de `children` (`children !== undefined`), no por longitud, así que
  `children: []` ya produce un `<a>` vacío una vez la validación deja de rechazarlo.

## Decisiones

### D1 — Selector de "Contenido": widget dedicado, no extensión del selector de variante de acción
El selector se implementa como un widget nuevo y opaco al dispatcher genérico, siguiendo el precedente ya
establecido por `ChoiceItemsPropertyField` + el hook `x-widget` (`choice-items`), no como una extensión de
`DiscriminatedUnionPropertyField`.

- **Por qué no extender el selector de variante existente**: `getDiscriminatedUnionVariants` decide si algo
  es una unión mirando `oneOf`/`anyOf` con un discriminador `type` literal en cada rama. `label` vs
  `children` no tiene esa forma en el JSON Schema derivado — no hay unión que detectar. Forzar a ese
  componente a también detectar "modo por presencia de clave" (en vez de "modo por discriminador literal")
  mezclaría dos estrategias de detección distintas en un componente cuyo contrato actual es una sola.
- **Por qué el precedente `x-widget` sí encaja**: es exactamente el mecanismo que el proyecto ya usa cuando
  varias formas de un valor no comparten discriminador `type` (`props.items` de `select`/`radioGroup`/
  `checkboxGroup`, con modos "manual literal" / "manual escalar" / "dinámico" detectados por forma del valor,
  no por schema). El nuevo widget reutiliza el mismo patrón: `detectMode(node)` en vez de
  `detectMode(value)`.
- **Diferencia estructural real con `choice-items`, y por qué importa**: `choice-items` opera enteramente
  dentro de `props.items` — lee y escribe un único campo. El modo de `link` decide entre dos ramas que viven
  en sitios distintos del nodo (`props.label`/`props.icon`/`props.iconPosition` dentro de `props`, y
  `children` como campo hermano de `props` a nivel de nodo). Por tanto este widget no puede montarse como un
  `x-widget` inyectado dentro del sub-schema de `props` con el mismo alcance de escritura que
  `choice-items`: necesita un callback de `onChange` que opere sobre el **nodo completo**, no sobre un campo
  de `props`. Esto se resuelve dándole al widget acceso al mismo mecanismo de patch de nodo completo que ya
  usa "Eliminar nodo" (que borra el nodo y su subárbol), en vez del `onChange` acotado a un sub-path que usan
  los campos normales de `Props`. El punto de composición donde se decide "qué widget mostrar según
  `node.type`" es el mismo nivel donde hoy se decide `resolveChoiceLikePropsSchema`/`resolveTabsPropsSchema`
  (`layout-canvas-properties-panel.tsx`), pero el widget de `link` se registra y monta con ese alcance de
  escritura ampliado en vez de quedar confinado dentro de la subsección `Props`.
- **Contrato visual**: dropdown con dos opciones ("Texto", "Elementos anidados"), mismo patrón visual e
  interactivo que el selector de variante de acción (requisito no funcional de la spec) — mismo look,
  mecanismo de detección y de escritura distintos por debajo. Esta divergencia debe quedar explícita en el
  código (nombre de componente, comentario mínimo si hace falta) para que una revisión futura no asuma que
  es una instancia más de `DiscriminatedUnionPropertyField`.
- **Reconstrucción al cambiar de modo**: igual que el selector de variante de acción, el cambio de modo
  reconstruye desde cero (spec, requisitos 2 y 3). "Texto" → "Elementos anidados": retira
  `label`/`icon`/`iconPosition`, añade `children: []`. "Elementos anidados" → "Texto": retira `children` (y
  su subárbol), añade `props.label: "Enlace"` sin `icon`. `href`/`download`/`target`/`action` no se tocan en
  ningún sentido — el widget solo escribe las claves que le corresponden, no todo `props`.
- **Detección del modo activo**: por forma del nodo, no por un campo de estado adicional: `props.label`
  presente → "Texto"; `children` presente → "Elementos anidados" (spec, requisito 1). Alineado con
  `detectMode` de `choice-items`.
- **Alternativa descartada**: exponer `children` como pseudo-campo dentro del sub-schema de `props` para que
  todo el widget pudiera vivir dentro del alcance de escritura de `props` como `choice-items`. Se descarta
  porque rompería la fidelidad entre el schema Zod real (el que también consume Monaco) y el fragmento que
  ve el dispatcher, y generalizaría un caso que hoy es único en el catálogo.

### D2 — Relajación de la validación: un único punto de cambio
La regla que rechaza `children: []` es un bloque imperativo aislado en `validateLinkNode`
(`src/config/validate-link-node.ts`, cross-validación "children cannot be empty"), condicionado únicamente a
`hasChildren && children.length === 0`. Se retira/ajusta ese bloque exclusivamente.

- No hace falta tocar `linkNodeSchema` (Zod): `children` ya es `z.array(z.unknown()).optional()` sin
  `.min(1)`; el límite de longitud nunca estuvo a nivel de schema.
- No hace falta tocar `checkLinkChildrenAllowedTypes` (la comprobación recursiva de tipos permitidos): un
  array vacío la satisface vacuamente, sin cambios.
- No hace falta tocar `nodeTypeAcceptsChildren` ni el render de producción del nodo `link`: ambos ya
  condicionan por presencia de `children`, no por longitud.
- Este cambio es global por construcción (el editor valida con el mismo `validateRuntimeConfig` que
  producción), consistente con el requisito de la spec de que la relajación no es exclusiva del editor.

### D3 — Extensión mínima del placeholder vacío del canvas
Se añade `'link'` al union hardcodeado `EmptyPlaceholderNodeType` de `src/runtime/layout-renderer.tsx`, con
su entrada correspondiente en `EMPTY_PLACEHOLDER_LABEL` (etiqueta análoga a "Contenedor vacío"/"Formulario
vacío"), y se ajusta `isEmptyPlaceholderCandidate` para incluir `link` en su comprobación de tipo.

- **Por qué extensión puntual y no generalización**: el mecanismo ya es más estrecho que
  `nodeTypeAcceptsChildren`/`hasChildren` (que incluyen también `modal` y `accordion`, sin placeholder vacío
  propio hoy). Generalizarlo del todo cambiaría comportamiento de `modal`/`accordion`, fuera del contrato
  funcional de esta spec. Se dejará la misma inconsistencia preexistente (placeholder no genérico) para
  `modal`/`accordion`, sin agravarla ni resolverla aquí.
- El componente `EmptyContainerPlaceholder` ya es agnóstico de tipo salvo por el label mostrado y el `type`
  usado para conectarlo a `useDroppable`; no requiere cambios propios más allá de aceptar `'link'` como
  `nodeType` válido.

### D4 — Sin cambios en la capa de arrastre/drop
`insertIntoParentNode`, `withChildren`, `isValidDropTarget` y `LINK_ALLOWED_CHILD_TYPES` ya tratan a `link`
de forma genérica junto a `container`/`form`/`modal`/`accordion`, insertando sobre `children ?? []` sin
asumir su preexistencia ni inspeccionar `props.label`. El aparente "gap" que describe la spec (el commit se
descarta porque `props.label` nunca se retira) no está en esta capa: está en que, antes de esta feature, no
existía ningún mecanismo del editor para poner a un `link` en estado `children` sin `label`. D1 cierra ese
mecanismo (la conversión de modo retira `label` en el mismo commit en que introduce `children: []`), así que
en el momento en que un drop es posible sobre un `link` (porque ya tiene `children`, vacío o no, gracias a
D1+D3), el nodo nunca tiene `props.label` presente. La capa de drop no necesita saberlo ni comprobarlo.

### D5 — Borrado del último hijo
Vaciar el subárbol de un `link` hasta `children: []` (spec, requisito 6) es un efecto emergente del borrado
de nodo ya existente (mismo mecanismo de splice sobre el array de hijos que ya usan `container`/`form`); no
requiere lógica especial nueva. El placeholder vacío reaparece por D3 en cuanto `children.length === 0`.

## Riesgos y trade-offs

- **Otro caso especial en el panel de propiedades**: tras esta feature, el panel tendrá tres mecanismos no
  genéricos de este tipo (`tabs.props.items` con `children` excluido del editor genérico, el widget
  `choice-items` para `select`/`radioGroup`/`checkboxGroup`, y ahora el selector de contenido de `link`, este
  último con alcance de escritura ampliado al nodo completo en vez de a `props`). Riesgo de dispersión si se
  repite el patrón sin criterio; mitigado porque cada caso sigue el mismo precedente de composición
  (`resolveXPropsSchema`/registro de widget gateado por `node.type`), no arquitecturas divergentes entre sí.
- **Alcance de escritura ampliado del nuevo widget**: al necesitar mutar el nodo completo (no solo `props`),
  el widget de contenido de `link` es el primer caso en el panel de propiedades con ese alcance fuera del
  flujo de "Eliminar nodo". Riesgo residual: si en el futuro aparece otro campo que necesite cruzar la
  frontera `props`/nivel-de-nodo, conviene revisar si merece un mecanismo de composición explícito en vez de
  repetir una solución ad hoc por nodo. No se resuelve aquí por ser prematuro con un solo caso.
- **Placeholder vacío sigue sin ser genérico**: `modal`/`accordion` seguirán sin placeholder vacío propio
  tras esta feature, igual que hoy. Riesgo de que una feature futura repita esta pregunta; se acepta porque
  resolverlo ahora ampliaría el alcance de esta spec sin necesidad funcional.
- **Relajación global de `children: []`**: al no ser exclusiva del editor, cualquier config de producción
  existente que hoy dependa (explícita o implícitamente) de que `link.children` nunca sea `[]` deja de poder
  asumirlo. No se ha encontrado ninguna lógica de runtime que dependa de longitud mínima de `children` en
  `link` (el render ya condiciona por presencia); riesgo residual bajo, pero es un cambio de contrato de
  producción y debe documentarse como tal en `link.md` (ya señalado en la spec como documentación afectada).

## Migración o despliegue

No aplica. Es un cambio aditivo/de relajación de validación sin migración de datos: ninguna configuración
existente que hoy es válida deja de serlo, y no hay estado persistido que requiera transformación.

## Preguntas abiertas

Ninguna. Las decisiones técnicas necesarias para planificar (mecanismo del selector de contenido, alcance de
la mutación de conversión, punto exacto de relajación de validación, extensión del placeholder) quedan
resueltas arriba con su alternativa descartada cuando aplica.
