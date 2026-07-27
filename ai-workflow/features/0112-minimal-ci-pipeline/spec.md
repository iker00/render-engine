# 0112 — Minimal CI pipeline

## Objetivo
Introducir un pipeline mínimo de GitLab CI/CD que ejecute automáticamente la validación ya existente del proyecto (instalación de dependencias, lint, build y test con gate de cobertura) en cada push y en cada Merge Request, sustituyendo el gate manual actual (un humano ejecutando estos comandos a mano antes de mergear) por un gate automático que bloquee el pipeline si alguno falla.

## Motivación
Hallazgo A-10 de la auditoría técnica del repo (2026-07-27): no existe ningún pipeline de CI en el repositorio (ni `.gitlab-ci.yml` ni `.github/workflows/`). El remoto `origin` es un GitLab real (`git@gitlab.pamplona.es:pamplona/webs/sedeelectronica.pamplona.es/react-ui-builder.git`) y el flujo de trabajo real del proyecto gira en torno a Merge Requests de GitLab (`ai-workflow/docs/vcs.md`). Existe un remoto secundario `github` (mirror) que no participa del flujo de trabajo. Hoy el único gate de calidad antes de mergear depende de que una persona recuerde ejecutar `pnpm lint`, `pnpm build` y `pnpm test` manualmente.

## Alcance
- Un fichero `.gitlab-ci.yml` en la raíz del repo que defina un pipeline de verificación.
- El pipeline ejecuta, en orden, `pnpm install` (con lockfile congelado), `pnpm lint`, `pnpm build` y `pnpm test` (este último ya corre `vitest run --coverage` con el gate de cobertura del 80% configurado en `vitest.config.ts`).
- El pipeline se dispara en cada push a cualquier rama y en cada Merge Request dirigido a `dev` o `master`.
- Si cualquiera de los cuatro comandos falla, el pipeline completo se marca como fallido.
- Cache de dependencias de pnpm entre ejecuciones del pipeline, si resulta sencillo de configurar con el store de pnpm; no es bloqueante para cerrar la feature si introduce complejidad significativa.
- La versión de Node y de pnpm usadas en el pipeline deben ser coherentes con las ya fijadas en el proyecto (`engines.node` en `package.json`, `.nvmrc`, y `packageManager` para la versión de pnpm), para que "verde en CI" implique lo mismo que "verde en local".

## Fuera de alcance
- Pipelines de despliegue o release de ningún tipo.
- Publicación de artefactos del build (`dist/`) fuera de la propia ejecución del pipeline.
- Escaneo de seguridad de dependencias u otras herramientas adicionales de seguridad (ya cubierto por la feature `0111-dependency-security-remediation`, completada).
- Integración con herramientas externas de cobertura (Codecov o equivalentes); el gate de cobertura sigue siendo únicamente el que ya aplica `vitest.config.ts`, tanto en local como en CI.
- Notificaciones externas (Slack, email, etc.) sobre el resultado del pipeline.
- Paralelización avanzada o matrices de versiones de Node.
- Badges de estado de pipeline en `README.md` (ver pregunta abierta P-1).
- Activar el ajuste de "pipeline debe pasar para poder mergear" en la configuración del proyecto GitLab. Ese ajuste vive en la instancia GitLab (fuera de este repositorio) y no se puede fijar con código versionado; esta feature entrega el pipeline que ese ajuste consumiría.

## Requisitos funcionales
- RF-1: Cada push a cualquier rama del repositorio dispara el pipeline definido en `.gitlab-ci.yml`.
- RF-2: Cada Merge Request hacia `dev` o hacia `master` muestra el estado del pipeline asociado a la rama origen.
- RF-3: El pipeline ejecuta, en este orden, `pnpm install`, `pnpm lint`, `pnpm build`, `pnpm test`.
- RF-4: Si `pnpm install`, `pnpm lint`, `pnpm build` o `pnpm test` termina con código de salida distinto de cero, el pipeline completo termina en estado fallido.
- RF-5: Si los cuatro comandos terminan con código de salida cero, el pipeline completo termina en estado exitoso.

