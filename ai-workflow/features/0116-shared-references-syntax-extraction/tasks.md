# Tasks — 0116 — Shared references syntax extraction

Contrato de ejecución. Ordenado por dependencia. La siguiente tarea que debe abordarse siempre es la primera cuyo
estado no sea `done`.

## Referencia común para toda la feature

### Inventario real (verificado con `grep`/lectura directa del código, no con la estimación de la spec)

`src/runtime/runtime-references/runtime-reference-parser.ts` (192 líneas) contiene exactamente:

- **Exportado**: `parseRuntimeReference(value: string, options: ParseRuntimeReferenceOptions = {}): RuntimeReferenceParseResult`,
  `hasRuntimeTemplateDelimiter(value: string)`.
- **Privado (funciones)**: `isSupportedNamespace`, `isReservedNamespace`, `hasRecognizedNamespace`,
  `hasValidReferenceShape`, `isSupportedQueryProperty`, `hasValidQueryReferencePath`, `createInvalidReference`.
- **Privado (constantes)**: `SUPPORTED_NAMESPACES`, `RESERVED_NAMESPACES`, `REFERENCE_PATTERN`,
  `REFERENCE_SEGMENT_PATTERN`, `ITEM_KEY_SYNTHETIC_SEGMENT`, `ITEM_INDEX_SYNTHETIC_SEGMENT`.
- **Privado (interface)**: `ParseRuntimeReferenceOptions` (no exportada hoy; **no** aparece en la lista de la spec
  porque la spec enumera helpers y constantes, pero es parte inseparable de la firma de `parseRuntimeReference` y se
  mueve con ella, manteniéndose igualmente no exportada).
- **Única dependencia interna**: `import type { RuntimeInvalidReference, RuntimeReferenceNamespace,
  RuntimeReferenceParseResult, RuntimeSupportedReference, RuntimeUnsupportedReference } from './runtime-reference-types'`.
  No importa nada más.

`src/runtime/runtime-references/runtime-reference-types.ts` (83 líneas) declara 12 tipos, en dos grupos:

- **Sintácticos (se mueven al nuevo módulo)**: `RuntimeReferenceNamespace`, `RuntimeReferenceParseResult`,
  `RuntimeLiteralReference`, `RuntimeSupportedReference`, `RuntimeUnsupportedReference`, `RuntimeInvalidReference`.
- **De resolución contra estado en vivo (se quedan)**: `RuntimeReferenceResolutionResult`, `RuntimeLiteralResolution`,
  `RuntimeResolvedReference`, `RuntimeMissingReference`, `RuntimeUnsupportedResolution`, `RuntimeInvalidResolution`,
  `RuntimeTokenErrorResolution`.

De los tipos de resolución, solo tres dependen de tipos sintácticos: `RuntimeResolvedReference`,
`RuntimeMissingReference` y `RuntimeTokenErrorResolution` usan `RuntimeSupportedReference`;
`RuntimeUnsupportedResolution` usa `RuntimeUnsupportedReference`; `RuntimeInvalidResolution` usa
`RuntimeInvalidReference`. `RuntimeLiteralResolution` no depende de ninguno. Por tanto, tras la poda,
`runtime-reference-types.ts` importa exactamente 3 tipos del nuevo módulo (`RuntimeSupportedReference`,
`RuntimeUnsupportedReference`, `RuntimeInvalidReference`) y ninguno más.

### Los 9 importadores reales del parser (verificado con `grep -rn "runtime-reference-parser" src/`)

