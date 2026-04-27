---
model: claude-haiku-4-5-20251001
description: Genera tasks.md y test-plan.md a partir de la spec de una feature
effort: low
allowed-tools: Read, Glob, Grep, Write, Edit
argument-hint: "[NNNN]"
---
Genera el plan técnico de implementación para una feature de este proyecto una vez exista la spec funcional. Úsala para solicitudes de escritura de `tasks.md` y `test-plan.md`, incluyendo el impacto en código, tests y documentación de cada tarea.

# Generar plan de implementación

Usa esta skill cuando la tarea sea convertir una spec de feature revisada en trabajo implementable.

Esta skill debe comportarse como la fase de planificación de un flujo guiado por specs: dividir una feature acordada en tareas seguras y revisables antes de que empiece la implementación.

## Leer primero
- `ai-workflow/features/NNNN-feature-name/spec.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/conventions.md`
- `ai-workflow/docs/current-state.md` si existe
- `ai-workflow/features/index.md` si existe
- todos los archivos de `ai-workflow/standards/`
- todos los archivos relevantes de `ai-workflow/examples/` si existen ejemplos reales
- `ai-workflow/features/NNNN-feature-name/tasks.md` existente
- `ai-workflow/features/NNNN-feature-name/test-plan.md` existente

## Objetivo
Escribir o refinar:
- `features/NNNN-feature-name/tasks.md`
- `features/NNNN-feature-name/test-plan.md`

No implementar código en este paso.

## Qué debe incluir `tasks.md`
Cada tarea debe incluir como mínimo:
- objetivo
- dependencias
- tests requeridos
- documentación afectada
- criterios de finalización

Cada tarea también debe identificar el impacto esperado en archivos:
- archivos de código a crear o modificar
- archivos de tests a crear o modificar
- archivos de documentación a revisar o actualizar

Si la ruta exacta todavía no se conoce, sé lo más concreto posible sobre el módulo o área que cambiará.

## Qué debe incluir `test-plan.md`
- unit tests esperados
- integration tests esperados
- tests e2e si de verdad aplican
- qué comportamiento valida cada bloque de tests

El plan de tests debe hacer evidente el paso posterior de implementación con enfoque tests-first.

## Reglas de planificación
- Dividir el trabajo en tareas pequeñas que puedan implementarse, probarse y revisarse con seguridad en un cambio acotado.
- Si una tarea es demasiado grande para un cambio seguro, dividirla.
- Mantener las tareas ordenadas por dependencia.
- Reflejar los límites arquitectónicos de `architecture.md`.
- Reflejar los estándares de código, testing y manejo de errores definidos en `standards/`.
- Marcar explícitamente el impacto en documentación para cada tarea, aunque el resultado sea `ninguno`.
- Tratar `README.md` como documento de entrada breve; evitar planificar cambios que lo conviertan en historial largo o changelog acumulativo.
- Cuando una tarea afecte al estado vigente o al mapa de features, preferir `ai-workflow/docs/current-state.md` y `ai-workflow/features/index.md` como destinos documentales.
- Preferir tareas que puedan completarse de principio a fin en una sola pasada de implementación.
- Dejar claro cuál es la siguiente tarea que debería escogerse.

## Restricciones
- No implementar código.
- No dejar implícito el impacto en archivos.
- No crear tareas vagas como "build UI" o "wire backend" sin un alcance más estrecho.
- No ocultar incertidumbre arquitectónica dentro de una tarea. Señálala explícitamente si la spec no está lista.

## Terminado cuando
- `tasks.md` es accionable tarea por tarea
- `test-plan.md` cubre la verificación prevista
- cada tarea identifica el impacto en código, tests y documentación
- el paso de implementación puede tomar una tarea y ejecutarla con seguridad sin replantear toda la feature
