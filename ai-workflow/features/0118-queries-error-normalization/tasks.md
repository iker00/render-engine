# Tasks: normalización de errores en `src/queries/` (rechazos de fetch sin capturar)

Contrato de ejecución para esta feature. Alcance deliberadamente mínimo: una función, un test (ver `spec.md`).
Una única tarea, sin dependencias externas ni fases adicionales.

## Siguiente tarea a escoger
`T1` — es la única tarea del plan. Al cerrarla, la feature queda lista para pasar a `documentation`.

---

## T1 — Normalizar el rechazo de `response.text()` en `executeBuiltRuntimeApiRequest`

### Objetivo
En `src/queries/runtime-api-executor.ts`, dentro de `executeBuiltRuntimeApiRequest`, envolver la línea
`const responseText = await response.text()` (línea ~211, inmediatamente después del bloque `if (response.status === 204)`)
en un manejo explícito de fallo, de forma que si `response.text()` rechaza, la función resuelva —en vez de
propagar el rechazo— con:

```ts
{
  status: 'error',
  error: {
    code: 'network-error',
    message: `The api operation "${request.operationName}" failed due to a network error while reading the response body.`,
  },
}
```

Este es el texto exacto del mensaje a usar (mantiene el prefijo `The api operation "${request.operationName}"` ya
usado por el resto de mensajes de esta función, y añade `while reading the response body` para distinguir en texto
esta causa de la del `network-error` ya existente del `fetch()` inicial, tal como pide la spec).

El patrón de implementación a seguir es el mismo `try { ... } catch { return {...} }` ya usado dos veces en esa
misma función (para el `fetch()` inicial y para `JSON.parse`), y estructuralmente el mismo que usa
`runtime-binary-fetch.ts` para `response.blob()` (líneas 81-94 de ese fichero, código `invalid-binary-response`).
Aquí se reutiliza `network-error` en vez de un código nuevo (decisión ya cerrada en `spec.md`, sección "Alcance").

No se captura el objeto de error en el mensaje (siguiendo el estilo ya usado en el resto de esta función para
`network-error`/`http-error`/`invalid-json-response`, que no interpolan el error nativo en el texto); no replicar el
estilo de `runtime-binary-fetch.ts` que sí interpola `err.message` — mantener consistencia dentro del mismo fichero.

### Fuera de alcance
- Cualquier cambio en `src/queries/runtime-binary-fetch.ts`, `runtime-file-base64-encoder.ts`, `runtime-api-retry.ts`.
- Cualquier cambio en la fachada pública (`executeQueryOperation`, `executeInlineQueryOperation`,
  `executeRuntimeUiAction`) o en `src/runtime/`.
- Cualquier cambio en el resto de bloques `error`/`success` ya existentes en `executeBuiltRuntimeApiRequest`
  (204, cuerpo vacío, `invalid-json-response`, `evaluateErrorCondition` y sus códigos derivados).
- Introducir un código de error nuevo en `RuntimeApiError['code']`.
- Tests de integración en los puntos de orquestación downstream (preloads por página, preloads globales, submit de
  formulario, acciones de botón/enlace, refresco de tokens).

### Dependencias
Ninguna. Primera y única tarea del plan.

### Impacto esperado en archivos
- Código: `src/queries/runtime-api-executor.ts` (modificación de `executeBuiltRuntimeApiRequest`; ninguna otra
  función del fichero cambia).
- Tests: `src/tests/runtime/runtime-api-execution.test.ts` (ampliación).
- Documentación a revisar tras el cierre de implementación (no ejecutar aquí, ver "documentación afectada").

### Tests

**Ficheros de test:**
- `src/tests/runtime/runtime-api-execution.test.ts` (ampliación)

