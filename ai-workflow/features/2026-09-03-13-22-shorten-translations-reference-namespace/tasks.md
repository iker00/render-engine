# Tareas — Namespace corto para referencias de traducción (`t.` en lugar de `translations.`)

## Cómo leer este documento
Contrato de ejecución secuencial. Cada tarea se implementa de forma aislada, con su propio contrato de tests. El orden es estricto: T1 → (T2 y T3, en cualquier orden o en paralelo, ambas dependen solo de T1).

Siguiente tarea a escoger: **T1**.

Nota transversal de secuenciación: este es un cambio de contrato breaking sin alias ni periodo de transición (ver spec, "Fuera de alcance"). Hasta que T1 se complete, el namespace `t` no existe como referencia reconocida. Al completar T1, cualquier fixture que todavía use `translations.{key}` como referencia deja de resolverse como traducción (se trata como literal) hasta que T2/T3 la migren. Esa regresión transitoria en ficheros fuera del alcance de T1 es la consecuencia esperada de la secuenciación, no un defecto de T1; se cierra al completar T2 y T3, antes del gate final `pnpm test` de la pasada de implementación.

---

## T1 — Renombrar el namespace `translations` a `t` en el parser y el resolver

### Objetivo
Cambiar el namespace de referencia reconocido de `translations` a `t` en la capa de sintaxis de referencias (`src/config/runtime-reference-syntax.ts`) y en el resolver runtime (`src/runtime/runtime-references/runtime-reference-resolver.ts`), preservando exactamente las mismas reglas de forma (un único segmento) y de resolución (mismo catálogo, mismo idioma activo, misma cadena de fallback) que hoy tiene `translations`.

### Fuera de alcance
- Cualquier fichero fuera de los dos ficheros de código y el fichero de test listados en esta tarea. Los demás consumidores (tests de otros dominios, `src/dev/config.json`, documentación) se actualizan en T2 y T3.
- El bloque raíz `translations` del JSON de configuración (catálogo de traducciones), sus tipos (`RuntimeTranslationsConfig`, `RuntimeTranslationsLangMap`), `state.i18n.translations`, el endpoint `getTranslationsBatch` y el dominio `translations` del editor dev (`ToolbarDomain`, `TranslationsConfigPanel`). Nada de esto cambia de nombre.
- Los diagnósticos de consola (`console.warn` en `src/runtime/runtime-references/runtime-reference-diagnostics.ts`): ya derivan el texto del `reference.source` real, no requieren cambio de código; su comportamiento correcto con el nuevo namespace se verifica dentro de los tests de esta tarea, no se modifica el fichero de diagnósticos.
- Cualquier otro namespace de referencia (`queries`, `forms`, `params`, `item`, `row`, `tokens`, `switch`).

### Dependencias
Ninguna. Esta tarea puede empezar de inmediato; bloquea T2 y T3.

### Interfaces
**Consume**: ninguno.
**Produce**: ninguno nuevo — `parseRuntimeReference(value: string, options?: ParseRuntimeReferenceOptions): RuntimeReferenceParseResult` y `resolveRuntimeReference(reference: string, state: RuntimeState, options?: ResolveRuntimeReferenceOptions): RuntimeReferenceResolutionResult` (ambas ya existentes, sin cambio de firma) pasan a reconocer `'t'` como namespace soportado en vez de `'translations'`. T2 y T3 dependen de este comportamiento, no de una firma nueva.

### Impacto esperado en archivos
- Código a modificar:
  - `src/config/runtime-reference-syntax.ts`: el literal de tipo `'translations'` en `RuntimeReferenceNamespace` y en el tipo `namespace` de `RuntimeSupportedReference` pasa a `'t'`; la entrada `'translations'` en `SUPPORTED_NAMESPACES` pasa a `'t'`; la alternativa `translations` en `REFERENCE_PATTERN` pasa a `t`; la comparación `namespace === 'translations'` en `hasRecognizedNamespace` pasa a `namespace === 't'`; el `case 'translations':` en `hasValidReferenceShape` pasa a `case 't':` (misma regla `path.length === 1`).
  - `src/runtime/runtime-references/runtime-reference-resolver.ts`: la comparación `reference.namespace === 'translations'` (línea ~300) pasa a `reference.namespace === 't'`. El resto del bloque (lectura de `state.i18n`, cadena de fallback activo → `es` → nombre de clave en dev / vacío en prod) no cambia.
