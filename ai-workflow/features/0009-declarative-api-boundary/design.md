# Design: Declarative API boundary

## Objetivo del diseño
Traducir la spec de `api` a una partición técnica cerrada y reutilizable para que el runtime pueda validar un catálogo declarativo de operaciones remotas, ejecutar una operación por nombre y reflejar su resultado en `queries` sin mezclar HTTP dentro de la UI ni anticipar todavía `preloads` o acciones visuales finales.

## Estado de partida
Hoy el runtime ya tiene:
- validación estructural de `api` solo como objeto genérico sin semántica operativa
- store compartido por instancia con dominio `queries` y estados `idle | loading | success | error`
- resolución central de referencias string desde `forms.*` y `queries.*`
- ausencia total de ejecución real de red y de una capa `queries/` dedicada

Eso deja cuatro riesgos si la feature se implementa sin diseño previo:
- dispersar `fetch` o la construcción de requests en componentes o hooks visuales
- validar `api` de forma demasiado débil y desplazar errores de contrato al tiempo de ejecución
- mezclar la identidad de una operación remota con detalles concretos de query string y body en varias capas distintas
- abrir una solución específica para `queries` que luego no pueda reutilizarse desde `preloads` o acciones mutadoras

## Decisiones de diseño

### 1. `api` pasa a ser un catálogo tipado y validado en bootstrap
La raíz `api` dejará de ser `Record<string, unknown>` y pasará a describir operaciones nombradas con este shape funcional:
- `method`: `GET | POST | PUT | PATCH | DELETE`
- `endpoint`: string no vacío
- `query`: objeto opcional de parámetros planos
- `body`: payload JSON opcional

Reglas de contrato:
- `GET` no admite `body`
- `POST`, `PUT`, `PATCH` y `DELETE` pueden declarar `body`
- `query` es siempre un objeto plano `Record<string, scalar-or-reference>`
- `body` puede ser un árbol JSON compuesto por objetos, arrays y escalares
- `body: null` en la raíz significa “enviar body vacío de forma explícita”, no “usar `null` como dato de negocio”

Razonamiento:
- la spec exige distinguir con claridad query string y body
- mantener `query` plano evita abrir una codificación ambigua de nested params en v1
- reservar la semántica especial de `body: null` permite expresar body vacío sin inventar `{}` u otro payload artificial

### 2. Los valores declarativos reutilizan la convención actual de referencias completas
Los strings dentro de `query` y dentro de cualquier hoja string de `body` seguirán la misma convención ya establecida en `runtime-references/`:
- si el string completo coincide con una referencia soportada, se resuelve dinámicamente
- si coincide con un namespace reconocido pero inválido, se trata como error de invocación
- si usa `\` como escape, se conserva como literal visible/del payload
- si no coincide con un namespace reconocido, se conserva como literal

Reglas adicionales por canal:
- en `query`, un valor resuelto solo puede terminar siendo `string`, `number`, `boolean` o `null`
- en `body`, un valor resuelto puede ser cualquier valor JSON serializable compatible con objetos, arrays, escalares o `null`
- una referencia soportada pero sin valor disponible en el momento de invocación produce error de construcción del request, no error de validación de bootstrap

Razonamiento:
- la spec ya asume referencias simples aptas para un backend legacy
- reutilizar el parser y el resolver existentes evita abrir un segundo mini lenguaje para payloads
- separar error de contrato y dato ausente en invocación mantiene coherencia con la distinción `invalid` vs `missing` ya fijada en `0007` y `0008`

### 3. La ejecución remota vive en `src/queries/`, no en `runtime-state/` ni en nodos visuales
La feature abrirá un módulo nuevo:

```txt
src/
  queries/
    runtime-api-types.ts
    runtime-api-request.ts
    runtime-api-executor.ts
