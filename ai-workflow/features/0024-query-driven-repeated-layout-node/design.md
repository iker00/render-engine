# Design: Query-driven repeated layout node

## Contexto
El runtime ya soporta tres piezas relevantes para esta feature:
- referencias centralizadas con `queries.*`, `forms.*` y `params.*`
- consumo declarativo de colecciones en `list`, `select`, `radioGroup` y `checkboxGroup`
- render transversal de nodos con `queryStateFeedback` y `visibility` desde el borde común de `layout-node-renderer.tsx`

Lo que todavía no existe es una forma de repetir un subárbol completo por cada item de una colección remota. Si se resolviera sin diseño previo, aparecerían cinco riesgos claros:
- sobrecargar `container` con dos semánticas distintas y volver ambiguo el contrato del layout
- introducir una convención nueva para leer el item actual distinta de la ya usada por otras colecciones
- dejar sin cerrar cómo se valida y renderiza una plantilla con varios nodos hermanos por iteración
- permitir claves React implícitas o inestables que degraden el render y los diagnósticos
- dispersar la lógica entre parser de referencias, renderer y nodos concretos

## Objetivos / No objetivos

### Objetivos
- Añadir un nodo nuevo y explícito para repetición por item, separado de `container`.
- Reutilizar como fuente solo arrays resueltos desde `queries.{queryName}.data` o `queries.{queryName}.data.*`.
- Permitir una plantilla declarativa con uno o varios nodos hermanos por iteración.
- Exponer un contexto local por item compatible con la lógica declarativa ya conocida en el runtime.
- Exigir un identificador declarativo por item para generar iteraciones estables.
- Mantener la semántica actual de `queryStateFeedback`, `visibility`, navegación y acciones remotas dentro del subárbol repetido.

### No objetivos
- Añadir nuevas fuentes de datos distintas de `queries.*`.
- Resolver filtros, ordenación, grouping, paginación, virtualización o transformaciones arbitrarias.
- Generar dinámicamente `formId`, `fieldId` o identificadores estructurales desde el item actual.
- Crear un sistema general de scopes o variables temporales reutilizable fuera de este caso.
- Añadir nodos visuales nuevos como `image`.

## Decisiones

### 1. La repetición se introduce como un nodo nuevo `repeater`
El contrato añadirá un nuevo `type: 'repeater'`. No se ampliará `container` con un modo alternativo de colección dinámica.

Shape objetivo:

```ts
type RepeaterLayoutNode = {
  type: 'repeater'
  id?: string
  props: {
    items: {
      source: string
      key: string
    }
    template: LayoutNode[]
  }
  queryStateFeedback?: QueryStateFeedbackConfig
  visibility?: RuntimeVisibilityConfig
}
```

Reglas:
- `props.items.source` debe apuntar a `queries.{queryName}.data` o `queries.{queryName}.data.*`
- `props.items.key` declara la ruta relativa dentro de cada item que aporta la identidad estable
- `props.template` contiene la colección de nodos a repetir por item
- `repeater` no admite `children`; toda la plantilla vive en `props.template`

Razonamiento:
- separar `repeater` de `container` evita mezclar layout estructural y expansión de datos en un mismo tipo
- `template` como colección explícita mantiene consistencia con la semántica ya estable de `layout` y `fallback`
- el nombre `key` hace visible que el contrato resuelve una necesidad real de identidad de iteración, no solo presentación

### 2. La fuente reutiliza la infraestructura de colecciones dinámicas ya existente
`props.items.source` debe seguir exactamente el mismo alcance contractual que hoy tienen `list` y los campos de selección dinámicos:
- `queries.{queryName}.data`
- `queries.{queryName}.data.{segmentosAnidados}`

Comportamiento runtime:
- si la query aún no existe, falla, la ruta no existe o el valor resuelto no es un array, `repeater` degrada a cero iteraciones
- no se invalida el config por el valor runtime actual; solo por una referencia contractual fuera de alcance o mal formada

Razonamiento:
- la spec pide “igual que en el resto de colecciones”
- reutilizar la semántica de degradación actual evita una rama especial solo para este nodo

### 3. El contexto local por iteración entra como un namespace nuevo y acotado: `item`
Dentro de `props.template`, el runtime soportará una nueva familia de referencias completas:
- `item`
- `item.{segmentosAnidados}`

