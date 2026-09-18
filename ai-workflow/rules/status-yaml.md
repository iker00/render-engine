---
paths:
  - "ai-workflow/features/**/status.yaml"
---
# Reglas de `status.yaml`

`status.yaml` es la fuente de verdad mínima para coordinar fases, skills y agentes sobre una feature.

## Valores permitidos

| Campo | Valores |
|-------|---------|
| `phase` | `spec`, `design`, `planning`, `implementation`, `documentation`, `complete`, `blocked` |
| `risk_level` | `low`, `medium`, `high` |
| `requires_design` | `true`, `false` |
| `plan_tier` | `trivial`, `standard` |
| `blocked_by` | lista de bloqueos reales; `[]` si no hay |
| `artifacts.spec`, `artifacts.design`, `artifacts.tasks`, `artifacts.notes` | `missing`, `draft`, `ready`, `optional`, `not_required` |
| `implementation.ready` | `true` solo si se cumplen todos los gates de entrada a implementación |
| `implementation.completed_task_ids` | IDs de tareas cerradas, en orden |
| `implementation.in_progress_task_id` | ID de la tarea en curso o `null` |
| `implementation.review_revisions` | veces que `review-task` ha revisado la tarea en curso; se resetea a `0` al empezar cada tarea |
| `validation.tests_green`, `validation.coverage_gate_passed` | `true`, `false` |
| `documentation.ready`, `documentation.done` | `true`, `false` |
| `feature_status` | `drafting`, `planned`, `implementing`, `implemented`, `documented`, `completed`, `blocked` |

Features históricas pueden conservar `artifacts.discovery` y `phase: discovery`. NO migrarlas salvo que se reabran.

## Artefactos que describe

Cada feature vive en `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/`. `artifacts.*` refleja el estado de estos ficheros:

| Artefacto | Qué es | Quién lo escribe | Obligatorio |
|-----------|--------|------------------|-------------|
| `spec.md` | contrato funcional de producto y comportamiento | `generate-feature-spec` | SIEMPRE, antes de planificar o implementar |
| `design.md` | decisiones técnicas, trade-offs y riesgos | SOLO `generate-feature-design`, nunca la skill de spec ni la de planning | solo si `requires_design: true` |
| `tasks.md` | contrato secuencial de ejecución con el contrato de tests por tarea | `generate-implementation-plan` | SIEMPRE, antes de implementar |
| `status.yaml` | este fichero | la skill de la fase activa | desde la primera spec cerrada |
| `notes.md` | notas puntuales de implementación o seguimiento | quien las necesite | NUNCA obligatoria; NO usarla como cajón de sastre |
| `discovery.md` | legacy: notas de exploración de features antiguas | nadie; la exploración actual es conversacional y no produce artefacto | no |

## `requires_design` y `risk_level`

`requires_design: true` cuando la feature tenga al menos una de estas señales:

- cambio transversal entre varios módulos o capas
- decisión arquitectónica no trivial
- migración de datos o de contratos
- riesgo medio o alto que merezca decisiones explícitas antes de programar
- varias estrategias técnicas razonables que puedan llevar a implementaciones divergentes

Si no se cumple ninguna, `spec.md` y `tasks.md` bastan. NO crear `design.md` por reflejo; solo cuando reduzca ambigüedad o riesgo real.

`plan_tier: trivial` cuando la feature se resuelve en una única tarea obvia, sin coordinación de interfaces entre tareas y sin ambigüedad de alcance. `requires_design: true` y `plan_tier: trivial` son incompatibles: si hace falta design, por definición no es trivial. Por defecto, `plan_tier: standard`.

En trivial, la planificación no lanza una revisión con contexto limpio: quien escribe la única tarea es responsable de que esté bien antes de marcarla lista. Es un cambio deliberado de velocidad por segunda opinión, no un descuido.

| `risk_level` | Significa |
|--------------|-----------|
| `low` | cambios acotados, sin decisiones transversales y con impacto claro |
| `medium` | varias capas afectadas, regresiones posibles o necesidad de alinear contratos |
| `high` | cambios estructurales delicados, refactors complejos, cambios de arquitectura, impacto amplio en producto o validación costosa |

El riesgo influye en si hace falta `design.md`, en la profundidad del plan y en el nivel de revisión del plan antes de implementar.

## Quién lo escribe

- Es OBLIGATORIO desde que se cierra la primera versión de `spec.md`. Si no existe, crearlo desde `ai-workflow/templates/status.yaml`.
- Lo escribe SOLO la skill de la fase activa. Durante la implementación, lo escribe ÚNICAMENTE el orquestador, con dos excepciones: `validation.tests_green` y `validation.coverage_gate_passed`, que escribe el hook determinista de cierre de `implement-feature` tras ejecutar la suite completa, y `review_revisions`, que incrementa el hook de cierre de `review-task` cada vez que termina una revisión. Ni el subagente de tarea ni `review-task` tocan `status.yaml` de ninguna otra forma.
- NUNCA marcar `implementation.ready: true` si falta algún artefacto requerido, hay bloqueos en `blocked_by` o alguna tarea de `tasks.md` no tiene su sub-bloque `tests`.

