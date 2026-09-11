---
name: generate-implementation-plan
description: Genera el plan técnico de implementación para una feature de este proyecto una vez exista la spec funcional. Úsala para solicitudes de escritura de `tasks.md`, incluyendo el impacto en código, el contrato de tests por tarea y la documentación afectada.
model: claude-opus-4-7
allowed-tools: Read, Write, Edit, Bash, Agent
---

# Generar plan de implementación

Usa esta skill cuando la tarea sea convertir una spec de feature revisada en trabajo implementable.

Esta skill debe comportarse como la fase de planificación de un flujo guiado por specs: dividir una feature acordada en tareas atómicas, seguras y revisables antes de que empiece la implementación, dejando `tasks.md` como contrato de ejecución para la skill posterior.

La calidad del plan debe ser suficientemente alta como para que dos agentes competentes distintos interpreten lo mismo y produzcan un resultado funcionalmente equivalente, aunque el código final no sea idéntico línea por línea.

## Leer siempre
Lee en un único turno (varias llamadas Read en el mismo mensaje) todos los ficheros fijos; los marcados «si existe...» no rompen el paralelismo:
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/spec.md`
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/status.yaml`
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/design.md` si existe o si `status.yaml` marca `requires_design: true`
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/tasks.md` si existe
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/conventions.md`

En otro turno, lee `ai-workflow/docs/app-features/index.md`; con su contenido, identifica las áreas relevantes y lee sus `index.md` en un único turno; con esas fichas, identifica los sub-documentos concretos para la feature (típicamente 1-3, rara vez más de 5) y léelos en un único turno final.

## Leer si aplica
- `ai-workflow/docs/current-state.md` si hace falta confirmar el estado vigente o un límite actual.
- Si una tarea crea un fichero de test nuevo, buscar en `src/tests/` para situarlo en su carpeta en vez de cargar `ai-workflow/docs/test-index.md` entero.
- `ai-workflow/features/index.md` si hace falta contexto histórico o coordinación con otras features.
- Archivos relevantes de `ai-workflow/examples/` si existen ejemplos reales aplicables al planificar una tarea concreta.

## Objetivo
Escribir o refinar:
- `features/YYYY-MM-DD-HH-MM-feature-name/tasks.md` (incluye el contrato de tests por tarea como sub-bloque)

No implementar código en este paso. Si `status.yaml` marca `requires_design: true` y `artifacts.design` aún no es `ready`, detenerse y redirigir al usuario a `generate-feature-design`; ver "Restricciones" para el resto de límites sobre `design.md`.

## Gate de entrada
Antes de planificar, comprobar:
- `spec.md` lista y `artifacts.spec: ready`
- si `requires_design: true`, `design.md` listo y `artifacts.design: ready`
- sin bloqueos activos en `status.yaml`

Si el gate falla, detenerse y explicitar qué falta. Si lo bloqueante es el design, recomendar invocar `generate-feature-design` antes de volver a esta skill.

## Qué debe incluir `tasks.md`
Cada tarea es una sección de nivel 2 con encabezado `## T<n> — <título>`, con `T<n>` correlativo desde `T1` y escrito idéntico en `status.yaml`. `tasks.md` puede tener otras secciones de nivel 2 (orden de ejecución, siguiente tarea), pero ninguna que empiece por `## T<dígito>` sin ser una tarea. Dentro de cada tarea, estos bloques de nivel 3 con estos títulos exactos y en este orden:
- `### Objetivo`
- `### Fuera de alcance`
- `### Dependencias`
- `### Interfaces` (sub-bloque estable; ver más abajo)
- `### Impacto esperado en archivos`
- `### Tests` (sub-bloque estable; ver más abajo)
- `### Documentación afectada`
- `### Criterios de finalización`
- `### Cierre de implementación`

`ai-workflow/scripts/check-tasks.js <carpeta-de-la-feature>` comprueba esta estructura y que los IDs de `status.yaml` existen; debe pasar antes de cerrar el plan.

Los criterios de finalización describen un único estado:
- cierre de implementación: código y tests de la tarea completos y validados

El campo `documentación afectada` declara qué fichas se verán afectadas como referencia para cuando el usuario invoque `update-app-documentation` manualmente. No añadir un campo `cierre documental` ni crear tareas puramente documentales en `tasks.md`.

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

### Sub-bloque `Interfaces` de cada tarea
El subagente de implementación de una tarea solo lee el bloque literal de esa tarea, no el resto de `tasks.md` ni el código de otras tareas todavía no implementadas. Cuando una tarea depende de una función, clase, tipo o contrato que expone otra tarea, esa firma debe declararse explícitamente para que el subagente no tenga que inventarla ni ir a buscarla en código que puede no existir aún. El sub-bloque tiene dos subsecciones:

- **Consume**: firmas que esta tarea necesita y que expone una tarea previa, formato `` `nombre(params): tipoRetorno` `` seguido de `(de T#)`.
- **Produce**: firmas que esta tarea crea y que quedan disponibles para tareas posteriores, mismo formato de firma seguido de `— consumido por: T#, T#` (o `sin consumidores directos` si nada la usa todavía pero forma parte del contrato de la tarea).

Si una tarea no consume ni produce ninguna firma reutilizable por otra tarea, el sub-bloque debe existir igual con `Consume: ninguno` / `Produce: ninguno`. No omitir el sub-bloque.

La firma declarada en `Produce` de una tarea y la firma declarada en `Consume` de cada tarea que la usa deben coincidir literalmente (mismo nombre, misma forma de parámetros, mismo tipo de retorno). Un desajuste de nombre o firma entre tareas es un error de planificación, no un detalle a resolver en implementación.

### Sub-bloque `tests` de cada tarea
El contrato de verificación de cada tarea vive dentro de la propia tarea. Debe incluir cuatro sub-bloques de nivel 4 (`#### Ficheros de test`, `#### Comportamiento cubierto`, `#### Comandos durante la implementación`, `#### Restricciones`), en este orden:

- **Ficheros de test**: lista de rutas `src/tests/<área>/<módulo>-<área>.test.ts(x)` con su rol explícito: `(nuevo)` si lo crea esta tarea o `(ampliación)` si ya existe y se añaden casos. Cuando un fichero aparece en varias tareas, cada tarea declara su rol y delimita qué casos aporta.
- **Comportamiento cubierto**: lista en bullets de los comportamientos observables que validan los tests de esta tarea. Cada bullet debe ser lo bastante específico para que el subagente de implementación pueda traducirlo a un test concreto sin reinterpretar.
- **Comandos durante la implementación**: comandos exactos `pnpm test --run <ruta>` por cada fichero de test de la tarea. El subagente los usa para iterar el ciclo tests-first sin reabrir la planificación.
- **Restricciones** (opcional): decisiones específicas de esta tarea que limitan cómo se escriben los tests (p. ej. "reusar el harness de X", "no añadir snapshots"). Las reglas universales viven en `ai-workflow/standards/testing-rules.md` y no se repiten aquí.

El sub-bloque `tests` de cada tarea debe ser suficiente para que un subagente con contexto limpio implemente la tarea con enfoque tests-first sin necesidad de inferir qué tests escribir. El umbral de cobertura del proyecto (`pnpm test`) sigue siendo gate de cierre de la pasada de implementación, pero no se repite por tarea: es regla global recogida en `testing-rules.md`.

Si una tarea no requiere tests propios (refactor puro, doc-only), el sub-bloque debe existir igual con `ficheros: ninguno; cubierto por: <ID de otra tarea o suite existente>`. No omitir el sub-bloque.

## Reglas de planificación
- Dividir el trabajo en tareas pequeñas, atómicas y secuenciales que puedan implementarse, probarse y revisarse con seguridad en un cambio acotado.
- Si una tarea es demasiado grande para un cambio seguro o admite más de una interpretación razonable, dividirla.
- Mantener las tareas ordenadas por dependencia.
- Cuando una tarea produzca una función, clase, tipo o contrato que otra tarea posterior necesite usar, declarar esa firma en el `Produce` de la tarea que la crea y repetirla literalmente en el `Consume` de cada tarea que la usa: mismo nombre, misma firma. No dejar que una tarea posterior tenga que inventar o adivinar el contrato expuesto por otra.
- Escribir `tasks.md` como contrato de ejecución para la skill de implementación: la implementación debe poder seguirlo sin reinterpretar alcance, orden ni estrategia general.
- Redactar cada tarea de forma que minimice la varianza de ejecución entre agentes competentes.
- Favorecer definiciones que lleven a resultados funcionalmente equivalentes, no a interpretaciones abiertas del mismo objetivo.
- Evitar tareas que mezclen varios objetivos a la vez, por ejemplo dominio + UI + documentación global, salvo que sea imposible separarlos sin romper el flujo.
- Cada tarea debe tener un resultado observable y verificable por sí mismo.
- Cada tarea debe dejar claro si habilita una tarea posterior o si bloquea el resto hasta quedar cerrada.
- Cada tarea debe dejar claro cuándo se considera cerrada su implementación y cuándo se considera cerrado su estado documental.
- Reflejar los límites arquitectónicos de `architecture.md`.
- Marcar explícitamente el impacto en documentación para cada tarea en el campo `documentación afectada`, aunque el resultado sea `ninguno`.
- Tratar `README.md` como documento de entrada breve; no incluirlo como documentación afectada salvo cambio de contrato público.
- Preferir tareas que puedan completarse de principio a fin en una sola pasada de implementación.
- Dejar claro cuál es la siguiente tarea que debería escogerse.
- Respetar el gate de workflow: no dejar la feature lista para implementación si falta algún artefacto requerido por `status.yaml`.
- Si durante la planificación se descubre que el riesgo o la complejidad técnica justifican un `design.md` que no existía, no escribirlo aquí: detener la planificación y redirigir a `generate-feature-design`.
- Actualizar `status.yaml` al terminar.

