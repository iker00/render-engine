# Feature 0060: Manejo robusto de errores

## Objetivo
Ampliar el manejo de errores del runtime en tres dimensiones coordinadas: detectar errores de negocio embebidos en respuestas HTTP 200 (patrón frecuente en APIs legacy), exponer los campos del objeto de error como referencias navegables (`error.message`, `error.code`), y garantizar que `data` se vacía cuando una query falla.

## Alcance

### 1. Detección de errores en respuestas 200 (`errorCondition`)
Permitir que una entrada del catálogo `api` declare una condición que, si se cumple en el body de una respuesta 200 exitosa, trate la respuesta como error.

La condición se declara con `errorCondition` en la entrada `api`:
- `path`: ruta dot-notation en el body de la respuesta (obligatorio)
- `equals` o `notEquals`: literal escalar (`string`, `number`, `boolean`, `null`) para comparar el valor encontrado en `path`; si se omite cualquiera de los dos, la condición se evalúa como truthiness del valor en `path`
- `equals` y `notEquals` son mutuamente excluyentes

Cuando la condición se cumple:
- La query transita a `status: error` y `data` a `null`
- El error se extrae del body usando los campos opcionales `errorMessagePath` y `errorCodePath` (dot-notation)
- Si `errorMessagePath` resuelve un string no vacío → se usa como `error.message`; si no → mensaje genérico `"Error en la respuesta del servidor"`
- Si `errorCodePath` resuelve un string o number → se coerce a string y se usa como `error.code`; si no → `code` queda ausente

El runtime añade un nuevo código de error tipado `"business-error-condition"` para identificar este caso en ausencia de `errorCodePath`.

Ejemplos de config orientativos:
```json
"getUser": {
  "method": "GET",
  "url": "/api/user",
  "errorCondition": { "path": "code", "notEquals": 200 },
  "errorMessagePath": "message",
  "errorCodePath": "code"
}
```
```json
"search": {
  "method": "POST",
  "url": "/api/search",
  "errorCondition": { "path": "success", "equals": false },
  "errorMessagePath": "error.message",
  "errorCodePath": "error.code"
}
```

### 2. Navegación dentro de `error` (`error.message`, `error.code`)
Extender el catálogo de referencias para admitir navegación bajo `queries.{queryName}.error`:
- `queries.{queryName}.error.message`
- `queries.{queryName}.error.code`

Solo estos dos sub-paths son referencias válidas. Cualquier otra ruta bajo `error` sigue siendo inválida y la config se rechaza antes del render.

Superficies habilitadas: las mismas que ya admiten `queries.{queryName}.error`:
- Superficies visibles interpolables: `heading.props.text`, `paragraph.props.text`, `button.props.label`, labels y placeholders de `input`/`textarea`/`select`/`radioGroup`/`checkboxGroup`, `list`, celdas de `table`, `image.props.alt`
- Interpolación parcial `{{queries.myQuery.error.message}}` y `{{queries.myQuery.error.code}}` en las mismas superficies
- `visibility.reference`

### 3. Vaciar `data` al fallar
Cuando una query transita a `status: error`, `data` se fija a `null`, incluso si había datos válidos del ciclo de éxito anterior.

Aplica a todos los tipos de error existentes y al nuevo `business-error-condition`:
- `network-error`
- `http-error`
- `invalid-json-response`
- `operation-not-found`
- `request-build-failed`
- `business-error-condition`

## Fuera de alcance
- Navegación bajo `error.*` más allá de `.message` y `.code`
- Múltiples `errorCondition` por endpoint
- `errorCondition` con lógica booleana compuesta (`AND`, `OR`)
- `errorCondition` con rangos numéricos (`greaterThan`, `lessThan`)
- Condiciones de error basadas en headers de respuesta
- Condición de error combinada con el status HTTP (por ejemplo, "solo si viene 200 Y el campo X")
- Transformación del body en el camino entre respuesta y `data`

## Requisitos funcionales

### RF-1: `errorCondition` en el catálogo `api`
1. La entrada `api` puede declarar opcionalmente `errorCondition` con `path` (obligatorio si el bloque existe) y opcionalmente `equals` o `notEquals` (mutuamente excluyentes)
2. Si `equals` y `notEquals` están ambos presentes, la config se rechaza antes del render
3. Si `errorCondition.path` está declarado pero es string vacío, la config se rechaza antes del render
4. `errorMessagePath` y `errorCodePath` son opcionales en la entrada `api`; si se declaran, deben ser strings no vacíos o la config se rechaza
5. Si `errorCondition` no está declarado en la entrada, el comportamiento de esa operación no cambia respecto al estado actual

### RF-2: Evaluación y transición al ejecutar una operación
6. Si la respuesta HTTP no es `ok` (4xx/5xx), el error existente `http-error` se produce como antes; `errorCondition` no se evalúa
7. Si la respuesta es 200 con JSON válido y `errorCondition` está declarado, el runtime evalúa la condición sobre el body ya parseado
8. Si la condición se cumple, la query transita a `status: error` con el error extraído según RF-3/RF-4 y `data: null`
9. Si la condición no se cumple, la query transita a `status: success` con el dato normal, como hasta ahora
10. Si `errorCondition.path` apunta a un segmento ausente en el body, la condición no se cumple (no es error)
11. `errorCondition` con `equals: null` cumple la condición cuando el valor en `path` es exactamente `null`

