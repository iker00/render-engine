---
name: orchestrate-batch-features
description: Orquesta el ciclo completo de implementación (plan → review → implementación → documentación → commit) para una lista de features con spec lista, de forma secuencial y autónoma. Úsala cuando varias features estén en `artifacts.spec: ready` y quieras procesarlas en orden sin intervención manual entre fases.
model: claude-opus-4-7
---

# Orquestar implementación en batch

Usa esta skill cuando un conjunto de features tenga `spec.md` lista y quieras ejecutar el ciclo completo de forma autónoma y secuencial: planificación → revisión → implementación → documentación → commit.

Esta skill actúa como **orquestador de nivel superior**: no implementa código ni escribe documentación directamente. Delega cada fase en la skill correspondiente mediante sub-agentes con contexto limpio, y solo avanza a la siguiente feature cuando la anterior queda en `feature_status: completed` y el commit está hecho.

## Invocación como slash command

```
/orchestrate-batch-features 0051, 0052, 0053, 0054
```

Los IDs llegan via `$ARGUMENTS` como lista separada por comas. Pueden ser solo el número (`0051`) o el nombre completo (`0051-feature-name`). Si solo se pasa el número, resolver el nombre completo buscando en `ai-workflow/features/` la carpeta que empiece por ese ID.

El orden de procesamiento es el orden en que aparecen en `$ARGUMENTS`.

Si `$ARGUMENTS` está vacío, leer `ai-workflow/features/index.md` y construir la lista con todas las features que cumplan el gate de entrada, ordenadas por ID ascendente.

## Leer siempre (orquestador)
- `ai-workflow/docs/workflow.md`
- `ai-workflow/features/index.md` si existe
- `ai-workflow/features/NNNN-feature-name/status.yaml` de cada feature de la lista antes de procesarla

## Gate de entrada por feature
Antes de iniciar el ciclo de una feature, verificar en su `status.yaml`:
- `artifacts.spec: ready`
- `blocked_by: []`
- `feature_status` no es `completed`
- si `requires_design: true`, `artifacts.design: ready`

Si el gate falla, saltar esa feature, registrar el motivo en la respuesta final y continuar con la siguiente.

## Ciclo por feature

### Fase 1 — Planificación
Lanzar un sub-agente con contexto limpio:
- herramienta: `Agent` con `subagent_type: general-purpose`
- prompt: ruta absoluta a la carpeta de la feature e instrucción de leer y aplicar literalmente `ai-workflow/skills/generate-implementation-plan/SKILL.md`
- esta skill ya encadena `review-implementation-plan` automáticamente como sub-agente al terminar
- esperar resultado: `artifacts.tasks: ready` y `implementation.ready: true` en `status.yaml`

Si el sub-agente termina con `implementation.ready: false` o `blocked_by` no vacío, detener el ciclo de esta feature, registrar el bloqueo y pasar a la siguiente feature.

### Fase 2 — Implementación
Lanzar un sub-agente con contexto limpio:
- herramienta: `Agent` con `subagent_type: general-purpose`
- prompt: ruta absoluta a la carpeta de la feature e instrucción de leer y aplicar literalmente `ai-workflow/skills/implement-task-test-first/SKILL.md`
- esperar resultado: todas las tareas en `implementation.completed_task_ids`, `validation.tests_green: true` y `validation.coverage_gate_passed: true` en `status.yaml`

Si el sub-agente devuelve alguna tarea en `blocked` o `failed`, o si `validation.tests_green: false` o `validation.coverage_gate_passed: false`, detener el ciclo de esta feature, registrar el bloqueo y pasar a la siguiente feature.

### Fase 3 — Documentación
Lanzar un sub-agente con contexto limpio:
- herramienta: `Agent` con `subagent_type: general-purpose`
- prompt: ruta absoluta a la carpeta de la feature e instrucción de leer y aplicar literalmente `ai-workflow/skills/update-app-documentation/SKILL.md`
- esperar resultado: `documentation.done: true` y `feature_status: completed` en `status.yaml`

Si el sub-agente no puede cerrar la documentación, detener el ciclo de esta feature, registrar el motivo y pasar a la siguiente.

### Fase 4 — Commit
Una vez `feature_status: completed` en `status.yaml`, ejecutar el commit con exactamente los archivos tocados por esta feature:

1. Leer `spec.md` de la feature para extraer el título funcional.
2. Construir el mensaje de commit siguiendo el patrón del proyecto:
   ```
   feat(runtime): <descripción imperativa en inglés extraída de spec.md> (feature NNNN)
   ```
3. Hacer stage únicamente de:
   - la carpeta de artefactos de la feature: `ai-workflow/features/NNNN-feature-name/`
   - los archivos de código y tests devueltos por el sub-agente de implementación en `files_created` y `files_modified`
   - los archivos de documentación modificados por el sub-agente de documentación
   ```bash
   git add ai-workflow/features/NNNN-feature-name/
   git add <files_created> <files_modified>  # del JSON de implement-task-test-first
   git add <archivos tocados por update-app-documentation>
   git commit -m "feat(runtime): <mensaje> (feature NNNN)"
   ```
4. Verificar que el commit se ha creado correctamente antes de pasar a la siguiente feature.

Si el commit falla, registrar el error en la respuesta final y detener el batch completo: no avanzar a la siguiente feature con el árbol sucio.

## Reglas de trabajo
- Procesar las features estrictamente en el orden de `$ARGUMENTS`. No avanzar al NNNN+1 hasta que el NNNN tenga commit hecho o esté registrado como saltado por gate fallido o bloqueo.
- No reutilizar contexto entre features. Cada sub-agente arranca limpio.
- No implementar código, escribir documentación ni modificar artefactos directamente desde este orquestador. Todo se delega en sub-agentes.
- Centralizar la lectura de `status.yaml` para decidir si avanzar o parar. No inferir el estado desde la salida en prosa del sub-agente.
- Si una feature se bloquea en cualquier fase, registrar el motivo con precisión y continuar con la siguiente. No interrumpir el batch entero por un bloqueo puntual salvo en el caso de commit fallido con árbol sucio.
- No modificar `status.yaml` directamente desde este orquestador salvo para registrar un bloqueo externo que ningún sub-agente pudo registrar.

## Respuesta final
Al terminar el batch, emitir un resumen con:

```
## Batch completado

### Features procesadas con éxito
- [x] NNNN-feature-name — commit: <hash corto>

### Features bloqueadas o saltadas
- [ ] NNNN-feature-name — motivo: <fase donde falló y razón>

### Pendiente de revisión manual
<lista de bloqueos que requieren intervención>
```

## Detente y señala un problema cuando
- un commit falla y el árbol de trabajo queda sucio
- `status.yaml` de una feature no existe y no puede inferirse el estado
- dos features del batch modifican los mismos archivos y hay riesgo de conflicto

## Terminado cuando
- todas las features de `$ARGUMENTS` han sido procesadas (completadas, saltadas o bloqueadas)
- cada feature completada tiene su commit hecho y `feature_status: completed`
- el resumen final deja claro qué features requieren intervención manual