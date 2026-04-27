---
name: explore-feature-scope
description: Explora una petición antes de escribir la spec cuando todavía hay ambigüedad funcional o técnica. Úsala para producir `discovery.md`, fijar preguntas abiertas y decidir si la feature ya está lista para pasar a `spec.md`.
preferred_profile: cheap
profile_rationale: Fase de exploración y reducción de ambigüedad; debe favorecer claridad con bajo coste antes de comprometer una spec.
---

# Explorar alcance de feature

Usa esta skill cuando una petición todavía no esté lista para convertirse directamente en `spec.md`.

Esta skill debe comportarse como una fase de discovery previa a la spec: aclarar el problema, detectar ambigüedades, revisar el contexto mínimo necesario y dejar un artefacto corto que permita decidir si ya conviene escribir la spec o si siguen faltando decisiones.

## Leer primero
- `ai-workflow/docs/workflow.md`
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/app-features/index.md`
- solo las fichas de `ai-workflow/docs/app-features/` relevantes para la petición
- `ai-workflow/docs/current-state.md` si existe
- `ai-workflow/docs/architecture.md` solo si hay dudas técnicas que condicionen producto
- `ai-workflow/features/index.md` si existe
- `ai-workflow/features/NNNN-feature-name/discovery.md` si existe
- `ai-workflow/features/NNNN-feature-name/status.yaml` si existe

## Objetivo
Escribir o refinar:
- `ai-workflow/features/NNNN-feature-name/discovery.md`
- `ai-workflow/features/NNNN-feature-name/status.yaml`

No escribir todavía `spec.md` salvo que el usuario pida explícitamente pasar ya a esa fase o la exploración concluya con ambigüedad suficientemente resuelta.

## Qué debe incluir `discovery.md`
- problema a resolver
- contexto funcional relevante
- supuestos actuales
- preguntas abiertas
- riesgos detectados
- documentos o áreas de código a revisar después si hacen falta
- recomendación final:
  - lista para `spec.md`
  - necesita más definición
  - requiere decisión de producto

## Reglas de trabajo
- Explorar sin convertir esta fase en planificación técnica detallada.
- No generar todavía `tasks.md` ni `test-plan.md`.
- No esconder preguntas abiertas detrás de decisiones silenciosas.
- Mantener `discovery.md` corto, útil y accionable.
- Si no existe `status.yaml`, crearla usando `ai-workflow/templates/status.yaml`.
- Actualizar `status.yaml` para reflejar:
  - `phase: discovery`
  - `artifacts.discovery: ready` cuando el documento quede útil
  - `feature_status: drafting` mientras no exista una spec cerrada
  - `risk_level`
  - `requires_design` solo si ya es visible que la complejidad técnica será relevante
  - `blocked_by` con preguntas o decisiones que bloqueen la spec si aplica

## Terminado cuando
- `discovery.md` deja claro qué se sabe y qué no
- existe una recomendación explícita sobre si pasar o no a `spec.md`
- `status.yaml` refleja el estado real de discovery
- la siguiente fase probable queda clara
