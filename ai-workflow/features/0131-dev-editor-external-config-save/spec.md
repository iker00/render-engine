# 0131 — Guardado del config hacia backend externo y config de endpoints

## Objetivo

Añadir al editor de desarrollo la primera vía real de persistencia del config JSON hacia un backend externo, hoy
inexistente (el editor solo aplica cambios en memoria de sesión). Concretamente:

1. Un nuevo bloque de **configuración de endpoints externos**, declarado en runtime (mismo patrón que `data-config`),
   que reemplaza los valores hoy fijos en build (URL base por variable de entorno) usados por la sincronización de
   Traducciones.
2. Un botón **"Guardar"** en la barra flotante persistente del editor, con atajo de teclado **Ctrl+S** (Cmd+S en Mac),
   que persiste el config activo completo hacia ese backend.
3. La **migración** de las dos operaciones de sincronización de Traducciones (`0130`) para que consuman esa misma config
   de endpoints en vez de su URL fija actual y de la selección manual de token.

## Alcance

- Nuevo bloque de configuración de endpoints externos, declarado vía un atributo del elemento host (p. ej.
  `data-endpoints-config`) con la misma prioridad y patrón de fallback que `data-config`: si el atributo no está
  presente, se usa un fichero local versionado en `src/dev/` para poder iterar sin backend real.
- Ese bloque declara, por instalación:
    - una URL base común para las tres operaciones;
    - por cada una de las tres operaciones (buscar textos, obtener traducciones por lote, guardar configuración): su
      path y una referencia (`tokenId`) a un token ya declarado en `tokens.*` del config activo, a usar como
      `Authorization: Bearer`;
    - los tres identificadores de negocio fijos que exige la operación de guardado (`IdGestion`, `IdSeccion`,
      `IdObjetoOcurrencia`).
- Cada una de las tres operaciones puede declararse de forma independiente: es válido tener configuradas las dos de
  Traducciones sin la de Guardar, o viceversa.
- Nuevo botón "Guardar" en la barra flotante, junto a los controles ya existentes (selector de página, dominio, paleta,
  Monaco, modo).
- Atajo de teclado Ctrl+S/Cmd+S equivalente al click del botón, con `preventDefault` para suprimir el diálogo nativo del
  navegador, activo mientras `DevRuntime` está montado.
- Guardar serializa el **config activo ya aplicado y válido** (`currentConfig`, el mismo que gestiona la guardia de
  cambios aplicados) como JSON minificado y lo envía a la operación de guardado configurada. No opera sobre cambios sin
  aplicar del buffer de Monaco.
- Feedback de guardado: indicador de carga mientras la petición está en curso, confirmación de éxito, y aviso de error (
  red o HTTP) con el mismo criterio visual (`role="alert"`/`role="status"`) ya usado en el resto del editor.
- Migración de las dos operaciones de Traducciones: dejan de depender de `VITE_PLATAGES_API_BASE_URL`/el host
  hardcodeado y del desplegable manual de selección de token; pasan a resolver base URL, path y token desde la nueva
  config de endpoints, igual que Guardar.
- El desplegable de selección de token que hoy existe en el panel Traducciones (`0130`) se retira, ya que el token pasa
  a resolverse automáticamente desde la config de endpoints.
- Sin la operación correspondiente declarada en la config de endpoints (o sin `tokenId` resoluble contra los `tokens.*`
  del config activo), el control afectado (Guardar, o cada acción de Traducciones de forma independiente) queda visible
  pero deshabilitado, con un mensaje explicando qué falta declarar — mismo patrón ya usado hoy para "sin token
  declarado".

## Fuera de alcance

- Mapeo de campos genérico o soporte para un backend con contrato de request/response distinto al ya definido por
  PlataGes para estas tres operaciones. La config solo generaliza parámetros de conexión (URL, paths, IDs de negocio,
  referencia de token); el shape de cada payload sigue codificado tal cual el contrato actual.
- Cualquier UI para editar la config de endpoints desde el propio editor visual; se declara solo vía atributo del host o
  fichero local, sin panel de edición (igual que `data-config`).
- Guardado parcial o por sección (Layout/Shell/Traducciones por separado). Guardar siempre persiste el documento
  completo.
- Autoguardado periódico o disparado al aplicar cambios. El guardado es siempre una acción explícita del usuario (botón
  o Ctrl+S).
- Deshacer/rehacer del guardado, historial de versiones guardadas o comparación con la última versión guardada en el
  backend.
