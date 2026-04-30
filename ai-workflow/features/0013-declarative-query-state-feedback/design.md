# Design: Declarative query state feedback

## Contexto
La feature `0010` ya dejó operativo el dominio compartido `queries.{queryName}` y la orquestación automática de `preloads`, mientras que `0012` consolidó la validación previa al render del contrato JSON con base `Zod`. El runtime actual ya puede:
- ejecutar operaciones remotas declaradas por nombre
- reflejar su estado en `queries.{queryName}.status`, `data` y `error`
- conservar el último `data` válido durante recargas
- renderizar nodos visibles desde `layout` con un dispatcher central en `src/runtime/layout-node-renderer.tsx`

Lo que todavía no existe es una forma declarativa y local a cada nodo para decidir qué renderizar cuando la query de la que depende está en `loading`, `error`, `empty` o `success`. Resolver esto sin diseño previo dejaría abiertas varias ambigüedades:
- dónde vive el bloque de configuración en cada nodo
- cómo se representa un fallback con varios nodos sin inventar un wrapper artificial
- cómo se calcula `empty` de forma uniforme y testeable
- en qué capa del runtime se evalúa el feedback para no mezclar reglas de negocio con componentes visuales concretos

## Objetivos / No objetivos

### Objetivos
- Añadir una capacidad declarativa opcional por nodo para reaccionar al estado de una única query.
- Mantener el shape simple de generar desde backend legacy.
- Permitir tres respuestas por estado visible: `show`, `hide` y `fallback`.
- Permitir que `fallback` represente una colección local de nodos, no solo un nodo único.
- Reutilizar `queries.{queryName}` como única fuente de verdad y mantener `idle` alineado visualmente con `loading`.
- Rechazar antes del render configuraciones inválidas del bloque de feedback o de sus fallbacks.

### No objetivos
- Abrir un motor general de condiciones, expresiones o dependencias múltiples por nodo.
- Introducir un nuevo namespace declarativo como `pageEntry.*` en esta fase.
- Abrir navegación declarativa adicional sobre `queries.{queryName}.error.*` o reglas de emptiness configurables por dominio.
- Mover la lógica de feedback a los nodos visuales concretos o a la capa de red.

## Decisiones

### 1. El bloque de feedback será transversal y vivirá en la raíz del nodo como `queryStateFeedback`
Cada nodo soportado del layout podrá declarar opcionalmente:

```ts
queryStateFeedback?: {
  query: string
  states?: {
    loading?: QueryStateFeedbackRule
    error?: QueryStateFeedbackRule
    empty?: QueryStateFeedbackRule
    success?: QueryStateFeedbackRule
  }
}
```

Y cada regla tendrá uno de estos shapes:

```ts
type QueryStateFeedbackRule =
  | { mode: 'show' }
  | { mode: 'hide' }
  | { mode: 'fallback'; fallback: LayoutNode[] }
```

Razonamiento:
- la capacidad afecta a cualquier nodo y no forma parte de `props` visuales de `container`, `heading`, `paragraph`, `list` o `button`
- dejarla en la raíz evita duplicar shapes dentro de cada `props`
- `query` como string simple mantiene el contrato fácil de serializar desde backend

### 2. El fallback local se representará como `LayoutNode[]`
La rama `fallback` no usará un nodo único ni un wrapper sintético. El contrato estable será una colección local reutilizando el mismo catálogo de nodos soportados por `layout`.

Razonamiento:
- la spec exige soportar fallbacks con varios nodos visibles
- usar `LayoutNode[]` mantiene la semántica ya consolidada de colección ordenada
- evita forzar un `container` artificial solo para cumplir el shape

### 3. La semántica visible se resolverá en dos pasos: estado de query y respuesta configurada
La implementación debe separar:
- una capa de derivación de estado visible de query:
  - `idle` y `loading` proyectan `loading`
  - `error` proyecta `error`
  - `success` con dato vacío proyecta `empty`
  - `success` con dato no vacío proyecta `success`
- una capa de resolución de respuesta por nodo:
  - `success` por defecto es `show`
  - `loading`, `error` y `empty` por defecto son `hide`
  - las reglas explícitas del nodo sobrescriben ese default

Razonamiento:
- separa la regla de negocio compartida del detalle de render
- facilita tests unitarios directos de semántica
- evita que cada nodo visual reimplemente defaults o emptiness

