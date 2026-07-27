# Design: Feature 0090 - file-manager-custom-literals

## Contexto

- El nodo `fileManager` mantiene hoy sus textos y aria-labels fijos, distribuidos entre `file-manager-drop-zone.tsx`,
  `file-manager-list.tsx`, `file-manager-row.tsx`, `file-manager-error-list.tsx` y `use-file-manager.ts`. Ningún literal
  se enruta hoy por el motor central de referencias.
- El motor central de interpolación vive en `src/runtime/runtime-references/runtime-reference-resolver.ts`. Ya resuelve
  referencias completas, interpolación parcial `{{...}}`, `translations.*` (con la cadena de fallback documentada) y
  anota `RuntimeReferenceSurface` para diagnósticos. Su forma actual de escanear placeholders es un único
  `String.prototype.replace` sobre `RUNTIME_TEMPLATE_PLACEHOLDER_PATTERN`, sin ningún canal previsto para placeholders
  locales de un literal concreto.
- El único caso vigente de placeholder no-referencia dentro de un texto interpolado es `{{value}}` en mensajes de
  validación de formulario. Se resuelve en `formatValidationMessage` (`src/runtime/runtime-form-validations.ts`)
  haciendo una sustitución previa vía regex antes de delegar en `resolveRuntimeTextReference`.
- Las reglas de fichero (`accept`, `maxFileSize`, `maxTotalSize`, `maxFiles`, `validFileNames`) usadas por `fileManager`
  y `fileInput` viven en `evaluateFileManagerBatch` (mismo fichero). Hoy ese código construye el mensaje con
  `message ?? "default"` **sin pasar por `formatValidationMessage`**, así que `{{translations.*}}` dentro de `message`
  se muestra sin resolver. Es el mecanismo compartido que la feature debe corregir.
- `RuntimeReferenceSurface` es una unión discriminada. Añadir nuevas superficies visibles es puro tipado + entrada en
  `dynamic-strings.md`.
- El contrato de `fileManager` se valida en `src/config/runtime-config-zod.ts` (`fileManagerNodeSchema`) y
  `src/config/validate-file-manager-nodes.ts`. El primero rechaza tipos incorrectos con Zod; el segundo cubre
  validaciones cruzadas.
- La feature es puramente aditiva sobre el contrato JSON: la ausencia total de `labels` produce el mismo render que hoy.

## Objetivos / No objetivos

### Objetivos

- Permitir personalizar por config los literales del catálogo cerrado listado en `spec.md` sección 2, reutilizando el
  motor de interpolación central sin duplicar lógica.
