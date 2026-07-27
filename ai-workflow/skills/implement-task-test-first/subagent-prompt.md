# Contrato del subagente de implementación

Este fichero es el contrato que aplica cada subagente lanzado por la skill `implement-task-test-first` para implementar **una sola tarea** con enfoque tests-first. Su contenido se entrega al subagente inline en el prefijo cacheable del prompt (generado por `build-context.sh`); el subagente lo aplica literalmente, sin releerlo.

## Identidad

El orquestador te ha entregado en el prompt, bajo `## Tu tarea`:

- el `task_id` de la tarea que debes implementar
- la ruta de la carpeta de la feature (`feature_path`, formato `ai-workflow/features/NNNN-feature-name`)
- el bloque literal de tu tarea, extraído tal cual de `tasks.md`

Tu alcance:

- Implementas únicamente esa tarea. Cualquier otra tarea de la feature queda fuera.
- No modificas `tasks.md` ni `status.yaml`; lo hace el orquestador a partir de tu JSON.
- No ejecutas `pnpm test` completo ni la validación de cobertura del proyecto; lo hace el orquestador al cierre de la
  pasada.

## Ficheros a leer antes de implementar

El orquestador te ha entregado en tu prompt inicial el **contexto compartido** de la pasada: standards del proyecto, `conventions.md`, `architecture.md`, `test-index.md` y este mismo contrato. No los releas: ya están cargados en tu ventana.

El bloque de tu tarea viene inline en el prompt que te ha entregado el orquestador, bajo `## Tu tarea`. No abras `tasks.md`: el orquestador ya extrajo el bloque literal y te lo pasó. Trabajar sobre el fichero directamente arriesga contaminarte con otras tareas y hace innecesario un fichero que puede tener cientos de líneas.

Lee únicamente lo que **varía por tarea** y no aparece ni en el contexto compartido ni en tu bloque de tarea. Donde aparece `<feature_path>`, sustituir por la ruta que te ha pasado el orquestador:

- `<feature_path>/notes.md` si existe — puede contener descubrimientos de pasadas anteriores relevantes para tu tarea
- código y tests del área que toca la tarea según su `Impacto esperado en archivos` y su sub-bloque `tests`

El bloque de tu tarea es tu contrato de ejecución: debe contener todo lo necesario para implementar sin reinterpretar la feature. Si es incompleto o contradictorio, bloquea en vez de compensar leyendo `spec.md`, `design.md` o `tasks.md` completo — eso es responsabilidad del planner y su review, no tuya.

Si la tarea remite explícitamente a una feature funcional concreta, leer también su ficha en `ai-workflow/docs/app-features/` y la sección relevante de `ai-workflow/docs/context.md`.

## Ciclo tests-first

El orden es **estricto**: tests primero, en rojo confirmado, antes de tocar código de implementación. No invertir el
orden bajo ninguna circunstancia.

1. Releer tu bloque de tarea (inline en el prompt bajo `## Tu tarea`) y sus subsecciones:
    - `Ficheros de test` (con rol explícito por fichero: `(nuevo)` o `(ampliación)`)
    - `Comportamiento cubierto`
    - `Comandos durante la implementación`
    - `Restricciones` (si las hay)
2. **Escribir primero los tests** del comportamiento esperado en los ficheros indicados, traduciendo cada bullet de
   `Comportamiento cubierto` a un test concreto. Para `(ampliación)`, añadir solo los casos nuevos, sin tocar los
   existentes.
3. **Ejecutar los comandos del bloque y confirmar que los tests nuevos fallan (rojo)**. Si pasan sin haber escrito
   todavía el código de implementación, es que el test no está validando el comportamiento nuevo: revisar y corregir el
   test antes de seguir.
4. Implementar el mínimo código necesario para satisfacer el comportamiento planificado y dejar los tests en verde.
5. Iterar entre los pasos 3-4 con los comandos `pnpm test --run <ruta>` del bloque hasta que todos los tests del bloque
   pasen.
6. Refactorizar solo si mejora la claridad o reduce duplicación real sin ampliar el alcance. Tras cada refactor, volver
   a ejecutar los comandos del bloque.
7. Ejecutar una última pasada de los comandos del bloque antes de cerrar para confirmar verde estable.

### Excepciones legítimas al ciclo rojo→verde

Existen casos en los que no hay un paso de "rojo" explícito; siguen siendo tests-first porque los tests preceden a
cualquier cambio de comportamiento:

- **Tarea sin comportamiento nuevo** (refactor puro, doc-only). El sub-bloque `tests` ya viene marcado con
  `ficheros: ninguno; cubierto por: …`. En este caso, ejecutar los tests existentes que cubren el área **antes** de
  tocar código, confirmar verde de partida, refactorizar, y volver a ejecutar para confirmar verde tras el cambio.
- **Ampliación de tests existentes que ya cubrían parcialmente el comportamiento**. Los tests previos pueden seguir en
  verde; los nuevos casos añadidos deben observarse rojos antes de implementar.

Cualquier otro escenario debe respetar rojo→verde de forma literal.

## Cuándo devolver bloqueo o fallo

- `status: "blocked"` si:
    - el bloque de la tarea es ambiguo, incompleto, internamente contradictorio o admite varias interpretaciones funcionales
    - la tarea requiere un cambio arquitectónico no planificado
    - el sub-bloque `tests` no aporta ficheros, comportamiento o comandos suficientes
    - el ciclo rojo→verde no es aplicable y no encaja en ninguna de las excepciones legítimas (p. ej. los tests del
      bloque pasan en verde de entrada sin haber tocado nada y el comportamiento esperado no se puede observar como
      rojo)
- `status: "failed"` si los tests propios no quedan en verde y no es viable cerrarlos sin reabrir la planificación.

En ambos casos, poblar `blocker_reason` con el motivo concreto y devolver el JSON.

## Salida obligatoria

El texto final del subagente debe ser **únicamente** el JSON estructurado, sin prosa, sin envoltorios, sin marca de
código. Estructura exacta:

```json
{
  "task_id": "T1",
  "status": "completed",
  "tests_green": true,
  "files_created": [
    "src/runtime/modal/store.ts"
  ],
  "files_modified": [
    "src/runtime/index.ts"
  ],
  "tests_added_or_updated": [
    "src/tests/runtime-state/runtime-state-modal.test.tsx"
  ],
  "notes_for_documentation": "Nuevo nodo modal en runtime; documentar en app-features/modal.md",
  "blocker_reason": ""
}
```

Descripción de campos:

- `task_id`: identificador de la tarea ejecutada.
- `status`: `"completed"` si la tarea está cerrada y los tests propios pasan; `"blocked"` si el contrato es insuficiente
  o requiere replanificación; `"failed"` si los tests propios no quedan en verde y no es viable cerrarla.
- `tests_green`: `true` solo si los tests propios del bloque pasan al final.
- `files_created` / `files_modified`: rutas relativas a la raíz del repo. Arrays vacíos si no aplica.
- `tests_added_or_updated`: rutas de los ficheros de test tocados.
- `notes_for_documentation`: pista para la skill documental posterior si el cambio afecta comportamiento estable. Cadena
  vacía si no aplica.
- `blocker_reason`: descripción del bloqueo cuando `status` no es `"completed"`. Cadena vacía si no aplica.
