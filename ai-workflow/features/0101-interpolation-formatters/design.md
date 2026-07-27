# Design: Feature 0101 - interpolation-formatters

## Contexto

La interpolación `{{...}}` vive hoy en dos capas simétricas:

- `src/runtime/runtime-references/runtime-reference-resolver.ts`: exporta `RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN` y
  `resolveRuntimeInterpolatedVisibleValue`, que recorre cada placeholder de una string visible, llama a
  `resolveRuntimeReference(trim(rawReference))` y sustituye el placeholder por `normalizeRuntimeTextValue(result.value)`.
  Cualquier fallo (`literal | missing | unsupported | invalid | token-error`) produce string vacío para ese
  placeholder concreto.
- `src/queries/runtime-api-payload-resolver.ts::resolveHeaderTemplateValue` y
  `src/queries/runtime-api-request.ts::resolveEndpoint`: reutilizan el mismo regex para recorrer placeholders en
  valores de header y en `api.endpoint`, con la diferencia de que un placeholder no resoluble (o de valor no
  serializable) marca `failed = true` y la operación termina con `code: request-build-failed`.

El parser central `parseRuntimeReference` (`runtime-reference-parser.ts`) recibe hoy exclusivamente el contenido
plano de un placeholder (`"queries.total"`), sin conocer la sintaxis `|`. Su regex `REFERENCE_PATTERN` rechaza
cualquier caracter fuera de `[A-Za-z0-9_.-]`, por lo que un `"queries.total | number"` actual se clasifica como
`literal` y todo el placeholder degrada a string vacío en visible / a `request-build-failed` en header —
comportamiento a preservar mientras la feature no esté implementada, pero que debe evolucionar de forma
predecible cuando el placeholder incluya `|`.

`hasRuntimeTemplateDelimiter` se usa desde `src/config/validate-actions-visibility.ts` y
`src/config/validate-layout-nodes.ts` para rechazar `{{...}}` en superficies que **no** admiten interpolación
parcial (`visibility.reference`, `defaultValue`, etc.). Esa frontera no cambia con esta feature.

La spec ya cerró: catálogo v1 (8 formatters), gramática de argumento único opcional (string entre `"..."` o
número), semántica de cadena no resoluble reutilizando el contrato de fallo por superficie, locale fijo `es-ES`,
compatibilidad hacia atrás total para placeholders sin `|`.

## Objetivos / No objetivos

### Objetivos
- Definir dónde vive el parser de la cadena `referencia | formatter1 | formatter2 …` y por qué no dentro de
  `parseRuntimeReference`.
- Fijar la forma del catálogo cerrado de formatters y su unidad de reutilización entre capa visible y capa de
  headers.
- Fijar el modelo de resultado de la cadena de formatters (`ok` / `unresolvable`) y cómo cada superficie lo
  proyecta sobre su semántica de fallo ya existente.
- Cerrar decisiones de implementación de los formatters (`Intl` cacheado, tokenización manual de fechas,
  interpretación de fechas ISO date-only) que si no se cierran ahora se resolverán en silencio y de forma
  divergente durante la implementación.
- Acotar el impacto real en código fuera de `runtime-references/` y de las dos capas de resolución de
  placeholders.

### No objetivos
- No se diseña el troceo en tareas (pertenece a `generate-implementation-plan`).
- No se abre alcance funcional nuevo respecto a `spec.md` (catálogo, gramática, semántica de fallo por superficie
  y locale fijo ya cerrados).
- No se rediseña la fase 1 del parser (`parseRuntimeReference`) para las superficies de referencia completa: esas
  siguen consumiendo strings sin `|`.
- No se introduce validación de bootstrap que rechace formatters desconocidos o argumentos mal formados: la
  degradación en runtime por superficie ya lo cubre y meter otra puerta rompería la simetría con el resto de
  placeholders no resolubles.

## Decisiones

### D1 — Módulo dedicado `runtime-formatter-*` bajo `runtime-references/`

Se introducen dos módulos nuevos dentro de `src/runtime/runtime-references/`:

- `runtime-formatter-parser.ts`: parsea el contenido crudo de un placeholder (todo lo que hay entre `{{` y `}}`,
  ya trimmed en la capa que llama) en `{ reference: string, formatters: RuntimeFormatterInvocation[] }`. Expone
  también `hasFormatterSyntax(rawPlaceholderContent)` como fast-path para saltarse el resto del pipeline cuando
  no hay `|` de nivel superior.
- `runtime-formatter-registry.ts`: define el catálogo cerrado v1, expone `applyFormatterChain(value, invocations)`
  y encapsula las instancias de `Intl.NumberFormat` cacheadas (D8). El formatter `date` no usa `Intl.DateTimeFormat`
  porque tokeniza el patrón manualmente (D7).

No se introduce un tercer módulo `runtime-formatter-resolver.ts`. La composición parse + resolve + apply vive en
línea en las tres capas de resolución de placeholders (D5).

Alternativa descartada: extender `parseRuntimeReference` para que admita `|`. Se descarta porque `parseRuntimeReference`
se invoca hoy desde superficies de referencia completa (`resolvePayloadValue`, `runtime-reference-namespace-guards.ts`,
`validate-actions-visibility.ts`, `validate-layout-nodes.ts`, `validate-form-nodes.ts`) donde la sintaxis `|` no
tiene sentido y debe seguir siendo un literal invalidante. Mezclar responsabilidades ampliaría el radio de
regresión de cada nuevo formatter y difuminaría la frontera entre "referencia" y "transformación sobre valor
resuelto".

Alternativa también descartada: colocar el parser y el registro en `src/runtime/runtime-formatting/` como módulo
paralelo. Se descarta porque los formatters solo tienen sentido dentro de placeholders `{{...}}`, viven por
tanto en la misma frontera semántica que `runtime-reference-resolver.ts`, y colocarlos juntos hace explícita
esa dependencia sin abrir una capa nueva sin más contenido.

### D2 — Tokenización manual de la cadena de formatters

`runtime-formatter-parser.ts` no usa un regex único sobre todo el placeholder. Recorre el string una vez con un
cursor de caracteres, respetando strings entre comillas dobles al partir por `|` y al partir `nombre:arg`. La
razón concreta es que un argumento de string puede contener `|` (`{{x | truncate:"a|b"}}` ya sería un caso
razonable) y un regex ingenuo `split('|')` lo rompería. Un tokenizador de una pasada:

1. lee el segmento antes del primer `|` de nivel superior → `reference` (bruta, aún con espacios que se trim al
   final);
2. para cada segmento posterior, lee `name` (identificador `[a-zA-Z]+`) y opcionalmente `:` seguido de un
   `string` entre `"..."` o un `number` (con signo y decimales opcionales, sin coma decimal para no chocar con
   locales);
3. cualquier desviación de esa gramática produce `{ status: 'unresolvable-chain' }` inmediatamente, sin ejecutar
   ningún formatter. Ejemplos que caen aquí: `formatter:` sin argumento (spec), `number:"dos"` (número
   requerido, spec), corchete o carácter extraño (`{{x | foo(1)}}`), string sin cerrar (`{{x | truncate:"ab}}`).

`hasFormatterSyntax(rawPlaceholder)`: comprueba si existe un `|` fuera de una string entre comillas. Si no lo
hay, la capa que llama sigue el camino actual (`resolveRuntimeReference` sobre el placeholder trimmed) sin pasar
por el parser de formatters. Esto preserva rendimiento y comportamiento exacto para placeholders sin `|`
(requisito no funcional de la spec).

Alternativa descartada: `String.prototype.split('|')` + parseo post-hoc de cada tramo. Se descarta porque no
admite escapado ni strings con `|` dentro, y "no soportar `|` dentro de strings" sería una restricción no
descrita en la spec que abriría un modo de fallo silencioso.

### D3 — Tipos públicos

En `runtime-formatter-parser.ts`:

```ts
export type RuntimeFormatterArgument =
  | { kind: 'none' }
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }

export interface RuntimeFormatterInvocation {
  name: string
  argument: RuntimeFormatterArgument
}

export type RuntimeFormatterParseResult =
  | { status: 'no-formatters'; reference: string }
  | { status: 'ok'; reference: string; formatters: RuntimeFormatterInvocation[] }
  | { status: 'unresolvable-chain' }
```