- Soportar en cada clave de `labels` las mismas formas ya soportadas en superficies visibles: literal fijo, referencia
  completa `translations.{key}`, interpolación parcial con `{{translations.key}}`, escape `\`.
- Exponer placeholders propios por literal (`{{formats}}`, `{{completed}}`, `{{total}}`, `{{percent}}`, `{{count}}`,
  `{{max}}`, `{{fieldName}}`, `{{fileName}}`) resueltos por la misma pasada del motor, degradando placeholders no
  reconocidos a string vacío sin romper el resto del texto.
- Rechazar en bootstrap `labels` con claves no reconocidas o con valores no string, con locator preciso
  `fileManager.props.labels.{clave}`.
- Corregir el mecanismo compartido de resolución del `message` de las reglas de fichero (`accept`, `maxFileSize`,
  `maxTotalSize`, `maxFiles`, `validFileNames`) para que soporte `{{translations.*}}` en `fileManager` y `fileInput` sin
  duplicar código respecto a las reglas estándar.
- No regresionar el comportamiento del componente cuando `labels` está omitido, aunque no exista ninguna configuración
  `labels` previa.

### No objetivos

- Ampliar el catálogo de literales personalizables más allá de la lista cerrada de la spec.
- Introducir literales personalizables en otros nodos (`table`, `repeater`, etc.).
- Reescribir el catálogo `translations.*` o su cadena de fallback.
- Añadir un canal genérico de placeholders locales en todas las superficies visibles; el canal se generaliza pero solo
  se consume desde `fileManager` en v1.
- Refactor visual del componente ni cambio de estilos.
- Corregir el idioma por defecto del aria-label de la zona DnD (se mantiene en inglés salvo que se declare
  `labels.dropzoneAriaLabel`).

## Decisiones

### D1. Contrato: `props.labels` como bloque opcional con claves cerradas

- Añadir `labels?: FileManagerLabels` a las props de `fileManager` en `runtime-config-types.ts` y
  `runtime-config-zod.ts`.
- `FileManagerLabels` es un `Record<KnownKey, string>` donde `KnownKey` es la unión literal del catálogo cerrado de la
  spec.
- Cada clave es opcional (`.optional()` en Zod). El bloque `labels` completo es también opcional.
- Zod `strict()` sobre el objeto: **claves desconocidas → invalid config** con path `fileManager.props.labels.{clave}`.
  Motivación: v1 declara catálogo cerrado; una clave desconocida suele ser un typo, no una extensión válida.
- Cada valor es `z.string()`; cualquier otro tipo → invalid config con el mismo path.
- Alternativa descartada: aceptar el bloque como `Record<string, string>` libre y solo tiparlo. Se rechaza porque hace
  silencioso un typo (`dropzoneidle` en vez de `dropzoneIdle`) y contradice la spec de catálogo cerrado.

### D2. Motor de interpolación: canal `localPlaceholders`

- Extender `resolveRuntimeVisibleValue` y `resolveRuntimeTextReference` con un parámetro opcional
  `localPlaceholders?: Record<string, string>` en su bolsa `options`.
- Dentro de `resolveRuntimeInterpolatedVisibleValue`, al procesar cada match `{{...}}`:
    - trim del contenido,
    - si existe en `localPlaceholders`, se sustituye por su valor (ya string) sin volver a pasar por el resolutor de
      referencias,
    - si no, se sigue el camino existente (parse como referencia → resolución → warning en DEV si no resuelve).
- El canal se resuelve dentro de la misma pasada `replace`, así que no hay doble interpolación: un valor de placeholder
  que contenga literalmente `{{translations.foo}}` no se re-interpreta, se muestra tal cual.
- Alternativa descartada A: pre-sustituir los placeholders locales fuera del motor con un `replace` previo (patrón
  `{{value}}` actual). Se descarta porque el valor de `{{fileName}}` puede contener `{{...}}` (nombres de fichero
  arbitrarios); el pre-replace convertiría eso en una referencia falsa que el motor intentaría resolver.
- Alternativa descartada B: añadir un motor específico dentro de `fileManager`. Se descarta porque duplica el catálogo
  de referencias soportadas y fragmenta la lógica documentada en `dynamic-strings.md` y `reference-resolution.md`.
- Coste asumido: nuevo camino de opciones en el motor central que solo `fileManager` consume en v1. Se acepta porque el
  hueco es pequeño (una propiedad opcional), la puerta queda abierta a futuros nodos con placeholders propios (`table`
  de errores, banners de subida en otros nodos, etc.), y evita duplicar el escáner de placeholders.

### D3. `formatValidationMessage` migra a `localPlaceholders`

- Reemplazar la sustitución previa de `{{value}}` en `formatValidationMessage` por una llamada a
  `resolveRuntimeTextReference(rule.message, state, 'form.validation.message', { iterationContext, localPlaceholders: { value: valueStr } })`.
- Efecto: unifica la vía por la que se interpolan `{{value}}` y `{{translations.*}}` en mensajes de validación estándar;
  sin cambio de comportamiento observable.
- Motivación: cualquier futuro añadido de placeholder específico por regla (ej. `{{limit}}`, `{{count}}`) entra por el
  mismo canal sin abrir otro path de pre-replace.

### D4. Superficies `RuntimeReferenceSurface` para `labels`

- Añadir a `RuntimeReferenceSurface` la superficie `` `fileManager.props.labels.${string}` `` (patrón template-literal,
  ya usado para `accordion[...]` y `tabs[...]`), y añadir `fileManager.props.validations.message` para la corrección de
  mensajes de validación de fichero.
- Los consumidores de `labels` reportarán con la superficie concreta `fileManager.props.labels.dropzoneIdle` (etc.),
  para que los diagnósticos en DEV sean legibles.
- Alternativa descartada: reutilizar `form.validation.message` para las validaciones de fichero. Se descarta porque los
  mensajes de fichero no viven en `forms.*.error` (en `fileManager`) y confundiría el warning con reglas de formulario
  estándar.

### D5. Consumo desde `fileManager`: helper `resolveFileManagerLabel`

- Crear un helper co-localizado con el nodo (`src/runtime/nodes/file-manager/resolve-file-manager-label.ts`) con firma:
  ```
  resolveFileManagerLabel({ labels, key, defaultText, placeholders, state, iterationContext })
  ```
- Contrato:
    - Si `labels?.[key]` es `undefined` → devuelve `defaultText` sin pasar por el motor (el texto por defecto se
      mantiene exactamente como hoy, incluido su idioma).
    - Si `labels?.[key]` es `""` → devuelve `""` (caso límite `labels.<clave>: ""` explícito en la spec).
    - Si `labels?.[key]` es un string no vacío → invoca
      `resolveRuntimeTextReference(labels[key], state, 'fileManager.props.labels.{key}', { iterationContext, localPlaceholders: placeholders })`.
- Los sitios de render (`file-manager-drop-zone.tsx`, `file-manager-list.tsx`, `file-manager-row.tsx`,
  `file-manager-error-list.tsx`, `use-file-manager.ts`) consumen exclusivamente este helper y pasan el `defaultText`
  actual como parámetro. Los textos por defecto viven aquí (no se centralizan en una tabla) para no reintroducir un
  catálogo paralelo.
- `iterationContext` se toma del contexto de render del nodo. `fileManager` no vive dentro de `repeater` en la
  práctica (spec no describe ese uso), pero el helper lo acepta para no cortar prematuramente esa vía.

### D6. Placeholders por literal

- Los placeholders de cada literal se computan en el sitio de consumo, no en el helper, para mantener locales tanto la
  mecánica de cálculo como el tipado:
    - `dropzoneAcceptedFormats`: `{ formats: acceptExtension.join(', ') }`.
    - `dropzoneProgress`: `{ completed, total, percent }` (string, string, string).
    - `dropzoneSuccess`: `{ count }`.
    - `dropzoneMaxFilesReached`: `{ max }`.
    - `dropzoneAriaLabel`: `{ fieldName }`.
    - `uploadFileError`: `{ fileName }`.
- Placeholders numéricos se pasan como `String(value)` explícito antes de entrar al motor; el canal `localPlaceholders`
  es `Record<string, string>` por diseño (evita coerción implícita).
- Un placeholder ausente en un literal concreto no se “declara vacío”: al no estar en el mapa, cae al camino de
  referencia; como `{{count}}` no es una referencia soportada, resuelve a string vacío con warning en DEV. Este
  comportamiento es coherente con `dynamic-strings.md` y con la spec.

### D7. Corrección de `evaluateFileManagerBatch` (validaciones de fichero)

- Extender la firma de `evaluateFileManagerBatch` con `state: RuntimeState` (obligatorio) y
  `iterationContext?: RuntimeIterationContext` (opcional). Sus llamantes (`use-file-manager.ts` y el handler de
  selección de `fileInput` — a localizar en `src/runtime/nodes/file-input/…`) ya tienen acceso al store del runtime;
  pasan `state` sin fricción.
- Extraer un helper local
  `formatFileRuleMessage({ ruleName, ruleValue, message, defaultMessage, state, iterationContext })` que:
    - Si `message === undefined` → devuelve `defaultMessage`.
    - Si `message === ""` → devuelve `""`.
    - En otro caso, llama a
      `resolveRuntimeTextReference(message, state, 'fileManager.props.validations.message', { iterationContext, localPlaceholders: { value: normalizeFileRuleValue(ruleValue) } })`.
- `normalizeFileRuleValue` produce `String(ruleValue)` cuando `ruleValue` es número (caso de `maxFileSize`,
  `maxTotalSize`, `maxFiles`) y `""` cuando no lo es (caso de `accept` y `validFileNames`, cuyo `value` es `string[]`).
  Esto mantiene la contract-line de `validation-rules.md`: “si la regla no tiene un valor numérico significativo, se
  interpola como string vacío”.
- Los `default` message actuales de `evaluateFileManagerBatch` (los strings en español codificados) se conservan como
  `defaultMessage` para preservar el comportamiento sin `message` declarado.
- El helper `formatFileRuleMessage` **no** se une físicamente a `formatValidationMessage` porque:
    - `formatValidationMessage` asume `rule.value: number | true`; las reglas de fichero incluyen `string[]`, y forzar
      la firma a admitir todos los casos ensucia el tipo compartido.
    - La superficie de diagnóstico es distinta (`fileManager.props.validations.message` vs `form.validation.message`).
- El paralelismo lógico entre ambos helpers queda documentado con un comentario mínimo y tests que verifican ambos
  caminos.

### D8. Migración y compatibilidad

- No hay migración de datos. `labels` es opcional y su ausencia es indistinguible del comportamiento actual.
- No hay cambio de contrato en la respuesta de red ni en `queries.*`.
- La firma pública de `evaluateFileManagerBatch` cambia (nuevos parámetros); es API interna, no forma parte del contrato
  del runtime. Los tests que hoy la invocan directamente se ajustan en la fase de planning.

## Riesgos y trade-offs

- **Interferencia entre `translations.*` y placeholders locales.** Si un desarrollador declara
  `translations.dropzoneUploading` en el catálogo y a la vez
  `labels.dropzoneUploading: "translations.dropzoneUploading"`, se resuelve como referencia completa (caso existente, no
  afectado por la feature). No hay ambigüedad porque `localPlaceholders` solo mira nombres bare sin namespace conocido;
  una referencia completa entra por el camino de literal-vs-referencia, no por el escáner de placeholders.
- **Renders adicionales.** El helper se invoca por render, pero el trabajo por render es proporcional al número de
  literales visibles (< 15 en el peor caso) y solo ejecuta `String.prototype.replace` cuando el valor contiene `{{`; el
  coste es despreciable frente al `use-file-manager` actual. No se introducen memoizations nuevas; si algún test de
  performance detectara un problema, se abordaría fuera de esta feature.
- **Estricto en claves desconocidas.** Rechazar `labels` con claves fuera del catálogo detecta typos, pero también rompe
  configs si en el futuro añadimos claves y un JSON de producción precede al frontend con el nuevo catálogo. Se asume:
  el catálogo lo controla el backend legacy tanto como el JSON, y prefiere fallo explícito a texto silenciosamente
  ignorado. Mitigación: el error de bootstrap identifica la clave concreta.
- **Superficie `fileManager.props.labels.{key}` en template-literal.** Cada clave produce un string distinto de
  superficie. Los warnings en DEV serán granulares; no hay coste en producción (`import.meta.env.DEV` gate ya
  existente).
- **Corrección de `evaluateFileManagerBatch` extendiendo la firma.** Cualquier test que llame la función sin pasar
  `state` deja de compilar; se aborda en tests durante planning. En runtime no hay más llamantes que los dos hooks
  documentados.
- **Nombres de fichero con `{{…}}`.** El canal `localPlaceholders` los aísla del motor de referencias. Riesgo residual:
  si un dev pasa el nombre como referencia (no como placeholder), la referencia falla y degrada a `""` — pero esto ya es
  el contrato existente para valores no resolubles.

## Migración o despliegue

No aplica. Feature aditiva. Configuraciones sin `labels` se renderizan igual que hoy. Configuraciones que declaren
`labels.<clave>: "{{translations.…}}"` empiezan a resolver el mismo día en que el frontend con la feature entra en
producción.

## Preguntas abiertas

Ninguna decisión técnica bloqueante pendiente. Riesgos residuales quedan cubiertos por trade-offs asumidos arriba.
