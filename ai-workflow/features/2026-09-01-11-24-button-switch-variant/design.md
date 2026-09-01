# Design: Feature 2026-09-01-11-24 - button-switch-variant

## Contexto
`button` hoy resuelve sus variantes visuales (`solid | outline | ghost | link`) como un único esqueleto `<button>` rectangular, delegando la resolución de clases en un helper de `runtime-node-styling.ts` (patrón fijado en `conventions.md`, precedente `button-layout-node.tsx`). El disparo de `action` pasa por el ejecutor compartido `runActionOutcomeWithLifecycle` y, para `executeOperation`/`executeOperations`, por la fachada de `src/queries/` (`buildRuntimeApiRequest` → `resolveRuntimeReference`).

La resolución de referencias contra estado en vivo admite hoy dos fuentes: el estado global (`queries.*`/`forms.*`/`params.*`) y un `RuntimeIterationContext` opcional (`item`, `itemKey`, `itemIndex`, `row`, `rowIndex`) que viaja junto al estado en cada llamada a `resolveRuntimeReference`, inyectado por el nodo que conoce su contexto de iteración (`repeater`/`table`). Es el único canal existente en el pipeline para valores que no son estado global sino datos locales a la instancia/disparo que está resolviendo la referencia.

`toggle` ya implementa el control visual `role="switch"`/`aria-checked` con track+thumb (`toggle-layout-node.tsx`), con clases de estado (`checked`/`unchecked`) sin variación por color, porque `toggle` no tiene `props.color`.

La spec deja explícitamente como decisión técnica pendiente de esta fase: dónde vive la resolución de `switch.next` sin acoplar el resolver genérico a un prop específico de `button`. Esa es la decisión central de este documento.

## Objetivos / No objetivos

### Objetivos
- Fijar dónde y cómo se resuelve `switch.next` dentro del pipeline compartido de referencias, reutilizando el canal de contexto local ya existente en vez de crear un segundo mecanismo de resolución.
- Fijar la estrategia de render de `variant: 'switch'` dentro de `button-layout-node.tsx`, incluyendo su relación con el esqueleto compartido de las otras variantes y con el control visual ya existente en `toggle`.
- Fijar el reparto de la nueva validación (enum, obligatoriedad condicional de `checked`/`action`, prohibición de `icon`, frontera de `switch.next`) entre los módulos de `src/config/` ya responsables de validar `button` y las referencias.

### No objetivos
- No se diseña la lógica de negocio de "un solo item principal a la vez": la spec ya la deja fuera de alcance (resuelta en backend).
- No se decide aquí si el panel de propiedades del editor de desarrollo necesita un widget dedicado para `checked`; la spec ya lo deja como confirmación de implementación, no como decisión de diseño.
- No se define layout/spacing final del control (tamaños exactos, transición) más allá de heredar el ya validado en `toggle`.

## Decisiones

### D1. `switch.next` se resuelve como campo hermano de `iterationContext`, no como parte de él
**Elegido**: añadir un nuevo campo de contexto local opcional (p. ej. `switchNextValue?: boolean`) en las mismas `options` que hoy llevan `iterationContext` a través de toda la cadena: `button-layout-node.tsx` → llamada a la fachada de acción (`executeQueryOperation`/`executeOperations`) → `BuildRuntimeApiRequestOptions`/`BuildInlineRuntimeApiRequestOptions` en `src/queries/runtime-api-request.ts` → `resolveOptions` → `resolveRuntimeReference` en `runtime-reference-resolver.ts`. El resolver añade una rama de reconocimiento de la referencia sintética `switch.next` (forma exacta, sin segmentos anidados, mismo trato que `item.$key`/`item.$index`) que lee ese campo.

**Por qué**: es exactamente el mismo patrón que ya usa el pipeline para dar a la resolución de referencias un dato "local al disparo" que no vive en el estado global (`iterationContext` ya cumple ese rol para `item.*`/`row.*`). No hace falta inventar un segundo canal de contexto ni tocar la composición de `query`/`body`/`headers` en `src/queries/` más allá de añadir un campo opcional a las options que ya recorren ese camino.

