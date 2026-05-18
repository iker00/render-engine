# Test Plan: Browser hash navigation

## Objetivo
Validar con enfoque tests-first que la navegación del runtime pasa a sincronizarse con el hash del navegador sin abrir un router general, manteniendo `params.*`, la semántica de reentrada por `pageEntry` y el comportamiento observable de `preloads`, formularios y requests declarativos.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, con mínimo del 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación puede iterarse con subconjuntos más pequeños, pero ninguna tarea queda cerrada sin sus tests relevantes en verde y sin pasar `pnpm test` al cierre de la pasada final.

## Unit tests esperados

### 1. Helper de parseo y serialización de hash
- Archivos principales esperados:
  - `src/tests/runtime-browser-hash-navigation.test.ts`
- Comportamiento a validar:
  - parseo de home normalizada `#/`
  - parseo de páginas `#/pageId`
  - parseo de query params en home y en páginas no home
  - degradación de ausencia de hash, `#` y formatos inválidos a home normalizada
  - tratamiento de todos los params leídos como string
  - tratamiento de params sin valor explícito como `''`
  - colapso de claves repetidas conservando la última ocurrencia
  - serialización canónica con orden lexicográfico de claves
  - omisión de params `null`, ausentes o no escalares
  - equivalencia semántica entre hashes con distinto orden textual de params
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-browser-hash-navigation.test.ts`

### 2. Selectores y semántica de equivalencia de entrada
- Archivos principales esperados:
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - arranque del estado desde la entrada derivada del hash
  - continuidad de la lectura de `params.*` desde la entrada activa
  - no-op observable cuando página y params normalizados ya coinciden con la entrada visible
  - diferencia observable cuando cambian los params efectivos aunque el `pageId` sea el mismo
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-state.test.tsx`

## Integration tests esperados

### 3. Sincronización real con navegador desde el provider
- Archivos principales esperados:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
- Comportamiento a validar:
  - arranque sin hash y normalización inmediata a `#/`
  - entrada directa por `#/pageId` y `#/pageId?...`
  - reescritura a hash canónico cuando la URL válida entra con params en orden no canónico
  - escritura del hash correcto desde `navigateTo`
  - delegación de `goBack` al historial del navegador solo cuando existe una entrada previa observada por la sesión
  - no-op visible de `goBack` en una entrada directa sin historial propio observado
  - restauración correcta tras atrás y adelante del navegador
  - fallback silencioso a home para rutas inexistentes o hashes fuera de contrato
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx`

### 4. Reentradas y `preloads` gobernados por hash
- Archivos principales esperados:
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
- Comportamiento a validar:
  - reactivación de `preloads` al entrar por URL directa a una página con precargas
  - no relanzar `preloads` en equivalencias semánticas de params ya normalizados
  - relanzar `preloads` cuando cambia la entrada observable real
  - limpieza previa de queries precargadas también cuando la reentrada viene del historial del navegador
  - conservación del snapshot correcto de `params.*` para la tanda activa
  - ausencia de duplicados observables cuando atrás o adelante reactivan una entrada ya conocida por la sesión
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx`

### 5. Regresión transversal de `params.*`, formularios y requests declarativos
- Archivos principales esperados:
  - `src/tests/runtime-reference-resolution.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-button-navigation.test.tsx`
- Comportamiento a validar:
  - lectura de `params.*` como strings desde URL en texto visible
  - reconstrucción de `defaultValue` de formularios tras reentrada real gobernada por hash
  - resolución correcta de `params.*` en `navigateTo.params`, `api.query`, `api.body` y `api.headers`
  - continuidad de navegación desde `repeater` y de formularios que dependen de params heredados
  - ausencia de divergencia entre hash visible, entrada activa y resolución de referencias
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-api-execution.test.ts src/tests/runtime-button-navigation.test.tsx`

### 6. Regresión final del subconjunto afectado
- Archivos principales esperados:
  - `src/tests/runtime-browser-hash-navigation.test.ts`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
- Comportamiento a validar:
  - coherencia entre helper de hash, provider, `pageEntry`, referencias y requests
  - continuidad de `params.*` como única superficie funcional para parámetros
  - ausencia de regresiones al reentrar con hashes equivalentes o inválidos
  - mantenimiento del gate global de coverage
- Comandos sugeridos durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-browser-hash-navigation.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-reference-resolution.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-api-execution.test.ts`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El alcance queda cubierto por tests locales de helpers puros, provider React y renderer con `window.location.hash` e historial simulados, sin necesidad de introducir navegador real ni backend real.

## Secuencia recomendada de validación por tareas
1. `T0029-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-browser-hash-navigation.test.ts`
2. `T0029-02`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-page-entry-preloads.test.tsx`
3. `T0029-03`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-api-execution.test.ts src/tests/runtime-button-navigation.test.tsx`
4. `T0029-04`
   - No exige tests nuevos si solo actualiza documentación y `status.yaml`
   - Si la pasada documental obliga a tocar código o tests, repetir como mínimo el subconjunto cerrado en `T0029-03`
5. Cierre global de la pasada de implementación
   - Ejecutar `pnpm exec vitest run src/tests/runtime-browser-hash-navigation.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-reference-resolution.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-api-execution.test.ts`
   - Ejecutar `pnpm test`

## Riesgos de validación a vigilar
- Divergencia entre hash visible y entrada activa por mezclar source of truth entre navegador y store.
- Reentradas redundantes por comparar texto de URL en vez de params normalizados.
- Salida accidental de la app al usar `goBack` desde una entrada directa sin historial propio observado por la sesión.
- Pérdida accidental de `params.*` en formularios o requests cuando la entrada venga del historial del navegador.
- Fallback incompleto de hashes inválidos que deje slugs persistentes o estados intermedios inconsistentes.
- Rotura de `preloads` por usar un snapshot viejo al restaurar una entrada histórica.
