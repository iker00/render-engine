# Tareas — 0111 Dependency security remediation

## Contexto técnico fijado en planificación
`pnpm audit --json` (2026-07-27, sobre el lockfile actual) reporta 17 vulnerabilidades: 1 `critical`, 10 `high`, 4 `moderate`, 2 `low`. El propio `pnpm audit` ya distingue qué puede resolver de forma automática (`action: update`) de lo que requiere intervención manual (`action: review`):

| Paquete | Ruta de resolución | Severidad(es) | Versión objetivo | Vía |
|---|---|---|---|---|
| `vitest` | `.>vitest` (devDependency directa, declarada `^3.2.4`) | critical (1120126) | `>=3.2.6` (última `3.2.7` disponible en `^3.2.4`) | manual (`review`) — coordinar con `@vitest/coverage-v8` (peer) |
| `@vitest/coverage-v8` | devDependency directa, declarada `^3.2.4` | — (debe subir en paralelo a `vitest` para no romper el peer) | `3.2.7` | manual, mismo paso que `vitest` |
| `vite` | `.>vite` (devDependency directa, declarada `^7.1.12`) | high (1123526), moderate (1120785) | `>=7.3.5` (última `7.3.6` disponible en `^7.1.12`) | manual (`review`) |
| `ws` | `.>jsdom>ws` (transitiva, resuelta hoy en `8.20.0`) | high (1123259), moderate (1119108) | `8.21.1` | automática (`pnpm audit --fix`) |
| `js-yaml` | `.>eslint>@eslint/eslintrc>js-yaml` (transitiva, resuelta hoy en `4.1.1`) | high (1123911), moderate (1121860) | `4.3.0` | automática (`pnpm audit --fix`) |
| `postcss` | `.>vite>postcss` (transitiva, resuelta hoy en `8.5.12`) | high (1124288) | `8.5.23` | automática (`pnpm audit --fix`), pero puede volver a bajar si `pnpm update vite` la reescribe — reverificar tras tocar `vite` |
| `@babel/core` | `.>@vitejs/plugin-react>@babel/core` (transitiva, resuelta hoy en `7.29.0`) | low (1123528) | `7.29.7` | automática (`pnpm audit --fix`) |
| `brace-expansion` (línea `5.x`, vía `@vitest/coverage-v8>test-exclude>minimatch>brace-expansion`) | resuelta hoy en `5.0.5` | high (1123898, 1124334) | `5.0.8` | automática (`pnpm audit --fix`) |
| `brace-expansion` (línea `1.x`, vía `eslint>minimatch>brace-expansion`) | resuelta hoy en `1.1.14` | high (1123897, 1124334) | `>=1.1.16` | manual (`review`) — probablemente requiere `pnpm.overrides` |
| `brace-expansion` (línea `2.x`, vía `@vitest/coverage-v8>test-exclude>glob>minimatch>brace-expansion`) | resuelta hoy en `2.1.0` | high (1123896, 1124334) | `>=2.1.2` | manual (`review`) — probablemente requiere `pnpm.overrides`, puede quedar resuelta como efecto colateral de subir `@vitest/coverage-v8` en T1 |
| `esbuild` | `.>vite>esbuild` (transitiva) | low (1120680) | `>=0.28.1` | `review`, posible residual bloqueado por major de `vite` — confirmar en T5 |

Ninguna de las vulnerabilidades `critical`/`high` requiere, según este análisis, subir el major de una dependencia directa declarada en `package.json`: `vitest` y `vite` ya admiten la versión parcheada dentro de su rango `^` actual, y el resto son transitivas resolubles vía `pnpm audit --fix` o `pnpm.overrides` puntuales. Si la implementación descubre que alguna sólo se resuelve con un major, aplica el caso límite CL-1 de `spec.md`: no se fuerza el gate, se documenta en `notes.md` y se marca `blocked_by` en `status.yaml`.

## Orden de ejecución
T1 → T2 → T3 → T4 → T5 (estrictamente secuencial: cada tarea modifica `package.json`/`pnpm-lock.yaml` y la siguiente parte del estado dejado por la anterior; no paralelizar).