### RF-3: Extracción del mensaje de error
12. Si `errorMessagePath` resuelve un string no vacío en el body, ese string se guarda como `error.message`
13. Si `errorMessagePath` no está declarado, no resuelve, o el valor no es string no vacío, `error.message` es `"Error en la respuesta del servidor"`

### RF-4: Extracción del código de error
14. Si `errorCodePath` resuelve un string o number en el body, se coerce a string y se guarda como `error.code`
15. Si `errorCodePath` no está declarado o no resuelve, `error.code` queda ausente

### RF-5: Navegación en `error.message` y `error.code`
16. Las referencias `queries.{queryName}.error.message` y `queries.{queryName}.error.code` son válidas en todas las superficies que ya admiten `queries.{queryName}.error`
17. Si la query no tiene error activo (`error` es `null`), `error.message` y `error.code` degradan a string vacío en superficies visibles y a valor ausente en `visibility`
18. Rutas bajo `error` distintas de `.message` y `.code` son inválidas; la config se rechaza antes del render con mensaje sobre la ruta exacta

### RF-6: Vaciado de `data` al fallar
19. Cuando una query transita a `status: error` por cualquier motivo, `data` se fija a `null`
20. Esta regla aplica con independencia de si existía `data` previo del ciclo anterior

## Requisitos no funcionales
- `errorCondition` no introduce latencia adicional significativa (evaluación sobre el body ya parseado en memoria)
- El contrato del objeto `error` (`{ message: string, code?: string }`) no cambia; solo se extiende su navegabilidad como referencia
- La validación de config rechaza rutas inválidas bajo `error.*` antes del render, con mensaje de error que incluye la ruta exacta afectada

## Criterios de aceptación

1. Una operación con `errorCondition: { path: "code", notEquals: 200 }`, `errorMessagePath: "message"`, `errorCodePath: "code"` que recibe `{ code: 500, message: "Error interno" }` como body 200 → `status: error`, `error.message: "Error interno"`, `error.code: "500"`, `data: null`
2. Una operación con `errorCondition: { path: "success", equals: false }`, `errorMessagePath: "error.message"`, `errorCodePath: "error.code"` que recibe `{ success: false, error: { message: "No autorizado", code: "UNAUTHORIZED" } }` → `status: error`, `error.message: "No autorizado"`, `error.code: "UNAUTHORIZED"`, `data: null`
3. Una operación sin `errorCondition` que recibe 200 con JSON válido sigue transitando a `status: success` sin cambios
4. Una operación con `errorCondition` declarado que recibe una respuesta 4xx sigue usando el camino `http-error` existente; `errorCondition` no se evalúa
5. `{{queries.myQuery.error.message}}` en `heading.props.text` muestra el mensaje cuando la query está en error, y string vacío cuando no hay error
6. `{{queries.myQuery.error.code}}` funciona análogamente para el código
7. `visibility` con `reference: "queries.myQuery.error.code"`, `operator: equals`, `value: "UNAUTHORIZED"` muestra u oculta el nodo según el código de error activo
8. Una query en `success` con datos reales que se re-ejecuta y falla → `data: null`, `status: error`
9. `queryStateFeedback.error` se activa cuando la `errorCondition` convierte un 200 en error
10. Una config con `queries.myQuery.error.token` en alguna superficie soportada se rechaza antes del render con mensaje claro sobre la ruta

## Casos límite
- `errorCondition.path` segmento ausente en el body → condición no se cumple, la query sigue como éxito
- `errorCondition` con `equals: null` → condición cumplida solo cuando el valor es exactamente `null`
- `errorMessagePath` apunta a un campo que existe pero no es string → se usa el mensaje genérico
- `errorCodePath` apunta a un número como `500` → se coerce a `"500"`
- `error.code` en `visibility` cuando la query está en `idle` → valor ausente; `isFalsy` hace match, `equals` no hace match
- `error.message` en interpolación cuando `error` es `null` → string vacío (sin romper render)
- Primera ejecución de una query que falla (sin `data` previo) → `data: null` (invariante, ya era null)
- Mismo `errorCondition` en dos entradas `api` distintas → independientes

## Áreas de producto afectadas
- Catálogo `api` (config JSON): nueva declaración opcional por endpoint (`errorCondition`, `errorMessagePath`, `errorCodePath`)
- Ejecución de queries: nueva rama de evaluación tras parsear la respuesta 200
- Modelo de estado de queries: cambio en la transición a error (`data` → `null`)
- Sistema de referencias: extensión de las rutas navegables bajo `.error`
- Validación de config: nuevas reglas para los campos nuevos de `api` y para rutas bajo `error.*`

## Documentación probablemente afectada
- `queries/execution.md`: `errorCondition`, `errorMessagePath`, `errorCodePath`, nuevo código tipado `business-error-condition`
- `queries/state-model.md`: comportamiento de `data` en error, nuevas referencias `.error.message` / `.error.code`
- `references/reference-resolution.md`: catálogo extendido con `error.message` y `error.code`
- `config/structure.md` o equivalente: nuevo shape en entradas `api`

## Riesgos o preguntas abiertas
- El vaciado de `data` en error (RF-6/RF-20) es un cambio de comportamiento observable. Configs de desarrollo que dependan del `data` conservado tras un fallo de re-ejecución verán el campo vacío. No hay forma de cuantificar el impacto sin inspeccionar los configs existentes.
