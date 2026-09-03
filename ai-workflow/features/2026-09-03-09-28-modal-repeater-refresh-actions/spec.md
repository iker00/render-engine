# Modal en repeater sobrevive al refresco de acciones encadenadas

## Objetivo
Permitir que un flujo dentro de una fila de `repeater` (p.ej. "asociar una persona" desde un `modal`) pueda refrescar datos relacionados y seguir interactuando con la misma modal abierta, en vez de forzar a elegir entre "modal abierta" y "datos actualizados".

## Alcance
Tres capacidades relacionadas, necesarias en conjunto para destrabar el flujo real reportado:

1. Secuenciación por finalización en listas `onSuccess`/`onError`.
2. `openModal`/`closeModal` hacia un modal de página, disparado desde un `form` dentro de `repeater.props.template`.
3. El `repeater` no descarta el estado de apertura de modal de filas no afectadas por el refresco de su colección.

## Fuera de alcance
- Estado local general dentro de `repeater.props.template` distinto de `modal` (tab seleccionado, accordion abierto, valores sin guardar de un `form`) — mismo problema de fondo potencial, explícitamente fuera de esta feature.
- `openModal`/`closeModal` apuntando a un modal que vive dentro de OTRO `repeater` distinto del que contiene al emisor (cross-repeater). No soportado; ver Riesgos.
- Cualquier semántica nueva de cortocircuito entre acciones de una misma lista `onSuccess`/`onError`: qué acciones se ejecutan (todas las que cumplen `when`) no cambia, solo cambia cuándo se ejecuta cada una respecto a la anterior.
- Flag de opt-in para la secuenciación: pasa a ser el único comportamiento soportado.

## Requisitos funcionales

### 1. Secuenciación por finalización en onSuccess/onError
- En una lista `onSuccess`/`onError` (de `button.props.action` o `form.submitAction`) con varias acciones en orden declarado, cada acción de tipo `executeOperation`, `executeOperations` o `downloadOperation` debe completarse (su/s query/s asociada/s llegan a `success`/`error`) antes de que se evalúe y, si aplica, se ejecute la siguiente acción de la misma lista.
- Las acciones síncronas de la lista (`navigateTo`, `goBack`, `resetForm`, `openModal`, `closeModal`) no introducen espera propia; se ejecutan en su turno, tras completarse la acción asíncrona anterior.
- El resultado (éxito o error) de una acción asíncrona intermedia NO condiciona si las siguientes acciones de la lista se ejecutan: se mantiene la semántica actual de "todas las entradas cuyo `when` se cumple se ejecutan", solo cambia el orden temporal.
- Las referencias `queries.{operationName}.*` usadas por el `when` de una acción de la lista ya reflejan el resultado de cualquier acción asíncrona anterior de la misma lista que haya terminado.
- Este comportamiento sustituye al disparo no bloqueante actual sin flag de activación; es el único soportado.

### 2. openModal/closeModal desde un form en repeater.template hacia un modal de página
- Un `form` (o cualquier nodo con `iterationContext`) dentro de `repeater.props.template` que ejecuta `openModal`/`closeModal` sobre un `modal.id` declarado FUERA de cualquier `repeater` (a nivel de página) debe abrir/cerrar ese modal correctamente, con independencia de la fila desde la que se disparó la acción.
- Un `form`/nodo dentro de `repeater.props.template` que ejecuta `openModal`/`closeModal` sobre un `modal.id` declarado dentro del MISMO `repeater.props.template` sigue afectando solo a la instancia de esa fila (sin cambios).

### 3. El repeater conserva el estado de modales de filas no afectadas por el refresco
- Al refrescar la colección que alimenta a un `repeater` (por cualquier vía: `executeOperation`, `executeOperations`, encadenada o no en `onSuccess`), una modal abierta en una fila cuya key de iteración sigue presente en la colección resuelta tras el refresco debe permanecer abierta, sin remontarse ni perder su estado de apertura, aunque otras filas cambien de posición, se añadan o se eliminen.
- El contenido interpolado (`item.*`, `queries.*`) dentro de esa modal debe reflejar los datos actualizados de su fila tras el refresco, sin cerrarla y reabrirla.
- Si la fila cuya modal está abierta deja de existir en la colección resuelta tras el refresco, la modal se cierra automáticamente (comportamiento ya vigente, sin cambios).

## Requisitos no funcionales
- Sin cambios en el contrato JSON de `button.props.action`, `form.submitAction`, `modal` ni `repeater`: es un cambio de comportamiento de ejecución, no de shape de configuración.
- Sin degradación de cobertura por debajo del umbral global del 80% sobre `src/`.
- Sin flags de compatibilidad hacia atrás para el disparo no bloqueante retirado.

