---
name: implement-task-test-first
description: Implementa las tareas planificadas de una feature de este proyecto orquestando un subagente con contexto limpio por cada tarea. Úsala cuando `spec.md` y `tasks.md` ya existan y el objetivo sea ejecutar tareas de código de forma segura con enfoque tests-first, dejando la actualización documental amplia para una skill posterior.
model: sonnet
allowed-tools: Read, Edit, Bash, Agent
---

# Implementar tareas con enfoque tests-first

Esta skill actúa como **orquestador**: lanza un subagente con contexto limpio por cada tarea, recibe un resultado estructurado y avanza solo cuando la tarea queda cerrada con validación real. La actualización documental amplia se delega a una skill posterior.

El orquestador no implementa código por sí mismo. El contrato del subagente vive en la definición del agente `implement-task` (`ai-workflow/agents/implement-task.md`, enlazada desde `.claude/agents/`), escrita a mano y que nada genera ni modifica. El contexto compartido de la pasada se lo entrega un hook. El orquestador no lee ni pega ninguno de los dos: solo entrega el bloque de tarea.

## Leer siempre (orquestador)
Lo mínimo para decidir qué tarea toca y mantener el estado:
- `ai-workflow/docs/workflow.md`
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/tasks.md`
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/status.yaml`

El contrato de implementación llega al subagente en su system prompt y los standards y docs estables vía el hook de contexto, sin que el orquestador intervenga. Lo específico de la tarea (código y tests del área, `notes.md` si existe, ficha de `app-features/` si la tarea la referencia) lo lee el propio subagente. El orquestador no acumula ninguno de esos contextos entre tareas.

## Objetivo
Implementar las tareas planificadas de la feature en orden, una por una, lanzando un subagente por tarea hasta agotar el alcance solicitado o encontrar un bloqueo.

## Gate de implementación
Antes de empezar la pasada, comprobar en orden:

1. Artefactos y estado:
   - `spec.md` lista
   - `tasks.md` lista
   - `design.md` lista si `status.yaml` marca `requires_design: true`
   - `status.yaml` sin bloqueos activos en `blocked_by`
   - `implementation.ready: true`
2. **Línea base del repo en verde**: ejecutar `pnpm lint` y `pnpm exec tsc --noEmit -p tsconfig.app.json && pnpm exec tsc --noEmit -p tsconfig.node.json`. Ambos deben pasar. Es la misma validación que corre el hook `SubagentStop` en cada tarea; comprobarla al arrancar evita que un error preexistente ajeno se atribuya al primer subagente y bloquee la pasada sin haber tocado código.

Si el paso 1 falla, detenerse y explicitar qué artefacto o estado falta.

Si el paso 2 falla, detenerse sin lanzar ningún subagente. La respuesta final debe listar los errores detectados y dejar claro que la pasada no arrancó porque el repo no estaba en verde de entrada. La corrección de esa deuda ajena queda fuera del alcance de la skill: el usuario decide si la arregla y relanza, o si la deja para otro flujo.

3. **Commit de planificación**, antes de lanzar el primer subagente y solo si los dos pasos anteriores pasan:
   ```
   git add ai-workflow/features/<carpeta-de-la-feature>/
   git diff --cached --quiet || git commit -m "docs: plan feature <slug>"
   ```
   `<slug>` es la parte legible del nombre de carpeta de la feature (formato Conventional Commits en `ai-workflow/docs/vcs.md`). Esto deja `spec.md`, `design.md` (si existe), `tasks.md` y `status.yaml` ya commiteados antes de que arranque ninguna tarea, para que el `git add -A` del paso 6 (commit de la primera tarea) no los arrastre por error. Si esta skill se relanza para retomar una pasada anterior y esos artefactos ya estaban commiteados, `git diff --cached --quiet` evita un commit vacío.

## Contexto compartido y validación: automáticos

El orquestador **no** prepara contexto ni ejecuta validaciones por tarea. De eso se encargan la definición del agente y dos hooks registrados en `.claude/settings.json` con matcher `implement-task`:

- **System prompt del agente**: `ai-workflow/agents/implement-task.md` contiene solo el contrato de implementación. Es un fichero escrito a mano; ningún script lo genera ni lo modifica.
- **`SubagentStart` → `hooks/load-context.sh`**: concatena los standards del proyecto y las docs estables (`conventions.md`, `architecture.md`, `test-index.md`) en `.subagent-context.md` (gitignored) y le pasa al subagente **la ruta**, no el contenido. El subagente lo carga con una sola llamada a `Read`.
- **`SubagentStop` → `hooks/validate.sh`**: antes de dejar cerrar cada tarea ejecuta `pnpm lint` y `tsc --noEmit` sobre ambos tsconfig. Si algo falla, impide que el subagente termine y le devuelve el error para que lo corrija, con un máximo de 3 intentos.

Por qué la ruta y no el texto: Claude Code trunca la salida de un hook a partir de ~10KB y descarga el resto a disco, así que el contenido inyectado directamente llegaría como preview. La ruta ocupa ~460 bytes y el fichero (~60KB, ~870 líneas) entra entero en una sola lectura, por debajo del tope de `Read`.

Contrapartida asumida: el contexto llega como resultado de herramienta, es decir **después** del bloque de tarea, que ya difiere entre subagentes. Eso significa que no se comparte caché de prompt entre las tareas de una pasada; cada subagente paga su contexto. Es el precio de mantener el fichero del agente limpio y sin generación.

Consecuencias para el orquestador:

- Un subagente que devuelve `status: "completed"` implica lint y tipos en verde, salvo que agotara los reintentos.
- Los tests **no** corren en el hook: la suite completa con cobertura se ejecuta una sola vez al cierre de la pasada (paso 8).
- Cada tarea paga ~25s de validación. Es el coste de no arrastrar tareas rotas a la siguiente.
- Si cambias los standards o las docs estables, el hook los recoge en el siguiente subagente sin que haya que regenerar nada. Cambiar el contrato del agente sí exige reabrir sesión.

## Flujo del orquestador
1. Seleccionar la primera tarea pendiente de `tasks.md` que no esté en `implementation.completed_task_ids` y que entre en el alcance solicitado por el usuario. Si no queda ninguna tarea pendiente en alcance, saltar al paso 8.
2. Resetear en `status.yaml` los flags de validación de la pasada anterior:
   - `validation.tests_green: false`
   - `validation.coverage_gate_passed: false`
3. Marcar la tarea seleccionada en `status.yaml`:
   - `implementation.in_progress_task_id: <ID>`
4. Lanzar un subagente para esa tarea con la herramienta `Agent` (ver "Lanzamiento del subagente").
5. Recibir el texto final del subagente y parsearlo como JSON. Tolerar `\`\`\`json` y `\`\`\`` envolventes si el subagente los añade. Si el JSON no se puede parsear o falta algún campo obligatorio, tratarlo como `status: "failed"` con `blocker_reason` describiendo el problema de protocolo y continuar por la rama de fallo del paso 6.
6. Según el `status` devuelto:
   - `completed`: actualizar `status.yaml` (mover el ID de `in_progress_task_id` a `completed_task_ids`, limpiar `in_progress_task_id`) y, después de actualizarlo, hacer **un único commit con todo lo de esta tarea** — código, tests y la propia actualización de `status.yaml` — usando el `commit_message` que trae el JSON del subagente:
     ```
     git add -A
     git commit -m "<commit_message del subagente>"
     ```
     El subagente nunca ejecuta git por su cuenta; el commit lo hace siempre el orquestador, aquí, después de recibir `status: "completed"` y actualizar `status.yaml`. `git add -A` es seguro en este punto porque no queda nada suelto de fases anteriores (el commit de planificación ya recogió `spec.md`/`design.md`/`tasks.md`/el `status.yaml` inicial antes de la primera tarea). Pasar a la siguiente tarea.
   - `blocked` o `failed`: detener la pasada, dejar la tarea en `in_progress_task_id`, registrar el motivo en `status.yaml.blocked_by` y saltar al paso 8. No commitear en este caso: los cambios (incluido el `status.yaml` con el bloqueo) quedan sin commitear para que el usuario decida cómo seguir.
7. Repetir desde el paso 1.
8. Ejecutar la validación final de cobertura del proyecto (`pnpm test`). Si no se implementó ninguna tarea en esta pasada (gate fallido o bloqueo temprano sin código nuevo), se puede omitir y dejar los flags de validación en `false`.
9. Actualizar `status.yaml`:
   - `validation.tests_green: true | false`
   - `validation.coverage_gate_passed: true | false`