- Tests a modificar: ver bloque de tests.
- Documentación a revisar: ver "Documentación afectada".

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación) — modificar únicamente las secciones `describe('T0050-03 translations reference parser contract', ...)` y `describe('T0050-04 translations resolver with fallback chain', ...)` (bloque contiguo, aprox. líneas 1463–1694 antes de esta tarea). No tocar el resto del fichero, incluida la sección `T0078-05 tokens reference parser contract` inmediatamente posterior.

**Comportamiento cubierto**:
- `parseRuntimeReference('t.confirmBtn')` clasifica como `{ kind: 'reference', status: 'supported', namespace: 't', path: ['confirmBtn'] }`.
- `parseRuntimeReference('t')` (sin segmento) clasifica como `{ kind: 'reference', status: 'invalid', namespace: 't' }`.
- `parseRuntimeReference('t.group.key')` (dos segmentos) clasifica como inválida.
- `parseRuntimeReference('t.with.too.many.segments')` clasifica como inválida.
- `parseRuntimeReference('t.confirm-btn')` (segmento con guiones) clasifica como soportada con `path: ['confirm-btn']`.
- `parseRuntimeReference('t.')` (segmento vacío) clasifica como inválida.
- `parseRuntimeReference('\\t.confirmBtn')` (escapado) se trata como literal `{ kind: 'literal', value: 't.confirmBtn' }`.
- `parseRuntimeReference('t.confirmBtn ')` (con espacio final en el segmento) clasifica como inválida.
- Caso nuevo explícito: `parseRuntimeReference('translations.confirmBtn')` ya NO se reconoce como referencia — clasifica como `{ kind: 'literal', value: 'translations.confirmBtn' }`, porque `translations` deja de estar en `hasRecognizedNamespace`.
- `resolveRuntimeReference('t.confirmBtn', state)` resuelve al valor del idioma activo cuando la clave existe en ese idioma.
- Fallback al idioma por defecto (`es`) cuando el idioma activo no tiene la clave pero `es` sí.
- Fallback al nombre de la clave en modo dev (`import.meta.env.DEV`) cuando la clave no existe en ningún idioma.
- Fallback a string vacío en modo producción (`vi.stubEnv('DEV', false)`) cuando la clave no existe en ningún idioma.
- Mismo comportamiento de fallback (nombre de clave en dev / vacío en prod) cuando el catálogo `translations` del estado está vacío.
- `resolveRuntimeVisibleValue('Texto: {{t.confirmBtn}}', state, 'heading.props.text')` interpola correctamente dentro de un string más largo, para el idioma activo y para el fallback a `es`.
- Forma inválida `t.group.key` se mantiene `status: 'invalid'` en `resolveRuntimeReference` y degrada a string vacío en `resolveRuntimeVisibleValue`, sin lanzar excepción; el `console.warn` de desarrollo sigue disparándose (mismo mecanismo ya cubierto, sin verificar el texto exacto del mensaje).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx
```

**Restricciones**:
- No renombrar los títulos `describe`/`it` de forma que pierdan trazabilidad con el identificador histórico `T0050`; puede añadirse mención a `t.*` en el texto del título, pero no es obligatorio.
- No modificar `src/tests/config-validation/runtime-config-validation-translations.test.ts` (valida el bloque raíz `translations`, fuera de alcance de esta tarea).
- El caso nuevo de literal `translations.confirmBtn` debe añadirse dentro de la sección `T0050-03` reutilizada, no como fichero ni describe nuevo.

### Documentación afectada
- `ai-workflow/docs/app-features/references/reference-resolution.md`: sección "Frontera específica de `translations.*`" pasa a "Frontera específica de `t.*`"; el catálogo de referencias soportadas sustituye `translations.{key}` por `t.{key}`.
- `ai-workflow/docs/app-features/references/dynamic-strings.md`: la mención de `translations.{key}` en "En superficies visibles" pasa a `t.{key}`.

### Criterios de finalización
El parser reconoce `t.{key}` con la misma forma que antes tenía `translations.{key}` y deja de reconocer `translations.{key}` como referencia; el resolver resuelve `t.{key}` con idéntica cadena de fallback; los tests de esta tarea (parser + resolver + interpolación + degradación) están en verde.

### Cierre de implementación
Código de `runtime-reference-syntax.ts` y `runtime-reference-resolver.ts` actualizado; `src/tests/runtime/runtime-reference-resolution.test.tsx` actualizado y en verde para los comandos listados. (Se acepta que, en este punto, otros ficheros de test fuera del alcance de esta tarea queden en rojo por el cambio breaking — se resuelve en T2/T3 antes del gate final de la pasada de implementación.)

---

## T2 — Migrar las referencias `translations.{key}` a `t.{key}` en los tests existentes fuera del parser/resolver

### Objetivo
Actualizar todos los fixtures de test ya existentes que usan `translations.{key}` como referencia de traducción (fuera de los ficheros ya cubiertos en T1) para que usen `t.{key}`, conservando exactamente las mismas aserciones y el mismo comportamiento esperado.

### Fuera de alcance
- `src/tests/runtime/runtime-reference-resolution.test.tsx` (cerrado en T1).
- `src/tests/config-validation/runtime-config-validation-translations.test.ts` (valida el bloque raíz `translations`, no la sintaxis de referencia; no se toca).
- Cualquier test que use la palabra "translations" para el dominio del editor dev (`ToolbarDomain`, `activeDomain`), para `RuntimeConfig['translations']` como tipo, o para el catálogo raíz de traducciones — esos usos no son referencias de namespace y no cambian.
- `src/dev/config.json` (cubierto en T3).
- Añadir casos de test nuevos no relacionados con esta migración.

### Dependencias
T1 debe estar completada (el parser/resolver debe reconocer `t.{key}` antes de que estas aserciones puedan pasar).

### Interfaces
**Consume**: ninguno con firma explícita — depende del comportamiento de reconocimiento/resolución de `t.{key}` provisto por T1 (sin firma nueva expuesta).
**Produce**: ninguno.

### Impacto esperado en archivos
- Tests a modificar (todos "ampliación", ningún fichero nuevo):
  - `src/tests/layout-renderer/layout-renderer-translations.test.tsx`
  - `src/tests/layout-renderer/layout-renderer-file-manager.test.tsx`
  - `src/tests/config-validation/runtime-config-validation-tooltip.test.ts`
  - `src/tests/layout-renderer/layout-renderer-tooltip.test.tsx`
  - `src/tests/runtime-state/runtime-state-validations-rules.test.tsx`
  - `src/tests/runtime/runtime-file-manager-hook.test.tsx`
  - `src/tests/runtime/runtime-file-manager-resolve-label.test.ts`
  - `src/tests/runtime/runtime-form-validation-message.test.ts`
  - `src/tests/runtime/runtime-form-validations.test.ts`
- Documentación a revisar: ver "Documentación afectada".

### Tests
**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-translations.test.tsx` (ampliación)
- `src/tests/layout-renderer/layout-renderer-file-manager.test.tsx` (ampliación)
- `src/tests/config-validation/runtime-config-validation-tooltip.test.ts` (ampliación)
- `src/tests/layout-renderer/layout-renderer-tooltip.test.tsx` (ampliación)
- `src/tests/runtime-state/runtime-state-validations-rules.test.tsx` (ampliación)
- `src/tests/runtime/runtime-file-manager-hook.test.tsx` (ampliación)
- `src/tests/runtime/runtime-file-manager-resolve-label.test.ts` (ampliación)
- `src/tests/runtime/runtime-form-validation-message.test.ts` (ampliación)
- `src/tests/runtime/runtime-form-validations.test.ts` (ampliación)