**Comportamiento cubierto:**
- Con un `fetch` mock que resuelve con un objeto `Response`-like `{ ok: true, status: 200, text: () =>
  Promise.reject(new Error('stream cut off')) }` (mockeado igual que en el precedente de
  `src/tests/runtime/runtime-image-binary-fetch.test.ts`, caso "returns invalid-binary-response when response.blob()
  rejects": objeto plano castado `as unknown as Response`, sin usar el constructor real `Response`), llamar a
  `executeRuntimeApiOperation` para una operación existente del `runtimeConfig` de fixture del propio fichero (por
  ejemplo `searchUsers`, ya usada en el resto del fichero) y verificar con `.resolves.toEqual(...)` (no
  `.rejects`) que el resultado es exactamente:
  ```ts
  {
    status: 'error',
    error: {
      code: 'network-error',
      message: 'The api operation "searchUsers" failed due to a network error while reading the response body.',
    },
  }
  ```
- El mismo escenario y la misma aserción exacta, invocando `executeInlineRuntimeApiOperation` con
  `operation: runtimeConfig.api.searchUsers` (mismo patrón que el describe existente "Runtime api inline
  builder/executor (T2)", líneas ~2950-3027 del fichero) en vez de `executeRuntimeApiOperation`.
- El mismo escenario y la misma aserción exacta, invocando `executeBuiltRuntimeApiRequest` directamente (importarla
  desde `../../queries/runtime-api-executor` junto a los imports ya existentes de ese fichero) con un `request` ya
  construido vía `buildRuntimeApiRequest({ config: runtimeConfig, operationName: 'searchUsers', state: runtimeState
  })` (extraer `.request` del resultado `status: 'ready'`, mismo patrón que la línea ~2954).
- Verificar (mediante los tres `await`/`.resolves` anteriores, sin necesidad de aserción adicional) que en ningún
  caso la promesa devuelta rechaza: si alguna de las tres llamadas rechazase, el propio `await` haría fallar el
  test — no se requiere un `try/catch` explícito en el test para demostrarlo.
- Regresión: el test ya existente "normalizes fetch failures, http errors and invalid json responses with stable
  error codes" (línea ~1238) sigue pasando sin modificar sus aserciones.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/runtime/runtime-api-execution.test.ts
```

**Restricciones:**
- Añadir los tres nuevos casos como `it(...)` independientes (uno por función pública ejercitada) dentro del
  `describe('Runtime api execution', ...)` ya existente, a continuación del test "normalizes fetch failures..."
  (línea ~1238) — no crear un `describe` nuevo para esto.
- No tocar ni reordenar ningún test ya existente en el fichero.
- No introducir snapshots.
- Reutilizar el `runtimeConfig`/`runtimeState` de fixture ya declarados en la cabecera del fichero; no declarar un
  config o state paralelo para este caso.

### Documentación afectada
- `ai-workflow/docs/app-features/queries/execution.md`, sección "Semántica de errores tipados" (línea 23 actual: "si
  la llamada falla por red, el runtime usa `code: network-error`"): ampliar esa entrada para dejar explícito que
  `network-error` cubre tanto el `fetch()` inicial como un fallo posterior en la lectura del cuerpo de la respuesta.
  Esta actualización no se ejecuta en `tasks.md`; queda registrada aquí para `update-app-documentation`.

### Criterios de finalización
- `executeBuiltRuntimeApiRequest` nunca resuelve con una promesa rechazada cuando `response.text()` rechaza tras un
  `fetch()` con `response.ok`.
- El resultado normalizado en ese caso es exactamente el especificado arriba (código `network-error`, mensaje con
  el sufijo "while reading the response body").
- Ningún otro código, condición de disparo o mensaje de error ya existente en la función cambia.
- Los tres nuevos casos de test (`executeRuntimeApiOperation`, `executeInlineRuntimeApiOperation`,
  `executeBuiltRuntimeApiRequest`) están en verde.
- El resto de la suite de `src/queries/` listada en `spec.md` (criterio de aceptación 4) sigue en verde.
- El umbral global de cobertura del 80 % sobre `src/` se mantiene (`pnpm test` sin bajar el gate).

### Cierre de implementación
Código y tests de esta tarea completos y validados: `executeBuiltRuntimeApiRequest` modificado, los tres nuevos
casos de test en verde, y `pnpm test` (suite completa) en verde sin romper el umbral de cobertura.
