# Design: Feature 0041 - responsive-container-grid-layout

## Contexto
El runtime ya soporta `container.props.columns` como entero fijo entre `1` y `12`, cambia a modo grid cuando existe `columns`, y aplica `node.layout.span` desde el renderer central mediante contexto de layout padre. Ese comportamiento quedó cerrado en features previas y está documentado como parte estable del contrato.

La nueva feature no cambia el modelo conceptual de grid; amplía dos valores existentes para admitir un shape responsive. La decisión técnica principal es evitar que esta ampliación se convierta en un sistema genérico de estilos por breakpoint y mantenerla dentro de la capa central de contrato, contexto y styling.

## Objetivos / No objetivos

### Objetivos
- Reutilizar el contrato vigente de `columns` y `layout.span` aceptando `number | responsive map`.
- Mantener una lista cerrada de breakpoints alineada con Tailwind: `base`, `sm`, `md`, `lg`, `xl`, `2xl`.
- Resolver clases de grid y span desde la capa central de styling, no desde cada nodo visual.
- Preservar compatibilidad total con configuraciones que usan enteros fijos.
- Mantener clamp seguro de `span` frente a las columnas efectivas del padre para cada breakpoint.

### No objetivos
- Introducir breakpoints configurables.
- Añadir responsive declarativo a otras props.
- Cambiar la estructura visual de `container`, `card`, formularios o `repeater`.
- Evaluar media queries en JavaScript durante resize.
- Abrir clases Tailwind arbitrarias desde JSON.

## Decisiones

### 1. Un tipo compartido para valores responsive acotados
`columns` y `layout.span` deben compartir el mismo shape conceptual:

```json
{
  "base": 1,
  "md": 2,
  "lg": 4
}
```

Reglas:
- el valor fijo sigue siendo un entero entre `1` y `12`
- el mapa responsive solo admite claves `base`, `sm`, `md`, `lg`, `xl`, `2xl`
- cada valor del mapa es un entero entre `1` y `12`
- las claves omitidas no son error

Motivo:
- evita duplicar semánticas entre `columns` y `span`
- mantiene pequeña la superficie pública
- permite testear validación y resolución como una capacidad compartida

### 2. `base` es el valor móvil y el fallback seguro
`base` representa la clase sin prefijo responsive.

Fallbacks efectivos:
- `columns` sin `base` debe comportarse como `1` columna hasta que aplique el primer breakpoint declarado
- `span` sin `base` debe comportarse como `1` columna hasta que aplique el primer breakpoint declarado

Motivo:
- evita layouts rotos en móvil por omisión accidental de `base`
- mantiene el comportamiento más conservador cuando el backend declara solo breakpoints superiores

### 3. La resolución debe normalizar por breakpoint antes de generar clases
La capa de styling debe transformar cada valor fijo o mapa en una tabla efectiva por breakpoint, siguiendo el orden `base`, `sm`, `md`, `lg`, `xl`, `2xl`.

Para `columns`:
- entero fijo `4` conserva la salida histórica `grid-cols-4` y se interpreta internamente como `4` columnas efectivas en todos los breakpoints
- mapa responsive usa `base: 1` si falta y propaga cada valor declarado hacia los breakpoints superiores hasta que otro valor declarado lo sustituye

Para `span`:
- entero fijo `2` conserva la salida histórica `col-span-2` cuando el padre fijo lo permite y se interpreta internamente como `2` en todos los breakpoints donde haya grid efectivo
- mapa responsive usa `base: 1` si falta y propaga cada valor declarado hacia los breakpoints superiores hasta que otro valor declarado lo sustituye

Motivo:
- simplifica el clamp por breakpoint
- hace explícito el comportamiento de omisiones
- refleja la cascada real de clases responsive de Tailwind sin depender de herencia implícita difícil de testear

### 4. El clamp de `span` se calcula contra las columnas efectivas por breakpoint
La regla vigente `effectiveSpan = min(requestedSpan, parentColumns)` pasa a aplicarse por breakpoint.

Ejemplo:

