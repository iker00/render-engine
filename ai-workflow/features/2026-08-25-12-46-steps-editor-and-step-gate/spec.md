# Spec: edición visual de `steps` en dev-editor y gating de avance por API

## Objetivo
Ampliar el nodo `steps` (formulario en pasos, ya implementado) con tres capacidades que hoy le faltan respecto al resto del catálogo de nodos estructurales:

1. Soporte completo de edición visual en el dev-editor: arrastrar y soltar nodos dentro y entre los paneles de un `steps`, con paridad con lo que ya existe hoy para `tabs`.
2. Navegación libre entre pasos en modo Editor del dev-editor, sin el gating de validación que aplica en modo Visual/producción — mismo criterio ya usado por `accordion` para mantener accesible su contenido en modo Editor.
3. Una capacidad declarativa nueva, `onNext`, que permite disparar una llamada API al avanzar de paso (o al enviar en el último paso) y bloquear ese avance si la llamada termina en error.

## Alcance
- Drag & drop dentro de `steps` en el dev-editor: insertar nodos nuevos desde la paleta en un panel concreto (`props.items[i].children`), reordenar/reanidar nodos existentes dentro y entre paneles del mismo `steps`, y mover nodos desde/hacia otros contenedores del árbol, sujeto a las mismas reglas de destino ya vigentes para nodos de formulario.
- Selección individual desde el canvas de los hijos de cada paso en modo Editor (hoy `StepsNode` no expone un `path` propio para su contenido, así que sus hijos no son seleccionables uno a uno).
- Detección de modo Editor por parte de `StepsNode` (mismo mecanismo ya usado por `accordion`) para permitir seleccionar cualquier paso visible sin el gating de `maxVisitedIndex` que aplica en modo Visual.
- Nuevo campo opcional `props.items[i].onNext`, con el mismo contrato que `button.props.action.executeOperation` (`operationName` obligatorio, `query`/`body`/`headers` opcionales), que dispara una llamada API al pulsar "Siguiente" (o el botón de envío del último paso) tras superar la validación de campos del paso, y bloquea el avance si la query resultante queda en `status: error`.
- El criterio de error de `onNext` reutiliza íntegramente la semántica de error ya existente en `queries.*` (`network-error`, `http-error`, `invalid-json-response`, y `business-error-condition` cuando la propia operación `api` declara `errorCondition`/`errorCodePath`), sin introducir un segundo contrato de error de negocio.

## Fuera de alcance
- Panel de propiedades dedicado a `steps` en el dev-editor (`props.items`, `props.variant`, `onNext`, etc. se siguen editando con el editor genérico por schema) — ya estaba fuera de alcance de la spec original de `steps` y sigue estándolo aquí.
- Cualquier cambio en el comportamiento de drag & drop, edición o navegación de `tabs`/`accordion`.
- Persistencia del paso activo o la posibilidad de saltar a un paso todavía no visitado en modo Visual/producción: sigue exactamente igual que la spec original de `steps`.
- Cualquier tipo de "error de negocio" distinto del ya existente `errorCondition`/`errorCodePath` de una operación `api`.
- Reintento automático de `onNext` tras un error: el usuario debe volver a pulsar "Siguiente" para reintentar.
- Ejecutar `onNext` al pulsar "Atrás" o al navegar libremente entre pasos en modo Editor.
- Cambiar el comportamiento ya vigente de supresión de acciones declarativas en modo Editor (`navigateTo`, `executeOperation(s)`, envío de `form`, etc.): `onNext` se suma a esa misma supresión, no la modifica.
- Cualquier mecanismo de merge entre el resultado de `onNext` y el payload del submit final del `form`.

## Requisitos funcionales

### Drag & drop y selección en el dev-editor
1. El editor permite arrastrar un nodo desde la paleta flotante hasta un panel concreto (`props.items[i].children`) de un `steps`, insertándolo en ese panel — mismo mecanismo ya vigente para insertar dentro de un panel de `tabs`.
2. El editor permite arrastrar un nodo ya existente del árbol hacia dentro de un panel de `steps` (reordenar dentro del mismo panel, mover entre paneles del mismo `steps`, o mover desde/hacia otro contenedor del árbol), sujeto a las mismas reglas de destino ya vigentes para nodos de formulario (por ejemplo, un `steps` fuera de `form` sigue sin ser destino válido en ningún caso, porque `steps` sigue siendo exclusivo de `form`).
3. En modo Editor, los hijos de cada paso de un `steps` son seleccionables individualmente desde el canvas (click selecciona el nodo hijo concreto, con su `path` estructural resuelto contra el árbol real), igual que ya ocurre hoy con los hijos de un panel de `tabs`.

