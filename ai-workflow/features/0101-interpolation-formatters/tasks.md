# Tasks: 0101 — Formatters en interpolación `{{...}}`

Contrato de ejecución para la implementación de la feature. Cada tarea es atómica, secuencial, y su cierre habilita
la siguiente. Todas las decisiones de arquitectura se cierran en `design.md` (D1–D10); esta lista no las reabre.

Convenciones:
- Orden estricto: las tareas se ejecutan en el orden en que aparecen. Cada dependencia declarada apunta hacia arriba.
- "cierre de implementación": código y tests de la tarea completos, `pnpm test --run <ruta>` en verde para cada
  fichero declarado en el sub-bloque `tests`.
- Cobertura global (`pnpm test`) se comprueba una única vez al final de la fase de implementación, no por tarea
  (regla global recogida en `ai-workflow/standards/testing-rules.md`).

---

## T1 — Parser de la cadena `referencia | formatter [: arg]`

- **ID**: T1
- **Estado**: done
- **Objetivo**: introducir `runtime-formatter-parser.ts` en `src/runtime/runtime-references/` con los tipos
  públicos `RuntimeFormatterArgument`, `RuntimeFormatterInvocation`, `RuntimeFormatterParseResult` (D3), la función
  `parseFormatterPlaceholder(rawPlaceholderContent) → RuntimeFormatterParseResult` y `hasFormatterSyntax(rawPlaceholderContent) → boolean`.
  El parser recorre el contenido del placeholder una única vez con cursor de caracteres (D2), respeta strings entre
  comillas dobles al detectar `|` y `:`, y rechaza cualquier desviación gramatical devolviendo
  `{ status: 'unresolvable-chain' }`.
- **Fuera de alcance**:
  - implementación de los formatters (T2)
  - integración con capas de resolución de placeholders (T3–T5)
  - cualquier modificación a `runtime-reference-parser.ts` o `runtime-reference-resolver.ts`
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - código: `src/runtime/runtime-references/runtime-formatter-parser.ts` (nuevo)
  - tests: `src/tests/runtime/runtime-formatter-parser.test.ts` (nuevo)
  - documentación: ninguno en esta tarea; la actualización doc consolidada se hace en T3–T5.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-formatter-parser.test.ts` (nuevo)
  - **Comportamiento cubierto**:
    - `hasFormatterSyntax("queries.total")` devuelve `false`.
    - `hasFormatterSyntax("queries.total | number")` devuelve `true`.
    - `hasFormatterSyntax("queries.name | truncate:\"a|b\"")` devuelve `true` (el `|` externo cuenta, el interno a
      la string no).
    - `hasFormatterSyntax("queries.name | truncate:\"ab")` devuelve `true`. `hasFormatterSyntax` sólo actúa como
      fast-path para detectar la presencia de un `|` de nivel superior antes de abrir una string; el rechazo por
      string sin cerrar lo hace `parseFormatterPlaceholder` en la siguiente etapa devolviendo
      `{ status: 'unresolvable-chain' }`.
    - `hasFormatterSyntax("queries.name truncate:\"a|b\"")` devuelve `false`. El único `|` aparece dentro de una
      string abierta antes que cualquier `|` de nivel superior, así que el fast-path lo ignora correctamente.
    - `parseFormatterPlaceholder("queries.total")` devuelve `{ status: 'no-formatters', reference: 'queries.total' }`.
    - `parseFormatterPlaceholder(" queries.total ")` devuelve `{ status: 'no-formatters', reference: 'queries.total' }`
      (espacios alrededor de la referencia se ignoran).
    - `parseFormatterPlaceholder("queries.total | number")` devuelve `status: 'ok'`, `reference: 'queries.total'` y
      una única invocación `{ name: 'number', argument: { kind: 'none' } }`.
    - `parseFormatterPlaceholder("queries.total | number:2")` devuelve una invocación con
      `argument: { kind: 'number', value: 2 }`.
    - `parseFormatterPlaceholder("queries.price | currency:\"USD\"")` devuelve una invocación con
      `argument: { kind: 'string', value: 'USD' }`.
    - Encadenamiento: `parseFormatterPlaceholder("x | uppercase | truncate:2")` devuelve dos invocaciones en orden,
      la segunda con `argument: { kind: 'number', value: 2 }`.
    - Espacios variables: `parseFormatterPlaceholder(" x  |  number : 2 ")` produce el mismo resultado que
      `"x | number:2"`.
    - String con `|` interno: `parseFormatterPlaceholder("x | truncate:\"a|b\"")` produce una única invocación con
      argumento string `"a|b"`.
    - Números negativos y decimales: `parseFormatterPlaceholder("x | number:-1")` y `"x | percent:1.5"` producen
      `argument.kind: 'number'` con el valor correspondiente.
    - Casos `unresolvable-chain` (cada uno un test):
      - nombre inválido: `"x | 1foo"`, `"x | foo(1)"`
      - `:` sin argumento: `"x | truncate:"`
      - número como argumento donde solo hay letras: `"x | number:dos"` (identificador sin comillas ni número)
      - string sin cerrar: `"x | truncate:\"ab"`
      - caracter extraño tras nombre: `"x | number#2"`
      - referencia vacía: `" | number"`
      - placeholder totalmente vacío: `""`
    - Interacción con string `:`: `parseFormatterPlaceholder("x | date:\"dd/MM/yyyy HH:mm:ss\"")` produce una única
      invocación con argumento string igual al patrón completo.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-formatter-parser.test.ts`
  - **Restricciones**:
    - El parser no consulta el catálogo de formatters (nombres válidos, aridad esperada). Solo aplica la gramática:
      la validación semántica vive en el registro (T2).