Semántica:
- `item` devuelve el valor completo de la iteración actual
- `item.*` permite navegar objetos y arrays con la misma lógica ya fijada para `queries.{queryName}.data.*`
- los segmentos numéricos se interpretan como índice solo cuando el valor actual es array
- navegar más allá de un valor no navegable produce `missing`, no `invalid`

Superficies mínimas soportadas desde la primera iteración:
- `heading.props.text`
- `paragraph.props.text`
- `api.query`
- `api.body`
- `api.headers`
- `button.props.action.query`
- `button.props.action.body`
- `button.props.action.headers`
- `navigateTo.params`
- `defaultValue` de campos
- `list/select/radioGroup/checkboxGroup.props.items.source` cuando el subárbol repetido los use
- `visibility.reference`
- `repeater.props.items.key`

Fuera de alcance en esta feature:
- usar `item.*` fuera de un subárbol `repeater`
- soportar `item.*` como texto interpolado parcial

Razonamiento:
- hace falta un namespace nuevo porque las colecciones actuales no crean contexto local por item
- `item` es más corto y claro que reusar nombres ambiguos como `current`, `entry` o `row`
- limitarlo al subárbol del `repeater` evita abrir un sistema global de variables

### 4. La plantilla se valida como una colección normal de `LayoutNode[]`
`props.template` reutiliza exactamente el mismo catálogo de nodos soportados por el runtime. La validación estructural debe:
- exigir que `template` exista y sea un array
- reutilizar el parser recursivo de layout ya existente
- permitir cualquier nodo hoy válido en un subárbol normal, incluidos formularios
- conservar las mismas reglas estructurales del runtime dentro de la repetición

Consecuencias:
- un `form` dentro de un `repeater` es contractual y técnicamente válido
- la feature no crea un subcatálogo restringido solo para lectura
- cualquier restricción vigente fuera del `repeater` sigue aplicando dentro, por ejemplo campos solo dentro de `form`

Razonamiento:
- la decisión de producto es permitir todo el catálogo
- reusar el parser actual evita un dialecto nuevo del layout

### 5. La identidad de iteración se resuelve con `props.items.key` como ruta relativa obligatoria
`props.items.key` será una ruta relativa al item actual, no una referencia completa global.

Ejemplos válidos:
- `id`
- `slug`
- `meta.uuid`
- `0` cuando el item actual sea un array y su primer valor sea el identificador

Ejemplos inválidos:
- `queries.posts.data.0.id`
- `item.id`
- ``

Reglas:
- la ruta debe ser sintácticamente válida
- para cada item renderizado, la ruta debe resolver a un escalar `string | number`
- si resuelve `null`, `undefined`, objeto, array o boolean, esa iteración se considera inválida
- si dos items producen la misma key efectiva dentro de la misma colección, el runtime debe tratarlo como diagnóstico de desarrollo y degradar de forma segura sin prometer estabilidad

Decisión de degradación:
- la implementación no derivará una key automática alternativa
- en desarrollo debe emitirse un diagnóstico claro
- en producción el runtime puede omitir las iteraciones inválidas o caer a una clave derivada interna estable solo para no romper render, pero esa vía no forma parte del contrato funcional y no debe ocultar el problema en desarrollo

Razonamiento:
- el usuario pidió una clave declarativa y no una heurística dinámica
- permitir boolean, objetos o duplicados como key dejaría el render en un estado incoherente difícil de depurar

### 6. La resolución de `item.*` se integra en la capa central de referencias, no en cada nodo
La implementación técnica debe extender `src/runtime/runtime-references/` para admitir un contexto opcional de iteración.

Partición prevista:
- `runtime-reference-types.ts`: añadir el namespace `item`
- `runtime-reference-parser.ts`: reconocer `item` e `item.*` como familia soportada solo cuando exista contexto de iteración
- `runtime-reference-resolver.ts`: resolver `item` e `item.*` mediante lookup seguro sobre el valor del item actual
- `runtime-reference-diagnostics.ts`: describir claramente uso fuera de contexto y fallos de resolución

El renderer no debe hacer parsing manual de `item.*`; solo inyectar el contexto de iteración al resolver referencias.