### Navegación libre en modo Editor
4. En modo Editor, `StepsNode` detecta el modo activo y permite cambiar el paso mostrado a cualquier paso visible (mediante el indicador clicable, en las variantes que lo tienen) sin el gating de `maxVisitedIndex` que aplica en modo Visual — mismo criterio ya usado por `accordion` para mantener accesible contenido anidado bajo una estructura interactiva.
5. En modo Visual (incluida producción), el gating de `maxVisitedIndex` para el indicador clicable no cambia respecto a la spec original de `steps`.
6. En modo Editor, pulsar "Siguiente"/"Atrás" sigue cambiando el paso mostrado libremente (sin gating de validación de campos), consistente con el punto 4 — el propio cambio de paso es interactividad local, no una acción declarativa.
7. En modo Editor, pulsar "Siguiente" (o el botón del último paso) no ejecuta `onNext` ni ninguna llamada real: es una acción declarativa y queda sujeta a la misma supresión ya vigente en modo Editor para `navigateTo`, `executeOperation(s)` y el envío de `form`.

### Gating de avance por API (`onNext`)
8. `props.items[i]` acepta un campo opcional `onNext` con el mismo contrato que `button.props.action.executeOperation`: `operationName` (obligatorio, no vacío, debe existir en `api`), `query`/`body`/`headers` (opcionales).
9. En modo Visual, al pulsar "Siguiente" en un paso cuyo item declara `onNext`, y solo tras superar la validación de campos del paso (comportamiento ya existente, sin cambios), el runtime ejecuta la operación declarada mediante la misma fachada compartida que ya usan `button.props.action.executeOperation` y `form.submitAction`.
10. Lo mismo aplica al botón del último paso: si su item declara `onNext`, la operación se ejecuta y debe resolver en éxito antes de disparar el `submitAction` del `form` padre. Un `onNext` en el último paso que termina en error impide el envío exactamente igual que en un paso intermedio.
11. Mientras la query de `onNext` está en `status: loading`, el botón "Siguiente"/"Enviar" del paso activo queda deshabilitado y muestra un indicador de carga, para prevenir doble disparo.
12. Si la query de `onNext` resuelve en `status: success`, el paso avanza (o se dispara `submitAction` en el último paso) exactamente igual que hoy sin `onNext`.
13. Si la query de `onNext` resuelve en `status: error` (cualquier código tipado ya existente: `operation-not-found`, `request-build-failed`, `token-refresh-failed`, `network-error`, `http-error`, `invalid-json-response`, `business-error-condition`), el paso activo no avanza (ni se dispara `submitAction` en el último paso), y se muestra un mensaje de error inline junto a los botones de navegación del paso activo con el `error.message` de la query.
14. Un item de `steps` sin `onNext` no ejecuta ninguna llamada al pulsar "Siguiente"; su comportamiento no cambia respecto a la spec original de `steps`.
15. El botón "Atrás" nunca dispara `onNext`, en modo Visual ni en modo Editor.
16. Un reintento tras un error de `onNext` (pulsar "Siguiente" de nuevo sin cambiar de paso) relanza la misma operación y reemplaza el mensaje de error anterior por el resultado del nuevo intento.
17. La query de `onNext` se identifica por su propio `operationName` en `queries.{operationName}`, consumible desde pasos posteriores u otros nodos de la página como cualquier otra query, sin ningún mecanismo de merge especial con el payload del submit final del `form`.
18. Si el paso activo con una query `onNext` en curso (`loading`) pasa a estar oculto por un cambio de `visibility` en runtime, aplica la misma reactivación automática ya vigente en la spec original de `steps` (el nodo activa el primer paso visible disponible); el resultado de esa query, cuando llegue, no tiene ningún efecto sobre la navegación ya que el paso que la disparó dejó de ser el activo.

## Requisitos no funcionales
- No introduce ninguna dependencia externa nueva.
- El drag & drop dentro de `steps` reutiliza el mecanismo de paths/mutaciones/reglas de destino ya existente para nodos con hijos por item (`tabs`), sin introducir un segundo paradigma de interacción en el canvas.
- `onNext` reutiliza la fachada de ejecución de queries ya existente (`executeQueryOperation`) y su modelo de estado (`status`/`data`/`error`), sin introducir un segundo motor de llamadas API.
- El nodo debe seguir cumpliendo el umbral mínimo de cobertura del 80% sobre `src/` que exige el proyecto.