| # | Fichero | Línea | Símbolo importado | Ruta nueva |
|---|---|---|---|---|
| 1 | `src/config/runtime-reference-namespace-guards.ts` | 1 | `parseRuntimeReference` | `'./runtime-reference-syntax'` |
| 2 | `src/config/validate-node-shared-helpers.ts` | 1 | `hasRuntimeTemplateDelimiter` | `'./runtime-reference-syntax'` |
| 3 | `src/config/validate-form-field-nodes.ts` | 21 | `parseRuntimeReference` | `'./runtime-reference-syntax'` |
| 4 | `src/config/validate-collection-source.ts` | 3 | `parseRuntimeReference` | `'./runtime-reference-syntax'` |
| 5 | `src/config/validate-actions-visibility.ts` | 41 | `parseRuntimeReference` | `'./runtime-reference-syntax'` |
| 6 | `src/config/validate-form-choice-items.ts` | 8 | `parseRuntimeReference` | `'./runtime-reference-syntax'` |
| 7 | `src/runtime/runtime-references/runtime-reference-resolver.ts` | 17 | `parseRuntimeReference` (+ tipo `RuntimeSupportedReference`, línea 20, hoy desde `'./runtime-reference-types'`) | `'../../config/runtime-reference-syntax'` |
| 8 | `src/runtime/runtime-collection-sources.ts` | 11 | `hasRuntimeTemplateDelimiter` | `'../config/runtime-reference-syntax'` |
| 9 | `src/tests/runtime/runtime-reference-resolution.test.tsx` | 2 | `parseRuntimeReference` | `'../../config/runtime-reference-syntax'` |

Ningún otro fichero de `src/` importa el parser ni los 6 tipos sintácticos. `runtime-reference-diagnostics.ts` importa
de `runtime-reference-types.ts` únicamente `RuntimeReferenceResolutionResult`, que no se mueve: **no se toca en toda la
feature**. Fuera de `src/` solo hay menciones en `tasks.md`/`design.md` de features históricas
(`0007`, `0009`, `0020`, `0024`, `0029`, `0040`, `0045`, `0050`, `0092`, `0115`), que son registro histórico y **no se
actualizan**.

### Orden de ejecución y estado intermedio de cada paso

1. **T1** — crear el módulo neutral. Duplicación temporal deliberada y aceptada: durante T1 conviven el nuevo módulo y
   el parser/tipos originales, ambos compilando. Nadie importa todavía el nuevo módulo.
2. **T2** — redirigir los 6 importadores de `src/config/`. Al cerrar T2 la inversión de capas del hallazgo A-02 ya no
   existe; el parser sigue vivo con 3 importadores.
3. **T3** — redirigir los 3 importadores restantes (resolver, `runtime-collection-sources.ts`, test) y **eliminar** el
   parser. Estado intermedio válido: `runtime-reference-types.ts` sigue declarando sus 6 tipos sintácticos locales,
   estructuralmente idénticos a los del nuevo módulo, por lo que TypeScript los sigue considerando compatibles allí
   donde se cruzan (`RuntimeResolvedReference.reference` vs. el `RuntimeSupportedReference` importado por el resolver).
4. **T4** — podar `runtime-reference-types.ts` y verificación global de los 6 criterios de aceptación de la spec.

### Reglas transversales

- Feature **puramente mecánica**: copia literal. Cero cambio de comportamiento, de firma, de nombre exportado, de
  mensaje de error, de código de error, de ruta canónica o de breadcrumb de validación. Ninguna tarea puede
  "aprovechar para" reordenar, renombrar, simplificar ni tipar mejor nada de lo movido.
- El nuevo módulo `src/config/runtime-reference-syntax.ts` **no importa nada de `src/runtime/`** en ningún momento del
  plan, ni siquiera de forma transitoria. Es un módulo hoja: sus únicas dependencias son las propias del código movido,
  que no tiene ninguna más allá de los tipos que también se mueven.
- No se crea ningún barrel de compatibilidad en `src/runtime/runtime-references/runtime-reference-parser.ts` ni se
  reexporta el nuevo módulo desde `src/config/runtime-config.ts` (coherente con que
  `runtime-reference-namespace-guards.ts` tampoco se reexporta desde ahí).
- `runtime-reference-types.ts` **importa** los tipos sintácticos, **no los reexporta**. Cualquier consumidor que
  necesite un tipo sintáctico lo importa de `src/config/runtime-reference-syntax.ts`.
- Los imports de solo-tipo usan `import type` (convención vigente en todo el repo; `isolatedModules: true`).
- Ninguna tarea crea, mueve, divide ni renombra ficheros de test. La suite existente es la cobertura de regresión
  completa de esta feature.