**Alternativa descartada**: extender directamente `RuntimeIterationContext` con el nuevo campo. Se descarta porque `RuntimeIterationContext` es conceptualmente el contexto de iteración de `repeater`/`table` (`item`/`row`), y `switch.next` no tiene relación con iteración — mezclar ambos conceptos en la misma interfaz confundiría su propósito y su disponibilidad (un `switch` fuera de `repeater` no tiene `iterationContext`, pero sí necesita `switch.next`).

**Trade-off asumido**: el resolver genérico sí gana conocimiento de un concepto propio de `button` (aunque sea un campo opcional y aislado). Es un acoplamiento mínimo e intencional: la alternativa de resolver `switch.next` fuera del pipeline compartido (p. ej. sustituyendo el string antes de llegar a `resolveRuntimeReference`) rompería la regla de `architecture.md` de que la composición del request vive solo en `src/queries/` y que ningún nodo visual reimplementa resolución de referencias.

**Riesgo residual**: ninguno relevante; el campo es opcional y no afecta a consumidores existentes de `iterationContext` ni de `resolveRuntimeReference`.

### D2. Frontera de `switch.next` cubre también `props.action.operations[].query/body/headers`
**Elegido**: aunque la spec describe la superficie como `props.action.query/body/headers`, la validación de frontera (bootstrap) admite `switch.next` también dentro de cada entrada de `props.action.operations[]` cuando `props.action.type: executeOperations`, con el mismo criterio que ya aplica `item.*` a ambas formas (singular y plural) según `button.md`.

**Por qué**: la spec no restringe `variant: 'switch'` a un `action.type` concreto, y `executeOperations` ya comparte semántica de overrides `query`/`body`/`headers` por operación con `executeOperation`. Excluir la forma plural sin motivo introduciría una inconsistencia no justificada por ningún requisito.

**Alternativa descartada**: limitar `switch.next` solo a `executeOperation` singular. Se descarta por falta de justificación funcional; ninguna parte de la spec sugiere que `executeOperations` deba tratarse distinto.

**Riesgo residual**: ninguno; es una extensión conservadora y simétrica con `item.*`.

### D3. `variant: 'switch'` bifurca el esqueleto JSX de `button`, en lugar de compartirlo
**Elegido**: `button-layout-node.tsx` bifurca su render en el nivel superior cuando `variant === 'switch'`, devolviendo una estructura propia (control `role="switch"` + label opcional) en vez de reutilizar el esqueleto `<button>` rectangular compartido por `solid|outline|ghost|link`.

**Por qué**: `conventions.md` (sección "Resolución de variantes visuales") exige no repetir el esqueleto JSX **cuando la única diferencia entre variantes es qué helper de estilo se invoca**. Ese no es el caso aquí: `switch` cambia el rol de accesibilidad (`role="switch"`/`aria-checked` en vez de un botón de texto), la forma en que se deriva su estado visual (`checked` resuelto, no solo estilo), el tratamiento del `label` (texto visible vs. `aria-label`, gobernado por `labelVisible`) y prohíbe `icon`. Es una variante estructuralmente distinta, no solo estilísticamente distinta — análoga a por qué `toggle` ya es un nodo con su propio render en vez de una variante de otro campo.

**Conflicto señalado explícitamente**: esta decisión diverge, de forma justificada, del principio general de esqueleto único de `conventions.md`. Se documenta aquí en vez de resolverse en silencio, tal como exige esa misma convención para casos límite. El resto de variantes (`solid|outline|ghost|link`) no se ve afectado y sigue compartiendo el esqueleto y el helper de `runtime-node-styling.ts` existente.

**Alternativa descartada**: forzar `switch` dentro del esqueleto común con ramas condicionales internas (mismo `<button>` raíz, contenido interno condicional). Se descarta porque mezclaría atributos ARIA incompatibles (`role="switch"` con contenido de label+icono pensado para un botón de texto) y complicaría más el helper compartido que bifurcar al nivel del nodo.