`status: 'no-formatters'` distingue explícitamente el caso "no hay `|`" del caso "hay `|` y todos los tramos
parsean". Permite a la capa de resolución saltarse `applyFormatterChain` cuando no hay nada que aplicar sin
introducir un bucle vacío ni un check redundante sobre `formatters.length === 0`.

En `runtime-formatter-registry.ts`:

```ts
export type RuntimeFormatterChainResult =
  | { status: 'ok'; value: string | number | boolean }
  | { status: 'unresolvable' }

export function applyFormatterChain(
  input: unknown,
  invocations: readonly RuntimeFormatterInvocation[],
): RuntimeFormatterChainResult
```

El valor devuelto sigue tipado como `string | number | boolean` (nunca objeto/array/null) porque la spec obliga
a que los formatters produzcan escalares serializables. `applyFormatterChain` no conoce la superficie: solo
devuelve `ok` o `unresolvable`. La proyección a "string vacío" vs "request-build-failed" se hace en la capa
llamante (D5).

### D4 — Catálogo como registro cerrado con contrato uniforme

`runtime-formatter-registry.ts` expone un mapa `Record<RuntimeFormatterName, RuntimeFormatterEntry>` donde
`RuntimeFormatterName` es la unión literal `'number' | 'currency' | 'date' | 'percent' | 'uppercase' | 'lowercase' | 'capitalize' | 'truncate'`.
Cada entrada:

```ts
interface RuntimeFormatterEntry {
  argument: 'none' | 'string' | 'number' | 'optional-number' | 'optional-string'
  apply(value: unknown, argument: RuntimeFormatterArgument): { status: 'ok'; value: string | number | boolean } | { status: 'unresolvable' }
}
```

`argument` describe la gramática esperada del argumento (traducida a "hay/no hay argumento" y "de qué tipo"). El
validador de argumento vive **en el registro**, no en el parser, para que el parser no tenga que conocer el
catálogo. El parser solo garantiza que el argumento, si existe, es sintácticamente `string` o `number`; el
registro rechaza combinaciones inválidas (por ejemplo `uppercase:"foo"`, argumento cuando no lo admite;
`number:"dos"` ya lo rechaza el parser en D2 por gramática de tipo).

`applyFormatterChain` itera de izquierda a derecha, llamando `entry.apply(currentValue, invocation.argument)`.
Cualquier `status: 'unresolvable'` de una etapa aborta la cadena y devuelve `unresolvable` global. No hay retry
ni recuperación silenciosa.

Alternativa descartada: registrar cada formatter con su función suelta sin describir su gramática de argumento
en la entrada. Se descarta porque forzaría a cada `apply` a repetir el mismo patrón de "si es texto pero
esperaba número → unresolvable", generando divergencia entre formatters y ocultando la parte del contrato que
solo tiene sentido leer de un vistazo.

### D5 — Reutilización entre capa visible y capa de headers

`resolveRuntimeInterpolatedVisibleValue` (`runtime-reference-resolver.ts`), `resolveHeaderTemplateValue`
(`runtime-api-payload-resolver.ts`) y `resolveEndpoint` (`runtime-api-request.ts`) mantienen su lógica de fallo
por superficie tal cual: visible → string vacío para ese placeholder; header → `failed = true` con lógica de
omisión por campo oculto; endpoint → `failed = true` (ver D6).

La reutilización se hace por dos primitivas pequeñas expuestas desde el nuevo módulo:

- `parseFormatterPlaceholder(rawPlaceholderContent) → RuntimeFormatterParseResult` en `runtime-formatter-parser.ts`
- `applyFormatterChain(value, invocations) → RuntimeFormatterChainResult` en `runtime-formatter-registry.ts`

Cada capa compone en línea estas dos primitivas con `resolveRuntimeReference` (código existente, sin cambios)
según su semántica de fallo y su lógica de omisión. La composición típica dentro del `.replace` sobre
`RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN` es:

1. `hasFormatterSyntax(rawReference)` → si `false`, camino actual sin cambios (llamada directa a
   `resolveRuntimeReference` + serialización actual). Esto preserva rendimiento y comportamiento exacto para
   placeholders sin `|` (requisito no funcional de la spec).
2. `parseFormatterPlaceholder(rawReference)` → `unresolvable-chain` proyecta al modo de fallo de la superficie
   (empty string / `failed = true`) sin llegar a resolver la referencia.
3. `resolveRuntimeReference(reference, state, options)` → los estados no `resolved` (`literal | invalid |
   unsupported | missing | token-error`) proyectan al modo de fallo de la superficie con las mismas reglas que
   hoy (incluida la omisión por `hiddenFormFields` en la capa de headers).
4. Si la referencia resolvió y el parseo fue `ok`, `applyFormatterChain(resolvedValue, formatters)`. Un
   `unresolvable` proyecta al modo de fallo de la superficie.
5. Serialización final: `normalizeRuntimeTextValue` en la capa visible; coerción `string | number | boolean → String`
   en las capas de request. En la capa de headers, la omisión por campo oculto se aplica **antes** que la
   aplicación de la cadena y sigue consultando el shape resuelto de la referencia (`namespace === 'forms'`,
   `path.length === 2`, etc.), no el valor formateado. Esto preserva la simetría con el comportamiento actual
   documentado en [[0079-header-interpolation]].

La duplicación de "componer parse + resolve + apply" en tres sitios es controlada (≤ 20 líneas cada una) y
mantiene la frontera actual entre `src/runtime/` y `src/queries/`: `runtime-references/` no conoce
`hiddenFormFields` ni `request-build-failed`; las capas de request no conocen `normalizeRuntimeTextValue`.

Alternativa descartada: introducir una función auxiliar `resolveInterpolatedPlaceholder(rawPlaceholderContent,
state, options) → { status: 'ok' | 'unresolvable' | 'token-error'; value?: string }` que encapsulase parse +
resolve + apply. Se descarta porque la capa de headers debe insertar su comprobación de omisión por campo oculto
entre la resolución de la referencia y la aplicación de la cadena, y esa comprobación mira el shape resuelto de
la referencia (`namespace`, `path`); ocultar la resolución dentro del auxiliar obligaría a exponer también el
`RuntimeReferenceResolutionResult`, con lo que el auxiliar deja de ser un simplificador y se convierte en un
adaptador que solo sirve a una superficie. La composición inline es más simple y explícita.

Alternativa también descartada: mover la lógica de omisión por campo oculto a `runtime-references/`. Se descarta
porque es semántica del contrato de request, no de referencias, y meterla ahí rompería la frontera actual entre
`src/runtime/` y `src/queries/`.

### D6 — `api.endpoint` mantiene su semántica de fallo

`api.endpoint` aparece en el catálogo de `dynamic-strings.md` como superficie con interpolación parcial, pero
su semántica de fallo por placeholder no resoluble es `request-build-failed` (ver `resolveEndpoint` en
`runtime-api-request.ts`), no string vacío. La spec dice "reutiliza el mismo contrato de degradación que ya
tiene cada familia de superficie".

Decisión: los formatters aplicados dentro de `api.endpoint` heredan la semántica de fallo de esa superficie:
cadena no resoluble → `code: request-build-failed`, sin emitir red. `resolveEndpoint` pasa por el mismo par de
primitivas (parse + apply) que `resolveHeaderTemplateValue`. No se abre un tercer bucket "endpoint".

Trade-off aceptado: la spec agrupa las superficies solo en "visibles" y "headers"; en la realidad hay al menos
una tercera (`api.endpoint`) con semántica de fallo tipo header. El design lo hace explícito para que la
implementación no lo resuelva en silencio.

### D7 — Interpretación de fechas ISO date-only

`date` acepta según spec strings ISO 8601 de fecha u hora. Un input date-only (`"2026-07-16"`) parseado con
`new Date(...)` fija medianoche UTC; formatearlo con getters locales puede desplazar el día para zonas horarias
con offset negativo (por ejemplo `Date.getDate()` en `America/Los_Angeles` devuelve `15` en vez de `16`).