- **Gate de CI**: `.gitlab-ci.yml` ejecuta, en este orden, `pnpm lint` → `pnpm build` → `pnpm test`. `pnpm lint` no es
  redundante con `pnpm build`: `tsconfig.app.json` no activa `noUnusedLocals`/`noUnusedParameters`, así que el único
  guardián de imports o declaraciones sin usar es `@typescript-eslint/no-unused-vars` (configurado como `error` en
  `eslint.config.js`). En una feature que consiste íntegramente en mover símbolos y podar bloques de import, ese es
  precisamente el error más probable —por ejemplo, copiar los 5 tipos del bloque de import original del parser cuando
  el destino solo necesita 3—, y pasaría inadvertido a `pnpm build` y a `pnpm test`. Cada tarea ejecuta `pnpm lint`
  antes de `pnpm build`.
- **Sobre los comandos `pnpm test --run <ruta>`**: `pnpm test` incluye `--coverage` con umbral global del 80%, así que
  ejecutar un único fichero termina siempre con `ERROR: Coverage ... does not meet global threshold`. Eso es esperado y
  **no** indica fallo de la tarea: lo que valida la tarea es que los tests del fichero pasen (`Test Files N passed`).
  El equivalente sin cobertura para iterar es `pnpm test:watch --run <ruta>`. El gate real de cobertura es `pnpm test`
  completo, que solo se exige en T4.

---

## Task 1 — Crear el módulo neutral `src/config/runtime-reference-syntax.ts`

- **ID**: 0116-T1
- **Estado**: pending
- **Objetivo**: Crear `src/config/runtime-reference-syntax.ts` con, copia literal desde los ficheros origen:
  - Desde `src/runtime/runtime-references/runtime-reference-types.ts`, los 6 tipos sintácticos, **exportados con el
    mismo nombre y la misma forma exacta**: `RuntimeReferenceNamespace`, `RuntimeReferenceParseResult`,
    `RuntimeLiteralReference`, `RuntimeSupportedReference`, `RuntimeUnsupportedReference`, `RuntimeInvalidReference`.
  - Desde `src/runtime/runtime-references/runtime-reference-parser.ts`, las 6 constantes privadas
    (`SUPPORTED_NAMESPACES`, `RESERVED_NAMESPACES`, `REFERENCE_PATTERN`, `REFERENCE_SEGMENT_PATTERN`,
    `ITEM_KEY_SYNTHETIC_SEGMENT`, `ITEM_INDEX_SYNTHETIC_SEGMENT`), la interface privada
    `ParseRuntimeReferenceOptions`, las 2 funciones exportadas (`parseRuntimeReference`,
    `hasRuntimeTemplateDelimiter`) y las 7 funciones privadas (`isSupportedNamespace`, `isReservedNamespace`,
    `hasRecognizedNamespace`, `hasValidReferenceShape`, `isSupportedQueryProperty`, `hasValidQueryReferencePath`,
    `createInvalidReference`).
  - El fichero resultante **no tiene ningún `import`**: los tipos que el parser importaba ahora se declaran en el
    mismo fichero.
  - Preservar literalmente la lógica de los casos límite de la spec: rama `item.$key`/`item.$index` en
    `hasValidReferenceShape`, prefijo de escape `value.startsWith('\\')` en `parseRuntimeReference`, y namespaces
    reservados (`navigation`, `routeParams`) devolviendo `unsupported`.
- **Fuera de alcance**: no se modifica ningún fichero existente en esta tarea; en particular
  `runtime-reference-parser.ts` y `runtime-reference-types.ts` quedan **intactos** (duplicación temporal aceptada, ver
  Referencia común). No se reexporta el nuevo módulo desde `src/config/runtime-config.ts`. No se exporta
  `ParseRuntimeReferenceOptions` ni ninguna de las 7 funciones privadas.
- **Dependencias**: ninguna. Primera tarea del plan. Bloquea T2, T3 y T4.
- **Impacto esperado en archivos**:
  - Código: crear `src/config/runtime-reference-syntax.ts`. Ningún fichero modificado.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno (ni nuevo ni ampliación); cubierto por: `0116-T2` y `0116-T3`, que son las tareas que
    conectan realmente el módulo nuevo a sus consumidores y por tanto lo ejercitan a través de la suite existente. El
    módulo creado en esta tarea no lo importa nadie todavía.
  - **Comportamiento cubierto**: ninguno propio en esta tarea. La única verificación exigible aquí es de tipos y
    compilación (`pnpm build`), no de comportamiento.
  - **Comandos durante la implementación**: `pnpm lint`, `pnpm build` (en el orden del gate de CI).
  - **Restricciones**: no escribir ningún test nuevo para el módulo recién creado — la cobertura llega vía los tests de
    regresión existentes en cuanto T2/T3 lo conectan, y añadir un fichero de test nuevo contradiría la regla
    transversal de no reorganizar tests. No ejecutar `pnpm test` completo en esta tarea: con el módulo todavía sin
    importar, `all: true` lo contabiliza al 0% y el resultado no sería informativo.
