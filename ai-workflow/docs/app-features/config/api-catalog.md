> Cuándo leer: modelo declarativo del bloque `api` del JSON (cómo se declara cada operación remota, qué claves admite, reglas funcionales).
> Tamaño: corto.
> Relacionados: [[../queries/execution.md]], [[validation.md]].

# Catálogo `api`

## Shape de cada operación
Cada operación declarada dentro de `api` debe incluir:
- `method`: `GET | POST | PUT | PATCH | DELETE`
- `endpoint`: string no vacío
- `query`: objeto plano opcional con valores finales `string | number | boolean`
- `body`: payload JSON opcional para métodos distintos de `GET`
- `headers`: objeto plano opcional con claves no vacías y valores string

## Reglas funcionales
- `GET` no admite `body`.
- `POST`, `PUT`, `PATCH` y `DELETE` pueden declarar `body`.
- `query` se mantiene plano; no existe soporte estable para nested params, claves repetidas ni arrays serializados en query string.
- `body` puede contener objetos, arrays, strings, números, booleanos y `null` siempre que el árbol completo siga siendo JSON serializable.
- `body: null` en la raíz es válido para métodos con body y significa petición explícita sin body JSON serializado.
- `headers` se mantiene plano y solo admite valores string finales.
- varias operaciones pueden reutilizar el mismo `endpoint` con distinto nombre o método sin colisionar.
