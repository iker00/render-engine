> Cuándo leer: modelo declarativo del bloque `api` del JSON (cómo se declara cada operación remota, qué claves admite, reglas funcionales).
> Tamaño: corto.
> Relacionados: [[../queries/execution.md]], [[validation.md]].

# Catálogo `api`

## Shape de cada operación
Cada operación declarada dentro de `api` debe incluir:
- `method`: `GET | POST | PUT | PATCH | DELETE`
- `endpoint`: string no vacío, puede contener placeholders `{{...}}` resolubles en tiempo de ejecución
- `query`: objeto plano opcional con valores finales `string | number | boolean`
- `body`: payload JSON opcional para métodos distintos de `GET`
- `headers`: objeto plano opcional con claves no vacías y valores string
- `errorCondition`: objeto opcional con reglas para detectar errores embebidos en respuestas HTTP 200
- `errorMessagePath`: string opcional, ruta dot-notation al campo de mensaje de error en el body
- `errorCodePath`: string opcional, ruta dot-notation al campo de código de error en el body

## Interpolación parcial en `endpoint`
`endpoint` admite placeholders `{{...}}` con las mismas familias de referencias que las superficies dinámicas: `forms.*`, `queries.*`, `params.*` e `item.*`. La interpolación se evalúa en el momento de construir la petición:
- cada placeholder resuelto a `string`, `number` o `boolean` se sustituye por su valor convertido a texto
- cada placeholder no resuelto, resuelto a objeto/array, `null` o `undefined` causa que la operación falle con `status: error` y `code: request-build-failed`, sin emitir red
- espacios alrededor de la referencia se ignoran (`{{ params.id }}` se trata igual que `{{params.id}}`)
- `item.*` solo está disponible dentro del subárbol de un `repeater`; fuera de ese contexto, la referencia no se resuelve y causa `request-build-failed`
- un `endpoint` sin placeholders se comporta exactamente igual que antes

## Detección de errores en respuestas 200 (`errorCondition`)

Cuando una API responde con HTTP 200 pero el body contiene una condición de error de negocio, se puede declarar opcionalmente `errorCondition`:
- `path`: ruta dot-notation obligatoria dentro del body para evaluar la condición
- `equals`: valor literal (`string | number | boolean | null`) opcional; la condición se cumple si el valor en `path` es exactamente igual
- `notEquals`: valor literal opcional; la condición se cumple si el valor en `path` es distinto
- Solo se puede declarar uno entre `equals` o `notEquals`; si se omiten ambos, la condición se evalúa como truthiness del valor

Cuando la condición se cumple:
- `errorMessagePath`: ruta dot-notation al campo de mensaje en el body. Si resuelve a string no vacío, se usa; en otro caso, el mensaje por defecto es `"Error en la respuesta del servidor"`
- `errorCodePath`: ruta dot-notation al campo de código en el body. Si resuelve a string o number, se coerce a string; en otro caso, el código por defecto es `"business-error-condition"`

Ejemplo:
```json
"checkBalance": {
  "method": "GET",
  "endpoint": "/api/balance",
  "errorCondition": { "path": "success", "equals": false },
  "errorMessagePath": "error.message",
  "errorCodePath": "error.code"
}
```

## Reglas funcionales
- `GET` no admite `body`.
- `POST`, `PUT`, `PATCH` y `DELETE` pueden declarar `body`.
- `query` se mantiene plano; no existe soporte estable para nested params, claves repetidas ni arrays serializados en query string.
- `body` puede contener objetos, arrays, strings, números, booleanos y `null` siempre que el árbol completo siga siendo JSON serializable.
- `body: null` en la raíz es válido para métodos con body y significa petición explícita sin body JSON serializado.
- `headers` se mantiene plano y solo admite valores string finales.
- varias operaciones pueden reutilizar el mismo `endpoint` con distinto nombre o método sin colisionar.
- la interpolación de `endpoint` no aplica a `preloads`.
- `errorCondition` solo se evalúa si la respuesta HTTP es 200 con JSON válido; respuestas con otros códigos 4xx/5xx siguen usando el camino `http-error` existente.
