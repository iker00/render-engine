---
name: implement-task-test-first
description: Implementa las tareas planificadas de una feature de este proyecto orquestando un subagente con contexto limpio por cada tarea. Úsala cuando `spec.md` y `tasks.md` ya existan y el objetivo sea ejecutar tareas de código de forma segura con enfoque tests-first, dejando la actualización documental amplia para una skill posterior.
model: sonnet
allowed-tools: Read, Edit, Bash, Agent, SendMessage
---

# Implementar tareas con enfoque tests-first

Esta skill actúa como **orquestador**: lanza un subagente con contexto limpio por cada tarea, recibe un resultado estructurado y avanza solo cuando la tarea queda cerrada con validación real. La actualización documental amplia se delega a una skill posterior.

El orquestador no implementa código por sí mismo. El contrato del subagente vive en la definición del agente `implement-task` (`ai-workflow/agents/implement-task.md`, enlazada desde `.claude/agents/`), escrita a mano y que nada genera ni modifica. El contexto compartido de la pasada y el bloque de la tarea en curso se los entrega un hook. El orquestador no lee ni pega ninguno: marca en `status.yaml` la tarea en curso y lanza el subagente.

## Leer siempre (orquestador)
Lo mínimo para decidir qué tarea toca y mantener el estado, en un único turno (varias llamadas Read en el mismo mensaje):
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

El orquestador **no** prepara contexto ni ejecuta validaciones por tarea, ni tampoco arma el contexto de la revisión de cada tarea. De eso se encargan la definición de los agentes y los hooks registrados en `.claude/settings.json` con matcher `implement-task` y `review-task`:

- **System prompt del agente**: `ai-workflow/agents/implement-task.md` contiene solo el contrato de implementación. Es un fichero escrito a mano; ningún script lo genera ni lo modifica.
- **`SubagentStart` → `hooks/load-context.js`**: concatena los standards del proyecto y las docs estables (`conventions.md`, `architecture.md`, `test-index.md`) en `.subagent-context.md`, extrae de `tasks.md` el bloque de `implementation.in_progress_task_id` de la feature activa en `.subagent-task.md` (ambos gitignored), y le pasa al subagente **las rutas**, no el contenido. El subagente los carga con dos llamadas a `Read`. Si no hay feature activa o tarea en curso, se lo dice y el subagente devuelve `blocked`.
- **`SubagentStop` → `hooks/validate.js`**: antes de dejar cerrar cada tarea ejecuta `pnpm lint`, `tsc --noEmit` sobre ambos tsconfig y, si la tarea tocó `src/tests/`, `check-test-index.js`. Si algo falla, impide que el subagente termine y le devuelve el error para que lo corrija, con un máximo de 3 intentos.
- **`SubagentStart` → `hooks/review-task-context.js`**: entrega a `review-task` las rutas del bloque de la tarea, el `git diff` sin commitear y el informe del implementador (`.task-report.json`), todo gitignored igual que el contexto de `implement-task`.
- **`SubagentStop` → `hooks/count-review.js`**: incrementa `implementation.review_revisions` cada vez que `review-task` termina, sin mirar su veredicto. Es el contador que usa el orquestador para decidir si retoma al implementador o trata la tarea como bloqueada — ver "Ciclo de revisión de la tarea".

La validación final de la pasada (la suite completa con cobertura) **no** es automática: la ejecuta el propio orquestador al cerrar, en primer plano — ver "Cierre de la pasada". No hay hook de por medio porque el volumen de salida ya no lo justifica (ver esa sección).

Por qué la ruta y no el texto: Claude Code trunca la salida de un hook a partir de ~10KB y descarga el resto a disco, así que el contenido inyectado directamente llegaría como preview. La ruta ocupa ~460 bytes y el fichero (~60KB, ~870 líneas) entra entero en una sola lectura, por debajo del tope de `Read`.

Contrapartida asumida: cada subagente paga la lectura de sus ficheros de contexto (dos para `implement-task`, tres para `review-task`). El prompt de lanzamiento es idéntico entre tareas; lo que varía llega por hook. Es el precio de mantener el fichero del agente limpio y sin generación.

Consecuencias para el orquestador:

- Un subagente que devuelve `status: "completed"` implica lint y tipos en verde, salvo que agotara los reintentos.
- Cada tarea paga ~25s de validación. Es el coste de no arrastrar tareas rotas a la siguiente.
- Si cambias los standards o las docs estables, el hook los recoge en el siguiente subagente sin que haya que regenerar nada. Cambiar el contrato del agente sí exige reabrir sesión.

## Flujo del orquestador
1. Seleccionar la primera tarea pendiente de `tasks.md` que no esté en `implementation.completed_task_ids` y que entre en el alcance solicitado por el usuario. Si no queda ninguna tarea pendiente en alcance, saltar al paso 8.
2. Actualizar `status.yaml` para el arranque de la pasada.
3. Marcar en `status.yaml` la tarea seleccionada como en curso: `in_progress_task_id: <ID>` y `review_revisions: 0`.
4. Lanzar un subagente para esa tarea con la herramienta `Agent` (ver "Lanzamiento de implement-task"), guardando el identificador que devuelve la llamada.
5. Recibir el texto final del subagente y parsearlo como JSON. Tolerar `\`\`\`json` y `\`\`\`` envolventes si el subagente los añade. Si el JSON no se puede parsear o falta algún campo obligatorio, tratarlo como `status: "failed"` con `blocker_reason` describiendo el problema de protocolo y continuar por la rama de fallo del paso 6.
6. Según el `status` devuelto:
   - `completed`: aplicar el "Ciclo de revisión de la tarea". Si termina en aprobación, pasar a la siguiente tarea. Si termina en bloqueo, saltar al paso 8.
   - `blocked` o `failed`: detener la pasada, registrar el bloqueo en `status.yaml` y saltar al paso 8. No commitear en este caso: los cambios (incluido el `status.yaml` con el bloqueo) quedan sin commitear para que el usuario decida cómo seguir.
7. Repetir desde el paso 1.
8. Si `implementation.completed_task_ids` no está vacío, aplicar "Cierre de la pasada" antes de responder.
9. Emitir la respuesta final con dos checklists (tareas implementadas en la pasada y tareas pendientes de la feature) y las notas documentales agregadas que devolvieron los subagentes.

## Cierre de la pasada

Antes de responder, si se implementó al menos una tarea en esta pasada, ejecutar el comando `test` del proyecto (el script `test` de `package.json`) directamente con `Bash` y esperar a que termine — es la única vez que corre en toda la pasada, así que el volumen de su salida es asumible en este punto.

Leer la salida completa antes de decidir nada:

- Exit code `0`: `validation.tests_green: true` y `coverage_gate_passed: true`.
- Exit code distinto de `0`: decidir cada flag a partir de lo que dice la propia salida (tests en rojo, umbral de cobertura no alcanzado, o ambos). Si la salida no deja claro cuál de las dos causas es, no asumir éxito en ninguna: las dos a `false`.

Escribir el resultado en `status.yaml` y continuar al paso de la respuesta final. No relanzar el comando ni investigar más allá de esta lectura: el resultado de esta única ejecución es el que se reporta, en verde o en rojo.

## Ciclo de revisión de la tarea
Se aplica cada vez que el implementador —el lanzamiento inicial o una reanudación tras correcciones— devuelve `status: "completed"`, antes de comitear nada.

1. Volcar el JSON del implementador, tal cual, a `.task-report.json` en la raíz del repo (gitignored).
2. Lanzar `review-task` con la herramienta `Agent` (ver "Lanzamiento de review-task").
3. Recibir su veredicto y actuar:
   - **`aprobado`**: actualizar `status.yaml` —mover el ID a `completed_task_ids`, limpiar `in_progress_task_id`— y hacer **un único commit con todo lo de esta tarea**, código, tests y la propia actualización de `status.yaml`, usando el `commit_message` del JSON del implementador:
     ```
     git add -A
     git commit -m "<commit_message del subagente>"
     ```
     `git add -A` es seguro aquí porque no queda nada suelto de fases anteriores (el commit de planificación ya recogió `spec.md`/`design.md`/`tasks.md`/`status.yaml` inicial antes de la primera tarea). El ciclo termina en aprobación.
   - **`requiere correcciones`**: el hook de cierre de `review-task` ya ha incrementado `implementation.review_revisions`. Leer su valor actual:
     - **por debajo de 2**: retomar el mismo subagente implementador con `SendMessage` (el identificador guardado en el paso 4 del flujo), pasándole los hallazgos de `review-task` tal cual. Su nueva respuesta vuelve al paso 5 del flujo del orquestador.
     - **ya en 2**: tratar como bloqueo — registrar en `blocked_by` los hallazgos sin resolver. No commitear. El ciclo termina en bloqueo.

