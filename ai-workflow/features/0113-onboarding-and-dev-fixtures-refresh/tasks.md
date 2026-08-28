# Tasks — 0113 — Onboarding and dev fixtures refresh

Contrato de ejecución. Ordenado por dependencia. La siguiente tarea que debe abordarse siempre es la primera cuyo estado no sea `done`.

Referencia común para toda la feature:
- Feature puramente documental y de housekeeping de ficheros estáticos: no se introduce ni modifica código de runtime, ni lógica de bootstrap, ni la resolución `data-config` vs `src/dev/config.json`.
- Fuente de verdad de estado vigente a citar desde la documentación: `ai-workflow/docs/current-state.md` y `ai-workflow/docs/app-features/index.md`.
- Ninguna tarea de esta feature toca `ai-workflow/docs/app-features/**` (fuera de alcance de la spec).
- Las tres tareas son independientes entre sí (no comparten archivos); se ejecutan en el orden aquí definido por convención del plan, no por dependencia real.

---

## Task 1 — Reescribir `ai-workflow/docs/onboarding.md`

- **ID**: 0113-T1
- **Estado**: pending
- **Objetivo**: Sustituir el contenido desactualizado de `ai-workflow/docs/onboarding.md` por una descripción fiel del estado vigente del proyecto, conservando el documento como guía de arranque operativo (no como índice funcional):
  - Eliminar la sección "Límites del bootstrap actual" tal como existe hoy (las tres afirmaciones "todavía no existe panel editable...", "todavía no existe validación con Zod...", "todavía no existen navegación, formularios, queries ni integración real con backend" quedan obsoletas; el panel editable en vivo, la validación Zod completa y el runtime declarativo completo ya existen y están documentados en `app-features/`).
  - Añadir en su lugar una sección breve (puede conservar el título "Estado actual" que ya existe al inicio del documento, ampliándolo, o un bloque nuevo inmediatamente después) que deje explícito que el runtime declarativo ya está implementado y estable: navegación, formularios, queries, validación `Zod` del contrato completo, autenticación y subida de archivos. No listar el detalle de cada feature ni el catálogo de nodos; remitir para eso a `ai-workflow/docs/current-state.md` (snapshot de qué está estable y qué queda fuera de v1) y a `ai-workflow/docs/app-features/index.md` (punto de entrada al detalle funcional por área).
  - Mantener sin cambios de fondo las secciones "Requisitos", "Primer arranque", "Resolución de configuración" y "Verificación rápida", ajustándolas solo si contienen alguna imprecisión puntual detectada durante la reescritura (por ejemplo, no deben seguir dando a entender que el runtime es solo un bootstrap técnico).
  - Actualizar la sección "Estructura inicial esperada" para listar los directorios reales de `src/` existentes hoy: `src/app/`, `src/config/`, `src/dev/`, `src/dev-runtime/`, `src/queries/`, `src/runtime/`, `src/tests/` (reemplaza la lista actual de solo tres entradas).
- **Fuera de alcance**:
  - Cualquier cambio a `README.md` (Task 2) o a `src/dev/` (Task 3).
  - Cambios en `ai-workflow/docs/app-features/**` o en `ai-workflow/docs/current-state.md`.
  - Listar el detalle de cada feature o nodo soportado dentro de `onboarding.md`; eso vive en `app-features/`.
  - Cualquier cambio de comportamiento del runtime, del bootstrap o de la resolución `data-config` vs `src/dev/config.json`.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: ninguno.
  - Tests: ninguno.
  - Documentación: `ai-workflow/docs/onboarding.md` (modificar).
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: no aplica suite automatizada a un documento Markdown. La verificación de esta tarea es una lectura manual del fichero resultante contra los criterios de finalización.
  - **Comportamiento cubierto**:
    - El texto resultante no contiene ninguna de las frases "todavía no existen navegación, formularios, queries ni integración real con backend" ni "todavía no existe validación con Zod del contrato funcional completo" (ni variantes que transmitan el mismo mensaje desactualizado).
    - El texto resultante afirma explícitamente que navegación, formularios, queries y validación `Zod` ya están implementados.
    - El texto resultante enlaza o referencia por nombre a `ai-workflow/docs/current-state.md` y a `ai-workflow/docs/app-features/index.md`.
    - La sección "Estructura inicial esperada" lista exactamente `src/app/`, `src/config/`, `src/dev/`, `src/dev-runtime/`, `src/queries/`, `src/runtime/`, `src/tests/`.
    - Las secciones "Requisitos", "Primer arranque", "Resolución de configuración" y "Verificación rápida" siguen presentes y siguen siendo correctas respecto al comportamiento actual del proyecto.
  - **Comandos durante la implementación**: no aplica `pnpm test --run <ruta>` (no hay fichero de test). Verificación: releer `ai-workflow/docs/onboarding.md` completo tras la edición y contrastarlo frase a frase contra los criterios de finalización de esta tarea.
  - **Restricciones**: no convertir el documento en un índice funcional duplicado; el detalle por feature/nodo no se traslada aquí bajo ningún punto.