---

## T1 — Actualizar `vitest` y `@vitest/coverage-v8` (resuelve la vulnerabilidad `critical`)

**Objetivo**: Antes de tocar cualquier dependencia, capturar el baseline pre-feature: ejecutar `pnpm install --frozen-lockfile && pnpm build && du -sh dist` y guardar el resultado (tamaño de `dist`) junto con la salida de `pnpm audit --json` en un fichero de trabajo temporal fuera del repo o anotado en esta misma tarea, para que T5 pueda citarlo literalmente en `notes.md` sin tener que reconstruirlo retrocediendo en git. Hecho esto, elevar `vitest` y `@vitest/coverage-v8` a `3.2.7` (o el último patch disponible dentro del rango ya declarado `^3.2.4`) para resolver la vulnerabilidad `critical` 1120126 ("arbitrary file read" cuando la Vitest UI escucha).

**Fuera de alcance**: Cualquier cambio de major de `vitest`/`@vitest/coverage-v8` (3→4). Cambios en `vitest.config.ts` salvo que la nueva versión rompa la config actual sin alternativa dentro del mismo major (si ocurre, documentar en `notes.md` y limitar el cambio a lo estrictamente necesario).

**Dependencias**: Ninguna. Es la primera tarea porque resuelve la única vulnerabilidad `critical`, porque `@vitest/coverage-v8` arrastra `test-exclude>glob>minimatch>brace-expansion` (línea `2.x`, ver tabla) y por lo que subir esta dependencia primero puede reducir el trabajo manual de T4, y porque debe capturar el baseline pre-feature antes de que ninguna otra tarea toque `package.json`/`pnpm-lock.yaml`.

**Impacto esperado en archivos**:
- Código: ninguno esperado. Si la API de `vitest`/`@vitest/coverage-v8` cambia de forma incompatible dentro del mismo major (poco probable en un bump de patch), ajustar solo el punto de uso afectado y documentarlo en `notes.md`.
- Configuración: `package.json` (versión declarada de `vitest` y `@vitest/coverage-v8`), `pnpm-lock.yaml`.
- Tests: ninguno nuevo.
- Otros: ningún fichero del repo; el baseline capturado (tamaño de `dist` y `pnpm audit --json` inicial) es un dato de trabajo que esta tarea debe dejar disponible textualmente para que T5 lo cite en `notes.md`.

**Tests**:
- Ficheros de test: ninguno (nuevo/ampliación). Cubierto por la suite existente completa como regresión.
- Comportamiento cubierto:
  - La suite completa de `src/tests/` sigue pasando con la nueva versión de `vitest`/`@vitest/coverage-v8`.
  - El umbral de cobertura del 80% (`functions`, `lines`, `statements`) se mantiene tras el bump.
- Comandos durante la implementación: `pnpm test` (suite completa; no hay fichero de test específico que iterar en esta tarea).
- Restricciones: No añadir ni modificar ningún fichero de `src/tests/` en esta tarea. No tocar `vitest.config.ts` salvo rotura real documentada.

**Documentación afectada**: ninguna ficha de `ai-workflow/docs/app-features/`. `ai-workflow/docs/current-state.md` no cambia (stack sigue siendo el mismo).

**Criterios de finalización**: El baseline pre-feature (tamaño de `dist` vía `du -sh dist` y `pnpm audit --json` inicial) queda capturado y disponible en texto plano antes de aplicar ningún bump. `pnpm audit --json` ya no reporta el advisory 1120126. `pnpm test` pasa en verde con cobertura ≥80%. `pnpm lint` sigue en verde. `pnpm build` sigue en verde. `git diff` de esta tarea limitado a `package.json` y `pnpm-lock.yaml` (salvo ajuste puntual documentado).

**Cierre de implementación**: cerrada cuando los cuatro comandos anteriores (`audit`, `test`, `lint`, `build`) confirman el estado descrito y el diff está acotado.

---

