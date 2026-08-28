# Tasks: dev-editor-tokens-panel

Contrato de ejecución para implementar la pestaña "Tokens" del editor de configuración en vivo.
Seis tareas, estrictamente secuenciales por dependencia: T1 y T2 no dependen de nada nuevo; T3
depende de T2; T4 depende de T1; T5 depende de T3 y T4; T6 (wiring final) depende de T5.

Precedentes de código a seguir literalmente (ver `design.md` para la justificación completa):
- `src/dev-runtime/pages-config-panel/scan-orphan-navigate-to-references.ts` y
  `pages-config-panel-orphan-scan.test.ts` — forma del escáner y de su test.
- `src/dev-runtime/pages-config-panel/pages-delete-confirm-dialog.tsx` — diálogo de confirmación
  modal con foco atrapado.
- `src/dev-runtime/api-config-panel/preload-entry-fields-editor.tsx` y
  `api-config-panel/api-config-panel.tsx` — sub-formulario con `<select>` restringido al catálogo
  de `api`, patrón de `pendingRejections`/`onCommitField` por campo, presentación en lista de
  tarjetas (no tabla) para una entrada con contenido condicional.
- `src/dev-runtime/dev-runtime.tsx` (`commitApiMutation`, `commitTranslationsMutation`) — pipeline
  de commit `patchRootKey(lastValidConfigText, '<clave raíz>', mutatedValue)` + `JSON.parse` +
  `validateRuntimeConfig` + `migrateRuntimeStateAcrossConfig` + `flushSync`.
- `src/dev-runtime/floating-toolbar/dev-editor-floating-toolbar.tsx` y `dev-editor-layer.tsx` —
  cableado del botón de dominio y del swap de panel central.

## T1 — Escáner de referencias huérfanas en headers de token

### Objetivo
Crear `scanOrphanTokenHeaderReferences`, función pura que cuenta cuántas filas `headers` de la
config referencian `tokens.{tokenId}.value` como substring, agrupadas por fuente legible.

### Fuera de alcance
- Cualquier UI. Este módulo es exclusivamente lógica pura, sin componente React.
- Reparar o generalizar `scan-orphan-navigate-to-references.ts` (decisión ya cerrada en
  `design.md`, Decisión 3): no tocar ese fichero.
- Usar el resultado desde ningún componente (eso es T4/T5).

### Dependencias
Ninguna. Puede implementarse en paralelo con T2.

### Interfaces
**Consume**: ninguno.

**Produce**:
- `interface TokenHeaderReferenceSource { label: string; count: number }` — consumido por: T4, T5
- `interface TokenHeaderReferenceScan { totalCount: number; sources: TokenHeaderReferenceSource[] }` — consumido por: T4, T5
- `scanOrphanTokenHeaderReferences(config: RuntimeConfig, tokenId: string): TokenHeaderReferenceScan` — consumido por: T5

### Impacto esperado en archivos
- Código: nuevo `src/dev-runtime/tokens-config-panel/scan-orphan-token-header-references.ts`.
- Tests: nuevo `src/tests/dev-runtime/tokens-config-panel-orphan-scan.test.ts`.
- Documentación a revisar o actualizar: `ai-workflow/docs/test-index.md` (añadir la línea del
  fichero de test nuevo bajo `dev-runtime/`, orden alfabético).

### Comportamiento exacto requerido
- Recorrido genérico recursivo (objetos y arrays, sin lista cerrada de nombres de campo de
  acción), igual principio que `scanOrphanNavigateToReferences` pero con un predicado distinto:
  en vez de igualdad estructural exacta, busca cualquier propiedad **literalmente llamada
  `headers`** cuyo valor sea un objeto plano; para cada valor string de ese objeto, cuenta 1 si
  `value.includes(`tokens.${tokenId}.value`)` es `true` (substring literal, sin regex). Un valor
  no-string dentro de un `headers` no cuenta ni lanza error.
- Raíces recorridas, cada una generando como máximo una entrada en `sources` (omitida si su
  cuenta es 0):
  - Por cada `[operationId, operation]` de `Object.entries(config.api)`: recorrer `operation`
    completo; label `` `en la operación «${operationId}»` ``.
  - Por cada `page` de `config.pages`: recorrer `page.layout`; label `` `en la página «${page.id}»` ``.
  - `config.preloads` (precargas globales, puede ser `undefined`): recorrer el array completo;
    label `'en las precargas globales'`.
  - Por cada `page` de `config.pages`: recorrer `page.preloads` (puede ser `undefined`); label
    `` `en las precargas de la página «${page.id}»` ``.
- `totalCount` es la suma de `count` de todas las `sources`.
- Un `config` sin ninguna coincidencia devuelve `{ totalCount: 0, sources: [] }`.
- El orden de `sources` es el orden de recorrido de arriba: operaciones de `api` en el orden de
  `Object.keys(api)`, luego páginas en el orden de `config.pages`, luego precargas globales, luego
  precargas de página en el orden de `config.pages`.

### Tests
**Ficheros de test**:
- `src/tests/dev-runtime/tokens-config-panel-orphan-scan.test.ts` (nuevo)

**Comportamiento cubierto**:
- Devuelve `totalCount: 0` y `sources: []` sin ninguna referencia en ningún sitio.
- Detecta una referencia `tokens.{id}.value` dentro de un header de `api.{op}.headers` cuyo valor
  es una plantilla más amplia (p. ej. `"Bearer {{tokens.sessionToken.value}}"`), no solo una
  igualdad exacta de valor completo.