- **Documentación afectada**: ninguna.
- **Criterios de finalización**:
  - Cierre de implementación: `src/config/runtime-reference-syntax.ts` existe, sin ningún `import`, exportando los 6
    tipos sintácticos y las 2 funciones, y conteniendo las 6 constantes + `ParseRuntimeReferenceOptions` + las 7
    funciones privadas sin exportar. `pnpm lint` y `pnpm build` pasan. `runtime-reference-parser.ts` y
    `runtime-reference-types.ts` no han cambiado.

---

## Task 2 — Redirigir los 6 importadores de `src/config/`

- **ID**: 0116-T2
- **Estado**: pending
- **Objetivo**: Cambiar, en los 6 ficheros de `src/config/` listados en la tabla de la Referencia común (filas 1-6), la
  ruta del import de `'../runtime/runtime-references/runtime-reference-parser'` a `'./runtime-reference-syntax'`,
  manteniendo idéntico el símbolo importado en cada uno (`parseRuntimeReference` en 5 de ellos,
  `hasRuntimeTemplateDelimiter` en `validate-node-shared-helpers.ts`). **Solo cambia la ruta**: ni el nombre del
  símbolo, ni la posición relativa de la línea dentro del bloque de imports si eso obligara a reordenar otras líneas,
  ni ninguna otra línea del fichero.
- **Fuera de alcance**: no se toca ningún fichero de `src/runtime/`; el parser sigue existiendo y sigue teniendo 3
  importadores tras esta tarea (resolver, `runtime-collection-sources.ts`, test de resolución). No se toca
  `validate-api-config.ts` (importa de `runtime-reference-namespace-guards.ts`, no del parser). No se modifica ninguna
  aserción de test.
- **Dependencias**: `0116-T1` (el módulo destino debe existir). Bloquea T4.
- **Impacto esperado en archivos**:
  - Código: modificar `src/config/runtime-reference-namespace-guards.ts`, `src/config/validate-node-shared-helpers.ts`,
    `src/config/validate-form-field-nodes.ts`, `src/config/validate-collection-source.ts`,
    `src/config/validate-actions-visibility.ts`, `src/config/validate-form-choice-items.ts` (una línea de import cada
    uno).
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: ninguno (ni nuevo ni ampliación); cubierto por la suite existente de
    `src/tests/config-validation/`, que ejercita los 6 validadores afectados. Ejecutar como mínimo durante la
    implementación los cinco ficheros listados en "Comandos".
  - **Comportamiento cubierto**:
    - `visibility` sigue aceptando y rechazando exactamente las mismas referencias (`queries.*`, `forms.*`,
      `params.{paramName}`, `item.*`) con los mismos mensajes y códigos de error, vía `validate-actions-visibility.ts`.
    - Las fuentes de colección (`repeater`, `list`, `select`/`radioGroup`/`checkboxGroup`, `table` dinámico) siguen
      aceptando y rechazando las mismas rutas, vía `validate-collection-source.ts` y `validate-form-choice-items.ts`.
    - La expansión de campos de formulario reutilizables sigue validando igual sus referencias, vía
      `validate-form-field-nodes.ts`.
    - Las acciones de botón (`navigateTo.params`, `executeOperation`) siguen validando igual sus referencias.
    - Las operaciones `api` siguen validando igual sus referencias `tokens.*` (camino
      `validate-api-config.ts` → `runtime-reference-namespace-guards.ts` → `parseRuntimeReference`), que es el
      consumidor indirecto del guard redirigido.
    - Los strings con delimitador `{{...}}` siguen detectándose igual en los helpers compartidos de nodo, vía
      `validate-node-shared-helpers.ts`.
  - **Comandos durante la implementación**:
    `pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-collections.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`,
    `pnpm test --run src/tests/config-validation/runtime-config-validation-api-operations.test.ts`.
    Además, `pnpm lint` y `pnpm build` (en el orden del gate de CI).
  - **Restricciones**: no modificar ninguna aserción existente. Si algún test falla, la causa correcta es una
    divergencia introducida al copiar en T1, no una expectativa que haya que ajustar: corregir el módulo nuevo, nunca
    el test.
