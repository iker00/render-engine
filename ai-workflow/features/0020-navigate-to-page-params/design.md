# Design: NavigateTo page params

## Contexto
La feature `0014` ya dejó una capa común de acciones UI con `navigateTo` y `goBack`, y `0010` ya convirtió la entrada de página en una unidad observable con `pageEntry`, `preloads` automáticos y semántica latest-only para su cierre agregado. También existe una capa central de referencias runtime que hoy soporta `forms.*` y `queries.*` en texto, requests, `defaultValue`, colecciones dinámicas y reglas de `visibility`.

Lo que todavía no existe es una forma estable de transportar datos junto a una entrada de navegación interna. Esa ausencia abre cuatro riesgos si se implementa sin diseño previo:
- ampliar `navigateTo` sin fijar cuándo se resuelven sus valores y contra qué snapshot del estado
- romper `goBack` o la semántica de reentrada al no persistir los params por entrada de historial
- abrir `params.*` como namespace soportado sin cerrar en qué superficies queda permitido y cuáles deben seguir rechazándolo en bootstrap
- duplicar la lógica entre navegación, `preloads`, resolución de referencias y formularios, dejando resultados distintos según el consumidor

## Objetivos / No objetivos

### Objetivos
- Ampliar `button.props.action.type: navigateTo` con un bloque opcional `params`.
- Resolver los valores efectivos de `params` en el momento real de navegar, usando la misma convención de referencias completas que ya usa el runtime.
- Persistir los params resueltos como parte de cada entrada de navegación para que `goBack` restaure la página y sus params asociados.
- Exponer `params.*` como namespace soportado de referencias runtime para texto, requests, `defaultValue` y futuras navegaciones originadas desde una página ya parametrizada.
- Mantener la semántica actual de `preloads`: una nueva entrada, aunque sea a la misma página, vuelve a disparar su tanda; una navegación idéntica a la entrada visible no duplica historial ni relanza nada.
- Mantener `params.*` fuera de superficies declarativas no incluidas en la spec, especialmente `visibility` y `list/select.props.items.source`.

### No objetivos
- Sincronizar params con la URL del navegador, query string, `history.pushState` o `routeParams`.
- Soportar objetos o arrays arbitrarios dentro de `navigateTo.params`.
- Añadir mutaciones parciales de params sin navegar de nuevo.
- Abrir `params.*` en `visibility`, en orígenes de colección de `list`/`select` o en un nuevo namespace general `navigation.*`.
- Introducir caché, deduplicación, comparación profunda de params o políticas nuevas de refetch.

## Decisiones

### 1. `navigateTo.params` usa un shape plano y escalar, coherente con `RuntimeConfigValue`
Cada acción `navigateTo` podrá declarar:

```ts
params?: Record<string, RuntimeConfigValue>
```

Reglas contractuales:
- `params` es opcional.
- si existe, debe ser un objeto plano
- cada clave debe ser no vacía
- cada valor debe ser un escalar JSON simple: `string | number | boolean | null`
- un string puede ser literal visible o una referencia runtime completa soportada en el momento de navegar

No se admiten objetos o arrays anidados dentro de `params`.

Razonamiento:
- la spec pide un conjunto pequeño y explícito de claves de negocio
- el runtime ya tiene semántica estable para escalares y strings con forma de referencia
- permitir árboles arbitrarios aquí aumentaría la complejidad de historial, comparación y diagnóstico sin ser necesario para los casos de edición previstos

### 2. Los params se resuelven al navegar contra un snapshot único del estado, no en bootstrap ni en render
La acción `navigateTo` seguirá siendo declarativa en el JSON, pero sus valores efectivos se resolverán en el handler de navegación usando el snapshot más reciente del runtime en el momento del click.

Semántica:
- strings literales se conservan como literales
- referencias soportadas que resuelven valor escalar o `null` se persisten ya resueltas
- referencias soportadas sin dato disponible no bloquean la navegación; la clave se omite del conjunto efectivo de params de esa entrada
- referencias que resuelvan objetos o arrays se degradan también a clave ausente, para no ampliar silenciosamente el contrato más allá de escalares

