# 0093 — Corregir migración de translations y tokens en el editor dev

## Objetivo

Corregir dos defectos relacionados del editor Monaco en modo desarrollo que impiden trabajar con los bloques `translations` y `tokens` del JSON de configuración:

1. El JSON Schema registrado en Monaco no incluye `translations` ni `tokens` como propiedades raíz válidas, lo que produce warnings visuales (subrayado amarillo) al declararlos.
2. Al pulsar Aplicar, la migración de estado copia los valores anteriores de `i18n` y `tokens` sin incorporar los cambios del nuevo config, por lo que las modificaciones en estos bloques nunca se reflejan en el runtime.

## Alcance

- Añadir `translations` y `tokens` como propiedades opcionales en el schema Zod raíz (`runtimeConfigRootSchema`) del que se deriva el JSON Schema de Monaco.
- Corregir la función `migrateRuntimeStateAcrossConfig` para que reconstruya `i18n.translations` y `tokens` desde el nuevo config en lugar de copiar el estado previo.

## Fuera de alcance

- Migración selectiva de `translations` o `tokens` (conservar claves que desaparecen, merge parcial, etc.). El fix reemplaza el bloque completo desde el nuevo config, igual que hace el bootstrap inicial.
- Cambios en la validación de `translations` o `tokens` fuera del schema raíz.
- Cambios en el comportamiento del editor Monaco más allá del autocompletado y warnings derivados del JSON Schema.
- Mejoras en el HMR o en la persistencia del editor entre sesiones.

## Requisitos funcionales

### RF-1 — JSON Schema raíz incluye translations y tokens

El schema Zod raíz (`runtimeConfigRootSchema`) debe declarar `translations` y `tokens` como propiedades opcionales, reutilizando los schemas Zod ya existentes (`runtimeTranslationsSchema`, `runtimeTokensConfigSchema`). El JSON Schema derivado para Monaco debe incluir ambas propiedades con sus definiciones completas, eliminando el warning amarillo al declararlas en el editor.

### RF-2 — Migración de estado actualiza translations desde el nuevo config

Cuando se aplica un nuevo config (botón Aplicar o HMR), `migrateRuntimeStateAcrossConfig` debe:
- Usar las `translations` del nuevo config para el campo `i18n.translations` del estado migrado.
- Preservar `i18n.activeLanguage` del estado previo.
- Si el nuevo config no declara `translations`, usar un objeto vacío como translations.

### RF-3 — Migración de estado actualiza tokens desde el nuevo config

Cuando se aplica un nuevo config, `migrateRuntimeStateAcrossConfig` debe reconstruir el estado de `tokens` desde el nuevo config en lugar de copiar el estado previo, con la misma semántica que el bootstrap inicial (`createRuntimeState`).

## Requisitos no funcionales

- No romper el umbral de cobertura del 80%.
- No añadir dependencias.

## Criterios de aceptación

1. Al escribir `"translations": {}` en el editor Monaco, no aparece warning amarillo (subrayado).
2. Al escribir `"tokens": {}` en el editor Monaco, no aparece warning amarillo.
3. Al modificar una clave de traducción en el editor y pulsar Aplicar, el runtime resuelve la nueva traducción inmediatamente en las superficies que la referencian.
4. Al modificar la configuración de un token en el editor y pulsar Aplicar, el estado del token se reconstruye desde el nuevo config.
5. Al eliminar el bloque `translations` del JSON y pulsar Aplicar, las traducciones del estado quedan vacías.
6. Al eliminar el bloque `tokens` del JSON y pulsar Aplicar, los tokens del estado quedan vacíos.
7. Los tests existentes siguen en verde sin regresiones.

## Casos límite

- Config sin bloque `translations` ni `tokens`: la migración debe producir estado equivalente al bootstrap con config sin esos bloques.
- Config con `translations` vacío (`{}`): el estado de `i18n.translations` debe quedar como objeto vacío, no como el valor previo.
- Cambio de idioma activo previo al apply: `activeLanguage` debe preservarse del estado anterior, no resetearse.

## Áreas de producto afectadas

- Desarrollo local → editor de configuración en vivo (migración de estado al aplicar).
- Contrato de configuración → schema raíz (propiedades declaradas).

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/development/dev-mode-editor.md` — la sección de preservación de estado debería mencionar el comportamiento correcto de `translations` y `tokens`.

## Riesgos o preguntas abiertas

Ninguno. Las causas raíz están identificadas y los fixes son cambios puntuales en dos archivos sin impacto transversal.
