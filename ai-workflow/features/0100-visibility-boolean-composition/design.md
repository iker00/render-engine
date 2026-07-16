# Design: Feature 0100 - visibility-boolean-composition

## Contexto

`visibility` y los tres `when` que reutilizan su mismo shape (`submitAction.onSuccess[*].when`,
`pages[].preloads[*].when`, `operations[*].when`) comparten hoy un único schema Zod
(`visibilitySchema` / `whenConditionSchema` en `src/config/runtime-config-zod.ts`) y una única función de
evaluación en runtime (`matchesVisibilityRule` en `src/runtime/runtime-layout-visibility.ts`), llamada desde
`runtime-layout-visibility.ts` (node.visibility), `runtime-form-validations.ts` (onSuccess/onError `when`),
`runtime-ui-action-executor.ts` (operations `when`) y `runtime-state-provider.tsx` (preloads `when`).

La validación de estas superficies sigue un patrón de dos pasadas ya establecido:
1. **Shape**: cada uno de los ~30 node schemas en `runtime-config-zod.ts` incluye
   `visibility: visibilitySchema.optional()`, y las funciones de validación de `when` parsean con
   `whenConditionSchema`. Un fallo aquí se traduce a mensaje vía `mapVisibilityIssue` (path genérico a partir de
   `issue.path` de Zod).
2. **Semántica**: `validateVisibility` y `validateWhenCondition` (ambas en
   `src/config/validate-actions-visibility.ts`) revalidan a mano lo que Zod no expresa hoy: validez de
   `reference` según familia (`params.*`, `item.*`, `forms.*`, `queries.*`), y presencia/tipo de `value` según
   catálogo de `operator` (Zod solo tipa `value` como `unknown().optional()`).

`RuntimeVisibilityConfig` / `RuntimeWhenCondition` (en `runtime-config-types.ts`) son hoy un único shape plano
`{ reference, operator, value? }`, consumido directamente (sin discriminación) solo en
`runtime-layout-visibility.ts`; ningún otro módulo de `src/` accede a `.reference`/`.operator`/`.value` fuera de
la capa de validación.

Este design resuelve las dos preguntas abiertas marcadas en `spec.md`: la estrategia de unión discriminada en
Zod, y el mecanismo de rechazo de anidamiento. Ambas se han verificado empíricamente contra la versión de Zod ya
usada en el proyecto (`zod@4.3.6`).

## Objetivos / No objetivos

### Objetivos
- Definir el shape Zod y de tipos TypeScript para `visibility`/`when` con condición simple o grupo `and`/`or`.
- Definir cómo se extiende la validación semántica existente sin duplicar reglas entre las cuatro superficies.
- Definir cómo se extiende `matchesVisibilityRule` para evaluar grupos y `negate` sin romper el camino de
  condición simple.
- Acotar el impacto real en código fuera de `src/config/` y `src/runtime/runtime-layout-visibility.ts`.

### No objetivos
- No se diseña el troceo en tareas de implementación (pertenece a `generate-implementation-plan`).
- No se resuelve aquí ningún comportamiento funcional nuevo respecto a `spec.md` (alcance ya cerrado).
- No se diseña anidamiento multinivel ni negación a nivel de grupo: quedan fuera de alcance según la spec.

## Decisiones

### D1 — Unión discriminada en `operator` para el schema Zod
`visibilitySchema` deja de ser un único `z.object`. Pasa a ser:

```ts
const visibilityConditionSchema = z.object({
  reference: nonEmptyStringSchema,
  operator: z.enum(supportedVisibilityOperators),
  value: z.unknown().optional(),
  negate: z.boolean().optional(),
}).strip()

const visibilityGroupSchema = z.object({
  operator: z.enum(supportedVisibilityGroupOperators), // ['and', 'or']
  conditions: z.array(visibilityConditionSchema).min(1),
}).strip()

const visibilitySchema = z.discriminatedUnion('operator', [visibilityConditionSchema, visibilityGroupSchema])
export const whenConditionSchema = visibilitySchema
```

`operator` sigue siendo el discriminador único y compartido, tal como fija la spec. Verificado contra
`zod@4.3.6`: `discriminatedUnion` admite un discriminador `z.enum(...)` por rama siempre que los conjuntos de
valores no se solapen (`equals|notEquals|isTruthy|isFalsy|greaterThan|lessThan` vs `and|or`), y produce el path
de error correcto (`["conditions", 0, "value"]`, etc.) para errores dentro de una rama.

