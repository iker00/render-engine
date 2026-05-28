---
name: generate-implementation-plan
description: Genera el plan técnico de implementación para una feature de este proyecto una vez exista la spec funcional. Úsala para solicitudes de escritura de `tasks.md` y `test-plan.md`, incluyendo el impacto en código, tests y documentación de cada tarea.
model: opus
---

# Generar plan de implementación

Usa esta skill cuando la tarea sea convertir una spec de feature revisada en trabajo implementable.

Esta skill debe comportarse como la fase de planificación de un flujo guiado por specs: dividir una feature acordada en tareas atómicas, seguras y revisables antes de que empiece la implementación, dejando `tasks.md` como contrato de ejecución para la skill posterior.

La calidad del plan debe ser suficientemente alta como para que dos agentes competentes distintos interpreten lo mismo y produzcan un resultado funcionalmente equivalente, aunque el código final no sea idéntico línea por línea.

## Leer siempre
- `ai-workflow/docs/workflow.md`
- `ai-workflow/features/NNNN-feature-name/spec.md`
- `ai-workflow/features/NNNN-feature-name/status.yaml`
- `ai-workflow/features/NNNN-feature-name/design.md` si existe o si `status.yaml` marca `requires_design: true`
- `ai-workflow/features/NNNN-feature-name/tasks.md` si existe
- `ai-workflow/features/NNNN-feature-name/test-plan.md` si existe
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/app-features/index.md`
- solo las fichas de `ai-workflow/docs/app-features/` que el índice marque como relevantes para la feature
- `ai-workflow/standards/testing-rules.md`
- `ai-workflow/standards/coding-style.md`

## Leer si aplica
- `ai-workflow/docs/architecture.md` si la feature cruza fronteras de capa, modifica responsabilidades arquitectónicas o introduce puntos de extensión nuevos.
- `ai-workflow/docs/conventions.md` si la feature toca naming, estructura de carpetas, estilos, errores, logs o convenciones de documentación.
- `ai-workflow/docs/current-state.md` si hace falta confirmar el estado vigente o un límite actual.
- Otros documentos de `ai-workflow/standards/` según el tipo de cambio: React, errores, seguridad u otras reglas de calidad afectadas.
- `ai-workflow/features/index.md` si hace falta contexto histórico o coordinación con otras features.
- Archivos relevantes de `ai-workflow/examples/` si existen ejemplos reales aplicables.
- `ai-workflow/docs/index.md` solo como mapa documental auxiliar si no está claro qué contexto adicional seleccionar.

## Objetivo
Escribir o refinar:
- `features/NNNN-feature-name/tasks.md`
- `features/NNNN-feature-name/test-plan.md`

No implementar código en este paso.

No escribir `design.md` desde esta skill. Si `status.yaml` marca `requires_design: true` y `artifacts.design` aún no es `ready`, detenerse y redirigir al usuario a `generate-feature-design`. La creación o refino de `design.md` corresponde a esa skill, no a esta.

## Gate de entrada
Antes de planificar, comprobar:
- `spec.md` lista y `artifacts.spec: ready`
- si `requires_design: true`, `design.md` listo y `artifacts.design: ready`
- sin bloqueos activos en `status.yaml`

Si el gate falla, detenerse y explicitar qué falta. Si lo bloqueante es el design, recomendar invocar `generate-feature-design` antes de volver a esta skill.

## Qué debe incluir `tasks.md`
Cada tarea debe incluir como mínimo, usando una estructura estable:
- ID
- estado
- objetivo
- fuera de alcance
- dependencias
- impacto esperado en archivos
- tests requeridos
- documentación afectada
- criterios de finalización
- cierre de implementación
- cierre documental

Los criterios de finalización deben separar dos estados explícitos:
- cierre de implementación: código y tests de la tarea completos y validados
- cierre documental: documentación afectada revisada y actualizada en una pasada posterior

Cada tarea debe quedar definida de forma contractual:
- debe describir una única unidad de avance
- debe dejar claro qué se hace en esta tarea y qué queda explícitamente fuera
- debe poder ejecutarse sin rediseñar la feature durante la implementación
- debe indicar el orden exacto en que debe abordarse respecto a las demás
- debe dejar claro qué artefactos o estados deberían existir al terminarla
- debe minimizar la ambigüedad para que distintos agentes interpreten el mismo trabajo y lleguen al mismo resultado funcional

En el bloque `Impacto esperado en archivos`, cada tarea debe identificar:
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
También debe dejar claro qué comando o conjunto de comandos debería ejecutar la skill de implementación para validar cada bloque relevante y qué umbral de cobertura del proyecto sigue aplicando al cierre de la pasada.

## Reglas de planificación
- Dividir el trabajo en tareas pequeñas, atómicas y secuenciales que puedan implementarse, probarse y revisarse con seguridad en un cambio acotado.
- Si una tarea es demasiado grande para un cambio seguro o admite más de una interpretación razonable, dividirla.
- Mantener las tareas ordenadas por dependencia.
- Escribir `tasks.md` como contrato de ejecución para la skill de implementación: la implementación debe poder seguirlo sin reinterpretar alcance, orden ni estrategia general.
- Redactar cada tarea de forma que minimice la varianza de ejecución entre agentes competentes.
- Favorecer definiciones que lleven a resultados funcionalmente equivalentes, no a interpretaciones abiertas del mismo objetivo.
- Evitar tareas que mezclen varios objetivos a la vez, por ejemplo dominio + UI + documentación global, salvo que sea imposible separarlos sin romper el flujo.
- Cada tarea debe tener un resultado observable y verificable por sí mismo.
- Cada tarea debe dejar claro si habilita una tarea posterior o si bloquea el resto hasta quedar cerrada.
- Cada tarea debe dejar claro cuándo se considera cerrada su implementación y cuándo se considera cerrado su estado documental.
- Reflejar los límites arquitectónicos de `architecture.md`.
- Reflejar los estándares de código, testing y manejo de errores definidos en `standards/`.
- Marcar explícitamente el impacto en documentación para cada tarea, aunque el resultado sea `ninguno`.
- Si una tarea no requiere documentación, dejar explícito que su cierre documental es `ninguno`.
- Tratar `README.md` como documento de entrada breve; evitar planificar cambios que lo conviertan en historial largo o changelog acumulativo.
- Cuando una tarea afecte al estado vigente o al mapa de features, preferir `ai-workflow/docs/current-state.md` y `ai-workflow/features/index.md` como destinos documentales.
- Si la feature cambia comportamiento funcional de producto, planificar la actualización de la ficha correspondiente en `ai-workflow/docs/app-features/` además del contexto global si hace falta.
- Preferir tareas que puedan completarse de principio a fin en una sola pasada de implementación.
- Dejar claro cuál es la siguiente tarea que debería escogerse.
- Respetar el gate de workflow: no dejar la feature lista para implementación si falta algún artefacto requerido por `status.yaml`.
- Si `status.yaml` no existe, crearlo usando `ai-workflow/templates/status.yaml`.
- Si durante la planificación se descubre que el riesgo o la complejidad técnica justifican un `design.md` que no existía, no escribirlo aquí: marcar `requires_design: true`, dejar `artifacts.design: missing`, detener la planificación y redirigir a `generate-feature-design`.
- Si `requires_design: true` ya estaba marcado y `design.md` no está listo, no avanzar la planificación.
- Si `design.md` no aplica, mantener `artifacts.design: not_required` en `status.yaml`.
- Actualizar `status.yaml` al terminar para reflejar:
  - `phase: planning` o `phase: implementation`
  - `artifacts.tasks: ready`
  - `artifacts.test_plan: ready`
  - `artifacts.design: ready | not_required`
  - `implementation.ready: true` solo si se cumplen todos los gates de entrada a implementación
  - `feature_status: planned` cuando el contrato de ejecución ya sea usable

## Restricciones
- No implementar código.
- No dejar implícito el impacto en archivos.
- No dejar tareas con estructura libre que omitan bloques contractuales esenciales.
- No crear tareas vagas como "build UI" o "wire backend" sin un alcance más estrecho.
- No escribir tareas que obliguen a la skill de implementación a decidir arquitectura, alcance o partición de trabajo sobre la marcha.
- No esconder trabajo importante detrás de frases como "ajustes necesarios", "integración final" o "remates".
- No dejar términos ambiguos que permitan dos interpretaciones funcionales distintas de la misma tarea.
- No ocultar incertidumbre arquitectónica dentro de una tarea. Señálala explícitamente si la spec no está lista.
- No crear ni refinar `design.md`. Si el plan requiere decisiones técnicas que aún no existen, devolver el control a `generate-feature-design`.

## Encadenado con review
Al cerrar la planificación con `artifacts.tasks: ready` y `artifacts.test_plan: ready`, lanzar automáticamente una revisión del plan usando un sub-agente con contexto limpio:

- usar la herramienta `Agent` con `subagent_type: general-purpose`
- el prompt del sub-agente debe replicar el contrato de `review-implementation-plan`, apuntando a la carpeta de la feature recién planificada
- el sub-agente debe leer los artefactos generados (`spec.md`, `tasks.md`, `test-plan.md`, `design.md` si aplica, `status.yaml`) y devolver un veredicto explícito: plan aprobado o refinamientos concretos requeridos
- el agente principal debe aplicar los refinamientos propuestos antes de cerrar la fase de planificación
- si el sub-agente no detecta problemas, marcar `implementation.ready: true` en `status.yaml`
- si el sub-agente detecta huecos bloqueantes, dejar `implementation.ready: false` y registrar los huecos en `blocked_by`

El usuario puede invocar `review-implementation-plan` manualmente si quiere un segundo pase tras refinamientos.

## Terminado cuando
- `tasks.md` es accionable tarea por tarea
- `tasks.md` funciona como contrato de ejecución y no como lista orientativa
- cada tarea sigue una estructura estable y fácil de revisar
- dos agentes competentes distintos podrían seguir el plan e implementar un resultado funcionalmente equivalente sin reinterpretar la feature
- `test-plan.md` cubre la verificación prevista
- `test-plan.md` deja claro qué tests relevantes deben ejecutarse durante la implementación y que el umbral de cobertura del proyecto sigue siendo un gate de cierre
- `design.md` existe cuando el riesgo o la complejidad lo piden
- `status.yaml` refleja correctamente si la feature está lista o no para implementación
- cada tarea identifica el impacto en código, tests y documentación
- cada tarea deja explícitos su cierre de implementación y su cierre documental
- el paso de implementación puede tomar una tarea y ejecutarla con seguridad sin replantear toda la feature
