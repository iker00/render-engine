# Spec: nodo de formulario `address-picker`

## Objetivo
Permitir que un formulario declarativo capture la dirección de una persona ayudándose de un mapa interactivo y de la geolocalización del navegador, en vez de exigir que el usuario la teclee de cero. El resultado debe integrarse como un nodo más del catálogo de campos de formulario, sin salirse de las fronteras arquitectónicas ya vigentes (la red vive en `src/queries/`, los nodos no construyen `fetch` directamente).

## Alcance
- Nuevo nodo hoja de formulario `address-picker` (nombre de trabajo; puede ajustarse en diseño si hay una alternativa mejor alineada con el catálogo), válido únicamente como descendiente de `form`, con `props.fieldId` obligatorio y único dentro de su `form` — mismo criterio que `input`/`select`/`autocomplete`.
- Un mapa interactivo (reutilizando la base ya vigente de `Leaflet`/`react-leaflet` que usa el nodo `map`) donde:
  - un click coloca o mueve un marcador en el punto pulsado y dispara automáticamente la geocodificación inversa de esas coordenadas.
- Un botón de geolocalización que:
  - solicita la posición actual al navegador (`navigator.geolocation`);
  - si el navegador concede el permiso, coloca/mueve el marcador del mapa a esa posición y dispara la misma geocodificación inversa que el click en el mapa;
  - si el permiso se deniega o el navegador no soporta geolocalización, muestra un error inline junto al botón sin bloquear el resto del formulario ni el uso del mapa.
- Un campo de texto de dirección, editable libremente por el usuario en cualquier momento, que:
  - se rellena automáticamente con el resultado de la geocodificación inversa tras un click en el mapa o tras un uso exitoso del botón de geolocalización;
  - puede seguir editándose a mano después, sin que eso altere las coordenadas ya fijadas (ver "Casos límite").
- La geocodificación inversa (coordenadas → dirección) se modela como una operación declarativa del catálogo `api` del config, en la misma familia de disparo que ya usa `autocomplete` para sus búsquedas dinámicas (`executeQueryOperation`), configurada por quien defina el JSON — el proveedor real (Nominatim, Google, HERE u otro) es una decisión de configuración por instancia, no de esta feature.
- El disparo de la geocodificación está centralizado en el mapa: reacciona a cualquier cambio de posición del marcador, venga de un click directo o de coordenadas entregadas por el botón de geolocalización, sin duplicar la lógica de disparo entre ambas interacciones.
- El valor efectivo del campo (`forms.{formId}.{fieldId}`) sigue siendo el texto de dirección, igual que cualquier campo de texto. Las coordenadas de la última posición fijada se exponen aparte, como dos referencias sintéticas nuevas `forms.{formId}.{fieldId}.$lat` / `forms.{formId}.{fieldId}.$lng` (mismo patrón que `item.$key`/`item.$index`/`row.$index`/`switch.next`), usables en el `body`/`query` de la operación de geocodificación y de cualquier otra operación que el backend quiera montar con esas coordenadas. Si nunca se ha fijado ninguna posición, `$lat`/`$lng` no resuelven a un valor.

## Fuera de alcance
- Geocodificación directa (dirección de texto → coordenadas): editar el texto a mano nunca deriva ni recalcula una posición nueva en el mapa.
- Sugerencias o autocompletado de direcciones mientras se escribe (ese comportamiento ya existe como nodo `autocomplete`; no se duplica aquí).
- Elegir o integrar un proveedor de geocodificación concreto: la feature deja el contrato preparado para que backend configure la operación real.
- Arrastrar (drag) el marcador del mapa para reposicionarlo: solo se especifica click.
- Clustering de marcadores, cálculo de rutas o cualquier otra capacidad ya excluida explícitamente del nodo `map` en su v1.
- Soporte en `dev-editor` (edición visual del nodo en el panel de propiedades): mismo criterio que tuvo `map` en su entrega inicial.
- Reintentos automáticos o políticas de caché específicas para la operación de geocodificación más allá del comportamiento estándar ya vigente para cualquier operación `queries.*`.

