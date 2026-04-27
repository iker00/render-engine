---
name: implement-task-test-first
description: Implementa una tarea planificada de este proyecto usando un enfoque tests-first. Úsala cuando `spec.md`, `tasks.md` y `test-plan.md` ya existan y el objetivo sea ejecutar una tarea de código de forma segura, dejando la actualización documental amplia para una skill posterior.
preferred_profile: standard
profile_rationale: Fase de ejecución con lectura de código, edición, tests y validación; necesita más contexto y fiabilidad que una fase solo documental.
---

# Implementar tareas con enfoque tests-first

Usa esta skill cuando la feature ya esté especificada y planificada, y el objetivo sea ejecutar sus tareas en orden.

Esta skill debe comportarse como la fase de ejecución de un flujo guiado por specs, pero centrada en código y validación: implementar las tareas de la feature de manera consecutiva, aplicar tests-first cuando sea práctico, y no pasar a la siguiente tarea hasta que la actual quede terminada con sus tests. La actualización documental amplia se delega a una skill posterior.

## Leer primero
- `ai-workflow/docs/workflow.md`
- `ai-workflow/features/NNNN-feature-name/spec.md`
- `ai-workflow/features/NNNN-feature-name/tasks.md`
- `ai-workflow/features/NNNN-feature-name/test-plan.md`
- `ai-workflow/features/NNNN-feature-name/status.yaml`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/conventions.md`
- todos los archivos de `ai-workflow/standards/`
- `ai-workflow/features/NNNN-feature-name/design.md` si existe
- código y tests relevantes para la tarea seleccionada
- `ai-workflow/features/NNNN-feature-name/notes.md` si existe

## Leer solo si hace falta
- `ai-workflow/docs/context.md` si `tasks.md` no basta para entender el comportamiento esperado
- `ai-workflow/docs/app-features/index.md` y solo las fichas relevantes si la tarea remite explícitamente a una feature funcional o si el contrato de ejecución no es suficiente
- `ai-workflow/docs/current-state.md` si existe y hay dudas sobre el estado vigente
- `ai-workflow/features/index.md` si existe y hace falta contexto adicional sobre el mapa de features

## Objetivo
Implementar las tareas planificadas de la feature en orden usando un flujo tests-first.

Antes de empezar, comprobar el gate de implementación:
- `spec.md` lista
- `tasks.md` lista
- `test-plan.md` listo
- `design.md` lista si `status.yaml` marca `requires_design: true`
- sin bloqueos activos en `status.yaml`
- existe un plan claro de tests relevantes para la tarea actual

Si el gate falla, detenerse y explicitar qué artefacto o estado falta.

## Flujo de ejecución
1. Seleccionar la primera tarea pendiente de `tasks.md`.
1.1. Confirmar en `status.yaml` que la feature está habilitada para implementación.
1.2. Al iniciar una nueva pasada de implementación o una nueva tarea, resetear en `status.yaml` los flags de validación a un estado no cerrado hasta que vuelvan a ejecutarse las validaciones finales:
  - `validation.tests_green: false`
  - `validation.coverage_gate_passed: false`
2. Confirmar que la tarea es lo bastante clara como para ejecutarse sin reabrir la planificación de la feature.
3. Identificar el comportamiento requerido y los tests que deberían existir antes de la implementación o junto a ella.
4. Añadir o actualizar tests antes de la implementación cuando sea factible y útil.
5. Implementar el mínimo código necesario para satisfacer el comportamiento planificado.
6. Refactorizar solo si mejora la claridad o reduce duplicación real sin ampliar el alcance.
7. Ejecutar los tests relevantes mientras avanzas y repetirlos tantas veces como haga falta hasta cerrar la tarea con validación real.
7.1. Antes de dar por cerrada la tarea actual, ejecutar la validación final relevante para esa tarea.
7.2. Antes de dar por cerrada la pasada, ejecutar también la validación necesaria para confirmar que el umbral de cobertura exigido por el proyecto sigue cumpliéndose.
8. Registrar notas de implementación útiles en `features/NNNN-feature-name/notes.md` solo si aportan valor para pasos posteriores o para la futura actualización documental.
9. Actualizar el estado de la tarea en `tasks.md` si el formato de la tarea lo permite.
9.1. Actualizar `status.yaml` con la tarea en curso o completada:
  - `current_task_id`
  - `implementation.in_progress_task_id`
  - `implementation.completed_task_ids`
  - `validation.tests_green`
  - `validation.coverage_gate_passed`
10. Señalar explícitamente qué documentación debería revisar después la skill documental si el cambio afecta comportamiento estable.
11. Solo cuando la tarea actual esté terminada y validada, pasar a la siguiente tarea pendiente de `tasks.md`.
12. Repetir el ciclo hasta completar todas las tareas que entren en el alcance solicitado por el usuario o hasta encontrar un bloqueo que exija detenerse.

## Reglas de trabajo
- Tratar `tasks.md` como contrato de ejecución, no como guía orientativa.
- Implementar las tareas en el orden definido por `tasks.md`.
- No pasar a la siguiente tarea mientras la actual no esté implementada y verificada.
- Mantener los cambios alineados con el impacto previsto en archivos descrito en `tasks.md`.
- No ampliar, fusionar, reordenar ni reinterpretar tareas por iniciativa propia.
- Asumir que un buen `tasks.md` debería llevar a cualquier agente competente al mismo resultado funcional; si la tarea admite varias lecturas funcionales, detenerse.
- No cargar contexto funcional extra por defecto si el contrato de ejecución ya es suficiente.
- Respetar los límites arquitectónicos y las convenciones del proyecto.
- No asumir que esta skill cierra la documentación funcional; ese trabajo corresponde a `update-app-documentation`.
- No empezar a implementar si `status.yaml` indica `blocked_by` no vacío o si `implementation.ready` es falso por falta de artefactos.
- No reutilizar un `validation.tests_green: true` o `validation.coverage_gate_passed: true` de una pasada anterior como si siguiera siendo válido tras nuevos cambios.
- No considerar una tarea cerrada mientras los tests relevantes de esa tarea no estén en verde.
- No considerar una pasada de implementación cerrada si la validación final rompe el umbral de cobertura exigido por el proyecto.
- Tras la validación final, dejar `status.yaml` actualizado con el estado real de tests y coverage; no dejar esos campos implícitos.
- Solo escribir `notes.md` cuando haga falta conservar contexto útil para la skill documental posterior o para pasos siguientes.
- Si la implementación revela una discrepancia válida con la spec, señalarla explícitamente y dejar preparada la posterior actualización documental en vez de desviarse en silencio.
- Preferir el cambio más pequeño que satisfaga el comportamiento planificado.
- La respuesta final debe incluir siempre una lista de checks con las tareas implementadas en esa pasada.
- La respuesta final debe incluir también una lista de checks con las tareas de la feature que siguen pendientes.
- Si no se implementó ninguna tarea por bloqueo o replanificación, la lista de checks de tareas implementadas debe indicarlo explícitamente.

## Nivel mínimo de tests-first
- Definir la verificación antes de dar la implementación por terminada.
- Empezar desde un test ausente o en fallo cuando sea práctico, pero no forzar unit tests artificiales si un integration test es el punto de entrada correcto.
- El estado final debe incluir tests en verde para el comportamiento implementado.
- La skill debe ejecutar tests durante la implementación, no solo al final como formalidad.
- El cierre de la pasada debe respetar el umbral de cobertura del proyecto (`pnpm test` o el comando equivalente que lo haga cumplir).
- Evitar escribir tests que solo reflejen detalles de implementación.

## Detente y señala un problema cuando
- la tarea esté insuficientemente especificada
- la tarea entre en conflicto con `spec.md`
- `tasks.md` no ofrezca un contrato suficientemente claro para ejecutar la tarea sin reinterpretarla
- la tarea requiera un cambio arquitectónico más amplio de lo planificado
- el impacto documental requerido revele que en realidad la tarea no estaba bien acotada o requiere replanificación
- la implementación revele que el siguiente paso seguro es replanificar en vez de seguir programando
- una tarea falle sus validaciones y no pueda cerrarse con seguridad antes de avanzar a la siguiente

## Terminado cuando
- cada tarea ejecutada en la pasada está implementada
- los tests relevantes de cada tarea ejecutada pasan
- la validación final de la pasada mantiene el umbral de cobertura exigido por el proyecto
- ninguna tarea posterior se ha empezado antes de cerrar correctamente la anterior
- las tareas ejecutadas quedan en un estado revisable y sin trabajo posterior oculto
- `status.yaml` deja claro qué tarea queda en curso, cuáles se cerraron y si la documentación ya puede empezar
- `status.yaml` deja explícito si `validation.tests_green` y `validation.coverage_gate_passed` quedaron en `true`
- la respuesta final deja claro qué documentación debería actualizar la skill documental posterior
- la respuesta final enumera en formato checklist las tareas implementadas en la pasada
- la respuesta final enumera en formato checklist las tareas pendientes de la feature
