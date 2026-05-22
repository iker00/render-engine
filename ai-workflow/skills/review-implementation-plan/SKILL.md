---
name: review-implementation-plan
description: Revisa críticamente un plan de implementación antes de codificar. Úsala para validar que `tasks.md`, `test-plan.md`, `status.yaml` y `design.md` cuando aplique formen un contrato de ejecución claro, secuencial y sin ambigüedad peligrosa.
preferred_profile: heavy
profile_rationale: Fase de control de calidad del plan; debe detectar ambigüedad, huecos y riesgos antes de abrir código.
---

# Revisar plan de implementación

Usa esta skill cuando ya exista una spec y un plan preliminar, pero quieras comprobar si el contrato de ejecución está lo bastante cerrado como para implementar sin reinterpretaciones peligrosas.

## Leer siempre
- `ai-workflow/docs/workflow.md`
- `ai-workflow/features/NNNN-feature-name/spec.md`
- `ai-workflow/features/NNNN-feature-name/tasks.md`
- `ai-workflow/features/NNNN-feature-name/test-plan.md`
- `ai-workflow/features/NNNN-feature-name/status.yaml`
- `ai-workflow/features/NNNN-feature-name/design.md` si existe o si `status.yaml` marca `requires_design: true`
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/app-features/index.md`
- solo las fichas relevantes de `ai-workflow/docs/app-features/`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/conventions.md`
- `ai-workflow/standards/testing-rules.md`
- `ai-workflow/standards/coding-style.md`

## Leer si aplica
- Otros documentos de `ai-workflow/standards/` según el tipo de riesgo que deba revisarse: React, errores, seguridad u otras reglas de calidad afectadas.
- `ai-workflow/docs/current-state.md` si hace falta confirmar estado vigente o límites actuales.
- `ai-workflow/features/index.md` si hace falta contexto histórico o coordinación con otras features.
- `ai-workflow/docs/index.md` solo como mapa documental auxiliar si no está claro qué contexto adicional seleccionar.

## Objetivo
Revisar si el plan está realmente listo para implementación y, si hace falta, refinar:
- `ai-workflow/features/NNNN-feature-name/tasks.md`
- `ai-workflow/features/NNNN-feature-name/test-plan.md`
- `ai-workflow/features/NNNN-feature-name/design.md`
- `ai-workflow/features/NNNN-feature-name/status.yaml`

No implementar código.

## Qué debe revisar
- ambigüedad funcional restante entre `spec.md` y `tasks.md`
- tareas demasiado grandes o mezcladas
- dependencias mal ordenadas
- impacto en archivos poco claro
- huecos de tests relevantes
- impacto documental no explicitado
- necesidad real de `design.md`
- gates de implementación en `status.yaml`

## Reglas de trabajo
- Priorizar detectar riesgos y ambigüedad antes que “aprobar” el plan rápido.
- Si una tarea admite dos interpretaciones funcionalmente distintas, pedir refino.
- Si una tarea es demasiado grande para un cambio seguro, dividirla.
- Si el riesgo o la complejidad justifican `design.md`, exigirla y marcar `requires_design: true` en `status.yaml`.
- Si el plan ya es suficientemente bueno, dejarlo explícito y marcar en `status.yaml` que la implementación está habilitada.
- Actualizar `status.yaml` al terminar para reflejar:
  - `phase: planning`
  - `blocked_by` si existen huecos reales
  - `implementation.ready: true | false`
  - `feature_status: planned` solo si el plan queda listo

## Terminado cuando
- queda claro si la feature está lista o no para implementación
- `tasks.md` y `test-plan.md` quedan refinados si hacía falta
- `design.md` queda exigida o descartada con criterio explícito
- `status.yaml` refleja el resultado real de la revisión