**Comportamiento cubierto** (mismas aserciones que ya existen hoy con `translations.`, reescritas sobre `t.`):
- `layout-renderer-translations.test.tsx`: `button.props.label`, `heading.props.text` (literal e interpolado `{{t.greeting}}`), `image.props.alt` y `visibility.reference` resuelven vía `t.{key}` con el mismo resultado esperado por idioma activo (`es`, `en`, fallback a `es` desde `fr`, default sin `activeLanguage`); el caso de clave ausente sigue mostrando el nombre de la clave en dev y string vacío en prod; `t.group.key` (dos segmentos) sigue degradando a string vacío sin lanzar excepción.
- `layout-renderer-file-manager.test.tsx`: el test `'resolves labels.listEmpty as a translations.* reference according to activeLanguage'` pasa a usar `labels: { listEmpty: 't.vacio' }` (antes `'translations.vacio'`) y sigue resolviendo `'Sin ficheros'` para `activeLanguage: 'es'` contra el catálogo `{ vacio: { es: 'Sin ficheros', en: 'No files' } }`; renombrar el título del test para reflejar `t.*` en vez de `translations.*`.
- `runtime-config-validation-tooltip.test.ts`: los dos tooltips con `{{t.helpText}}` (antes `{{translations.helpText}}`) siguen aceptándose como shape válido.
- `layout-renderer-tooltip.test.tsx`: `{{t.helpText}}` resuelve el tooltip esperado; `{{t.missing}}` degrada según el comportamiento ya cubierto.
- `runtime-state-validations-rules.test.tsx`: el mensaje de validación `{{t.field_required}}` resuelve vía el catálogo del idioma activo igual que antes con `{{translations.field_required}}`.
- `runtime-file-manager-hook.test.tsx`: los labels `t.subidaSinLista` y `t.borradoFallido` resuelven igual que antes.
- `runtime-file-manager-resolve-label.test.ts`: `t.saludo` como referencia completa de label, `{{t.foo}} - {{fileName}}` como interpolación combinada, y el caso de no reinterpolar un placeholder ya resuelto que contiene `{{t.foo}}` literal.
- `runtime-form-validation-message.test.ts`: `{{t.max_length_error}}`, fallback de `{{t.unknown_key}}` sin entrada en catálogo, y combinación `{{value}}` + `{{t.greeting}}` en un mismo mensaje.
- `runtime-form-validations.test.ts`: `{{t.max_length_error}}` en `maxLength`, `{{t.tipoNoValido}}` en `accept`, `{{t.excedido}}` en `maxTotalSize` (batch scope).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/layout-renderer/layout-renderer-translations.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-file-manager.test.tsx
pnpm test --run src/tests/config-validation/runtime-config-validation-tooltip.test.ts
pnpm test --run src/tests/layout-renderer/layout-renderer-tooltip.test.tsx
pnpm test --run src/tests/runtime-state/runtime-state-validations-rules.test.tsx
pnpm test --run src/tests/runtime/runtime-file-manager-hook.test.tsx
pnpm test --run src/tests/runtime/runtime-file-manager-resolve-label.test.ts
pnpm test --run src/tests/runtime/runtime-form-validation-message.test.ts
pnpm test --run src/tests/runtime/runtime-form-validations.test.ts
```

**Restricciones**:
- Cambio mecánico: sustituir `translations.` por `t.` únicamente donde el string es una referencia de traducción (namespace), no donde la palabra "translations" aparece como identificador de otra cosa (tipos, props no relacionadas, nombres de variable de test).
- No cambiar el valor esperado (`expect(...)`) de ningún test salvo el propio string de referencia de entrada.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/file-input.md`
- `ai-workflow/docs/app-features/nodes/file-manager.md`
- `ai-workflow/docs/app-features/forms/validation-rules.md`
- `ai-workflow/docs/test-index.md` (descripciones de `layout-renderer-translations.test.tsx` y `runtime-form-validation-message.test.ts`, y opcionalmente `runtime-file-manager-resolve-label.test.ts`, que mencionan `translations.*`/`translations` en su rol)

