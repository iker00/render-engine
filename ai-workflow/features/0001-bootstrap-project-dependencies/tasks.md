# Tasks: Feature 0001 - bootstrap-project-dependencies

## Orden de ejecución
1. `0001-T01` - scaffold inicial del frontend y scripts de arranque
2. `0001-T02` - baseline de calidad con lint, tests y coverage gate
3. `0001-T03` - bootstrap de configuración local y lectura de `data-config`

La siguiente tarea que debe escogerse al empezar implementación es `0001-T01`.

---

## `0001-T01` - Scaffold inicial del frontend y scripts de arranque

- Estado: `completed`
- Objetivo:
  Dejar la raíz del repositorio convertida en una aplicación frontend de paquete único, instalable con `pnpm` y arrancable con `pnpm dev`, incluyendo el shell visual mínimo necesario para verificar que `Vite`, `React` y `Tailwind` están operativos.
- Fuera de alcance:
  No implementar todavía lectura de `data-config`, fallback desde `src/dev/config.json`, lint, tests automatizados ni cobertura.
- Dependencias:
  Ninguna. Debe ser la primera tarea del plan y bloquea al resto.
- Impacto esperado en archivos:
  - Código a crear o modificar:
    `package.json`, `pnpm-lock.yaml`, `.gitignore`, fichero de versión de Node (`.nvmrc` o equivalente), `index.html`, `tsconfig.json`, `tsconfig.node.json` si aplica, `vite.config.ts`, `postcss.config.js` o `postcss.config.cjs`, `tailwind.config.js` o `tailwind.config.ts`, `src/main.tsx`, `src/app/App.tsx`, `src/app/app-shell.tsx` o equivalente, `src/app/index.css` o `src/styles.css`.
  - Tests a crear o modificar:
    ninguno obligatorio en esta tarea.
  - Documentación a revisar o actualizar:
    `README.md`, `ai-workflow/docs/onboarding.md`, `ai-workflow/docs/current-state.md`.
- Tests requeridos:
  - Verificar instalación reproducible con `pnpm install`.
  - Verificar que `pnpm dev` arranca el servidor local sin errores de bootstrap.
  - Verificar que `pnpm build` genera un bundle de producción.
- Documentación afectada:
  Sí, pero su actualización queda diferida a la pasada documental posterior. Esta tarea no debe mezclar cambios de código con reescritura amplia de docs.
- Criterios de finalización:
  - Existe un manifiesto único de dependencias versionado en la raíz del repo.
  - El contrato de entorno queda explicitado con una versión soportada de Node y metadatos equivalentes en el manifiesto.
  - El proyecto arranca con un shell mínimo visible, sin depender de backend ni de artefactos locales no versionados.
  - `pnpm build` funciona sobre el scaffold generado.
- Cierre de implementación:
  Completo cuando el scaffold, los scripts `dev/build/preview` y el shell mínimo estén creados y validados con los comandos indicados.
- Cierre documental:
  Pendiente hasta la pasada documental de la feature. Deberá reflejar que el repo ya tiene bootstrap técnico, pero todavía no runtime funcional.

---

## `0001-T02` - Baseline de calidad con lint, tests y coverage gate

- Estado: `completed`
- Objetivo:
  Añadir la infraestructura mínima de validación automática para que el repositorio pueda ejecutar `pnpm lint` y `pnpm test`, con umbral global del 80% sobre `src/`, y dejar un primer smoke test del shell inicial para que la validación no dependa solo de compilación.
- Fuera de alcance:
  No implementar todavía la lógica final de carga de configuración desde `src/dev/config.json` o `data-config`. No introducir e2e ni pipeline de CI.
- Dependencias:
  Depende de `0001-T01`.
- Impacto esperado en archivos:
  - Código a crear o modificar:
    `package.json`, configuración de ESLint (`eslint.config.js` o equivalente), configuración de Vitest (`vitest.config.ts` o equivalente), `src/tests/setup.ts`, utilidades compartidas de test si hacen falta en `src/tests/`, posibles ajustes menores en `src/app/App.tsx` para hacerlo testeable.
  - Tests a crear o modificar:
    `src/tests/app-shell.test.tsx` o ruta equivalente para el smoke test inicial del shell.
  - Documentación a revisar o actualizar:
    `README.md`, `ai-workflow/docs/onboarding.md`.
