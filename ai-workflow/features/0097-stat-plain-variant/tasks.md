# Feature 0097 — Variante `plain` para el nodo `stat`: plan de implementación

## T1 — Extender `StatVariant` y schema Zod con `"plain"`

### Estado
completada

### Objetivo
Añadir `"plain"` al enum de `variant` en el tipo TypeScript y en el schema Zod del nodo `stat`, de forma que un config con `variant: "plain"` pase la validación de layout, que `variant` fuera de `["accent", "tinted", "plain"]` siga rechazándose con `invalid-layout` en `{path}.props.variant`, y que el diagnóstico de error refleje el enum extendido si su mensaje enumera literales.

Esta tarea no modifica el componente `stat-layout-node.tsx` ni las utilidades de estilo; su alcance se limita al contrato de configuración y su validación.

### Fuera de alcance
- Utilidades de estilo para `plain` (T2).
- Rama de render en el componente (T3).
- Cambios en la lógica de `validateStatNode` más allá de la enumeración de valores permitidos en el mensaje de error.
- Cambios en las variantes `accent` o `tinted`.
- Actualización de `stat.md`.

### Dependencias
Ninguna.

### Impacto esperado en archivos

**Código:**
- `src/config/runtime-config-zod.ts` — extender `supportedStatVariants` (~L670) para incluir `"plain"`.
- `src/config/runtime-config-types.ts` — extender `type StatVariant` (~L516) con `"plain"`.
- `src/config/validate-layout-nodes.ts` — dentro de `validateStatNode` (~L2234), si el mensaje de rechazo enumera literales `accent`/`tinted`, actualizarlo para incluir `plain`. La ruta del diagnóstico (`{path}.props.variant`) no cambia.

**Tests:**
- `src/tests/config-validation/runtime-config-validation-stat.test.ts` (ampliación)

**Documentación:**
- `ai-workflow/docs/app-features/nodes/stat.md`

### Tests

**Ficheros de test:**
- `src/tests/config-validation/runtime-config-validation-stat.test.ts` (ampliación) — añadir casos de aceptación y rechazo relativos a `variant: "plain"` dentro de los `describe` existentes de `stat node: acceptance` y `stat node: rejection`.

**Comportamiento cubierto:**
- Un `stat` con `variant: "plain"` y `label`/`value` obligatorios pasa la validación.
- Un `stat` con `variant: "plain"` combinado con cada uno de los seis colores semánticos (`neutral`, `primary`, `success`, `warning`, `danger`, `info`) pasa la validación.
- Un `stat` con `variant: "plain"` e `icon` string pasa la validación.
- Un `stat` con `variant: "plain"` y campos transversales (`visibility`, `queryStateFeedback`, `layout.span`) pasa la validación, siguiendo el patrón parametrizado ya existente para los campos transversales del nodo.
- Un `stat` con `variant: "outline"` (o cualquier otro string fuera del enum) se rechaza con `invalid-layout` y ruta `{path}.props.variant`. El texto del mensaje enumera las tres variantes soportadas si el mensaje actual enumera literales.
- Un `stat` sin `variant` declarado sigue siendo aceptado (el default de accent lo aplica el runtime en T3; la validación no lo requiere).

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-validation-stat.test.ts
```

**Restricciones:**
- Reusar `createStatNode` y `createConfigWithLayout` ya presentes en el fichero y en `src/tests/config-validation/helpers.ts`; no crear helpers nuevos.
- No añadir snapshots.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/stat.md` — fila `props.variant` y descripción del enum deberán actualizarse en una pasada posterior con `update-app-documentation`.

### Criterios de finalización

**Cierre de implementación:**
- Los tres ficheros de código listados están modificados.
- `pnpm test --run` del fichero de validación en verde.
- `pnpm test` completo sigue en verde y el umbral global de cobertura (80% en functions/lines/statements) se mantiene.

---

## T2 — Añadir utilidades de estilo `getStatPlain*` en `runtime-node-styling.ts`

### Estado
completada

### Objetivo
Introducir cuatro builders color-agnósticos en `src/runtime/runtime-node-styling.ts` para la variante `plain`, siguiendo la convención existente "un builder por (variant, slot)":

- `getStatPlainRootClassName` — clases del contenedor raíz, sin `border-l-*` ni `bg-*-100`, con padding neutro consistente con el layout de accent/tinted.
- `getStatPlainIconClassName` — clases del icono, neutras (sin depender de la paleta semántica) y con el mismo sizing que las variantes existentes.
- `getStatPlainLabelClassName` — clases del texto `label`, neutras (mismo efecto observable que `getStatAccentLabelClassName`).
- `getStatPlainValueClassName` — clases del texto `value`, neutras (mismo efecto observable que `getStatAccentValueClassName`).