- **Documentación afectada**: ninguna en esta tarea. La sintaxis se documenta en T3–T5 sobre
  `ai-workflow/docs/app-features/references/dynamic-strings.md`.
- **Criterios de finalización**:
  - `parseFormatterPlaceholder` y `hasFormatterSyntax` implementados según D2/D3.
  - Todos los tests del fichero pasan.
- **Cierre de implementación**: código y tests validados con `pnpm test --run src/tests/runtime/runtime-formatter-parser.test.ts`.

---

## T2 — Registro cerrado de formatters + `applyFormatterChain`

- **ID**: T2
- **Estado**: done
- **Objetivo**: introducir `runtime-formatter-registry.ts` en `src/runtime/runtime-references/` con:
  - la unión literal `RuntimeFormatterName = 'number' | 'currency' | 'date' | 'percent' | 'uppercase' | 'lowercase' | 'capitalize' | 'truncate'`
  - el tipo `RuntimeFormatterEntry` con campos `argument` y `apply` según D4
  - el mapa `RUNTIME_FORMATTER_REGISTRY: Record<RuntimeFormatterName, RuntimeFormatterEntry>` con las ocho entradas
  - la función `applyFormatterChain(input, invocations) → RuntimeFormatterChainResult` que itera de izquierda a
    derecha, corta ante el primer `unresolvable`, y devuelve el resultado global (D4)
  - el cache de instancias `Intl.NumberFormat` a nivel de módulo (D8), con clave estable por combinación de opciones
- **Fuera de alcance**:
  - modificar el parser (T1) o los tipos de invocación
  - integrar el registro con capas de resolución de placeholders (T3–T5)
  - añadir formatters fuera del catálogo v1
  - introducir diagnóstico DEV (se añade en T3)
