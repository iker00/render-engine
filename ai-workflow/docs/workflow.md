# Workflow guiado por specs

## Objetivo
Definir el flujo operativo estándar para trabajar una feature con IA en este repositorio, minimizando reinterpretaciones entre fases y permitiendo que varios agentes o sesiones distintas compartan el mismo estado de trabajo.

## Artefactos por feature
Cada feature vive en `ai-workflow/features/NNNN-feature-name/`.

Artefactos posibles:
- `spec.md`: contrato funcional de producto y comportamiento.
- `design.md`: documento técnico para features con complejidad o riesgo relevante.
- `tasks.md`: contrato secuencial de ejecución, incluye el contrato de tests por tarea.
- `status.yaml`: estado estructurado y mínimo del workflow.
- `notes.md`: notas puntuales de implementación o seguimiento, solo si aportan valor.

Artefactos legacy:
- `discovery.md`: usado en features antiguas como notas de exploración previa. En el flujo actual, la exploración previa se hace conversacionalmente vía `explore-feature-scope` sin generar artefacto. Las features históricas con `discovery.md` no necesitan migrarse retroactivamente.

## Cuándo usar cada artefacto

### Exploración previa
Cuando todavía no convenga comprometer una `spec.md`, usar la skill conversacional `explore-feature-scope`. Esta fase ya no produce un artefacto: el diálogo cierra cuando el alcance está claro y el usuario decide invocar `generate-feature-spec`.

Casos típicos donde aplica:
- alcance ambiguo
- varias interpretaciones razonables del problema
- dudas de producto que cambiarían la spec
- necesidad de leer código o documentación antes de fijar el contrato funcional

### `spec.md`
Es obligatoria antes de planificar o implementar.

Debe fijar:
- qué se quiere conseguir
- qué entra y qué queda fuera
- comportamiento esperado
- criterios de aceptación comprobables
- preguntas abiertas que no deban resolverse en silencio

### `design.md`
Es opcional, pero pasa a ser obligatoria cuando la feature tenga al menos una de estas señales:
- cambio transversal entre varios módulos o capas
- decisión arquitectónica no trivial
- migración de datos o de contratos
- riesgo medio/alto que merezca decisiones explícitas antes de programar
- varias estrategias técnicas razonables que puedan llevar a implementaciones divergentes

Si no se cumple ninguna, `spec.md + tasks.md` suelen bastar.

Cuando `design.md` aplica, se produce desde una skill dedicada (`generate-feature-design`) entre spec y planning. No se escribe desde `generate-feature-spec` ni desde `generate-implementation-plan`.

### `tasks.md`
Es obligatoria antes de implementar.

Debe funcionar como contrato de ejecución:
- orden explícito
- tareas pequeñas y verificables
- impacto esperado en código, tests y documentación
- criterios claros de finalización
- separación explícita entre cierre de implementación y cierre documental

Cada tarea debería mantener una estructura fija:
- identificador de tarea
- estado
- objetivo
- fuera de alcance
- dependencias
- impacto esperado en archivos
- tests (sub-bloque estable):
  - ficheros de test, cada uno anotado con su rol (`nuevo` o `ampliación`)
  - comportamiento cubierto, en bullets explícitos
  - comandos `pnpm test --run …` para iterar la tarea
  - restricciones específicas de la tarea (opcional)
- documentación afectada
- criterios de finalización
- cierre de implementación
- cierre documental

### `status.yaml`
Es obligatorio desde que una feature entra en planificación activa (al cerrar la primera versión de la spec).

Es la fuente de verdad mínima para coordinación entre fases y agentes. Debe mantenerse corto, estable y fácil de leer.

## Estado estructurado mínimo

Plantilla mínima recomendada:

```yaml
phase: spec
risk_level: medium
requires_design: false
blocked_by: []
artifacts:
  spec: missing
  design: not_required
  tasks: missing
  notes: optional
implementation:
  ready: false
  completed_task_ids: []
  in_progress_task_id: null
validation:
  tests_green: false
  coverage_gate_passed: false
documentation:
  ready: false
  done: false
feature_status: drafting
```

Valores orientativos:
- `phase`: `spec | design | planning | implementation | documentation | complete | blocked`
- `risk_level`: `low | medium | high`
- `artifacts.*`: `missing | draft | ready | optional | not_required`
- `feature_status`: `drafting | planned | implementing | implemented | documented | completed | blocked`

