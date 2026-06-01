---
name: explore-feature-scope
description: Conversa sobre una posible feature antes de comprometer una spec. Úsala para explorar el problema, validar ideas, comparar alternativas o reducir ambigüedad funcional o técnica. Esta skill no genera artefactos: solo dialoga y deja la decisión final al usuario.
model: haiku
---

# Explorar alcance de feature

Usa esta skill cuando una petición todavía no esté lista para escribir `spec.md` y haga falta dialogar antes de comprometer nada.

Esta skill debe comportarse como una conversación de discovery: aclarar el problema, detectar ambigüedades, revisar el contexto mínimo necesario y ayudar al usuario a decidir si la feature ya está suficientemente acotada como para invocar `generate-feature-spec`.

Esta skill no produce artefactos. No crea ni modifica ficheros en `ai-workflow/features/NNNN-feature-name/`. No toca `status.yaml`. No genera `discovery.md`. Su única salida es la conversación con el usuario.

## Leer siempre
- `ai-workflow/docs/workflow.md`
- `ai-workflow/docs/context.md`

## Leer si aplica
- `ai-workflow/docs/app-features/index.md` y solo las fichas relevantes si la conversación afecta comportamiento de producto, contrato JSON, runtime visible, formularios, queries, navegación o modo de desarrollo local.
- `ai-workflow/docs/current-state.md` si hace falta confirmar si una capacidad ya existe o si sigue fuera de alcance.
- `ai-workflow/docs/architecture.md` si hay dudas técnicas que condicionen el alcance de producto.
- `ai-workflow/features/index.md` si hace falta contexto histórico o coordinación con features planificadas, archivadas o completadas.
- `ai-workflow/docs/index.md` solo como mapa documental auxiliar si no está claro qué contexto adicional seleccionar.

## Objetivo
Sostener un diálogo útil con el usuario para:
- aclarar qué problema se quiere resolver
- detectar ambigüedades de alcance o de comportamiento
- proponer alternativas razonables cuando existan
- estimar si la feature ya tiene el detalle suficiente para una spec
- recomendar el siguiente paso al final de la conversación

Al cerrar la conversación, la skill debe terminar con una recomendación explícita:
- "lista para `generate-feature-spec`" cuando la idea esté suficientemente acotada
- "necesita más definición" cuando todavía haya decisiones de producto pendientes
- "requiere decisión externa" cuando dependa de algo fuera del alcance del proyecto

## Reglas de trabajo
- No crear ni modificar ficheros bajo `ai-workflow/features/`.
- No tocar `status.yaml`.
- No escribir `discovery.md`, `spec.md`, `design.md` ni `tasks.md`.
- No proponer cambios de código durante esta fase.
- No reservar todavía un identificador `NNNN-feature-name`; eso lo hace `generate-feature-spec` cuando el usuario decida pasar a esa fase.
- Hacer preguntas concretas cuando detectes ambigüedad funcional bloqueante; siempre con una sugerencia explícita acompañando cada pregunta.
- Cuando varias alternativas razonables existan, presentar las opciones brevemente con sus trade-offs y dejar la decisión al usuario.
- Mantener el diálogo breve y accionable; evitar análisis exhaustivos sin valor para la decisión.
- Si la conversación deriva hacia decisiones de implementación, redirigirla hacia el comportamiento esperado y dejar la parte técnica para `generate-feature-design` o `generate-implementation-plan` más adelante.
- Si la idea ya está clara desde el inicio, recomendar directamente pasar a `generate-feature-spec` sin alargar la conversación.

## Terminado cuando
- la conversación deja claro qué se sabe y qué no
- existe una recomendación explícita sobre el siguiente paso del workflow
- no se ha creado ni modificado ningún artefacto del proyecto
- el usuario tiene los elementos suficientes para decidir si invocar `generate-feature-spec` o seguir explorando
