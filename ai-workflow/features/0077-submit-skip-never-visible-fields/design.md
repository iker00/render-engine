# Design: Feature 0077 — Submit omite referencias a campos ocultos en el wire format

## Contexto

El runtime construye los requests HTTP en `src/queries/` a partir de un `RuntimeApiOperation` declarado y,
opcionalmente, de `requestParams` aportados por el caller (`query`, `body`, `headers`, `files`). El pipeline relevante
hoy es:

- `form-layout-node.handleSubmit` valida campos visibles y, si pasa la validación, invoca `executeQueryOperation` con
  `requestParams` (query/body/headers del `submitAction`) más un `snapshotState` y el `iterationContext` del repeater si
  aplica.
- `executeQueryOperation` (en `runtime-state-provider.tsx`) delega en `executeQueryOperationWithSnapshot`, que llama a
  `buildRuntimeApiRequest`.
- `buildRuntimeApiRequest` fusiona `operation` y `requestParams` y construye en orden: `endpoint` → `query` → `body` →
  `headers`. Cada uno usa `resolvePayloadValue` (`src/queries/runtime-api-payload-resolver.ts`), que invoca
  `resolveRuntimeReference` (`src/runtime/runtime-references/`).
- `resolveRuntimeReference` devuelve `RuntimeReferenceResolutionResult` con
  `status: 'literal' | 'resolved' | 'missing' | 'unsupported' | 'invalid'`. En `missing`, el resultado expone la
  referencia parseada con `namespace`, `path` y `source`.
- Hoy, `resolvePayloadValue` solo acepta `literal` y `resolved`; cualquier otro status se traduce a `status: 'error'`,
  que `resolveBody`/`resolveQuery`/`resolveHeaders` propagan como `request-build-failed`.

El bug es consecuencia directa de esta política: una referencia a `forms.{formId}.{fieldId}` cuyo campo está oculto
desde la carga inicial nunca llega a `forms.*`, lo que devuelve `missing` y aborta el request antes de hacer `fetch`. La
validación local (feature 0036) ya excluye correctamente los campos ocultos; el problema vive exclusivamente en la capa
de construcción del request.

El renderer y la validación reutilizan `isLayoutNodeVisible` (`src/runtime/runtime-layout-visibility.ts`), que combina
`queryStateFeedback` y `visibility`. El `submit` también puede ocurrir dentro de un `repeater`, así que la visibilidad
efectiva depende del `iterationContext` activo.

Las superficies `form.submitAction.query`, `form.submitAction.body` y `form.submitAction.headers` están explícitamente
fuera del catálogo de interpolación parcial (ver `app-features/references/dynamic-strings.md`): solo admiten literales o
referencias completas. Esto cierra la pregunta abierta de la spec sobre `"prefix-{{forms.x.fieldId}}"`.

## Objetivos / No objetivos

### Objetivos

- Omitir del wire format (`body`, `query`, `headers`) las claves cuyo único valor sea una referencia completa a un campo
  del **propio formulario** que está oculto por `visibility` o `queryStateFeedback` en el snapshot del submit.
- Mantener intactas las semánticas existentes para cualquier otra referencia (`params.*`, `queries.*`, `item.*`,
  `forms.*` de otro formulario, `translations.*`): si están `missing`, sigue siendo error de build.
- Mantener intacto el comportamiento de `endpoint`: una referencia a un campo oculto sigue siendo
  `request-build-failed`.
- Reutilizar la misma utilidad de visibilidad que el renderer y la validación; no duplicar lógica.
- Limitar el cambio observable al pipeline disparado por `submitAction` de un `form`; el resto de invocaciones de
  `executeQueryOperation` (botones, preloads, file-manager) conserva su semántica actual.

### No objetivos

- No introducir omisión silenciosa global cuando una referencia esté `missing`.
- No cambiar el contrato JSON del config (`api`, `submitAction`, nodos de formulario).
- No modificar la política lazy de inicialización del store de formularios.
- No tocar validación local ni mensajes inline.
- No podar contenedores vacíos en `body` JSON anidado.
- No procesar interpolación `{{...}}` en `submitAction.body/query/headers` (siguen fuera del catálogo).
- No ampliar el comportamiento a referencias dentro de arrays de `body` (los arrays no tienen "claves a omitir"; ver más
  abajo).