- Cambios en el comportamiento de la guardia de cambios aplicados (unsaved changes guard) ya existente; sigue avisando
  igual ante recarga/cierre, sin distinguir si hubo un guardado exitoso hacia el backend.
- Validación adicional en el front de la regla de negocio "el `IdObjetoOcurrencia` guardado debe ser 267"; el front
  envía lo que declare la config y muestra tal cual el error que el backend devuelva si la rechaza.
- Cualquier cambio en el contrato JSON del runtime consumido en producción, o en su frontera pública de errores.
  Exclusivo del editor de desarrollo, igual que `0130`.
- Soporte para más de un backend/proveedor simultáneo, o cambiar de proveedor sin recargar la página.

## Requisitos funcionales

**Config de endpoints**

- FR1: El bootstrap del editor de desarrollo lee la config de endpoints priorizando el atributo del host declarado en el
  elemento raíz; si está ausente, usa un fichero local versionado en `src/dev/` como respaldo. Sin ninguno de los dos,
  la config de endpoints se considera no declarada.
- FR2: Una config de endpoints declarada puede incluir 0, 1, 2 o las 3 operaciones (buscar textos, obtener traducciones
  por lote, guardar configuración); cada una se evalúa de forma independiente para habilitar su control correspondiente
  en el editor.
- FR3: Un JSON de config de endpoints sintácticamente inválido, o que no cumpla el shape mínimo esperado, se trata igual
  que la config de endpoints ausente para todas las operaciones (todos los controles afectados quedan deshabilitados con
  el mismo mensaje que "no declarada"), sin bloquear el arranque del resto del editor ni del runtime.

**Botón Guardar y atajo Ctrl+S**

- FR4: El botón "Guardar" aparece siempre en la barra flotante, en cualquier dominio activo (Layout, Shell,
  Traducciones), independientemente del modo (Visual/Editor).
- FR5: "Guardar" está habilitado solo cuando la operación de guardado está declarada en la config de endpoints con un
  `tokenId` que resuelve a un `tokens.*` existente en el config activo. En caso contrario está deshabilitado con un
  mensaje explicando la causa (operación no declarada, o token declarado que no existe en `tokens.*`).
- FR6: Al pulsar "Guardar" (o Ctrl+S/Cmd+S con el mismo efecto), se envía el config activo (`currentConfig`) serializado
  como JSON minificado a la operación de guardado configurada, con el token resuelto como `Authorization: Bearer`.
- FR7: Mientras la petición de guardado está en curso, "Guardar" muestra un indicador de carga (`role="status"`) y queda
  deshabilitado para evitar envíos duplicados por doble click o doble pulsación de Ctrl+S.
- FR8: Un guardado exitoso muestra una confirmación visible al usuario. Un guardado fallido (red o HTTP, incluido
  401/403) muestra un aviso `role="alert"` con un mensaje de error, sin alterar `currentConfig` ni el estado del editor.
- FR9: Ctrl+S/Cmd+S se captura con `preventDefault` mientras `DevRuntime` está montado, para evitar el diálogo nativo "
  Guardar página" del navegador.

**Migración de Traducciones (0130)**

- FR10: Las acciones "Buscar y añadir" y "Refrescar todo" del panel Traducciones resuelven base URL, path y token desde
  la config de endpoints en vez de la URL fija por variable de entorno de build y la selección manual de token.
- FR11: El desplegable de selección de token en el panel Traducciones se retira; cada acción se habilita o deshabilita
  de forma independiente según si su operación está declarada en la config de endpoints con `tokenId` resoluble.
- FR12: El comportamiento observable de "Buscar y añadir" y "Refrescar todo" ya documentado en `0130` (resultados,
  atomicidad de "Refrescar todo", mapeo de errores 401/403, etc.) no cambia; solo cambia el origen de la URL/path/token
  usados para llamarlas.

## Requisitos no funcionales

- Consistencia con los patrones ya establecidos del editor: mismo criterio de feedback (`role="alert"`/`role="status"`),
  mismo estilo de mensajes de error en español, mismo patrón de prioridad atributo-de-host/fichero-local que
  `data-config`.
- Sin dependencias externas nuevas; reutiliza `fetch` como el resto de la integración con PlataGes.
- Sin cambios en el contrato observable del runtime de producción ni en su bundle inicial; exclusivo de `DevRuntime`,
  igual que `0130`.
- El atajo Ctrl+S no debe interferir con el atajo nativo de guardado del navegador ni con otros atajos ya reservados por
  el editor (`Esc` para cerrar paneles).

## Criterios de aceptación

