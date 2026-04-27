---
model: claude-sonnet-4-6
description: Implementa las tareas planificadas de una feature con enfoque tests-first
effort: high
allowed-tools: Read, Glob, Grep, Write, Edit, Bash
argument-hint: "[NNNN]"
---
Implementa una tarea planificada de este proyecto usando un enfoque tests-first. Úsala cuando `spec.md`, `tasks.md` y `test-plan.md` ya existan y el objetivo sea ejecutar una tarea de forma segura, incluyendo código, tests y documentación afectada.

# Implementar tareas con enfoque tests-first

Usa esta skill cuando la feature ya esté especificada y planificada, y el objetivo sea ejecutar sus tareas en orden.

Esta skill debe comportarse como la fase de ejecución de un flujo guiado por specs, pero con una disciplina más estricta de ejecución: implementar las tareas de la feature de manera consecutiva, aplicar tests-first cuando sea práctico, y no pasar a la siguiente tarea hasta que la actual quede terminada con sus tests y documentación afectados.

## Leer primero
- `ai-workflow/features/NNNN-feature-name/spec.md`
- `ai-workflow/features/NNNN-feature-name/tasks.md`
- `ai-workflow/features/NNNN-feature-name/test-plan.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/conventions.md`
- `ai-workflow/docs/current-state.md` si existe
- `ai-workflow/features/index.md` si existe
- todos los archivos de `ai-workflow/standards/`
- código y tests relevantes para la tarea seleccionada
- `ai-workflow/features/NNNN-feature-name/notes.md` si existe

## Objetivo
Implementar las tareas planificadas de la feature en orden usando un flujo tests-first.

## Flujo de ejecución
1. Seleccionar la primera tarea pendiente de `tasks.md`.
2. Confirmar que la tarea es lo bastante clara como para ejecutarse sin reabrir la planificación de la feature.
3. Identificar el comportamiento requerido y los tests que deberían existir antes de la implementación o junto a ella.
4. Añadir o actualizar tests antes de la implementación cuando sea factible y útil.
5. Implementar el mínimo código necesario para satisfacer el comportamiento planificado.
6. Refactorizar solo si mejora la claridad o reduce duplicación real sin ampliar el alcance.
7. Ejecutar los tests relevantes.
8. Actualizar los archivos de documentación marcados como afectados en `tasks.md`.
9. Registrar notas de implementación útiles en `features/NNNN-feature-name/notes.md` solo si aportan valor para pasos posteriores.
10. Actualizar el estado de la tarea en `tasks.md` si el formato de la tarea lo permite.
11. Solo cuando la tarea actual esté terminada y validada, pasar a la siguiente tarea pendiente de `tasks.md`.
12. Repetir el ciclo hasta completar todas las tareas que entren en el alcance solicitado por el usuario o hasta encontrar un bloqueo que exija detenerse.

## Reglas de trabajo
- Implementar las tareas en el orden definido por `tasks.md`.
- No pasar a la siguiente tarea mientras la actual no esté implementada, verificada y documentada.
- Mantener los cambios alineados con el impacto previsto en archivos descrito en `tasks.md`.
- Respetar los límites arquitectónicos y las convenciones del proyecto.
- Actualizar solo la documentación realmente afectada por la tarea.
- No convertir `README.md` en un registro acumulativo de features, tareas o estado histórico.
- Si una tarea requiere reflejar capacidades vigentes, actualizar preferentemente `ai-workflow/docs/current-state.md`.
- Si una tarea requiere reflejar el mapa de features, actualizar preferentemente `ai-workflow/features/index.md`.
- Modificar `README.md` solo para mantener información de entrada breve, comandos y enlaces de navegación documental.
- Si la implementación revela una discrepancia válida con la spec, actualizar con cuidado la documentación relevante en lugar de desviarse en silencio.
- Preferir el cambio más pequeño que satisfaga el comportamiento planificado.
- La respuesta final debe incluir siempre una lista de checks con las tareas implementadas en esa pasada.
- La respuesta final debe incluir también una lista de checks con las tareas de la feature que siguen pendientes.
- Si no se implementó ninguna tarea por bloqueo o replanificación, la lista de checks de tareas implementadas debe indicarlo explícitamente.

## Nivel mínimo de tests-first
- Definir la verificación antes de dar la implementación por terminada.
- Empezar desde un test ausente o en fallo cuando sea práctico, pero no forzar unit tests artificiales si un integration test es el punto de entrada correcto.
- El estado final debe incluir tests en verde para el comportamiento implementado.
- Evitar escribir tests que solo reflejen detalles de implementación.

## Detente y señala un problema cuando
- la tarea esté insuficientemente especificada
- la tarea entre en conflicto con `spec.md`
- la tarea requiera un cambio arquitectónico más amplio de lo planificado
- el impacto documental requerido sea mayor de lo que asumía el plan
- la implementación revele que el siguiente paso seguro es replanificar en vez de seguir programando
- una tarea falle sus validaciones y no pueda cerrarse con seguridad antes de avanzar a la siguiente

## Terminado cuando
- cada tarea ejecutada en la pasada está implementada
- los tests relevantes de cada tarea ejecutada pasan
- la documentación afectada por cada tarea ejecutada está actualizada
- ninguna tarea posterior se ha empezado antes de cerrar correctamente la anterior
- las tareas ejecutadas quedan en un estado revisable y sin trabajo posterior oculto
- la respuesta final enumera en formato checklist las tareas implementadas en la pasada
- la respuesta final enumera en formato checklist las tareas pendientes de la feature
