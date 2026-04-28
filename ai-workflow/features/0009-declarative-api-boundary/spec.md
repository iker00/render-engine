# Spec: Declarative API boundary

## Objetivo
Convertir la sección `api` del runtime config en una frontera funcional útil y estable para describir llamadas remotas declarativas, de forma que el backend pueda definir endpoints, método HTTP, parámetros de query string y cuerpos JSON sin acoplar la UI renderizada a detalles de red o a un cliente HTTP concreto.

## Alcance
- Definir `api` como un catálogo declarativo de operaciones remotas nombradas dentro del config.
- Permitir que cada operación describa al menos su endpoint, método HTTP y, cuando aplique, la forma funcional de enviar query string o body JSON.
- Fijar una abstracción estable para que el runtime ejecute una operación por nombre y entregue su resultado al dominio compartido de queries o acciones sin que la UI construya requests manualmente.
- Mantener la separación entre la declaración de una llamada remota y los bloques visuales que luego consumen `queries.*` o disparan acciones.
- Alinear esta frontera con el estado compartido ya existente para `status`, `data` y `error`.
- Dejar la feature preparada para que precargas de página, refetch y acciones mutadoras usen la misma frontera declarativa en iteraciones posteriores.

## Fuera de alcance
- Diseñar todavía la sintaxis final de `preloads`, botones, submits de formularios u otros disparadores visuales de llamadas.
- Introducir autenticación, refresh de token, permisos, retries automáticos, caché persistente o políticas avanzadas de reintento.
- Soportar formatos de body distintos de JSON, como `multipart/form-data`, subida de archivos o payloads binarios.
- Abrir un lenguaje general de expresiones, plantillas complejas o transformaciones arbitrarias dentro de `query` o `body`.
- Resolver en esta misma feature la representación visual completa de estados `loading`, `error` y `empty`.
- Acoplar el contrato funcional a `fetch`, Axios u otra librería concreta como parte del comportamiento visible.

## Requisitos funcionales
- La raíz `api` debe dejar de ser un objeto reservado sin semántica y pasar a describir operaciones remotas con nombre estable dentro del config.
- Cada operación declarada en `api` debe poder identificar:
  - un endpoint remoto
  - un método HTTP
  - parámetros de query string cuando el método los admita
  - un body JSON cuando el método lo admita
- El contrato debe permitir operaciones `GET`, `POST`, `PUT`, `PATCH` y `DELETE`.
- El runtime debe poder ejecutar una operación declarada invocándola por nombre, sin exigir que la UI conozca la URL final ni construya manualmente el request.
- La ejecución debe alimentar el dominio compartido del runtime con un resultado coherente con el modelo ya documentado para queries:
  - `status`
  - `data`
  - `error`
- El contrato funcional debe diferenciar con claridad qué datos viajan por query string y cuáles viajan por body JSON para evitar ambigüedad entre backend y frontend.
- Una operación sin `query` declarada debe seguir siendo válida cuando el endpoint no necesite query string.
- Una operación sin `body` declarado debe seguir siendo válida cuando el método no necesite payload JSON.
- Si una operación usa un método que normalmente admite body, el contrato debe permitir declarar explícitamente que el body está vacío sin obligar a inventar payloads.
- La frontera debe permitir que una misma operación se use como lectura compartida de datos o como acción mutadora, manteniendo en ambos casos una semántica de ejecución uniforme desde el runtime.
- La UI declarativa debe seguir consumiendo resultados remotos a través del estado compartido y de las referencias del runtime, no mediante acceso directo al mecanismo de red.
- Cuando se intente ejecutar una operación inexistente en `api`, el runtime debe tratarlo como error de configuración o de invocación claramente diagnosticable, no como un fallo de red genérico.
- Cuando el config declare una operación con shape inválido o incompatible con su método HTTP, el runtime debe rechazarla con validación explícita antes de usarla.
- Cuando la ejecución falle por un error remoto o de conectividad, el runtime debe exponer un error con shape estable orientado a UI en lugar de filtrar directamente un error técnico crudo.
- El contrato debe permitir que operaciones distintas apunten al mismo endpoint con diferentes métodos o diferentes parámetros sin colisionar entre sí.

