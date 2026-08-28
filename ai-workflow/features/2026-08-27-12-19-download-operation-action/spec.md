# Spec: descarga de ficheros vía fetch autenticado desde `button`/`link`

## Objetivo
Permitir que los nodos `button` y `link` disparen la descarga de un fichero mediante una petición `fetch` autenticada a una operación del catálogo `api`, cubriendo el caso donde la descarga requiere cabeceras (p. ej. `Authorization`) que un `<a href download>` estático no puede transportar.

## Alcance
- Nuevo tipo de acción `downloadOperation` añadido al catálogo `props.action.type` de `button` (junto a `navigateTo | goBack | executeOperation | executeOperations | resetForm | openModal | closeModal`) y de `link` (junto a `navigateTo | goBack`).
- Contrato de la acción idéntico al de `executeOperation`: `operationName` (obligatorio, debe existir en `api`), `query`/`body`/`headers` opcionales.
- La operación referenciada puede ser `GET` o `POST` (cualquier método soportado por el catálogo `api`), manteniendo la regla ya existente de que un método `GET` no admite `body`.
- Al ejecutarse: fetch con los headers resueltos (incluida la inyección de `tokens.*` documentada en `auth/tokens.md`); si la respuesta es exitosa, se construye un `Blob` con el cuerpo de la respuesta y se dispara la descarga en el navegador mediante un anchor temporal con `URL.createObjectURL`, revocando el blob URL después.
- Resolución del nombre de fichero, en orden de prioridad:
  1. `Content-Disposition` de la respuesta, si está presente y contiene un `filename` parseable.
  2. `props.action.filename` (literal, referencia dinámica completa o interpolado), si está declarado y resuelve a un string no vacío.
  3. Nombre genérico de fallback si ninguno de los anteriores resuelve.
- El estado de la operación se refleja en `queries.{operationName}` igual que cualquier otra operación (`loading`/`success`/`error`), consumible por `queryStateFeedback` en cualquier nodo del layout.
- `downloadOperation` admite `onSuccess`/`onError` con la misma semántica ya documentada para `executeOperation` en `button` (lista ordenada, `when` opcional por entrada, `onSuccess` solo tras éxito, `onError` solo tras fallo, nunca ambos). Esto es nuevo para `link`, que hoy no tiene lifecycle de éxito/error.
- Mientras la descarga está en curso, el control (`button`/`link`) que la disparó queda deshabilitado, para evitar doble disparo por doble clic.

## Fuera de alcance
- Subida de ficheros (ya cubierta por `file-manager`/`file-input`).
- `link.props.href` + `props.download` (descarga estática existente sin `fetch`): sigue existiendo sin modificación, es un mecanismo distinto y complementario.
- `file-manager.downloadOperation` (construcción de URL de enlace sin `fetch`): no se toca ni se unifica con este mecanismo nuevo.
- Progreso de descarga (barra de progreso, porcentaje): la operación se trata como un `fetch` atómico, sin streaming de progreso.
- Reintentos automáticos tras fallo.
- Cancelación manual de una descarga en curso.
- Deduplicación o cache de descargas repetidas del mismo fichero.
- Validación o límite de tamaño máximo del fichero descargado.
- Cambios de comportamiento en `executeOperation`/`executeOperations` existentes fuera de la extensión estrictamente necesaria para soportar el nuevo tipo de acción.

## Requisitos funcionales
- FR1: `button.props.action.type` acepta el valor `"downloadOperation"` con el mismo shape que `executeOperation` (`operationName`, `query?`, `body?`, `headers?`).
- FR2: `link.props.action.type` acepta el mismo valor `"downloadOperation"`, además de `navigateTo`/`goBack` ya existentes.
- FR3: Al pulsar el control, el runtime ejecuta un `fetch` contra la operación referenciada, con headers resueltos (incluida inyección de `tokens.*`).
- FR4: Si la respuesta es exitosa (2xx), el runtime arma un `Blob` con el cuerpo de la respuesta y dispara la descarga del navegador con el nombre resuelto.
- FR5: El nombre del fichero se resuelve según la prioridad descrita en "Alcance" (Content-Disposition → `props.action.filename` → fallback genérico).
- FR6: El estado de la operación (`loading`/`success`/`error`) se refleja en `queries.{operationName}`, igual que cualquier otro `operationName` del catálogo `api`.
- FR7: `downloadOperation` admite `onSuccess`/`onError` con la misma semántica ya documentada para `executeOperation` en `button` (orden declarado, `when` opcional, mutuamente excluyentes).
- FR8: Mientras la descarga está en curso, el control queda deshabilitado; no se puede volver a disparar la misma acción hasta que la operación termine (éxito o error).
- FR9: Si la respuesta HTTP no es exitosa (4xx/5xx) o el `fetch` falla por red, no se dispara ninguna descarga y se evalúa la cadena `onError` si existe.
- FR10: La operación admite cualquier método HTTP declarado en el catálogo `api` para esa entrada (`GET` o `POST`), manteniendo la regla existente de que `GET` no admite `body`.

