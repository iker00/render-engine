# 0093 — Plan de implementación

## Tarea 1 — Añadir translations y tokens al schema Zod raíz

**Estado**: completada

**Objetivo**: Incluir `translations` y `tokens` como propiedades opcionales en `runtimeConfigRootSchema` para que el JSON Schema derivado para Monaco las reconozca y no produzca warnings amarillos al declararlas.

**Fuera de alcance**: Cambiar la lógica de validación de `translations` o `tokens` fuera de este schema. Cambiar el comportamiento de Monaco más allá de lo que el JSON Schema induce.

**Dependencias**: ninguna

**Impacto esperado en archivos**:
- `src/config/runtime-config-root-zod.ts` — añadir imports de `runtimeTranslationsSchema` y `runtimeTokensConfigSchema` desde `runtime-config-zod.ts` y declararlos como propiedades opcionales en `runtimeConfigRootSchema`.

**Tests**:

- **Ficheros de test**:
  - `src/tests/dev-runtime/dev-runtime-json-schema.test.ts` (ampliación)

- **Comportamiento cubierto**:
  - El JSON Schema generado incluye `translations` como propiedad del objeto raíz.
  - El JSON Schema generado incluye `tokens` como propiedad del objeto raíz.

- **Comandos durante la implementación**:
  ```
  pnpm test --run src/tests/dev-runtime/dev-runtime-json-schema.test.ts
  ```

- **Restricciones**: el fichero de test ya existe y tiene un test que verifica las propiedades raíz (`api`, `pages`, `initialPage`). Ampliar ese test o añadir uno nuevo en el mismo `describe`, no duplicar el harness. El JSON Schema se genera vía `toJSONSchema` de Zod v4, que cachea internamente; como los tests actuales dependen de esa caché, los tests nuevos deben funcionar con el mismo schema cacheado (no requieren reset).

**Documentación afectada**: `ai-workflow/docs/app-features/development/dev-mode-editor.md` — la sección de autocompletado JSON Schema debería reflejar que el schema cubre `translations` y `tokens`.

**Criterios de finalización**:
- `runtimeConfigRootSchema` declara `translations` y `tokens` como propiedades opcionales reutilizando los schemas Zod existentes.
- Los tests nuevos pasan y `pnpm test` sigue en verde sin regresión de cobertura.

**Cierre de implementación**: código y tests de esta tarea completos y validados.

---

## Tarea 2 — Corregir migración de translations y tokens en migrateRuntimeStateAcrossConfig

**Estado**: completada

**Objetivo**: Modificar `migrateRuntimeStateAcrossConfig` para que reconstruya `i18n.translations` desde `nextConfig.translations` y `tokens` desde `nextConfig.tokens` en lugar de copiar el estado previo, preservando `i18n.activeLanguage` del estado anterior.

**Fuera de alcance**: Merge parcial o migración selectiva de claves individuales dentro de `translations` o `tokens`. El fix reemplaza el bloque completo desde el nuevo config, igual que `createRuntimeState`. No cambiar el tratamiento de `modal` (que sigue copiándose del estado previo).

**Dependencias**: ninguna (independiente de la tarea 1)

**Impacto esperado en archivos**:
- `src/dev-runtime/dev-runtime-state-migration.ts` — modificar el bloque de retorno de `migrateRuntimeStateAcrossConfig` para:
  - `i18n.translations`: usar `nextConfig.translations ?? {}` en lugar de `prevState.i18n`.
  - `i18n.activeLanguage`: preservar `prevState.i18n.activeLanguage`.
  - `tokens`: reconstruir desde `nextConfig.tokens` con la misma lógica que `createRuntimeState` (iterar `nextConfig.tokens`, inicializar cada token con `{ value: tokenConfig.value, status: 'ready', failedAttempts: 0 }`), o `{}` si `nextConfig.tokens` es `undefined`.

**Tests**:

- **Ficheros de test**:
  - `src/tests/dev-runtime/dev-runtime-state-migration.test.ts` (ampliación)

- **Comportamiento cubierto**:
  - Cuando el nuevo config declara `translations` distintas, `i18n.translations` del resultado refleja las del nuevo config, no las del estado previo.
  - Cuando el nuevo config omite `translations`, `i18n.translations` del resultado es `{}`.
  - Cuando el nuevo config declara `translations` vacías (`{}`), `i18n.translations` del resultado es `{}`, no el valor previo.
  - `i18n.activeLanguage` se preserva del estado previo en todos los casos anteriores.
  - Cuando el nuevo config declara `tokens` distintos, el estado de `tokens` del resultado se reconstruye desde el nuevo config (cada token con `value` del config, `status: 'ready'`, `failedAttempts: 0`).
  - Cuando el nuevo config omite `tokens`, el estado de `tokens` del resultado es `{}`.
  - Cuando el nuevo config declara `tokens` vacíos (`{}`), el estado de `tokens` del resultado es `{}`, no el valor previo.

- **Comandos durante la implementación**:
  ```
  pnpm test --run src/tests/dev-runtime/dev-runtime-state-migration.test.ts
  ```

- **Restricciones**: el helper `makeState` del fichero de test existente no incluye los campos `i18n`, `tokens` ni `modal`. Para que los tests nuevos compilen sin `as unknown` forzados, ampliar `makeState` con valores por defecto para esos campos (`i18n: { translations: {}, activeLanguage: 'es' }`, `tokens: {}`, `modal: { activeModalId: null, activeIterationKey: null }`). De esta forma también se robustecen los tests existentes. Igualmente, ampliar `makeConfig` para que acepte `translations` y `tokens` opcionales sin requerir cast.

**Documentación afectada**: `ai-workflow/docs/app-features/development/dev-mode-editor.md` — la sección de preservación de estado debería mencionar que `translations` y `tokens` se reconstruyen desde el nuevo config.

**Criterios de finalización**:
- `migrateRuntimeStateAcrossConfig` reconstruye `i18n.translations` y `tokens` desde `nextConfig` en lugar de copiar `prevState`.
- `i18n.activeLanguage` se preserva del estado previo.
- Los tests nuevos pasan y `pnpm test` sigue en verde sin regresión de cobertura.

**Cierre de implementación**: código y tests de esta tarea completos y validados.