- **Dependencias**: T1 (usa los tipos `RuntimeFormatterInvocation` y `RuntimeFormatterArgument`).
- **Impacto esperado en archivos**:
  - código: `src/runtime/runtime-references/runtime-formatter-registry.ts` (nuevo)
  - tests: `src/tests/runtime/runtime-formatter-registry.test.ts` (nuevo)
  - documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-formatter-registry.test.ts` (nuevo)
  - **Comportamiento cubierto**:
    - `number` sin argumento con `1234.5` produce `"1.234,5"` (locale `es-ES`).
    - `number:2` con `1234.5` produce `"1.234,50"`.
    - `number` acepta strings numéricos: `"42"` → `"42"`, `"42.5"` → `"42,5"`.
    - `number` rechaza como `unresolvable`: `""`, `"   "`, `"12,3"` (coma decimal), `"1,000"` (separador de miles),
      `"abc"`, `NaN`, `Infinity`, `null`, `undefined`, `true`, `{}`, `[]`.
    - `currency` sin argumento con `19.9` produce el valor esperado en euros (`"19,90 €"` según `Intl` `es-ES`).
    - `currency:"USD"` con `19.9` produce el valor formateado en dólares con símbolo `US$` (el test verifica que la
      salida contiene `19,90` y difiere del caso EUR).
    - `currency:1` (argumento numérico donde se espera string) → `unresolvable`.
    - `date:"dd/MM/yyyy"` con `"2026-07-16"` produce `"16/07/2026"` (getters UTC, D7).
    - `date:"dd/MM/yyyy HH:mm:ss"` con un ISO datetime construido a partir de un `Date` conocido en zona local
      (`new Date(2026, 6, 16, 10, 30, 45).toISOString()` interpretado luego de nuevo con getters locales, según
      D7): la aserción verifica que la salida iguala exactamente `"16/07/2026 10:30:45"`. Se evita fijar timezone
      globalmente y se apoya en que el mismo `Date` reconstruido produce los mismos componentes locales que el
      formatter. Alternativa aceptable: comparar por regex de forma `^\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}$` sobre un
      ISO con offset explícito (`"2026-07-16T10:30:45+00:00"`) sin fijar hora exacta.
    - `date:"dd/MM/yyyy"` con `"ana"`, `""`, `null`, `123`, `false` → `unresolvable`.
    - `date` sin argumento (`argument.kind: 'none'`) → `unresolvable` (patrón obligatorio).
    - `date:"YYYY/MM/dd"` con `"2026-07-16"` produce `"YYYY/07/16"` (tokens fuera de catálogo se dejan literales,
      D7).
    - `percent` con `0.4256` produce `"43%"` (decimals default 0, redondeo del `Intl.NumberFormat`).
    - `percent:1` con `0.4256` produce `"42,6%"`.
    - `percent` acepta strings numéricos (`"0.5"` → `"50%"`) y rechaza no numéricos igual que `number`.
    - `uppercase` con `"ana"` produce `"ANA"`; con `42` produce `"42"`; con `true` produce `"TRUE"`.
    - `uppercase` con `null`, `undefined`, `NaN`, `Infinity`, `{}`, `[]` → `unresolvable`.
    - `uppercase:"foo"` (argumento donde no se admite) → `unresolvable`.
    - `lowercase` con `"ANA"` produce `"ana"`.
    - `capitalize` con `"ana pérez"` produce `"Ana pérez"` (solo primer carácter, resto sin cambios).
    - `capitalize` con `""` produce `""`.
    - `truncate:20` con `"hola"` produce `"hola"` (sin `…` cuando el texto no excede N).
    - `truncate:2` con `"hola"` produce `"ho…"`.
    - `truncate:0` con `"hola"` produce `"…"`.
    - `truncate:0` con `""` produce `""` (texto vacío no añade `…`).
    - `truncate` sin argumento o con string → `unresolvable`.
    - `truncate:-1` → `unresolvable` (número negativo fuera de contrato).
    - `applyFormatterChain(1234.5, [{name:'number'}])` devuelve `{ status: 'ok', value: '1.234,5' }`.
    - `applyFormatterChain("ana", [{name:'uppercase'}, {name:'truncate', argument:{kind:'number', value:2}}])`
      devuelve `{ status: 'ok', value: 'AN…' }`, verificando encadenamiento en orden.
    - `applyFormatterChain("ana", [{name:'uppercase'}, {name:'date', argument:{kind:'string', value:'dd/MM/yyyy'}}])`
      devuelve `{ status: 'unresolvable' }` (segundo formatter recibe input no compatible).
    - `applyFormatterChain(x, [{name:'doesNotExist' as RuntimeFormatterName}])` devuelve `{ status: 'unresolvable' }`
      (nombre fuera del catálogo v1).
    - Cache `Intl`: dos invocaciones consecutivas de `number:2` reutilizan la misma instancia (verificable con
      `vi.spyOn` sobre el constructor de `Intl.NumberFormat` — la spy se llama una única vez para dos ejecuciones
      con el mismo argumento).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-formatter-registry.test.ts`
  - **Restricciones**:
    - Las salidas de `Intl.NumberFormat('es-ES', …)` dependen del ICU embebido en Node. Los tests deben verificar
      contenido observable relevante (dígitos, separador correcto, símbolo de moneda) y evitar aserciones frágiles
      sobre espacios no rompibles: se recomienda normalizar espacios (`.replace(/ /g, ' ')`) antes de comparar.
    - No introducir librerías externas para fechas: la tokenización `dd/MM/yyyy HH:mm:ss` se implementa a mano
      sustituyendo tokens conocidos en el patrón (D7).
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**:
  - Catálogo v1 completo con las ocho entradas y semántica cerrada por D9.
  - `applyFormatterChain` implementado con corte al primer `unresolvable`.
  - Cache `Intl` operativo y verificable.
  - Tests del fichero en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/runtime/runtime-formatter-registry.test.ts` en verde.

---

## T3 — Integración en superficies visibles + diagnóstico DEV

- **ID**: T3
- **Estado**: done
- **Objetivo**: modificar `src/runtime/runtime-references/runtime-reference-resolver.ts` para que
  `resolveRuntimeInterpolatedVisibleValue` use el nuevo parser (T1) y `applyFormatterChain` (T2):
  1. Si `hasFormatterSyntax(rawReference)` es `false`, camino actual sin cambios (llama a `resolveRuntimeReference` +
     `normalizeRuntimeTextValue`).
  2. Si es `true`: parsear con `parseFormatterPlaceholder`; si `unresolvable-chain`, devolver string vacío para ese
     placeholder (semántica visible ya existente).
  3. Si `no-formatters`, comportamiento actual (equivale a no tener `|`; camino defensivo por si el placeholder
     contiene un `|` dentro de una string).
  4. Si `ok`, resolver la referencia con `resolveRuntimeReference`. Si el resultado no es `resolved` (cualquier
     estado `literal | invalid | unsupported | missing | token-error`), devolver string vacío para ese placeholder.
  5. Si la referencia resolvió, llamar `applyFormatterChain(result.value, formatters)`. Si `unresolvable`, devolver
     string vacío para ese placeholder y emitir un `console.warn` DEV con el formato descrito en D10. Si `ok`,
     `normalizeRuntimeTextValue(chainResult.value)` y devolver.
  Añadir en `runtime-reference-diagnostics.ts` una función `reportRuntimeFormatterChainDiagnostic(rawPlaceholder,
  firstFailingFormatterName, surface)` que solo actúa en DEV (`import.meta.env.DEV`).
  Actualizar `ai-workflow/docs/app-features/references/dynamic-strings.md` para documentar la sintaxis
  `{{ referencia | formatter [: arg] | ... }}`, el catálogo v1, la gramática del argumento único opcional, el locale
  fijo `es-ES` y la semántica de cadena no resoluble sobre superficies visibles.
- **Fuera de alcance**:
  - integración con headers y `api.endpoint` (T4 y T5)
  - modificar `resolveRuntimeReference`, `parseRuntimeReference` o cualquier flujo de referencias completas
  - añadir formatters nuevos
- **Dependencias**: T1, T2.
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/runtime-references/runtime-reference-resolver.ts` (modificar `resolveRuntimeInterpolatedVisibleValue`)
    - `src/runtime/runtime-references/runtime-reference-diagnostics.ts` (añadir emisor DEV para cadena no resoluble)
  - tests:
    - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación: casos con `|` en superficies visibles)
  - documentación:
    - `ai-workflow/docs/app-features/references/dynamic-strings.md` (sintaxis de formatters, catálogo, semántica de
      cadena no resoluble en superficies visibles)
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación)
  - **Comportamiento cubierto**:
    - `{{queries.total | number}}` con `queries.total.data = 1234.5` produce `"1.234,5"` en la string resuelta.
    - `{{queries.total | number:2}}` con el mismo valor produce `"1.234,50"`.
    - `{{queries.price | currency}}` con `19.9` produce string que contiene `"19,90"` y símbolo de euro.
    - `{{queries.price | currency:"USD"}}` produce string en dólares que contiene `"19,90"`.
    - `{{queries.date | date:"dd/MM/yyyy"}}` con `"2026-07-16"` produce `"16/07/2026"`.
    - `{{queries.date | date:"dd/MM/yyyy HH:mm:ss"}}` con ISO datetime con offset produce fecha+hora formateadas
      (verificación del formato general, evitando dependencia estricta de zona horaria).
    - `{{queries.name | uppercase}}` con `"ana"` produce `"ANA"`.
    - `{{queries.name | uppercase | truncate:2}}` con `"ana"` produce `"AN…"` (encadenamiento).
    - `{{queries.ratio | percent:1}}` con `0.4256` produce `"42,6%"`.
    - `{{queries.total | doesNotExist}}` produce string vacío en la string resuelta (cadena no resoluble por nombre
      inválido; el resto del texto literal se conserva).
    - `{{queries.name | date:"dd/MM/yyyy"}}` con `"ana"` produce string vacío para ese placeholder, el texto literal
      alrededor se conserva.
    - `{{queries.total | number:"dos"}}` produce string vacío para ese placeholder (gramática de argumento inválida).
    - `{{queries.total | truncate:}}` produce string vacío para ese placeholder (`:` sin argumento).
    - `{{ queries.total | number : 2 }}` (espacios variables) produce el mismo resultado que
      `{{queries.total | number:2}}`.
    - Cadena mixta: `"Total: {{queries.total | number:2}} eur"` produce `"Total: 1.234,50 eur"`.
    - Compatibilidad hacia atrás: un placeholder sin `|` (`{{queries.total}}`) devuelve exactamente el mismo
      resultado que antes de la feature (test comparativo). Los tests existentes en el fichero deben seguir en
      verde sin modificaciones semánticas.
    - Diagnóstico DEV: al resolver una cadena no resoluble por formatter, `console.warn` se invoca una vez con un
      mensaje que contiene `runtime-formatters` y el nombre del formatter que falló. El mecanismo concreto es:
      espiar `console.warn` con `vi.spyOn(console, 'warn').mockImplementation(() => {})` en `beforeEach` y
      restaurarla en `afterEach`; `import.meta.env.DEV` es `true` bajo `pnpm test` (Vitest) por defecto, por lo que
      no hace falta stub adicional para la rama DEV. Para verificar la ausencia del warn en modo no-DEV se
      utiliza `vi.stubEnv('DEV', false)` con `vi.unstubAllEnvs()` en teardown y se comprueba que la spy no se
      llama.
    - Referencia con `params.*` no soportada en la superficie combinada con formatter: el fallo ocurre por
      referencia inválida (comportamiento actual), independientemente del formatter.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx`
  - **Restricciones**:
    - Reusar los harnesses y builders de estado ya presentes en `runtime-reference-resolution.test.tsx`. No crear
      helpers nuevos si los existentes bastan.
    - No añadir tests de integración de nodos completos (los cubren capas superiores en features previas). Este
      fichero verifica la resolución de string interpolada, no el renderizado del layout.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/references/dynamic-strings.md` (sección de sintaxis y catálogo v1, con nota
    breve sobre semántica no resoluble en superficies visibles; los detalles de headers/endpoint se añaden en
    T4/T5).
