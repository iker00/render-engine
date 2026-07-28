# Spec: Shared references syntax extraction

## Objetivo

Corregir la inversión de capas señalada en el hallazgo A-02 de la auditoría técnica del repo (2026-07-27):
`src/config/` (la capa que valida el JSON antes de renderizar) importa hoy `parseRuntimeReference` y
`hasRuntimeTemplateDelimiter` desde `src/runtime/runtime-references/runtime-reference-parser.ts`, violando la
dirección de dependencia fijada en `ai-workflow/docs/architecture.md` (`config → runtime`, nunca al revés).

Ambas funciones son puramente sintácticas: comprueban si un string tiene la forma de una referencia reconocida
(`queries.searchUsers.data`, `forms.user.name`) o de un placeholder de interpolación (`{{item.nombre}}`), sin tocar
`RuntimeState` ni ningún estado en vivo. Se extraen a un módulo neutral en `src/config/` del que dependen tanto
`config/` como `runtime/runtime-references/` sin que ninguno dependa del otro para esto, siguiendo el mismo patrón ya
establecido y usado hoy de forma extensa en el proyecto: `src/config/` define tipos y contrato, `src/runtime/` los
consume (ver Riesgos, evidencia de precedente).

Es una reorganización puramente mecánica: mismas firmas de función, mismo comportamiento, sin cambio en ningún
mensaje de validación ni en la resolución de referencias en runtime.

## Alcance

- Crear `src/config/runtime-reference-syntax.ts` como nuevo módulo neutral, con:
  - las funciones `parseRuntimeReference` y `hasRuntimeTemplateDelimiter`, junto con sus helpers privados actuales
    (`isSupportedNamespace`, `isReservedNamespace`, `hasRecognizedNamespace`, `hasValidReferenceShape`,
    `isSupportedQueryProperty`, `hasValidQueryReferencePath`, `createInvalidReference`) y sus constantes privadas
    (`SUPPORTED_NAMESPACES`, `RESERVED_NAMESPACES`, `REFERENCE_PATTERN`, `REFERENCE_SEGMENT_PATTERN`,
    `ITEM_KEY_SYNTHETIC_SEGMENT`, `ITEM_INDEX_SYNTHETIC_SEGMENT`), tal cual existen hoy en
    `src/runtime/runtime-references/runtime-reference-parser.ts`.
  - los tipos que hoy solo describen la forma de una referencia ya parseada (no su resolución contra estado en vivo):
    `RuntimeReferenceNamespace`, `RuntimeReferenceParseResult`, `RuntimeLiteralReference`, `RuntimeSupportedReference`,
    `RuntimeUnsupportedReference`, `RuntimeInvalidReference`. Hoy viven en
    `src/runtime/runtime-references/runtime-reference-types.ts` y son la única dependencia interna real que tiene
    `runtime-reference-parser.ts` (ver Riesgos); se mueven junto con las funciones porque describen el mismo contrato
    sintáctico, no resolución en vivo.
- Eliminar `src/runtime/runtime-references/runtime-reference-parser.ts`. No se mantiene como barrel de
  re-exportación: el objetivo explícito de la feature es que `config/` deje de importar de `runtime/` para esto, así
  que todos los importadores (dentro y fuera de `runtime/`) apuntan directamente al nuevo módulo neutral.
- `src/runtime/runtime-references/runtime-reference-types.ts` conserva solo los tipos de **resolución** contra
  estado en vivo (`RuntimeReferenceResolutionResult`, `RuntimeLiteralResolution`, `RuntimeResolvedReference`,
  `RuntimeMissingReference`, `RuntimeUnsupportedResolution`, `RuntimeInvalidResolution`,
  `RuntimeTokenErrorResolution`), e importa desde `src/config/runtime-reference-syntax.ts` los tipos sintácticos que
  siga necesitando (`RuntimeSupportedReference`, `RuntimeUnsupportedReference`, `RuntimeInvalidReference`).