- Detecta una referencia dentro de `button.props.action.headers` y de `form.submitAction.headers`
  anidados en el `layout` de una página, sin conocer esos nombres de campo explícitamente (mismo
  criterio genérico que el escáner de páginas).
- Detecta una referencia dentro de `executeOperations[].headers` (incluida una anidada en
  `onSuccess`/`onError`).
- Detecta una referencia en una entrada de `preloads[].headers` tanto en las precargas globales
  como en las precargas de una página concreta, con las etiquetas de fuente correctas.
- Cuenta múltiples referencias en la misma fuente como entradas independientes sumadas en
  `totalCount`, y agrupadas en una sola entrada de `sources` con `count` correcto para esa fuente.
- No cuenta una referencia a `tokens.otroId.value` cuando se busca `tokenId` distinto (no hay
  colisión de substring entre `tokens.a.value` y `tokens.ab.value`, gracias al `.value` final
  literal del patrón).
- No lanza al recorrer un `headers` con un valor no-string (number/boolean/null) en alguna fila.
- No lanza cuando `config.preloads`, o el `preloads` de una página concreta, están `undefined`.
- El orden de `sources` sigue exactamente el orden documentado arriba (operaciones → páginas →
  precargas globales → precargas de página).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/dev-runtime/tokens-config-panel-orphan-scan.test.ts`

**Restricciones**:
- No reutilizar ni modificar `scan-orphan-navigate-to-references.ts`; es un módulo nuevo e
  independiente (Decisión 3 de `design.md`).

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md` (comportamiento del aviso de
referencias huérfanas al borrar un token, dentro de la futura sección "Sección Tokens").

### Criterios de finalización
`scanOrphanTokenHeaderReferences` implementada y exportada con la forma exacta de
`Interfaces → Produce`, con todos los casos de `Comportamiento cubierto` en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run` del fichero de test en
verde).

---

## T2 — Soporte `disabled`/`disabledReason` en `BooleanPropertyField`

### Objetivo
Extender el switch booleano compartido (`BooleanPropertyField`) con dos props opcionales,
`disabled` y `disabledReason`, para que el widget de refresco de token (T3) pueda deshabilitarlo
con un motivo explícito cuando `api` no declara ninguna operación — sin romper ninguno de sus
consumidores actuales, que no pasan estas props y deben seguir comportándose exactamente igual.

### Fuera de alcance
- Cualquier otro cambio visual o de comportamiento de `BooleanPropertyField`.
- Tocar a sus consumidores actuales (`property-field-dispatcher.tsx`, `condition-group-property-field.tsx`, `table-column-flags-field.tsx`, `shell-config-panel.tsx`): ninguno pasa las props nuevas, así que ninguno cambia de comportamiento.

### Dependencias
Ninguna. Puede implementarse en paralelo con T1.

### Interfaces
**Consume**: ninguno.

**Produce**:
- `BooleanPropertyField(props: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean; disabledReason?: string }): JSX.Element` — consumido por: T3

### Impacto esperado en archivos
- Código: modificar `src/dev-runtime/layout-canvas/property-fields/boolean-property-field.tsx`.
- Tests: nuevo `src/tests/dev-runtime/boolean-property-field.test.tsx` (el componente no tenía
  fichero de test dedicado; solo se cubría indirectamente a través de sus consumidores).
- Documentación a revisar o actualizar: `ai-workflow/docs/test-index.md` (añadir la línea del
  fichero de test nuevo).

### Comportamiento exacto requerido
- `disabled` por defecto `false`; `disabledReason` por defecto `undefined`.
- Con `disabled: true`: el `<button role="switch">` recibe el atributo nativo `disabled` y, si
  `disabledReason` está presente, `title={disabledReason}`. Pulsarlo no invoca `onChange`.
- Con `disabled: false` (o ausente): comportamiento idéntico al actual — sin atributo `disabled`,
  sin `title`, `onChange(!value)` se invoca al pulsar.
- `aria-checked` sigue reflejando `value` con independencia de `disabled`.

### Tests
**Ficheros de test**:
- `src/tests/dev-runtime/boolean-property-field.test.tsx` (nuevo)

**Comportamiento cubierto**:
- Sin `disabled`, pulsar el switch invoca `onChange` con el valor invertido (regresión del
  comportamiento actual).
- Con `disabled: true` y `disabledReason` definido, el botón tiene el atributo `disabled` y
  `title` igual a `disabledReason`; pulsarlo no invoca `onChange`.
- Con `disabled: true` y `disabledReason` ausente, el botón tiene `disabled` pero no `title`.
- `aria-checked` refleja `value` tanto en estado habilitado como deshabilitado.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/dev-runtime/boolean-property-field.test.tsx`

**Restricciones**:
- No introducir un segundo componente; extender las props del existente.

### Documentación afectada
Ninguna (widget interno; su uso visible se documenta desde T3/T5).

### Criterios de finalización
`BooleanPropertyField` acepta `disabled`/`disabledReason` con el comportamiento exacto descrito,
sin regresión en sus consumidores actuales (suite completa en verde), y con los casos de
`Comportamiento cubierto` de esta tarea en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T3 — `TokenRefreshFieldsEditor` (sub-formulario del bloque `refresh`)

### Objetivo
Construir el sub-formulario aislado para activar/desactivar y editar el sub-bloque `refresh`
completo (`operation`, `responsePath`, `intervalSeconds`) de un token, según Decisión 4 de
`design.md`.

