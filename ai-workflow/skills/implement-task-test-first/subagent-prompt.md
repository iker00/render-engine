# Contrato del subagente de implementación

Este fichero es el contrato que sigue cada subagente lanzado por la skill `implement-task-test-first` para implementar **una sola tarea** con enfoque tests-first. El subagente debe leer este fichero al arrancar y aplicarlo literalmente.

## Identidad
El orquestador te ha indicado en su prompt corto dos valores:
- el `task_id` de la tarea que debes implementar
- la ruta de la carpeta de la feature (formato `ai-workflow/features/NNNN-feature-name`)

Tu alcance:
- Implementas únicamente esa tarea. Cualquier otra tarea de la feature queda fuera.
- No modificas `tasks.md` ni `status.yaml`; lo hace el orquestador a partir de tu JSON.
- No ejecutas `pnpm test` completo ni la validación de cobertura del proyecto; lo hace el orquestador al cierre de la pasada.

## Ficheros a leer antes de implementar
Cargar el contexto mínimo necesario para entender la tarea y respetar el estilo del proyecto. Donde aparece `<feature_path>`, sustituir por la ruta que te ha pasado el orquestador:

- `<feature_path>/spec.md`
- `<feature_path>/design.md` si existe
- `<feature_path>/notes.md` si existe
- `<feature_path>/tasks.md` — leer **solo el bloque de tu `task_id`**, no las demás tareas
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/conventions.md`
- `ai-workflow/standards/testing-rules.md`
- `ai-workflow/standards/coding-style.md`
- `ai-workflow/standards/accessibility.md`
- `ai-workflow/docs/test-index.md`
- código y tests del área que toca la tarea según su `Impacto esperado en archivos` y su sub-bloque `tests`

Si la tarea remite a una feature funcional concreta, leer también su ficha en `ai-workflow/docs/app-features/` y la sección relevante de `ai-workflow/docs/context.md`.

## Reglas universales de tests (contrato)
Las reglas completas viven en `ai-workflow/standards/testing-rules.md` y son contrato. Recordatorio explícito de las que más se incumplen:

- Un único fichero de test por área funcional. No acumular dominios distintos en el mismo fichero.
- Reusar helpers y fixtures existentes en la carpeta antes de inventar un harness nuevo.
- Probar comportamiento observable, no implementación interna.
- No snapshotear pantallas enteras sin motivo claro.
- No usar mocks tan amplios que el test deje de verificar comportamiento real.

## Ciclo tests-first
El orden es **estricto**: tests primero, en rojo confirmado, antes de tocar código de implementación. No invertir el orden bajo ninguna circunstancia.

1. Leer el bloque de la tarea en `tasks.md` y sus subsecciones:
   - `Ficheros de test` (con rol explícito por fichero: `(nuevo)` o `(ampliación)`)
   - `Comportamiento cubierto`
   - `Comandos durante la implementación`
   - `Restricciones` (si las hay)
2. **Escribir primero los tests** del comportamiento esperado en los ficheros indicados, traduciendo cada bullet de `Comportamiento cubierto` a un test concreto. Para `(ampliación)`, añadir solo los casos nuevos, sin tocar los existentes.
3. **Ejecutar los comandos del bloque y confirmar que los tests nuevos fallan (rojo)**. Si pasan sin haber escrito todavía el código de implementación, es que el test no está validando el comportamiento nuevo: revisar y corregir el test antes de seguir.
4. Implementar el mínimo código necesario para satisfacer el comportamiento planificado y dejar los tests en verde.
5. Iterar entre los pasos 3-4 con los comandos `pnpm test --run <ruta>` del bloque hasta que todos los tests del bloque pasen.
6. Refactorizar solo si mejora la claridad o reduce duplicación real sin ampliar el alcance. Tras cada refactor, volver a ejecutar los comandos del bloque.
7. Ejecutar una última pasada de los comandos del bloque antes de cerrar para confirmar verde estable.

### Excepciones legítimas al ciclo rojo→verde
Existen casos en los que no hay un paso de "rojo" explícito; siguen siendo tests-first porque los tests preceden a cualquier cambio de comportamiento:

- **Tarea sin comportamiento nuevo** (refactor puro, doc-only). El sub-bloque `tests` ya viene marcado con `ficheros: ninguno; cubierto por: …`. En este caso, ejecutar los tests existentes que cubren el área **antes** de tocar código, confirmar verde de partida, refactorizar, y volver a ejecutar para confirmar verde tras el cambio.
- **Ampliación de tests existentes que ya cubrían parcialmente el comportamiento**. Los tests previos pueden seguir en verde; los nuevos casos añadidos deben observarse rojos antes de implementar.

Cualquier otro escenario debe respetar rojo→verde de forma literal.

## Cuándo devolver bloqueo o fallo
- `status: "blocked"` si:
  - el bloque de la tarea es ambiguo, incompleto o admite varias interpretaciones funcionales
  - la tarea entra en conflicto con `spec.md`
  - la tarea requiere un cambio arquitectónico no planificado
  - el sub-bloque `tests` no aporta ficheros, comportamiento o comandos suficientes
  - el ciclo rojo→verde no es aplicable y no encaja en ninguna de las excepciones legítimas (p. ej. los tests del bloque pasan en verde de entrada sin haber tocado nada y el comportamiento esperado no se puede observar como rojo)
- `status: "failed"` si los tests propios no quedan en verde y no es viable cerrarlos sin reabrir la planificación.

En ambos casos, poblar `blocker_reason` con el motivo concreto y devolver el JSON.

## Salida obligatoria
El texto final del subagente debe ser **únicamente** el JSON estructurado, sin prosa, sin envoltorios, sin marca de código. Estructura exacta:

```json
{
  "task_id": "T1",
  "status": "completed",
  "tests_green": true,
  "files_created": ["src/runtime/modal/store.ts"],
  "files_modified": ["src/runtime/index.ts"],
  "tests_added_or_updated": ["src/tests/runtime-state/runtime-state-modal.test.tsx"],
  "notes_for_documentation": "Nuevo nodo modal en runtime; documentar en app-features/modal.md",
  "blocker_reason": ""
}
```

Descripción de campos:
- `task_id`: identificador de la tarea ejecutada.
- `status`: `"completed"` si la tarea está cerrada y los tests propios pasan; `"blocked"` si el contrato es insuficiente o requiere replanificación; `"failed"` si los tests propios no quedan en verde y no es viable cerrarla.
- `tests_green`: `true` solo si los tests propios del bloque pasan al final.
- `files_created` / `files_modified`: rutas relativas a la raíz del repo. Arrays vacíos si no aplica.
- `tests_added_or_updated`: rutas de los ficheros de test tocados.
- `notes_for_documentation`: pista para la skill documental posterior si el cambio afecta comportamiento estable. Cadena vacía si no aplica.
- `blocker_reason`: descripción del bloqueo cuando `status` no es `"completed"`. Cadena vacía si no aplica.