Alternativa descartada: dos schemas independientes unidos con `.refine()` cruzado (comprobar a mano qué shape
aplica según si existe `conditions`). Se descarta porque `discriminatedUnion` ya resuelve la discriminación y el
enrutado de errores sin lógica adicional, y es el mecanismo que el proyecto ya usa para uniones discriminadas
(`queryStateFeedbackRuleSchema`).

### D2 — Rechazo de grupo anidado sin `refine` explícito
`conditions` tipa sus elementos con `visibilityConditionSchema` (la rama de condición simple), no con la unión
completa. Un elemento de `conditions` que a su vez tenga forma de grupo (`{ operator: "and"|"or", conditions: [...] }`)
falla automáticamente contra `visibilityConditionSchema`: `operator` no está en el catálogo de operadores de
condición simple y `reference` está ausente. No hace falta un `.refine()` ni una comprobación manual de
anidamiento; el propio shape de `conditions` ya no admite otra cosa que una condición simple. Verificado
empíricamente: `{ operator: "and", conditions: [{ operator: "or", conditions: [...] }] }` produce issues en
`conditions[0].reference` y `conditions[0].operator`, rechazando el config.

Esto resuelve la segunda pregunta abierta de la spec sin necesidad de una regla de validación dedicada.

### D3 — Tipos públicos
En `runtime-config-types.ts`:

```ts
export type RuntimeVisibilityGroupOperator = 'and' | 'or'

export interface RuntimeVisibilityCondition {
  reference: string
  operator: RuntimeVisibilityOperator
  value?: RuntimeConfigValue
  negate?: boolean
}

export interface RuntimeVisibilityGroup {
  operator: RuntimeVisibilityGroupOperator
  conditions: RuntimeVisibilityCondition[]
}

export type RuntimeVisibilityConfig = RuntimeVisibilityCondition | RuntimeVisibilityGroup
export type RuntimeWhenCondition = RuntimeVisibilityConfig
```

`RuntimeVisibilityConfig`/`RuntimeWhenCondition` pasan de shape plano a unión. Efecto colateral deseado: el
compilador de TypeScript señala cada punto que hoy asume shape simple sin discriminar antes. Se ha confirmado
por búsqueda en el repo que ese punto es únicamente `src/runtime/runtime-layout-visibility.ts` (fuera de la
propia capa de validación en `src/config/`), lo que acota el impacto real de este cambio de tipos.

### D4 — Type guard compartido
`isVisibilityGroup(config): config is RuntimeVisibilityGroup`, definido junto a los tipos en
`runtime-config-types.ts` y reutilizado tanto por la validación (`src/config/validate-actions-visibility.ts`)
como por la evaluación en runtime (`src/runtime/runtime-layout-visibility.ts`). Implementación por presencia del
campo `conditions` (obligatorio solo en el grupo, ausente en la condición simple), evitando comparar `operator`
contra una lista en cada punto de uso.

### D5 — Validación semántica: helper de condición compartido, wrappers finos por superficie
La lógica semántica ya existente en `validateVisibility` y `validateWhenCondition` (validez de `reference` según
familia, presencia/tipo de `value` según `operator`) se extrae a un helper interno de condición única,
parametrizado por el validador de referencia aplicable a cada superficie:
- `validateVisibility` lo invoca ligado a `isValidVisibilityReference` (sin restricción de `item`, como hoy).
- `validateWhenCondition` lo invoca ligado a `isValidWhenReference` con el `options.allowItem` ya existente por
  llamada.

`validateVisibility`/`validateWhenCondition` pasan a comportarse como:
- Si el shape recibido es grupo (`isVisibilityGroup`): iterar `conditions`, aplicando el helper a cada una con
  path `${path}.conditions[${index}]`; cortar en el primer error.
- Si es condición simple: aplicar el helper una vez con el `path` recibido (comportamiento actual, sin cambios
  de mensaje ni de reglas).

El campo `negate` no requiere regla semántica adicional: su tipo ya lo garantiza Zod (`z.boolean().optional()`)
en la capa de shape.

Alternativa descartada: duplicar la lógica de condición en las cuatro superficies que hoy comparten contrato.
Se descarta porque el propio `spec.md` fija que las cuatro superficies deben validarse igual; duplicar abre
riesgo real de divergencia futura entre `visibility` y los `when`.