- No extender la omisión a otros puntos del runtime (preloads, acciones manuales). Es otra feature si se quisiera.

## Decisiones

### D1 — Canal de propagación: parámetro nuevo en las opciones de build/ejecución, fuera de `RuntimeApiRequestParams`

Se introduce un parámetro opcional `hiddenFormFields` en las firmas:

- `BuildRuntimeApiRequestOptions` y `BuildInlineRuntimeApiRequestOptions` (`src/queries/runtime-api-types.ts`).
- Options de `executeQueryOperation` y `executeQueryOperationWithSnapshot` (
  `src/runtime/runtime-state/runtime-state-provider.tsx`).

Tipo nuevo en `src/queries/runtime-api-types.ts`:

```ts
export interface RuntimeApiHiddenFormFields {
    formId: string
    fieldIds: ReadonlySet<string>
}
```

`buildRuntimeApiRequest` propaga este objeto al pipeline de resolución como un campo más del contexto de resolución,
junto a `state` e `iterationContext`.

**Por qué no usar `RuntimeApiRequestParams`**: ese tipo es parte del contrato declarativo del config (`query`, `body`,
`headers`, `files`); meter dentro un descriptor de "estado de formulario" rompe la frontera entre `src/config/` y
`src/runtime/`, y abriría la puerta a que cualquier caller declarase manualmente "formId/fieldIds hidden", lo cual no es
el contrato.

**Por qué no preprocesar el body/query/headers en `form-layout-node`**: forzaría al nodo a reimplementar el parseo de
referencias (`namespace`, `path`) y a recorrer la estructura JSON anidada del body — duplicación con el resolver y
violación de la frontera arquitectónica "la resolución de referencias vive en `runtime-references/`".

### D2 — Punto de omisión: nuevo terminal `'omit'` dentro del resolver de payload

`resolvePayloadValue` y `resolveJsonPayloadValue` pasan a devolver un union de tres terminales:

- `{ status: 'ready', value }` — sin cambios.
- `{ status: 'omit' }` — nuevo. Se devuelve cuando `resolveRuntimeReference` devuelve `status: 'missing'`, la referencia
  es `namespace: 'forms'`, `path.length === 2`, `path[0]` coincide con `hiddenFormFields.formId` y
  `path[1] ∈ hiddenFormFields.fieldIds`.
- `{ status: 'error' }` — sin cambios para cualquier otro caso (incluido `missing` de `params.*`, `queries.*`, `item.*`,
  o `forms.{otroForm}.*`).

Si `hiddenFormFields` no se pasa, ese terminal nunca se devuelve y el comportamiento es idéntico al actual.

Los callers (`resolveQuery`, `resolveBody`/`resolveJsonPayloadValue`, `resolveHeaders`) interpretan `'omit'` como "no
incluir esta clave en la estructura resultado".

**Por qué un terminal en lugar de un side channel**: mantiene el flujo funcional y atómico por valor; cada caller decide
cómo materializar la omisión en su propia estructura (objeto plano para query/headers, recursión por objeto JSON anidado
para body).

### D3 — Reglas de omisión por superficie

- **`query`**: si una clave resuelve a `'omit'`, se excluye del `RuntimeApiQuery` resultante.
- **`headers`**: si una clave resuelve a `'omit'`, se excluye del `RuntimeApiHeaders` resultante.
- **`body` JSON anidado**:
    - En un objeto plano, una clave con valor `'omit'` se excluye del objeto resultante.
    - Los objetos contenedores que queden vacíos tras la omisión se conservan tal cual (`{ A: {} }`), no se podan. Es
      decisión funcional explícita de la spec.
    - En arrays, una entrada con valor `'omit'` se trata como **error de build** (`request-build-failed`), no como
      omisión. Razón: un array no tiene "clave" que omitir; cambiar la longitud o el índice del array silenciosamente
      cambiaría el contrato del backend de forma menos predecible que un error claro. Caso muy improbable en configs
      reales y, si aparece, es revisable a través del mensaje de error.

### D4 — `endpoint` no participa en la omisión

`resolveEndpoint` mantiene el comportamiento actual y nunca recibe el `hiddenFormFields` ni cambia su lógica. Una
referencia en el template a un campo oculto del form actual sigue devolviendo `request-build-failed`. Razón: el path es
estructura, no payload; la omisión silenciosa rompería la URL.

### D5 — Cálculo del set de campos ocultos en `form-layout-node`