### Fuera de alcance
- Cualquier lógica de listado, alta o borrado de tokens (T5).
- El commit real contra `currentConfig`: este componente es puramente presentacional — recibe el
  valor actual y expone callbacks; quien mutua y commitea es su consumidor (T5).

### Dependencias
T2 (usa `BooleanPropertyField` con `disabled`/`disabledReason`).

### Interfaces
**Consume**:
- `BooleanPropertyField(props: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean; disabledReason?: string }): JSX.Element` (de T2)

**Produce**:
- `type TokenRefreshField = 'operation' | 'responsePath' | 'intervalSeconds'` — consumido por: T5
- `type TokenRefreshPendingEntry = { value: unknown; error: RuntimeConfigError }` — consumido por: T5
- `type TokenRefreshPendingRejections = Partial<Record<string, TokenRefreshPendingEntry>>` — consumido por: T5
- `tokenRefreshFieldRejectionKey(tokenId: string, field: TokenRefreshField): string` — consumido por: T5
- `interface TokenRefreshFieldsEditorProps { tokenId: string; refresh: RuntimeTokenRefreshConfig | undefined; apiOperationNames: string[]; pendingRejections: TokenRefreshPendingRejections; onToggleRefresh: (enabled: boolean) => void; onCommitRefreshField: (field: TokenRefreshField, nextValue: unknown) => void }` — consumido por: T5
- `TokenRefreshFieldsEditor(props: TokenRefreshFieldsEditorProps): JSX.Element` — consumido por: T5

### Impacto esperado en archivos
- Código: nuevo `src/dev-runtime/tokens-config-panel/token-refresh-fields-editor.tsx`.
- Tests: nuevo `src/tests/dev-runtime/token-refresh-fields-editor.test.tsx`.
- Documentación a revisar o actualizar: `ai-workflow/docs/test-index.md` (añadir la línea del
  fichero de test nuevo).

### Comportamiento exacto requerido
- **Switch de activación** (`BooleanPropertyField`, valor `refresh !== undefined`): al activarse
  (`false → true`), invoca `onToggleRefresh(true)`. Al desactivarse, invoca `onToggleRefresh(false)`.
  El componente no construye ni destruye el objeto `refresh` por sí mismo — delega esa decisión al
  consumidor a través de `onToggleRefresh`.
- **Deshabilitado sin operaciones**: si `apiOperationNames.length === 0` **y** `refresh` es
  `undefined` (el switch está apagado), el switch se pasa `disabled: true` con
  `disabledReason: 'No hay ninguna operación declarada en Api; declara al menos una antes de activar el refresco.'`.
  Si `apiOperationNames.length === 0` pero `refresh` ya está definido (activado antes de que la
  última operación de `api` se borrara), el switch permanece habilitado para poder desactivarlo,
  aunque no haya operación disponible que ofrecer en el `<select>` de `operation`.
- **Campos condicionales**: `operation`/`responsePath`/`intervalSeconds` solo se renderizan cuando
  `refresh !== undefined`.
  - `operation`: `<select>` cuyas `<option>` son exactamente `apiOperationNames` (sin opción de
    respaldo). El valor seleccionado es `refresh.operation`; si ese valor no está en
    `apiOperationNames` (referencia rota), el `<select>` simplemente no tiene ninguna `<option>`
    marcada como seleccionada para ese valor — no se inyecta una opción adicional ni se fuerza otro
    valor. Cambiar la selección invoca `onCommitRefreshField('operation', nextValue)`.
  - `responsePath`: input de texto libre (reutiliza `TextPropertyField`). Cambiarlo invoca
    `onCommitRefreshField('responsePath', nextValue)`.
  - `intervalSeconds`: input numérico (reutiliza `NumberPropertyField`). Cambiarlo invoca
    `onCommitRefreshField('intervalSeconds', nextValue)`.
- **Feedback por campo**: cada uno de los tres campos consulta
  `pendingRejections[tokenRefreshFieldRejectionKey(tokenId, field)]`; si existe, el campo muestra
  el `value` pendiente en vez del valor de `refresh` (el valor tecleado no se pierde) y renderiza
  `CommitRejectionBanner` con ese `error`, con `dataTestId` `` `token-refresh-${tokenId}-${field}-error` ``.

### Tests
**Ficheros de test**:
- `src/tests/dev-runtime/token-refresh-fields-editor.test.tsx` (nuevo)

**Comportamiento cubierto**:
- Con `refresh: undefined`, solo se ve el switch (apagado); los tres campos no están en el DOM.
- Con `refresh` definido, se ven los tres campos con los valores de `refresh`, y el switch está
  encendido.
- Activar el switch con `refresh: undefined` invoca `onToggleRefresh(true)` y ningún otro callback.
- Desactivar el switch con `refresh` definido invoca `onToggleRefresh(false)`.
- Con `apiOperationNames: []` y `refresh: undefined`, el switch está deshabilitado con el
  `disabledReason` exacto de arriba como `title`.
- Con `apiOperationNames: []` pero `refresh` definido, el switch sigue habilitado (se puede
  desactivar) y el `<select>` de `operation` no tiene ninguna `<option>`.
- Cambiar `operation`/`responsePath`/`intervalSeconds` invoca `onCommitRefreshField` con el campo y
  valor correctos, uno por vez, sin disparar los otros dos.
- `refresh.operation` con un valor fuera de `apiOperationNames` no rompe el render: el `<select>`
  se muestra sin esa opción, y `responsePath`/`intervalSeconds` siguen editables con normalidad.