Features históricas pueden conservar `artifacts.discovery` y `phase: discovery`; no es necesario migrarlas.

## Gates entre fases

### Exploración → Spec
La exploración previa es conversacional y no produce artefacto. Se puede pasar a `spec` cuando:
- la conversación con `explore-feature-scope` deja claro el problema
- las preguntas abiertas restantes no impiden fijar comportamiento

### Spec → Design (condicional)
Se pasa a `design` cuando:
- `spec.md` existe y está lista
- `status.yaml` marca `requires_design: true`
- `artifacts.design` no está `ready`

### Spec → Planning (cuando design no aplica)
Se puede pasar directamente a `planning` cuando:
- `spec.md` existe y está lista
- `status.yaml` marca `artifacts.spec: ready`
- `requires_design: false` o `artifacts.design: not_required`

### Design → Planning
Se pasa a `planning` cuando:
- `design.md` existe y está listo
- `status.yaml` marca `artifacts.design: ready`
- el resto de gates de Spec → Planning siguen cumpliéndose

### Planning → Implementation
Se puede pasar a `implementation` solo cuando:
- `spec.md` existe y está lista
- `tasks.md` existe y está listo
- si `requires_design: true`, `design.md` existe y está listo
- no hay bloqueos abiertos en `blocked_by`
- cada tarea de `tasks.md` deja claro su contrato de tests en el sub-bloque `tests`

### Implementation → Documentation
Se puede pasar a `documentation` solo cuando:
- no quedan tareas de implementación dentro del alcance solicitado
- `status.yaml` refleja que no hay tarea en curso sin cerrar
- el código y los tests relevantes ya están validados
- los tests relevantes ejecutados durante la pasada están en verde
- el umbral de cobertura exigido por el proyecto sigue cumpliéndose
- `status.yaml` puede reflejar esto como:
  - `validation.tests_green: true`
  - `validation.coverage_gate_passed: true`

### Documentation → Complete
Se puede cerrar la feature solo cuando:
- la documentación afectada se ha actualizado
- `documentation.done: true`
- `feature_status: completed`

El cierre definitivo de la feature puede ocurrir dentro de la propia pasada documental. No hace falta una fase adicional separada si `update-app-documentation` deja `status.yaml` en estado final.

## Política de riesgo

### Riesgo bajo
Cambios acotados, sin decisiones transversales y con impacto claro.

### Riesgo medio
Cambios con varias capas afectadas, regresiones posibles o necesidad de alinear contratos.

### Riesgo alto
Cambios estructurales delicados, refactors complejos, cambios de arquitectura, impacto amplio en producto o validación costosa.

El riesgo debe influir en:
- si hace falta `design.md`
- profundidad del plan
- nivel de revisión del plan antes de implementar

## Orden de trabajo recomendado
1. Exploración conversacional con `explore-feature-scope` si todavía hay ambigüedad.
2. `spec.md` con `generate-feature-spec`.
3. `status.yaml` actualizado para marcar `spec` lista y decidir `requires_design`.
4. `design.md` con `generate-feature-design` si `requires_design: true`.
5. `tasks.md` con `generate-implementation-plan`.
6. Revisión del plan vía `review-implementation-plan` (automática como sub-agente al final del paso 5, o manual si se quiere un segundo pase).
7. Implementación tarea a tarea con `implement-task-test-first`.
8. Actualización documental con `update-app-documentation` y cierre final de la feature en `status.yaml`.

## Reglas de mantenimiento
- `status.yaml` debe mantenerse breve; no duplicar en él el contenido completo de `tasks.md`.
- `status.yaml` no sustituye a `tasks.md`; solo coordina el estado global y el punto actual del flujo.
- `notes.md` no es obligatoria ni debe usarse como cajón de sastre.
- `design.md` no debe crearse por reflejo; solo cuando reduzca ambigüedad o riesgo real.
- `design.md` se produce desde `generate-feature-design`, no desde la skill de spec ni desde la skill de planning.
- Las features históricas no necesitan migrarse retroactivamente salvo que se reabran. Esto incluye su `discovery.md` y su `phase: discovery` cuando aplique.
- El cierre de una tarea de implementación exige tests relevantes en verde; no basta con que el código compile o “parezca correcto”.
- El cierre de una pasada de implementación no debe declararse válido si rompe el umbral de cobertura exigido por el proyecto.
- `status.yaml` debe guardar el estado del gate de validación, no el porcentaje exacto de cobertura.
