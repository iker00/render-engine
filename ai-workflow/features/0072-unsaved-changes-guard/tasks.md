# Tasks: unsaved-changes guard en el editor Monaco (0072)

Contrato de ejecución para la implementación. Las tareas están ordenadas; cada tarea debe completarse antes de iniciar la siguiente.

---

## T1 — Activar la guardia `beforeunload` tras el primer Aplicar exitoso

### Estado
completada

### Objetivo
Añadir al componente `DevRuntimeReady` de `src/dev-runtime/dev-runtime.tsx` una guardia que active el diálogo nativo de confirmación del navegador al intentar descargar la página cuando el usuario ya ha aplicado al menos un cambio de configuración exitoso en la sesión actual.

El comportamiento concreto, según la spec:
- Mantener un estado `hasAppliedChanges` inicializado a `false`.
- Pasarlo a `true` exactamente cuando un Aplicar termina en éxito (validación + reset de estado + commit del nuevo `currentConfig`). Una vez `true`, no vuelve a `false` durante el ciclo de vida del componente: Aplicar fallidos no lo tocan, segundos Aplicar exitosos lo mantienen, HMR no lo resetea, cerrar el drawer no lo resetea.
- Mientras `hasAppliedChanges === true` y el componente está montado, debe existir un único listener registrado en `window.beforeunload`. El handler asigna `event.returnValue = ''` y retorna una string no vacía (`''` cuenta como vacía; debe retornarse una string como `'unsaved-changes'` o equivalente para forzar el diálogo nativo en navegadores que aún consulten el valor de retorno). Es el patrón estándar para activar el prompt nativo, sin personalización del texto (los navegadores modernos lo ignoran).
- Al desmontarse `DevRuntimeReady`, el listener debe quitarse vía `removeEventListener`. Si nunca llegó a registrarse (el usuario no aplicó nada), la limpieza no hace nada.
- Si `hasAppliedChanges` pasa de `false` a `true`, se añade el listener. Si volviera a cambiar (no debería en esta feature), la dependencia del `useEffect` se encarga de reconciliar listener.

La implementación recomendada es un `useEffect` cuyo único disparador es `hasAppliedChanges`. Cuando es `true`, registra el handler en `window` y devuelve la función de limpieza. Cuando es `false`, el efecto no registra nada y retorna `undefined`. El estado se actualiza dentro del bloque `flushSync` del Aplicar exitoso, junto al resto de setters del éxito (`setCurrentConfig`, `setParseError`, `setValidationError`, `setHasPendingChanges`).

No introducir helpers en otros ficheros, ni mover lógica fuera de `dev-runtime.tsx`. La guardia es parte natural del wrapper.

### Fuera de alcance
- Cualquier intervención sobre la navegación interna del runtime (acciones `navigateTo`/`goBack`, hash routing). El hash no descarga la página y no entra en el contrato de esta feature.
- Personalizar el texto del diálogo de `beforeunload` o añadir UI propia (banner, badge, indicador visual extra). El único feedback al usuario es el diálogo nativo.
- Persistir la configuración aplicada en `localStorage`, `sessionStorage` o disco.
- Activar la guardia con ediciones del buffer de Monaco que no hayan pasado por Aplicar (eso es `hasPendingChanges`, que ya existe y no se toca).
- Resetear `hasAppliedChanges` en ningún flujo: una vez activado en la sesión, queda `true` hasta el unload real.
- Cambios en `DevRuntimeDrawer`, `DevRuntimeMonacoEditor`, `DevRuntimeToggleButton`, los stores de runtime o cualquier validador. La feature es estrictamente local al componente `DevRuntimeReady`.
- Tocar el comportamiento HMR existente. La spec exige explícitamente que HMR no resetee el flag; basta con que ningún camino lo ponga a `false`.
- Activar la guardia en producción cuando `DevRuntime` no está montado (la guardia solo existe si `DevRuntimeReady` está montado, por construcción).

### Dependencias
Ninguna.

### Impacto esperado en archivos

- Código:
  - `src/dev-runtime/dev-runtime.tsx` (modificación) — añadir el estado `hasAppliedChanges`, su actualización en `handleApply` dentro del bloque de éxito (`flushSync`), y el `useEffect` que registra/limpia el listener `beforeunload`. No alterar la firma de `DevRuntime`/`DevRuntimeReady` ni añadir props nuevas.

- Tests:
  - `src/tests/dev-runtime/dev-runtime.test.tsx` (ampliación) — añadir un nuevo `describe('DevRuntime unsaved changes guard', ...)` con los casos enumerados en la sección de tests. Reusar `minimalConfig`, `secondConfig` y `makeRootElement` ya definidos en el fichero; no introducir un harness nuevo.

