# Design: Feature 2026-08-21-12-59 - dev-editor-tokens-panel

## Contexto
El editor de configuración en vivo (`src/dev-runtime/`) ya resuelve el mismo problema de fondo tres veces: un panel de dominio bespoke (sin canvas ni selección de nodo) que sustituye el área central mientras esa pestaña de la barra flotante está activa, con su propio pipeline de commit sobre una clave raíz del config. Precedentes directamente reutilizables:

- **`pages-config-panel/`**: tabla + formulario de alta, edición de campo simple al perder el foco (`title`), confirmación de borrado modal (`role="alertdialog"`) con escaneo previo de referencias huérfanas (`scan-orphan-navigate-to-references.ts`), commit vía `patchRootKey`.
- **`api-config-panel/`**: dos sub-vistas, listado con `"Sin operaciones declaradas."` cuando está vacío, alta rechazada con aviso local antes de commitear, desplegable de operación restringido a `Object.keys(api)` (sin lista de respaldo cuando la referencia queda rota), editor clave-valor compartido (`KeyValuePropertyField`) para `headers`/`query`/`body`, commit vía `patchRootKey('api', ...)`.
- **`dev-runtime.tsx`**: expone `patchRootKey(lastValidConfigText, <clave>, <valorMutado>)` ya usado para `shell`, `translations`, `api`, `preloads` (raíz) e `initialPage` — parchea una única clave raíz del texto crudo, valida y aplica, sin reserializar el resto del documento.
- **`src/config/`**: el schema Zod raíz ya incluye `tokens` en producción (`runtime-config-root-zod.ts`) y ya existe `validate-tokens-config.ts` (unicidad estructural por ser un `Record` keyed por `id`, forma de `value`/`refresh`, referencia de `refresh.operation` contra `api`). Esta feature es UI-only sobre `src/dev-runtime/`; no toca `src/config/`.
- **Componentes de campo compartidos y ya reutilizados por paneles bespoke** (no solo por el dispatcher genérico de `Layout`): `SegmentedTogglePropertyField`, `KeyValuePropertyField`, `CommitRejectionBanner`, y el switch booleano existente. Confirmado que `api-config-panel` ya los importa fuera del contexto de nodo/dispatcher, así que no hay fricción arquitectónica en reutilizarlos desde un panel nuevo.
- **`scan-orphan-navigate-to-references.ts`**: recorrido recursivo genérico (toda clave de todo objeto/array, sin lista cerrada de campos de acción) que cuenta apariciones de una forma exacta (`{ type: 'navigateTo', pageId }`) dentro de raíces concretas (`page.layout` de cada página, `shell.header`, `shell.sidebar`).

## Objetivos / No objetivos

### Objetivos
- Diseñar `TokensConfigPanel` como cuarto panel de dominio bespoke, con el mismo encaje en la barra flotante y en `dev-runtime.tsx` que `Api`/`Páginas`.
- Diseñar el sub-formulario de `refresh` (alta/edición/baja) sin precedente exacto en el editor.
- Diseñar el escaneo de referencias huérfanas en headers, decidiendo si reutiliza o no el escáner de páginas ya existente.
- Confirmar el pipeline de commit correcto para `tokens` entre las dos variantes ya existentes (`patchRootKey` simple vs. preservación raw por-página).

### No objetivos
- No se diseña el contrato Zod de `tokens` ni su validación cruzada: ya existen y no cambian.
- No se diseña ningún cambio en `layout`, `Shell`, `Api`, `Traducciones` ni en el mecanismo de refresco runtime de tokens (`runtime-state/`): esta feature es exclusivamente un panel de edición sobre config estático.
- No se diseña deshacer/rehacer, persistencia entre sesiones ni pickers contextuales: fuera de alcance explícito de la spec, coherente con el resto de paneles de dominio.

## Decisiones

### 1. Ubicación y estructura del panel
Nuevo módulo `src/dev-runtime/tokens-config-panel/` con un componente `TokensConfigPanel`, mismo tipo de sección que `Shell`/`Api`/`Traducciones`/`Páginas`: sin selección de nodo, breadcrumb ni panel de propiedades, sustituye por completo el área central mientras la pestaña `Tokens` está activa.
- Habilitar el botón `Tokens` en la barra flotante (quitar `aria-disabled` y el título "Próximamente"), igual criterio de montaje/limpieza de selección de `Layout` que ya aplica a `Shell`/`Api`/`Traducciones`/`Páginas` al entrar en cualquiera de ellas.
- **Alternativa descartada**: anidar la gestión de tokens dentro de `api-config-panel/` como tercera sub-vista (junto a "Operaciones"/"Preloads"). Se descarta porque la barra flotante ya trata `Tokens` como pestaña de primer nivel independiente (no una sub-vista de `Api`), y porque el propio dominio (`tokens`) es una clave raíz distinta de `api` con su propio pipeline de commit — mezclar ambos en un mismo componente acoplaría dos claves raíz sin necesidad real.

