# Spec: 0078 — Auth tokens

## Objetivo

Permitir declarar en la configuración JSON tokens de autenticación nombrados, referenciables manualmente en las
cabeceras de operaciones `api` y de acciones, con soporte opcional de refresco automático proactivo por intervalo de
tiempo.

## Alcance

- Nuevo bloque raíz opcional `tokens` en el JSON de configuración, al mismo nivel que `api` y `pages`.
- Cada token tiene un identificador libre (clave del mapa), un valor inicial `value` y una configuración opcional de
  refresco `refresh`.
- El bloque `refresh` permite configurar refresco proactivo: qué operación `api` ejecutar, dónde encontrar el nuevo
  valor en la respuesta (`responsePath` en dot-notation), y cada cuántos segundos ejecutar el refresco (
  `intervalSeconds`).
- El runtime ejecuta el refresco de forma automática y proactiva cada `intervalSeconds`, comenzando a partir del primer
  intervalo (no al montar).
- Si el refresco falla, el runtime reintenta exactamente una vez. Si el segundo intento también falla, el token pasa a
  estado de error y los endpoints que lo usan fallan con código `token-refresh-failed`.
- Los tokens se referencian manualmente con `tokens.{tokenId}.value` en los valores de `headers` de operaciones `api`,
  en los overrides de `headers` de acciones de botón (`button.props.action`) y formulario (`form.submitAction`), y en
  los `headers` de `preloads`.
- Cuando existen múltiples tokens, cada uno gestiona su propio ciclo de refresco de forma independiente.

## Fuera de alcance

- Bloqueo o redirección de la aplicación para pedir re-autenticación al fallar el refresco.
- Inyección automática e implícita de tokens en las operaciones (la inyección es siempre explícita y manual mediante
  referencia).
- Uso de `tokens.*` en interpolación de texto visible `{{...}}` (seguridad: los tokens no deben aparecer en strings
  visibles).
- Uso de `tokens.*` en `visibility.reference` o `queryStateFeedback`.
- Refresco reactivo ante respuestas HTTP 401 o 403.
- Soporte de `tokens.*` en `api.query` o `api.body`.
- Detección de dependencias circulares entre tokens y sus operaciones de refresco.

## Requisitos funcionales

### Bloque `tokens` en la configuración

- `tokens` es opcional en la raíz del JSON. Si no se declara, el runtime funciona exactamente igual que antes.
- Es un objeto mapa donde cada clave es el identificador del token y el valor es su configuración.
- Una misma configuración puede declarar uno o más tokens; no hay límite explícito, aunque el caso habitual es uno o
  ninguno.

### Configuración por token

- `value` (requerido): string no vacío que contiene el valor inicial del token.
- `refresh` (opcional): objeto que declara el refresco automático con los campos:
    - `operation` (requerido si `refresh` está presente): nombre de una operación ya declarada en `api`. El runtime usa
      esa operación para obtener el nuevo valor del token.
    - `responsePath` (requerido si `refresh` está presente): ruta dot-notation que indica dónde encontrar el nuevo valor
      del token en el body de respuesta de la operación de refresco. Si la ruta no resuelve a un string no vacío, el
      refresco se trata como fallido.
    - `intervalSeconds` (requerido si `refresh` está presente): entero positivo que indica cada cuántos segundos
      ejecutar el refresco proactivo.

### Refresco proactivo

- El runtime programa el refresco del token automáticamente al arrancar.
- El primer refresco ocurre transcurridos `intervalSeconds` desde el arranque; no se ejecuta en el momento de montar.
- Tras cada refresco exitoso, el intervalo se reinicia desde ese punto.
- Si una operación de refresco tiene éxito, el runtime extrae el nuevo valor desde `responsePath` en la respuesta y
  actualiza el valor activo del token. Las siguientes peticiones que referencien ese token usarán el nuevo valor.
- Si la operación de refresco falla (error de red, error HTTP, `responsePath` no resuelve a string no vacío, error de
  negocio según `errorCondition`), el runtime reintenta una vez. Si el segundo intento también falla, el token pasa a
  estado de error.

### Estado de error del token

- Cuando un token entra en estado de error, todas las operaciones `api` cuyo header referencie `tokens.{tokenId}.value`
  fallan antes de emitir red, con `status: error` y `code: token-refresh-failed`.
- El developer puede reaccionar a ese estado de error desde el layout igual que con cualquier otro error de query.
- Un token en estado de error no bloquea tokens distintos ni operaciones que no referencien ese token.

### Referencias `tokens.*`

- La referencia `tokens.{tokenId}.value` es la única sub-ruta soportada de la familia `tokens.*`.
- Está disponible como valor de cabecera en:
    - `api.headers` (por operación, en la declaración estática de la operación)
    - `button.props.action.headers` (override por ejecución)
    - `form.submitAction.headers` (override por ejecución)
    - `preloads[].headers` (por precarga)