## T2 — Actualizar `vite` (resuelve la vulnerabilidad `high` de `server.fs.deny` y la `moderate` de `launch-editor`)

**Objetivo**: Elevar `vite` a `7.3.6` (o el último patch disponible dentro del rango ya declarado `^7.1.12`) para resolver el advisory `high` 1123526 (bypass de `server.fs.deny` en Windows) y el `moderate` 1120785 (NTLMv2 hash disclosure de `launch-editor`).

**Fuera de alcance**: Cualquier cambio de major de `vite` (7→8). Cambios en `vite.config.ts` más allá de lo estrictamente necesario para que el build siga funcionando con la nueva versión dentro del mismo major.

**Dependencias**: T1 completada (secuencial; evita tocar `package.json`/`pnpm-lock.yaml` en paralelo con otra tarea).

**Impacto esperado en archivos**:
- Código: ninguno esperado.
- Configuración: `package.json` (versión declarada de `vite`), `pnpm-lock.yaml`.
- Tests: ninguno nuevo.

**Tests**:
- Ficheros de test: ninguno. Cubierto por la suite existente completa, en particular `src/tests/dev-runtime/dev-runtime-bundle.test.ts` y `src/tests/dev-runtime/runtime-nodes-bundle.test.ts` (gates de build de producción, ejecutados vía `pnpm test:build`), por ser los más sensibles a cambios de `vite`.
- Comportamiento cubierto:
  - `pnpm build` sigue completando sin error con la nueva versión de `vite`.
  - Los gates de bundle/code-splitting existentes (`dev-runtime-bundle.test.ts`, `runtime-nodes-bundle.test.ts`) siguen en verde.
  - El resto de la suite (`pnpm test`) no presenta regresión.
- Comandos durante la implementación: `pnpm test:build` seguido de `pnpm test` (suite completa).
- Restricciones: No modificar `vite.config.ts` salvo rotura real, documentada en `notes.md`, y limitada al cambio mínimo necesario.

**Documentación afectada**: ninguna.

**Criterios de finalización**: `pnpm audit --json` ya no reporta 1123526 ni 1120785. Tras este bump, reconfirmar con `pnpm why postcss` que la resolución de `postcss` no ha bajado de `8.5.12` (si `vite` re-resuelve `postcss` a una versión distinta, dejar constancia del valor resultante para que T3 parta de ese estado real). `pnpm lint`, `pnpm test` y `pnpm build` en verde.

**Cierre de implementación**: cerrada cuando los advisories 1123526/1120785 desaparecen de `pnpm audit` y los tres comandos de gate están en verde.

---

## T3 — Barrido automático con `pnpm audit --fix` (`ws`, `js-yaml`, `postcss`, `@babel/core`, resto de `brace-expansion` 5.x)

**Objetivo**: Ejecutar `pnpm audit --fix` sobre el estado dejado por T1/T2 para aplicar las actualizaciones que `pnpm audit` ya sabe resolver automáticamente dentro de los rangos existentes: `ws` → `8.21.1` (resuelve high 1123259 + moderate 1119108), `js-yaml` → `4.3.0` (resuelve high 1123911 + moderate 1121860), `postcss` → `8.5.23` o superior (resuelve high 1124288), `@babel/core` → `7.29.7` (resuelve low 1123528), y la línea `5.x` de `brace-expansion` → `5.0.8` (resuelve high 1123898/1124334 en esa ruta concreta).

**Fuera de alcance**: Resolver manualmente las líneas `1.x`/`2.x` de `brace-expansion` marcadas como `review` por `pnpm audit` (eso es T4). Cualquier cambio de major que `--fix` pudiera proponer: si `pnpm audit --fix` intenta subir el major de algún paquete, rechazar ese cambio puntual y documentarlo como bloqueado en `notes.md` (CL-1).

**Dependencias**: T2 completada.

**Impacto esperado en archivos**:
- Código: ninguno esperado.
- Configuración: `pnpm-lock.yaml` (principalmente). `package.json` solo si `pnpm audit --fix` necesita anotar un `pnpm.overrides` para completar alguno de estos fixes sin tocar majors.
- Tests: ninguno nuevo.