- Con una entrada en `pendingRejections` para `responsePath` (usando
  `tokenRefreshFieldRejectionKey`), el campo muestra el valor pendiente en vez de `refresh.responsePath`
  y aparece `CommitRejectionBanner` con `role="alert"` y el `dataTestId` esperado; los otros dos
  campos no muestran ningún aviso.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/dev-runtime/token-refresh-fields-editor.test.tsx`

**Restricciones**:
- No registrar este componente en `WIDGET_REGISTRY`/`x-widget` del dispatcher de `Layout`: es
  bespoke, montado directamente por T5 (Decisión 4 de `design.md`).

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md` (widget del sub-bloque `refresh`
dentro de la futura sección "Sección Tokens").

### Criterios de finalización
`TokenRefreshFieldsEditor` implementado con la forma exacta de `Interfaces → Produce`, con todos
los casos de `Comportamiento cubierto` en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T4 — `TokenDeleteConfirmDialog`

### Objetivo
Diálogo modal de confirmación de borrado de un token, calcado de
`pages-delete-confirm-dialog.tsx` (Decisión 5 de `design.md`), mostrando el resultado del escáner
de T1 cuando `totalCount > 0`.

### Fuera de alcance
- Calcular el escaneo: lo recibe ya calculado como prop (lo invoca T5 antes de abrir el diálogo).
- Cualquier condición de deshabilitado previa a abrir el diálogo: no existe para tokens (a
  diferencia de `Páginas`), el botón "Eliminar" del listado siempre abre este diálogo.

### Dependencias
T1 (usa `TokenHeaderReferenceScan`).

### Interfaces
**Consume**:
- `interface TokenHeaderReferenceScan { totalCount: number; sources: TokenHeaderReferenceSource[] }` (de T1)

**Produce**:
- `interface TokenDeleteConfirmDialogProps { tokenId: string; scan: TokenHeaderReferenceScan; onConfirm: () => void; onCancel: () => void }` — consumido por: T5
- `TokenDeleteConfirmDialog(props: TokenDeleteConfirmDialogProps): JSX.Element` — consumido por: T5

### Impacto esperado en archivos
- Código: nuevo `src/dev-runtime/tokens-config-panel/token-delete-confirm-dialog.tsx`.
- Tests: nuevo `src/tests/dev-runtime/token-delete-confirm-dialog.test.tsx`.
- Documentación a revisar o actualizar: `ai-workflow/docs/test-index.md` (añadir la línea del
  fichero de test nuevo).

### Comportamiento exacto requerido
Mismo comportamiento que `PagesDeleteConfirmDialog` (ver
`src/dev-runtime/pages-config-panel/pages-delete-confirm-dialog.tsx` como referencia literal de
implementación), adaptado a token:
- `role="alertdialog"`, `aria-modal="true"`, `aria-label` con el `tokenId` (p. ej.
  `` `Eliminar token «${tokenId}»` ``).
- Overlay `fixed inset-0` que cierra (`onCancel`) al hacer click fuera del panel.
- Foco atrapado con `Tab`/`Shift+Tab` dentro del panel (mismo `getFocusableElements` local que
  `PagesDeleteConfirmDialog`, sin extraer un hook compartido — no existe ninguno hoy).
- `Esc` invoca `onCancel`.
- Al montar, mueve el foco al primer elemento enfocable del panel; al desmontar, devuelve el foco
  al elemento que lo tenía antes de abrirse.
- Con `scan.totalCount > 0`: muestra un bloque de aviso (`data-testid="token-delete-confirm-orphan-warning"`)
  listando `scan.totalCount` y cada entrada de `scan.sources` con su `label`/`count`. Es puramente
  informativo — nunca deshabilita el botón "Eliminar".
- Con `scan.totalCount === 0`: no se muestra el bloque de aviso.
- Botones "Cancelar" (invoca `onCancel`) y "Eliminar" (invoca `onConfirm`).

### Tests
**Ficheros de test**:
- `src/tests/dev-runtime/token-delete-confirm-dialog.test.tsx` (nuevo)

**Comportamiento cubierto**:
- Renderiza con `role="alertdialog"` y `aria-modal="true"`.
- Con `scan.totalCount: 0`, no se ve el bloque de aviso.
- Con `scan.totalCount > 0` y varias `sources`, se ve el bloque de aviso con el total y cada fuente
  listada con su `label`/`count`.
- Click en "Cancelar" invoca `onCancel`; click en "Eliminar" invoca `onConfirm`.
- Click en el overlay (fuera del panel) invoca `onCancel`; click dentro del panel no lo invoca.
- `Esc` invoca `onCancel`.
- Al montar, el foco se mueve a un elemento del panel; al desmontar, el foco vuelve al elemento
  que lo tenía antes de abrirse.
- `Tab` desde el último elemento enfocable vuelve al primero (y `Shift+Tab` desde el primero al
  último) — ciclo de foco atrapado dentro del panel.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/dev-runtime/token-delete-confirm-dialog.test.tsx`

**Restricciones**:
- Implementar el foco-trampa localmente (`useRef`/`useCallback`/`useEffect`), sin crear ni buscar
  un hook compartido (Decisión 5 de `design.md`: no existe ninguno hoy entre paneles).

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md` (confirmación de borrado de token
dentro de la futura sección "Sección Tokens").

