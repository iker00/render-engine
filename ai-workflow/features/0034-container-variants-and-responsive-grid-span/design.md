# Design: Feature 0034 - container-variants-and-responsive-grid-span

## Contexto
La feature mezcla dos ampliaciones distintas pero conectadas del runtime:
- un preset visual cerrado `container.props.variant`
- una semántica transversal `layout.span` aplicable a cualquier nodo soportado

La `spec.md` ya fija el alcance funcional, pero deja abiertas varias decisiones técnicas que no conviene resolver durante la implementación:
- dónde vive el nuevo shape compartido de `layout.span`
- cómo se aplica `span` sin tocar cada renderer de nodo por separado
- cómo degradar de forma segura cuando el `span` pedido no encaja en el grid efectivo del padre
- cómo hacer convivir `variant: card` con la baseline institucional y con la semántica actual de sección dentro de `form`

Sin estas decisiones, dos implementaciones razonables podrían divergir en estructura y comportamiento visible.

## Objetivos / No objetivos

### Objetivos
- Mantener `container` como única superficie visual nueva para variantes cerradas.
- Mantener `layout.span` como metadato transversal del árbol `layout`, no como API de widths ni como prop específica de un nodo concreto.
- Aplicar `span` de forma genérica desde el borde central del renderer.
- Garantizar degradación segura cuando `span` aparezca fuera de grid o exceda las columnas efectivas del padre.
- Preservar la baseline institucional actual sin abrir theming declarativo.

### No objetivos
- Añadir responsive declarativo por breakpoint para `columns` o `span`.
- Introducir `variant` en nodos distintos de `container`.
- Repartir semántica de `span` entre cada nodo visual o convertirla en una colección de props ad hoc por componente.
- Abrir estilos arbitrarios, clases libres o anchos proporcionales fuera de grid.

## Decisiones

### 1. `container.props.variant` queda cerrado en `default | card`
`variant` será opcional y solo admitirá:
- `default`
- `card`

Semántica:
- ausencia de `variant` equivale al comportamiento visible actual
- `variant: default` mantiene ese mismo comportamiento de forma explícita
- `variant: card` añade una superficie visual cerrada y revisable, alineada con la baseline institucional del runtime

Motivo:
- mantiene pequeña la superficie pública
- deja preparada una ampliación futura sin reabrir naming ni introducir theming

### 2. `layout.span` vive en un bloque compartido `layout`
Todos los nodos soportados por el árbol `layout` podrán declarar opcionalmente:

```json
{
  "layout": {
    "span": 2
  }
}
```

Reglas del shape:
- `layout` es opcional
- `layout.span` es opcional
- `layout.span` solo admite enteros entre `1` y `12`

Motivo:
- evita dispersar `span` dentro de `props` de cada nodo
- deja una superficie transversal consistente para futuras capacidades estrictamente de layout
- mantiene la terminología alineada con la spec

### 3. `span` se aplica con un wrapper genérico en el renderer central
La implementación no debe modificar cada nodo visual para que se autogestione su `span`.

Estrategia:
- el renderer central seguirá resolviendo visibilidad y fallback antes de renderizar el nodo
- una capa común envolverá el resultado visible del nodo con un wrapper ligero solo cuando el contexto padre sea un grid efectivo y el nodo declare `layout.span`
- ese wrapper será el único responsable de emitir la clase de grid span

Motivo:
- mantiene los nodos visuales centrados en su propia presentación
- evita duplicar lógica en `heading`, `paragraph`, `list`, `button`, `form`, campos y futuros nodos
- reduce la varianza entre implementaciones

Consecuencia:
- si un nodo acaba oculto por `queryStateFeedback` o `visibility`, no se debe reservar hueco de grid para él
- si un nodo renderiza un fallback, cada nodo del fallback se evalúa por sí mismo respecto a `layout.span`
- esta estrategia encaja de forma directa con nodos que renderizan una única raíz visible
- `repeater` queda explícitamente fuera del alcance visible de `layout.span` en esta feature; cuando una repetición necesite ocupar columnas, el nodo raíz visible del `template` deberá declarar su propio `layout.span`

### 4. El contexto de layout padre se propaga explícitamente desde `container`
Solo un `container` con `columns` activa un grid efectivo para sus hijos.

