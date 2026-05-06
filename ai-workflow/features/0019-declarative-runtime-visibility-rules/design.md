# Design: Declarative runtime visibility rules

## Objetivo técnico
Introducir un bloque declarativo `visibility` reutilizable por cualquier nodo del runtime sin abrir un motor general de reglas y sin duplicar lógica entre render y validación de formularios.

La implementación debe dejar una única semántica de visibilidad efectiva para:
- render de nodos del layout
- inicialización visible de campos de formulario
- exclusión de campos ocultos durante la validación `required`

## Decisiones de diseño

### 1. `visibility` se modela como una capacidad transversal de nodo
El bloque `visibility` formará parte del contrato común de `LayoutNode`, igual que hoy ocurre con `queryStateFeedback`.

Esto evita:
- introducir variantes por tipo de nodo
- duplicar shape entre nodos de formulario y nodos generales
- reabrir el contrato más adelante cuando la capacidad ya es transversal por definición funcional

### 2. Una única condición por nodo
La v1 mantendrá exactamente una condición por nodo con este modelo conceptual:
- `reference`
- `operator`
- `value` opcional según operador

No habrá arrays de reglas ni composición booleana. La ausencia de composición no se tratará como limitación accidental sino como restricción deliberada del contrato.

### 3. La evaluación debe vivir fuera de los nodos visuales
La lógica de evaluación no debe implementarse dentro de `heading`, `input`, `select` ni otros nodos concretos.

Se añadirá una capa específica del runtime para:
- resolver la referencia observada
- normalizar el valor ausente
- evaluar el operador
- devolver una decisión booleana estable

Eso permite que renderer y formularios consuman exactamente la misma decisión sin reinterpretarla.

### 4. `queryStateFeedback` mantiene prioridad sobre `visibility`
La precedencia acordada por spec será:
1. resolver `queryStateFeedback`
2. si el resultado visible sigue siendo el nodo original, evaluar `visibility`
3. si `queryStateFeedback` decide `hide` o `fallback`, `visibility` ya no reabre ese resultado

Motivo:
- `queryStateFeedback` ya modela estados visibles agregados de query y `fallback`
- evita ambigüedad cuando ambos bloques observan la misma query
- preserva que `fallback` siga siendo una capacidad exclusiva de `queryStateFeedback`

### 5. La visibilidad efectiva debe exponerse como una utilidad reutilizable
La validación de formularios ya reutiliza la semántica visible de `queryStateFeedback`. Con `visibility`, esa reutilización debe generalizarse.

En lugar de preguntar por `queryStateFeedback` en un sitio y por `visibility` en otro, el runtime debe disponer de una utilidad única equivalente a “este nodo/campo está visible ahora”.

Esa utilidad debe aceptar:
- el nodo
- el snapshot de estado del runtime
- el contexto necesario para resolver referencias existentes

Y debe devolver un resultado suficiente para dos consumidores:
- renderer: `show | hide | fallback`
- formularios: visibilidad booleana efectiva del campo

### 6. `visibility` no debe crear un segundo sistema de referencias
La resolución de `reference` debe reutilizar la infraestructura ya existente de `runtime-references`.

Esto implica:
- admitir solo referencias ya soportadas por el parser y el resolver actual
- mantener fuera `navigation.*`, `routeParams.*` y otros namespaces reservados
- tratar referencias válidas sin dato disponible como valor ausente, no como error fatal de ejecución

La validación previa al render seguirá siendo responsable de rechazar referencias fuera del contrato permitido para `visibility`.

### 7. Semántica de operadores deliberadamente pequeña
La evaluación seguirá estas reglas:
- `equals` y `notEquals`: comparación directa contra un literal escalar declarado (`string`, `number`, `boolean` o `null`)
- `isTruthy` y `isFalsy`: decisión sobre verdad/falsedad del valor resuelto, incluyendo ausencias
- `greaterThan` y `lessThan`: comparación numérica; si el valor observado es un array, usar `length`

No se abrirán en v1:
- una segunda referencia runtime dentro de `value`
- comparaciones lexicográficas de strings
- comparación profunda de objetos
- comparación item a item en arrays
- coerciones complejas para “hacer que encaje”

Cuando el valor runtime no sea comparable por el operador elegido, la evaluación debe degradar a “no match” de forma estable en vez de inventar conversiones implícitas.

### 8. Los campos ocultos conservan estado, pero salen del circuito visible
Ocultar un campo por `visibility` no debe:
- limpiar `value`
- limpiar `error`
- reinicializar `defaultValue`
- perder `dirty` o `touched`

Sí debe:
- excluir ese campo de la validación `required` mientras siga oculto
- impedir que un error persistido de ese campo bloquee el submit por el mero hecho de seguir almacenado

Cuando el campo vuelva a ser visible, el runtime retomará su estado local existente.

## Impacto estructural previsto

### Contrato y validación
Habrá que extender:
- tipos del runtime config para añadir `visibility`
- esquemas `Zod` del catálogo de nodos
- validaciones cruzadas que restrinjan operadores y referencias admitidas

La validación debe seguir detectando:
- operadores no soportados
- referencias fuera del alcance permitido
- uso incorrecto de `value` según el operador

### Runtime y renderer
Habrá que introducir una utilidad transversal de visibilidad efectiva dentro de `runtime/`, cercana a la lógica ya centralizada de `queryStateFeedback`.

El renderer central debe consumir esa utilidad, no reimplementar reglas en cada nodo.

### Formularios
La lógica que hoy decide qué campos cuentan como visibles para `required` debe pasar a depender de la nueva utilidad de visibilidad efectiva, no solo de `queryStateFeedback`.

Eso reduce el riesgo de divergencia entre:
- lo que el usuario ve
- lo que el renderer oculta
- lo que el submit considera validable

## Estrategia de partición recomendada
La implementación debería separarse en este orden:
1. contrato y validación de `visibility`
2. evaluador runtime reutilizable y precedencia con `queryStateFeedback`
3. integración en renderer
4. integración en formularios y validación visible
5. actualización de tests y documentación funcional

Ese orden permite fijar primero el contrato, luego la semántica única, y solo después conectarla a consumidores.

## Riesgos y mitigaciones

### Riesgo: divergencia entre render y validación
Si renderer y formularios evalúan `visibility` por separado, aparecerán inconsistencias.

Mitigación:
- una única utilidad de visibilidad efectiva consumida por ambos flujos

### Riesgo: ambigüedad entre `queryStateFeedback` y `visibility`
Si la precedencia no queda codificada en un único punto, distintos consumidores podrían resolverla distinto.

Mitigación:
- centralizar precedencia en la misma capa que decide el resultado visible transversal

### Riesgo: expansión silenciosa del lenguaje condicional
Si el diseño intenta “aprovechar” la iteración para admitir más operadores o combinaciones, la feature se volverá más difícil de explicar y validar.

Mitigación:
- limitar el contrato a una condición simple y hacer que los casos no comparables degraden a no match

### Riesgo: tratamiento inconsistente del valor ausente
Queries no ejecutadas, rutas sin dato y campos aún no poblados comparten la noción de ausencia.

Mitigación:
- formalizar valor ausente en el evaluador y aplicar la misma regla a todos los operadores

## Resultado esperado de este diseño
Al terminar la implementación, el runtime debe tener una sola semántica de visibilidad declarativa simple:
- `queryStateFeedback` para estados visibles de query y `fallback`
- `visibility` para show/hide según valores concretos del runtime

Ambas capacidades deben convivir sin ambigüedad, y los formularios deben reaccionar a esa visibilidad efectiva sin lógica paralela.
