---
name: generate-feature-design
description: Genera el design técnico de una feature de este proyecto cuando la spec ya está cerrada pero todavía hace falta decidir trade-offs técnicos, arquitectura o estrategia de cambio antes de planificar. Úsala para escribir `features/NNNN-feature-name/design.md` y dejar la feature lista para `generate-implementation-plan`.
model: sonnet
allowed-tools: Read, Write, Edit
---

# Generar design de feature

Usa esta skill cuando la spec esté lista pero la feature todavía requiera decisiones técnicas explícitas antes de planificar.

Esta skill debe comportarse como una fase intermedia entre spec y planning: cerrar decisiones de arquitectura, estrategia de cambio, trade-offs y riesgos técnicos relevantes, sin trocear todavía el trabajo en tareas implementables.

La calidad del design debe ser suficiente para que la skill de planificación posterior pueda trocear el trabajo sin reabrir decisiones de arquitectura.

## Cuándo activarse
Esta skill aplica cuando:
- `spec.md` existe y está lista
- `status.yaml` marca `requires_design: true`
- `status.yaml.artifacts.design` no es `ready`

Si `requires_design` es `false` o `artifacts.design` ya es `ready`, esta skill no debería invocarse y se debe pasar directamente a `generate-implementation-plan`.

## Leer siempre
- `ai-workflow/docs/workflow.md`
- `ai-workflow/features/NNNN-feature-name/spec.md`
- `ai-workflow/features/NNNN-feature-name/status.yaml`
- `ai-workflow/features/NNNN-feature-name/design.md` si ya existe
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/conventions.md`
- `ai-workflow/docs/app-features/index.md`
- solo las fichas de `ai-workflow/docs/app-features/` que el índice marque como relevantes para la feature (típicamente 1-3, rara vez más de 5)
- `ai-workflow/templates/design.md`

## Leer si aplica
- `ai-workflow/docs/current-state.md` si hace falta confirmar el estado vigente o un límite actual.
- `ai-workflow/standards/` según el tipo de riesgo a evaluar: React, errores, seguridad u otras reglas de calidad afectadas.
- `ai-workflow/features/index.md` si hace falta coordinación con otras features o contexto histórico.
- Código o tests actuales sólo si la spec o un `design.md` previo referencian explícitamente un símbolo o módulo concreto cuyo comportamiento actual no está descrito en `architecture.md` ni en `context.md`. Máximo 1 fichero por decisión técnica; justificar la lectura antes de abrirla.

## Objetivo
Escribir o refinar `features/NNNN-feature-name/design.md` usando `ai-workflow/templates/design.md` como punto de partida.

No trocear todavía la feature en tareas; ver "Restricciones" para el resto de límites de esta fase.

## Qué debe incluir `design.md`
Como mínimo, siguiendo el template del proyecto:
- contexto técnico relevante
- objetivos y no objetivos del diseño
- decisiones técnicas concretas y por qué
- riesgos y trade-offs
- migración o despliegue cuando aplique
- preguntas abiertas que no deban resolverse en silencio

Cada decisión debe quedar explícita y revisable:
- describir la opción elegida
- explicar brevemente por qué frente a alternativas razonables
- señalar el coste o trade-off asumido
- identificar el riesgo residual si lo hay

## Fase opcional de aclaración
Antes de cerrar el design:
- revisar las preguntas abiertas de `spec.md` que tengan componente técnico
- revisar las preguntas abiertas de un `design.md` previo si existe
- identificar solo las decisiones técnicas que bloquean planificación segura
- formular al usuario el número mínimo de preguntas necesarias

Cada pregunta debe:
- ir numerada
- describir la duda técnica de forma concreta y breve
- incluir una sugerencia explícita con la mejor opción técnica según el contexto del proyecto
- pedir confirmación o corrección de esa sugerencia

Formato esperado de las preguntas:

```md
1. ¿[pregunta técnica concreta]?
   Sugerencia: [mejor opción propuesta y por qué en una frase].
```

Si no quedan decisiones técnicas bloqueantes, no hagas preguntas y genera el design directamente.

## Reglas de trabajo
- Tratar la spec como contrato funcional cerrado. No reabrir alcance ni comportamiento.
- Limitar el design a decisiones técnicas: arquitectura, estrategia de cambio, integración con runtime existente, partición de capas, compatibilidad y migración.
- Reflejar los límites arquitectónicos de `architecture.md` y las convenciones de `conventions.md`.
- Si una decisión técnica entra en conflicto con `architecture.md` o `conventions.md`, señalarlo explícitamente en lugar de resolver en silencio.
- No trocear el trabajo en tareas; ese paso pertenece a `generate-implementation-plan`.
- No listar archivos a tocar al nivel de detalle de un plan; basta con señalar las áreas o capas afectadas.
- Resolver por cuenta propia solo decisiones técnicas menores que no condicionen la planificación.
- Cuando varias estrategias razonables compitan, mencionar la alternativa descartada brevemente para que la decisión sea revisable.
- Tratar preguntas abiertas residuales como excepcionales: solo riesgos reales o dependencias externas no resolubles ahora.
- Tras cerrar el design, actualizar `status.yaml` para reflejar:
  - `phase: planning`
  - `artifacts.design: ready`
  - `requires_design: true` se mantiene
  - `risk_level` ajustado si el design lo modifica
  - `blocked_by` actualizado si el design destapó dependencias bloqueantes
- Indicar explícitamente en la respuesta final que el siguiente paso es `generate-implementation-plan`.

## Restricciones
- No escribir código.
- No escribir `tasks.md`.
- No modificar `spec.md` salvo para reflejar una preguntas abierta que el design resolvió.
- No convertir el design en una repetición de la spec.
- No dejar decisiones implícitas dentro de prosa larga; cada decisión debe quedar identificable.
- No marcar `artifacts.design: ready` si quedan preguntas técnicas bloqueantes sin resolver.

## Terminado cuando
- `design.md` cubre contexto técnico, decisiones, trade-offs y riesgos relevantes
- las decisiones quedan explícitas y revisables sin reinterpretación
- las preguntas abiertas finales son solo riesgos residuales o dependencias externas
- `status.yaml` refleja `artifacts.design: ready` y `phase: planning`
- el siguiente paso del flujo queda explícito como `generate-implementation-plan`
- la planificación posterior puede trocear el trabajo sin reabrir decisiones técnicas