### Criterios de finalización
`TokenDeleteConfirmDialog` implementado con la forma exacta de `Interfaces → Produce`, con todos
los casos de `Comportamiento cubierto` en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T5 — `TokensConfigPanel` (panel de dominio completo)

### Objetivo
Construir el panel de formulario `TokensConfigPanel`: listado de tokens, alta, edición de
`value`, integración del sub-formulario `refresh` (T3) y borrado con confirmación (T4) y escaneo
de huérfanas (T1). Cubre los requisitos funcionales FR2-FR9 de `spec.md`.

### Fuera de alcance
- El cableado en la barra flotante y en `DevEditorLayer`/`dev-runtime.tsx` (T6): este componente
  no se monta desde ningún sitio real todavía al cerrar esta tarea, igual que
  `PagesConfigPanel` quedó tras su propia tarea de construcción antes de cablearse.
- Cualquier cambio a `validate-tokens-config.ts` o al schema Zod de `tokens`: ya existen y no
  cambian (No objetivos de `design.md`).

### Dependencias
T3 (usa `TokenRefreshFieldsEditor` y sus tipos/helper de rejection key), T4 (usa
`TokenDeleteConfirmDialog`). Indirectamente T1 (invoca `scanOrphanTokenHeaderReferences` antes de
abrir el diálogo de T4).

### Interfaces
**Consume**:
- `interface TokenHeaderReferenceScan { totalCount: number; sources: TokenHeaderReferenceSource[] }` (de T1)
- `scanOrphanTokenHeaderReferences(config: RuntimeConfig, tokenId: string): TokenHeaderReferenceScan` (de T1)
- `type TokenRefreshField = 'operation' | 'responsePath' | 'intervalSeconds'` (de T3)
- `type TokenRefreshPendingEntry = { value: unknown; error: RuntimeConfigError }` (de T3)
- `type TokenRefreshPendingRejections = Partial<Record<string, TokenRefreshPendingEntry>>` (de T3)
- `tokenRefreshFieldRejectionKey(tokenId: string, field: TokenRefreshField): string` (de T3)
- `interface TokenRefreshFieldsEditorProps { tokenId: string; refresh: RuntimeTokenRefreshConfig | undefined; apiOperationNames: string[]; pendingRejections: TokenRefreshPendingRejections; onToggleRefresh: (enabled: boolean) => void; onCommitRefreshField: (field: TokenRefreshField, nextValue: unknown) => void }` (de T3)
- `TokenRefreshFieldsEditor(props: TokenRefreshFieldsEditorProps): JSX.Element` (de T3)
- `interface TokenDeleteConfirmDialogProps { tokenId: string; scan: TokenHeaderReferenceScan; onConfirm: () => void; onCancel: () => void }` (de T4)
- `TokenDeleteConfirmDialog(props: TokenDeleteConfirmDialogProps): JSX.Element` (de T4)

**Produce**:
- `interface TokensConfigPanelProps { config: RuntimeConfig; tokens: RuntimeTokensConfig | undefined; api: RuntimeApiConfig; onCommitTokensMutation: (mutate: (tokens: RuntimeTokensConfig) => RuntimeTokensConfig) => CommitCanvasMutationResult }` — consumido por: T6
- `TokensConfigPanel(props: TokensConfigPanelProps): JSX.Element` — consumido por: T6
- `normalizeTokenId(rawId: string): string` — sin consumidores directos (uso interno de este
  módulo; se declara para dejar constancia del contrato tal como `normalizePageId` lo hace en su
  propio fichero)
- `isDuplicateTokenId(normalizedId: string, tokens: RuntimeTokensConfig): boolean` — sin
  consumidores directos

### Impacto esperado en archivos
- Código: nuevo `src/dev-runtime/tokens-config-panel/tokens-config-panel.tsx` y nuevo
  `src/dev-runtime/tokens-config-panel/tokens-config-panel-rules.ts` (mismo rol que
  `pages-config-panel-rules.ts`: `normalizeTokenId`/`isDuplicateTokenId`, funciones puras).
- Tests: nuevo `src/tests/dev-runtime/tokens-config-panel.test.tsx`.
- Documentación a revisar o actualizar: `ai-workflow/docs/test-index.md` (añadir la línea del
  fichero de test nuevo).

### Comportamiento exacto requerido
- **Listado vacío**: con `tokens` `undefined` o `{}`, el panel muestra
  `"Sin operaciones declaradas."` en vez de lista (mismo texto y criterio literal que `Api` con
  `api` vacío, FR2 de `spec.md`).
- **Listado**: una tarjeta por token (mismo patrón visual que la lista de operaciones de
  `ApiConfigPanel`: `<ul>` de `<li>` con borde), mostrando el `id` (solo lectura), un input de
  `value` (editable, ver abajo), el sub-formulario de T3 para `refresh`, y un botón "Eliminar
  token {id}" con `aria-label` explícito que abre el flujo de borrado.
- **Edición de `value`**: input de texto libre con draft local por `id` de token, que commitea al
  perder el foco (`blur`) solo si el valor cambió respecto al persistido — mismo criterio que el
  campo `title` de `PagesConfigPanel`. A diferencia de `title`, un `value` vacío tras recortar no
  se convierte en `undefined`: se intenta commitear tal cual y, como `validateTokensConfig` ya
  rechaza `value` vacío, el commit vuelve `status: 'rejected'`; el panel entonces conserva el draft
  tecleado y muestra `CommitRejectionBanner` (`dataTestId` `` `tokens-config-panel-value-${id}-error` ``)
  — no hay pre-chequeo local de vacío para `value`, la validación real es la única fuente de
  rechazo.