Los cuatro builders son color-agnósticos: la spec exige que `props.color` no tenga ningún efecto visual en `plain`. La firma puede ser sin argumentos o con parámetro `color` ignorado; los tests deben demostrar la invariancia respecto a `color` en ambos casos.

### Fuera de alcance
- Rama de render en el componente (T3).
- Cambios en las utilidades de accent o tinted.
- Cambios en la estructura de comentarios del bloque stat más allá de añadir subcabecera para `plain`.

### Dependencias
- T1 completada (el tipo `StatVariant` ya incluye `"plain"`; en la práctica los builders son independientes del tipo, pero mantenemos el orden para separar cambios de contrato de cambios de estilo).

### Impacto esperado en archivos

**Código:**
- `src/runtime/runtime-node-styling.ts` — añadir el bloque de builders `plain` inmediatamente detrás del bloque tinted (~L1032), respetando la cabecera de sección `Stat node styling functions`.

**Tests:**
- `src/tests/runtime/runtime-node-styling.test.ts` (ampliación) — añadir un `describe` para `stat plain styling functions` dentro del bloque `T8 — stat styling functions`.

**Documentación:**
- `ai-workflow/docs/app-features/nodes/stat.md`

### Tests

**Ficheros de test:**
- `src/tests/runtime/runtime-node-styling.test.ts` (ampliación) — nuevo `describe` con las asserciones que se listan a continuación.

**Comportamiento cubierto:**
- `getStatPlainRootClassName()` no incluye ninguna clase que empiece por `border-l-`.
- `getStatPlainRootClassName()` no incluye ninguna de `bg-neutral-100`, `bg-primary-100`, `bg-success-100`, `bg-warning-100`, `bg-danger-100`, `bg-info-100`.
- `getStatPlainRootClassName()` incluye una clase de padding neutro consistente (asserción `toContain` sobre la clase concreta elegida, p. ej. `py-2` o `p-4`; la elegida por implementación se asserta explícitamente).
- `getStatPlainLabelClassName()` incluye el mismo token de texto neutro/muted que `getStatAccentLabelClassName()` (asserción `toContain` con la clase concreta neutra ya usada por accent, p. ej. `text-app-text-muted`).
- `getStatPlainValueClassName()` incluye el mismo token de texto strong que `getStatAccentValueClassName()` (asserción `toContain` con la clase concreta ya usada por accent, p. ej. `text-app-text-strong`).
- `getStatPlainIconClassName()` no incluye ninguna clase `text-neutral-*`, `text-primary-*`, `text-success-*`, `text-warning-*`, `text-danger-*` ni `text-info-*` propia de la paleta semántica (recorrer las seis familias con un loop y `not.toMatch`). Sí incluye el sizing base equivalente al de accent/tinted (`size-8 shrink-0` u otro sizing adoptado, con asserción explícita).
- Si los builders aceptan `color`, cada llamada con cada uno de los seis colores devuelve exactamente la misma cadena (`toEqual` cruzado sobre pares distintos).

**Comandos durante la implementación:**
```
pnpm test --run src/tests/runtime/runtime-node-styling.test.ts
```

**Restricciones:**
- Seguir el estilo de asserciones ya usado en el bloque `T8` (uso de `toContain` para tokens específicos, no snapshotear la cadena completa).
- No importar ni depender de `stat-layout-node.tsx`.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/stat.md` — nueva subsección `Variante \`plain\`` análoga a las de accent y tinted, en pasada documental posterior.

### Criterios de finalización

**Cierre de implementación:**
- El fichero `runtime-node-styling.ts` está modificado con los cuatro builders exportados.
- `pnpm test --run` del fichero de styling en verde.
- `pnpm test` completo sigue en verde y el umbral global de cobertura se mantiene.

---

## T3 — Añadir rama `plain` al componente `stat-layout-node.tsx`

### Estado
completada

### Objetivo
Extender la bifurcación por `variant` en `src/runtime/nodes/stat-layout-node.tsx` para cubrir el caso `variant === 'plain'`, usando los builders introducidos en T2. La rama debe renderizar un `<div data-layout-node="stat">` sin borde lateral de color y sin fondo de color, con icono opcional a la izquierda (delegado a `IconNode`, comportamiento inalterado), y `label`/`value` resueltos con `resolveRuntimeTextReference` como en las otras variantes. El default de `variant` sigue siendo `'accent'`, sin regresión.

### Fuera de alcance
- Cambios en las ramas `accent` o `tinted` del componente.
- Cambios en `IconNode` (icono resuelve como hoy) o en `resolveRuntimeTextReference`.
- Actualización de `stat.md` o `nodes/index.md`.

