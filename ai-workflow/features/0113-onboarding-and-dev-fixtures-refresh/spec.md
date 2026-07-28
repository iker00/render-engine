# 0113 — Onboarding and dev fixtures refresh

## Objetivo
Corregir dos fuentes de desinformación detectadas en la auditoría técnica del repo (2026-07-27, hallazgos A-07 y A-13):

1. `ai-workflow/docs/onboarding.md` describe el proyecto como si estuviera en una fase 0 muy temprana ("todavía no existen navegación, formularios, queries ni integración real con backend", "todavía no existe validación con Zod del contrato funcional completo"), cuando el proyecto tiene 110+ features estables (navegación, formularios, queries, validación Zod completa, auth, subida de archivos, CI, etc.), documentadas en `ai-workflow/docs/app-features/` y resumidas en `ai-workflow/docs/current-state.md`.
2. `src/dev/` acumula ficheros JSON de ejemplo sin relación con el arranque actual, que aumentan la confusión de cualquiera que entre al directorio buscando la fuente activa de configuración de desarrollo.

## Alcance

### 1. Reescritura de `ai-workflow/docs/onboarding.md`
- Reemplazar la sección "Límites del bootstrap actual" (y cualquier otra afirmación desactualizada del documento) por una descripción fiel del estado vigente, usando `ai-workflow/docs/current-state.md` como fuente de verdad para qué áreas están estables y cuáles siguen fuera de v1.
- Mantener las secciones que ya son correctas hoy (requisitos, primer arranque, resolución de configuración, comandos de verificación), ajustándolas solo donde haga falta precisión.
- Actualizar la sección "Estructura inicial esperada" para reflejar los directorios reales de `src/` (`app/`, `config/`, `dev/`, `dev-runtime/`, `queries/`, `runtime/`, `tests/`), no solo los tres del bootstrap inicial.
- Añadir una referencia explícita a `ai-workflow/docs/app-features/index.md` como punto de entrada para explorar el detalle funcional por área, y a `ai-workflow/docs/current-state.md` como snapshot de qué está estable y qué queda fuera de v1.
- El documento resultante debe dejar claro que el runtime declarativo ya existe y está operativo (no solo el bootstrap técnico), sin listar el detalle de cada feature (eso vive en `app-features/`).

### 2. Corrección puntual de `README.md`
- La sección "Estado actual" de `README.md` contiene la misma afirmación desactualizada que motivó A-07 ("Todavía no existe el runtime declarativo funcional: no hay navegación, formularios, queries ni validación estructural completa del contrato JSON"). Se corrige como parte de esta feature para no dejar viva la misma inconsistencia en un documento hermano al que `onboarding.md` remite como referencia (ver Riesgos, pregunta ya resuelta).
- El ajuste se limita a esa sección: sustituir la afirmación desactualizada por una referencia corta a `ai-workflow/docs/current-state.md` como fuente de estado vigente, manteniendo el resto del README sin cambios y sin convertirlo en histórico acumulado (regla ya existente en `vcs.md`/`workflow.md` sobre no ampliar `README.md`).

### 3. Limpieza de fixtures en `src/dev/`
Investigación propia (grep sobre todo el repo, no solo `src/dev/`) confirma:
- **En uso activo** (permanecen sin cambios): `src/dev/config.json` (importado por `src/app/App.tsx`, `src/dev-runtime/dev-runtime.tsx`, HMR bridge, y varios tests), `src/dev/data-values.json` (importado junto a `config.json` para pre-carga de queries) y `src/dev/documentation.json` (fuente mantenida activamente por la skill `update-interactive-documentation`, es la config de la app de documentación interactiva del runtime).
- **Sin ninguna referencia en código, tests, scripts ni documentación** (`grep` exhaustivo sobre `.ts`, `.tsx`, `.js`, `.json`, `.md`, `.yaml`/`.yml` y sobre nombres de fichero en todo el árbol, excluyendo `node_modules`/`dist`/`.git`, sin resultados fuera del propio fichero): `src/dev/config-quique.json`, `src/dev/old-config.json`, `src/dev/policia-buscar-persona.json`, `src/dev/policia-config.json`, `src/dev/policia-ficha-persona.json`.
- Estos cinco ficheros se eliminan de `src/dev/`. Al no estar referenciados por ningún import, script ni test, su eliminación no puede romper `pnpm dev`, `pnpm build`, `pnpm lint` ni `pnpm test`. El historial queda preservado en git por si algún día hiciera falta recuperarlos.

