# Spec: Ejecución múltiple y parametrización de requests (0059)

## Objetivo

Permitir que un botón o un submit de formulario disparen N operaciones `api` en paralelo desde una sola acción declarativa, y que el `endpoint` de cualquier operación admita path params dinámicos mediante interpolación `{{...}}` con referencias del runtime.

---

## Alcance

- Nueva forma de acción `executeOperations` (plural) en `button.props.action` y `form.submitAction`, que acepta una lista de operaciones a ejecutar en paralelo.
- Cada entrada de la lista puede llevar overrides opcionales de `query`, `body` y `headers`, con la misma semántica de merge superficial que el `executeOperation` individual existente.
- Interpolación parcial `{{...}}` en `api.endpoint`, con las familias `forms.*`, `queries.*`, `params.*` e `item.*`.
- El `executeOperation` individual existente no cambia.

---

## Fuera de alcance

- Estado colectivo o agregado de N operaciones paralelas: no se introduce un nuevo dominio de estado; cada operación sigue exponiendo su propio estado en `queries.{operationName}`.
- `queryStateFeedback` y `visibility` con referencia a múltiples queries a la vez: siguen apuntando a un único `queryName`.
- Ejecución secuencial o dependiente entre operaciones (multi-paso): cada operación en la lista es independiente y se lanza en paralelo.
- Orquestación automática de refetch posterior al éxito: fuera de alcance en esta feature.
- Interpolación `{{...}}` en superficies distintas de `api.endpoint`; las demás superficies de request (`api.query`, `api.body`, `api.headers` y sus equivalentes de override) ya usan referencias completas y no cambian.
- `preloads` con endpoint dinámico: la interpolación de `endpoint` no aplica a preloads en esta feature.

---

## Requisitos funcionales

### RF-1 — Acción `executeOperations` en botón

`button.props.action` puede declarar:

```json
{
  "type": "executeOperations",
  "operations": [
    { "operationName": "deleteItem", "body": { "id": "item.id" } },
    { "operationName": "reloadList" }
  ]
}
```

- `operations` es un array de uno o más objetos.
- Cada objeto declara `operationName` (obligatorio) y, opcionalmente, `query`, `body` y `headers` como overrides por ejecución.
- Los overrides siguen exactamente la misma semántica de merge que `executeOperation` individual.
- Las N operaciones se lanzan en paralelo; no existe orden de ejecución garantizado entre ellas.
- Cada operación actualiza `queries.{operationName}` de forma independiente.

### RF-2 — Acción `executeOperations` en submit de formulario

`form.submitAction` puede declarar la misma estructura que RF-1:

```json
{
  "type": "executeOperations",
  "operations": [
    { "operationName": "saveProfile", "body": { "name": "forms.profile.name" } },
    { "operationName": "logActivity" }
  ]
}
```

- La misma semántica de overrides por ejecución que en botón.
- Los overrides en `body`, `query` y `headers` resuelven referencias `forms.*` e `item.*` (dentro de `repeater`) igual que `form.submitAction` individual.
- `resetOnSuccess`: si el formulario declara `resetOnSuccess: true`, el reset solo se produce cuando **todas** las operaciones de la lista terminan con éxito. Si alguna falla, el formulario conserva sus valores actuales.

### RF-3 — Interpolación `{{...}}` en `api.endpoint`

`api.endpoint` admite placeholders `{{referencia}}` con las familias `forms.*`, `queries.*`, `params.*` e `item.*`:

```json
{
  "api": {
    "getItem": {
      "method": "GET",
      "endpoint": "/api/items/{{params.itemId}}/detail"
    },
    "updateItem": {
      "method": "PUT",
      "endpoint": "/api/items/{{forms.itemForm.id}}"
    }
  }
}
```

- La semántica de resolución de placeholders sigue la misma lógica que `dynamic-strings`: cada placeholder no resoluble produce string vacío en ese segmento.
- Si la URL efectiva resultante contiene segmentos vacíos por placeholders no resolubles, el runtime trata el request como fallido con `code: request-build-failed` y no emite red.
- `item.*` aplica solo dentro del contexto de un `repeater`, igual que en las demás superficies de request.
- La interpolación se evalúa en el momento de ejecución de la operación, no en bootstrap.
- Un `endpoint` sin placeholders sigue siendo válido y se comporta exactamente igual que antes.