```json
{
  "columns": { "base": 1, "md": 2, "lg": 3 },
  "childSpan": { "base": 2, "md": 2, "lg": 4 }
}
```

Resultado esperado:
- `base`: `span 1`
- `md`: `span 2`
- `lg`: `span 3`

La generación de clases de `span` debe considerar la línea temporal combinada del hijo y del padre. Si el padre cambia columnas en un breakpoint que el hijo no declara, el runtime debe recalcular el `span` efectivo en ese breakpoint y emitir una clase responsive cuando el resultado cambie. Por ejemplo, con `columns: { "base": 1, "lg": 3 }` y `layout.span: { "md": 2 }`, el hijo debe quedar en una salida equivalente a `col-span-1 lg:col-span-2`, porque el valor solicitado `2` declarado en `md` sigue vigente y el clamp del padre ya permite ocupar dos columnas desde `lg`.

Motivo:
- impide columnas implícitas no deseadas
- conserva la degradación segura ya vigente
- permite que el padre aumente o reduzca columnas sin asumir una progresión monotónica

### 5. Las clases responsive deben ser enumerables y estables
El runtime no debe construir clases que Tailwind no pueda detectar en build.

Estrategia esperada:
- mantener mapas cerrados de clases para `grid-cols-1` a `grid-cols-12`
- mantener mapas cerrados de clases responsive para `sm:grid-cols-*`, `md:grid-cols-*`, `lg:grid-cols-*`, `xl:grid-cols-*`, `2xl:grid-cols-*`
- aplicar el mismo patrón para `col-span-*`

Motivo:
- encaja con Tailwind CSS v4 y con la convención actual de styling centralizado
- evita safelists amplias o generación opaca de clases
- hace la salida verificable con tests de unidad

### 6. El contexto de layout padre debe transportar el shape efectivo, no solo un número fijo
El contexto actual de grid padre debe evolucionar para que el renderer pueda conocer columnas efectivas por breakpoint.

Reglas:
- fuera de grid efectivo, el contexto sigue indicando ausencia de grid
- en grid fijo, el contexto puede normalizarse como tabla efectiva equivalente
- en grid responsive, el contexto transporta la tabla efectiva resuelta para todos los breakpoints soportados

Motivo:
- `span` responsive necesita comparar contra el padre por breakpoint
- evita que cada nodo conozca el shape original de `container`
- mantiene el store global del runtime fuera de la semántica de layout

### 7. La validación contextual sigue fuera de alcance
La validación estructural debe rechazar shapes inválidos, pero no debe exigir que un nodo con `layout.span` viva dentro de un grid.

Motivo:
- conserva el contrato vigente de `layout.span`
- evita validaciones de árbol más complejas y frágiles
- permite que `queryStateFeedback`, `visibility` y `repeater` sigan componiendo subárboles sin reglas especiales de bootstrap

## Riesgos y trade-offs

### Riesgo: clases Tailwind dinámicas invisibles para el build
Mitigación:
- usar mapas de clases enumerados para columnas y spans fijos/responsive
- cubrir la salida de clases con tests de styling

### Riesgo: mapas responsive con omisiones generen layouts móviles pobres
Mitigación:
- fallback explícito a una columna en `columns` y `span`
- documentar `base` como forma recomendada para declarar móvil

### Riesgo: duplicar lógica entre `columns` y `span`
Mitigación:
- extraer una resolución compartida de valor fijo o mapa responsive
- mantener el rango `1..12` y los breakpoints cerrados en una única convención

### Riesgo: romper compatibilidad con enteros fijos
Mitigación:
- tratar los enteros como caso normalizado equivalente
- incluir tests de regresión para `columns: 4` y `layout.span: 2`

## Migración o despliegue
No requiere migración de configuraciones existentes. Los enteros fijos actuales siguen siendo válidos y conservan su comportamiento observable.

La documentación funcional deberá actualizarse después de la implementación para reflejar el nuevo shape `number | responsive map`.

## Preguntas abiertas
No quedan preguntas técnicas bloqueantes para pasar a planificación.
