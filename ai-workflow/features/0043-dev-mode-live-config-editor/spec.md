# Spec: Dev mode live config editor

## Objetivo
Añadir un modo desarrollo del runtime accesible desde la web que permita editar el JSON de configuración en vivo, validarlo con el mismo validador del runtime y aplicarlo para ver el resultado al instante, sin depender de backend ni reiniciar la página. Este modo se activa estructuralmente desde el host montando un componente wrapper sobre el runtime; sin wrapper, el modo dev no existe.

## Alcance
- Introducir un componente wrapper que envuelve el runtime actual y añade la capa de desarrollo encima sin alterar el contrato público del runtime.
- Cargar el wrapper con el mismo JSON inicial que recibe el runtime: prioridad de `data-config` sobre `src/dev/config.json`, reusando la frontera de bootstrap actual.
- Exponer un botón flotante de toggle siempre visible en una esquina de la pantalla mientras el wrapper esté montado.
- Soportar un atajo de teclado opcional para abrir y cerrar el editor.
- Renderizar el editor como panel lateral tipo drawer en el lado derecho, solapando el runtime sin forzar un cambio de ancho del árbol visible.
- Mostrar en el editor el JSON activo formateado y editable con un editor Monaco.
- Ofrecer autocompletado del contrato de configuración en el editor a partir de un JSON Schema derivado de los esquemas Zod existentes.
- Mantener los cambios en curso del editor en memoria de la sesión del navegador entre cierres y aperturas del panel.
- Exponer una acción `Aplicar` que valida el JSON editado con la fachada `validateRuntimeConfig` antes de actualizar el runtime.
- Sustituir el JSON activo del runtime por el JSON editado cuando la validación sea correcta.
- Mostrar los errores de validación en un panel adjunto al editor cuando la validación falle, sin actualizar el runtime.
- Conservar al aplicar el estado de formularios cuyos `formId.fieldId` sigan existiendo bajo el nuevo árbol.
- Conservar al aplicar las queries cacheadas vigentes y la página actual siempre que esa página siga existiendo en `pages`.
- Descartar silenciosamente cualquier estado huérfano que ya no encaje con el nuevo árbol.
- Exponer una acción `Copiar al portapapeles` que copia el JSON actual del editor para facilitar pegarlo manualmente en backend.

## Fuera de alcance
- Persistir cambios entre sesiones del navegador mediante `localStorage`, archivo en disco o servidor de desarrollo.
- Descargar el JSON editado como archivo desde el navegador.
- Activar el modo desarrollo en entornos de pre-producción o producción; queda reservado a entornos donde el host monte el wrapper.
- Integrar un chat con IA para modificar el JSON mediante prompts.
- Reescribir o mejorar los textos de los errores de validación; se reutilizan los mensajes y rutas que ya devuelve la fachada actual.
- Resaltar errores de validación inline en Monaco con markers o subrayado; el MVP usa solo el panel adjunto.
- Permitir varias instancias simultáneas del editor en la misma página.
- Ampliar el contrato de configuración del runtime o añadir nodos, propiedades o referencias nuevas.
- Modificar la frontera pública del runtime, su política de errores de bootstrap o su semántica de re-render.

