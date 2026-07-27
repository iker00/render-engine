---
name: implement-task-test-first
description: Implementa las tareas planificadas de una feature de este proyecto orquestando un subagente con contexto limpio por cada tarea. Úsala cuando `spec.md` y `tasks.md` ya existan y el objetivo sea ejecutar tareas de código de forma segura con enfoque tests-first, dejando la actualización documental amplia para una skill posterior.
model: sonnet
allowed-tools: Read, Edit, Bash, Agent
---

# Implementar tareas con enfoque tests-first

Esta skill actúa como **orquestador**: lanza un subagente con contexto limpio por cada tarea, recibe un resultado estructurado y avanza solo cuando la tarea queda cerrada con validación real. La actualización documental amplia se delega a una skill posterior.

El orquestador no implementa código por sí mismo. El contrato completo del subagente vive en `subagent-prompt.md`, dentro de esta misma skill, y se entrega al subagente inline como parte del prefijo cacheable generado por `build-context.sh` (ver "Preparación de la pasada").

## Leer siempre (orquestador)
Lo mínimo para decidir qué tarea toca y mantener el estado:
- `ai-workflow/docs/workflow.md`
- `ai-workflow/features/NNNN-feature-name/tasks.md`
- `ai-workflow/features/NNNN-feature-name/status.yaml`

Los standards y las docs estables (conventions, architecture, test-index) más el propio contrato del subagente llegan al subagente vía el prefijo cacheable de `build-context.sh`. Lo específico de la tarea (código y tests del área, `notes.md` si existe, ficha de `app-features/` si la tarea la referencia) lo lee el propio subagente. El orquestador no acumula ninguno de esos contextos entre tareas.

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

## Preparación de la pasada — contexto compartido cacheable

Antes de lanzar el primer subagente, generar una única vez el bloque fijo que se enviará como prefijo en cada llamada a `Agent`. Ese bloque contiene los standards del proyecto, las docs estables y el contrato de implementación del subagente. Al ser idéntico byte a byte en las N invocaciones de la pasada, el prompt caching del modelo lo reusa y evita reprocesarlo N veces.

Ejecutar (una sola vez por pasada), sustituyendo `<feature_path>` por la ruta absoluta de la feature en curso:

```
ai-workflow/skills/implement-task-test-first/build-context.sh <feature_path>/.subagent-context.md
```

El script emite el contenido por stdout **y** lo escribe en `<feature_path>/.subagent-context.md` (gitignored). Capturar el stdout de esa llamada `Bash`; ese texto es el prefijo cacheable que se antepone al bloque de tarea en cada subagente. Si la pasada se reanuda tras una interrupción, re-ejecutar el script: mismos ficheros de entrada -> mismo output, la caché sigue golpeando.

Si el script falla (por ejemplo, falta `standards/` o `subagent-prompt.md`), detener la pasada y señalar el error.

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
   - `completed`: actualizar `status.yaml` (mover el ID de `in_progress_task_id` a `completed_task_ids`, limpiar `in_progress_task_id`). Pasar a la siguiente tarea.
   - `blocked` o `failed`: detener la pasada, dejar la tarea en `in_progress_task_id`, registrar el motivo en `status.yaml.blocked_by` y saltar al paso 8.
7. Repetir desde el paso 1.
8. Ejecutar la validación final de cobertura del proyecto (`pnpm test`). Si no se implementó ninguna tarea en esta pasada (gate fallido o bloqueo temprano sin código nuevo), se puede omitir y dejar los flags de validación en `false`.
9. Actualizar `status.yaml`:
   - `validation.tests_green: true | false`
   - `validation.coverage_gate_passed: true | false`
10. Emitir la respuesta final con dos checklists (tareas implementadas en la pasada y tareas pendientes de la feature) y las notas documentales agregadas que devolvieron los subagentes.

## Lanzamiento del subagente
- Usar la herramienta `Agent` con `subagent_type: general-purpose`.
- El prompt del subagente se compone en dos bloques, en este orden exacto:
  1. **Prefijo cacheable**: el contenido capturado por el paso "Preparación de la pasada" (standards + docs estables + contrato del subagente). Se pega literalmente, sin editar ni reordenar; cualquier alteración rompe el cache hit.
  2. **Bloque de tarea** (variable, cambia en cada llamada):
     ```
     ## Tu tarea

     - task_id: <ID>
     - feature_path: <ruta absoluta a la carpeta de la feature>

     <contenido literal del bloque de la tarea copiado tal cual de tasks.md, delimitado por los `---` que separan tareas o por el final del fichero>

     Aplica el contrato de implementación incluido en el contexto compartido de arriba a este bloque de tarea. No releas los ficheros ya incluidos en el contexto compartido ni abras `tasks.md`; el bloque de tu tarea ya está inline aquí arriba. Sí lee lo específico del área (código, tests, notes.md, ficha de app-features si la tarea la referencia).
     ```
  - El orquestador extrae el bloque directamente de `tasks.md` (que ya tiene abierto para seleccionar la tarea) y lo pega literal, sin resumir ni reformatear.
- El subagente ya no necesita leer `subagent-prompt.md`, `standards/*` ni las docs estables: vienen inline en el prefijo.
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
- `tasks.md` es solo lectura durante la implementación; el orquestador no lo modifica. El estado de la pasada vive únicamente en `status.yaml`, y solo el orquestador lo escribe.
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
