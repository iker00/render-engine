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

## Interpolación parcial en `endpoint`
`endpoint` admite placeholders `{{...}}` con las mismas familias de referencias que las superficies dinámicas: `forms.*`, `queries.*`, `params.*` e `item.*`. La interpolación se evalúa en el momento de construir la petición:
- cada placeholder resuelto a `string`, `number` o `boolean` se sustituye por su valor convertido a texto
- cada placeholder no resuelto, resuelto a objeto/array, `null` o `undefined` causa que la operación falle con `status: error` y `code: request-build-failed`, sin emitir red
- espacios alrededor de la referencia se ignoran (`{{ params.id }}` se trata igual que `{{params.id}}`)
- `item.*` solo está disponible dentro del subárbol de un `repeater`; fuera de ese contexto, la referencia no se resuelve y causa `request-build-failed`
- un `endpoint` sin placeholders se comporta exactamente igual que antes

## Reglas funcionales
- `GET` no admite `body`.
- `POST`, `PUT`, `PATCH` y `DELETE` pueden declarar `body`.
- `query` se mantiene plano; no existe soporte estable para nested params, claves repetidas ni arrays serializados en query string.
- `body` puede contener objetos, arrays, strings, números, booleanos y `null` siempre que el árbol completo siga siendo JSON serializable.
- `body: null` en la raíz es válido para métodos con body y significa petición explícita sin body JSON serializado.
- `headers` se mantiene plano y solo admite valores string finales.
- varias operaciones pueden reutilizar el mismo `endpoint` con distinto nombre o método sin colisionar.
- la interpolación de `endpoint` no aplica a `preloads`.
