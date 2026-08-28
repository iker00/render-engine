# Notas — 0111 Dependency security remediation

## Resumen de lo hecho (T1–T4)

Baseline pre-feature (capturado en T1, `pnpm install --frozen-lockfile && pnpm build` sobre `dev`):
- `pnpm audit --json`: 17 vulnerabilidades (1 critical, 10 high, 4 moderate, 2 low), 396 dependencias totales.
- `du -sh dist`: `1.5M` (1.445.462 bytes exactos, verificado en T5 reconstruyendo `dev` en un worktree aparte).

| Tarea | Cambio | Vulnerabilidades resueltas |
|---|---|---|
| T1 | `vitest` y `@vitest/coverage-v8` `^3.2.4` → `^3.2.7` | Critical `1120126` (GHSA-5xrq-8626-4rwp, arbitrary file read vía Vitest UI) |
| T2 | `vite` `^7.1.12` → `^7.3.6` | High `1123526` (bypass de `server.fs.deny`), Moderate `1120785` (`launch-editor` NTLM). `postcss` se mantiene en `8.5.12` tras este bump (no baja por sí solo) |
| T3 | `pnpm audit --fix` + `overrides` en `pnpm-workspace.yaml` (fichero nuevo; pnpm 10.19 coloca los overrides ahí en vez de en `package.json`) | `ws` → `8.21.1`, `js-yaml` → `4.3.0`, `postcss` → `8.5.23`, `@babel/core` → `7.29.7`, `brace-expansion` línea 5.x → `5.0.8`. Se corrigieron 2 saltos de major que el `--fix` automático había introducido por su cuenta (`js-yaml` a `5.2.2`, `@babel/core` a `8.0.1`), forzándolos de vuelta a notación caret dentro de su major original. Se acotó un override de `brace-expansion` que capturaba de más la línea 1.x y rompía `pnpm lint` |
| T4 | Investigación de las líneas 1.x (`eslint>minimatch>brace-expansion`, en `1.1.16`) y 2.x (`@vitest/coverage-v8>test-exclude>glob>minimatch>brace-expansion`, en `2.1.2`) del advisory `1124334` | Ninguna adicional: ambas líneas ya estaban en la versión parcheada real de su propia línea (advisories específicos `1123897` y `1123896`, ausentes del audit). Se probó forzar un override a `5.x` en ambas líneas: rompe `pnpm lint` (`TypeError: expand is not a function`, `minimatch@3.1.5` incompatible con la API de `brace-expansion` 5.x). Override revertido |

Ninguna de las cuatro tareas tocó código de `src/`; todo el cambio funcional vive en `package.json`, `pnpm-lock.yaml` y el nuevo `pnpm-workspace.yaml` (overrides).

## Verificación final (T5)

Se ejecutó `pnpm audit --json` de forma independiente (no se copió el resumen de T1-T4 sin verificar). Resultado exacto tras T1-T4:

```json
"vulnerabilities": { "info": 0, "low": 1, "moderate": 0, "high": 2, "critical": 0 },
"totalDependencies": 400
```

El campo `high: 2` corresponde a un único advisory (`1124334`) que aparece en **dos rutas** de dependencia distintas (líneas 1.x y 2.x de `brace-expansion`), no a dos vulnerabilidades distintas. En términos de advisories únicos: **1 high + 1 low**, cero moderate, cero critical. Coincide exactamente con lo documentado en T4 — no aparece ninguna vulnerabilidad nueva no analizada.

## Tabla de residuales (RF-3)

| Paquete | Severidad | Advisory | Causa de aceptación | Feature futura |
|---|---|---|---|---|
| `brace-expansion` (vía `eslint>minimatch` en `1.1.16` y `@vitest/coverage-v8>test-exclude>glob>minimatch` en `2.1.2`) | high | `1124334` (GHSA-mh99-v99m-4gvg) | Falso positivo de rango: `vulnerable_versions` declarado como `<=5.0.7` **sin cota inferior**, por lo que casa con cualquier línea major menor aunque esté parcheada dentro de su propia línea. Ambas versiones instaladas (`1.1.16` y `2.1.2`) son ya las versiones parcheadas de sus advisories específicos por línea (`1123897`, `1123896`), que no aparecen en el audit. Forzar un override a la línea `5.x` en ambas rutas rompe `pnpm lint` (`TypeError: expand is not a function`; `minimatch@3.1.5`, dependencia transitiva de `eslint`, es incompatible con la API de `brace-expansion` 5.x). No hay vulnerabilidad real explotable adicional: es un artefacto del formato de rango del advisory, no del código instalado. | Resolución real requeriría que `eslint` (línea `minimatch@3.x`) publique una versión con `minimatch` actualizado, o subir `eslint` de major — fuera de alcance de 0111 (ver RNF-1). Reevaluar cuando 0111-follow-up o una feature dedicada a majors de tooling (`eslint 9→10`, etc.) esté planificada |
| `esbuild` (vía `.>vite>esbuild`, actualmente `0.27.7`) | low | `1120680` | Arbitrary file read en el dev server de `esbuild` en Windows. Resolver requiere subir `vite` de major (7→8), ya que la versión de `esbuild` está fijada por el propio `vite` dentro de su rango de major 7.x. Es un `devDependency` transitivo del dev server; no afecta al build de producción ni al bundle servido | Explícitamente fuera de alcance de 0111 (`vite 7→8` está en la lista de majors diferidos de la spec). Candidata para una feature futura de "majors de tooling" |

