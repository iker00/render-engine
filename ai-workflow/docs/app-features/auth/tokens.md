> Cuándo leer: si la tarea toca configuración de autenticación, inyección de tokens en headers de operaciones, ciclo de vida de refresco de tokens o errores relacionados con autenticación.
> Tamaño: corto.
> Relacionados: [[../config/structure.md]], [[../config/api-catalog.md]], [[../references/reference-resolution.md]], [[../queries/execution.md]].

# Tokens de autenticación

Sistema declarativo para gestionar tokens de autenticación nombrados con refresco automático proactivo.

## Declaración de tokens

El bloque raíz opcional `tokens` define un catálogo de tokens, cada uno con un valor inicial y refresco opcional:

```json
{
  "tokens": {
    "sessionToken": {
      "value": "initial-token-value-here",
      "refresh": {
        "operation": "refreshToken",
        "responsePath": "data.token",
        "intervalSeconds": 300
      }
    },
    "apiKey": {
      "value": "static-api-key"
    }
  }
}
```

- `value`: string no vacío que contiene el valor inicial del token.
- `refresh` (opcional): configura refresco proactivo automático.
  - `operation`: nombre de una operación ya declarada en `api` que será invocada para obtener el nuevo valor.
  - `responsePath`: ruta dot-notation en el body de la respuesta donde encontrar el nuevo valor (p. ej., `data.token`, `result.jwt`).
  - `intervalSeconds`: entero positivo, cada cuántos segundos ejecutar el refresco automático.

## Uso de tokens en headers

Una vez declarados, los tokens se inyectan manualmente en operaciones:

```json
{
  "api": {
    "getUserProfile": {
      "method": "GET",
      "endpoint": "/api/user",
      "headers": {
        "Authorization": "Bearer tokens.sessionToken.value"
      }
    }
  }
}
```

La única forma soportada es `tokens.{tokenId}.value`. Úsala en:
- `api.{op}.headers`
- `button.props.action.headers`
- `form.submitAction.headers`
- `preloads[].headers`
- dentro de `executeOperations[].headers` si la acción lanza múltiples operaciones en paralelo

Superficies **no soportadas** (provocan error de validación):
- `query`, `body`, `params`
- `visibility.reference`
- `defaultValue` de campos de formulario
- orígenes de colección (`repeater.props.items.source`, etc.)
- cualquier superficie visible interpolable (`heading.props.text`, etc.)

## Ciclo de vida de refresco

Cuando un token tiene `refresh` declarado:

1. **Arranque**: al montar el runtime, se programa el primer refresco para dentro de `intervalSeconds`.
2. **Refresco proactivo**: en cada intervalo, el runtime:
   - Invoca automáticamente la operación declarada en `refresh.operation`.
   - Navega el body de respuesta usando `responsePath` dot-notation.
   - Si resuelve a string no vacío, actualiza el token y reprograma el siguiente refresco.
   - Si falla (red, HTTP error, JSON inválido, `responsePath` no resuelve), reintenta una sola vez inmediatamente.
   - Si el segundo intento falla, el token entra en estado de error y todas las operaciones que lo referencien fallan con `code: token-refresh-failed`.

3. **Recuperación desde error**: tras entrar en error, el runtime sigue intentando proactivamente cada `intervalSeconds`; si un intento tiene éxito, el token vuelve a `ready` y las operaciones vuelven a funcionar normalmente.

## Semántica de refresco

- El refresco **no bloquea** las operaciones en curso; mientras un token se está refrescando (`status: refreshing`), las operaciones siguen usando el valor anterior.
- Si una operación de refresco también referencia un token en sus headers, usa el valor actual del otro token en el momento del refresco (puede provocar propagación de errores).
- Múltiples tokens se refrescan **independientemente**; el fallo de uno no afecta al ciclo de los demás.
- Los valores de tokens **no se persisten** entre sesiones; al recargar, todos vuelven a su `value` declarado.

## Errores relacionados con tokens

Cuando algo falla relacionado con tokens:

- **`code: request-build-failed`**: se referencia un token que no existe en la declaración (`tokens.unknownId.value`).
- **`code: token-refresh-failed`**: la operación que contiene un header con `tokens.{id}.value` no se ejecutó porque el token está en estado de error (tras dos intentos de refresco fallidos). El mensaje de error no expone el valor del token.

En ambos casos, `queries.{operationName}.status` transita a `error` sin emitir red. El developer puede reaccionar a este error desde el layout igual que con cualquier otro error de query (usando `queryStateFeedback` o `visibility`).

## Seguridad

- Los valores de tokens se consideran sensibles y **no aparecen en logs ni en diagnósticos**.
- Los valores de tokens no pueden interpolarse en superficies visibles (`heading.props.text`, etc.); cualquier intento se degrada a string vacío.
- La inyección de tokens es siempre **explícita y manual** en los headers; no existe inyección implícita automática.