## Requisitos no funcionales
- RNF-1: El entorno de ejecución del pipeline usa una versión de Node compatible con `engines.node` de `package.json` (`>=22.0.0 <23.0.0`) y con `.nvmrc` (`22`).
- RNF-2: El pipeline usa la misma versión de `pnpm` que fija `packageManager` en `package.json` (`pnpm@10.19.0`), vía Corepack o instalación explícita equivalente.
- RNF-3: `pnpm install` se ejecuta con lockfile congelado (`--frozen-lockfile` o equivalente), de forma que un lockfile desincronizado se detecte como fallo explícito del pipeline en vez de resolverse en silencio con versiones distintas a las commiteadas.
- RNF-4: El pipeline no depende de servicios externos ni de secretos o variables de entorno que no existan ya en el proyecto; no requiere configuración manual adicional en GitLab más allá de que la instancia tenga al menos un runner disponible.

## Criterios de aceptación
- CA-1: Con `.gitlab-ci.yml` añadido, un push a cualquier rama dispara en GitLab un pipeline con al menos un job que ejecuta los cuatro comandos del alcance.
- CA-2: Si se introduce deliberadamente un fallo de lint, build o test en una rama de prueba, el pipeline correspondiente termina en estado fallido.
- CA-3: Si los cuatro comandos pasan, el pipeline termina en estado exitoso.
- CA-4: Un Merge Request hacia `dev` o hacia `master` muestra el estado del pipeline asociado a su rama origen.
- CA-5: El pipeline no publica artefactos de build, no despliega nada y no llama a ningún servicio externo de notificación o cobertura.

## Casos límite
- CL-1: Un push que no toca código de aplicación (por ejemplo solo `ai-workflow/**`) dispara igualmente el pipeline completo; esta feature no introduce reglas de `changes:` para omitirlo según el path modificado. Mantenerlo simple es preferible para un gate mínimo; podría revisarse en una feature futura si el tiempo de pipeline se convierte en un problema real.
- CL-2: `pnpm-lock.yaml` desincronizado con `package.json` hace fallar `pnpm install --frozen-lockfile` y por tanto el pipeline completo, incluso si el resto del código es correcto. Este es el comportamiento esperado (RNF-3), no un defecto.
- CL-3: Una cache de pnpm corrupta o ausente en la primera ejecución no debe hacer fallar el pipeline; como mucho, degrada a una instalación sin cache y por tanto más lenta.

## Riesgos o preguntas abiertas
- P-1 (abierta, no bloqueante para cerrar esta spec): ¿añadir un badge de estado de pipeline a `README.md`? Es cosméticamente trivial, pero se deja fuera de alcance por defecto siguiendo la instrucción explícita recibida para esta feature. Si en el futuro se quiere, es un cambio de una línea que requiere que el pipeline ya exista y tenga al menos una ejecución en verde (la URL del badge la genera GitLab a partir del pipeline ya corriendo).
- P-2 (riesgo de infraestructura externo al repo, no resoluble desde aquí): esta spec asume que la instancia `gitlab.pamplona.es` tiene al menos un runner activo capaz de levantar un entorno con Node 22, sin restricciones obligatorias de tags de runner. No se ha encontrado en el repositorio ninguna convención previa de runners o tags de GitLab CI (no había `.gitlab-ci.yml` previo, ni menciones en `ai-workflow/docs/`). Si la instancia real exige tags específicos de runner, un executor sin soporte Docker, o cualquier otra restricción de infraestructura no versionada en este repo, el pipeline definido en diseño/implementación tendrá que ajustarse a esa restricción real; no puede confirmarse desde el propio repositorio y queda como riesgo externo aceptado, a validar por quien tenga acceso a la administración de la instancia GitLab.
- P-3 (riesgo operativo, no de producto): si el ajuste "pipelines must succeed" (o equivalente de "merge checks") no está activado en la configuración del proyecto en GitLab, el pipeline en rojo será visible en la MR pero no bloqueará físicamente el botón de merge. Esta feature entrega el pipeline versionado en el repositorio; activar ese ajuste de proyecto es una acción operativa complementaria fuera del alcance de un cambio de código.

## Áreas de producto afectadas a alto nivel
- Ninguna área funcional del runtime. Cambio puramente de tooling/CI.

## Documentación probablemente afectada a alto nivel
- Ninguna ficha de `ai-workflow/docs/app-features/` (no cambia comportamiento observable del runtime).
- `ai-workflow/docs/current-state.md`: no se ve afectado (el stack no cambia).
- `README.md`: sin cambios obligatorios; ver P-1 para la mención opcional de CI/badge.