### Criterios de finalización
Los 9 ficheros de test listados usan `t.{key}` en lugar de `translations.{key}` en sus fixtures y están en verde para los comandos listados, sin cambiar el resultado esperado de ningún test.

### Cierre de implementación
Los 9 comandos `pnpm test --run` de esta tarea pasan en verde.

---

## T3 — Migrar la sección de documentación de `translations.*`/`t.*` en `src/dev/config.json`

### Objetivo
Actualizar la sección de la app de documentación interactiva embebida en `src/dev/config.json` que hoy demuestra `translations.*` (heading, párrafo explicativo, dos interpolaciones `{{translations.welcome_title}}`/`{{translations.docs_subtitle}}` y el párrafo de cierre sobre la frontera del namespace) para que use `t.*`, sin tocar el bloque raíz `"translations": {...}` que declara el catálogo de esa misma sección de ejemplo.

### Fuera de alcance
- El bloque raíz `"translations": { "welcome_title": ..., "docs_subtitle": ... }` de esa sección: sigue siendo el catálogo de traducciones, no cambia de nombre ni de forma. El texto de ejemplo del párrafo que muestra literalmente ese JSON (`"{ \"translations\": { ... } }"`) tampoco cambia: describe el catálogo raíz, no una referencia.
- Cualquier otra sección de `src/dev/config.json` no relacionada con la demostración de `translations.*`/`t.*`.
- Cualquier fichero de test (cubiertos en T1/T2).