- **Alta de token** (FR3): formulario "Añadir token" con `id` y `value` (`TextPropertyField` para
  ambos, mismo patrón que "Añadir operación" de `ApiConfigPanel`). El botón "Añadir" se deshabilita
  con un motivo mostrado como texto bajo el formulario mientras `normalizeTokenId(id)` esté vacío
  o `isDuplicateTokenId(normalizedId, tokens ?? {})` sea `true`, o mientras `value === ''` —
  mismo criterio de recorte/comparación exacta sensible a mayúsculas que `Páginas`/`Api`. Al
  confirmar, commitea `{ ...tokens, [normalizedId]: { value } }` (sin `refresh`). Un commit
  rechazado por la validación real (caso residual no cubierto por el pre-chequeo local) conserva
  los valores tecleados y muestra `CommitRejectionBanner` (`dataTestId="tokens-config-panel-add-error"`).
  Un alta exitosa limpia el formulario.
- **Sin control de renombrado** (FR7): no existe ningún campo editable para `id` de un token ya
  creado.
- **Integración de `refresh`** (FR5, delega en T3): por cada token, monta
  `TokenRefreshFieldsEditor` con `apiOperationNames={Object.keys(api)}`. `onToggleRefresh(true)`
  commitea añadiendo `refresh: { operation: Object.keys(api)[0], responsePath: 'data', intervalSeconds: 60 }`
  al token (primera operación disponible como valor inicial, ya que el switch solo puede activarse
  cuando `apiOperationNames` no está vacío salvo el caso "ya estaba activado" descrito en T3).
  `responsePath: 'data'` se elige deliberadamente no vacío porque
  `runtimeTokenRefreshSchema.responsePath` usa `nonEmptyStringSchema`
  (`src/config/runtime-config-zod.ts`) y rechaza siempre una cadena vacía — un `refresh` recién
  activado con `responsePath: ''` haría fallar el commit del toggle en el 100% de los casos; el
  valor por defecto de este panel debe ser siempre un string no vacío editable después por el
  usuario. `onToggleRefresh(false)` commitea retirando la clave `refresh` por completo del token,
  sin tocar `value`. `onCommitRefreshField(field, nextValue)` commitea
  `{ ...token, refresh: { ...token.refresh, [field]: nextValue } }`. Cada commit de `refresh`
  (toggle o campo) que sea rechazado registra su rejection en el mapa
  `TokenRefreshPendingRejections` de este panel bajo la clave `tokenRefreshFieldRejectionKey(id, field)`
  (el toggle en sí no tiene campo propio de rejection: un rechazo al activar/desactivar se
  registra bajo el campo `'operation'` si aplica).
- **Borrado con confirmación** (FR8, delega en T4/T1): el botón "Eliminar token {id}" siempre abre
  el diálogo (sin condición de deshabilitado previa) — antes de abrirlo, invoca
  `scanOrphanTokenHeaderReferences(props.config, id)` (usa la prop `config: RuntimeConfig` completa
  del panel — ver `Interfaces → Produce` — nunca reconstruida a partir de `tokens`/`api` sueltos) y
  pasa el resultado como `scan` al diálogo. Confirmar borra la clave `id` de `tokens` en un único
  commit. Un commit rechazado muestra `CommitRejectionBanner` junto a la tarjeta de ese token
  (`dataTestId` `` `tokens-config-panel-delete-${id}-error` ``).
- Todas las mutaciones pasan por `onCommitTokensMutation`, nunca por un estado local paralelo.

### Tests
**Ficheros de test**:
- `src/tests/dev-runtime/tokens-config-panel.test.tsx` (nuevo)

**Comportamiento cubierto**:
- Con `tokens: undefined` y con `tokens: {}`, se muestra `"Sin operaciones declaradas."`.
- Con varios tokens, se ve una tarjeta por cada uno con su `id` y su `value` actual.
- Crear un token con `id`/`value` válidos invoca `onCommitTokensMutation` con una función que,
  aplicada al estado previo, produce `{ ...prev, [id]: { value } }` sin `refresh`; el formulario se
  limpia tras el alta.
- El botón "Añadir" está deshabilitado con `id` vacío, con `id` duplicado (comparación exacta
  sensible a mayúsculas, con espacios recortados), y con `value` vacío — cada caso probado por
  separado.
- Editar el `value` de un token y perder el foco commitea el nuevo valor solo si cambió respecto
  al persistido (perder el foco sin cambiar el valor no invoca `onCommitTokensMutation`).
- Vaciar `value` y perder el foco intenta el commit igualmente (no hay pre-chequeo local); si
  `onCommitTokensMutation` devuelve `rejected`, el draft vacío se conserva y aparece el
  `CommitRejectionBanner` correspondiente.
- Activar `refresh` en un token invoca `onCommitTokensMutation` añadiendo el sub-bloque `refresh`
  con los valores iniciales documentados arriba (`operation` = primera clave de `api`,
  `responsePath: 'data'`, `intervalSeconds: 60`); desactivarlo invoca `onCommitTokensMutation`
  retirando `refresh` sin tocar `value`.
- El `refresh` construido al activar el toggle, aplicado contra `validateTokensConfig` real (no un
  mock), pasa la validación (`responsePath` no vacío) — regresión explícita del hueco detectado en
  la revisión de este plan: un `responsePath` por defecto vacío haría fallar todo alta de
  `refresh`.
