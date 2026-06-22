# Spec: 0077 — Submit omite referencias a campos ocultos en el wire format

## Objetivo

Hacer que las peticiones disparadas por `submitAction` (y por extensión cualquier `executeQueryOperation` que use
referencias a campos de formulario) no incluyan en el payload (`body`, `query`, `headers`) las claves cuyo valor referencia
un campo de formulario que está oculto por `visibility` en el momento del envío. La intención semántica es: **si un
campo está oculto, no participa en la validación ni en el envío**.

## Contexto del bug

El comportamiento observado en producción es que un formulario con campos ocultos por `visibility` no se envía cuando
esos campos nunca llegaron a hacerse visibles. El síntoma es que al pulsar el botón de submit "no pasa nada": la
petición no sale y el formulario tampoco muestra error de validación.

Tras investigar, la causa raíz **no está en la validación** (la validación ya excluye correctamente los campos ocultos
gracias a la feature 0036). Está en el resolver del request HTTP:

- El config declara, por ejemplo, `body.Descripcion: "forms.search.desc"`.
- Si `desc` está oculto desde la carga, nunca se inicializa en `forms.search.*`.
- `resolveRuntimeReference("forms.search.desc", state)` devuelve `{ status: 'missing' }`.
- `resolvePayloadValue` solo acepta `'literal'` y `'resolved'`; para `'missing'` devuelve `{ status: 'error' }`.
- `resolveBody` propaga el error como `request-build-failed`.
- `executeQueryOperationWithSnapshot` despacha `queries/set-error` y **no llama a `fetch`**.
- El form vería ese error en `onError`, pero como la mayoría de configs no lo tienen, el efecto visible es "no pasa
  nada".

Cuando el usuario hace visibles los campos y los vuelve a ocultar, los campos quedan inicializados en el store con
`defaultValue` (típicamente `""`). En ese caso la referencia sí resuelve y la petición se envía con esos valores vacíos.

## Decisión funcional

Si un campo está oculto por `visibility` en el momento del submit, las claves del payload del request que referencian a
ese campo **se omiten del payload**, en lugar de resolverse a `""` o a `null`. La razón conceptual: un campo oculto
significa que ese dato no aplica al modo actual del formulario, así que el backend debe recibir el payload sin esa clave.

Esta decisión es coherente con la semántica que ya tiene la app para validación (campo oculto → no se valida).

## Alcance

- Resolver del request HTTP (capa de queries) usado por `executeQueryOperation` cuando se dispara como `submitAction` de
  un formulario.
- Aplica a estas secciones del config de la operación:
  - `body` (JSON anidado).
  - `query` (query string).
  - `headers`.
- Solo se omiten claves cuya referencia apunte a `forms.{formId}.{fieldId}` donde:
  - `formId` es el formulario que dispara el submit.
  - `fieldId` corresponde a un campo declarado dentro de ese formulario.
  - `fieldId` está **oculto** por `visibility` en el snapshot del submit (según la misma utilidad que usa el renderer).
- En `body` JSON, la clave se omite sólo a su nivel; el objeto contenedor se conserva aunque quede vacío (no se podan
  objetos vacíos).

## Fuera de alcance

- Cambios en `endpoint` (path/template): si una referencia ahí apunta a un campo oculto, se mantiene el comportamiento
  actual de error duro. El path no admite "omisión silenciosa".
- Referencias a `params.*`, `queries.*.*`, `item.*`, o a `forms.*.fieldId` de **otros formularios**: siguen siendo
  errores legítimos cuando están `missing`. La omisión silenciosa **solo** aplica a campos del propio form del submit.
- Comportamiento de operaciones disparadas fuera de `submitAction` (preloads, acciones manuales que no son submit de
  form): por ahora se mantiene la semántica actual (error si la referencia es missing). Si se quisiera extender más
  adelante a otros puntos, sería otra feature.
- No se cambia el contrato JSON del config: no se añaden campos opt-in/opt-out.
- No se cambia la política lazy de inicialización: los campos ocultos siguen sin inicializarse en store hasta que se
  hagan visibles.
- No se modifica el comportamiento de la validación de submit (la cubre 0036 y el caso "nunca inicializado" ya estaba
  cubierto de hecho — los tests añadidos en el intento previo de 0077 pasaban sin tocar producción).

## Requisitos funcionales

1. Al ejecutar el `submitAction` de un formulario, las claves del `body`, `query` y `headers` cuyo único valor sea una
   referencia a un campo de ese formulario actualmente oculto por `visibility` se eliminan del payload final.
2. El conjunto de campos ocultos se evalúa con la misma utilidad de visibilidad que usa el renderer del formulario,
   contra el snapshot de estado del submit (`forms.*`, `queries.*`, `params.*`, `item.*` cuando aplica).
3. Las claves cuya referencia sea a un campo visible (aunque vacío) siguen viajando como hoy.
4. Las claves cuya referencia sea a un campo de otro formulario, a `params.*`, a `queries.*` o a `item.*` siguen
   resolviéndose como hoy: si están `missing`, sigue siendo un error de build.
5. La omisión se aplica antes de la serialización del payload (JSON / query string / headers), de manera que la clave
   omitida nunca aparece en el wire format.