- **Documentación afectada**: ninguna.
- **Criterios de finalización**:
  - Cierre de implementación: `grep -rn "runtime-reference-parser" src/config/` no devuelve ninguna coincidencia;
    `grep -rn "from './runtime-reference-syntax'" src/config/` devuelve exactamente los 6 ficheros; `pnpm lint` y
    `pnpm build` pasan y los cinco ficheros de test listados pasan.

---

## Task 3 — Redirigir los consumidores de `src/runtime/` y del test, y eliminar el parser

- **ID**: 0116-T3
- **Estado**: pending
- **Objetivo**: Cerrar los 3 importadores restantes y borrar el fichero original:
  - `src/runtime/runtime-references/runtime-reference-resolver.ts`: sustituir
    `import { parseRuntimeReference } from './runtime-reference-parser'` (línea 17) por
    `import { parseRuntimeReference } from '../../config/runtime-reference-syntax'`, y **además** sacar
    `RuntimeSupportedReference` del bloque `import type { ... } from './runtime-reference-types'` (líneas 18-22),
    dejando ahí solo `RuntimeReferenceResolutionResult` y `RuntimeTokenErrorResolution`, y añadiendo
    `import type { RuntimeSupportedReference } from '../../config/runtime-reference-syntax'`.
  - `src/runtime/runtime-collection-sources.ts`: sustituir
    `import { hasRuntimeTemplateDelimiter } from './runtime-references/runtime-reference-parser'` (línea 11) por
    `import { hasRuntimeTemplateDelimiter } from '../config/runtime-reference-syntax'`.
  - `src/tests/runtime/runtime-reference-resolution.test.tsx`: sustituir la ruta del import de
    `parseRuntimeReference` (línea 2) por `'../../config/runtime-reference-syntax'`. Ninguna otra línea del test
    cambia.
  - Eliminar `src/runtime/runtime-references/runtime-reference-parser.ts`.
- **Fuera de alcance**: **no** se podan todavía los 6 tipos sintácticos de `runtime-reference-types.ts` (eso es T4);
  siguen declarados ahí y siguen componiendo los tipos de resolución. No se toca
  `runtime-reference-diagnostics.ts`, ni `runtime-formatter-parser.ts`, ni `runtime-formatter-registry.ts`. No se crea
  ningún barrel en la ruta eliminada. No se modifica ninguna aserción del test de resolución.
- **Dependencias**: `0116-T1` (el módulo destino debe existir). Independiente de `0116-T2` en lo técnico, pero se
  ejecuta después para mantener el orden del plan y poder aislar la causa de cualquier regresión. Bloquea T4.
- **Impacto esperado en archivos**:
  - Código: modificar `src/runtime/runtime-references/runtime-reference-resolver.ts` y
    `src/runtime/runtime-collection-sources.ts`; **eliminar**
    `src/runtime/runtime-references/runtime-reference-parser.ts`.
  - Tests: modificar `src/tests/runtime/runtime-reference-resolution.test.tsx` (solo la ruta del import de la línea 2).
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**: `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación — **solo cambio de ruta
    de import, cero casos nuevos**); el resto del comportamiento afectado está cubierto por la suite existente de
    `src/tests/layout-renderer/` y `src/tests/runtime/`.
  - **Comportamiento cubierto**:
    - `parseRuntimeReference` sigue devolviendo `literal` para strings escapados con `\\` y para strings sin namespace
      reconocido, `supported` para `queries.*`/`forms.*`/`params.*`/`translations.*`/`tokens.*.value` bien formados,
      `unsupported` para `navigation.*`/`routeParams.*` y para `item.*` sin contexto de iteración, e `invalid` para
      rutas con forma incorrecta — exactamente igual que antes del movimiento (ya cubierto por las aserciones vigentes
      del fichero, que no cambian).
    - `resolveRuntimeReference` y sus variantes (`resolveRuntimeTextReference`, `resolveRuntimeVisibleValue`,
      `resolveRuntimeImageSource`, `resolveRuntimeImageAlt`) siguen resolviendo igual contra `RuntimeState`, incluidos
      `item.$key`/`item.$index`.
    - La normalización de fuentes de colección de `runtime-collection-sources.ts` sigue descartando igual los valores
      con delimitador `{{...}}` para `list`, `select`, `radioGroup` y `checkboxGroup`.
    - La paginación local de colecciones sigue comportándose igual.
  - **Comandos durante la implementación**:
    `pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx`,
    `pnpm test --run src/tests/runtime/runtime-collection-pagination.test.ts`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx`,
    `pnpm test --run src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx`.
    Además, `pnpm lint` y `pnpm build` (en el orden del gate de CI). `pnpm lint` es especialmente relevante en esta
    tarea: al sacar `RuntimeSupportedReference` del bloque `import type` del resolver, un tipo que quede importado y sin
    usar solo lo detecta el lint.
  - **Restricciones**: en el fichero de test solo puede cambiar la ruta de la línea 2; cualquier otra modificación
    (aserciones, fixtures, `describe`) queda prohibida en esta tarea. No añadir casos nuevos aunque la cobertura del
    módulo movido parezca mejorable: es cobertura heredada intacta.
