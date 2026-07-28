# Tasks — 0112 — Minimal CI pipeline

Contrato de ejecución. Ordenado por dependencia. La siguiente tarea que debe abordarse siempre es la primera cuyo estado no sea `done`.

Referencia común para toda la feature:
- El alcance completo de esta feature es un único fichero declarativo (`.gitlab-ci.yml` en la raíz del repo). No hay capas de dominio, runtime ni tests automatizados de `src/` implicados: es tooling puro de CI.
- Fuente de verdad de versiones a respetar: `package.json` → `engines.node: ">=22.0.0 <23.0.0"`, `packageManager: "pnpm@10.19.0"`; `.nvmrc` → `22`.
- Fuente de verdad de comandos de validación a orquestar, en este orden exacto: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm build`, `pnpm test` (`pnpm test` ya ejecuta `vitest run --coverage` con el gate de cobertura del 80% de `vitest.config.ts`; el pipeline no añade ni sustituye ese gate).
- Fuera de alcance para toda la feature (spec, sección "Fuera de alcance"): pipelines de despliegue, publicación de artefactos de build, escaneo de seguridad, integración con Codecov o equivalente, notificaciones externas, matrices de versiones de Node, badge en `README.md`, activar el ajuste "pipeline debe pasar para mergear" en la configuración del proyecto GitLab (vive fuera del repositorio).

---

## Task 1 — Crear `.gitlab-ci.yml` con el pipeline mínimo de verificación

- **ID**: 0112-T1
- **Estado**: pending
- **Objetivo**: Añadir en la raíz del repositorio un fichero `.gitlab-ci.yml` que defina un único job de verificación (`verify`) que ejecute, en este orden y sin omitir ninguno, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm build` y `pnpm test`, usando Node 22 y Corepack fijado a `pnpm@10.19.0`, sin `rules`/`only`/`except` que restrinjan cuándo corre el job (para que corra en cualquier push a cualquier rama, satisfaciendo RF-1, y sea visible en cualquier Merge Request sobre la rama origen sin necesidad de un pipeline `merge_request_event` separado, satisfaciendo RF-2/CA-4 sin introducir el problema conocido de pipelines duplicadas cuando coexisten `push` y `merge_request_event` sin `workflow:rules` que los diferencie).

  Shape exacto a producir (los nombres de clave, su anidación y el orden de los comandos de `script` son parte del contrato; los valores concretos de `image`, `PNPM_HOME` y la estrategia de `cache` son la única superficie donde cabe una implementación equivalente pero no idéntica byte a byte):

  ```yaml
  stages:
    - verify

  variables:
    PNPM_HOME: "$CI_PROJECT_DIR/.pnpm-store"

  verify:
    stage: verify
    image: node:22-alpine
    before_script:
      - corepack enable
      - corepack prepare pnpm@10.19.0 --activate
      - pnpm config set store-dir "$PNPM_HOME"
    cache:
      key:
        files:
          - pnpm-lock.yaml
      paths:
        - .pnpm-store
    script:
      - pnpm install --frozen-lockfile
      - pnpm lint
      - pnpm build
      - pnpm test
  ```

- **Fuera de alcance**:
  - No añadir stages ni jobs adicionales (deploy, release, escaneo de seguridad, notificaciones, badge).
  - No añadir `rules:`, `only:`, `except:` ni bloque `workflow:` que condicione cuándo corre el job por rama, evento o `changes:` de path (CL-1: un push que solo toca `ai-workflow/**` debe disparar igual el pipeline completo).
  - No modificar `package.json`, `vitest.config.ts`, `.nvmrc` ni ningún otro fichero de configuración existente.
  - No introducir variables de entorno, secretos ni integraciones que no existan ya en el proyecto (RNF-4).
  - No hacer bloqueante la ausencia o corrupción de la cache de pnpm: si `cache` falla o está vacía en la primera ejecución, el job debe degradar a una instalación sin cache, nunca a un fallo del pipeline (CL-3). Esto ya es el comportamiento por defecto del mecanismo de `cache` de GitLab CI; no añadir lógica adicional para forzarlo.
