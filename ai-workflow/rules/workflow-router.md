# Router del workflow de features

Decide qué skill toca y cuándo esperar al usuario. El detalle de artefactos, estados y gates está en `ai-workflow/rules/status-yaml.md`; el de ramas y commits en `ai-workflow/docs/vcs.md`.

Si cambia una fase, un gate humano, el orden entre fases o la skill responsable de una fase, actualizar esta rule.

## Skills del flujo

| Skill | Propósito | Cuándo usarla |
|-------|-----------|---------------|
| explore-feature-scope | Conversar antes de comprometer una spec | Alcance ambiguo, varias interpretaciones o dudas de producto |
| generate-feature-spec | Escribir `spec.md` y crear `status.yaml` y la rama | Idea clara y sin `spec.md`, o `artifacts.spec` distinto de `ready` |
| generate-feature-design | Escribir `design.md` | `artifacts.spec: ready`, `requires_design: true` y `artifacts.design` distinto de `ready` |
| plan-feature (agente) | Escribir `tasks.md`, lanzar review-plan y dejar `status.yaml` listo | `artifacts.spec: ready`, design `ready` o `not_required`, y `artifacts.tasks` distinto de `ready` |
| review-plan (agente) | Revisar `tasks.md` con contexto limpio | Lo lanza plan-feature; manual si el usuario pide un segundo pase o editó el plan a mano |
| implement-task-test-first | Un subagente por tarea, tests primero | `implementation.ready: true` y quedan tareas fuera de `completed_task_ids` |
| update-app-documentation | Actualizar `ai-workflow/docs/` y cerrar la feature | Sin tareas pendientes en alcance, `validation.tests_green: true` y `coverage_gate_passed: true`, `documentation.done: false` |

## Uso inmediato, sin que el usuario lo pida

1. Petición de feature o cambio de comportamiento sin `spec.md`: generate-feature-spec. Si el alcance no está claro, antes explore-feature-scope.
2. Petición de corrección de defecto: igual que una feature, con rama `fix/`. No parchear código fuera del flujo salvo que el usuario lo pida de forma explícita.
3. `status.yaml` con `phase: design` o `requires_design: true` sin design listo: generate-feature-design.
4. `status.yaml` con `phase: planning` y `tasks.md` ausente o no listo: lanzar el agente plan-feature con la ruta de la feature.
5. `status.yaml` con `implementation.ready: true` y tareas pendientes: implement-task-test-first.
6. Pasada de implementación cerrada con validación en verde: update-app-documentation.

## Encadenado

- Cuando una skill del flujo termina y su respuesta final nombra el siguiente paso, invócalo en el mismo turno o en el siguiente, sin preguntar.
- Antes de invocar cualquier skill, lee `status.yaml` de la feature activa y no repitas una fase cuyo artefacto ya esté en `ready`.
- La feature activa es la carpeta de `ai-workflow/features/` cuyo slug coincide con la rama `feature/<slug>` o `fix/<slug>`. Si no hay rama de feature, no hay feature activa y el primer paso es generate-feature-spec.
- Una feature con `blocked_by` no vacío no avanza. Explica el bloqueo y espera.
- Las fases conversacionales, exploración, spec y design, corren en el chat principal. Las demás corren fuera: planning y review en los agentes plan-feature y review-plan, lanzados con la ruta de la feature como único prompt; documentación en fork; implementación con un subagente por tarea. El chat principal guarda solo la conversación y los veredictos.

## Gates humanos

Son los únicos puntos donde se espera respuesta del usuario. Todo lo que hay entre ellos fluye sin parar.

1. **Aclaración de spec o design.** Las preguntas numeradas con sugerencia que hacen generate-feature-spec y generate-feature-design.
2. **Aprobación del plan.** Al cerrar generate-implementation-plan con el veredicto de review-implementation-plan, presentar el resumen de tareas y esperar confirmación antes de implement-task-test-first.

No pedir confirmación para crear la rama, commitear una tarea cerrada, ejecutar tests, ni abrir el Merge Request al cerrar la documentación: el flujo ya lo define así.

## Contrato de delegación

Aplica a cualquier subagente que lance el flujo, a cualquier profundidad.

- Tu mensaje final es el entregable. No termines un turno con subagentes en marcha: sus resultados se pierden.
- Si delegas, recoges. Espera el resultado, intégralo en `status.yaml` y sigue. Nada de lanzar y olvidar.
- Un subagente por tarea, en orden. No agrupar tareas ni reordenarlas.
- El prompt de un subagente lleva solo su bloque y las rutas que necesita, nunca el transcript del chat.

## Compactación

- Ejecuta `/compact` al cerrar la spec, al cerrar el plan aprobado y al cerrar la pasada de implementación. El estado ya está en `status.yaml` y en git.
- No compactes en mitad de una tarea ni durante un bloqueo sin resolver.
- Tras compactar, relee `status.yaml` antes de actuar. Lo que diga el resumen de compactación es histórico, no una orden.