### Dependencias
T1 debe estar completada.

### Interfaces
**Consume**: ninguno con firma explícita.
**Produce**: ninguno.

### Impacto esperado en archivos
- Config a modificar: `src/dev/config.json`, sección "Catalogo raiz de esta app de documentacion" y su heading/párrafo introductorio y de cierre (bloque `translations.*` dentro del contenedor de referencias dinámicas).
- Documentación a revisar: ver "Documentación afectada".

### Tests
**Ficheros de test**: ninguno nuevo; cubierto por la suite existente `src/tests/config-validation/runtime-config-root-zod.test.ts` (sin modificar), que ya valida `src/dev/config.json` completo contra el esquema Zod raíz.

**Comportamiento cubierto**:
- `src/dev/config.json` sigue siendo una configuración válida contra el esquema Zod raíz tras sustituir, en la sección afectada, las referencias `translations.{key}` por `t.{key}` en el heading, el párrafo explicativo, las dos interpolaciones y el párrafo de cierre.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/config-validation/runtime-config-root-zod.test.ts
```

**Restricciones**:
- No modificar el bloque raíz `"translations": {...}` de esa sección ni el párrafo que lo muestra como JSON literal.
- Cambio de texto exacto:
  - heading `"translations.*"` → `"t.*"`
  - párrafo `"translations.{key} resuelve un valor desde el catalogo raiz translations, ..."` → mismo texto sustituyendo únicamente `translations.{key}` por `t.{key}` (el resto de la frase, incluida la mención al catálogo raíz `translations`, no cambia)
  - `"{{translations.welcome_title}}"` → `"{{t.welcome_title}}"`
  - `"{{translations.docs_subtitle}}"` → `"{{t.docs_subtitle}}"`
  - párrafo de cierre `"translations.* solo admite exactamente un segmento tras el namespace (translations.group.key no es valido) y queda fuera de alcance en ..."` → mismo texto sustituyendo `translations.*` por `t.*` y `translations.group.key` por `t.group.key`

### Documentación afectada
- `ai-workflow/docs/app-features/development/local-config.md`
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`

### Criterios de finalización
La sección de `src/dev/config.json` referida usa `t.*` en vez de `translations.*` para todas las referencias (heading, párrafo, interpolaciones, párrafo de cierre), preserva sin cambios el bloque raíz `"translations": {...}` de esa sección, y el fichero sigue validando contra el esquema Zod raíz.

### Cierre de implementación
`pnpm test --run src/tests/config-validation/runtime-config-root-zod.test.ts` en verde tras la edición.