- **Dependencias**: ninguna. Es la única tarea de la feature.
- **Impacto esperado en archivos**:
  - Código: ninguno (no hay cambios en `src/`).
  - Tooling: `.gitlab-ci.yml` (crear, en la raíz del repositorio).
  - Tests: ninguno.
  - Documentación: ninguno (ver "Documentación afectada").
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: no existe suite automatizada de Vitest aplicable a un fichero de configuración declarativa de CI. La verificación de esta tarea es manual, sobre el propio repositorio y sobre la ejecución real del pipeline en GitLab tras el primer push.
  - **Comportamiento cubierto**:
    - `.gitlab-ci.yml` es YAML sintácticamente válido: indentación consistente de dos espacios, sin tabs, parseable sin errores.
    - Existe exactamente un job (`verify`) cuyo `script` contiene, en este orden y sin comandos adicionales entre medias, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm build`, `pnpm test`.
    - El job fija la versión de pnpm vía Corepack a `pnpm@10.19.0` (coincide con `packageManager` de `package.json`) antes de ejecutar `pnpm install`.
    - El job usa una imagen base de Node 22 (coincide con `engines.node` de `package.json` y con `.nvmrc`).
    - El job no declara `rules`, `only` ni `except`: corre para cualquier pipeline disparado por push, en cualquier rama.
    - Ejecutando localmente y en este orden `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm build`, `pnpm test` (los mismos cuatro comandos que el job, sin la cache que sólo aplica en CI), los cuatro terminan con código de salida 0 sobre el estado actual del repositorio, confirmando que el pipeline no fallaría por una regresión preexistente ajena a esta feature.
    - Tras el primer push de la rama de esta feature a GitLab, el pipeline resultante muestra un job `verify` en verde si los cuatro comandos pasan (CA-3), y la Merge Request hacia `dev` muestra el estado de ese mismo pipeline (CA-4).
  - **Comandos durante la implementación**:
    - No aplica `pnpm test --run <ruta>` (no hay fichero de test de Vitest para esta tarea). Verificación manual: ejecutar en la raíz del repo, en este orden, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm build`, `pnpm test`, y confirmar que las cuatro invocaciones terminan sin error antes de dar la tarea por cerrada.
  - **Restricciones**:
    - `pnpm test` ya aplica el gate de cobertura del 80% vía `vitest.config.ts`; no añadir ni duplicar ese umbral en `.gitlab-ci.yml`.
    - No introducir `workflow:rules` para evitar duplicar pipelines entre `push` y `merge_request_event`: la ausencia total de `rules` en el único job ya evita ese problema (el job sólo corre en pipelines de tipo `push`, y GitLab muestra ese mismo pipeline de rama en la MR asociada).
    - Si la imagen `node:22-alpine` no resultase viable en la instancia real de GitLab (riesgo externo P-2 de la spec, no resoluble desde el repositorio), sustituir por `node:22` (Debian) manteniendo el resto del job idéntico; no es un cambio de alcance de esta tarea.
- **Documentación afectada**: ninguno. La spec (sección "Documentación probablemente afectada a alto nivel") confirma que ninguna ficha de `ai-workflow/docs/app-features/` ni `current-state.md` se ve afectada, y que `README.md` no requiere cambios obligatorios (la mención opcional de badge queda fuera de alcance, P-1 de la spec).
- **Criterios de finalización**:
  - Cierre de implementación: `.gitlab-ci.yml` existe en la raíz del repositorio con el shape descrito arriba (un `stage`/job `verify`, Corepack fijado a `pnpm@10.19.0`, imagen Node 22, sin `rules`/`only`/`except`, `script` con los cuatro comandos en el orden exacto); los cuatro comandos verificados manualmente en local terminan en éxito; el primer pipeline disparado en GitLab tras el push de la rama termina en el estado esperado (verde si el código está en verde).

---

## Cierre de la feature

Cuando la Task 1 quede en `done`, la feature está completa: existe un pipeline de GitLab CI mínimo que sustituye el gate manual de `pnpm lint`/`pnpm build`/`pnpm test` por un gate automático en cada push y visible en cada Merge Request, sin despliegue, sin artefactos publicados y sin integraciones externas. No hay tareas adicionales de documentación funcional que cerrar: ninguna ficha de `ai-workflow/docs/app-features/` cambia como consecuencia de esta feature.