### 2. Pipeline de commit
Toda mutación del panel (alta, baja, edición de `value`, alta/edición/baja de `refresh`) construye el objeto `tokens` completo mutado en memoria y lo commitea con `patchRootKey(lastValidConfigText, 'tokens', mutatedTokens)`, exactamente el mismo patrón que `shell`/`translations`/`api`.
- Se descarta el patrón de preservación raw por-página que usa `pages`/`preloads` de página (`patchRawConfigTextWithPages`), porque `tokens` no tiene una divergencia raw/normalizado anidada por entrada — es un `Record` plano de un solo nivel, igual de simple que `api`.
- Un commit exitoso activa la misma guardia de cambios aplicados (`unsaved changes guard`) que el resto de paneles, sin lógica adicional.

### 3. Escaneo de referencias huérfanas en headers: escáner nuevo, no generalizar el existente
Se construye un escáner dedicado (`scan-orphan-token-header-references.ts` o nombre equivalente) dentro de `tokens-config-panel/`, en vez de generalizar `scan-orphan-navigate-to-references.ts`.

**Por qué**: la forma de coincidencia es distinta, no solo el criterio de campo:
- El escáner de páginas testea **igualdad estructural exacta** de un nodo completo (`{ type: 'navigateTo', pageId }`).
- El escáner de tokens necesita identificar un nodo **por el nombre de la propiedad que lo contiene** (literalmente `headers`) y después evaluar si alguno de sus valores string **contiene** el patrón `tokens.{id}.value` — el valor real suele ser una plantilla más amplia (p. ej. `"Bearer {{tokens.sessionToken.value}}"`), no una igualdad de valor completo.
- Generalizar exigiría propagar el nombre de la clave contenedora a través de la recursión existente, algo que el escáner de páginas no necesita hoy. Eso amplía la superficie de un módulo de producción ya probado de otra feature, para un beneficio de reutilización bajo (dos usos con predicados de forma tan distinta).
- **Alternativa descartada**: extraer un walker genérico parametrizado por un `predicate(record, parentKey)` compartido por ambos escáneres. Se descarta por: (a) coste de tocar y revalidar un fichero estable fuera del alcance de esta entrega, (b) abstracción prematura para exactamente 2 usos con lógica de match distinta, (c) mantiene aislado cualquier riesgo de regresión sobre el borrado de páginas.
- **Coste asumido**: duplicación menor del recorrido recursivo array/objeto (~15 líneas) entre ambos ficheros. Si en el futuro aparece un tercer escáner de referencias huérfanas con un predicado también distinto, ahí sí merece revisarse si conviene extraer un walker común — no antes.

**Comportamiento del nuevo escáner**:
- Recorrido genérico por todas las claves de todo objeto/array (mismo principio que el escáner de páginas: no una lista cerrada de campos de acción), buscando cualquier propiedad literalmente llamada `headers` cuyo valor sea un mapa de strings.
- Coincidencia por **substring literal** (`String.prototype.includes`) del patrón completo `tokens.{id}.value` dentro de cada valor de esa fila — sin regex, evitando así tener que escapar caracteres especiales de un `id` arbitrario. Los puntos literales del patrón (`tokens.` y `.value`) ya acotan lo suficiente para no confundir `tokens.a.value` con `tokens.ab.value`.
- Raíces recorridas: cada operación de `api` (`api.{op}.headers`), el `layout` completo de cada página (alcanza de forma natural `button.props.action.headers`, `form.submitAction.headers` y `executeOperations[].operations[].headers`, incluidos los anidados en `onSuccess`/`onError`, sin necesidad de conocer esos nombres de campo), `preloads` globales y `preloads` de cada página.
- Conteo por ocurrencia individual (una fila `headers` que referencia el token cuenta como 1, igual granularidad que el escáner de páginas), agrupado en fuentes con etiqueta legible: por operación de `api` (`en la operación «id»`), por página (`en la página «id»`), `"en las precargas globales"`, `"en las precargas de la página «id»"`.
- El resultado (`{ totalCount, sources }`) sigue la misma forma que `OrphanNavigateToReferenceScan`, para que el diálogo de confirmación de borrado lo consuma con el mismo criterio visual que ya usa `Páginas` — sin ser el mismo tipo ni el mismo módulo.