## Requisitos funcionales
- El wrapper debe ser un componente independiente del runtime que el host monte explícitamente; el runtime debe seguir siendo usable directamente sin él.
- El wrapper debe leer el JSON inicial con la misma prioridad que el bootstrap actual: `data-config` primero, `src/dev/config.json` como respaldo.
- Si el JSON inicial es inválido al cargar el wrapper, debe propagarse la frontera de error de bootstrap existente sin convertirlo en error silencioso del editor.
- El botón flotante de toggle debe ser visible en todo momento mientras el wrapper esté montado, sin depender de la página activa del runtime.
- El editor debe estar oculto por defecto al cargar la página.
- Pulsar el botón de toggle debe abrir o cerrar el editor.
- El editor debe abrirse como panel lateral derecho en formato drawer, solapando visualmente el runtime sin recolocar su layout interno.
- Al abrir el editor por primera vez en una sesión, el contenido debe ser el JSON activo del runtime formateado de forma legible.
- El contenido del editor debe ser libremente modificable por el usuario sin afectar todavía al runtime.
- El editor debe ofrecer autocompletado del contrato basado en un JSON Schema derivado de los esquemas Zod existentes del runtime.
- El JSON Schema usado por el editor debe representar el contrato completo del runtime config a nivel raíz, no fragmentos aislados.
- Si el usuario edita el JSON y cierra el panel sin aplicar, esos cambios deben persistir en memoria y reaparecer al volver a abrir el panel en la misma sesión.
- Recargar la página debe descartar cambios sin aplicar y volver a partir del JSON inicial.
- La acción `Aplicar` debe validar el JSON actual del editor usando la misma fachada `validateRuntimeConfig` que el bootstrap.
- Si la validación es correcta, el runtime debe re-renderizarse con el nuevo JSON como configuración activa.
- Si la validación falla, el runtime no debe actualizarse y el panel adjunto debe mostrar los errores devueltos por el validador, con sus rutas canónicas tal cual.
- Tras un aplicar correcto, los cambios pendientes del editor dejan de considerarse pendientes y el JSON activo pasa a ser el nuevo punto de partida.
- Al aplicar correctamente un nuevo JSON, el wrapper debe preservar el estado de cada formulario cuyo `formId` siga presente, manteniendo solo los `fieldId` que sigan existiendo en ese formulario.
- Al aplicar correctamente un nuevo JSON, el wrapper debe preservar las queries ya cacheadas que sigan declaradas en `api`.
- Al aplicar correctamente un nuevo JSON, el wrapper debe preservar la página activa cuando esa página siga existiendo en `pages`; si no existe, debe degradar a la `initialPage` del nuevo config.
- Cualquier dato de estado del runtime que no encuentre correspondencia bajo el nuevo árbol debe descartarse silenciosamente sin bloquear el aplicar.
- La acción `Copiar al portapapeles` debe copiar el contenido textual actual del editor, no el JSON activo del runtime, para permitir copiar lo que el usuario tiene delante aunque no esté aplicado.
- El editor debe permitir copiar manualmente fragmentos del JSON con los atajos estándar del editor sin interferir con la acción explícita de copiar.
- La presencia del wrapper no debe alterar el comportamiento observable del runtime cuando el editor está cerrado y no se ha aplicado ningún cambio.

## Requisitos no funcionales
- La activación del modo desarrollo debe ser estructural: viene determinada por si el host monta el wrapper, no por una propiedad del JSON ni por una variable de entorno leída desde el runtime.
- El wrapper debe quedar fuera del bundle efectivo cuando el host no lo monte, para evitar arrastrar Monaco ni dependencias del editor en builds que no usen modo dev.
- El editor debe basarse en Monaco como dependencia explícita del wrapper, no como dependencia del runtime ni de `src/config/`.
- El JSON Schema usado para autocompletado debe derivarse desde los esquemas Zod existentes; si esos esquemas hoy están fragmentados, la unificación necesaria forma parte del trabajo técnico de la feature pero no debe cambiar el contrato observable del runtime.
- La validación al aplicar debe usar la fachada pública `validateRuntimeConfig` sin duplicar reglas, esquemas ni adaptación de errores.
- El panel adjunto de errores debe mostrar rutas canónicas devueltas por el validador (`layout[0].props.items[1]`, `searchUsers.query.filters`, etc.) sin reescribirlas.
- La interacción del editor debe ser responsiva en sesiones de desarrollo realistas: edición fluida sobre el JSON de ejemplo y aplicar sin bloqueo perceptible del runtime.
- La preservación de estado al aplicar debe ser determinista y cubrible con tests sobre el wrapper.
- El comportamiento del runtime aislado, sin wrapper, debe seguir cubierto por los tests existentes sin regresiones.