10. Emitir la respuesta final con dos checklists (tareas implementadas en la pasada y tareas pendientes de la feature) y las notas documentales agregadas que devolvieron los subagentes.

## Lanzamiento del subagente
- Usar la herramienta `Agent` con `subagent_type: implement-task`.
- El prompt del subagente contiene **únicamente** el bloque de tarea. Los standards, las docs estables y el contrato de implementación ya le llegan por hook y por system prompt; no los pegues.
  ```
  ## Tu tarea

  - task_id: <ID>
  - feature_path: <ruta a la carpeta de la feature>

  <contenido literal del bloque de la tarea copiado tal cual de tasks.md, delimitado por los `---` que separan tareas o por el final del fichero>

  Aplica tu contrato de implementación a este bloque de tarea. No abras `tasks.md`: el bloque de tu tarea ya está inline aquí arriba. Sí lee lo específico del área (código, tests, notes.md, ficha de app-features si la tarea la referencia).
  ```
- El orquestador extrae el bloque directamente de `tasks.md` (que ya tiene abierto para seleccionar la tarea) y lo pega literal, sin resumir ni reformatear.
- Mantener este prompt lo más estable posible entre tareas: solo deben variar el `task_id`, el `feature_path` y el bloque de tarea.
- Esperar como única salida un JSON con la forma documentada en el contrato del agente (`ai-workflow/agents/implement-task.md`). Sus campos relevantes para el orquestador:
  - `task_id`
  - `status` (`completed | blocked | failed`)
  - `tests_green`
  - `files_created`, `files_modified`, `tests_added_or_updated`
  - `notes_for_documentation`
  - `blocker_reason`
  - `commit_message` (usado para el commit de la tarea cuando `status` es `completed`)

## Reglas de trabajo (orquestador)
- Mantener el orden definido por `tasks.md`. No reordenar ni fusionar tareas.
- Lanzar un único subagente por tarea. No agrupar tareas en un mismo subagente aunque compartan ficheros.
- No avanzar a la siguiente tarea si la anterior devolvió `blocked` o `failed`.
- `tasks.md` es solo lectura durante la implementación; el orquestador no lo modifica. El estado de la pasada vive únicamente en `status.yaml`, y solo el orquestador lo escribe.
- No reutilizar `validation.tests_green: true` o `validation.coverage_gate_passed: true` de pasadas anteriores como si siguieran siendo válidos tras nuevos cambios.
- Ejecutar la validación de cobertura una sola vez al final de la pasada, no por tarea.
- No ejecutar `pnpm lint` ni `tsc --noEmit` por tarea: ya lo hace el hook `SubagentStop` del subagente.
- Tratar `tasks.md` como contrato de ejecución, no como guía orientativa.
- Si una tarea revela una discrepancia válida con la spec, señalarla en la respuesta final y dejar la actualización documental marcada para la skill posterior, sin desviarse en silencio.
- La respuesta final debe incluir siempre:
  - lista de checks con las tareas implementadas en la pasada
  - lista de checks con las tareas de la feature que siguen pendientes
  - bloqueos registrados, si los hay
  - notas documentales consolidadas (`notes_for_documentation` por tarea) para que `update-app-documentation` tenga un punto de partida
- Si no se implementó ninguna tarea (bloqueo temprano o gate fallido), las listas de checks deben indicarlo explícitamente.

## Detente y señala un problema cuando
- el gate de implementación falla por artefacto, estado bloqueante o línea base del repo en rojo
- un subagente devuelve `status: "blocked"` o `status: "failed"`
- un subagente cierra tras agotar los reintentos de la validación automática (lint o tipos en rojo)
- la validación final de cobertura rompe el umbral del proyecto al cierre de la pasada

## Terminado cuando
- cada tarea ejecutada en la pasada está implementada y sus tests propios pasan
- la validación final (`pnpm test`) mantiene el umbral de cobertura exigido por el proyecto
- ninguna tarea posterior se empezó antes de cerrar correctamente la anterior
- `status.yaml` refleja qué tareas se cerraron, cuál quedó en curso si la pasada se detuvo, y si `validation.tests_green` y `validation.coverage_gate_passed` quedaron en `true`
- la respuesta final enumera en formato checklist las tareas implementadas en la pasada
- la respuesta final enumera en formato checklist las tareas pendientes de la feature
- la respuesta final consolida las notas documentales pendientes para la skill posterior