## Requisitos no funcionales

- No introducir resolución silenciosa global de referencias missing. La omisión está **acotada explícitamente** a
  referencias a campos ocultos del propio formulario.
- El form node debe poder calcular el conjunto de `fieldIds` ocultos en su snapshot del submit y comunicárselo al
  resolver. La capa de queries no debe inspeccionar el config del form por sí misma.
- No mutar el config en runtime; el body/query/headers originales del config no cambian, sólo la versión resuelta del
  request.

## Criterios de aceptación

1. Formulario con dos modos seleccionables por `radioGroup` (`searchType`), donde cada modo muestra un grupo distinto de
   campos. Al cargar la página en el modo por defecto y pulsar submit sin tocar nada:
   - La petición sale.
   - El body sólo contiene las claves correspondientes al modo activo.
   - Las claves correspondientes a los modos no activos no aparecen en el body.
2. Si el usuario cambia al otro modo, rellena sus campos y envía, el body contiene las claves de ese modo y omite las del
   modo previo.
3. Si una clave del body referencia un campo visible vacío (sin `required`), la clave viaja con `""` (comportamiento
   actual: no se considera oculto).
4. Si una clave del body referencia a `params.X` y `X` no existe en `params`, la build del request sigue fallando con
   `request-build-failed` (no se omite silenciosamente).
5. Si una clave del body referencia a un campo de **otro** formulario distinto al que dispara el submit, y está missing,
   sigue siendo error (no se omite silenciosamente).
6. Una referencia en `endpoint` a un campo oculto del form actual sigue siendo error de build (el path no se "salta"
   silenciosamente).
7. Para `body` JSON anidado: si `body.A.B` referencia a un campo oculto y `body.A.C` referencia a uno visible, el body
   resuelto es `{ A: { C: <valor> } }`. Si todas las claves bajo `A` están omitidas, `body.A` queda como `{}` (no se
   poda).

## Casos límite

- Form con todos los campos ocultos: body queda como `{}` (o `{ A: {} }` en anidados). Si la operación lo permite, se
  envía; si no, el backend responderá con un error que pasará por `onError` como cualquier otro error de red/negocio.
- Campo visible con valor `""`: NO se omite, viaja como `""`. La omisión es por visibilidad, no por valor.
- Campo oculto por `queryStateFeedback` (no por `visibility`): se trata igual que oculto por `visibility` (se omite) — la
  visibilidad efectiva es la misma a ojos del renderer.
- Body con interpolación (`"prefix-{{forms.x.fieldId}}"`): si la convención actual permite ese formato en
  body/query/headers, debe decidirse en design si la omisión aplica también ahí. La spec asume que sólo se omite cuando
  la clave entera **es** una referencia (no una interpolación de string). En caso de interpolación con un campo oculto,
  el comportamiento por defecto sigue siendo el actual (probablemente error o cadena con un marcador vacío). Esto debe
  cerrarse en `design.md`.
- Repeater: si un form vive dentro de un repeater y la referencia es `item.*`, no aplica esta feature (no es `forms.*`).

## Áreas afectadas

- `src/queries/runtime-api-payload-resolver.ts` y `src/queries/runtime-api-request.ts`: el resolver del payload necesita
  un canal nuevo de información ("estos `fieldIds` del form actual están ocultos") y la lógica para omitir esas claves.
- `src/runtime/nodes/form-layout-node.tsx` (`handleSubmit`): calcular el set de `fieldIds` ocultos en el snapshot del
  submit y pasarlo por `requestParams` (o un mecanismo equivalente) al `executeQueryOperation`.
- `src/runtime/runtime-state/runtime-state-provider.tsx`: posiblemente actualizar la firma de `executeQueryOperation` /
  `executeQueryOperationWithSnapshot` para propagar ese set hasta `buildRuntimeApiRequest`.
- Tipos en `src/queries/runtime-api-types.ts` para reflejar el nuevo parámetro.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/forms/lifecycle.md` sección "Campos ocultos": dejar explícito que un campo oculto no
  sólo se excluye de validación sino que tampoco aparece en el payload del request.
- `ai-workflow/docs/app-features/forms/validation-rules.md`: añadir una nota cruzada al comportamiento del payload (o
  enlazar desde aquí a la doc del runtime de queries si existe).
- Doc del runtime de queries / `executeOperation`: documentar que las referencias a campos ocultos del form que dispara
  un submit se omiten del payload.

## Riesgos o preguntas abiertas

1. **Backends que esperan siempre cierta key**: si una operación existente esperaba siempre `Descripcion` en el body
   aunque viniera vacía, ahora dejará de recibirla. Es un cambio observable. La hipótesis es que esto es lo que el config
   pretendía expresar (config con `visibility` por modo → backend recibe solo el modo activo). Hay que confirmar con los
   configs reales del proyecto que ninguno depende del comportamiento previo.
2. **Body con interpolación de strings**: el comportamiento exacto cuando la clave usa interpolación en lugar de
   referencia pura está sin cerrar — se decide en `design.md`.
3. **Operaciones fuera de submit**: por ahora se mantiene el comportamiento actual (error si missing). Si en el futuro
   se quiere extender la omisión a otros puntos, será otra feature.