## Criterios de aceptación
- Dado un host que monta solo el runtime sin wrapper, el comportamiento observable del runtime es idéntico al actual y no aparece el botón flotante.
- Dado un host que monta el wrapper sobre el runtime, aparece un botón flotante de toggle en una esquina y el editor permanece oculto hasta abrirlo.
- Dada una sesión con el wrapper montado, al pulsar el botón de toggle el editor se abre como drawer lateral derecho mostrando el JSON activo formateado.
- Dado el editor abierto por primera vez con `data-config` o `src/dev/config.json` cargados, el contenido del editor coincide con ese JSON activo.
- Dado el editor abierto, al escribir un nombre de propiedad o tipo de nodo válido, Monaco ofrece autocompletado coherente con el contrato del runtime.
- Dado el editor abierto, al modificar el contenido, cerrar el panel y volver a abrirlo en la misma sesión, los cambios pendientes siguen visibles.
- Dada una sesión con cambios pendientes en el editor, recargar la página hace desaparecer los cambios y el editor vuelve a mostrar el JSON inicial al reabrirse.
- Dado un JSON válido editado en el panel, al pulsar `Aplicar` el runtime se re-renderiza con el nuevo árbol y el panel deja de marcar cambios pendientes.
- Dado un JSON inválido editado en el panel, al pulsar `Aplicar` el runtime no cambia y el panel adjunto muestra la lista de errores con sus rutas canónicas tal cual las produce el validador actual.
- Dado un aplicar exitoso donde un `formId.fieldId` sigue existiendo, el valor previo de ese campo se conserva en el formulario tras el re-render.
- Dado un aplicar exitoso donde un `formId.fieldId` deja de existir, ese valor desaparece sin afectar al resto del estado.
- Dado un aplicar exitoso donde la página activa sigue declarada en `pages`, el runtime se mantiene en esa página tras el re-render.
- Dado un aplicar exitoso donde la página activa ya no existe en `pages`, el runtime degrada a `initialPage` del nuevo config.
- Dado un aplicar exitoso, las queries ya cacheadas que siguen declaradas en `api` no se vuelven a ejecutar automáticamente solo por el aplicar.
- Dada una pulsación de `Copiar al portapapeles`, el portapapeles contiene el texto actual del editor, incluso si el usuario aún no ha pulsado `Aplicar`.
- Dado un build sin wrapper, ni Monaco ni el editor ni el botón flotante están incluidos en el bundle efectivo.

## Casos límite
- JSON inicial inválido recibido por el wrapper: la frontera de error de bootstrap actual sigue aplicando antes de que el editor sea utilizable.
- JSON editado con sintaxis JSON inválida: el validador del runtime no llega a ejecutarse y el panel debe reflejarlo como un error de parseo claro.
- JSON editado válido sintácticamente pero con errores estructurales en `layout`, `pages` o `api`: aparece en el panel adjunto con la ruta canónica devuelta por el validador.
- JSON editado donde desaparece la `initialPage` y la página activa: el re-render degrada coherentemente al nuevo `initialPage` declarado.
- JSON editado donde se eliminan operaciones `api` referenciadas por acciones o `preloads` activos: el validador rechaza el JSON antes del re-render.
- JSON editado donde se renombra un `form.id` activo: el estado anterior de ese formulario se descarta como huérfano sin bloquear el aplicar.
- JSON editado donde se elimina un `fieldId` cuyo valor estaba en uso: ese valor desaparece sin afectar al resto del formulario.
- Aplicar con cambios mínimos que no afectan a la página visible: el runtime no debe perder estado visible salvo lo declarado como descartable.
- Cierre del panel sin aplicar tras cambios extensos: al reabrirlo el contenido sigue siendo el editado, no el activo.
- Recarga manual de la página: cambios pendientes se descartan, el editor vuelve a partir del JSON inicial.
- Uso de Monaco sin red disponible: el editor sigue siendo funcional con las dependencias ya cargadas en bundle.
- Sesiones con `data-config` desfasado del shape esperado: el flujo de aplicar permite corregir el JSON en caliente y volver a un estado válido sin recargar.

## Riesgos o preguntas abiertas
- Unificar los esquemas Zod fragmentados actuales en un schema raíz reutilizable para derivar el JSON Schema introduce riesgo de regresión sutil sobre la validación existente; debe abordarse explícitamente en design.
- La estrategia concreta de preservación de estado al aplicar (formularios, queries, página activa) tiene varias alternativas técnicas razonables y debe decidirse en design antes de planificar.
- La integración de Monaco en un wrapper opt-in debe quedar fuera del bundle del runtime cuando no se monta el wrapper; la forma exacta de garantizarlo es una decisión técnica para design.
- La interacción del re-render del runtime con el provider de estado interno requiere decidir si la preservación de estado se hace migrando el store existente o reconstruyéndolo selectivamente; queda para design.

## Áreas de producto afectadas
- Modo desarrollo local.
- Bootstrap del runtime.
- Validación previa al render.
- Contrato JSON del runtime (solo a nivel de unificación interna del schema, sin cambiar el contrato observable).

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/app-features/development/index.md`
- `ai-workflow/docs/app-features/development/local-config.md`
- posible sub-documento nuevo bajo `ai-workflow/docs/app-features/development/` específico del editor en vivo
- `ai-workflow/docs/app-features/config/validation.md` si la unificación del schema raíz altera la frontera pública del validador