### 4. La heurística de `empty` vivirá en una utilidad explícita del runtime
La definición de vacío de esta v1 será única y reutilizable:
- `null` y `undefined`
- `''`
- `[]`
- `{}`

No serán vacíos:
- `0`
- `false`
- strings no vacíos
- arrays u objetos con contenido

Razonamiento:
- la spec fija una heurística transversal y cerrada para esta iteración
- centralizarla evita divergencia entre tests, renderer y futuros consumidores

### 5. La evaluación del feedback ocurrirá en el renderer central, no en cada nodo concreto
El punto preferido de integración será `src/runtime/layout-node-renderer.tsx` o un helper adyacente llamado desde ahí. La pieza central debe:
- recibir el nodo completo
- consultar el estado compartido de runtime
- decidir si renderiza el nodo original, nada, o un `LayoutRenderer` con el fallback

Los componentes concretos (`heading`, `paragraph`, `list`, `button`, `container`) no deben incorporar lógica propia de `queryStateFeedback`.

Razonamiento:
- mantiene la lógica transversal en un único borde del renderer
- evita repetir lectura de estado y política de defaults en todos los nodos
- respeta el principio de componentes visuales centrados en presentación

### 6. La validación estructural del bloque se apoyará en `Zod` y reutilizará el parser recursivo del layout
`src/config/runtime-config-zod.ts` debe incorporar el nuevo bloque opcional a cada nodo soportado y validar:
- `query` como string no vacío
- `states` como mapa opcional limitado a `loading | error | empty | success`
- `mode` como `show | hide | fallback`
- `fallback` obligatorio cuando `mode` es `fallback`
- `fallback` como colección de nodos válidos del catálogo vigente

La validación debe seguir descartando claves extra en la raíz de `queryStateFeedback` y en cada regla individual, pero no debe degradar silenciosamente nombres de estado desconocidos dentro de `states`: claves como `succes` o `pending` deben rechazar el config completo porque alteran directamente la semántica visible de la feature. También debe rechazar el bloque completo si cualquier fallback es inválido.

Razonamiento:
- la feature cruza contrato y renderer, así que la validación previa al render debe seguir siendo la frontera de seguridad
- reusar el parser recursivo del layout evita crear un segundo dialecto de nodos solo para fallbacks
- permitir typos silenciosos en los nombres de estado convertiría un error contractual en un cambio visual difícil de diagnosticar

### 7. La ausencia de estado runtime para una query seguirá degradando a la rama equivalente a `loading`
Si `queries.{queryName}` todavía no existe en el store o nunca se ejecutó, el feedback declarativo debe tratarla visualmente como `loading`.

Razonamiento:
- la spec fija ese comportamiento para queries inexistentes o nunca ejecutadas
- evita introducir una quinta rama visible o un estado especial de “missing query”

## Riesgos y trade-offs
- Riesgo: inflar demasiado el contrato del nodo con una sintaxis difícil de producir.
  Mitigación: un único bloque opcional, una sola query y un conjunto cerrado de modos/estados.

- Riesgo: duplicar lógica entre render del nodo original y render del fallback.
  Mitigación: resolver la decisión en una capa central y reutilizar `LayoutRenderer` para fallbacks.

- Riesgo: introducir recursión de validación confusa entre layout principal y fallbacks.
  Mitigación: reutilizar el mismo parser de colección de nodos y mantener una única definición de catálogo soportado.

- Riesgo: ambigüedad sobre `loading` cuando existe `data` previo durante una recarga.
  Mitigación: fijar contractualmente que `status: loading` siempre proyecta `loading`, incluso con `data` anterior conservado.

- Riesgo: intentar extender en silencio la feature hacia `pageEntry` o reglas arbitrarias.
  Mitigación: dejar esos casos fuera del contrato y documentarlos como futuras iteraciones separadas.

## Migración o despliegue
No hay migración persistida ni cambios de despliegue especiales.

Compatibilidad esperada:
- nodos sin `queryStateFeedback` mantienen el comportamiento observable actual
- configuraciones previas siguen siendo válidas
- el bundle solo añade validación y render condicional dentro del runtime existente

## Preguntas abiertas
- No quedan preguntas abiertas que deban resolverse durante implementación si se respeta este shape contractual.