## Criterios de aceptación
1. Un `submitAction`/`button.props.action` con `onSuccess: [executeOperation, openModal]` abre el modal únicamente después de que la operación de `executeOperation` llegue a `success`/`error`, nunca antes.
2. Con el escenario anterior dentro de una fila de `repeater` con key estable, tras el refresco la modal referenciada por `openModal` queda visualmente abierta y su contenido interpolado refleja los datos nuevos de esa fila.
3. Un `form` dentro de `repeater.props.template` cuyo `onSuccess` incluye `openModal` hacia un `modal.id` de página lo abre correctamente.
4. Al refrescar la colección de un `repeater` con una modal abierta en la fila N: si otra fila M ≠ N se añade, se elimina o cambia de posición, la modal de la fila N permanece abierta sin remontarse.
5. Al refrescar la colección de un `repeater` con una modal abierta en la fila N: si la fila N deja de existir en la colección resuelta, la modal se cierra automáticamente.
6. Una lista `onSuccess`/`onError` con varias acciones `executeOperation` encadenadas ejecuta cada una después de que la anterior haya terminado, en el orden declarado.
7. Un `openModal`/`closeModal` disparado desde un `form` dentro de `repeater.props.template` hacia un `modal.id` de OTRO `repeater` no produce un comportamiento incorrecto silencioso (ver Riesgos): puede rechazarse en validación o degradar sin efecto, pero no debe abrir una fila equivocada.

## Casos límite
- Lista `onSuccess` con una acción `executeOperations` (plural) intermedia: la siguiente acción de la lista espera a que TODAS las operaciones de esa entrada terminen (éxito o error), no solo la primera.
- Lista `onSuccess` con una acción `downloadOperation` intermedia: la siguiente acción espera a que termine la operación que dispara la descarga (éxito o error), no a que el navegador complete la descarga del `Blob`.
- Refresco disparado por `executeOperations` (paralelo) que alimenta al mismo `repeater`: la fila con modal abierta se comporta igual que con `executeOperation` singular respecto al requisito 3.
- `repeater` con `props.pagination` activo: si la fila con la modal abierta permanece en la misma página tras el refresco, la modal sigue abierta; si el refresco hace que esa fila caiga fuera de la página actualmente visible, el comportamiento observable es el mismo que hoy tiene cualquier fila que sale de la página visible (deja de renderizarse) — no se introduce lógica nueva para "seguir" la fila a su nueva página.
- Modo grid del repeater (`props.columns`): la preservación de modal aplica igual, sin relación con el wrapper de grid.
- Dos modales abiertas simultáneamente sigue sin ser un caso válido (regla global ya vigente: abrir una cierra la otra); no cambia con esta feature.

## Áreas de producto y documentación afectadas
- [`nodes/modal.md`](../../docs/app-features/nodes/modal.md) — comportamiento en `repeater.props.template`.
- [`nodes/repeater.md`](../../docs/app-features/nodes/repeater.md) — remount y preservación de estado por fila.
- [`nodes/button.md`](../../docs/app-features/nodes/button.md) y [`forms/submit.md`](../../docs/app-features/forms/submit.md) — semántica de `onSuccess`/`onError`.
- [`queries/execution.md`](../../docs/app-features/queries/execution.md) — refetch declarativo tras éxito/error.

## Riesgos o preguntas abiertas
- Cambiar la secuenciación de `onSuccess`/`onError` a esperar cada acción asíncrona antes de la siguiente es un cambio de comportamiento por defecto que afecta a TODAS las configs existentes que ya declaran varias acciones en una misma lista con al menos una asíncrona antes de otra. Se asume el riesgo porque el timing anterior no era observable desde la config declarativa (decisión confirmada con el usuario). Validar en el cierre de implementación si hay configs reales que dependan de un timing distinto.
- `openModal`/`closeModal` hacia un modal dentro de otro `repeater` (cross-repeater) queda fuera de alcance; la estrategia exacta para evitar un comportamiento incorrecto silencioso (rechazo en validación vs. degradación sin efecto) se decide en `design.md`.
- La estrategia técnica para evitar el remount completo de `RepeaterNodeContent` (hoy forzado por una key que también gestiona el reseteo intencional de la página activa ante cambios de colección) requiere decidir cómo separar "resetear paginación" de "remontar todo el subárbol", sin romper el comportamiento ya documentado en `repeater.md` sobre reseteo de página activa. Se deja para `generate-feature-design`.