La implementación debe propagar a los descendientes inmediatos un contexto mínimo con:
- si el padre efectivo es grid
- cuántas columnas efectivas tiene ese grid

Ese contexto debe ser independiente del estado del runtime y vivir en la capa de layout/render, no en el store compartido.

Motivo:
- `span` depende de la estructura visible del árbol, no de navegación, formularios o queries
- evita acoplar la semántica de layout al estado global

### 5. La degradación segura de `span` se resuelve por clamp en render
Validación estructural:
- acepta cualquier `span` entre `1` y `12` sin exigir conocer el padre

Aplicación visible:
- si el padre efectivo no es grid, `span` no tiene efecto
- si el padre efectivo es grid, el runtime calcula `effectiveSpan = min(requestedSpan, parentColumns)`

Motivo:
- evita abrir validación contextual compleja en bootstrap
- impide que un `col-span-*` mayor que las columnas explícitas del padre fuerce columnas implícitas no deseadas
- cumple la degradación segura pedida por la spec

Consecuencia:
- si la suma de spans de una fila excede el espacio disponible, la colocación queda en manos del auto-placement normal de CSS grid
- si un nodo pide más columnas que las existentes, ocupará como máximo todo el ancho del grid padre

### 6. La semántica visual de `card` sigue centralizada en `runtime-node-styling.ts`
La variante `card` no debe introducir estilos inline generales ni lógica visual dispersa.

La capa central de styling debe resolver:
- clases base del `container`
- superficie de formulario cuando aplique
- superficie `card`
- convivencia entre `card` y `columns`

Motivo:
- sigue el límite arquitectónico ya existente para la gramática visual del runtime
- deja la variante unit-testable sin depender solo de snapshots de integración

### 7. `card` tiene precedencia sobre la superficie implícita de sección de formulario
Si un `container` dentro de `form` declara `variant: card`, la agrupación visual principal debe ser la tarjeta, no el divisor implícito de sección.

Consecuencia:
- el helper visual debe evitar una doble superficie confusa (`border-t` de sección + marco de card) cuando ambas competirían
- la semántica de layout del formulario se mantiene, pero la agrupación visible la domina la tarjeta

Motivo:
- evita dobles bordes y jerarquías visuales ambiguas
- hace que `card` siga siendo una variante cerrada y reconocible también dentro de formularios

## Riesgos y mitigaciones

### Riesgo: implementar `span` dentro de cada nodo
Mitigación:
- fijar wrapper genérico en el renderer central
- testear el comportamiento con nodos hoja y con nodos compuestos

### Riesgo: `span` mayor que el grid padre genere columnas implícitas
Mitigación:
- aplicar clamp contra `parentColumns` en runtime
- cubrirlo con tests de styling y de renderer

### Riesgo: `card` derive a una tarjeta genérica ajena al lenguaje actual
Mitigación:
- resolverla desde tokens y utilidades ya vigentes
- validar en tests que la variante añade una superficie cerrada, no una API visual nueva

### Riesgo: combinación ambigua entre `card` y `form-section`
Mitigación:
- fijar precedencia explícita de `card`
- cubrir el caso con tests de integración

## Impacto estructural previsto
- `src/config/runtime-config-types.ts`
- `src/config/runtime-config-zod.ts`
- `src/config/validate-runtime-config.ts`
- `src/config/runtime-config.ts` si hace falta reexportar tipos nuevos
- `src/runtime/layout-node-renderer.tsx`
- `src/runtime/nodes/container-layout-node.tsx`
- `src/runtime/runtime-node-styling.ts`
- `src/runtime/runtime-layout-context.tsx` como nuevo módulo si se materializa el contexto explícito de grid padre
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/runtime-node-styling.test.ts`
- `src/tests/layout-renderer.test.tsx`

## Preguntas abiertas
- No quedan preguntas técnicas bloqueantes para pasar a implementación.
- `repeater` no soporta `layout.span` como nodo propio en esta feature; el patrón soportado para repetición con ocupación de grid es declarar un nodo raíz visible en `props.template` y aplicar ahí `layout.span`.
- Si una iteración futura necesita spans responsive, auto-placement declarativo o variantes visuales adicionales, debe abrirse como feature separada.
