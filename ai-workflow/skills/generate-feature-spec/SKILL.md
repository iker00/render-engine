---
name: generate-feature-spec
description: Genera o refina la spec funcional de una feature de este proyecto antes de la planificación de implementación. Úsala para solicitudes de escritura de `features/NNNN-feature-name/spec.md` a partir de los documentos de contexto del proyecto, manteniendo el resultado alineado, revisable e intencionadamente no técnico.
preferred_profile: cheap
profile_rationale: Fase documental y de alineamiento; debe priorizar bajo coste y suficiente claridad antes de planificar.
---

# Generar spec de feature

Usa esta skill cuando la tarea sea definir una feature antes de planificar su implementación.

Esta skill debe comportarse como la fase de alineamiento de un flujo guiado por specs: acordar qué se va a construir antes de planificar cambios de código.

## Leer primero
- `ai-workflow/docs/workflow.md`
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/app-features/index.md`
- solo los documentos de `ai-workflow/docs/app-features/` que el índice marque como relevantes para la petición
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/conventions.md`
- `ai-workflow/docs/current-state.md` si existe
- `ai-workflow/features/index.md` si existe
- `ai-workflow/features/NNNN-feature-name/discovery.md` si existe
- `ai-workflow/features/NNNN-feature-name/status.yaml` si existe
- el archivo objetivo `features/NNNN-feature-name/spec.md` si ya existe

## Objetivo
Cerrar las dudas mínimas necesarias de producto antes de escribir o refinar `features/NNNN-feature-name/spec.md`, y dejar `status.yaml` alineado con el estado de la feature.

El resultado debe mantenerse en el nivel de producto y comportamiento. No conviertas todavía la spec en tareas de implementación.

Si durante este paso ya es necesario dejar decisiones de UX, estructura de pantallas, flujos o estados visuales para evitar ambigüedad funcional, también debe prepararse `design.md`.

## Fase obligatoria de aclaración
Antes de generar o reescribir la spec:
- revisa la sección `Riesgos o preguntas abiertas` de `discovery.md` o de la `spec.md` existente si las hubiera
- identifica solo las dudas que bloquean una spec cerrada y planificable
- descarta preguntas cosméticas, duplicadas o que puedan resolverse razonablemente con el contexto existente
- formula al usuario el número mínimo de preguntas necesarias

Cada pregunta debe:
- ir numerada
- describir la duda de forma concreta y breve
- incluir una sugerencia explícita de la mejor solución posible según el contexto del proyecto
- pedir confirmación o corrección de esa sugerencia

Formato esperado de las preguntas:

```md
1. ¿[pregunta concreta]?
   Sugerencia: [mejor opción propuesta y por qué en una frase].
```

Tras recibir respuesta:
- incorpora las decisiones confirmadas a la spec
- elimina de `Riesgos o preguntas abiertas` las dudas ya resueltas
- conserva solo riesgos reales no resueltos o dependencias externas que sigan abiertas

Si no quedan dudas bloqueantes, no hagas preguntas y genera la spec directamente.

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
- Mantener la terminología consistente con `context.md` y con las fichas de `ai-workflow/docs/app-features/`.
- Tratar `README.md` como documento corto e informativo; no usarlo como histórico acumulado del proyecto.
- Si la petición del usuario implica un alcance más simple que un motor completo de reglas, preservar esa simplificación de forma explícita.
- No decidir en silencio las ambigüedades que bloqueen la spec; primero preguntar al usuario con recomendación concreta.
- Resolver por cuenta propia solo las ambigüedades menores que no cambien el alcance, el comportamiento o la validación de la feature.
- Evitar desgloses de tareas, listas de archivos o pasos técnicos de implementación.
- Preferir comportamiento concreto y revisable frente a descripciones vagas de la feature.
- Si la petición entra en conflicto con restricciones existentes del proyecto, reflejar el conflicto con claridad en la spec.
- Si la spec necesita referenciar estado vigente o histórico reciente, preferir `ai-workflow/docs/current-state.md` y `ai-workflow/features/index.md` antes que ampliar `README.md`.
- No cargar todas las fichas de feature por defecto; seleccionar solo las relevantes desde `ai-workflow/docs/app-features/index.md`.
- Si existe `discovery.md`, usarlo para resolver qué preguntas ya quedaron respondidas y cuáles siguen abiertas.
- Si no existe `status.yaml`, crearlo usando `ai-workflow/templates/status.yaml`.
- Si para cerrar la feature a nivel funcional hacen falta decisiones de interacción, flujos de pantalla, estados vacíos, validaciones visibles o jerarquía de información, crear o actualizar `design.md` en la misma feature.
- Tras cerrar la spec, actualizar `status.yaml` como mínimo para reflejar:
  - `phase: spec` o `phase: planning` según el punto alcanzado
  - `artifacts.spec: ready` cuando la spec ya esté lista
  - `artifacts.design: ready | not-needed | pending` según corresponda
  - `feature_status: drafting` o `planned` según corresponda
  - `requires_design` si ya es evidente que la feature necesitará `design.md`
  - `risk_level` con una valoración razonada `low | medium | high`
- Si la feature sigue siendo demasiado ambigua para escribir una buena spec, detenerse y recomendar primero discovery en vez de inventar decisiones.

## Nivel de calidad esperado
- La spec debe ser lo bastante concreta como para planificar la implementación.
- Los criterios de aceptación deben poder comprobarse con tests.
- Los elementos fuera de alcance deben evitar ampliaciones accidentales del alcance.
- Antes de cerrar la spec deben haberse hecho al usuario las preguntas mínimas imprescindibles para evitar dudas relevantes.
- Las preguntas abiertas finales deben ser excepcionales: solo riesgos reales, decisiones externas pendientes o incertidumbres no resolubles en esta fase.
- Si existe `design.md`, debe complementar la spec sin convertirla en un plan técnico.

## Terminado cuando
- se han hecho y resuelto las preguntas mínimas necesarias, si existían
- `spec.md` está actualizada
- `design.md` está actualizado cuando la feature lo necesita para quedar cerrada funcionalmente
- `status.yaml` existe y refleja el estado real tras esta fase
- la intención de la feature queda clara
- la planificación técnica se deja intencionadamente para el siguiente paso
- la spec es revisable sin necesitar detalles de código