- **Criterios de finalización**:
  - `resolveRuntimeInterpolatedVisibleValue` compone parser + resolver existente + `applyFormatterChain` sin cambiar
    el camino cuando no hay `|`.
  - `dynamic-strings.md` documenta la nueva sintaxis y el catálogo.
  - Tests ampliados en verde. Los tests preexistentes del fichero siguen pasando sin modificar sus expectativas.
- **Cierre de implementación**: `pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx` en verde.

---

## T4 — Integración en superficies de headers

- **ID**: T4
- **Estado**: done
- **Objetivo**: modificar `resolveHeaderTemplateValue` en `src/queries/runtime-api-payload-resolver.ts` para que,
  dentro del bucle sobre `RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN`, cada placeholder pase por el nuevo parser (T1) y,
  cuando corresponda, por `applyFormatterChain` (T2):
  1. Si `hasFormatterSyntax(rawReference)` es `false`, camino actual sin cambios (misma lógica de omisión por
     campo oculto y misma proyección a `failed = true`).
  2. Si es `true`: parsear con `parseFormatterPlaceholder`. `unresolvable-chain` → `failed = true` con
     `failedPlaceholder` correspondiente (contrato de fallo actual `request-build-failed`).
  3. Si `ok` o `no-formatters`, resolver la referencia con el `resolveRuntimeReference` actual. La comprobación
     existente de omisión por campo oculto (`hiddenFormFields`) se aplica **antes** de aplicar la cadena de
     formatters, comparando contra la referencia resuelta (mismo shape actual: `namespace === 'forms'` con
     `path.length === 2`, etc.), tanto en el caso `missing` como en el caso `resolved`. Esto preserva D5.
  4. Solo tras confirmar que no es un caso de omisión y que el resultado es `resolved`, aplicar
     `applyFormatterChain` cuando el parseo fue `ok`. `unresolvable` → `failed = true`.
  5. Serializar el valor a string con la regla actual (`string`, `number`, `boolean` → coerción; el resto → fallo).
  Emitir en DEV el mismo diagnóstico auxiliar creado en T3 cuando la cadena de formatters sea la causante del fallo.