### Dependencias
- T1 completada (`StatVariant` incluye `"plain"` para satisfacer TypeScript en la condición del branch).
- T2 completada (los cuatro builders `getStatPlain*` están disponibles para importar).

### Impacto esperado en archivos

**Código:**
- `src/runtime/nodes/stat-layout-node.tsx` — añadir una rama `if (variant === 'plain') { ... }` antes de la caída a la rama accent, importando y usando los cuatro builders `getStatPlain*`. Estructura del JSX análoga a las ramas accent/tinted (`<div data-layout-node="stat" className={rootClass}><div flex><IconNode…/><div><p label/><p value/></div></div></div>`).

**Tests:**
- `src/tests/layout-renderer/layout-renderer-stat.test.tsx` (ampliación) — nuevo `describe('StatNode — plain variant')` con la estructura de los describes existentes.

**Documentación:**
- `ai-workflow/docs/app-features/nodes/stat.md`
- `ai-workflow/docs/app-features/nodes/index.md`

### Tests

**Ficheros de test:**
- `src/tests/layout-renderer/layout-renderer-stat.test.tsx` (ampliación) — nuevo `describe('StatNode — plain variant')` que reusa los helpers locales del fichero.

**Comportamiento cubierto:**
- Un `stat` con `variant: "plain"` renderiza un `<div data-layout-node="stat">` en el DOM.
- El elemento raíz de `plain` no incluye ninguna clase `border-l-4`, ni ninguna de `bg-neutral-100`, `bg-primary-100`, `bg-success-100`, `bg-warning-100`, `bg-danger-100`, `bg-info-100` (recorrido explícito sobre las seis familias).
- `label` y `value` aparecen con su texto declarado.
- Con `variant: "plain"` e `icon` cuyo nombre resuelve en `lucide-react`, el icono aparece como descendiente del contenedor del stat (mismo assertion pattern que en accent/tinted, p. ej. presencia de un `<svg>` como hijo del contenedor flex).
- Con `variant: "plain"` e `icon` cuyo nombre no resuelve, el nodo se renderiza sin icono (comportamiento delegado a `IconNode`).
- Con `variant: "plain"` y cada uno de los seis colores declarados, el `outerHTML` del nodo raíz es idéntico al del render sin `color` (test parametrizado con `for` sobre los seis colores comparando `outerHTML` o `className` normalizado).
- Interpolación `{{queries.x.data.count}}` en `label` y `value` funciona en `plain` como en las otras variantes, usando `renderRuntimePageWithState` con un estado que suministre la query.
- `visibility` oculta el nodo `plain` cuando la condición no se cumple (un caso).
- `queryStateFeedback` sustituye el nodo `plain` por el fallback declarado cuando el estado de la query es distinto de `success` (un caso).
- `layout.span` se aplica al contenedor cuando el `stat` `plain` vive dentro de un `container` con `columns` (un caso).
- Un `stat` sin `variant` declarado sigue renderizando como accent (asserción de regresión: el nodo contiene `border-l-4`).
- Un `stat` con `variant: "plain"` dentro de un `repeater` resuelve `item.*` en `label`/`value` por iteración (un caso siguiendo el patrón del fichero).

**Comandos durante la implementación:**
```
pnpm test --run src/tests/layout-renderer/layout-renderer-stat.test.tsx
```

**Restricciones:**
- Reusar los helpers locales `renderRuntimePage`, `renderRuntimePageWithState` y `createRuntimePageState` ya definidos en el propio fichero; no crear harness nuevos ni duplicar los existentes.
- No snapshotear el DOM completo; usar asserciones semánticas (`toBeInTheDocument`, `toHaveTextContent`, comprobaciones de `classList`).
- No modificar los `describe` existentes; añadir un nuevo `describe` para `plain`.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/stat.md` — comportamiento de render de la variante `plain` y actualización de la sección "Lo que está fuera de alcance" si alguno de sus puntos deja de aplicar.
- `ai-workflow/docs/app-features/nodes/index.md` — descripción breve de `stat` en la tabla de nodos hoja visibles ampliada a tres variantes.

### Criterios de finalización

**Cierre de implementación:**
- El fichero `stat-layout-node.tsx` está modificado con la nueva rama `plain`.
- `pnpm test --run` del fichero de layout-renderer en verde.
- `pnpm test` completo sigue en verde y el umbral global de cobertura se mantiene.

---

## Orden de ejecución

1. **T1** — Extender `StatVariant` y schema Zod. Habilita configs con `variant: "plain"`.
2. **T2** — Añadir utilidades de estilo `getStatPlain*`. Habilita el wiring del componente sin repetir clases inline.
3. **T3** — Añadir la rama `plain` al componente y sus tests de render. Cierra la feature end-to-end.
