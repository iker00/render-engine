---
name: update-app-documentation
description: Actualiza la documentación funcional y operativa del proyecto después de una implementación ya realizada. Úsala cuando el código y los tests relevantes ya estén cerrados y quieras reflejar el comportamiento estable en `ai-workflow/docs/` y en el índice de features.
model: haiku
allowed-tools: Read, Edit, Bash
context: fork
background: false
---

# Actualizar documentación de la app

Usa esta skill cuando una implementación ya está hecha y validada, y ahora toca reflejar sus efectos en la documentación
del proyecto.

Esta skill debe comportarse como una fase documental posterior al código: revisar qué cambió realmente, decidir qué
documentos quedan afectados y actualizarlos sin reabrir la implementación.

## Cuándo NO usar esta skill

- El código de la feature todavía está en curso o tiene tareas sin cerrar → terminar la implementación primero
- Los tests relevantes fallan o están incompletos → resolver antes de documentar
- `status.yaml` tiene bloqueos abiertos que invaliden el cierre documental → resolver el bloqueo primero
- La implementación contradice materialmente la `spec.md` → realinear spec e implementación antes de documentar

## Uso de Bash

Las únicas órdenes Bash aceptables en esta skill son las descritas en las secciones "Ejecutar siempre al arrancar" y
"Commit final" de este documento. No ejecutar tests, builds, ni operaciones destructivas más allá de las allí
documentadas.

## Leer siempre

Lee en un único turno (varias llamadas Read en el mismo mensaje) todos los ficheros fijos; el marcado «si existe» no rompe el paralelismo:
- `ai-workflow/docs/vcs.md`
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/spec.md`
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/status.yaml`
- `ai-workflow/features/index.md` si existe

En otro turno, lee `ai-workflow/docs/app-features/index.md`; con su contenido, identifica las áreas relevantes y lee sus `index.md` en un único turno; con esas fichas, identifica los sub-documentos concretos para la feature implementada (típicamente 1-3, rara vez más de 5) y léelos en un único turno final.

## Ejecutar siempre al arrancar

Diff filtrado para detectar qué cambió, en tres pasos. Las tareas de implementación ya están commiteadas
individualmente en esta rama (ver `implement-task-test-first`), así que `git status --short` normalmente
sale vacío a estas alturas — eso **no** significa que no haya cambios que documentar. La señal real es
`git diff dev`/`git diff --stat dev`: comparan el árbol de `dev` contra el estado actual de los ficheros, así que
capturan todos los commits de tareas de esta rama, no solo lo pendiente de commitear.

Paso 1 — inventario ligero (siempre):
```
git status --short
git diff --name-only dev
git diff --stat dev
```

Paso 2 — filtrado mecánico de la lista (no interpretativo). Excluir siempre:
- `pnpm-lock.yaml`, `package-lock.json`, `dist/**`, `build/**` y otros generados
- `ai-workflow/features/**` (ya se cargan por separado como artefactos de feature: spec, tasks, status, design)
- Tooling: `.eslintrc*`, `.prettierrc*`, `tsconfig*.json`, `vitest.config*`
- `src/dev/**` (lo cubre la fase interactiva de documentación)

Todo lo demás se incluye. Los tests (`src/tests/**`, `*.test.ts`, `*.spec.ts`) **sí se incluyen** porque su contenido
alimenta la actualización del índice de tests.

Paso 3 — diff selectivo de los archivos que sobrevivieron al filtro:
```
git diff dev -- <archivo1> <archivo2> ...
```

Si el filtro deja la lista vacía, no hay nada documentalmente relevante: dejar constancia y detener sin tocar
documentación.

No leer archivos de código fuente adicionales para inferir el comportamiento; el diff filtrado basta.

## Leer si aplica

- `ai-workflow/docs/architecture.md` si la implementación consolidó una decisión arquitectónica estable.
- `ai-workflow/docs/conventions.md` si la implementación consolidó una convención repetible.
- `ai-workflow/docs/test-index.md` si la implementación añadió, movió o eliminó ficheros de test.
- `ai-workflow/docs/current-state.md` si hay que confirmar o actualizar capacidades vigentes o límites globales.
- `ai-workflow/docs/context.md` solo si el cambio requiere revisar el marco general del producto.
- `README.md` solo si hace falta ajustar información breve de entrada.

## Objetivo

Actualizar la documentación para que describa el comportamiento estable realmente implementado, usando el índice de
features como puerta de entrada y manteniendo el contexto corto.

Antes de empezar, comprobar que ninguna de las condiciones de "Cuándo NO usar esta skill" aplica.

## Qué documentos puede actualizar

- la ficha o fichas afectadas en `ai-workflow/docs/app-features/`
- `ai-workflow/docs/app-features/index.md` si cambia el mapa documental o hay que ajustar descripciones
- `ai-workflow/docs/current-state.md` si cambian capacidades vigentes
- `ai-workflow/docs/context.md` solo si cambia el marco general del producto
- `ai-workflow/docs/architecture.md` si la implementación consolidó una decisión arquitectónica estable
- `ai-workflow/docs/conventions.md` si la implementación consolidó una convención repetible
- `ai-workflow/docs/test-index.md` si la implementación añadió, movió o eliminó ficheros de test
- `ai-workflow/features/index.md` si conviene afinar el mapa de features entregadas
- `README.md` solo si hace falta ajustar información breve de entrada