Justificación: si dos agentes escriben el mismo estado, ninguno puede fiarse de él.

## Transiciones entre fases

| De | A | Requiere |
|----|---|----------|
| exploración | `spec` | el problema está claro y las preguntas abiertas no impiden fijar comportamiento |
| `spec` | `design` | `artifacts.spec: ready`, `requires_design: true`, `artifacts.design` distinto de `ready` |
| `spec` | `planning` | `artifacts.spec: ready` y `requires_design: false` o `artifacts.design: not_required` |
| `design` | `planning` | `artifacts.design: ready` y los requisitos de spec a planning |
| `planning` | `implementation` | `artifacts.spec: ready`, `artifacts.tasks: ready`, design `ready` si `requires_design: true`, `blocked_by: []`, cada tarea con sub-bloque `tests` |
| `implementation` | `documentation` | sin tareas pendientes en alcance, `in_progress_task_id: null`, `validation.tests_green: true`, `validation.coverage_gate_passed: true` |
| `documentation` | `complete` | documentación afectada actualizada, `documentation.done: true`, `feature_status: completed` |

El cierre definitivo puede ocurrir dentro de la pasada documental. NO hace falta una fase adicional.

## Qué fija cada fase

| Fase | Campos que deja escritos |
|------|--------------------------|
| spec cerrada | `artifacts.spec: ready`; `requires_design` decidido; `artifacts.design: not_required` o `missing`; `risk_level` razonado; `phase: spec`, `design` o `planning` según `requires_design`; `feature_status: drafting` o `planned` |
| design cerrado | `artifacts.design: ready`; `requires_design: true` se mantiene; `phase: planning`; `risk_level` y `blocked_by` ajustados si el design los cambió. NO marcar `ready` con preguntas técnicas bloqueantes sin resolver |
| plan cerrado | `artifacts.tasks: ready`; `artifacts.design: ready` o `not_required`; `phase: planning` o `implementation`; `implementation.ready` según el veredicto de la revisión; `feature_status: planned` solo si el contrato es usable |
| plan revisado | `phase: planning`; `blocked_by` con los huecos reales; `implementation.ready: true` o `false`; `feature_status: planned` solo si el plan queda listo |
| design descubierto tarde | `requires_design: true`, `artifacts.design: missing`, `implementation.ready: false`; detener y redirigir a `generate-feature-design` |
| documentación cerrada | `documentation.ready: true`; `documentation.done: true`; `phase: complete`; `feature_status: completed` si no queda trabajo en alcance |

## Reglas de la pasada de implementación

1. Al empezar la pasada, resetear `validation.tests_green: false` y `validation.coverage_gate_passed: false`.
2. Antes de lanzar el subagente, `implementation.in_progress_task_id: <ID>` y `review_revisions: 0`.
3. Tarea `completed` del implementador: antes de comitear, lanzar `review-task`. `aprobado` → seguir en 4. `requiere correcciones` con `review_revisions` por debajo de 2 tras el incremento del hook de cierre de `review-task` → retomar el mismo subagente implementador con los hallazgos y volver a lanzar `review-task`. `requiere correcciones` con `review_revisions` ya en 2 → tratar como bloqueo, ir a 5.
4. Tarea aprobada por `review-task`: mover el ID a `completed_task_ids`, limpiar `in_progress_task_id` y commitear con la tarea.
5. Tarea `blocked` o `failed` del implementador, o revisión agotada sin aprobar: dejar el ID en `in_progress_task_id`, registrar el motivo en `blocked_by`, NO commitear y detener la pasada.
6. Al cerrar la pasada, el hook de cierre de `implement-feature` ejecuta la validación completa y fija `validation.*` con el resultado real; el orquestador no la ejecuta ni la escribe.

NUNCA reutilizar `validation.tests_green: true` o `coverage_gate_passed: true` de una pasada anterior. Un `true` heredado tras nuevos cambios es un estado falso.

## Mantenerlo corto

- NO duplicar en él el contenido de `tasks.md`; solo coordina estado global y punto actual.
- NO guardar el porcentaje de cobertura; solo el resultado del gate.
- NO sustituye a `tasks.md`.

## Checklist antes de cerrar una fase

- [ ] `phase` y `feature_status` coinciden con el estado real de los artefactos
- [ ] ningún `artifacts.*` está en `ready` sin que el fichero exista y esté cerrado
- [ ] `blocked_by` vacío o con bloqueos reales, no con dudas cosméticas
- [ ] `implementation.ready` respeta la fila de planning a implementación de la tabla de transiciones
- [ ] `validation.*` refleja la última pasada, no una anterior