**Tests**:
- Ficheros de test: ninguno. Cubierto por la suite existente completa.
- Comportamiento cubierto:
  - La suite completa sigue en verde tras el barrido automático (en particular `src/tests/app/` y `src/tests/config-validation/`, más sensibles a cambios de `js-yaml`/`eslint` en tooling, aunque no se ejecutan en runtime de producto).
  - `pnpm lint` sigue en verde tras el bump de `js-yaml` (usado por `eslint`).
- Comandos durante la implementación: `pnpm test` (suite completa).
- Restricciones: Antes de aceptar el resultado, comparar `pnpm audit --json` antes/después de `--fix` para confirmar exactamente qué advisories desaparecieron y que ninguno de los paquetes tocados subió de major respecto a `package.json`.

**Documentación afectada**: ninguna.

**Criterios de finalización**: Los advisories 1123259, 1119108, 1123911, 1121860, 1124288, 1123528 y el `brace-expansion` de la ruta `test-exclude>minimatch>brace-expansion` (línea 5.x) ya no aparecen en `pnpm audit --json`. `pnpm lint`, `pnpm test` y `pnpm build` en verde. Ningún major subido en `package.json` respecto al estado previo a la feature.

**Cierre de implementación**: cerrada cuando el listado de advisories anterior está vacío en `pnpm audit --json` y los tres gates están en verde.

---

## T4 — Resolver manualmente las líneas `1.x` y `2.x` de `brace-expansion` (rutas `review`)

**Objetivo**: Resolver las dos rutas de `brace-expansion` que `pnpm audit` marca como `review` (no auto-fixables): la línea `1.x` vía `eslint>minimatch>brace-expansion` (hoy `1.1.14`, objetivo `>=1.1.16`) y la línea `2.x` vía `@vitest/coverage-v8>test-exclude>glob>minimatch>brace-expansion` (hoy `2.1.0`, objetivo `>=2.1.2`). Antes de tocar nada, volver a ejecutar `pnpm audit --json` para confirmar cuáles de estas dos rutas siguen vulnerables tras T1–T3 (el bump de `@vitest/coverage-v8` en T1 puede haber resuelto ya la línea `2.x` como efecto colateral).

**Fuera de alcance**: Tocar la línea `5.x` de `brace-expansion` (ya resuelta en T3). Cambiar el major de `eslint` o de `@vitest/coverage-v8`.

**Dependencias**: T3 completada.

**Impacto esperado en archivos**:
- Código: ninguno.
- Configuración: `package.json`, añadiendo un bloque `pnpm.overrides` selectivo por versión mayor si hace falta forzar la resolución (por ejemplo `"brace-expansion@1": "^1.1.16"` y/o `"brace-expansion@2": "^2.1.2"`, solo para las líneas que sigan vulnerables tras la reverificación inicial). `pnpm-lock.yaml`.
- Tests: ninguno nuevo.

**Tests**:
- Ficheros de test: ninguno. Cubierto por la suite existente completa.
- Comportamiento cubierto:
  - `pnpm lint` sigue funcionando igual tras forzar la versión de `brace-expansion` consumida por `eslint` (glob patterns de `.eslintignore`/config no cambian de comportamiento).
  - La suite completa (`pnpm test`) no presenta regresión tras forzar la versión de `brace-expansion` consumida por `@vitest/coverage-v8` (afecta a exclusión de ficheros de cobertura).
- Comandos durante la implementación: `pnpm test` (suite completa) y `pnpm lint`.
- Restricciones: Si el `override` genera una resolución de peer dependency inválida (`pnpm install` falla o reporta conflicto) o si `pnpm ls brace-expansion` muestra que el override introduce una versión fuera del major original que sustituye, rechazar ese override concreto y documentar la vulnerabilidad como bloqueada por major en `notes.md` (CL-3), dejando el resto de la feature intacta.

**Documentación afectada**: ninguna.