```

Responsabilidades:
- `runtime-api-types.ts`: tipos internos de operación, request resuelto y errores normalizados
- `runtime-api-request.ts`: resolver valores declarativos, construir URL final, query string, body y `RequestInit`
- `runtime-api-executor.ts`: ejecutar la operación contra `fetch`, normalizar errores de red/HTTP y devolver un resultado consumible por el runtime

Razonamiento:
- `architecture.md` ya reserva `queries/` como capa futura de ejecución real
- `runtime-state/` debe seguir centrado en almacenamiento y transiciones, no en red
- esta partición deja el ejecutor reutilizable desde `preloads`, refetch y acciones mutadoras futuras sin rehacer la frontera

### 3.1. La serialización del request queda fijada en v1 para evitar divergencias
Reglas de serialización:
- `endpoint` se entrega a `fetch` tal como viene declarado; puede ser absoluto o relativo y no se reescribe dentro del runtime
- `query` solo admite valores finales `string`, `number` o `boolean`; `null`, objetos, arrays y `undefined` no forman parte del contrato soportado
- cada valor de `query` se serializa como string simple con `String(value)` y una clave produce como máximo un valor
- `body` se serializa con `JSON.stringify` cuando existe un payload JSON real
- `body: null` en la raíz mantiene la semántica ya fijada de “request deliberadamente sin body serializado”

Razonamiento:
- la spec exige una frontera simple y generable desde backend legacy
- limitar `query` a escalares no nulos evita abrir semánticas ambiguas sobre omisión, claves repetidas o nested params
- fijar que `endpoint` no se reescribe evita implementaciones divergentes entre `new URL(..., window.location.origin)` y `fetch(endpoint)` directo

### 4. La primera fachada pública hidrata `queries` usando el mismo nombre de operación
En esta feature la integración visible se cerrará con una fachada mínima en `useRuntimeStateActions()`:
- `executeQueryOperation(operationName: string): Promise<...>`

Semántica:
- busca `config.api[operationName]`
- si no existe, registra un error estable en `queries[operationName]` sin emitir red
- si existe, pasa la query a `loading` conservando `data` previo
- ejecuta la operación remota
- en éxito guarda el resultado en `queries[operationName]`
- en fallo guarda un `RuntimeQueryError` estable en `queries[operationName]`

La misma operación nombrada en `api` y en `queries` queda alineada así:
- `api.searchUsers` describe cómo llamar al backend
- `queries.searchUsers.*` expone el resultado compartido a la UI

Razonamiento:
- la spec y la documentación actual ya usan ese vocabulario de ejemplo
- evita introducir un mapeo adicional `operationName -> queryName` antes de que exista un caso real que lo necesite
- mantiene libre el ejecutor de bajo nivel para que futuras acciones mutadoras puedan reutilizarlo sin quedar acopladas a `queries`

### 5. El store compartido no cambia de shape, pero sí fija nuevas transiciones de error e invocación
La feature no añadirá un dominio nuevo de estado. Reutilizará:
- `queries/{queryName}.status`
- `queries/{queryName}.data`
- `queries/{queryName}.error`

Decisiones:
- el reducer sigue siendo la única fuente de verdad para `loading | success | error`
- el ejecutor no escribe estado directamente; devuelve resultado normalizado y la fachada del provider despacha acciones existentes
- los errores de operación inexistente, payload no resoluble, fallo de red, respuesta HTTP no OK y JSON inválido se traducen a `RuntimeQueryError` con `message` y `code` estables orientados a UI
- el conjunto mínimo de `code` soportado en v1 queda fijado como:
  - `operation-not-found`
  - `request-build-failed`
  - `network-error`
  - `http-error`
  - `invalid-json-response`
- una recarga tras éxito sigue preservando el último `data` válido durante `loading`

Razonamiento:
- el dominio `queries` ya existe y la spec pide alinearse con él
- mantener las acciones actuales reduce el radio del cambio
- la normalización de errores debe ocurrir fuera de la UI y antes de tocar el store

### 5.1. Las respuestas exitosas vacías no se tratan como JSON inválido
Decisión:
- si la respuesta es satisfactoria y no trae body consumible como JSON, el resultado normalizado será `success` con `data: null`
- esta regla cubre al menos respuestas `204 No Content` y respuestas con body vacío

Razonamiento:
- la spec permite que la respuesta remota sea vacía
- sin esta decisión, un `DELETE` exitoso podría implementarse de forma inconsistente como error JSON o como éxito sin dato

### 6. La validación se reparte entre bootstrap e invocación
Bootstrap valida:
- shape de `api`
- métodos soportados
- compatibilidad método/body
- endpoint no vacío
- shape permitido de `query`
- shape JSON permitido de `body`

Invocación valida:
- existencia de la operación pedida
- resolubilidad de referencias dinámicas usadas en `query` o `body`
- compatibilidad del valor resuelto con el canal de salida (`query` escalar, `body` JSON serializable)

Razonamiento:
- la spec exige rechazar configs inválidos antes de usarlos
- no todos los errores son detectables en bootstrap porque algunos dependen del estado runtime del momento
- esta división evita convertir el arranque en una validación semántica imposible de completar sin estado

## Estructura objetivo

```txt
src/
  config/
    runtime-config-types.ts
    runtime-config.ts
    validate-runtime-config.ts
  queries/
    runtime-api-types.ts
    runtime-api-request.ts
    runtime-api-executor.ts
  runtime/
    runtime-references/
      runtime-reference-parser.ts
      runtime-reference-resolver.ts
    runtime-state/
      runtime-state-provider.tsx
      runtime-state-types.ts
  tests/
    runtime-config-validation.test.ts
    runtime-api-execution.test.ts
    runtime-state.test.tsx
```

Notas:
- `runtime-reference-resolver.ts` debería reutilizarse tal cual o con ajustes mínimos de export/superficie, sin duplicar parsing en `queries/`
- no hace falta abrir todavía `preloads`, nodos de formulario ni cambios en `layout-renderer`
- `read-runtime-config.ts` solo debería cambiar si los tests del borde de bootstrap necesitan reflejar el nuevo contrato tipado

## Estrategia de implementación
El orden recomendado es:

1. Endurecer tipos y validación de `config.api`, fijando desde tests qué operaciones son válidas e inválidas.
2. Implementar el builder y el ejecutor de operaciones remotas en `src/queries/`, con tests de construcción de URL, body y errores normalizados.
3. Exponer la fachada `executeQueryOperation()` en el provider del runtime y fijar sus transiciones de estado con tests.
4. Ejecutar la regresión final de validación, ejecución y store, cerrando con `pnpm test`.

## Riesgos y mitigaciones
- Riesgo: aceptar `query` con shapes demasiado abiertos y acabar con codificación inconsistente de parámetros.
  Mitigación: limitar `query` a objeto plano de escalares o referencias completas.

- Riesgo: tratar strings de payload con semánticas distintas a las referencias textuales ya existentes.
  Mitigación: reutilizar exactamente el parser y el escape literal ya soportados.

- Riesgo: acoplar la capa de red al provider o a componentes React.
  Mitigación: introducir `src/queries/` como frontera explícita y mantener el provider como simple consumidor del ejecutor.

- Riesgo: mezclar “config inválido” y “dato faltante en invocación” en el mismo tipo de error.
  Mitigación: validar shape en bootstrap y reservar los fallos de resolución dinámica para errores de invocación normalizados.

- Riesgo: dejar indefinido cómo se expresa un body explícitamente vacío.
  Mitigación: fijar en el contrato que `body: null` en la raíz equivale a body vacío deliberado.

## Impacto documental posterior
Cuando la implementación termine, la pasada documental debería revisar:
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/features/index.md`