- **Fuera de alcance**:
  - integración en superficies visibles (T3) y `api.endpoint` (T5)
  - refactorizar `resolveHeaderTemplateValue` en una función auxiliar compartida con la capa visible; la
    duplicación controlada es explícita en el design (D5)
- **Dependencias**: T1, T2, T3 (por el emisor de diagnóstico DEV).
- **Impacto esperado en archivos**:
  - código:
    - `src/queries/runtime-api-payload-resolver.ts` (modificar `resolveHeaderTemplateValue`)
  - tests:
    - `src/tests/runtime/runtime-api-header-interpolation.test.ts` (ampliación)
  - documentación:
    - `ai-workflow/docs/app-features/references/dynamic-strings.md` (sección semántica en superficies de headers)
    - `ai-workflow/docs/app-features/queries/execution.md` (nota de que los formatters en valores de header están
      sujetos a la misma semántica de error ya documentada)
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-api-header-interpolation.test.ts` (ampliación)
  - **Comportamiento cubierto**:
    - Header con `"Bearer {{tokens.sede.value | uppercase}}"` produce el header con el valor del token en
      mayúsculas.
    - Header con `"X-Total: {{queries.total | number:2}}"` produce el header con `1.234,50` para
      `queries.total.data = 1234.5`.
    - Header con `"X-Fail: {{queries.total | doesNotExist}}"` produce `request-build-failed` y la petición no se
      emite.
    - Header con `"X-Fail: {{queries.name | date:\"dd/MM/yyyy\"}}"` con `queries.name.data = "ana"` produce
      `request-build-failed` (input no compatible con `date`).
    - Header con `"X-Bad: {{queries.total | truncate:}}"` produce `request-build-failed` (gramática de argumento
      inválida).
    - Omisión de header por campo oculto sigue funcionando con formatter presente:
      `"X-User: {{forms.f.hidden | uppercase}}"` donde `hidden` está en `hiddenFormFields.fieldIds` omite el header
      completo del wire format y no produce `request-build-failed`. Este test verifica D5 explícitamente.
    - Placeholder sin `|` en header (`"Bearer {{tokens.sede.value}}"`) sigue el mismo camino que antes de la
      feature (test comparativo). Tests de omisión y token-refresh preexistentes en el fichero siguen en verde.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-api-header-interpolation.test.ts`
  - **Restricciones**:
    - No mover la lógica de `hiddenFormFields` fuera de `resolveHeaderTemplateValue`. La omisión sigue mirando la
      referencia resuelta, no el valor formateado.
    - No introducir en `runtime-references/` conocimiento de `hiddenFormFields`. La frontera `runtime/` vs
      `queries/` se mantiene.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/references/dynamic-strings.md`: extender la sección "En superficies de headers"
    para incluir el caso de cadena de formatters no resoluble.
  - `ai-workflow/docs/app-features/queries/execution.md`: nota breve de que los formatters no cambian la semántica
    de error de headers.
- **Criterios de finalización**:
  - Formatters aplicables en las cuatro superficies de headers listadas en la spec (`api.headers`,
    `button.props.action.headers`, `form.submitAction.headers`, `preloads[].headers`) — la modificación en
    `resolveHeaderTemplateValue` cubre las cuatro por diseño.
  - Lógica de omisión por campo oculto preservada.
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/runtime/runtime-api-header-interpolation.test.ts` en
  verde.