## Requisitos funcionales
1. `address-picker` solo es válido como descendiente de un subárbol `form`; declarado fuera de `form`, el config se rechaza en validación previa al render (mismo criterio que `input`/`select`/`autocomplete`).
2. `props.fieldId` es obligatorio y único dentro del `form` contenedor.
3. El nodo renderiza, como mínimo: un mapa interactivo, un botón de geolocalización y un campo de texto de dirección.
4. Un click en el mapa coloca o mueve el marcador al punto pulsado y dispara automáticamente la operación de geocodificación inversa configurada, usando esas coordenadas como parámetros de la petición.
5. Al resolver con éxito la operación de geocodificación, el texto de dirección del campo se actualiza con el resultado devuelto.
6. El botón de geolocalización solicita la posición actual del navegador; con permiso concedido, entrega esas coordenadas al mapa (como si fuera un click en ese punto) para que coloque/mueva el marcador y dispare la geocodificación.
7. El disparo de la geocodificación inversa está centralizado en la reacción del mapa a un cambio de posición del marcador, sea cual sea el origen de ese cambio (click directo o coordenadas entregadas por el botón de geolocalización): no se duplica la lógica de disparo entre el manejador del click y el del botón.
8. Si el permiso de geolocalización se deniega, o el navegador no soporta la API, se muestra un mensaje de error inline junto al botón, sin bloquear el resto del formulario; el mapa sigue siendo usable para selección manual.
9. El campo de texto de dirección es editable libremente por el usuario en cualquier momento, como cualquier campo de texto estándar del catálogo.
10. Editar el texto manualmente no modifica ni limpia las coordenadas previamente fijadas por mapa o por botón; el marcador del mapa permanece en su última posición conocida.
11. El valor efectivo del campo (`forms.{formId}.{fieldId}`) es siempre el texto de dirección, igual que cualquier otro campo de texto — no cambia de forma para este nodo, así que cualquier superficie que ya trate `forms.*` como texto (interpolación, `defaultValue` de otros campos, celdas de tabla, etc.) sigue funcionando sin caso especial.
12. Las coordenadas de la última posición fijada por mapa o por botón se exponen como dos referencias sintéticas nuevas, `forms.{formId}.{fieldId}.$lat` y `forms.{formId}.{fieldId}.$lng` — mismo patrón de "forma sintética exacta" que `item.$key`/`item.$index`/`row.$index`/`switch.next` — disponibles en las superficies de petición donde ya se admiten referencias `forms.*` (como mínimo, `body`/`query` de la operación de geocodificación; el diseño decide si se habilitan también en otras superficies como `button.props.action.body`). Si nunca se ha fijado ninguna posición, `$lat`/`$lng` no resuelven a un valor.
13. Las coordenadas activas (del marcador) alimentan la operación de geocodificación inversa a través de estas mismas referencias sintéticas — no existe un mecanismo de transporte paralelo (tipo `requestParams` a medida) solo para esta operación.
14. La geocodificación inversa se ejecuta exclusivamente como una operación declarativa del catálogo `api` (misma fachada `executeQueryOperation` que ya usan botón, submit y `autocomplete`); el nodo no construye `fetch`, URLs ni `RequestInit` por su cuenta.
15. Mientras la operación de geocodificación está en curso, el campo refleja un estado de carga (p. ej. deshabilitado o con indicador visual) sin bloquear el resto del formulario.
16. Si la operación de geocodificación falla (error de red o respuesta inválida), se muestra un error inline asociado al campo, sin bloquear el resto del formulario ni el envío de otros campos; el texto de dirección no se sobreescribe con un valor inválido o vacío por culpa del error.
17. El nodo participa del ciclo de vida estándar de campos de formulario: `defaultValue`, validación (como mínimo `required`), e inclusión/omisión del payload de submit según `visibility`/`queryStateFeedback`, igual que el resto del catálogo de campos.

## Requisitos no funcionales
- Reutilizar la base ya vigente de `Leaflet`/`react-leaflet` y su patrón de code-splitting (el peso de la librería de mapas solo se descarga cuando una página usa un nodo que la necesita).
- Accesibilidad: label asociado al campo de texto, botón de geolocalización con texto accesible, error inline anunciado de forma consistente con el resto del catálogo (mismo patrón que errores de validación existentes).
- Estilos exclusivamente con Tailwind y los tokens visuales globales ya establecidos; sin estilos inline ni capa visual paralela.
- Sin coste adicional de bundle para páginas que no usan `address-picker` (mismo criterio de aislamiento que ya aplica `map`/`gallery`/`chart`).

