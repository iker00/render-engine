# Namespace corto para referencias de traducción (`t.` en lugar de `translations.`)

## Objetivo
Acortar el namespace de referencia usado para resolver traducciones en el JSON de configuración, de `translations.{key}` a `t.{key}`, para reducir el tamaño del JSON en configuraciones con muchas referencias de traducción repetidas.

## Alcance
- Renombrar el namespace de referencia `translations` a `t` en el parser de referencias (`RuntimeReferenceNamespace`, patrón de reconocimiento, validación de forma).
- Renombrar el namespace en el resolver de referencias runtime (la resolución contra el catálogo de traducciones activo y su cadena de fallback por idioma no cambian de comportamiento, solo el prefijo reconocido).
- `t.{key}` mantiene exactamente las mismas reglas funcionales que hoy tiene `translations.{key}`:
  - exactamente un segmento dinámico tras el namespace (`t.group.key` sigue sin ser una referencia válida).
  - misma cadena de fallback por idioma activo → idioma por defecto (`"es"`) → nombre de la clave en desarrollo / string vacío en producción.
  - mismas superficies admitidas (todas las superficies visibles interpolables que ya admiten `translations.{key}`) y mismas superficies fuera de alcance (`api.query`, `api.body`, `api.headers`, `visibility.reference`, orígenes de colección, `defaultValue` de campos de formulario).
- Actualizar toda la configuración de ejemplo/desarrollo del propio proyecto (config de desarrollo local y fixtures de test) que hoy use la forma `translations.{key}` como referencia, para que use `t.{key}`.
- Actualizar la documentación funcional afectada (`ai-workflow/docs/app-features/references/`) para reflejar el nuevo namespace.

## Fuera de alcance
- La clave raíz `translations` del JSON de configuración (el catálogo de traducciones por idioma) no cambia de nombre ni de forma.
- Los tipos internos (`RuntimeTranslationsConfig`, `RuntimeTranslationsLangMap`), el estado interno del runtime (`state.i18n.translations`), el endpoint `getTranslationsBatch` y la UI del panel "Translations" del dev editor no cambian de nombre.
- No se acorta ningún otro namespace de referencia (`queries`, `forms`, `params`, `item`, `row`, `tokens`, `switch` siguen igual).
- No se introduce compatibilidad retro: `translations.{key}` deja de ser una referencia reconocida. No hay alias ni periodo de transición.
- No se añade ninguna migración automática de configuraciones ya desplegadas en producción; el cambio de contrato es responsabilidad de quien mantenga esas configuraciones.

## Requisitos funcionales
- El parser de referencias reconoce `t` como namespace válido con la misma forma que tenía `translations` (`t.{key}`, exactamente un segmento).
- El parser deja de reconocer `translations` como namespace de referencia: un string `translations.algo` pasa a tratarse como literal (no como referencia de traducción), salvo que coincida por casualidad con otro namespace reconocido.
- El resolver de referencias runtime resuelve `t.{key}` exactamente igual que hoy resuelve `translations.{key}` (mismo catálogo, mismo idioma activo vía `data-lang`, misma cadena de fallback).
- La interpolación parcial `{{t.key}}` funciona igual que hoy funciona `{{translations.key}}` en todas las superficies visibles interpolables ya soportadas.
- La configuración de desarrollo local del proyecto y los fixtures de test existentes que usaban `translations.{key}` se actualizan a `t.{key}` para seguir funcionando tras el cambio.

## Requisitos no funcionales
- El cambio no debe afectar al rendimiento de resolución de referencias.
- El umbral mínimo de cobertura del proyecto (80% sobre `src/`) se mantiene tras el cambio.

## Criterios de aceptación
- Una configuración que use `t.saludo` en una superficie visible interpolable (por ejemplo `heading.props.text`) resuelve el valor del catálogo de traducciones para el idioma activo, con la misma cadena de fallback que hoy aplica `translations.saludo`.
- Una configuración que use `{{t.saludo}}` dentro de un placeholder de interpolación parcial resuelve igual que hoy resuelve `{{translations.saludo}}`.
- Una configuración que use `translations.saludo` tras el cambio ya no se resuelve como referencia de traducción: se trata como string literal en las superficies visibles (no como placeholder de traducción).
- `t.group.saludo` (dos segmentos) no es una referencia válida, igual que hoy no lo es `translations.group.saludo`.
- Todos los tests existentes relacionados con referencias de traducción pasan usando `t.{key}` en lugar de `translations.{key}`.
- La configuración de desarrollo local (`src/dev/config.json`) sigue renderizando correctamente las traducciones tras migrar sus referencias a `t.{key}`.
- La documentación de `ai-workflow/docs/app-features/references/` refleja `t.{key}` como namespace vigente, sin referencias residuales a `translations.{key}` como sintaxis de referencia.

## Casos límite
- Un string literal que empiece por `t.` sin intención de ser una referencia de traducción (por ejemplo un código o abreviatura de negocio que coincida con la forma `t.algo`) se interpretará como referencia de traducción si tiene exactamente un segmento válido, igual que ya ocurre hoy con cualquier otro namespace reconocido (comportamiento consistente con el resto de namespaces cortos como `row`, `item`, `params`).
- El escape literal con `\` (por ejemplo `\t.algo`) sigue permitiendo mostrar el string tal cual sin resolverlo como referencia, igual que ya funciona hoy para el resto de namespaces.
- Los diagnósticos de desarrollo (`console.warn`, fallback a nombre de clave) que hoy mencionan `translations.{key}` deben seguir siendo coherentes con la referencia realmente usada (`t.{key}`) para no confundir en depuración.

## Riesgos o preguntas abiertas
Ninguna pregunta abierta bloqueante. El alcance (solo el prefijo de referencia, sin alias de compatibilidad) quedó confirmado en la fase de aclaración.

Riesgo real no resuelto: cualquier configuración externa ya desplegada que use `translations.{key}` dejará de resolver esas referencias como traducciones tras desplegar este cambio, sin aviso ni degradación específica más allá de tratarse como literal. Es un cambio de contrato breaking intencional, no un defecto.

## Áreas de producto afectadas a alto nivel
- Referencias y strings dinámicas (namespace de referencia y su resolución).
- Configuración de desarrollo local del proyecto (config de ejemplo y fixtures de test que usan referencias de traducción).

## Documentación probablemente afectada a alto nivel
- `ai-workflow/docs/app-features/references/reference-resolution.md`
- `ai-workflow/docs/app-features/references/dynamic-strings.md`