- Actualizar los importadores existentes para que apunten al nuevo módulo:
  - Los 6 ficheros de `src/config/` que hoy importan del parser: `runtime-reference-namespace-guards.ts`,
    `validate-node-shared-helpers.ts`, `validate-form-field-nodes.ts`, `validate-collection-source.ts`,
    `validate-actions-visibility.ts`, `validate-form-choice-items.ts`.
  - `src/runtime/runtime-references/runtime-reference-resolver.ts` (importa `parseRuntimeReference` y, por el tipo
    devuelto, queda afectado también por el movimiento de `RuntimeSupportedReference`).
  - `src/runtime/runtime-collection-sources.ts` (importa `hasRuntimeTemplateDelimiter`; vive en `src/runtime/` pero
    fuera de `runtime-references/`, así que también debe actualizar su import).
  - `src/tests/runtime/runtime-reference-resolution.test.tsx` (único test que importa `parseRuntimeReference`
    directamente).
- Mismas firmas públicas, mismos nombres exportados, mismo comportamiento runtime, mismos mensajes y rutas de error
  de validación.

## Fuera de alcance

- Cualquier cambio de mensaje de error, código de error, ruta canónica o breadcrumb de validación.
- Cualquier cambio de comportamiento de parseo, interpolación o resolución de referencias en runtime.
- El cruce de capas entre `src/queries/` y `runtime/runtime-references/` + `runtime/runtime-state/` (que `queries`
  necesita para resolver parámetros de API contra el estado en vivo) y el hecho de que `runtime/` importe de vuelta
  el ejecutor de `queries/`. Este cruce es colaboración legítima entre capas adyacentes, no una inversión de capas
  como la de `config → runtime`, y queda fuera de alcance de esta feature; no requiere ninguna acción aquí.
- Reorganizar cualquier otro fichero de `src/runtime/runtime-references/` (`runtime-formatter-parser.ts`,
  `runtime-formatter-registry.ts`, `runtime-reference-diagnostics.ts`) más allá de la actualización de imports que
  requiera el movimiento descrito.
- Reorganizar los ficheros de test de `src/tests/config-validation/` ni de `src/tests/runtime/` más allá de
  actualizar la ruta de import ya mencionada.
- Cambiar el umbral o la estrategia global de cobertura de tests.

## Requisitos funcionales

1. `parseRuntimeReference` y `hasRuntimeTemplateDelimiter` quedan definidas en `src/config/runtime-reference-syntax.ts`
   con idéntica firma, idéntico comportamiento e idénticos helpers/constantes privados que hoy.
2. `src/runtime/runtime-references/runtime-reference-parser.ts` deja de existir.
3. Ninguno de los 6 ficheros de `src/config/` listados en el alcance importa de `src/runtime/` para obtener estas dos
   funciones; todos importan desde `src/config/runtime-reference-syntax.ts`.
4. `src/runtime/runtime-references/runtime-reference-resolver.ts` y `src/runtime/runtime-collection-sources.ts`
   importan `parseRuntimeReference` / `hasRuntimeTemplateDelimiter` desde `src/config/runtime-reference-syntax.ts`.
5. `src/runtime/runtime-references/runtime-reference-types.ts` ya no declara los tipos sintácticos movidos
   (`RuntimeReferenceNamespace`, `RuntimeReferenceParseResult`, `RuntimeLiteralReference`, `RuntimeSupportedReference`,
   `RuntimeUnsupportedReference`, `RuntimeInvalidReference`); los reutiliza importándolos desde
   `src/config/runtime-reference-syntax.ts` allí donde los siga necesitando para sus tipos de resolución.
6. Ningún consumidor externo a los ficheros listados en el alcance (namespace guards, validadores de `config/`,
   resolver, `runtime-collection-sources`, test de resolución) cambia su comportamiento observable.

## Requisitos no funcionales

- `src/config/runtime-reference-syntax.ts` no importa nada de `src/runtime/`: es un módulo hoja dentro de `config/`,
  sin dependencias hacia la capa que hoy lo importaba indebidamente.