## Criterios de aceptación
- Dado un `form` con un `address-picker`, al hacer click en un punto del mapa, el marcador se coloca ahí y el campo de texto termina mostrando la dirección devuelta por la operación de geocodificación configurada.
- Dado el mismo nodo, al pulsar el botón de geolocalización con permiso concedido (simulando `navigator.geolocation`), el marcador se mueve a la posición devuelta y el texto se actualiza con la dirección resuelta.
- Dado el mismo nodo, al denegar el permiso de geolocalización o simular su ausencia, se muestra un error inline y el resto del formulario sigue operativo, incluida la selección manual por mapa.
- Dado un valor ya fijado por mapa o botón, al editar el texto manualmente, el texto cambia pero las coordenadas asociadas no se alteran.
- Dado que nunca se ha fijado ninguna posición (ni por mapa ni por botón), `forms.{formId}.{fieldId}.$lat` y `.$lng` no resuelven a un valor; el campo solo tiene texto.
- Dado un `address-picker` con la operación de geocodificación configurada referenciando `forms.{formId}.{fieldId}.$lat`/`.$lng` en su `body`/`query`, al clicar en el mapa o usar el botón de geolocalización, la petición efectiva de esa operación lleva las coordenadas del punto activo.
- Declarar `address-picker` fuera de un `form` produce un error de validación (`invalid-layout`), igual que el resto de campos exclusivos de formulario.
- Con `props.validations.required`, un valor de texto vacío se trata como inválido, igual que el resto de campos de texto del catálogo.
- Una respuesta de error de la operación de geocodificación deja el campo con un error visible sin romper el resto del formulario ni impedir seguir interactuando con el mapa o el texto.

## Casos límite
- Clicks rápidos y sucesivos en el mapa: solo debe prevalecer la geocodificación relevante para el último punto pulsado; la política exacta de descarte de respuestas obsoletas se precisa en diseño, siguiendo el precedente de `requestSignature` ya usado por `autocomplete`/`queries.*`.
- El diálogo de permiso de geolocalización del navegador se cierra sin respuesta o tarda demasiado: el botón no debe quedar bloqueado indefinidamente.
- Coordenadas geolocalizadas o clicadas fuera de cobertura del proveedor de geocodificación (p. ej. en medio del océano): la operación puede no devolver una dirección resoluble; el campo debe reflejar error o vacío sin romper el resto del formulario.
- El nodo dentro de un `repeater`: cada iteración mantiene su propio estado de mapa, coordenadas y texto de forma independiente, sin compartir estado con otras iteraciones (mismo criterio que el resto de campos de formulario dentro de `repeater`).
- Edición manual del texto inmediatamente después de un error de geocodificación: el usuario debe poder seguir escribiendo libremente aunque la última operación haya fallado.

## Riesgos o preguntas abiertas
- Registro técnico de `$lat`/`$lng` como referencias sintéticas de `forms.*`: la dirección está decidida (mismo patrón que `item.$key`/`item.$index`/`row.$index`/`switch.next`), pero el diseño debe fijar el detalle de implementación — dónde vive el estado de coordenadas del nodo, cómo se registra el namespace en `runtime-reference-syntax.ts`, y en qué superficies concretas de petición se admite además de la propia operación de geocodificación.
- Elección del proveedor real de geocodificación inversa y sus condiciones de uso/coste quedan fuera de esta spec: es una decisión de configuración de cada instancia/backend.
- Política de cancelación o descarte de respuestas obsoletas ante interacción rápida sucesiva (clicks en el mapa, o click seguido de botón) se deja para diseño.

## Áreas de producto afectadas
- Catálogo de nodos (`nodes/`): nuevo nodo de formulario.
- Formularios y validación (`forms/`): nuevo tipo de valor de campo compuesto (texto + coordenadas opcionales).
- Queries, ejecución y feedback (`queries/`): nueva superficie de disparo de operaciones `api`, basada en coordenadas en vez de texto.
- Referencias y reactividad declarativa (`references/`): nuevas referencias sintéticas `forms.{formId}.{fieldId}.$lat` / `.$lng`.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/nodes/index.md` (nueva fila en "Nodos de formulario").
- Nueva ficha `ai-workflow/docs/app-features/nodes/address-picker.md`.
- `ai-workflow/docs/app-features/forms/index.md` (referencia al nuevo nodo en el listado de nodos de formulario).
- `ai-workflow/docs/app-features/references/reference-resolution.md` (nuevas referencias sintéticas `forms.{formId}.{fieldId}.$lat`/`.$lng`).
- `ai-workflow/docs/current-state.md` (fila "Catálogo de nodos").