- Tests requeridos:
  - `pnpm lint`
  - `pnpm test`
  - Verificación explícita de que `pnpm test` falla si el coverage global de `src/` queda por debajo del estándar.
- Documentación afectada:
  Sí. La pasada documental deberá añadir los comandos reales de validación rápida y aclarar que el coverage gate forma parte del cierre de implementación.
- Criterios de finalización:
  - Existen scripts estables para lint, test y test en modo watch.
  - La configuración de tests aplica el umbral mínimo del 80% en `lines`, `statements` y `functions` sobre `src/`.
  - Hay al menos un test automatizado que verifica el shell visible del bootstrap en lugar de limitarse a probar configuración.
  - `pnpm lint` y `pnpm test` quedan verdes en el repositorio.
- Cierre de implementación:
  Completo cuando la infraestructura de calidad esté operativa, versionada y validada con los comandos definidos por la tarea.
- Cierre documental:
  Pendiente hasta la pasada documental de la feature. No debe cerrarse documentalmente sin actualizar los comandos de verificación en onboarding y README.

---

## `0001-T03` - Bootstrap de configuración local y lectura de `data-config`

- Estado: `completed`
- Objetivo:
  Introducir la frontera de arranque que selecciona la fuente de configuración soportada en esta fase: `src/dev/config.json` durante desarrollo local y `data-config` cuando el contenedor HTML la proporcione, mostrando un estado de error comprensible si falta o no se puede parsear la entrada esperada.
- Fuera de alcance:
  No implementar validación funcional completa con `Zod`, editor en vivo de configuración, navegación interna, formularios, queries ni integración real con backend.
- Dependencias:
  Depende de `0001-T02`. Requiere que lint y tests ya existan para implementarse con enfoque tests-first.
- Impacto esperado en archivos:
  - Código a crear o modificar:
    `src/app/App.tsx`, `src/app/bootstrap/read-runtime-config.ts` o ruta equivalente, posibles tipos mínimos en `src/app/bootstrap/` o `src/shared/`, `src/dev/config.json`, y ajustes en `src/main.tsx` para conectar el bootstrap.
  - Tests a crear o modificar:
    `src/tests/read-runtime-config.test.ts`, `src/tests/app-bootstrap.test.tsx` o rutas equivalentes para cubrir modo desarrollo, lectura de `data-config` y estados de error.
  - Documentación a revisar o actualizar:
    `README.md`, `ai-workflow/docs/onboarding.md`, `ai-workflow/docs/current-state.md`, `ai-workflow/docs/app-features/development-workflow.md`.
- Tests requeridos:
  - Unit tests de la función que resuelve la fuente de configuración.
  - Integration tests del arranque React mostrando el estado correcto en desarrollo, con `data-config` válido y ante entrada ausente o inválida.
  - Reejecutar `pnpm lint`, `pnpm test` y `pnpm build` tras integrar el bootstrap real.
- Documentación afectada:
  Sí. La pasada documental deberá aclarar el comportamiento real disponible después de esta tarea: `config.json` local soportado, lectura futura desde backend preparada y editor en vivo todavía fuera de alcance.
- Criterios de finalización:
  - La carga de configuración queda encapsulada en una frontera de bootstrap explícita y testeada.
  - El modo desarrollo usa un archivo versionado del repositorio como fuente primaria sin requerir backend.
  - El arranque puede consumir `data-config` cuando exista y produce un mensaje claro cuando la entrada esperada no está disponible o no es parseable.
  - Los tests automatizados cubren el comportamiento observable del bootstrap y mantienen el gate de cobertura.
- Cierre de implementación:
  Completo cuando la resolución de configuración y sus estados observables estén implementados y validados con tests verdes, lint verde y build verde.
- Cierre documental:
  Pendiente hasta la pasada documental de la feature. Esa pasada deberá actualizar las docs operativas y dejar `status.yaml` listo para transición a `documentation` o `complete` según el alcance ejecutado.
