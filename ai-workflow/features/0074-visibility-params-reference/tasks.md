# Tasks — `params.*` como referencia admitida en `visibility`

> Spec: [`spec.md`](./spec.md)
> Status: [`status.yaml`](./status.yaml)

## Resumen del contrato de ejecución

La feature amplía la validación de `visibility.reference` para admitir `params.{paramName}` con exactamente un segmento dinámico, alineando esa superficie con el resto de superficies que ya admiten `params.*` (y con los predicados `when`, que ya lo aceptan vía `isValidWhenReference`). La resolución en runtime (`resolveRuntimeReference`) ya maneja `params.*`, y `matchesVisibilityRule` delega en ella sin ramas dedicadas a la familia: por tanto el cambio es principalmente de validación previa al render, más cobertura de runtime que asegura el contrato con todos los operadores.

Orden de ejecución:
1. T1 — Extender validación de `visibility.reference` para aceptar `params.{paramName}` y rechazar formas inválidas dentro del mismo namespace.
2. T2 — Cobertura runtime de la evaluación de `visibility` con `params.*` para todos los operadores soportados.

T2 depende de T1: los tests de runtime construyen configs que necesitan pasar la validación.

---

## T1 — Aceptar `params.{paramName}` en `visibility.reference`

- **ID**: T1
- **Estado**: completed
- **Objetivo**: extender `isValidVisibilityReference` en `src/config/validate-actions-visibility.ts` para admitir referencias `params.{paramName}` con un único segmento dinámico tras el namespace, manteniendo las reglas existentes para el resto de familias y rechazando explícitamente `params` y `params.x.y` (dos o más segmentos). Alinear el mensaje de error de `validateVisibility` para que liste `params.{paramName}` como referencia admitida.
- **Fuera de alcance**:
  - No modificar `validateWhenCondition` ni `isValidWhenReference` (ya admiten `params.*` vía `whenParamsReferencePattern`).
  - No tocar `resolveRuntimeReference` ni `matchesVisibilityRule`: la familia ya está implementada en el resolver y el evaluador delega en él sin ramas específicas.
  - No introducir soporte para `params.*` en orígenes de colección (`repeater`, `list`, `select`, `radioGroup`, `checkboxGroup`).
  - No tocar la documentación funcional (queda anotada en `documentación afectada` para la skill posterior).
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/validate-actions-visibility.ts` (modificar `isValidVisibilityReference` para reconocer `params.{paramName}`; ajustar el mensaje de error literal de `validateVisibility` que enumera las referencias admitidas para incluir `params.{paramName}`).
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación): invertir el test marcado como "T3" (`rejects visibility references using params.* ...`) para que ahora afirme la aceptación de `params.{paramName}`, y añadir casos de rechazo para `params` (sin segmento) y `params.user.id` (más de un segmento), más el caso de aceptación con operador del catálogo y rechazo cuando el operador queda fuera del catálogo aunque la referencia sea `params.userId`.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación)
  - **Comportamiento cubierto**:
    - Acepta `visibility.reference: "params.userId"` con `operator: "isTruthy"` y deja la config en `status: 'ready'` sin alterar el resto del bloque `visibility`.
    - Acepta `visibility.reference: "params.mode"` con `operator: "equals"` y `value: "edit"` (literal string).
    - Acepta `visibility.reference: "params.mode"` con `operator: "notEquals"` y `value: "readonly"`.
    - Acepta `visibility.reference: "params.page"` con `operator: "greaterThan"` y `value: 2` (umbral numérico) — pasa la validación; la semántica de no-match es runtime y se cubre en T2.
    - Rechaza `visibility.reference: "params"` (sin segmento dinámico) con mensaje `invalid-layout` apuntando a `layout[<n>].visibility.reference`.
    - Rechaza `visibility.reference: "params.user.id"` (más de un segmento dinámico) con mensaje `invalid-layout` apuntando a `layout[<n>].visibility.reference`.
    - Rechaza `visibility.reference: "params.userId"` cuando `operator` queda fuera del catálogo soportado, con error sobre `layout[<n>].visibility.operator` (paridad con el resto de familias).
    - Sustituir/invertir el test existente "T3" (`rejects visibility references using params.*`) — ese caso ya no aplica y debe pasar a afirmar la aceptación nueva.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts`
  - **Restricciones**: reusar los helpers de la suite (`createConfigWithLayout`, `createVisibilityRule` y equivalentes ya presentes en el fichero) para no duplicar fixtures; no introducir un harness nuevo solo para `params.*`.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/references/visibility.md` — añadir `params.{paramName}` a la lista de referencias admitidas y matizar la validación de shape; pendiente de aplicar vía `update-app-documentation`.
  - `ai-workflow/docs/app-features/references/reference-resolution.md` — actualizar el bloque "Frontera específica de `params.*`" para reflejar que `visibility.reference` deja de estar fuera de alcance; pendiente de aplicar vía `update-app-documentation`.
- **Criterios de finalización**:
  - `isValidVisibilityReference` acepta exactamente `params.{paramName}` (un único segmento tras el namespace) y rechaza `params`, `params.x.y` y demás formas no reconocidas bajo `params`.
  - El mensaje de error literal de `validateVisibility` enumera `params.{paramName}` entre las referencias admitidas.
  - Toda la suite del fichero arriba ejecutada con `pnpm test --run …` queda en verde.
- **Cierre de implementación**: validación previa al render acepta `params.{paramName}` en `visibility.reference` con paridad estricta de un segmento; los predicados `when` siguen aceptando la misma familia sin regresiones; tests de validación de visibilidad actualizados y en verde.

---

## T2 — Cobertura runtime de `visibility` con `params.*`

- **ID**: T2
- **Estado**: completed
- **Objetivo**: añadir tests de runtime que confirmen que `matchesVisibilityRule` evalúa correctamente referencias `params.{paramName}` para todos los operadores soportados, incluyendo la semántica de valor ausente y el degradado a no-match para `greaterThan`/`lessThan` sobre valores string. La feature no debe necesitar código nuevo en runtime; si la cobertura saca a la luz una desviación respecto a la spec, ajustar `runtime-layout-visibility.ts` o `runtime-reference-resolver.ts` de forma estrictamente acotada al caso fallante.
- **Fuera de alcance**:
  - No reabrir el contrato de validación (cubierto por T1).
  - No introducir conversiones implícitas string→número en `normalizeComparableValue`: la spec mantiene la semántica actual donde strings degradan a no-match.
  - No tocar superficies fuera de `visibility` (los `when` se mantienen tal cual; la spec los considera "consistentes sin configuración adicional").
- **Dependencias**: T1 (la validación debe aceptar `params.{paramName}` para que las configs de los tests sean válidas; los tests deben construir el estado vía los flujos públicos del runtime).
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-layout-visibility.ts` (no se espera modificación; ajuste solo si una expectativa de spec falla).
    - `src/runtime/runtime-references/runtime-reference-resolver.ts` (no se espera modificación; ajuste solo si la evaluación no respeta la semántica de ausente).
  - Tests:
    - `src/tests/runtime/runtime-layout-visibility.test.ts` (ampliación): nuevo `describe` para `params.*` con un caso por operador.
  - Documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-layout-visibility.test.ts` (ampliación)
  - **Comportamiento cubierto**:
    - `params.userId` con `operator: "isTruthy"`: el nodo se muestra cuando el param activo contiene un string no vacío; se oculta cuando el param no está presente.
    - `params.userId` con `operator: "isFalsy"`: el nodo se muestra cuando el param está ausente o es string vacío; se oculta cuando es string no vacío.
    - `params.mode` con `operator: "equals"` y `value: "edit"`: el nodo se muestra solo cuando el param activo vale exactamente `"edit"`; se oculta cuando el param vale otro string y cuando está ausente.
    - `params.mode` con `operator: "notEquals"` y `value: "readonly"`: el nodo se muestra cuando el param vale cualquier cosa distinta de `"readonly"`; cuando el param está ausente, el operador no hace match y el nodo se oculta (paridad con la política de valor ausente para operadores no-truthiness).
    - `params.mode` con `operator: "equals"` y `value: true` (boolean) contra un param string `"true"`: comparación estricta → no match → el nodo se oculta.
    - `params.page` con `operator: "greaterThan"` y `value: 2` contra un param string `"3"`: el valor string no es numéricamente comparable con la política actual → no match → el nodo se oculta. Mismo trato para `lessThan` con un threshold mayor.
    - Cambio de página activa que deja de incluir el param referenciado: el nodo evalúa la referencia como ausente y aplica la semántica de valor ausente del operador correspondiente (cubrir al menos `isFalsy` que pasa a verdadero y `equals` que pasa a no-match).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-layout-visibility.test.ts`
  - **Restricciones**:
    - Reusar el harness y helpers del fichero existente (estado runtime, navegación, configs mínimas); no crear un wrapper nuevo solo para `params.*`.
    - Si la fixture actual no expone una forma directa de fijar `params` activos en el estado, reusar el patrón ya empleado por los tests de `params.*` en otras superficies (`runtime-reference-resolution.test.tsx`) en lugar de mockear el store.
    - No añadir snapshots.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/references/visibility.md` — la sección "Reglas funcionales" sigue siendo correcta; verificar al actualizar que los ejemplos no implican exclusión de `params.*`.
  - `ai-workflow/docs/test-index.md` — actualizar la línea del fichero `runtime-layout-visibility.test.ts` solo si la suite cambia de tamaño o se documenta el nuevo área cubierta; pendiente de aplicar vía `update-app-documentation`.
- **Criterios de finalización**:
  - El fichero de test ampliado cubre cada operador con `params.*` según los casos descritos.
  - El comando `pnpm test --run src/tests/runtime/runtime-layout-visibility.test.ts` queda en verde sin modificar el código de runtime, salvo que una expectativa concreta lo exija con un ajuste acotado al caso fallante.
- **Cierre de implementación**: la evaluación en runtime de `visibility` con referencias `params.*` queda verificada por tests para todos los operadores soportados y respeta la semántica de valor ausente y el no-match de comparadores numéricos sobre strings.