En `handleSubmit`, justo después de calcular `visibleFieldDefinitions` y antes de invocar `executeQueryOperation`, se
deriva:

```ts
const visibleFieldIds = new Set(visibleFieldDefinitions.map((f) => f.fieldId))
const hiddenFieldIds = new Set(
    latestFieldDefinitions
        .map((f) => f.fieldId)
        .filter((id) => !visibleFieldIds.has(id))
)
```

Se construye sobre el mismo `snapshotState` y el mismo `iterationContext` que ya usa la validación, así que la
visibilidad efectiva es la misma a ojos del renderer (incluye `queryStateFeedback`).

El set se pasa como `hiddenFormFields: { formId: node.id, fieldIds: hiddenFieldIds }` a las dos ramas del submit:

- `submitAction.type === 'executeOperation'`: en la única llamada a `executeQueryOperation`.
- `submitAction.type === 'executeOperations'`: en cada llamada del `Promise.all`. Todas comparten el mismo set; no se
  recalcula por entrada.

**Por qué pasar el set y no la lista**: en el resolver se hacen lookups O(1) por `fieldId`; un `Set` es la estructura
natural.

### D6 — Reuso estricto de utilidades existentes

- Visibilidad: `isLayoutNodeVisible` de `src/runtime/runtime-layout-visibility.ts` (ya usado por validación y renderer).
- Parseo de referencias: `resolveRuntimeReference` ya devuelve el `RuntimeSupportedReference` parseado en
  `result.reference` con `namespace` y `path`. El resolver puede inspeccionarlo sin reabrir el parser.

### D7 — Alcance acotado al submit del propio formulario

`hiddenFormFields` se pasa **solo** desde `form-layout-node.handleSubmit`. Cualquier otro caller de
`executeQueryOperation` (file-manager, botones, navegación, preloads) sigue sin pasar el parámetro y el resolver se
comporta exactamente como hoy. Esto cumple la spec: la omisión no es global ni opt-in por config.

### D8 — Comportamiento ante referencias parciales o no escalares

`forms.{formId}.{fieldId}` siempre tiene exactamente dos segmentos en el `path`. Si por configuración apareciera algo
como `forms.{formId}.{fieldId}.x` (rara vez válido, depende del parser), la condición `path.length === 2` lo descartaría
y caería en la rama de error como hoy. Si en el futuro se añaden referencias `forms.*.*.*` válidas, esta rama necesitará
revisarse, pero hoy no aplica.

## Riesgos y trade-offs

- **Cambio observable de wire format**: cualquier config que confiase implícitamente en recibir siempre cierta clave en
  `body`/`query`/`headers` (aunque el campo estuviera oculto) deja de hacerlo. La hipótesis funcional de la feature es
  que esto es lo deseado. Mitigación: la spec lo declara explícitamente; los configs reales del proyecto deberían
  revisarse al validar la implementación.
- **Acoplamiento controlado entre form y queries**: la firma de `executeQueryOperation` gana un parámetro opcional
  acoplado al concepto de formulario. Trade-off aceptado: el alternativo (preprocesar en el nodo) duplicaría parser de
  referencias y violaría la frontera arquitectónica.
- **Riesgo cero para callers no-submit**: al ser parámetro opcional y solo enviado desde `handleSubmit`, los demás
  callers no cambian.
- **Casos límite con arrays en body**: se traduce a error de build, no a omisión. Aunque divergente con la regla "
  objetos", la decisión es defensiva y observable (mensaje claro). Si en el futuro alguien necesita semántica de omisión
  dentro de arrays, será otra feature.
- **`body` totalmente vacío tras omisión**: el resolver devuelve `{}` (o `{ A: {} }`), y el request se envía igualmente.
  El backend decide si lo acepta. No es necesario poda ni error preventivo.

## Migración o despliegue

No aplica migración técnica. Es un cambio de comportamiento del runtime, sin contrato de config alterado y sin estado
persistente que reformatear.

Se recomienda durante la implementación revisar manualmente los configs de `src/dev/` que disparen `submitAction` con
campos condicionados por `visibility` para validar que la nueva semántica es la esperada.

## Preguntas abiertas

Ninguna bloqueante. La interpolación parcial en `submitAction.*` quedó cerrada por la documentación funcional (no
aplica); el resto de decisiones técnicas están resueltas explícitamente arriba.
