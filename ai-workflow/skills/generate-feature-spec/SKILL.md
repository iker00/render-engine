---
name: generate-feature-spec
description: Genera o refina la spec funcional de una feature de este proyecto antes de la planificación de implementación. Úsala para solicitudes de escritura de `features/YYYY-MM-DD-HH-MM-feature-name/spec.md` a partir de los documentos de contexto del proyecto, manteniendo el resultado alineado, revisable e intencionadamente no técnico.
model: sonnet
allowed-tools: Read, Write, Edit, Bash
---
# Generar spec de feature

Usa esta skill cuando la tarea sea definir una feature antes de planificar su implementación.

Esta skill debe comportarse como la fase de alineamiento de un flujo guiado por specs: acordar qué se va a construir antes de planificar cambios de código.

## Cuándo usar esta skill

**Úsala cuando:**

- El usuario pide escribir o refinar `spec.md` para una feature concreta
- La feature está en fase de definición y aún no hay spec cerrada
- `status.yaml` no existe o marca `phase: idea` / `phase: exploration`
- Frases típicas: "escribe la spec de X", "define la feature Y", "qué debería hacer Z", "crea la spec para <slug>"

**No la uses cuando:**

- Ya existe una `spec.md` cerrada y el siguiente paso es planificación → `generate-implementation-plan`
- El usuario quiere explorar sin comprometerse a una spec → `explore-feature-scope`
- La feature requiere decisiones técnicas antes de especificar → `generate-feature-design`

## Leer siempre
Lee en un único turno (varias llamadas Read en el mismo mensaje) todos los ficheros fijos, junto con los aplicables de "Leer si aplica"; los marcados «si existe»/«si ya existe» no rompen el paralelismo:
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/current-state.md` si existe
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/status.yaml` si existe
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/spec.md` si ya existe

En otro turno, lee `ai-workflow/docs/app-features/index.md`; con su contenido, identifica las áreas relevantes y lee sus `index.md` en un único turno; con esas fichas, identifica los sub-documentos concretos para la petición (típicamente 1-3, rara vez más de 5) y léelos en un único turno final.

## Leer si aplica
Léelo en el mismo turno que "Leer siempre" — su aplicabilidad se decide desde la petición, sin depender de ninguna lectura previa:
- `ai-workflow/docs/architecture.md` si la petición menciona un límite arquitectónico, una frontera de capa o un punto de extensión estable.
- `ai-workflow/docs/conventions.md` si la petición menciona naming, estructura de carpetas o convenciones de código.
- `ai-workflow/templates/status.yaml` si `status.yaml` de la feature no existe todavía y hay que crearlo.
- `ai-workflow/features/index.md` si hace falta histórico reciente, coordinación con otras features o actualizar el mapa de entregas.

## Objetivo

Cerrar las dudas mínimas necesarias de producto antes de escribir o refinar `features/YYYY-MM-DD-HH-MM-feature-name/spec.md`, y dejar `status.yaml` alineado con el estado de la feature.

El resultado debe mantenerse en el nivel de producto y comportamiento. No conviertas todavía la spec en tareas de implementación.

Si la feature requiere decisiones técnicas relevantes para su implementación (arquitectura, integración con runtime, migración, trade-offs técnicos), marcar `requires_design: true` en `status.yaml` y redirigir al usuario a `generate-feature-design` como siguiente paso.

## Fase obligatoria de aclaración

Antes de generar o reescribir la spec:

- revisa la sección `Riesgos o preguntas abiertas` de la `spec.md` existente si la hubiera
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

- Reglas VCS: una vez resueltas las dudas de la fase de aclaración y justo antes de crear la carpeta de la feature o
escribir cualquier artefacto (no al arrancar la skill, no durante la conversación de aclaración), ejecutar
directamente sin pedir confirmación:
  1. `git checkout dev`. Si falla por cambios sin commitear (working tree sucio), **detener el flujo y avisar** para
   decidir manualmente cómo proceder (no hacer stash ni descartar cambios automáticamente).
  2. `git pull` para asegurar que la base local está al día.
  3. Crear la rama desde `dev`: `git checkout -b feature/<descripción>` o `fix/<descripción>` según corresponda  
   (nomenclatura y formato de commit en `ai-workflow/docs/vcs.md`).
- Si la carpeta de la feature todavía no existe, crearla con el formato `ai-workflow/features/<timestamp>-<slug>/`, donde `<timestamp>` se obtiene ejecutando `date +%Y-%m-%d-%H-%M` en el momento de la creación y `<slug>` es un `kebab-case` ASCII descriptivo. No inventar el timestamp ni copiarlo de otra feature. Si la carpeta ya existe con el formato antiguo `NNNN-feature-name`, respetar el nombre existente sin renombrar.
- Basar la spec en el contexto existente del proyecto, no en suposiciones genéricas.
- Mantener la terminología consistente con `context.md` y con las fichas de `ai-workflow/docs/app-features/`.
- Tratar `README.md` como documento corto e informativo; no usarlo como histórico acumulado del proyecto.
- Si la petición del usuario implica un alcance más simple que un motor completo de reglas, preservar esa simplificación de forma explícita.
- No decidir en silencio las ambigüedades que bloqueen la spec; primero preguntar al usuario con recomendación concreta.
- Resolver por cuenta propia solo las ambigüedades menores que no cambien el alcance, el comportamiento o la validación de la feature.
- Evitar desgloses de tareas, listas de archivos o pasos técnicos de implementación.
- Preferir comportamiento concreto y revisable frente a descripciones vagas de la feature.
- Si la petición entra en conflicto con restricciones existentes del proyecto, reflejar el conflicto con claridad en la spec.
- Si la spec necesita referenciar estado vigente, usar `ai-workflow/docs/current-state.md`; si necesita histórico reciente, usar `ai-workflow/features/index.md`. No ampliar `README.md` para ese propósito.
- No escribir `design.md` desde esta skill. Si la feature necesita decisiones técnicas explícitas antes de planificar (arquitectura, estrategia de cambio, trade-offs no triviales), marcar `requires_design: true` y delegar en `generate-feature-design`.
- Tras cerrar la spec, actualizar `status.yaml`.
- Si la feature sigue siendo demasiado ambigua para escribir una buena spec, detenerse y explicitar qué decisiones de producto faltan antes de comprometer la spec.

## Nivel de calidad esperado

- La spec debe ser lo bastante concreta como para planificar la implementación.
- Los criterios de aceptación deben poder comprobarse con tests.
- Los elementos fuera de alcance deben evitar ampliaciones accidentales del alcance.
- Antes de cerrar la spec deben haberse hecho al usuario las preguntas mínimas imprescindibles para evitar dudas relevantes.
- Las preguntas abiertas finales deben ser excepcionales: solo riesgos reales, decisiones externas pendientes o incertidumbres no resolubles en esta fase.

## Terminado cuando

- se han hecho y resuelto las preguntas mínimas necesarias, si existían
- `spec.md` está actualizada
- `status.yaml` existe y refleja el estado real tras esta fase, incluida la decisión sobre `requires_design`
- la intención de la feature queda clara
- la planificación técnica se deja intencionadamente para el siguiente paso
- la spec es revisable sin necesitar detalles de código
- la respuesta final indica explícitamente el siguiente paso: `generate-feature-design` si `requires_design: true`, o `generate-implementation-plan` en otro caso