## Flujo de trabajo

1. Identificar qué parte del comportamiento cambió realmente en el código ya implementado.
2. Cruzar ese cambio con la `spec.md` y el índice de features para detectar qué documentos son relevantes.
3. Actualizar primero la ficha o fichas funcionales afectadas en `ai-workflow/docs/app-features/`.
4. Ajustar `ai-workflow/docs/app-features/index.md` si cambió el inventario de features documentadas, el alcance de una
   ficha o su descripción corta.
5. Actualizar `current-state.md` si la capacidad ya forma parte del estado vigente del producto.
6. Actualizar `context.md`, `architecture.md` o `conventions.md` solo cuando el cambio sea suficientemente general o
   estable como para merecerlo.
7. Cerrar explícitamente el estado documental de la tarea actualizando `status.yaml` (campos `documentation.ready`/
   `documentation.done`) según las reglas de trabajo de esta skill.
8. Dejar la documentación alineada con el comportamiento real sin convertir los documentos en un changelog.
9. Aplicar la sección **"Commit final"** de este documento cuando corresponda, ejecutando directamente sin pedir
   confirmación.

## Reglas de trabajo

- No implementar código en esta skill.
- No reabrir decisiones de producto ya cerradas salvo que la implementación y la `spec` estén claramente en conflicto.
- No actualizar documentos "por si acaso"; tocar solo los realmente afectados.
- Mantener `context.md` breve y usar las fichas de `app-features/` para el detalle funcional.
- Mantener `app-features/index.md` como índice descriptivo y puerta de entrada para futuras skills.
- Si una feature nueva aparece como área funcional diferenciada, añadir su ficha al índice.
- Si una feature existente cambió de alcance, actualizar tanto su ficha como la descripción en el índice.
- Tratar el cierre documental como el segundo estado explícito de finalización de la tarea, posterior al cierre de
  implementación y tests.
- No convertir `README.md` en historial acumulado.
- Si el gate documental no se cumple, detenerse y explicar qué estado de `status.yaml` impide documentar.
- Al terminar, actualizar `status.yaml` como mínimo con:
    - `documentation.ready: true` cuando la implementación ya estaba lista para documentarse
    - `documentation.done: true` cuando la pasada documental queda cerrada
    - `phase: complete` cuando la feature quede cerrada en esta pasada documental
    - `feature_status: completed` cuando ya no quede trabajo pendiente dentro del alcance acordado

## Commit final

Cuando `status.yaml` marca `feature_status: completed` y `documentation.done: true`, la feature está lista para el
commit de cierre. Proceder inmediatamente sin pedir confirmación adicional.

El código, los tests y los artefactos de planificación ya están commiteados desde antes (commit de planificación y
un commit por tarea, ambos hechos por `implement-task-test-first` — ver `ai-workflow/docs/vcs.md`). Lo único sin
commitear a estas alturas es lo que toca esta propia fase: la documentación funcional y tu actualización final de
`status.yaml`.

1. **Hacer el commit de documentación** (formato Conventional Commits en `ai-workflow/docs/vcs.md`):
   ```
   git add -A
   git commit -m "docs: document feature <slug> — short description"
   ```
   `<slug>` es la parte legible del nombre de carpeta de la feature (por ejemplo, para
   `2026-08-20-14-13-navigation-scroll-position` el slug es `navigation-scroll-position`). No incluir el prefijo
   temporal en el mensaje de commit; la fecha ya la aporta `git log`.

2. **Pushear y crear el Merge Request**:
   ```
   git push -o merge_request.create -o merge_request.target=dev -o merge_request.title="<mismo patrón que el commit>" -o merge_request.description="<descripción en una sola línea>" origin <nombre-rama>
   ```
   - Título: mismo patrón que el mensaje de commit.
   - Descripción: **una sola línea sin saltos de línea**. Las opciones `-o` de `git push` rechazan cualquier carácter
     de nueva línea (`fatal: push options must not have new line characters`), por lo que la descripción no puede ser
     el volcado literal de `spec.md`. Escribir un resumen breve en una sola línea (por ejemplo, la sección "Objetivo"
     de la spec compactada) y, si hace falta la spec completa como cuerpo del MR, editarla desde la UI de GitLab tras
     la creación.
   - Sin asignación de reviewer ni assignee por defecto.

No tocar los commits anteriores (ni `rebase -i`, ni `amend`, ni squash): este commit solo añade, nunca reescribe.

## Detente y señala un problema cuando

- el código implementado no deja claro cuál es el comportamiento final
- la implementación contradice de forma material a `spec.md`
- la documentación que debería cambiar es mucho mayor de lo esperado y parece indicar falta de replanificación
- falta contexto para decidir si una capacidad ya es estable o sigue siendo parcial

## Terminado cuando

1. la documentación afectada refleja el comportamiento estable real
2. el índice `ai-workflow/docs/app-features/index.md` sigue siendo una puerta de entrada fiable
3. `current-state.md` y `context.md` solo se tocan cuando realmente corresponde
4. `status.yaml` refleja el cierre documental real de la feature o del alcance tratado
5. queda cerrado el estado documental explícito de la tarea
6. la feature puede quedar marcada como `completed` directamente desde esta pasada si ya no queda trabajo pendiente
7. no se han introducido cambios de código en esta pasada