- **Documentación afectada**: ninguna.
- **Criterios de finalización**:
  - Cierre de implementación: `src/runtime/runtime-references/runtime-reference-parser.ts` ya no existe;
    `grep -rn "runtime-reference-parser" src/` no devuelve ninguna coincidencia; `pnpm lint` y `pnpm build` pasan y los
    cuatro ficheros de test listados pasan.

---

## Task 4 — Podar `runtime-reference-types.ts` y verificación global de la feature

- **ID**: 0116-T4
- **Estado**: pending
- **Objetivo**: Dejar `src/runtime/runtime-references/runtime-reference-types.ts` conteniendo **solo** tipos de
  resolución:
  - Eliminar las 6 declaraciones sintácticas (`RuntimeReferenceNamespace`, `RuntimeReferenceParseResult`,
    `RuntimeLiteralReference`, `RuntimeSupportedReference`, `RuntimeUnsupportedReference`, `RuntimeInvalidReference`).
  - Añadir como primera línea
    `import type { RuntimeInvalidReference, RuntimeSupportedReference, RuntimeUnsupportedReference } from '../../config/runtime-reference-syntax'`
    (exactamente esos 3 tipos: son los únicos que los tipos de resolución siguen necesitando; ver Referencia común).
  - Conservar sin cambio alguno las 7 declaraciones restantes: `RuntimeReferenceResolutionResult`,
    `RuntimeLiteralResolution`, `RuntimeResolvedReference`, `RuntimeMissingReference`, `RuntimeUnsupportedResolution`,
    `RuntimeInvalidResolution`, `RuntimeTokenErrorResolution`.
  - **No** reexportar los tipos importados (`export type { ... }` queda prohibido: sería un barrel de compatibilidad
    encubierto).
  - Verificar los 6 criterios de aceptación de la spec con los comandos listados abajo y cerrar la feature con el gate
    completo de CI: `pnpm lint` → `pnpm build` → `pnpm test`.
- **Fuera de alcance**: no se toca ningún otro fichero de `src/runtime/runtime-references/`; en particular
  `runtime-reference-diagnostics.ts` sigue importando `RuntimeReferenceResolutionResult` de
  `'./runtime-reference-types'` sin cambio. No se actualiza `ai-workflow/docs/` en esta tarea (la actualización
  documental se hace después, con `update-app-documentation`). No se actualizan las menciones históricas del parser en
  `ai-workflow/features/00xx/`.
- **Dependencias**: `0116-T1`, `0116-T2` y `0116-T3` cerradas. Última tarea del plan.
- **Impacto esperado en archivos**:
  - Código: modificar `src/runtime/runtime-references/runtime-reference-types.ts`.
  - Tests: ninguno a crear o modificar.
  - Documentación: ninguna modificación en esta tarea; ver "Documentación afectada" para el registro de lo que deberá
    revisarse después.
