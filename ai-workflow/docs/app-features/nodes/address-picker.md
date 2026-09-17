> Cuándo leer: si la tarea toca el nodo `address-picker` — campo de formulario con mapa interactivo, geolocalización del navegador y geocodificación inversa de coordenadas.
> Tamaño: medio.
> Relacionados: [[../references/reference-resolution.md]], [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[./map.md]], [[../forms/validation-rules.md]], [[../queries/execution.md]].

# Nodo `address-picker`

Nodo hoja de formulario que captura una dirección postal con apoyo de un mapa interactivo, botón de geolocalización del navegador y geocodificación inversa automática de coordenadas. Válido únicamente como descendiente de un `form`. Estado actual: feature completa — el nodo se renderiza de punta a punta a través de `LayoutRenderer`, con marcador interactivo, disparo unificado de geocodificación inversa y resolución de referencias sintéticas de coordenadas.

## Contrato (`props`)

| Prop | Tipo | Requerido | Descripción |
|---|---|---|---|
| `props.fieldId` | `string` | **sí** | Identificador único del campo dentro del formulario contenedor. Igual criterio que `input`/`select`/`autocomplete`. |
| `props.label` | `string` | no | Etiqueta visible del campo. Asociada al `<input>` de texto vía `<label htmlFor>`. |
| `props.placeholder` | `string` | no | Texto placeholder del campo de texto de dirección. |
| `props.center` | `{ lat: number; lng: number }` | no | Centro inicial del mapa. `lat` en `[-90, 90]`, `lng` en `[-180, 180]`. |
| `props.zoom` | `number` (entero) | no | Nivel de zoom inicial, entre `0` y `19` inclusive. |
| `props.height` | `"sm" \| "md" \| "lg" \| "xl"` | no | Altura del contenedor del mapa. |
| `props.defaultValue` | `string` | no | Valor inicial de texto de dirección. Rellena solo el campo de texto; no siembra coordenadas (`$lat`/`$lng`). |
| `props.validations` | `FieldValidations` | no | Conjunto de reglas de validación aplicables a `input`/`textarea`: `required`, `minLength`, `maxLength` — mismo contrato que el resto del catálogo de campos. |
| `props.queryName` | `string` | **sí** | Nombre de la operación `api` configurada en el bloque raíz, que se ejecutará cada vez que cambien las coordenadas (click en el mapa o botón de geolocalización). La operación debe tener `body`/`query` que referencie `forms.{formId}.{fieldId}.$lat` y `forms.{formId}.{fieldId}.$lng`. |

No admite `children` (nodo hoja): si el config declara `children` en un nodo `address-picker`, se rechaza antes del render con `invalid-layout` sobre `{path}.children`.

## Comportamiento

### Posicionamiento y marcador
- Un click en cualquier punto del mapa coloca/mueve el marcador a esa posición y dispara automáticamente la operación de geocodificación inversa configurada en `props.queryName`, pasando las coordenadas a través de las referencias `forms.{formId}.{fieldId}.$lat` y `forms.{formId}.{fieldId}.$lng` en el `body`/`query` de la operación.
- Mientras la operación de geocodificación está en curso, el campo de texto refleja un estado de carga (deshabilitado visualmente sin bloquear el resto del formulario).
- Al resolverse la operación con éxito, la respuesta se interpreta como una dirección legible (string) y se asigna al campo de texto; las coordenadas permanecen fijas en el store local del nodo hasta el próximo cambio de posición del marcador.
- Si la operación falla (error de red o respuesta inválida), el campo muestra un error inline junto a la etiqueta, sin sobreescribir el texto de dirección anterior ni el estado de las coordenadas.

### Geolocalización del navegador
- Un botón etiquetado (estilo: icono + texto, "Mi ubicación" por defecto) solicita el permiso de geolocalización al navegador mediante `navigator.geolocation.getCurrentPosition`.
- Con permiso concedido, la API entrega las coordenadas actuales del dispositivo; el nodo coloca el marcador en esas coordenadas exactamente como si fuera un click manual en el mapa, disparando la geocodificación inversa con los mismos parámetros (`$lat`/`$lng`).
- Si el navegador deniega el permiso, la API no soporta geolocalización, o el contexto no es seguro (fuera de `https`), se muestra un error inline junto al botón sin bloquear el resto del formulario ni la interacción manual con el mapa.

### Geocodificación inversa centralizada
- Tanto el click en el mapa como la entrega de coordenadas del botón de geolocalización disparan exactamente la misma operación de geocodificación inversa, sin duplicación de lógica — la operación se configura una única vez en `props.queryName`.
- La frontera de debounce o política de frescura ante clicks rápidos sucesivos se resuelve con comparación local de `requestSignature`: solo se aplica el resultado de la operación al campo de texto si coincide con la más reciente disparada — mismo patrón que usa `autocomplete`.
- Límite de producto (igual que `autocomplete`): si dos instancias de `address-picker` dentro de un `repeater` comparten el mismo `queryName`, no resolverán de forma verdaderamente independiente y simultánea.