Decisión: `date` distingue por el shape del input:

- si el input matchea `/^\d{4}-\d{2}-\d{2}$/` (date-only), se parsea a `Date` y se formatea con getters **UTC**
  (`getUTCDate`, `getUTCMonth`, `getUTCFullYear`, `getUTCHours` = `0`, etc.);
- si el input matchea shape date-time ISO (con `T` y opcionalmente offset), se parsea a `Date` y se formatea
  con getters locales. Esto respeta el offset embebido y produce la hora local esperada;
- cualquier otro shape que no parsee a `Date` válida → `unresolvable`.

Los tokens (`dd`, `MM`, `yyyy`, `HH`, `mm`, `ss`) se sustituyen manualmente en la string de patrón; no se usa
`Intl.DateTimeFormat` para ellos porque el patrón exacto está en el argumento y `Intl` no admite tokenización
personalizada portable. Los tokens fuera del catálogo se dejan literales (la spec fija el catálogo cerrado, no
un modo de fallo por token desconocido; el trade-off es que un patrón con `"YYYY"` (mayúscula) no genera un
error sino que aparece literal — esto es coherente con el resto de la spec, donde solo la ausencia de patrón o
un input no ISO producen `unresolvable`).

Alternativa descartada: usar exclusivamente `Intl.DateTimeFormat` con opciones. Se descarta porque el catálogo
v1 requiere control exacto sobre los tokens `dd/MM/yyyy HH:mm:ss` y `Intl` no expone tokenización personalizada
sin librerías adicionales, contradiciendo el requisito no funcional "no se introduce una librería de formateo
de fechas adicional".

### D8 — Instancias `Intl` cacheadas a nivel de módulo

`number`, `currency` y `percent` usan `Intl.NumberFormat('es-ES', options)`. Crear la instancia en cada llamada
es medible (perceptible en listas con centenares de placeholders). Se cachea en `runtime-formatter-registry.ts`
un `Map<string, Intl.NumberFormat>` por combinación de opciones (`decimals`, `currency`) y una instancia base
sin opciones para `number` / `percent:0`. Clave del cache: string estable construida a partir de las opciones
(por ejemplo `"num:2"`, `"cur:USD"`, `"pct:1"`).

Trade-off aceptado: crecimiento del cache proporcional al número de combinaciones distintas de argumento
usadas por la config. Los formatters solo admiten un argumento y su rango realista es pequeño (unos pocos
enteros para decimales, unos pocos códigos ISO 4217 para currency), así que el cache no crece de forma
patológica. No se introduce política de expiración.

### D9 — Compatibilidad de valor de entrada por formatter

Reflejo del apartado "Compatibilidad de valor de entrada" de la spec, formalizado como reglas concretas por
formatter, para dejar cerrada la interpretación en implementación:

- `number | currency | percent`: aceptan `number` finito, o `string` que matchee `/^-?\d+(\.\d+)?$/` (parseable
  a `Number` sin ambigüedad). `NaN`, `Infinity`, string vacío o strings con separador de miles / coma decimal /
  espacios → `unresolvable`. Esto evita depender de `Number(input)`, que acepta `""`, `"   "`, `null` y
  hexadecimales.
- `date`: solo strings; regex de shape ISO (date-only o date-time con `T`) + `Date` válido tras `new Date(input)`
  (chequeo `!Number.isNaN(date.getTime())`). El shape se comprueba antes del `new Date` porque `new Date("ana")`
  puede devolver `Invalid Date` en algunos runtimes o parsear parcialmente en otros.
- `uppercase | lowercase | capitalize | truncate`: aceptan `string`, `number` finito, `boolean`. Coerción a
  string con la misma regla que `normalizeRuntimeTextValue` (`String(value)`). `null`, `undefined`, `NaN`,
  `Infinity`, objetos, arrays → `unresolvable`.

`truncate:0` con texto no vacío produce `"…"` según la spec: coste asumido para respetar literal el criterio
de aceptación.

### D10 — Diagnóstico DEV