- No se introduce ningún ciclo de import nuevo entre `src/config/` y `src/runtime/` como consecuencia de este
  movimiento.
- La cobertura global de tests se mantiene en el umbral mínimo del 80% sobre `src/`.
- El nombre del nuevo fichero (`runtime-reference-syntax.ts`) sigue la convención `kebab-case` ya usada en
  `src/config/` y es coherente con su fichero hermano ya existente `runtime-reference-namespace-guards.ts` (mismo
  dominio: sintaxis/contrato de referencias, no interpretación en vivo).

## Criterios de aceptación

1. `grep -rn "runtime-reference-parser" src/` ya no devuelve ninguna coincidencia (el fichero no existe y ningún
   import lo referencia).
2. `grep -rln "parseRuntimeReference\|hasRuntimeTemplateDelimiter" src/config/*.ts` sigue devolviendo los mismos 6
   ficheros que hoy, pero todos importando desde `./runtime-reference-syntax` (ruta relativa dentro de `config/`) en
   lugar de `../runtime/runtime-references/runtime-reference-parser`.
3. `grep -n "from.*config/runtime-reference-syntax" src/runtime/runtime-references/runtime-reference-resolver.ts
   src/runtime/runtime-collection-sources.ts` encuentra el import esperado en ambos.
4. La suite de tests existente (en particular `src/tests/runtime/runtime-reference-resolution.test.tsx` y los tests
   de `src/tests/config-validation/` que ejercitan los 6 validadores afectados) sigue en verde sin cambiar ninguna
   aserción de comportamiento, mensaje o código de error.
5. `pnpm build` y `pnpm test` completan sin errores tras el movimiento.
6. Ningún fichero de `src/config/` importa de `src/runtime/` para resolver sintaxis de referencias tras esta feature
   (verificable con `grep -rn "from '\.\./runtime" src/config/*.ts` — ya no debe aparecer ninguna de las 6 rutas
   actuales relacionadas con `runtime-reference-parser`).

## Casos límite

- **Namespace `item` con segmentos sintéticos (`$key`, `$index`)**: la lógica de `hasValidReferenceShape` para este
  caso debe preservarse exactamente igual tras el movimiento (sin tests nuevos, solo sin regresión).
- **Escape de referencia con `\\`**: el prefijo de escape (`value.startsWith('\\')`) que degrada una referencia con
  forma reconocida a literal debe seguir funcionando igual.
- **Namespaces reservados (`navigation`, `routeParams`)**: siguen devolviendo `unsupported`, nunca `supported` ni
  `invalid`, igual que hoy.
- **`RuntimeSupportedReference` usado en tipos de resolución**: `runtime-reference-types.ts` sigue componiendo
  `RuntimeResolvedReference`, `RuntimeMissingReference` y `RuntimeTokenErrorResolution` a partir de
  `RuntimeSupportedReference` importado desde la nueva ubicación; el tipo compuesto no cambia de forma para ningún
  consumidor externo a `runtime-references/`.
- **`runtime-collection-sources.ts`**: no es uno de los "6 ficheros de config" ni vive dentro de
  `runtime-references/`, pero sí importa `hasRuntimeTemplateDelimiter` desde el fichero que se elimina; debe quedar
  cubierto explícitamente por el movimiento aunque no encajara en la descripción inicial del hallazgo A-02.

## Riesgos o preguntas abiertas

Ninguno bloqueante. Investigado y resuelto con datos concretos:

- **Dependencia interna no anticipada en la descripción original del hallazgo**: `runtime-reference-parser.ts`
  importa hoy tipos de su fichero hermano `runtime-reference-types.ts`
  (`RuntimeInvalidReference`, `RuntimeReferenceNamespace`, `RuntimeReferenceParseResult`, `RuntimeSupportedReference`,
  `RuntimeUnsupportedReference`), algo que la descripción inicial de la feature no contemplaba ("no tiene ninguna
  otra función"). Si solo se movieran las dos funciones y se dejaran los tipos donde están, el nuevo módulo neutral
  tendría que seguir importando de `src/runtime/runtime-references/runtime-reference-types.ts`, reintroduciendo
  exactamente la inversión de capas que esta feature busca eliminar. Se resuelve moviendo también los tipos
  puramente sintácticos (los que describen la forma de una referencia ya parseada, no su resolución contra estado en
  vivo) junto con las funciones, y dejando en `runtime-reference-types.ts` únicamente los tipos de resolución, que
  importan de vuelta los tipos sintácticos desde la nueva ubicación. No es una decisión de diseño nueva: generaliza
  un patrón ya usado de forma extensa y consistente en el proyecto (`src/config/runtime-config.ts` y
  `src/config/runtime-config-types.ts` son importados por más de 40 ficheros distintos de `src/runtime/` para tipos
  compartidos; `src/config/` ya actúa hoy como capa de contrato de la que `runtime/` depende, nunca al revés).
- **Ubicación del módulo neutral**: se confirma `src/config/runtime-reference-syntax.ts` (no una carpeta `shared/`
  nueva ni ninguna otra ubicación) porque: (a) coincide con el candidato ya propuesto y evaluado por el usuario; (b)
  sigue la convención de `src/config/` como carpeta plana de módulos `kebab-case` por dominio, con un fichero
  hermano ya existente y semánticamente equivalente (`runtime-reference-namespace-guards.ts`); (c) es coherente con
  la dirección de dependencia ya establecida y usada en decenas de ficheros hoy (`config/` define contrato,
  `runtime/` lo consume); y (d) `src/config/runtime-config.ts` (el barrel público de tipos de configuración) no
  incluye tampoco a `runtime-reference-namespace-guards.ts` entre sus re-exports, así que no reexportar el nuevo
  módulo desde ese barrel es coherente con el patrón ya existente, no una omisión.
- **Sin barrel de compatibilidad en la ubicación antigua**: a diferencia de la feature hermana
  `0115-layout-and-form-validators-split` (que sí mantuvo barrels para no romper importadores externos), aquí no
  aplica: el objetivo explícito de la feature es que `config/` deje de importar de `runtime/` para esto, así que
  mantener un barrel en `runtime-references/runtime-reference-parser.ts` que reexportara desde `config/`
  perpetuaría nominalmente el import problemático. Todos los importadores (9 ficheros: 6 de `config/`, el resolver,
  `runtime-collection-sources.ts` y el test de resolución) se actualizan para apuntar directamente al nuevo módulo.
- **Ningún ciclo real**: `src/config/runtime-reference-syntax.ts` no necesita importar nada de `src/runtime/`; es un
  módulo hoja. No se detecta ningún ciclo de import nuevo ni existente que complique la extracción.

## Áreas de producto afectadas

- `src/config/` (deja de importar de `src/runtime/` para esta sintaxis) y `src/runtime/runtime-references/` (pierde
  el fichero del parser, ajusta sus tipos). No es una feature de producto visible; no cambia comportamiento para el
  usuario final de la aplicación construida con el runtime.

## Documentación probablemente afectada

- `ai-workflow/docs/architecture.md`: no debería requerir cambio de fondo (la frontera "config se valida antes de
  renderizar" y "la resolución de referencias vive en runtime-references/" se mantienen ambas ciertas), pero conviene
  revisar si merece una mención explícita de que la sintaxis de referencias (`parseRuntimeReference`,
  `hasRuntimeTemplateDelimiter`) vive como contrato neutral en `src/config/` y es consumida por ambas capas.
- `ai-workflow/docs/app-features/config/index.md` y `ai-workflow/docs/app-features/references/index.md`: no deberían
  requerir cambio, ya que ningún comportamiento ni mensaje de validación cambia.
- `ai-workflow/docs/test-index.md`: no debería requerir cambio, ya que los tests no se reorganizan como parte de
  esta feature (solo cambia la ruta de un import).