- **Tests**:
  - **Ficheros de test**: ninguno (ni nuevo ni ampliación); cubierto por la suite completa (`pnpm test`), que es el
    gate de cierre de esta tarea. Los tipos son borrados en tiempo de compilación: la verificación real es `pnpm build`
    (`tsc --noEmit` sobre `tsconfig.app.json`).
  - **Comportamiento cubierto**:
    - `pnpm lint` en verde: prueba que no ha quedado ningún import de tipo sin usar tras la poda (`import type` con más
      símbolos de los 3 necesarios), que es el modo de fallo que ni `pnpm build` ni `pnpm test` detectan.
    - `pnpm build` compila sin errores de tipo: prueba que los tipos de resolución siguen componiendo correctamente a
      partir de los tipos sintácticos importados desde la nueva ubicación, y que ningún consumidor externo a
      `runtime-references/` ve un tipo compuesto distinto.
    - `pnpm test` completo en verde: prueba que ni la validación de config, ni la resolución de referencias, ni la
      normalización de colecciones han cambiado de comportamiento en toda la feature.
    - El umbral global de cobertura del 80% (`functions`, `lines`, `statements`) se mantiene tras el movimiento.
  - **Comandos durante la implementación**: `pnpm lint`, `pnpm build`, `pnpm test` (mismo orden que el gate de CI).
  - **Restricciones**: `pnpm test` debe terminar sin ningún `ERROR: Coverage ...`. Si el umbral cayera, la causa
    correcta no es añadir tests nuevos al margen del plan: revisar primero que no haya quedado código muerto del
    movimiento (p. ej. una declaración duplicada olvidada).
- **Verificación explícita de los criterios de aceptación de la spec** (ejecutar los 6 y comprobar el resultado
  esperado):
  1. `grep -rn "runtime-reference-parser" src/` → **sin coincidencias**.
  2. `grep -rln "parseRuntimeReference\|hasRuntimeTemplateDelimiter" src/config/*.ts` → exactamente 7 ficheros: los 6
     importadores redirigidos en T2 más el propio `src/config/runtime-reference-syntax.ts` (que ahora los define). Nota
     de precisión respecto al texto literal de la spec, que dice "los mismos 6 ficheros que hoy": el nuevo módulo vive
     también en `src/config/`, así que el `grep` devuelve 7 rutas, no 6. No es una desviación del contrato: los 6
     importadores siguen siendo los mismos y todos importan de `'./runtime-reference-syntax'`.
  3. `grep -n "from.*config/runtime-reference-syntax" src/runtime/runtime-references/runtime-reference-resolver.ts src/runtime/runtime-collection-sources.ts`
     → coincidencia en ambos (dos en el resolver: la de valor y la de tipo).
  4. Suite existente en verde sin ninguna aserción de comportamiento, mensaje o código de error modificada (`git diff`
     sobre `src/tests/` debe mostrar únicamente el cambio de ruta de la línea 2 de
     `runtime-reference-resolution.test.tsx`).
  5. `pnpm lint`, `pnpm build` y `pnpm test` sin errores.
  6. `grep -rn "from '\.\./runtime" src/config/*.ts` → ninguna coincidencia relacionada con sintaxis de referencias.
- **Documentación afectada**: `ai-workflow/docs/architecture.md` — candidata a una mención explícita de que la sintaxis
  de referencias (`parseRuntimeReference`, `hasRuntimeTemplateDelimiter` y los tipos sintácticos) vive como contrato
  neutral en `src/config/runtime-reference-syntax.ts` y la consumen ambas capas, matizando la frontera "la resolución
  de referencias vive en `runtime-references/`" (que sigue siendo cierta para la resolución contra estado en vivo).
  Registrado aquí como referencia para cuando se invoque `update-app-documentation`; **no se edita en esta tarea**.
  No requieren cambio: `ai-workflow/docs/app-features/config/index.md` ni sus sub-documentos,
  `ai-workflow/docs/app-features/references/index.md` ni sus sub-documentos (ningún comportamiento ni mensaje cambia),
  ni `ai-workflow/docs/test-index.md` (ningún fichero de test se añade, mueve, divide ni elimina).
- **Criterios de finalización**:
  - Cierre de implementación: `runtime-reference-types.ts` declara exactamente 7 tipos (todos de resolución) e importa
    3 tipos sintácticos del nuevo módulo sin reexportarlos; los 6 criterios de aceptación verificados con el resultado
    esperado; `pnpm lint`, `pnpm build` y `pnpm test` completos en verde, incluido el umbral de cobertura.