### 4. Widget del sub-bloque `refresh`
Sub-formulario propio (`TokenRefreshFieldsEditor` o nombre equivalente) dentro de `tokens-config-panel/`, no un widget registrado en `WIDGET_REGISTRY`/`x-widget` del dispatcher de `Layout` — igual que el resto de campos de `Api`/`Páginas`, este panel es bespoke y no pasa por el schema Zod genérico de nodo.
- **Activar/desactivar `refresh` completo**: reutiliza el switch booleano ya existente en el editor (mismo componente que ya usa el dispatcher de `Layout` para campos booleanos genéricos), no un checkbox nativo ni un componente nuevo.
- **Deshabilitado sin operaciones en `api`**: si `Object.keys(api)` está vacío, el switch se deshabilita con un motivo explícito expuesto como `title`, mismo criterio ya usado por el botón "Guardar" cuando su operación no está declarada.
- **`operation`**: `<select>` simple restringido a `Object.keys(api)`, mismo criterio literal que `operationName` de `PreloadEntryFieldsEditor` — sin opción de respaldo cuando la referencia queda rota tras borrar la operación desde `Api` (el desplegable simplemente no ofrece esa opción; el resto de campos de `refresh` de ese token sigue editable).
- **`responsePath`**: input de texto libre.
- **`intervalSeconds`**: input numérico, validado como entero positivo por el pipeline de commit (`validateRuntimeConfig`/`validate-tokens-config.ts`), no por una regla nueva en el panel.
- Cada campo usa el mismo `CommitRejectionBanner` (`role="alert"`) que el resto del panel ante un commit rechazado, aislado por token y por campo — mismo criterio que "Feedback por campo" de `Api`.

### 5. Confirmación de borrado
Nuevo componente `TokenDeleteConfirmDialog` en `tokens-config-panel/`, calcado del patrón ya usado por `pages-delete-confirm-dialog.tsx`: diálogo modal propio (`role="alertdialog"`, `aria-modal`, foco atrapado con `Tab`/`Shift+Tab` implementado localmente con `useRef`/`useCallback`/`useEffect`, cierre por `Esc` o click fuera, devolución de foco al elemento previo). No existe ningún hook de foco-trampa compartido entre paneles hoy (el propio diálogo de páginas lo implementa localmente), así que este nuevo diálogo sigue la misma convención sin introducir ni forzar una abstracción nueva.
- El diálogo consume el resultado del escáner de la Decisión 3 y muestra el aviso solo si `totalCount > 0`; es puramente informativo (no bloquea el borrado), igual que en `Páginas`.
- A diferencia de `Páginas`, no hay condición de deshabilitado previa al diálogo (ni "única página restante" ni "es la inicial" tienen equivalente para tokens): el botón "Eliminar" siempre abre el diálogo.

## Riesgos y trade-offs
- **Duplicación de recorrido recursivo** entre `scan-orphan-navigate-to-references.ts` y el nuevo escáner de tokens (Decisión 3): aceptado explícitamente a cambio de no tocar código de producción de otra feature y evitar una abstracción prematura para dos predicados de forma distinta.
- **Referencia no cubierta por el escaneo**: la operación de guardado (`Guardar`, ver `local-config.md#Config de endpoints externos`) también puede depender de un `tokenId` resuelto contra `tokens.*`, pero no es una de las cinco superficies de headers que la spec pide escanear. Borrar un token usado por `Guardar` no dispara ningún aviso desde este panel; el botón simplemente pasará a deshabilitado (mismo comportamiento ya documentado hoy) sin que el usuario reciba explicación en el momento del borrado. Riesgo residual aceptado explícitamente por la spec ("no cubre ninguna otra forma de referenciar un token"); no se resuelve en esta entrega.
- **Sin lista de respaldo para `refresh.operation` roto**: coherente con `preloads.operationName`, pero implica que un usuario podría no notar de inmediato que el desplegable quedó "vacío" tras borrar una operación de `Api`; mismo trade-off ya aceptado por el editor para preloads, no es un riesgo nuevo introducido por esta feature.

## Migración o despliegue
No aplica: no hay migración de datos (el schema de `tokens` ya existe en producción) ni cambios de despliegue; es una feature aditiva de UI de desarrollo, sin impacto en el runtime de producción ni en `src/config/`.

## Preguntas abiertas
Ninguna bloqueante: las dos decisiones técnicas que la spec dejaba abiertas (estrategia de escaneo de referencias huérfanas, y el widget del sub-bloque `refresh`) quedan resueltas en las Decisiones 3 y 4 de este documento.