Razonamiento:
- mantiene un único punto de verdad para `literal | supported | unsupported | invalid | missing`
- evita semánticas distintas entre texto, acciones y fuentes de colección descendientes

### 7. `repeater` se renderiza como expansión estructural en el borde central del layout
La lógica preferida vive en `layout-node-renderer.tsx` o en un helper dedicado llamado desde ahí.

Flujo:
1. evaluar `queryStateFeedback` y `visibility` del nodo `repeater` igual que cualquier otro nodo
2. resolver `props.items.source` a una colección efectiva
3. para cada item, construir un contexto de iteración `{ item }`
4. renderizar `props.template` con `LayoutRenderer`
5. agrupar las iteraciones como hermanos, sin wrapper artificial obligatorio

Esto probablemente exige ampliar `LayoutRenderer` y `LayoutNodeRenderer` para aceptar un contexto opcional de iteración que baje por el subárbol actual.

Razonamiento:
- `repeater` no es un nodo visual con markup propio; es una expansión del árbol declarativo
- centralizarlo en el borde común evita que cada nodo descendiente conozca la iteración

### 8. Los diagnósticos distinguen entre error contractual y dato runtime incompleto
Validación previa al render debe rechazar:
- `repeater` sin `props.items`
- `props.items.source` fuera del alcance permitido
- `props.items.key` vacío o mal formado
- `props.template` ausente o no array
- claves extra incompatibles en el shape del nodo

Resolución runtime debe degradar sin romper:
- colección ausente o no array en `source`
- `item.*` que no encuentra un dato esperado dentro de un nodo concreto

Los problemas de key efectiva por item quedan en una categoría intermedia:
- config estructural válido
- dato runtime inválido para la garantía de identidad
- diagnóstico visible en desarrollo y degradación segura en runtime

Razonamiento:
- mantiene la distinción central del proyecto entre config inválido y dato backend no confiable
- evita intentar validar en bootstrap información que solo existe al ejecutar la query

## Estructura objetivo

```txt
src/
  config/
    runtime-config-types.ts
    runtime-config-zod.ts
    validate-runtime-config.ts
  runtime/
    layout-renderer.tsx
    layout-node-renderer.tsx
    runtime-collection-sources.ts
    runtime-references/
      runtime-reference-types.ts
      runtime-reference-parser.ts
      runtime-reference-resolver.ts
      runtime-reference-diagnostics.ts
    nodes/
      repeater-layout-node.tsx
  tests/
    runtime-reference-resolution.test.tsx
    layout-renderer.test.tsx
    runtime-config-validation.test.ts
```

Notas:
- `repeater-layout-node.tsx` debería ser una pieza mínima o incluso una capa fina si la expansión real vive en el renderer central
- `runtime-collection-sources.ts` puede reutilizarse para resolver `source`, pero probablemente hará falta separar el helper de “colección efectiva” del mapeo específico de consumidores actuales

## Riesgos y trade-offs
- Riesgo: abrir `item.*` fuera del `repeater` y convertirlo en un scope global difuso.
  Mitigación: soportarlo solo cuando exista contexto explícito de iteración.

- Riesgo: reusar `children` y hacer que `repeater` se parezca demasiado a `container`.
  Mitigación: usar `props.template` como colección explícita propia del nodo.

- Riesgo: romper nodos descendientes al pasar un contexto extra por el renderer.
  Mitigación: añadir el contexto como parámetro opcional y mantener el comportamiento actual cuando no exista.

- Riesgo: keys duplicadas o no escalares en datos reales del backend.
  Mitigación: exigir `props.items.key`, diagnosticar en desarrollo y no introducir heurísticas silenciosas como contrato.

- Riesgo: acoplar la feature a casos solo de lectura y bloquear futuros usos legítimos con formularios.
  Mitigación: validar `template` con el catálogo completo ya soportado.

## Migración o despliegue
No hay migración persistida ni cambios de despliegue especiales.

Compatibilidad esperada:
- configuraciones actuales siguen siendo válidas
- `item.*` no existe fuera de `repeater`
- el runtime no cambia comportamiento observable en pantallas que no usen el nuevo nodo

## Preguntas abiertas
- No quedan preguntas abiertas que bloqueen la planificación si se respeta este diseño.