Trade-off aceptado: `validateVisibility` y `validateWhenCondition` siguen siendo dos funciones públicas
distintas (no se fusionan en una sola con un parámetro de opciones), porque `allowItem` solo tiene sentido para
`when` y forzarlo en la firma de `validateVisibility` sería una opción sin uso real en esa superficie.

### D6 — Mapeo de errores de shape: sin cambios
`mapVisibilityIssue` ya construye el mensaje formateando genéricamente cada segmento de `issue.path` de Zod
(`.conditions[0].value`, `.conditions[0].negate`, etc. se formatean igual que `.value` hoy). No requiere cambios:
se ha verificado que Zod produce paths correctos y localizados dentro de la unión discriminada tanto para errores
de nivel de grupo (`conditions` ausente o vacío) como de nivel de condición dentro del grupo. Esto satisface el
requisito no funcional de trazabilidad de errores (breadcrumb + ruta posicional) sin trabajo adicional en esa
función.

### D7 — Evaluación en runtime: un único nivel de indirección
`matchesVisibilityRule` (`src/runtime/runtime-layout-visibility.ts`) pasa a:
- Si `visibility` es grupo: evaluar cada condición de `conditions` (aplicando `negate` a cada una) y combinar con
  `Array.prototype.every` (`and`) o `Array.prototype.some` (`or`).
- Si `visibility` es condición simple: ejecutar la lógica de evaluación ya existente (sin cambios: resolución de
  referencia + switch por `operator`), y aplicar `negate` al resultado booleano final antes de devolverlo.

Como la spec prohíbe anidar grupos, no hace falta un evaluador de árbol genérico recursivo: un único nivel
(grupo → lista de condiciones simples) es suficiente y más simple de razonar/testear que una recursión abierta.
`negate` se aplica siempre sobre el resultado booleano final de una condición individual (incluyendo los casos
hoy degradados a "no coincide" por referencia ausente o valor no comparable), nunca sobre el resultado combinado
del grupo, en línea con "fuera de alcance: negación a nivel de grupo".

### D8 — Coste en el camino sin grupo
`isVisibilityGroup` es una comprobación de presencia de propiedad, O(1). El camino de condición simple ejecuta
exactamente la misma lógica de resolución/comparación que hoy, envuelta en una función que aplica `negate`
(no-op cuando es `undefined`/`false`). No se introduce coste apreciable en configuraciones que solo usan
condición simple, satisfaciendo el requisito no funcional de rendimiento de la spec.

## Riesgos y trade-offs

- **Ensanchar `RuntimeVisibilityConfig`/`RuntimeWhenCondition` a unión rompe la compilación en cada punto que
  asumía shape simple sin discriminar.** Riesgo bajo y deseado: se manifiesta en tiempo de compilación, no en
  runtime, y ya se ha acotado a un fichero fuera de `src/config/` (`runtime-layout-visibility.ts`); sirve como
  checklist mecánico de migración más que como riesgo real.
- **Duplicación mínima del bucle de iteración sobre `conditions`** entre `validateVisibility` y
  `validateWhenCondition` (D5): cada una itera y arma el path, pero delegan la regla de condición al mismo
  helper. Trade-off aceptado para no forzar una única función pública con parámetros que no aplican a ambas
  superficies por igual.
- **Mensajes de error para `operator` completamente fuera de catálogo** (ni de condición ni de grupo, p. ej.
  `"xyz"`) no distinguen si el autor de la config quería declarar una condición o un grupo; el mensaje sigue
  siendo tan genérico como hoy (`"...operator".`). No se abre alcance nuevo de mensajes más específicos: es
  consistente con el nivel de detalle actual del resto de errores de shape.

## Migración o despliegue

No aplica. Es un cambio de contrato aditivo y retrocompatible sobre configuración JSON consumida en runtime, sin
datos persistidos ni migración de base de datos. Config existente con condición simple sigue validando por la
misma rama de la unión discriminada (`visibilityConditionSchema`) sin cambio de comportamiento ni de mensajes de
error para ese caso.

## Preguntas abiertas

Ninguna bloqueante. Las dos preguntas abiertas marcadas en `spec.md` (estrategia de unión discriminada en Zod, y
mecanismo de rechazo de anidamiento) quedan resueltas por D1 y D2 respectivamente, verificadas empíricamente
contra la versión de Zod ya usada en el proyecto.