- Documentación:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` — añadir la guardia como parte del contrato estable del editor. La actualización se ejecuta vía `update-app-documentation` al cerrar la feature; no forma parte de esta tarea.

### Tests

#### Ficheros de test
- `src/tests/dev-runtime/dev-runtime.test.tsx` (ampliación)

#### Comportamiento cubierto

- Antes de pulsar Aplicar en la sesión, `window.addEventListener` no ha sido invocado con el evento `'beforeunload'` por el componente. Equivalente: al disparar un `beforeunload` simulado (`new Event('beforeunload', { cancelable: true })` despachado en `window`), el evento no es prevenido por la app y su `defaultPrevented` queda `false`.
- Tras el primer Aplicar exitoso, `window.addEventListener` ha sido invocado exactamente una vez con `'beforeunload'` y la función registrada está activa. Despachar un `beforeunload` simulado en `window` produce que el handler asigne `returnValue` y retorne una string no vacía (verificar leyendo `event.returnValue` después del dispatch, o espiando el handler retornado).
- Tras un Aplicar fallido por JSON inválido (`'{invalid json'`), el listener no se ha registrado. Tras un Aplicar fallido por validación estructural (config con `initialPage` inexistente), el listener tampoco. En ambos casos, despachar `beforeunload` no es prevenido.
- Tras un Aplicar fallido seguido de un Aplicar exitoso en la misma sesión, el listener queda registrado una sola vez y `beforeunload` queda activo a partir del éxito.
- Tras un segundo Aplicar exitoso en la misma sesión, el listener sigue activo y no se ha registrado un duplicado (verificar contando llamadas a `addEventListener` con `'beforeunload'`; debe ser exactamente una a lo largo del flujo).
- Al desmontar el componente (vía `unmount()` del render), `removeEventListener` se ha invocado con `'beforeunload'` y el mismo handler que se registró previamente. Tras el desmontaje, despachar `beforeunload` ya no es prevenido por la app.
- Si el componente se desmonta sin que jamás se haya pulsado Aplicar, ni `addEventListener` ni `removeEventListener` se han invocado con `'beforeunload'`.

#### Comandos durante la implementación
- `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx`
- `pnpm test`

#### Restricciones
- Espiar `window.addEventListener` y `window.removeEventListener` con `vi.spyOn(window, 'addEventListener')` / `vi.spyOn(window, 'removeEventListener')` antes del `render`, y restaurarlos en el `afterEach` o con `mockRestore()`. Filtrar las invocaciones por el tipo de evento `'beforeunload'` para no contar listeners ajenos al test (por ejemplo de jsdom u otros efectos del runtime).
- Para verificar el bloqueo del unload, disparar `window.dispatchEvent(new Event('beforeunload', { cancelable: true }))` y comprobar `event.defaultPrevented` o `event.returnValue` después. No simular la recarga real del navegador.
- Reusar `minimalConfig`, `secondConfig` y `makeRootElement` ya presentes en el fichero. No definir configs nuevas salvo que se requiera un caso de Aplicar fallido por validación que ya esté cubierto por configs existentes en el fichero.
- No añadir snapshots ni assertions sobre el texto del diálogo nativo: el navegador lo ignora y no es testeable.
- No tocar los `describe` preexistentes (`DevRuntime bootstrap`, `DevRuntime toggle and drawer`, `DevRuntime Apply`, `DevRuntime Copy`, `DevRuntime no-regression`, `DevRuntime data-values pre-seeding`). Añadir el nuevo `describe` al final del fichero, antes o después del de data-values, según queden agrupados los casos de Apply.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` — añadir una sección que describa la guardia: cuándo se activa (primer Aplicar exitoso de la sesión), qué hace (registra `beforeunload` y dispara el diálogo nativo), qué no hace (no personaliza el texto, no persiste, no se desactiva, no aplica a la navegación por hash). Coordinar con la sección "Límites" para mantener coherencia.

### Criterios de finalización
- `DevRuntimeReady` mantiene un estado `hasAppliedChanges` que pasa de `false` a `true` exactamente al primer Aplicar exitoso y nunca vuelve a `false`.
- Mientras `hasAppliedChanges === true` y el componente está montado, hay exactamente un listener `beforeunload` registrado por la app.
- Al desmontar el componente, el listener queda limpiado.
- Aplicar fallidos (sintaxis o validación) no activan la guardia.
- HMR de `config.json` no modifica `hasAppliedChanges`.
- En producción sin `data-enable-dev-mode`, `DevRuntime` no se monta y, por construcción, no hay listener.
- `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx` pasa en verde con los nuevos casos.
- `pnpm test` pasa en verde y sigue cumpliendo el umbral del 80 % de cobertura.

### Cierre de implementación
T1 está cerrada cuando el estado y el efecto están integrados en `dev-runtime.tsx`, los nuevos tests del fichero `dev-runtime.test.tsx` pasan en verde, y `pnpm test` no rompe regresiones ni cobertura. Al cerrar T1 la feature queda lista para invocar `update-app-documentation`, que reflejará la guardia en `ai-workflow/docs/app-features/development/dev-mode-editor.md`.

---

## Próxima tarea
T1 — Activar la guardia `beforeunload` tras el primer Aplicar exitoso.