El implementador nunca ejecuta `git` por su cuenta ni habla directamente con `review-task`: el commit y la reanudación los hace siempre el orquestador, aquí.

## Lanzamiento de implement-task
- Usar la herramienta `Agent` con `subagent_type: implement-task`.
- El prompt del subagente es siempre el mismo. El bloque de tarea, los standards, las docs estables y el contrato de implementación ya le llegan por hook y por system prompt; no pegues nada de eso.
  ```
  Implementa la tarea en curso de la feature activa aplicando tu contrato de implementación.
  ```
- `status.yaml` debe tener `implementation.in_progress_task_id` con la tarea antes de lanzar el subagente (paso 3 del flujo).
- Esperar como única salida un JSON con la forma documentada en el contrato del agente (`ai-workflow/agents/implement-task.md`). Sus campos relevantes para el orquestador:
  - `task_id`
  - `status` (`completed | blocked | failed`)
  - `tests_green`
  - `files_created`, `files_modified`, `tests_added_or_updated`
  - `notes_for_documentation`
  - `blocker_reason`
  - `commit_message` (usado para el commit de la tarea cuando `status` es `completed`)

## Lanzamiento de review-task
- Usar la herramienta `Agent` con `subagent_type: review-task`, después de volcar el JSON del implementador a `.task-report.json` (paso 1 del "Ciclo de revisión de la tarea").
- El prompt es siempre el mismo. El bloque de la tarea, el diff sin commitear y el informe del implementador le llegan por hook; no pegues nada de eso.
  ```
  Revisa la tarea en curso de la feature activa aplicando tu contrato de revisión.
  ```
- Esperar como única salida su veredicto (`aprobado` | `requiere correcciones`) y los hallazgos numerados, en la forma documentada en `ai-workflow/agents/review-task.md`.

## Reglas de trabajo (orquestador)
- Mantener el orden definido por `tasks.md`. No reordenar ni fusionar tareas.
- Lanzar un único subagente por tarea. No agrupar tareas en un mismo subagente aunque compartan ficheros.
- No avanzar a la siguiente tarea si la anterior devolvió `blocked` o `failed`.
- `tasks.md` es solo lectura durante la implementación; el orquestador no lo modifica. El estado de la pasada vive únicamente en `status.yaml`, y solo el orquestador lo escribe.
- No comitear una tarea sin que `review-task` la haya aprobado.
- Corregir lo que señale `review-task` lo hace siempre el mismo subagente implementador, retomado con `SendMessage`; nunca el orquestador ni un implementador nuevo.
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
- `review-task` sigue devolviendo `requiere correcciones` tras dos revisiones sobre la misma tarea
- la validación final del "Cierre de la pasada" queda en rojo (`validation.tests_green` o `coverage_gate_passed` en `false`); reportarlo tal cual, no relanzarla

## Terminado cuando
- cada tarea ejecutada en la pasada está implementada, aprobada por `review-task` y sus tests propios pasan
- una vez implementadas todas las tareas de la pasada, la validación final mantiene el umbral de cobertura exigido por el proyecto
- ninguna tarea posterior se empezó antes de cerrar correctamente la anterior
- `status.yaml` refleja qué tareas se cerraron, cuál quedó en curso si la pasada se detuvo, y si `validation.tests_green` y `validation.coverage_gate_passed` quedaron en `true`
- la respuesta final enumera en formato checklist las tareas implementadas en la pasada
- la respuesta final enumera en formato checklist las tareas pendientes de la feature
- la respuesta final consolida las notas documentales pendientes para la skill posterior