- Con la config de endpoints declarando las 3 operaciones y un `tokenId` válido: "Guardar" está habilitado, lo mismo
  que "Buscar y añadir" y "Refrescar todo".
- Sin config de endpoints declarada (ni atributo ni fichero local): los tres controles están deshabilitados, cada uno
  con un mensaje explicando la causa.
- Con solo la operación de guardado declarada (sin las de Traducciones): "Guardar" está habilitado; "Buscar y añadir"
  y "Refrescar todo" están deshabilitados.
- Pulsar "Guardar" con un config activo válido envía el JSON minificado de `currentConfig` con el header
  `Authorization: Bearer <valor resuelto>` a la URL/path configurados para la operación de guardado.
- Ctrl+S (o Cmd+S) con "Guardar" habilitado dispara el mismo envío que el click del botón, y no dispara el diálogo
  nativo del navegador.
- Una respuesta HTTP no exitosa de la operación de guardado (incluido 401/403, y un rechazo de negocio por
  `IdObjetoOcurrencia` incorrecto) muestra un aviso `role="alert"` con el mensaje recibido o uno genérico, sin modificar
  `currentConfig`.
- Con cambios sin aplicar en Monaco (buffer distinto del config activo), pulsar Guardar/Ctrl+S guarda igualmente el
  último config aplicado (`currentConfig`), no el buffer pendiente.
- Un `tokenId` declarado en la config de endpoints para una operación que no corresponde a ningún `tokens.*` del config
  activo deja esa operación deshabilitada con mensaje específico, sin afectar a las demás operaciones declaradas
  correctamente.
- "Buscar y añadir" y "Refrescar todo" siguen mostrando el mismo comportamiento observable (resultados, atomicidad,
  mapeo de errores) ya cubierto por los tests de `0130`, ahora resolviendo URL/path/token desde la nueva config de
  endpoints.

## Casos límite

- Config de endpoints presente pero con solo alguna de las 3 operaciones declaradas: cada control se
  habilita/deshabilita de forma independiente (ver FR2).
- Config de endpoints sintácticamente inválida: se trata igual que ausente para todo el editor, sin romper el arranque (
  FR3).
- `tokenId` referenciado no existe entre los `tokens.*` del config activo: operación afectada deshabilitada con mensaje
  específico, sin afectar a las demás.
- El token referenciado existe pero su valor actual está vacío o en estado de error de refresco (ver `auth/tokens.md`):
  se intenta la llamada igualmente con el valor actual disponible; un rechazo 401/403 del backend se muestra con el
  mismo mensaje de error de autenticación ya usado hoy.
- Doble click en "Guardar" o Ctrl+S repetido mientras una petición de guardado ya está en curso: no dispara una segunda
  petición (FR7).
- Guardar con `currentConfig` en un estado que, por construcción, ya pasó `validateRuntimeConfig` al aplicarse: no
  requiere una segunda validación antes de enviarse.
- Cambiar de página o de dominio en la barra flotante mientras una petición de guardado está en curso: no cancela la
  petición; el resultado (éxito o error) se sigue mostrando cuando llegue.

## Riesgos o preguntas abiertas

- Alcance exacto de la captura de Ctrl+S (¿listener global mientras `DevRuntime` está montado, o acotado a que algún
  panel del editor tenga el foco?) — decisión técnica para `generate-feature-design`.
- Shape/JSON Schema exacto del bloque de config de endpoints y nombre final del atributo de host y del fichero local de
  respaldo — decisión técnica para `generate-feature-design`.
- Mensaje de confirmación de éxito de Guardar (toast, banner temporal, etc.) — se resuelve como decisión de UI en
  design/implementación, coherente con los patrones visuales ya usados en el editor.

## Áreas de producto afectadas

- `development/dev-mode-editor.md`: barra flotante (nuevo botón Guardar y atajo Ctrl+S), sección Traducciones (retirada
  del desplegable de token, nuevo origen de URL/path/token).
- `development/local-config.md`: nuevo mecanismo de config declarado vía atributo de host + fallback local, análogo a
  `data-config`.
- `auth/tokens.md`: sin cambios de contrato; se referencia como consumidor existente de `tokens.*` (lookup por
  `tokenId`, no una superficie nueva de interpolación `{{tokens.*}}`).

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/development/dev-mode-editor.md`
- `ai-workflow/docs/app-features/development/local-config.md`
- `ai-workflow/docs/app-features/development/index.md` (si cambia el resumen de cuándo leer cada sub-documento)
- `ai-workflow/docs/current-state.md` (última feature relevante de "Desarrollo local")