**Riesgo residual**: `button-layout-node.tsx` crece con una rama de render adicional; mitigado extrayendo el sub-render de `switch` a una función/componente propio dentro del mismo fichero o en uno dedicado, sin tocar el camino de las otras variantes.

### D4. El control visual track+thumb se extrae a un componente presentacional compartido con `toggle`
**Elegido**: extraer el JSX del control (`<button role="switch" aria-checked>` + `<span>` de knob) a un componente presentacional pequeño y reutilizado por `toggle-layout-node.tsx` y por la rama `switch` de `button-layout-node.tsx`. Cada nodo sigue resolviendo su propio `checked`, sus propias clases (vía su propio helper de estilo) y su propio `onClick`; el componente compartido solo encapsula la estructura DOM y los atributos ARIA comunes.

**Por qué**: el marcado de `toggle-layout-node.tsx` (`getToggleButtonClassName`/`getToggleKnobClassName` + el `<button><span/></button>`) ya es pequeño y autocontenido, sin mezclarse con las preocupaciones de campo de formulario (wrapper, label, tooltip, error), que quedan fuera del componente extraído. Evita duplicar la misma estructura de accesibilidad en dos nodos y reduce el riesgo de que ambos controles diverjan visualmente con el tiempo, alineado con el principio general de reutilización de `conventions.md`.

**Diferencia real entre ambos consumidores**: `toggle` no varía su clase por color (no tiene `props.color`); `button` con `variant: 'switch'` sí tiñe el estado `checked: true` con el color semántico de `props.color` (req. 10 de la spec) y usa siempre el mismo tratamiento neutro en `checked: false`. Esto se resuelve con un nuevo helper de clases propio de `button` en `runtime-node-styling.ts` (consistente con el precedente ya fijado ahí para `button`), sin que el componente compartido conozca la existencia de `color`.

**Alternativa descartada**: duplicar el marcado del control en `button-layout-node.tsx`. Se descarta por riesgo de divergencia visual entre `toggle` y `button` variant `switch` (mismo patrón de accesibilidad exigido por la spec, req. 4) y por ir contra el principio de reutilización cuando la estructura ya existe y es extraíble sin arrastrar acoplamientos de formulario.

**Riesgo residual**: bajo; el componente extraído introduce un fichero nuevo pequeño y estable. Si en el futuro `toggle` y `switch` divergen más en estructura (no solo en estilo), habrá que revisar si sigue mereciendo la pena compartirlo — no es un riesgo esperado para esta feature.

### D5. `checked` se resuelve con el mismo mecanismo de referencia completa que `defaultValue`, sin resolver nuevo
**Elegido**: `button.props.checked` se resuelve con la misma función de resolución de referencia completa/literal ya usada para `defaultValue` de `input`/`textarea`/`select`/`radioGroup`/`checkboxGroup` (boolean en este caso), añadiéndose formalmente a esa misma familia de superficies en `reference-resolution.md` (ya recogido como área afectada en la spec). No se crea un resolver nuevo ni un tipo de referencia nuevo para `checked` — solo se añade `button.props.checked` como superficie consumidora adicional de las familias `item.*`/`queries.*`/`forms.*`/`params.*` ya soportadas.

**Por qué**: `checked` es una referencia dinámica completa estándar (no sintética como `switch.next`); reutilizar el mecanismo existente evita duplicar lógica de resolución y mantiene la superficie de referencias como un catálogo cerrado y centralizado en `runtime-references/`.

**Degradación**: sigue la política general ya fijada por la spec — una referencia bien formada sin dato disponible degrada a `false` (no marcado), igual que la política general de degradación segura del runtime.

### D6. Nombre accesible: `aria-label` solo cuando `labelVisible: false`
**Elegido**: cuando `labelVisible` es `false` (o ausente con default `true` invertido — es decir, cuando el label no se pinta como texto), el control lleva `aria-label={label}`. Cuando el label se pinta como texto visible (`labelVisible` ausente o `true`), el control no añade `aria-label` adicional y el nombre accesible se apoya en el texto visible asociado.