- Si un token referenciado no existe, la operación falla con `request-build-failed`.

### Validación previa al render

El runtime valida el bloque `tokens` antes de renderizar, con las mismas garantías que el resto de bloques raíz:

- Cada entrada del mapa debe tener `value` no vacío.
- Si `refresh` está declarado, `operation`, `responsePath` e `intervalSeconds` son todos requeridos.
- `refresh.operation` debe referenciar una operación existente en `api`.
- `refresh.intervalSeconds` debe ser un entero positivo.
- Claves extra en el bloque de un token se descartan sin convertir la configuración en inválida.

## Requisitos no funcionales

- El estado activo de cada token vive dentro del estado compartido del runtime, no en el componente que lo consume.
- Los timers de refresco se gestionan de forma centralizada y se limpian al desmontar el runtime.
- El valor del token no debe exponerse en logs ni en superficies visibles del UI.
- La adición del bloque `tokens` no afecta el rendimiento ni el comportamiento de configuraciones que no lo declaren.

## Criterios de aceptación

1. Un `tokens` con solo `value` y sin `refresh` resuelve `tokens.{id}.value` al valor inicial durante toda la sesión.
2. Un `tokens` con `refresh` ejecuta la operación indicada cada `intervalSeconds`; tras un refresco exitoso, las
   peticiones siguientes que usen ese token llevan el nuevo valor en el header.
3. Si el primer intento de refresco falla y el segundo tiene éxito, el token se actualiza con el valor del segundo
   intento.
4. Si el primer y el segundo intento de refresco fallan, las operaciones que referencien ese token pasan a
   `status: error, code: token-refresh-failed` sin emitir red.
5. `tokens.{tokenId}.value` puede declararse como valor de un header en `api.headers` y es resuelto en tiempo de
   ejecución de la petición.
6. `tokens.{tokenId}.value` puede declararse en los overrides de headers de `button.props.action` y `form.submitAction`,
   con el mismo comportamiento.
7. `tokens.{tokenId}.value` puede declararse en los headers de `preloads`.
8. Una referencia a un `tokenId` inexistente provoca `request-build-failed` en la operación que lo usa.
9. Si `responsePath` no resuelve a un string no vacío en la respuesta, el refresco se trata como fallido.
10. Un JSON sin bloque `tokens` funciona exactamente igual que antes de esta feature.
11. La validación rechaza `tokens` con `value` vacío.
12. La validación rechaza `tokens` con `refresh.operation` que no existe en `api`.
13. La validación rechaza `tokens` con `refresh` declarado pero sin `responsePath` o sin `intervalSeconds`.
14. La validación rechaza `refresh.intervalSeconds` no positivo.
15. Múltiples tokens se refrescan de forma independiente; el fallo de uno no afecta al estado de los demás.

## Casos límite

- Token con `refresh` cuya operación de refresco también usa un header de token: el runtime resuelve el valor actual del
  token en el momento de ejecutar el refresco; no se detecta circularidad en validación.
- `responsePath` que resuelve a un número u otro tipo no string: el refresco se trata como fallido.
- `intervalSeconds` muy pequeño (e.g., 1): el timer es funcional; no existe límite mínimo explícito en v1.
- Si el runtime se desmonta antes de que expire el primer intervalo, el refresco no se ejecuta y el timer se cancela
  limpiamente.
- La operación de refresco devuelve HTTP 200 pero `errorCondition` de esa operación la marca como error de negocio: se
  trata como fallo de refresco.

## Áreas de producto afectadas

- Contrato JSON raíz (`config/`): nuevo bloque `tokens` y su validación.
- Sistema de referencias (`references/`): nueva familia `tokens.*`.
- Ejecución de endpoints (`queries/execution`): inyección del valor resuelto de `tokens.*` en headers antes de construir
  la petición.
- Runtime state: nuevo dominio de estado para valores activos de tokens y sus timers.

## Documentación probablemente afectada

- `config/structure.md`: nuevo bloque raíz `tokens`.
- `config/api-catalog.md`: `api.headers` pasa a admitir referencias `tokens.*`.
- `references/reference-resolution.md`: nueva familia `tokens.*`, superficies admitidas y comportamiento.
- `queries/execution.md`: resolución de `tokens.*` en headers en tiempo de ejecución de la petición.
- `current-state.md`: nueva área o actualización del área de referencias y queries.

## Riesgos o preguntas abiertas

- La extensión de `api.headers` para soportar resolución de referencias (actualmente solo admite valores string
  estáticos) requiere decisión arquitectónica: si se abre solo para `tokens.*` o para todas las familias en esa
  superficie. Pendiente de resolver en `design.md`.
- El lugar donde viven los timers de refresco y cómo se integran con el ciclo de vida del runtime también requiere
  decisión técnica explícita en `design.md`.