---

## T5 — Integración en `api.endpoint`

- **ID**: T5
- **Estado**: done
- **Objetivo**: modificar `resolveEndpoint` en `src/queries/runtime-api-request.ts` para que cada placeholder pase
  por el nuevo parser (T1) y por `applyFormatterChain` (T2) con la misma semántica de fallo `request-build-failed`
  ya existente para esta superficie (D6):
  1. Si `hasFormatterSyntax(rawReference)` es `false`, camino actual sin cambios.
  2. Si es `true`: parsear con `parseFormatterPlaceholder`. `unresolvable-chain` → `failed = true`.
  3. Si `ok` o `no-formatters`, `resolveRuntimeReference` como hoy; si no es `resolved`, `failed = true`.
  4. Si la referencia resolvió y hay formatters, aplicar la cadena; `unresolvable` → `failed = true`.
  5. Serializar con la regla actual (`string`, `number`, `boolean` → coerción; el resto → fallo).
  Emitir en DEV el mismo diagnóstico auxiliar creado en T3 cuando la cadena sea la causante del fallo.
- **Fuera de alcance**:
  - integración en superficies visibles (T3) y headers (T4)
  - unificar `resolveEndpoint` con `resolveHeaderTemplateValue`; la duplicación controlada es explícita (D5)