### RF-4 — Errores tipados para `executeOperations`

- Si alguna entrada de `operations` referencia un `operationName` inexistente, esa operación individual queda en `status: error` con `code: operation-not-found`; el resto de operaciones de la lista se lanzan igualmente.
- Si alguna entrada no puede construir el request (referencia no resuelta, URL degrada a vacío por placeholder), esa operación individual queda en `status: error` con `code: request-build-failed`; el resto se lanzan igualmente.
- Los errores de red o HTTP afectan a cada operación de forma independiente.

---

## Requisitos no funcionales

- El mecanismo de ejecución paralela no introduce un nuevo tipo de estado global; usa la infraestructura existente de `executeQueryOperation` por operación.
- La validación previa al render (`src/config/`) debe rechazar `executeOperations` con `operations` ausente o vacío, y cada entrada sin `operationName`.
- La interpolación de `endpoint` se evalúa en `src/queries/`, no en nodos visuales.
- El comportamiento del `executeOperation` singular existente no se altera.

---

## Criterios de aceptación

1. Un botón con `type: executeOperations` y dos entradas lanza ambas operaciones en paralelo; `queries.op1` y `queries.op2` se actualizan de forma independiente.
2. Un botón con `executeOperations` donde una operación lleva override de `body` y otra no: la primera usa el merge con la operación base, la segunda usa solo la operación base.
3. Un formulario con `submitAction.type: executeOperations` y `resetOnSuccess: true` solo resetea cuando todas las operaciones de la lista terminan con `success`; si alguna falla, el formulario mantiene sus valores.
4. Si una operación de la lista tiene `operationName` inexistente, esa query queda en `error: operation-not-found`; la otra operación de la lista se ejecuta normalmente.
5. Un `api.endpoint` con `{{params.itemId}}` se resuelve correctamente en el momento de ejecución; con el param disponible la request se emite; sin el param la operación queda en `error: request-build-failed` sin emitir red.
6. Un `api.endpoint` sin placeholders se comporta exactamente igual que antes de la feature.
7. `executeOperations` con `operations: []` o sin `operations` es rechazado en validación previa con diagnóstico de ruta.
8. `executeOperation` singular (existente) no presenta regresiones.

---

## Casos límite

- `executeOperations` con una sola operación: válido y equivalente funcional a `executeOperation` singular, aunque no es la forma canónica recomendada.
- Dos entradas de `executeOperations` con el mismo `operationName`: ambas intentan escribir en `queries.{operationName}`; la escritura final depende del orden de resolución de las promesas. No se garantiza determinismo; se considera uso indebido por parte del configurador pero no se rechaza en validación.
- `endpoint` con placeholder que resuelve a un número o booleano: se convierte a string visible (igual que dynamic strings).
- `endpoint` con placeholder que resuelve a objeto o array: produce string vacío en ese segmento → `request-build-failed`.
- `item.*` en `endpoint` fuera de `repeater`: referencia no disponible → segmento vacío → `request-build-failed`.
- `resetOnSuccess` con `executeOperations` de una sola operación: semánticamente equivalente a `executeOperation` con `resetOnSuccess`.

---

## Áreas de producto afectadas (alto nivel)

- Catálogo `api`: `endpoint` pasa de string fijo a string interpolable.
- Acciones de botón: nueva variante `executeOperations`.
- Submit de formulario: nueva variante `executeOperations` con política de reset colectivo.
- Validación previa al render: nuevas reglas para `executeOperations` y placeholders en `endpoint`.
- Capa `src/queries/`: evaluación de placeholders en `endpoint` antes de emitir red.

## Documentación probablemente afectada (alto nivel)

- `app-features/config/api-catalog.md`: nueva semántica de `endpoint`.
- `app-features/queries/execution.md`: nueva acción `executeOperations`.
- `app-features/forms/submit.md`: `submitAction.type: executeOperations` y política de `resetOnSuccess` colectivo.
- `app-features/references/dynamic-strings.md`: nueva superficie de interpolación (`api.endpoint`).

---

## Riesgos o preguntas abiertas

Ninguno. Todas las decisiones de alcance y comportamiento están cerradas.