## Requisitos no funcionales
- Reutilizar el mecanismo de inyección de `tokens.*` ya documentado en `auth/tokens.md`, sin duplicar lógica de resolución de headers.
- El blob URL creado para la descarga debe revocarse tras iniciar la descarga, para no acumular memoria.
- No introducir dependencias de terceros nuevas: usar APIs nativas del navegador (`fetch`, `Blob`, `URL.createObjectURL`).
- Mantener el umbral mínimo de cobertura del 80% sobre `src/`.

## Criterios de aceptación
- Un `button` con `action.type: downloadOperation` apuntando a una operación `api` válida dispara `fetch` al pulsar, y si la respuesta es 2xx, el navegador recibe una descarga con el nombre esperado.
- Un `link` con el mismo `action.type` se comporta igual que el `button` (mismo fetch, mismo blob, misma descarga).
- Si la operación referenciada no existe en `api`, el config se rechaza antes del render (igual que `executeOperation`).
- Si el `fetch` responde con `Content-Disposition: attachment; filename="reporte.pdf"`, el fichero descargado se llama `reporte.pdf`.
- Si no hay `Content-Disposition` pero `props.action.filename` resuelve a `"informe.pdf"`, el fichero descargado se llama `informe.pdf`.
- Si ni `Content-Disposition` ni `filename` resuelven, el fichero descargado usa el nombre genérico de fallback documentado.
- Mientras la descarga está en curso, un segundo clic sobre el mismo control no dispara una segunda petición.
- Tras terminar la descarga (éxito o error), el control vuelve a estar habilitado.
- `onSuccess` se ejecuta solo si el `fetch` fue exitoso; `onError` solo si falló; nunca ambos para la misma ejecución.
- `queries.{operationName}.status` refleja `loading` durante el fetch y `success`/`error` al terminar, consumible por `queryStateFeedback` en otro nodo.
- Un `downloadOperation` sobre una operación `api` con `method: GET` y `body` declarado se rechaza en validación previa (regla ya existente en `executeOperations`, extendida a este nuevo tipo de acción).

## Casos límite
- Respuesta 2xx con body vacío: se descarga un fichero vacío con el nombre resuelto (degradación segura, no error).
- `Content-Disposition` presente pero sin `filename` parseable: se recurre a `props.action.filename` o al fallback genérico.
- `props.action.filename` interpolado que resuelve a string vacío: se recurre al fallback genérico (nunca se usa un nombre vacío).
- `fetch` fallido por red (sin respuesta HTTP): se trata igual que un error HTTP a efectos de `onError`/`queries.status`.
- Token de auth en headers en estado de error (`token-refresh-failed`): la operación de descarga falla igual que cualquier otra operación que referencia ese token, sin llegar a disparar el `fetch`.
- Dos instancias distintas de `button`/`link` con el mismo `operationName`: cada una gestiona su propio estado de "en curso" (deshabilitado) de forma independiente, pero ambas reflejan el mismo `queries.{operationName}` global.
- `downloadOperation` dentro de un `repeater`: `item.*` se resuelve igual que en `executeOperation` dentro de un `repeater` (query/body/headers por iteración).
- El usuario navega fuera de la página mientras la descarga está en curso: comportamiento best-effort del navegador; el runtime no cancela el `fetch` explícitamente (cancelación queda fuera de alcance).

## Riesgos o preguntas abiertas
- **Requiere `design.md`**: en la exploración previa se detectó que `button` ya calcula éxito/error para `onSuccess`/`onError` de forma acoplada e inlineada en `handleActionWithLifecycle` (`button-layout-node.tsx`), y que `form-layout-node.tsx` repite el mismo patrón para el submit. `link` no tiene lifecycle de éxito/error hoy. Añadir `downloadOperation` con `onSuccess`/`onError` en ambos nodos obliga a decidir si esa lógica se factoriza en una función compartida o se duplica una tercera vez. Es una decisión técnica no trivial (varias estrategias razonables) que debe resolverse en `design.md` antes de planificar tareas.
- El formato exacto del nombre de fallback genérico (p. ej. derivado de `operationName` vs. un literal fijo) se deja para `design.md`/`tasks.md`; no cambia el comportamiento observable descrito en esta spec.
- No se ha evaluado compatibilidad de navegador para el patrón `URL.createObjectURL` + anchor temporal; riesgo bajo y no bloqueante para v1 (mecanismo ya usado hoy por `image.props.fetch`/`gallery` para mostrar blobs, aunque no para forzar descarga).

## Áreas de producto afectadas
- `nodes/button.md`, `nodes/link.md` (catálogo de acciones).
- Estado de queries (`queries.{operationName}`), sin cambios de contrato, solo un nuevo origen de escritura.
- `auth/tokens.md`: reutilización sin cambios de la inyección de tokens en headers.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/nodes/button.md`
- `ai-workflow/docs/app-features/nodes/link.md`
