---
name: generate-implementation-plan
description: Genera el plan técnico de implementación para una feature de este proyecto una vez exista la spec funcional. Úsala para solicitudes de escritura de `tasks.md` y `test-plan.md`, incluyendo el impacto en código, tests y documentación de cada tarea.
preferred_profile: heavy
profile_rationale: La planificación debe cerrar partición, dependencias, validación e impacto con suficiente rigor para que distintos agentes implementen resultados funcionalmente equivalentes sin reinterpretar el alcance.
---

# Generar plan de implementación

Usa esta skill cuando la tarea sea convertir una spec de feature revisada en trabajo implementable.

Esta skill debe comportarse como la fase de planificación de un flujo guiado por specs: dividir una feature acordada en tareas atómicas, seguras y revisables antes de que empiece la implementación, dejando `tasks.md` como contrato de ejecución para la skill posterior.

La calidad del plan debe ser suficientemente alta como para que dos agentes competentes distintos interpreten lo mismo y produzcan un resultado funcionalmente equivalente, aunque el código final no sea idéntico línea por línea.

## Leer primero
- `ai-workflow/docs/workflow.md`
- `ai-workflow/features/NNNN-feature-name/spec.md`
- `ai-workflow/features/NNNN-feature-name/status.yaml`
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/app-features/index.md`
- solo los documentos de `ai-workflow/docs/app-features/` que el índice marque como relevantes para la feature
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/conventions.md`
- `ai-workflow/docs/current-state.md` si existe
- `ai-workflow/features/index.md` si existe
- todos los archivos de `ai-workflow/standards/`
- todos los archivos relevantes de `ai-workflow/examples/` si existen ejemplos reales
- `ai-workflow/features/NNNN-feature-name/design.md` si existe
- `ai-workflow/features/NNNN-feature-name/tasks.md` existente
- `ai-workflow/features/NNNN-feature-name/test-plan.md` existente

## Objetivo
Escribir o refinar:
- `features/NNNN-feature-name/tasks.md`
- `features/NNNN-feature-name/test-plan.md`

Y, cuando aplique por riesgo o complejidad, escribir o refinar:
- `features/NNNN-feature-name/design.md`

No implementar código en este paso.

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
- Si el riesgo o la complejidad justifican `design.md`, marcar `requires_design: true` en `status.yaml` y producir ese artefacto en esta fase.
- Si `requires_design: true` ya estaba marcado y `design.md` falta, no dejar la fase de planificación como cerrada.
- Si `design.md` no aplica, dejar `artifacts.design: not_required` en `status.yaml`.
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