- **Documentación afectada**: ninguno (el propio `onboarding.md` es el objeto de esta tarea, no un artefacto derivado; no se toca ninguna ficha de `app-features/`).
- **Criterios de finalización**:
  - Cierre de implementación: `ai-workflow/docs/onboarding.md` cumple los cinco puntos de "Comportamiento cubierto" de arriba; el resto del documento permanece coherente y operativo como guía de arranque.

---

## Task 2 — Corrección puntual de `README.md`

- **ID**: 0113-T2
- **Estado**: pending
- **Objetivo**: En la sección "Estado actual" de `README.md`, sustituir la frase "Todavía no existe el runtime declarativo funcional: no hay navegación, formularios, queries ni validación estructural completa del contrato JSON." por una referencia corta a `ai-workflow/docs/current-state.md` como fuente de estado vigente (por ejemplo, indicar que el runtime declarativo ya está implementado y que el detalle actualizado por área vive en ese documento). El resto de `README.md` permanece sin cambios.
- **Fuera de alcance**:
  - Cualquier otro cambio a `README.md` fuera de la sección "Estado actual" (no convertirlo en histórico acumulado; no tocar "Documentación", "Bootstrap local" ni el resto).
  - Cambios en `ai-workflow/docs/onboarding.md` (Task 1) o en `src/dev/` (Task 3).
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: ninguno.
  - Tests: ninguno.
  - Documentación: `README.md` (modificar, solo sección "Estado actual").
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: no aplica suite automatizada a `README.md`. Verificación manual del fichero resultante.
  - **Comportamiento cubierto**:
    - `README.md` ya no contiene la frase "Todavía no existe el runtime declarativo funcional" ni ninguna afirmación equivalente que contradiga `current-state.md`.
    - La sección "Estado actual" sigue existiendo y ahora remite a `ai-workflow/docs/current-state.md`.
    - Ninguna otra sección de `README.md` cambia respecto al contenido previo a esta tarea.
  - **Comandos durante la implementación**: no aplica `pnpm test --run <ruta>`. Verificación: `git diff README.md` tras la edición debe mostrar cambios únicamente dentro de la sección "Estado actual".
  - **Restricciones**: no ampliar `README.md` con contenido histórico (regla ya existente en `vcs.md`/`workflow.md`); el cambio debe ser mínimo y acotado a la frase señalada.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**:
  - Cierre de implementación: `README.md` cumple los tres puntos de "Comportamiento cubierto" de arriba.

---

## Task 3 — Eliminar los cinco ficheros JSON obsoletos de `src/dev/`