## Fuera de alcance
- Cualquier cambio de comportamiento del runtime, del bootstrap de configuración o de la resolución `data-config` vs `src/dev/config.json`.
- Cambios en `ai-workflow/docs/app-features/**` (esta feature no introduce ni modifica capacidades funcionales).
- Reescritura amplia de `README.md` más allá de la sección "Estado actual" señalada arriba.
- Mover los ficheros eliminados a otra ubicación (por ejemplo un directorio de "fixtures archivadas"); se eliminan directamente, ya que no aportan valor de referencia documentado y el histórico git ya los preserva.
- Cambios en `src/dev/config.json`, `src/dev/data-values.json` o `src/dev/documentation.json`.
- Cualquier reorganización estructural de `src/` distinta de la eliminación puntual de los cinco ficheros listados.

## Requisitos funcionales
- `ai-workflow/docs/onboarding.md` debe describir correctamente, a fecha de esta feature, que el runtime declarativo (navegación, formularios, queries, validación Zod, auth, subida de archivos) ya está implementado y estable, remitiendo a `current-state.md` y `app-features/index.md` para el detalle por área.
- `ai-workflow/docs/onboarding.md` debe seguir siendo un documento de arranque operativo (requisitos, comandos, verificación), no un índice funcional duplicado.
- `README.md` no debe contener afirmaciones sobre el estado del runtime que contradigan `current-state.md`.
- `src/dev/` debe contener únicamente los ficheros activos (`config.json`, `data-values.json`, `documentation.json`) tras la limpieza.
- `pnpm dev` debe seguir arrancando la aplicación usando `src/dev/config.json` como fuente activa cuando no hay `data-config`.

## Requisitos no funcionales
- No se introduce código nuevo ni se modifica lógica de runtime; el cambio es puramente documental y de housekeeping de ficheros estáticos.
- El umbral de cobertura de tests (80% sobre `src/`) no debe verse afectado por la eliminación de ficheros no importados por ningún test.

## Criterios de aceptación
- `ai-workflow/docs/onboarding.md` ya no contiene ninguna de las afirmaciones "todavía no existen navegación, formularios, queries..." ni "todavía no existe validación con Zod del contrato funcional completo".
- `ai-workflow/docs/onboarding.md` menciona explícitamente que navegación, formularios, queries y validación Zod ya están implementados, y remite a `current-state.md`/`app-features/index.md` para el detalle.
- La sección "Estructura inicial esperada" de `onboarding.md` lista los directorios reales de `src/` existentes hoy.
- `README.md` ya no afirma que "todavía no existe el runtime declarativo funcional".
- `src/dev/config-quique.json`, `src/dev/old-config.json`, `src/dev/policia-buscar-persona.json`, `src/dev/policia-config.json` y `src/dev/policia-ficha-persona.json` no existen tras esta feature.
- `src/dev/config.json`, `src/dev/data-values.json` y `src/dev/documentation.json` siguen existiendo sin cambios de contenido.
- `pnpm dev`, `pnpm build`, `pnpm lint` y `pnpm test` siguen pasando tras la eliminación de los ficheros.

## Casos límite
- Si algún test snapshot o fixture referenciara indirectamente uno de los ficheros a eliminar por una ruta dinámica (no detectable por `grep` literal), la suite de tests debe fallar de forma visible al ejecutar `pnpm test` tras el borrado; la tarea de implementación debe ejecutar la suite completa como verificación final, no solo confiar en el grep de esta spec.
- El editor de desarrollo en vivo (`dev-mode-editor`) sigue operando exclusivamente sobre `src/dev/config.json`; su documentación (`app-features/development/dev-mode-editor.md`) no necesita cambios porque no menciona los ficheros eliminados.

## Riesgos o preguntas abiertas
- **Resuelto por investigación propia, sin necesidad de bloquear la spec**: el objetivo original pedía alinear `onboarding.md` con `README.md` como referencia, pero `README.md` contiene la misma afirmación desactualizada que motivó A-07. Se decidió incluir la corrección puntual de esa única sección de `README.md` en el alcance (ver sección 2), por ser un cambio acotado, de bajo riesgo, reversible, y necesario para que ambos documentos dejen de contradecirse entre sí tras esta feature. Si el usuario prefiriera dejar `README.md` fuera de alcance y aceptar la inconsistencia temporalmente, es una corrección trivial de revertir antes de cerrar la feature.
- No quedan preguntas bloqueantes adicionales: la investigación de `src/dev/*.json` fue exhaustiva (grep sin resultados fuera de los propios ficheros) y no se encontró ninguna referencia oculta a los cinco ficheros propuestos para eliminación.