## Requisitos no funcionales
- La semántica de `api` debe seguir siendo simple de generar desde un backend legacy que controla JSON y strings.
- La frontera de ejecución debe mantener desacopladas la capa visual y la capa de red para evitar lógica HTTP dispersa por nodos o componentes de UI.
- El contrato debe ser lo bastante estable como para reutilizarse después desde precargas, acciones de formulario y refetch sin redefinir la semántica de las llamadas.
- La validación del config debe seguir ocurriendo antes de renderizar o ejecutar comportamientos dependientes de una operación declarada.
- La terminología debe permanecer alineada con el vocabulario ya asentado en el proyecto: `api`, `queries`, `status`, `data`, `error`, `preloads` y acciones.
- La feature debe preservar el alcance acotado de v1: una frontera declarativa pequeña y revisable, no un motor completo de integración remota.

## Criterios de aceptación
- Dado un config con `api.searchUsers` declarado como lectura `GET` con query string, el runtime reconoce esa operación como válida y la puede invocar por nombre sin que la UI construya la URL manualmente.
- Dado un config con `api.createUser` declarado con `POST` y body JSON, el runtime reconoce esa operación como válida y la puede invocar por nombre con payload JSON sin mezclarlo con query string.
- Dado un config con una operación `DELETE` que necesita query string pero no body, el contrato la admite sin exigir un payload JSON ficticio.
- Dado un config con una operación `PATCH` que necesita body JSON pero no query string, el contrato la admite sin exigir parámetros de query innecesarios.
- Dada una operación ejecutada con éxito, el runtime deja un resultado observable a través del dominio compartido con `status: success` y `data` disponible para consumidores del runtime.
- Dada una operación ejecutada con fallo remoto o de conectividad, el runtime deja un resultado observable con `status: error` y un `error` de shape estable orientado a UI.
- Dado un intento de invocar una operación no declarada en `api`, el runtime produce un diagnóstico explícito y no emite una llamada de red opaca.
- Dado un config con una operación cuyo método o shape no cumple el contrato soportado, la validación la rechaza antes de que se use en tiempo de ejecución.
- Dada una UI declarativa que consuma `queries.{queryName}.*`, el acceso al resultado remoto sigue ocurriendo a través del estado compartido del runtime y no mediante acoplamiento directo a la red.
- Dado un config existente con `api: {}` y sin operaciones remotas activas, el runtime mantiene un comportamiento compatible mientras no se use la nueva capacidad.

## Casos límite
- Una operación puede necesitar query string y body JSON a la vez; el contrato debe dejar claro que ambos canales son compatibles cuando el caso de uso lo requiera.
- Un endpoint puede reutilizarse con métodos distintos y semánticas distintas, por ejemplo lectura `GET` y borrado `DELETE`.
- Una operación declarativa puede no recibir todavía todos los datos necesarios en el momento de ejecutarse; la frontera debe permitir diferenciar entre configuración inválida y ejecución con entrada faltante.
- El backend puede esperar claves de query o body con nombres legacy poco uniformes; la spec debe tolerar esa realidad sin exigir renombrados automáticos.
- La respuesta remota puede ser un objeto, una colección, un valor primitivo o vacía; la frontera debe seguir siendo compatible con el modelo de `data` ya existente.
- El error remoto puede no venir normalizado por el backend; el runtime seguirá necesitando una forma estable de exponerlo a la UI.

## Riesgos o preguntas abiertas
- Hay que decidir qué parte del payload declarativo puede ser literal y qué parte puede depender de referencias ya soportadas del runtime, especialmente para enlazar formularios y parámetros sin abrir un motor de expresiones excesivo.
- Hay que fijar si la respuesta de una operación mutadora siempre debe hidratar una entrada de `queries`, si puede convivir con un dominio separado de acciones o si ambas lecturas deben compartir la misma frontera con distinto destino visible.
- Conviene aclarar qué validaciones son estrictamente de contrato y cuáles dependen del momento de invocación, por ejemplo ausencia de datos requeridos para construir query string o body.
- La ejecución remota introduce suficiente impacto transversal entre contrato, validación, estado compartido y futura interacción declarativa como para que probablemente necesite `design.md` antes de implementar.

## Áreas de producto afectadas
- Contrato de configuración
- Runtime UI configurable
- Queries y feedback
- Workflow de desarrollo sin backend cuando necesite simular llamadas declaradas

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
