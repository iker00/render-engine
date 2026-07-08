> Cuándo leer: si la tarea toca el editor de configuración en vivo, el drawer lateral, la preservación de estado al aplicar cambios, el autocompletado JSON Schema o el comportamiento de recarga por HMR en desarrollo.
> Tamaño: medio.
> Relacionados: [[local-config.md]], [[../config/validation.md]].

# Editor de configuración en vivo (dev mode)

## Objetivo
Permitir editar el JSON de configuración directamente en el navegador durante el desarrollo, validarlo con el mismo validador del runtime y aplicarlo para ver el resultado al instante, sin recargar la página ni depender de backend.

## Activación
El editor solo existe si el host monta `<DevRuntime />` desde `src/dev-runtime/dev-runtime.tsx`. La decisión se toma en el bootstrap (`main.tsx`) y responde a dos condiciones:

- Si `import.meta.env.DEV` es `true` (modo desarrollo), `DevRuntime` se monta siempre.
- Si el bundle es producción (`import.meta.env.DEV === false`) pero el elemento raíz contiene el atributo HTML `data-enable-dev-mode`, `DevRuntime` también se monta.

En producción sin el atributo, `main.tsx` monta `<App />` directamente y Monaco ni el wrapper aparecen en el bundle inicial. El atributo se evalúa una sola vez en el bootstrap; modificarlo en DevTools después de cargar la página no tiene efecto.

## Arranque
`DevRuntime` reutiliza la misma frontera de bootstrap que el runtime: prioridad `data-config` en el elemento root, con `src/dev/config.json` como respaldo. Si el JSON inicial es inválido, la frontera de error de bootstrap existente aplica antes de que el editor sea utilizable.

## Interfaz
- **Botón flotante** siempre visible en esquina inferior derecha mientras el wrapper esté montado, independientemente de la página activa del runtime.
- **Drawer lateral derecho** que se superpone al runtime sin alterar su ancho ni layout interno.
- **Atajo de teclado** `Ctrl/Cmd+Shift+J` para abrir y cerrar; `Esc` para cerrar cuando está abierto.
- Al abrir el drawer por primera vez en la sesión, el contenido del editor es el JSON inicial formateado (formato original, no la forma normalizada interna del validador).
- Los cambios en el editor persisten en memoria entre cierres y aperturas del panel en la misma sesión. Recargar la página descarta cambios sin aplicar.

## Autocompletado JSON Schema
El editor Monaco registra un JSON Schema derivado del schema Zod raíz (`runtimeConfigRootSchema` en `src/config/runtime-config-root-zod.ts`) usando el método built-in `toJSONSchema` de Zod v4. No se usa la librería externa `zod-to-json-schema` porque no es compatible con Zod v4 (el package está instalado como dependencia pero no se importa). El schema cubre el contrato completo del runtime config incluyendo la unión discriminada de nodos por `type`, y las propiedades opcionales `translations` y `tokens` con sus definiciones completas.

## Acción Aplicar
1. Parsea el texto del editor como JSON; si falla, muestra el error de sintaxis en el panel adjunto y no actualiza el runtime.
2. Valida el JSON parseado con `validateRuntimeConfig`; si falla, muestra `error.code` y `error.message` en el panel adjunto con la ruta canónica tal cual la devuelve el validador.
3. Si la validación es correcta, migra el estado existente al nuevo config (ver § Preservación de estado) y re-renderiza el runtime con el nuevo JSON activo.
4. Tras un aplicar exitoso, `hasPendingChanges` queda en `false` y el buffer del editor se mantiene como está (no se re-serializa el config normalizado, para evitar romper un segundo aplicar).

## Acción Copiar al portapapeles
Copia el texto actual del editor, no el JSON activo del runtime. Usa `navigator.clipboard.writeText` cuando está disponible; si no, cae al fallback `document.execCommand('copy')`.

## Preservación de estado al aplicar
Cuando se aplica un nuevo config (vía botón Aplicar o vía HMR, ver § HMR), `migrateRuntimeStateAcrossConfig` calcula el estado migrado antes de actualizar `currentConfig`:

- **Formularios**: los `formId` que siguen existiendo en el nuevo árbol se conservan con solo los `fieldId` que también sigan existiendo. Los `formId` o `fieldId` que desaparecen se descartan silenciosamente.
- **Queries**: las queries cacheadas cuyos nombres siguen declarados en `api` se preservan intactas (`data`, `status`, `error`, `requestSignature`). Las eliminadas desaparecen.
- **Navegación**: si la página activa sigue existiendo en `pages`, la navegación se conserva con sus `params` y un histórico reducido a una entrada. Si no existe, degrada a `initialPage` del nuevo config con `params: {}`.
- **PageEntry**: se recalcula coherentemente con la navegación migrada.
- **Translations**: `i18n.translations` se reconstruye desde el bloque `translations` del nuevo config. Si el nuevo config no declara `translations`, se usa un objeto vacío. `i18n.activeLanguage` se preserva del estado previo.
- **Tokens**: el estado de `tokens` se reconstruye desde el bloque `tokens` del nuevo config con la misma semántica que el bootstrap inicial (cada token con su `value` del config, `status: 'ready'`, `failedAttempts: 0`). Si el nuevo config no declara `tokens`, se usa un objeto vacío.

El dispatch de migración de estado se lanza antes de actualizar `currentConfig` para que los `layoutEffect` del provider vean el estado migrado desde el primer render con el nuevo config.

## HMR: recarga automática al editar config.json en disco
Cuando `src/dev/config.json` cambia en disco durante el desarrollo, Vite's HMR actualiza el módulo y `DevRuntime` recibe un nuevo `initialConfig`. Un `useEffect` en `DevRuntimeReady` detecta el cambio de referencia de `initialConfig` y aplica automáticamente el nuevo config con la misma migración de estado que el botón Aplicar. El editor se reinicia (buffer a `null`) para mostrar el nuevo JSON en la próxima apertura.

Esto permite editar `config.json` directamente en el editor de código y ver el resultado en el navegador sin tocar el drawer. El estado de la sesión (navegación, formularios, queries) se preserva en la medida en que el nuevo config lo permita.

## Guardia de cambios aplicados (unsaved changes guard)
Cuando el usuario pulsa el botón Aplicar y la validación es exitosa, se activa una guardia que intercepta cualquier intento de descargar la página (recargar, navegar fuera, cerrar la pestaña, etc.) mostrando un diálogo nativo del navegador que advierte al usuario de que perderá los cambios aplicados si continúa.

### Activación
La guardia se activa exactamente en el primer Aplicar exitoso de la sesión. Una vez activada, permanece activa hasta que la página se descargue realmente, aunque:
- Se apliquen cambios adicionales (segundo Aplicar exitoso, HMR).
- Se cierre el drawer del editor.
- Se navegue dentro del runtime por hash (la navegación interna por hash no descarga la página y no desactiva la guardia).

### Comportamiento
- **Activación correcta**: Tras un Aplicar exitoso (validación pasada, config aceptado), el diálogo nativo del navegador aparece al recargar, navegar fuera, cerrar la pestaña, etc.
- **Errores de validación o sintaxis**: Un Aplicar fallido por JSON inválido o validación estructural no activa la guardia. El usuario debe aplicar un cambio válido para activarla.
- **Cancelar el diálogo**: Si el usuario elige "quedarse en la página" cuando el navegador lo pregunta, la página no se descarga y los cambios aplicados se conservan.
- **Confirmar el diálogo**: Si el usuario elige "abandonar la página", la descarga prosigue normalmente y el runtime se reinicia desde `config.json` del disco, perdiendo los cambios aplicados de la sesión.

### Límites de la guardia
- El diálogo muestra un mensaje genérico del navegador; no es personalizable (política de seguridad de navegadores modernos).
- Solo intercepta descargas reales de la página (recargar, navegar a URL distinta, cerrar pestaña). No aplica a la navegación interna del runtime por hash.
- No persiste la configuración aplicada en `localStorage`, `sessionStorage` o disco; es únicamente para avisar al usuario durante la sesión.
- No existe ningún elemento visual adicional (banner, badge, indicador) más allá del diálogo nativo.

## Límites
- No persiste cambios entre sesiones del navegador (`localStorage`/`sessionStorage` fuera de alcance).
- No descarga el JSON como archivo.
- No resalta errores de validación inline en Monaco; solo los muestra en el panel adjunto.
- No permite varias instancias simultáneas del editor.
- No modifica el contrato observable del runtime ni su frontera pública de errores.