Razonamiento:
- el valor efectivo debe quedar congelado por entrada de historial y no depender de cambios posteriores en `forms.*`, `queries.*` o params de otra página
- omitir la clave ausente al navegar hace que `params.userId` degrade después como referencia missing en la página destino, que es exactamente la semántica ya usada por otros consumidores runtime

### 3. El historial de navegación deja de ser `string[]` y pasa a guardar entradas completas
La navegación ya no puede persistir solo `pageId`. Debe guardar cada entrada como una unidad completa:

```ts
interface RuntimeNavigationHistoryEntry {
  entryId: number
  pageId: string
  params: Record<string, RuntimeConfigValue>
}
```

`RuntimeNavigationState` conservará `currentPageId` por compatibilidad con selectors y consumidores actuales, pero `history` pasará a ser `RuntimeNavigationHistoryEntry[]`.

Semántica:
- la entrada inicial se crea con `entryId: 0`, `pageId: initialPage` y `params: {}`
- una navegación a otra página siempre crea una nueva entrada
- una navegación a la misma página con params efectivos distintos crea también una nueva entrada
- una navegación a la misma página con params efectivos equivalentes a la entrada visible sigue siendo un no-op observable: no duplica historial, no cambia `pageEntry` y no relanza `preloads`
- `goBack` elimina la última entrada y restaura íntegramente la anterior, incluidos sus params

Razonamiento:
- la spec exige distinguir entradas repetidas a la misma página con params distintos
- preservar `currentPageId` evita reescribir innecesariamente consumidores ya existentes
- mantener el no-op para la misma entrada visible conserva la compatibilidad con la semántica actual ya testeada de `navigateTo` hacia la propia página

### 4. `pageEntry` incorpora los params activos y pasa a reflejar la entrada visible completa
`pageEntry` ya representa la entrada activa a efectos de `preloads`. Debe ampliarse para incluir también los params efectivos:

```ts
interface RuntimePageEntryState {
  entryId: number
  pageId: string
  params: Record<string, RuntimeConfigValue>
  preloadNames: string[]
  status: 'idle' | 'loading' | 'success' | 'error'
}
```

Semántica:
- al activarse una nueva entrada, `pageEntry` debe actualizar `entryId`, `pageId`, `params` y `preloadNames` antes de cerrar la tanda
- `status` seguirá reflejando solo la orquestación agregada de `preloads`
- `goBack` restaura también `pageEntry.params` porque restaura una entrada histórica previa

Razonamiento:
- `pageEntry` ya es la unidad que dispara `preloads`
- incluir allí los params evita una segunda fuente de verdad para la entrada activa
- la tanda automática de `preloads` podrá depender de `entryId` y no solo de `currentPageId`, lo que permite reentradas a la misma página con params distintos

### 5. La orquestación automática de `preloads` debe observar `pageEntry.entryId`, no solo `navigation.currentPageId`
El provider ya no debe disparar la carga automática solo cuando cambia la página visible. Debe reaccionar a una nueva entrada activa.

Semántica:
- una navegación a la misma página con params distintos genera un nuevo `entryId` y vuelve a disparar `preloads`
- un `goBack` a una entrada previa también crea un cambio observable de entrada activa y relanza los `preloads` de esa entrada restaurada
- rerenders del provider o cambios internos de estado sin nueva entrada no relanzan la tanda

Razonamiento:
- la spec liga los `preloads` a la entrada de navegación, no solo al `pageId`
- observar `pageEntry.entryId` evita los falsos negativos del caso “misma página, params nuevos”

### 6. `params.*` pasa a ser un namespace soportado en la capa central de referencias, pero con allowlist de consumidores
`runtime-reference-parser.ts` y `runtime-reference-resolver.ts` deben dejar de tratar `params` como namespace reservado no soportado.

