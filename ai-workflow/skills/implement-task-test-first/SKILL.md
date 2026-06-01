---
name: implement-task-test-first
description: Implementa las tareas planificadas de una feature de este proyecto orquestando un subagente con contexto limpio por cada tarea. Úsala cuando `spec.md` y `tasks.md` ya existan y el objetivo sea ejecutar tareas de código de forma segura con enfoque tests-first, dejando la actualización documental amplia para una skill posterior.
model: sonnet
---

# Implementar tareas con enfoque tests-first

Esta skill actúa como **orquestador**: lanza un subagente con contexto limpio por cada tarea, recibe un resultado estructurado y avanza solo cuando la tarea queda cerrada con validación real. La actualización documental amplia se delega a una skill posterior.

El orquestador no implementa código por sí mismo. El contrato completo del subagente vive en `subagent-prompt.md`, dentro de esta misma skill, y el subagente lo lee al arrancar.

## Leer siempre (orquestador)
Lo mínimo para decidir qué tarea toca y mantener el estado:
- `ai-workflow/docs/workflow.md`
- `ai-workflow/features/NNNN-feature-name/tasks.md`
- `ai-workflow/features/NNNN-feature-name/status.yaml`

El contexto funcional amplio (spec, design, architecture, conventions, código relevante) lo lee el subagente. El orquestador no debe acumular ese contexto entre tareas.

## Objetivo
Implementar las tareas planificadas de la feature en orden, una por una, lanzando un subagente por tarea hasta agotar el alcance solicitado o encontrar un bloqueo.

## Gate de implementación
Antes de empezar la pasada, comprobar:
- `spec.md` lista
- `tasks.md` lista
- `design.md` lista si `status.yaml` marca `requires_design: true`
- `status.yaml` sin bloqueos activos en `blocked_by`
- `implementation.ready: true`

Si el gate falla, detenerse y explicitar qué artefacto o estado falta.

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
   - `completed`: actualizar `tasks.md` (marcar la tarea como cerrada si el formato lo permite) y `status.yaml` (mover el ID de `in_progress_task_id` a `completed_task_ids`, limpiar `in_progress_task_id`). Pasar a la siguiente tarea.
   - `blocked` o `failed`: detener la pasada, dejar la tarea en `in_progress_task_id`, registrar el motivo en `status.yaml.blocked_by` y saltar al paso 8.
7. Repetir desde el paso 1.
8. Ejecutar la validación final de cobertura del proyecto (`pnpm test`). Si no se implementó ninguna tarea en esta pasada (gate fallido o bloqueo temprano sin código nuevo), se puede omitir y dejar los flags de validación en `false`.
9. Actualizar `status.yaml`:
   - `validation.tests_green: true | false`
   - `validation.coverage_gate_passed: true | false`
10. Emitir la respuesta final con dos checklists (tareas implementadas en la pasada y tareas pendientes de la feature) y las notas documentales agregadas que devolvieron los subagentes.

## Lanzamiento del subagente
- Usar la herramienta `Agent` con `subagent_type: general-purpose`.
- El prompt del subagente debe ser corto y autosuficiente: identidad de la tarea (`task_id`, ruta absoluta a `tasks.md` y a la carpeta de la feature) e instrucción de leer y aplicar literalmente `ai-workflow/skills/implement-task-test-first/subagent-prompt.md`.
- Esperar como única salida un JSON con la forma documentada en `subagent-prompt.md`. Sus campos relevantes para el orquestador:
  - `task_id`
  - `status` (`completed | blocked | failed`)
  - `tests_green`
  - `files_created`, `files_modified`, `tests_added_or_updated`
  - `notes_for_documentation`
  - `blocker_reason`

## Reglas de trabajo (orquestador)
- Mantener el orden definido por `tasks.md`. No reordenar ni fusionar tareas.
- Lanzar un único subagente por tarea. No agrupar tareas en un mismo subagente aunque compartan ficheros.
- No avanzar a la siguiente tarea si la anterior devolvió `blocked` o `failed`.
- Centralizar la escritura de `tasks.md` y `status.yaml`: solo el orquestador los modifica.
- No reutilizar `validation.tests_green: true` o `validation.coverage_gate_passed: true` de pasadas anteriores como si siguieran siendo válidos tras nuevos cambios.
- Ejecutar la validación de cobertura una sola vez al final de la pasada, no por tarea.
- Tratar `tasks.md` como contrato de ejecución, no como guía orientativa.
- Si una tarea revela una discrepancia válida con la spec, señalarla en la respuesta final y dejar la actualización documental marcada para la skill posterior, sin desviarse en silencio.
- La respuesta final debe incluir siempre:
  - lista de checks con las tareas implementadas en la pasada
  - lista de checks con las tareas de la feature que siguen pendientes
  - bloqueos registrados, si los hay
  - notas documentales consolidadas (`notes_for_documentation` por tarea) para que `update-app-documentation` tenga un punto de partida
- Si no se implementó ninguna tarea (bloqueo temprano o gate fallido), las listas de checks deben indicarlo explícitamente.

## Detente y señala un problema cuando
- el gate de implementación falla por artefacto o estado bloqueante
- un subagente devuelve `status: "blocked"` o `status: "failed"`
- la validación final de cobertura rompe el umbral del proyecto al cierre de la pasada

## Terminado cuando
- cada tarea ejecutada en la pasada está implementada y sus tests propios pasan
- la validación final (`pnpm test`) mantiene el umbral de cobertura exigido por el proyecto
- ninguna tarea posterior se empezó antes de cerrar correctamente la anterior
- `status.yaml` refleja qué tareas se cerraron, cuál quedó en curso si la pasada se detuvo, y si `validation.tests_green` y `validation.coverage_gate_passed` quedaron en `true`
- la respuesta final enumera en formato checklist las tareas implementadas en la pasada
- la respuesta final enumera en formato checklist las tareas pendientes de la feature
- la respuesta final consolida las notas documentales pendientes para la skill posterior