## Criterios de aceptación
- Dado un `steps` dentro de `form` en modo Editor, arrastrar un nodo `input` desde la paleta hasta el panel de un paso lo inserta en `props.items[i].children` de ese paso.
- Dado un `steps` con un `input` en el paso 1 en modo Editor, arrastrar ese `input` hasta el panel del paso 2 lo mueve de `props.items[0].children` a `props.items[1].children`.
- Dado un `steps` de 3 pasos en modo Editor, sin haber avanzado nunca por "Siguiente", pulsar el paso 3 en el indicador (`horizontal`/`vertical`) lo activa inmediatamente, sin exigir validación de los pasos 1 y 2.
- Dado el mismo `steps` en modo Visual, pulsar el paso 3 en el indicador sin haber alcanzado `maxVisitedIndex` no tiene efecto (comportamiento sin cambios).
- Dado un paso con `onNext` apuntando a una operación que responde con éxito, al pulsar "Siguiente" con los campos del paso válidos, el paso avanza tras la respuesta.
- Dado un paso con `onNext` apuntando a una operación que responde con `http-error`, al pulsar "Siguiente" con los campos del paso válidos, el paso no avanza y aparece un mensaje de error junto a los botones de navegación.
- Dado un paso con `onNext` apuntando a una operación `api` con `errorCondition` configurado, y una respuesta 200 que cumple esa condición, al pulsar "Siguiente" el paso no avanza y se muestra el error de negocio correspondiente.
- Dado el último paso de un `steps` con `onNext`, al pulsar el botón de envío con la operación resolviendo en error, `submitAction` del `form` padre no se dispara.
- Dado el mismo caso anterior con la operación resolviendo en éxito, `submitAction` se dispara a continuación con el payload agregado habitual.
- Dado un paso con `onNext` en curso (`loading`), el botón "Siguiente"/"Enviar" está deshabilitado hasta que la query resuelve.
- Dado un `steps` en modo Editor, pulsar "Siguiente" en un paso con `onNext` no dispara ninguna llamada real ni bloquea nada; el paso activo puede seguir cambiándose libremente.

## Casos límite
- `onNext.operationName` apunta a una operación inexistente en `api`: el config completo se rechaza antes del render, igual que ya ocurre hoy con `button.props.action.operationName`.
- Un paso sin `onNext`: comportamiento idéntico a la spec original de `steps`, sin ninguna llamada adicional.
- Arrastrar un nodo hacia un panel de un `steps` declarado fuera de `form`: sigue sin ser un destino válido, ya que `steps` continúa siendo exclusivo de `form`.
- El paso activo con una query `onNext` en curso pasa a estar oculto por un cambio de `visibility`: el nodo se reactiva en el primer paso visible; la respuesta tardía de esa query no reabre ni bloquea nada.
- Pulsar "Siguiente" repetidamente mientras la query de `onNext` está en `loading`: el botón deshabilitado evita un segundo disparo.
- Reintentar `onNext` tras un error previo: el mensaje de error anterior se sustituye por el resultado del nuevo intento, sin acumularse.
- `onNext` en un paso con campos inválidos: la validación de campos sigue teniendo prioridad y bloquea antes de que se dispare ninguna llamada de `onNext`.

## Riesgos o preguntas abiertas
Ninguna bloqueante. Las tres incertidumbres técnicas que esta spec dejaba pendientes de `generate-feature-design` (mecanismo de `stepItem` en `layout-node-path.ts`/`layout-tree-mutations.ts`/`layout-drop-validity.ts`, detección de modo Editor en `StepsNode`, y el punto de integración validación → `onNext` → `submitAction`) quedaron resueltas en `design.md` (decisiones D1–D8), con mecanismo concreto y precedente directo en `tabItem`/`accordion`/`form-layout-node.handleSubmit`.

Riesgo residual señalado por el design, no cerrado por esta feature: `findInvalidActionTarget` no valida hoy `operationName` de acciones de nodos anidados (`button`/`link`) dentro de `tabs.props.items[i].children` ni `steps.props.items[i].children`. Es una brecha preexistente del validador (no introducida por esta feature) que `onNext` no depende de corregir, ya que cuelga de `props.items[i]` y no de `children`.

## Áreas de producto afectadas
- Catálogo de nodos (`nodes/`): ficha de `steps` ampliada con `onNext` y con su comportamiento en modo Editor.
- Desarrollo local (`development/`): editor visual del `layout` — reglas de destino de drop y excepción de interactividad local en modo Editor.
- Queries, ejecución y feedback (`queries/`): nuevo disparador declarativo de `executeQueryOperation` desde `steps.props.items[i].onNext`.
- Config (`config/`): nueva regla de validación para `onNext` (shape y existencia de la operación referenciada).

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/nodes/steps.md`: nueva sección de `onNext`, comportamiento en modo Editor y feedback de error inline.
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`: reglas de destino de drop para paneles de `steps`, y ampliación de la "Excepción explícita" de interactividad local en modo Editor.
- `ai-workflow/docs/app-features/config/validation.md`: nueva regla de validación de `onNext`.
- `ai-workflow/docs/app-features/queries/execution.md`: mención de `steps.props.items[i].onNext` como nuevo disparador de la fachada compartida.
- `ai-workflow/docs/current-state.md`: posible actualización de la fila de "Catálogo de nodos" o "Desarrollo local" si esta feature consolida el estado más reciente de esas áreas.