## Restricciones
- No implementar código.
- No dejar implícito el impacto en archivos.
- No crear tareas puramente documentales; la actualización de documentación no es parte de `tasks.md`.
- No dejar tareas con estructura libre que omitan bloques contractuales esenciales.
- No dejar implícita una firma que una tarea consume de otra: si el `Consume` de una tarea no tiene una firma literalmente idéntica en el `Produce` de la tarea de la que depende, es un hueco de planificación, no un detalle a resolver en implementación.
- No crear tareas vagas como "build UI" o "wire backend" sin un alcance más estrecho.
- No escribir tareas que obliguen a la skill de implementación a decidir arquitectura, alcance o partición de trabajo sobre la marcha.
- No esconder trabajo importante detrás de frases como "ajustes necesarios", "integración final" o "remates".
- No dejar términos ambiguos que permitan dos interpretaciones funcionales distintas de la misma tarea.
- No ocultar incertidumbre arquitectónica dentro de una tarea. Señálala explícitamente si la spec no está lista.
- No crear ni refinar `design.md`. Si el plan requiere decisiones técnicas que aún no existen, devolver el control a `generate-feature-design`.

## Encadenado con review
Si `status.yaml` marca `plan_tier: trivial`, omitir esta sección entera: no se lanza revisión. Releer la única tarea una vez, en frío, contra el gate de entrada a implementación antes de marcar `artifacts.tasks: ready`, y proceder directamente a la sección "Terminado cuando".

En cualquier otro caso, al cerrar la planificación con `artifacts.tasks: ready`, lanzar automáticamente una revisión del plan usando un sub-agente con contexto limpio:

- usar la herramienta `Agent` con `subagent_type: review-plan`; el prompt es únicamente la ruta absoluta a la carpeta de la feature recién planificada
- la salida esperada del sub-agente es la que define `review-implementation-plan` para su modo sub-agente: veredicto explícito (`aprobado` o `requiere refinamiento`), refinamientos numerados si aplica, y estado sugerido para `implementation.ready` y `blocked_by`
- aplicar los refinamientos propuestos antes de cerrar la fase de planificación y reflejar el veredicto en `status.yaml`; si tras aplicarlos el veredicto sigue siendo `requiere refinamiento`, relanzar la revisión una vez más como máximo

El usuario puede invocar `review-implementation-plan` manualmente si quiere un segundo pase tras refinamientos, también sobre un plan trivial.

## Terminado cuando
- `ai-workflow/scripts/check-tasks.js` pasa sobre la carpeta de la feature
- `tasks.md` es accionable tarea por tarea
- `tasks.md` funciona como contrato de ejecución y no como lista orientativa
- cada tarea sigue una estructura estable y fácil de revisar
- dos agentes competentes distintos podrían seguir el plan e implementar un resultado funcionalmente equivalente sin reinterpretar la feature
- cada tarea incluye su sub-bloque `tests` con las cuatro subsecciones (ficheros, comportamiento cubierto, comandos, restricciones si aplica)
- el sub-bloque `tests` de cada tarea es lo bastante literal como para que un subagente con contexto limpio implemente la tarea sin reinterpretar el alcance
- cada tarea incluye su sub-bloque `Interfaces` (Consume/Produce), y cada firma declarada en `Produce` coincide literalmente con la firma que declaran en `Consume` las tareas que dependen de ella
- `design.md` existe cuando el riesgo o la complejidad lo piden
- `status.yaml` refleja correctamente si la feature está lista o no para implementación
- cada tarea identifica el impacto en código, tests y documentación afectada
- cada tarea deja explícito su cierre de implementación
- el paso de implementación puede tomar una tarea y ejecutarla con seguridad sin replantear toda la feature