Nuevo contrato central:
- `params.{paramName}` es una referencia soportada
- no existe navegación anidada adicional bajo `params.*`
- `params.userId` es válido
- `params.user.id` es inválido
- `params` sin subruta es inválido

Resolución:
- el resolver leerá `pageEntry.params[paramName]`
- si la clave no existe, la referencia queda como missing

Allowlist funcional:
- permitido en `heading.props.text`
- permitido en `paragraph.props.text`
- permitido en `api.query`, `api.body`, `api.headers`
- permitido en `button.props.action.query`, `body`, `headers`
- permitido en `form.submitAction.query`, `body`, `headers`
- permitido en `defaultValue` de `input`, `textarea` y `select`
- permitido en `navigateTo.params` como origen de otra navegación
- no permitido en `visibility.reference`
- no permitido en `list.props.items.source`
- no permitido en `select.props.items.source`

Razonamiento:
- abrir `params.*` en el parser sin una frontera explícita permitiría reutilizarlo accidentalmente en superficies fuera de la spec
- mantener la restricción en `visibility` y orígenes de colección deja intacto el alcance de `0017` y `0019`

### 7. La validación previa al render añade una pasada semántica acotada para proteger la frontera de `params.*`
No hace falta convertir todos los strings del runtime en una gramática rígida nueva, pero sí hace falta rechazar de forma estable los casos donde `params.*` aparezca en superficies fuera de alcance o donde `navigateTo.params` tenga shape inválido.

La validación debe cubrir al menos:
- shape de `navigateTo.params`
- rechazo de `params.*` en `visibility.reference`
- rechazo de `params.*` en `list/select.props.items.source`
- rechazo de rutas inválidas como `params`, `params.user.id` o segmentos vacíos en cualquier superficie que ya use parseo explícito durante la validación semántica

No se añade una validación global nueva para cada string literal del runtime. Los consumidores que ya admiten strings literales o referencias completas seguirán distinguiéndolos en runtime con la misma convención central.

Razonamiento:
- esto satisface el criterio de aceptación sin sobrediseñar un compilador completo de referencias
- aprovecha las superficies que ya tienen validación semántica propia y añade solo la frontera necesaria para `params.*`

## Riesgos y trade-offs
- Riesgo: tratar params como datos vivos y no como snapshot congelado.
  Mitigación: resolver al navegar y persistir solo el valor efectivo escalar dentro de la entrada histórica.

- Riesgo: duplicar la fuente de verdad entre navegación y `pageEntry`.
  Mitigación: `history` guarda el histórico completo y `pageEntry` refleja únicamente la entrada activa más reciente y su tanda agregada.

- Riesgo: romper compatibilidad con la navegación actual a la misma página.
  Mitigación: mantener el no-op cuando `pageId` y params efectivos coinciden exactamente con la entrada visible.

- Riesgo: permitir `params.*` en consumidores fuera de la spec al convertirlo en namespace soportado.
  Mitigación: cerrar la frontera con validación semántica explícita en `visibility` y en orígenes dinámicos de colección.

- Riesgo: que `navigateTo.params` acepte valores no escalares y luego no puedan compararse o proyectarse de forma estable en texto, query o `defaultValue`.
  Mitigación: limitar contractualmente la carga útil a escalares JSON simples.

## Migración o despliegue
No hay migración persistida ni despliegue especial.

Compatibilidad:
- configuraciones existentes con `navigateTo` sin `params` siguen siendo válidas y mantienen comportamiento
- la entrada inicial sigue arrancando con params ausentes, representados como objeto vacío interno
- `goBack` conserva su semántica actual cuando el historial previo no tiene params explícitos, porque esas entradas tendrán `params: {}`

## Preguntas abiertas
- No quedan preguntas abiertas que bloqueen implementación dentro del alcance actual.
- Si en el futuro se quisiera usar `params.*` en `visibility` o en fuentes de colección, eso debe abrirse como feature nueva porque cambiaría la frontera funcional acordada aquí.