### Edición manual de dirección
- El campo de texto es editable libremente en cualquier momento; editar a mano el texto no modifica ni limpia las coordenadas previamente fijadas — el marcador permanece en su última posición conocida.
- Editar el texto tampoco dispara una geocodificación directa (dirección a coordenadas): esa capacidad está fuera de alcance en esta entrega.

### Estado de coordenadas sintéticas
- Las coordenadas de la última posición fijada (por click o por botón de geolocalización) se exponen como referencias sintéticas exactas `forms.{formId}.{fieldId}.$lat` y `forms.{formId}.{fieldId}.$lng`.
- Se resuelven contra un registro metadato de coordenadas del campo en el store de formularios, independiente del valor textual.
- Disponibles en las mismas superficies donde se admiten referencias completas de `forms.*` en payloads: `api.query`, `api.body`, `button.props.action.query`, `button.props.action.body`, `form.submitAction.query`, `form.submitAction.body` — igual que cualquier otra referencia de formulario, excluidas de superficies visibles, interpolación y `visibility.reference`.
- Si nunca se ha fijado ninguna posición (ni click en mapa ni botón de geolocalización con éxito), `$lat`/`$lng` no resuelven a un valor; cualquier operación que las referencie en su petición fallará con `code: request-build-failed` en ese momento, sin emitir red.

### Ciclo de vida del formulario
- El nodo participa del ciclo estándar de campos de formulario: validación aplicable según `props.validations`, inclusión en el payload de submit según `visibility`/`queryStateFeedback`, `defaultValue` siembra solo el texto de dirección, no coordenadas.
- La inicialización lazy por paso en `steps` excluye este campo igual que el resto, inicializándose cuando su paso entra en foco.

## Validación previa al render

- `props.fieldId` ausente o vacío: `invalid-layout`.
- `props.fieldId` duplicado dentro del `form` contenedor (igual que `input`/`select`/`autocomplete`): `invalid-layout`.
- `address-picker` declarado fuera de un descendiente de `form`: `invalid-layout`.
- `props.center.lat` fuera de `[-90, 90]` o `props.center.lng` fuera de `[-180, 180]`: `invalid-layout` sobre `{path}.props.center.lat` / `.lng`.
- `props.zoom` fuera de `[0, 19]`: `invalid-layout` sobre `{path}.props.zoom`.
- `props.queryName` ausente, vacío o no resuelve a una operación `api` declarada en la raíz: `invalid-layout` sobre `{path}.props.queryName`.
- Una referencia a `forms.{formId}.{fieldId}.$lat` o `forms.{formId}.{fieldId}.$lng` en cualquier superficie de payload (`api.query`, `api.body`, `button.props.action`, `form.submitAction`, etc.) donde el `fieldId` no existe, o existe pero es un nodo distinto de `address-picker` dentro del mismo `form`, se rechaza en bootstrap con `invalid-layout`.

## Normalización

- Sin `props.center`, `props.zoom` ni `props.height` declarados: el nodo normalizado omite estos campos; se resuelven sus valores por defecto en el componente de render (centro: Pamplona, zoom: 13, altura: `md`), igual que `map`.

## Casos límite

### Coordenadas geolocalizadas fuera de cobertura
Si la operación de geocodificación inversa no devuelve una dirección resoluble (por ejemplo, coordenadas en medio del océano), el campo de texto puede quedar vacío o con un valor por defecto según la lógica de la operación de backend — el nodo no interpreta la respuesta como válida o inválida, solo la asigna al campo si es string.

### Clicks rápidos sucesivos
Cuando el usuario hace varios clicks en corto lapso, la `requestSignature` local rastrea cuál es el disparador más reciente — solo se aplica la respuesta de esa última operación al campo de texto, descartando resultados de clics anteriores que lleven un `requestSignature` obsoleto.

### Mismo `queryName` en varias instancias dentro de un `repeater`
Si dos o más instancias de `address-picker` dentro de un `repeater` comparten el mismo valor de `props.queryName`, comparten estado de operación en `queries.{queryName}` — cada instancia rastrea localmente su `requestSignature` para filtrar resultados, pero la cola de ejecución de la operación sigue siendo única. Esto es una limitación aceptada de diseño, documentada igual que en `autocomplete.md`.

### Edición manual seguida de error de geocodificación
Si el usuario edita manualmente el texto de dirección tras un error de geocodificación previo, el campo permanece editable libremente sin quedar bloqueado por el error anterior.

## Code-splitting y performance

El nodo reutiliza el code-splitting ya establecido para `map`: `leaflet` y `react-leaflet` se cargan de forma diferida (solo para páginas que usan `map` o `address-picker`), evitando peso de bundle para páginas que no los necesitan. El CSS de Leaflet se carga como side-effect del módulo diferido.

## Accesibilidad

- El campo de texto está asociado a su etiqueta vía `<label htmlFor>` explícito.
- El botón de geolocalización declara texto accesible (`aria-label` o texto visible).
- El error de geolocalización se anuncia con `role="alert"` junto al botón.
- El error de geocodificación inversa se anuncia junto al campo de texto con el mismo patrón que errores de validación existentes.
- El marcador interactivo declara un `aria-label` identificando su función.

## Estilos

Tailwind CSS + tokens visuales globales. Sin estilos inline ni capa visual paralela.
