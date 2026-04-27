---
model: claude-haiku-4-5-20251001
description: Genera o refina la spec funcional de una feature antes de planificar la implementación
effort: low
allowed-tools: Read, Glob, Grep, Write, Edit
---
Genera o refina la spec funcional de una feature de este proyecto antes de la planificación de implementación. Úsala para solicitudes de escritura de `features/NNNN-feature-name/spec.md` a partir de los documentos de contexto del proyecto, manteniendo el resultado alineado, revisable e intencionadamente no técnico.

# Generar spec de feature

Usa esta skill cuando la tarea sea definir una feature antes de planificar su implementación.

Esta skill debe comportarse como la fase de alineamiento de un flujo guiado por specs: acordar qué se va a construir antes de planificar cambios de código.

## Leer primero
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/conventions.md`
- `ai-workflow/docs/current-state.md` si existe
- `ai-workflow/features/index.md` si existe
- el archivo objetivo `features/NNNN-feature-name/spec.md` si ya existe

## Objetivo
Escribir o refinar `features/NNNN-feature-name/spec.md` como una especificación funcional.

El resultado debe mantenerse en el nivel de producto y comportamiento. No conviertas todavía la spec en tareas de implementación.

## Estructura de la spec
La spec debe contener:
- objetivo
- alcance
- fuera de alcance
- requisitos funcionales
- requisitos no funcionales
- criterios de aceptación
- casos límite
- riesgos o preguntas abiertas

También puede incluir, cuando sea útil:
- áreas de producto afectadas a alto nivel
- documentación probablemente afectada a alto nivel

Estos son solo apoyos para el alineamiento. No son tareas de implementación.

## Reglas de trabajo
- Basar la spec en el contexto existente del proyecto, no en suposiciones genéricas.
- Mantener la terminología consistente con `context.md`.
- Tratar `README.md` como documento corto e informativo; no usarlo como histórico acumulado del proyecto.
- Si la petición del usuario implica un alcance más simple que un motor completo de reglas, preservar esa simplificación de forma explícita.
- Señalar las decisiones ambiguas de producto como preguntas abiertas en vez de decidirlas en silencio.
- Evitar desgloses de tareas, listas de archivos o pasos técnicos de implementación.
- Preferir comportamiento concreto y revisable frente a descripciones vagas de la feature.
- Si la petición entra en conflicto con restricciones existentes del proyecto, reflejar el conflicto con claridad en la spec.
- Si la spec necesita referenciar estado vigente o histórico reciente, preferir `ai-workflow/docs/current-state.md` y `ai-workflow/features/index.md` antes que ampliar `README.md`.

## Nivel de calidad esperado
- La spec debe ser lo bastante concreta como para planificar la implementación.
- Los criterios de aceptación deben poder comprobarse con tests.
- Los elementos fuera de alcance deben evitar ampliaciones accidentales del alcance.
- Las preguntas abiertas deben ser lo bastante explícitas como para que el paso de planificación pueda resolverlas o detenerse con seguridad.

## Terminado cuando
- `spec.md` está actualizada
- la intención de la feature queda clara
- la planificación técnica se deja intencionadamente para el siguiente paso
- la spec es revisable sin necesitar detalles de código