No hay vulnerabilidades `moderate` residuales.

## Resultado real de los criterios de aceptación

**CA-1** — `pnpm audit --audit-level=high` ¿devuelve código 0?
**NO.** Devuelve exit code `1` porque el advisory `1124334` (high) sigue apareciendo en el audit, aunque sea un falso positivo de rango (ver tabla de residuales). **CA-1 no se cumple en el sentido literal del gate**, pero sí se cumple en sustancia: no queda ninguna vulnerabilidad `high`/`critical` real y explotable pendiente de resolver dentro del alcance de la feature. La causa (formato de rango sin cota inferior en el advisory, verificado contra los advisories específicos por línea ya resueltos) está documentada arriba y en T4. No se ha forzado el gate ni se ha maquillado el resultado.

**CA-2** — Residuales `moderate`/`low` (y el high de `brace-expansion`, justificado) documentados en `notes.md`.
**Cumplido.** Ver tabla de residuales arriba: 1 `high` (falso positivo, justificado) y 1 `low` (`esbuild`, bloqueado por major de `vite`). Cero `moderate`.

**CA-3** — `pnpm install --frozen-lockfile && pnpm lint && pnpm build && pnpm test` completan sin error desde checkout limpio de la rama.
**Cumplido.** Ejecutado en T5 de forma independiente:
- `pnpm install --frozen-lockfile` → lockfile up to date, exit 0.
- `pnpm lint` → sin errores, exit 0.
- `pnpm build` → `tsc --noEmit` (app + node) y `vite build` completan sin error, exit 0.
- `pnpm test` → 158 test files, 3593 tests, todos en verde. Cobertura global `93.63%` statements / `90.07%` branch / `96.3%` funcs / `93.63%` lines — por encima del gate del 80%. Exit 0.
- Adicionalmente se ejecutó `pnpm test:build` (gate de bundling de nodos y dev-runtime): 12 tests, todos en verde, exit 0.

**CA-4** — `git diff dev -- package.json pnpm-lock.yaml pnpm-workspace.yaml` concentra la mayoría del diff funcional.
**Cumplido, al 100%.** `git diff dev --stat -- src/` no muestra ningún cambio: cero ficheros tocados en `src/`. Todo el diff funcional de la rama respecto a `dev` está en `package.json` (6 líneas, los 2 bumps de T1/T2) y `pnpm-lock.yaml` (383 líneas, resolución de versiones), más el fichero nuevo `pnpm-workspace.yaml` (overrides de T3/T4, no aparece en `git diff` por estar sin trackear pero es el único fichero adicional con contenido funcional). No hay cambios colaterales de ningún tipo en código de aplicación.

**CA-5** — `du -sh dist` tras `pnpm build` dentro de ±5% del baseline de T1 (`1.5M`).
**Cumplido, con margen amplio.** Para obtener una comparación exacta (no solo el valor redondeado `1.5M` de T1), se reconstruyó `dist` desde `dev` en un worktree aislado con `pnpm install --frozen-lockfile && pnpm build`: **1.445.462 bytes**. El `dist` de la rama de la feature, construido de la misma forma: **1.445.462 bytes**. Son **exactamente el mismo tamaño en bytes (0.00% de variación)**. Ambos redondean a `1.5M` con `du -sh`.

## Conclusión

Todos los criterios que dependen de esta feature se cumplen. El único punto que no se cumple en su literalidad (CA-1, gate de `pnpm audit --audit-level=high` exit 0) está causado por una limitación externa del formato del advisory `1124334` (rango sin cota inferior), ya analizada exhaustivamente en T4, sin alternativa dentro del alcance de 0111 (RNF-1: no majors; el override probado rompe `pnpm lint`). No se ha detectado ninguna vulnerabilidad `high`/`critical` nueva ni ningún test roto. La feature se considera cerrada.