**Por qué**: evita anunciar el mismo texto dos veces a lectores de pantalla (una vez como contenido asociado, otra como `aria-label` redundante) y es el patrón estándar de nombre accesible por texto visible. Es coherente con el requisito 8/9 de la spec, que solo exige que el texto exista *en algún sitio* accesible, no en ambos simultáneamente.

**Riesgo residual**: ninguno; verificable con test de accesibilidad por caso (`labelVisible: true` → sin `aria-label` propio, `labelVisible: false` → con `aria-label`).

### D7. Validación repartida siguiendo la partición ya existente de `src/config/`
**Elegido**:
- Extensión del enum `variant` (`+ 'switch'`) y de los props `checked`/`labelVisible` en el contrato público (tipos + esquema `Zod`), junto al resto del contrato de `button` ya validado hoy.
- Reglas condicionales sobre el propio nodo `button` (enum, `checked` obligatorio cuando `variant: 'switch'`, `checked`/`labelVisible` prohibidos cuando `variant` no es `switch'`, `icon` prohibido cuando `variant: 'switch'`, `action` obligatorio cuando `variant: 'switch'` incluso fuera de `form`) se ubican junto al resto de validación específica de `button` ya existente (mismo módulo que hoy rechaza `button` sin `action` fuera de `form`, `variant`/`color`/`fullWidth` fuera de enum, etc.).
- La frontera de `switch.next` (solo dentro de `props.action.query`/`body`/`headers`/`operations[].*` del mismo `button` con `variant: 'switch'`) se ubica junto al resto de validación de fronteras de referencias sintéticas ya existente (mismo criterio y vecindad que la validación de frontera de `item.*`/`item.$key`/`item.$index`).

**Por qué**: sigue la partición de responsabilidad ya fijada en `architecture.md` (`validate-layout-nodes`, `validate-actions-visibility` como módulos por dominio) sin crear un módulo nuevo para una feature que extiende contratos ya cubiertos por los existentes.

## Riesgos y trade-offs
- **Acoplamiento mínimo del resolver genérico a un concepto de `button`** (D1): aceptado y documentado; es el mismo patrón que ya existe para `iterationContext`, no un patrón nuevo.
- **Divergencia respecto a la convención de esqueleto único** (D3): aceptada y señalada explícitamente como excepción justificada, no como violación silenciosa.
- **Nuevo fichero compartido entre `toggle` y `button`** (D4): bajo riesgo, mitigado por mantener el componente compartido estrictamente presentacional (sin lógica de campo de formulario ni de color).
- **Riesgo de producto heredado de la spec** (no técnico, no bloqueante para este diseño): la spec ya señala que la exclusividad "un solo principal" depende de que el backend aplique el cambio de forma atómica; ninguna decisión de este diseño mitiga ni necesita mitigar ese riesgo, que sigue siendo responsabilidad de la coordinación con backend mencionada en la propia spec.

## Migración o despliegue
No aplica. Es un cambio aditivo y retrocompatible:
- `variant` nuevo valor en un enum ya cerrado; instancias existentes sin `variant: 'switch'` no cambian de comportamiento (ya lo exige la spec como requisito no funcional).
- `checked`/`labelVisible` son props nuevos, solo válidos (y solo relevantes) bajo `variant: 'switch'`.
- `switch.next` es una referencia sintética nueva, sin impacto en configuraciones existentes que no la usen.
- No hay migración de datos ni de contratos de API: el shape de `action`/`query`/`body`/`headers` ya existente se reutiliza sin cambios.

## Preguntas abiertas
- (Heredada de la spec, no bloqueante para planificar) Confirmar con quien mantenga el backend del caso de uso que el endpoint de marcado aplica la exclusividad de forma atómica, para que el refetch de `onSuccess` sea suficiente sin lógica adicional. No requiere ninguna decisión técnica de este diseño; queda como riesgo de producto a validar en paralelo a la implementación.
- (Heredada de la spec, explícitamente diferida a implementación, no a diseño) Si el panel de propiedades del editor de desarrollo necesita un widget de referencia dedicado para `checked` o si el mecanismo genérico ya lo cubre.
