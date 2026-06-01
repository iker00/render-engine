---
name: update-app-documentation
description: Actualiza la documentación funcional y operativa del proyecto después de una implementación ya realizada. Úsala cuando el código y los tests relevantes ya estén cerrados y quieras reflejar el comportamiento estable en `ai-workflow/docs/` y en el índice de features.
model: haiku
---

# Actualizar documentación de la app

Usa esta skill cuando una implementación ya está hecha y validada, y ahora toca reflejar sus efectos en la documentación del proyecto.

Esta skill debe comportarse como una fase documental posterior al código: revisar qué cambió realmente, decidir qué documentos quedan afectados y actualizarlos sin reabrir la implementación.

## Leer siempre
- `ai-workflow/docs/workflow.md`
- `ai-workflow/features/NNNN-feature-name/spec.md`
- `ai-workflow/features/NNNN-feature-name/tasks.md`
- `ai-workflow/features/NNNN-feature-name/test-plan.md`
- `ai-workflow/features/NNNN-feature-name/status.yaml`
- `ai-workflow/features/NNNN-feature-name/notes.md` si existe
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/app-features/index.md`
- solo las fichas de `ai-workflow/docs/app-features/` que el índice marque como relevantes para la feature implementada
- `ai-workflow/docs/current-state.md` si existe
- `ai-workflow/features/index.md` si existe
- el código y los tests ya modificados por la implementación

## Leer si aplica
- `ai-workflow/docs/architecture.md` si la implementación consolidó una decisión arquitectónica estable.
- `ai-workflow/docs/conventions.md` si la implementación consolidó una convención repetible.
- `ai-workflow/docs/test-index.md` si la implementación añadió, movió o eliminó ficheros de test.
- `README.md` si hace falta ajustar información breve de entrada.
- `ai-workflow/docs/index.md` solo como mapa documental auxiliar si no está claro qué contexto adicional seleccionar.

## Objetivo
Actualizar la documentación para que describa el comportamiento estable realmente implementado, usando el índice de features como puerta de entrada y manteniendo el contexto corto.

Antes de empezar, comprobar el gate documental:
- la implementación relevante ya está cerrada
- no queda una tarea de código en curso dentro del alcance actual
- `status.yaml` no refleja bloqueos abiertos que invaliden el cierre documental

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
2. Cruzar ese cambio con la `spec.md`, `tasks.md` y el índice de features para detectar qué documentos son relevantes.
3. Actualizar primero la ficha o fichas funcionales afectadas en `ai-workflow/docs/app-features/`.
4. Ajustar `ai-workflow/docs/app-features/index.md` si cambió el inventario de features documentadas, el alcance de una ficha o su descripción corta.
5. Actualizar `current-state.md` si la capacidad ya forma parte del estado vigente del producto.
6. Actualizar `context.md`, `architecture.md` o `conventions.md` solo cuando el cambio sea suficientemente general o estable como para merecerlo.
7. Cerrar explícitamente el estado documental de la tarea según el contrato definido en `tasks.md`.
8. Dejar la documentación alineada con el comportamiento real sin convertir los documentos en un changelog.

## Reglas de trabajo
- No implementar código en esta skill.
- No reabrir decisiones de producto ya cerradas salvo que la implementación y la `spec` estén claramente en conflicto.
- No actualizar documentos "por si acaso"; tocar solo los realmente afectados.
- Mantener `context.md` breve y usar las fichas de `app-features/` para el detalle funcional.
- Mantener `app-features/index.md` como índice descriptivo y puerta de entrada para futuras skills.
- Si una feature nueva aparece como área funcional diferenciada, añadir su ficha al índice.
- Si una feature existente cambió de alcance, actualizar tanto su ficha como la descripción en el índice.
- Tratar el cierre documental como el segundo estado explícito de finalización de la tarea, posterior al cierre de implementación y tests.
- No convertir `README.md` en historial acumulado.
- Si el gate documental no se cumple, detenerse y explicar qué estado de `status.yaml` impide documentar.
- Al terminar, actualizar `status.yaml` como mínimo con:
  - `documentation.ready: true` cuando la implementación ya estaba lista para documentarse
  - `documentation.done: true` cuando la pasada documental queda cerrada
  - `phase: complete` cuando la feature quede cerrada en esta pasada documental
  - `feature_status: completed` cuando ya no quede trabajo pendiente dentro del alcance acordado

## Detente y señala un problema cuando
- el código implementado no deja claro cuál es el comportamiento final
- la implementación contradice de forma material a `spec.md`
- la documentación que debería cambiar es mucho mayor de lo esperado y parece indicar falta de replanificación
- falta contexto para decidir si una capacidad ya es estable o sigue siendo parcial

## Terminado cuando
- la documentación afectada refleja el comportamiento estable real
- el índice `ai-workflow/docs/app-features/index.md` sigue siendo una puerta de entrada fiable
- `current-state.md` y `context.md` solo se tocan cuando realmente corresponde
- `status.yaml` refleja el cierre documental real de la feature o del alcance tratado
- queda cerrado el estado documental explícito de la tarea
- la feature puede quedar marcada como `completed` directamente desde esta pasada si ya no queda trabajo pendiente
- no se han introducido cambios de código en esta pasada