**Criterios de finalización**: `pnpm audit --json` no reporta ninguna vulnerabilidad `high`/`critical` restante (o, si alguna sigue sin resolverse sin tocar un major, queda explícitamente documentada en `notes.md` y `status.yaml.blocked_by` referencia la vulnerabilidad concreta, sin marcar el gate como superado). `pnpm install` no reporta conflictos de peer dependencies nuevos. `pnpm lint`, `pnpm test` y `pnpm build` en verde.

**Cierre de implementación**: cerrada cuando `pnpm audit --audit-level=high` devuelve código `0`, o cuando el residuo que impide ese código `0` está documentado como bloqueado por major según CL-1/CL-3.

---

## T5 — Verificación final, tamaño de bundle y `notes.md`

**Objetivo**: Confirmar de punta a punta los criterios de aceptación de `spec.md` (CA-1 a CA-5) sobre el estado dejado por T1–T4, y dejar `notes.md` con el listado final de cualquier vulnerabilidad `moderate`/`low` residual según RF-3.

**Fuera de alcance**: Introducir nuevos fixes de dependencias no cubiertos por T1–T4. Si en esta tarea aparece una vulnerabilidad `high`/`critical` no contemplada en T1–T4 (por ejemplo, introducida como efecto colateral de una actualización anterior — CL-4 sólo permite esto para `moderate`/`low`), no cerrar la feature: volver a una tarea anterior o documentar el bloqueo en `status.yaml`.

**Dependencias**: T4 completada.

**Impacto esperado en archivos**:
- Código: ninguno.
- Configuración: ninguno adicional (solo verificación).
- Documentación/artefactos de feature: `ai-workflow/features/0111-dependency-security-remediation/notes.md` (nuevo), con el listado de vulnerabilidades `moderate`/`low` residuales (paquete, severidad, causa de aceptación, feature futura si aplica) siguiendo el formato de RF-3. Si no queda ninguna residual, `notes.md` debe decirlo explícitamente en vez de omitirse.
- Tests: ninguno nuevo.

**Tests**:
- Ficheros de test: ninguno. Cubierto por la suite existente completa (`pnpm test`) y por los gates de bundle (`pnpm test:build`).
- Comportamiento cubierto:
  - La suite completa pasa en verde con cobertura ≥80% sobre el estado final de dependencias.
  - Los gates de bundle de producción (`dev-runtime-bundle.test.ts`, `runtime-nodes-bundle.test.ts`) siguen en verde.
- Comandos durante la implementación: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:build`, `pnpm audit --audit-level=high`.
- Restricciones: Ninguna adicional a las ya fijadas en T1–T4.

**Documentación afectada**: ninguna ficha de `ai-workflow/docs/app-features/` (spec ya establece que ninguna cambia). `notes.md` de la propia feature es el único artefacto documental que se crea aquí, como cierre de las tareas de código anteriores, no como tarea documental independiente.

**Criterios de finalización**:
- CA-1: `pnpm audit --audit-level=high` devuelve código `0`, o la excepción está documentada como bloqueada por major (CL-1) sin marcar este criterio como cumplido.
- CA-2: cualquier `moderate`/`low` restante está en `notes.md` con paquete, severidad, causa y feature futura si aplica.
- CA-3: `pnpm install --frozen-lockfile && pnpm lint && pnpm build && pnpm test` completan sin error desde checkout limpio de la rama.
- CA-4: `git diff dev -- package.json pnpm-lock.yaml` concentra la mayoría del diff funcional de la feature; cualquier cambio en `src/` queda explicado en `notes.md`.
- CA-5: `du -sh dist` tras `pnpm build` está dentro de ±5% del baseline capturado en T1 antes de aplicar ningún bump; dejar ambos valores (baseline de T1 y valor final de esta tarea) en `notes.md`.

**Cierre de implementación**: cerrada cuando los cinco criterios anteriores están confirmados (o documentados como bloqueo explícito según CL-1) y `notes.md` refleja el estado final real de `pnpm audit`.

---

## Siguiente tarea recomendada
T1 — Actualizar `vitest` y `@vitest/coverage-v8`.