`reportRuntimeReferenceDiagnostic` sigue emitiendo su `console.warn` actual cuando la propia referencia no
resuelve. Cuando la cadena de formatters es la que no resuelve (referencia sí resolvió pero un formatter la
degradó), se emite un `console.warn` análogo desde una nueva función `reportRuntimeFormatterChainDiagnostic`
añadida a `runtime-reference-diagnostics.ts`. Formato consistente: `[runtime-formatters] Chain unresolvable for
"{{...}}" (formatter: name).`. Solo en DEV (`import.meta.env.DEV`), sin coste en producción. La función se llama
desde las tres capas de resolución de placeholders (`runtime-reference-resolver.ts`,
`runtime-api-payload-resolver.ts`, `runtime-api-request.ts`) en el punto donde `applyFormatterChain` devuelve
`unresolvable`. No se introduce una nueva superficie de diagnóstico ni se cambia el contrato del diagnóstico
existente sobre referencias.

Alternativa descartada: alojar el emisor en un módulo nuevo `runtime-formatter-diagnostics.ts`. Se descarta
porque `runtime-reference-diagnostics.ts` ya es el hogar semántico de los `console.warn` DEV asociados a la
resolución de placeholders, y separar por sub-tema abre una micro-carpeta de diagnósticos sin masa crítica.

Alternativa descartada: extender `RuntimeReferenceResolutionResult` con un nuevo status `formatter-unresolvable`.
Se descarta porque contamina un tipo que hoy solo describe resolución de referencia, y porque la capa que
proyecta a "empty string vs request-build-failed" ya tiene toda la información que necesita en el resultado
booleano de la cadena.

## Riesgos y trade-offs

- **La lógica de omisión por campo oculto en headers depende del shape actual de `RuntimeReferenceResolutionResult`.**
  El nuevo camino (parse + resolve + apply) debe conservar esa comprobación antes de aplicar la cadena, o un
  campo oculto con formatter (`{{forms.f.hidden | uppercase}}`) fallaría con `request-build-failed` en lugar de
  omitir el header. Riesgo controlado por D5: la comprobación de omisión sigue viviendo dentro de
  `resolveHeaderTemplateValue`, no se migra a `runtime-references/`.
- **`api.endpoint` amplía silenciosamente su superficie de fallo a "cadena de formatters no resoluble".** Es un
  cambio deseado (D6) pero merece cobertura de test explícita para no confundirlo con una regresión de la
  semántica existente de placeholders sin `|`.
- **Fechas date-only con timezone.** D7 fija getters UTC para date-only; una fecha date-time sin offset explícito
  (`"2026-07-16T10:00:00"`) se interpreta como local. La spec no distingue estos casos por su cuenta y el
  criterio de aceptación 5 usa un input date-only, así que este trade-off no rompe ningún criterio explícito,
  pero conviene documentarlo en `dynamic-strings.md` para no reabrirlo en soporte.
- **Coste marginal en el camino sin `|`.** `hasFormatterSyntax` recorre la string una vez para saber si hay un
  `|` fuera de comillas. Es lineal y comparable al coste de un `String.prototype.includes('|')`, y
  cuantitativamente menor que el propio `regex.replace` que ya se ejecuta hoy en cada placeholder. No se
  introduce coste apreciable.
- **`Intl` cache crece indefinidamente por argumento distinto.** Trade-off aceptado (D8): el catálogo de
  argumentos realistas es acotado, no se introduce política de expiración para no diseñar un LRU sin necesidad
  demostrada.

## Migración o despliegue

No aplica. Cambio aditivo sobre la sintaxis de interpolación: cualquier placeholder existente sin `|` sigue el
mismo camino que hoy (`hasFormatterSyntax` devuelve `false` → se salta el parser y la aplicación de cadena,
delegando 1:1 en `resolveRuntimeReference`). No hay datos persistidos ni configuración de despliegue.

## Preguntas abiertas

Ninguna bloqueante. Las decisiones técnicas restantes (nombres exactos de ficheros/tests, orden interno de las
tareas de implementación) pertenecen a `generate-implementation-plan`.