- **ID**: 0113-T3
- **Estado**: pending
- **Objetivo**: Eliminar de `src/dev/` los cinco ficheros sin ninguna referencia en código, tests, scripts ni documentación: `config-quique.json`, `old-config.json`, `policia-buscar-persona.json`, `policia-config.json`, `policia-ficha-persona.json`. Tras el borrado, `src/dev/` debe contener únicamente `config.json`, `data-values.json` y `documentation.json`, sin cambios de contenido en ninguno de estos tres.
- **Fuera de alcance**:
  - Cualquier cambio de contenido en `src/dev/config.json`, `src/dev/data-values.json` o `src/dev/documentation.json`.
  - Mover los ficheros eliminados a otra ubicación (por ejemplo un directorio de "fixtures archivadas"); se eliminan directamente.
  - Cualquier reorganización estructural de `src/` distinta de esta eliminación puntual.
  - Cambios en `ai-workflow/docs/onboarding.md` (Task 1) o `README.md` (Task 2).
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: `src/dev/config-quique.json`, `src/dev/old-config.json`, `src/dev/policia-buscar-persona.json`, `src/dev/policia-config.json`, `src/dev/policia-ficha-persona.json` (eliminar los cinco).
  - Tests: ninguno a crear o modificar; se ejecuta la suite existente completa como regresión (ver sub-bloque Tests).
  - Documentación: ninguna a modificar.
- **Tests**:
  - **Ficheros de test**: ninguno (nuevo ni ampliación); cubierto por: la suite completa existente de `pnpm test` (mapa completo en `ai-workflow/docs/test-index.md`), ejecutada íntegra tras el borrado como gate de regresión. Ningún fichero de test conocido referencia por nombre ninguno de los cinco ficheros a eliminar (confirmado por `grep` sobre todo el árbol del repo, excluyendo `node_modules`/`dist`/`.git`, sin resultados fuera de `ai-workflow/features/0113-onboarding-and-dev-fixtures-refresh/spec.md`).
  - **Comportamiento cubierto**:
    - Tras el borrado, `src/dev/` contiene exactamente `config.json`, `data-values.json` y `documentation.json` (verificable con `ls src/dev/`).
    - `pnpm dev` arranca la aplicación sin error de bootstrap, usando `src/dev/config.json` como fuente activa cuando no hay `data-config` (comportamiento ya cubierto por `src/tests/app/app-bootstrap.test.tsx` y no debe regresar).
    - `pnpm build` genera el bundle de producción sin error.
    - `pnpm lint` pasa sin error.
    - `pnpm test` pasa completo, incluyendo el gate de cobertura del 80% sobre `src/`, sin ningún fallo atribuible al borrado. Si algún test fallara por una referencia dinámica no detectable por `grep` literal a alguno de los cinco ficheros, ese fallo debe quedar visible en la salida de `pnpm test` y bloquear el cierre de esta tarea hasta resolverse (no asumir que el `grep` de la spec fue suficiente sin esta ejecución real).
  - **Comandos durante la implementación**: no aplica `pnpm test --run <ruta>` (no hay fichero de test nuevo). Ejecutar en este orden como verificación final: `pnpm dev` (arrancar y confirmar ausencia de error de bootstrap, luego detener), `pnpm build`, `pnpm lint`, `pnpm test`. Los cuatro deben terminar en éxito antes de dar la tarea por cerrada.
  - **Restricciones**: no añadir tests nuevos para "cubrir" el borrado; el borrado de fixtures no importados no requiere test dedicado, solo la regresión de la suite existente.
- **Documentación afectada**: ninguno. La ficha `ai-workflow/docs/app-features/development/dev-mode-editor.md` no menciona los ficheros eliminados y no requiere cambios (confirmado en la spec, sección "Casos límite").
- **Criterios de finalización**:
  - Cierre de implementación: los cinco ficheros no existen; `config.json`, `data-values.json` y `documentation.json` permanecen sin cambios de contenido; `pnpm dev`, `pnpm build`, `pnpm lint` y `pnpm test` terminan en éxito tras el borrado.

---

## Cierre de la feature

Cuando las Tasks 1, 2 y 3 queden en `done`, la feature está completa: `onboarding.md` y `README.md` dejan de contradecir el estado real del proyecto documentado en `current-state.md`, y `src/dev/` contiene únicamente los tres ficheros activos. No hay tareas adicionales de documentación funcional que cerrar: ninguna ficha de `ai-workflow/docs/app-features/` cambia como consecuencia de esta feature.
