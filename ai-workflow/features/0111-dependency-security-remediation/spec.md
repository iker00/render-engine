# 0111 — Dependency security remediation

## Objetivo
Reducir a cero las vulnerabilidades de severidad `critical` y `high` reportadas por `pnpm audit` en el árbol de dependencias del proyecto, sin realizar cambios de major en las dependencias directas y sin degradar el estado verde de `pnpm lint`, `pnpm test` y `pnpm build`.

## Motivación
La auditoría técnica de 2026-07-27 (hallazgos A-01 y A-05) detectó 17 vulnerabilidades vigentes: 1 crítica en `vitest` (arbitrary file read cuando la Vitest UI escucha), 10 `high` (`ws`, `vite` bypass de `server.fs.deny` en Windows, `brace-expansion` DoS, `js-yaml` merge-key DoS, `postcss` path traversal), 4 `moderate` (`ws` memory disclosure, `launch-editor` NTLM, `js-yaml` DoS) y 2 `low` (`esbuild` dev-server file read, `@babel/core` sourceMap). Aunque la mayoría afectan a devDependencies, la superficie transitiva incluye `vite`, `postcss` y `esbuild`, que también intervienen en el build de producción.

## Alcance
- Ejecutar `pnpm audit --fix` y las actualizaciones minor/patch necesarias sobre `package.json` y `pnpm-lock.yaml` para resolver todas las vulnerabilidades `critical` y `high`.
- Aplicar `overrides` en `package.json` cuando una dependencia transitiva vulnerable no se pueda actualizar por otras vías dentro del mismo major.
- Documentar en `notes.md` de la feature qué vulnerabilidades `moderate` o `low` quedan aceptadas y por qué (por ejemplo, "requiere subir de major, out of scope de 0111").
- Verificar que `pnpm lint`, `pnpm test` y `pnpm build` siguen verdes tras los cambios.

## Fuera de alcance
- Upgrades de major de dependencias directas (`typescript 5→7`, `eslint 9→10`, `vite 7→8`, `vitest 3→4`, `jsdom 27→30`, `@vitejs/plugin-react 5→6`). Se abordarán en una feature futura dedicada.
- Añadir un pipeline de CI o cualquier automatización periódica de `pnpm audit`. Corresponde a la feature 0112.
- Reescribir tests, cambiar `vitest.config.ts` u otras configuraciones más allá de lo estrictamente necesario para que la suite siga verde con las nuevas versiones minor/patch.
- Modificar el contrato público del proyecto (no cambian scripts de `package.json` ni comandos de bootstrap documentados en `README.md`).

## Requisitos funcionales
- RF-1: Tras la feature, `pnpm audit --audit-level=high` debe salir con código `0` (cero vulnerabilidades `high` o `critical`).
- RF-2: `pnpm install --frozen-lockfile` debe seguir funcionando; el lockfile queda consistente con `package.json`.
- RF-3: Cualquier vulnerabilidad `moderate` o `low` que quede sin resolver debe estar listada explícitamente en `ai-workflow/features/0111-dependency-security-remediation/notes.md` con: paquete, severidad, causa por la que se acepta, y feature futura que la resolvería si aplica.

## Requisitos no funcionales
- RNF-1: Ningún cambio de major en dependencias declaradas en `package.json`.
- RNF-2: `pnpm lint`, `pnpm test` (con el gate de cobertura del 80% actual) y `pnpm build` siguen verdes tras los cambios.
- RNF-3: El bundle producido por `pnpm build` no debe crecer más de un 5% en tamaño total respecto al estado previo (referencia baseline: `du -sh dist` antes de la feature).
- RNF-4: No se introducen nuevas dependencias directas. Se permiten sólo cambios en versiones ya declaradas y `overrides` puntuales.

## Criterios de aceptación
- CA-1: `pnpm audit --audit-level=high` devuelve exit code `0` y "No known vulnerabilities found" para severidades `high` y `critical`.
- CA-2: `pnpm audit` sigue reportando (si procede) sólo vulnerabilidades `moderate` o `low`, y cada una está documentada en `notes.md`.
- CA-3: `pnpm install --frozen-lockfile && pnpm lint && pnpm build && pnpm test` completan sin error desde una checkout limpia de la rama.
- CA-4: `git diff dev -- package.json pnpm-lock.yaml` es la mayoría del diff funcional; no hay cambios colaterales en `src/` salvo los estrictamente necesarios para adaptar a APIs actualizadas dentro del mismo major (si los hay, quedan explicados en `notes.md`).
- CA-5: `du -sh dist` tras la feature está dentro del ±5% del tamaño previo.

## Casos límite
- CL-1: Una vulnerabilidad `high` sólo se resuelve subiendo de major. Acción esperada: dejarla documentada en `notes.md` como bloqueada por feature futura, y **no** cumplir CA-1 rebajando el gate; si esto ocurre, la feature se detiene y se marca `blocked_by` en `status.yaml` con la referencia al major upgrade requerido.
- CL-2: `pnpm audit --fix` toca versiones que rompen la suite de tests. Acción esperada: revertir la actualización concreta, aplicar el fix manualmente (por ejemplo con `overrides`) o marcar la vuln como bloqueada en `notes.md` con justificación.
- CL-3: Un `override` genera resoluciones de peer dependency inválidas. Acción esperada: rechazar el override y documentar la vulnerabilidad como bloqueada por major.
- CL-4: Tras el fix, aparece una vulnerabilidad `moderate` nueva por la actualización transitiva. Es aceptable siempre que no sea `high` o `critical` y quede documentada.

## Áreas de producto afectadas a alto nivel
- Tooling y dependencias (`package.json`, `pnpm-lock.yaml`).
- Bootstrap y build (indirectamente, por versiones de `vite`, `postcss`, `esbuild`).
- Ninguna área funcional de runtime, config, referencias, nodos, formularios, queries o navegación.

## Documentación probablemente afectada a alto nivel
- Ninguna ficha de `ai-workflow/docs/app-features/` se ve afectada (no cambia comportamiento observable).
- `ai-workflow/docs/current-state.md` no cambia (el stack sigue siendo el mismo).
- `README.md` no cambia (los comandos son los mismos).
- Sí se crea `ai-workflow/features/0111-dependency-security-remediation/notes.md` con el listado de vulnerabilidades residuales aceptadas.

## Riesgos o preguntas abiertas
- R-1: Que `pnpm audit --fix` no resuelva todas las `high` sin subir de major. Mitigación: casos límite CL-1 y CL-2 lo cubren; el gate de la feature es "cero `high`/`critical` explotables o documentadas como bloqueadas por major".
- R-2: Que la actualización de `vite` minor introduzca regresiones sutiles en el build. Mitigación: gate `pnpm build` + comprobación de tamaño del bundle (CA-5).