- Cambiar un campo de `refresh` ya activo invoca `onCommitTokensMutation` con solo ese campo
  mutado, y un rechazo de ese commit se refleja como aviso aislado por token y por campo (dos
  tokens con el mismo campo de `refresh` rechazado no interfieren entre sí).
- Pulsar "Eliminar token {id}" invoca `scanOrphanTokenHeaderReferences` con la config y el `id`
  correctos y abre `TokenDeleteConfirmDialog` con ese resultado como `scan`.
- Confirmar el borrado invoca `onCommitTokensMutation` retirando esa clave de `tokens`; cancelar no
  invoca ningún commit y cierra el diálogo.
- Un commit de borrado rechazado muestra el aviso junto a la tarjeta de ese token sin cerrar el
  listado.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/dev-runtime/tokens-config-panel.test.tsx`

**Restricciones**:
- Seguir el estilo de presentación en lista de tarjetas de `ApiConfigPanel` (no el de tabla de
  `PagesConfigPanel`), porque cada entrada tiene contenido condicional (los tres campos de
  `refresh`) que no encaja bien en una fila de tabla.
- No introducir ningún estado que duplique `currentConfig`: los drafts locales (`value` en
  edición, formulario de alta) son los únicos estados propios de este panel, todo lo demás se lee
  de las props.

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md` (nueva sección "Sección Tokens
(dominio de configuración)", con la misma estructura que las secciones Api/Páginas ya
documentadas: objetivo y alcance, listado, alta, edición de `value`, sub-bloque `refresh`,
borrado y confirmación, pipeline de commit).

### Criterios de finalización
`TokensConfigPanel` implementado con la forma exacta de `Interfaces → Produce`, con todos los
casos de `Comportamiento cubierto` en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T6 — Cableado: pipeline de commit, barra flotante y `DevEditorLayer`

### Objetivo
Cablear `TokensConfigPanel` en el editor real: pipeline de commit `commitTokensMutation` en
`dev-runtime.tsx`, habilitación del botón "Tokens" en la barra flotante, y render condicional del
panel en `DevEditorLayer` cuando `activeDomain === 'tokens'`. Cubre FR1 y FR10 de `spec.md`, y
cierra la feature.

### Fuera de alcance
- Cualquier cambio a `TokensConfigPanel` ni a sus sub-componentes: se consumen tal cual quedaron en
  T5.
- Cualquier otro dominio de la barra (`Layout`/`Api`/`Páginas`/`Traducciones`/`Shell`): no cambian
  de comportamiento, solo se ajusta el tipo `ToolbarDomain` para incluir `'tokens'` como miembro
  válido adicional.

### Dependencias
T5 (consume `TokensConfigPanel`/`TokensConfigPanelProps` tal cual).

### Interfaces
**Consume**:
- `interface TokensConfigPanelProps { tokens: RuntimeTokensConfig | undefined; api: RuntimeApiConfig; onCommitTokensMutation: (mutate: (tokens: RuntimeTokensConfig) => RuntimeTokensConfig) => CommitCanvasMutationResult }` (de T5)
- `TokensConfigPanel(props: TokensConfigPanelProps): JSX.Element` (de T5)

**Produce**: ninguno (tarea de integración final; no expone ningún contrato nuevo para otra tarea).

### Impacto esperado en archivos
- Código:
  - `src/dev-runtime/dev-runtime.tsx`: nueva función `commitTokensMutation` (mismo pipeline que
    `commitApiMutation`, ver referencia de patrón más abajo) y su paso como prop
    `onCommitTokensMutation` a `DevEditorLayer`.
  - `src/dev-runtime/floating-toolbar/dev-editor-floating-toolbar.tsx`: `ToolbarDomain` pasa a
    incluir `'tokens'`; el botón `dev-editor-toolbar-domain-tokens` deja de tener
    `disabled`/`aria-disabled="true"`/`title="Próximamente"` y gana `aria-pressed={isTokensActive}`
    y `onClick={() => onDomainSelected('tokens')}`, igual patrón que los otros botones de dominio
    habilitados.
  - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx`: `DevEditorLayerProps` gana
    `onCommitTokensMutation: (mutate: (tokens: RuntimeTokensConfig) => RuntimeTokensConfig) => CommitCanvasMutationResult`;
    el `if (domain === 'shell' || ...)` de `handleDomainSelected` gana `|| domain === 'tokens'`; el
    render condicional final se reestructura para distinguir explícitamente `'pages'` de
    `'tokens'` (ya no un `else` final que asume `'pages'` por descarte) y monta
    `<TokensConfigPanel tokens={config.tokens} api={config.api} onCommitTokensMutation={onCommitTokensMutation} />`
    cuando `activeDomain === 'tokens'`.
- Tests:
  - `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` (ampliación).
  - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación).
- Documentación a revisar o actualizar: ninguna adicional a la ya declarada en T1-T5 para
  `dev-mode-editor.md` (esta tarea no introduce comportamiento funcional nuevo más allá de hacerlo
  alcanzable desde la barra).

### Comportamiento exacto requerido
- `commitTokensMutation(mutate: (tokens: RuntimeTokensConfig) => RuntimeTokensConfig): CommitCanvasMutationResult`
  sigue exactamente el mismo cuerpo que `commitApiMutation` (ver `dev-runtime.tsx` líneas ~591-622
  como referencia literal de implementación), sustituyendo `api`/`'api'`/`currentConfig.api` por
  `tokens`/`'tokens'`/`(currentConfig.tokens ?? {})`: `patchRootKey(lastValidConfigText, 'tokens', mutatedTokens)`,
  `JSON.parse`, `validateRuntimeConfig`, migración de estado vía `migrateRuntimeStateAcrossConfig`
  si hay estado previo, y el mismo `flushSync` de `setCurrentConfig`/`setEditorBuffer`/
  `setLastValidConfigText`/`setHasPendingChanges`/`setHasAppliedChanges`/`setParseError`/
  `setValidationError` que ya usan todos los demás `commit*Mutation`.
- El botón "Tokens" de la barra queda habilitado exactamente igual que `Api`/`Páginas`: sin
  `disabled`, sin `aria-disabled`, sin `title="Próximamente"`, con `aria-pressed` reflejando si
  `activeDomain === 'tokens'`, y disparando `onDomainSelected('tokens')` al pulsarlo. Su posición
  en la barra no cambia (ya está entre `Páginas` y `Traducciones`).
- Entrar en el dominio `'tokens'` desde cualquier otro limpia `selectedPath`/`hoveredPath`, igual
  que entrar en `shell`/`translations`/`api`/`pages` (mismo bloque `if` en `handleDomainSelected`).
- Con `activeDomain === 'tokens'`, el área central sustituye por completo el canvas/overlay/paleta
  de `Layout` y muestra `TokensConfigPanel`, exactamente igual que el resto de dominios de
  formulario.

### Tests
**Ficheros de test**:
- `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` (ampliación)
- `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación)