- **Dependencias**: T1, T2, T3.
- **Impacto esperado en archivos**:
  - código:
    - `src/queries/runtime-api-request.ts` (modificar `resolveEndpoint`)
  - tests:
    - `src/tests/runtime/runtime-api-execution.test.ts` (ampliación: `api.endpoint` con formatters, en verde
      y fallo `request-build-failed`)
  - documentación:
    - `ai-workflow/docs/app-features/references/dynamic-strings.md` (nota corta de que `api.endpoint` hereda la
      semántica de fallo tipo header)
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-api-execution.test.ts` (ampliación)
  - **Comportamiento cubierto**:
    - `api.endpoint = "/users/{{queries.userId | uppercase}}"` con `queries.userId.data = "abc"` construye la
      petición con endpoint `"/users/ABC"`.
    - `api.endpoint = "/n/{{queries.total | number:0}}"` con `queries.total.data = 1234` construye endpoint
      `"/n/1.234"`.
    - `api.endpoint = "/x/{{queries.total | doesNotExist}}"` produce `code: request-build-failed` y no emite red.
    - `api.endpoint = "/x/{{queries.name | date:\"dd/MM/yyyy\"}}"` con `queries.name.data = "ana"` produce
      `code: request-build-failed`.
    - `api.endpoint = "/x/{{queries.total | truncate:}}"` produce `code: request-build-failed`.
    - Endpoint sin `|` sigue exactamente el mismo camino que antes de la feature (test comparativo). Tests
      existentes del fichero siguen en verde.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-api-execution.test.ts`
  - **Restricciones**:
    - Reusar el harness de ejecución de operaciones ya presente en el fichero. No introducir un mock de fetch
      nuevo si el existente basta.
    - No añadir cobertura sobre semántica de `token-error` combinada con formatter (D2 ya rechaza el placeholder
      antes de tocar tokens en error; el test lo asumiría implícito y añadiría ruido sin cobertura útil).
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/references/dynamic-strings.md`: mencionar que `api.endpoint` aplica el mismo
    contrato de fallo que headers ante cadena no resoluble.
- **Criterios de finalización**:
  - `resolveEndpoint` compone parser + resolver + `applyFormatterChain` sin cambiar el camino cuando no hay `|`.
  - `dynamic-strings.md` refleja la semántica de fallo en `api.endpoint` (una línea suficiente).
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/runtime/runtime-api-execution.test.ts` en verde y
  `pnpm test` (suite completa) en verde con el umbral global de cobertura satisfecho.

---

## Orden y siguiente tarea recomendada

1. T1 — Parser
2. T2 — Registro y `applyFormatterChain`
3. T3 — Superficies visibles + diagnóstico DEV
4. T4 — Superficies de headers
5. T5 — `api.endpoint`

Siguiente tarea a tomar: **T1**.