**Comportamiento cubierto**:
- `dev-editor-floating-toolbar.test.tsx`:
  - Sustituir el test `'renders tokens as disabled with aria-disabled and title="Próximamente"'`
    por uno que verifique que el botón está habilitado, sin `aria-disabled` ni `title="Próximamente"`,
    y con `toHaveTextContent('Tokens')` (mismo patrón que el test ya existente
    `'the api tab exists, is enabled and reads "Api"'`).
  - Eliminar el test `'clicking a disabled domain tab does not invoke any callback'` (con esta
    tarea ya no queda ningún dominio deshabilitado en la barra).
  - Eliminar los dos tests de regresión `'regression: tokens remains disabled ...'` (ya no aplican).
  - Añadir un test de `aria-pressed` con `activeDomain: 'tokens'` (marca tokens como `pressed` y
    layout como no `pressed`), mismo patrón que el test equivalente de `shell`/`translations`/`api`.
  - Añadir un test `'clicking the tokens tab invokes onDomainSelected("tokens")'`, mismo patrón
    que el resto de dominios.
- `dev-editor-layer.test.tsx`:
  - Nuevo bloque `describe('DevEditorLayer / Tokens domain')`: renderiza `TokensConfigPanel` (real,
    no mockeado) y deja de renderizar el canvas al activar la pestaña `Tokens`, mismo patrón que
    `'DevEditorLayer / Api domain (0132-T5)'`.
  - Actualizar el test existente `'clears a canvas node selection when entering Shell (same policy as api/pages/tokens)'`
    (o el bloque de test equivalente que ya menciona `tokens` en su descripción) para incluir
    también una aserción real entrando en el dominio `'tokens'`, no solo la mención en el nombre
    del test.
  - Nuevo bloque `describe('DevEditorLayer / Tokens domain real commit pipeline')`: mismo patrón
    que `'DevEditorLayer / Pages domain real commit pipeline (0138-T5)'` — monta `DevEditorLayer`
    con una función `commitTokensMutation` local construida con el mismo
    `patchRootKey`/`validateRuntimeConfig` real usados en ese bloque existente, activa la pestaña
    `Tokens`, añade/edita/borra un token desde el panel real y verifica que el texto crudo
    resultante refleja el cambio (sin pasar por un mock del pipeline de commit).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx`
- `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`

**Restricciones**:
- No introducir ningún mock de `TokensConfigPanel` en `dev-editor-layer.test.tsx`: igual que
  `Api`/`Páginas`, el componente real se monta en los tests de este fichero (el patrón de mock ya
  existente en el fichero, si lo hay para otro dominio anterior, no se replica para `tokens`).

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md`:
- Línea de "Selector de pestaña de dominio" (§ Barra flotante de herramientas): `Tokens` pasa de
  única pestaña no funcional a las seis funcionales.
- § "Editor visual del layout" → "Objetivo y alcance": retirar la frase que dice que `tokens`
  "queda fuera de esta entrega" y sustituirla por la referencia a la nueva sección Tokens.
- § "Límites del editor visual" → "Alcance funcional": mismo ajuste, retirar la mención de
  `tokens` como excluido.

### Criterios de finalización
Botón "Tokens" habilitado y funcional end-to-end desde la barra flotante hasta `currentConfig`,
con todos los casos de `Comportamiento cubierto` de esta tarea en verde y sin regresión en el
resto de la suite de `dev-runtime`.

### Cierre de implementación
Código y tests de esta tarea completos y validados; feature completa y lista para
`update-app-documentation`.

---

## Siguiente tarea a escoger
T1 y T2 pueden implementarse en cualquier orden o en paralelo (sin dependencia mutua); a partir de
ahí el orden es estrictamente T3 → T4 → T5 → T6 (T4 puede adelantarse a T3 si T1 ya está cerrada,
ya que T4 solo depende de T1, pero T5 no puede empezar hasta que tanto T3 como T4 estén cerradas).
Si no hay preferencia, empezar por **T1**.
