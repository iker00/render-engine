# 0025-preload-query-reset-on-page-entry

## Objetivo
Evitar que una nueva `pageEntry` con `preloads` permita que la página o sus formularios lean transitoriamente datos de la entrada anterior antes de que la limpieza de esas queries quede aplicada.

## Alcance
- Ajustar el comportamiento funcional de las queries disparadas por `pages[].preloads`.
- Asegurar que el reset de las queries declaradas en `preloads` ocurre antes de cualquier render útil de la nueva entrada que pueda hidratar `defaultValue`, texto visible u otros consumidores basados en `queries.*`.
- Mantener el patrón actual de render concurrente: la página puede renderizar mientras las precargas siguen en curso.
- Mantener el alcance limitado a precargas automáticas al entrar en página y a la ventana temporal entre navegación, limpieza y primer render comprometido.

## Fuera de alcance
- Cambiar la semántica general de `executeQueryOperation` cuando una operación se relanza manualmente desde `button.props.action` o `form.submitAction`.
- Introducir una política declarativa configurable por query del tipo `keepPreviousData`.
- Rediseñar el store para cachear resultados por combinación de params o por clave dinámica derivada.
- Añadir nuevas referencias, nuevos estados visibles o nuevas reglas de `visibility`.
- Convertir `defaultValue` en una referencia reactiva general que se vuelva a resolver ante cualquier cambio posterior de `queries.*`, `params.*` u otros orígenes dinámicos mientras el formulario ya quedó efectivamente hidratado.
- Cambiar la política general de persistencia o limpieza de `forms.*` más allá de lo que resulte estrictamente necesario para cerrar la ventana de render obsoleto provocada por `preloads`.

## Requisitos funcionales
- Cuando la entrada activa de página cambie y la nueva página declare `preloads`, el runtime debe limpiar el estado previo de cada query incluida en esa tanda antes de lanzar las nuevas operaciones.
- La limpieza debe aplicarse solo a las queries declaradas en `preloads` para esa `pageEntry`, no al resto del dominio `queries`.
- Tras esa limpieza, la nueva tanda de `preloads` debe arrancar directamente en `loading` para la entrada activa, sin introducir un paso observable intermedio por `idle`.
- El primer render comprometido de la nueva `pageEntry` no debe poder inicializar formularios, `defaultValue` ni otros consumidores visibles con datos viejos de `queries.{queryName}.data`.
- La página visible debe seguir la `pageEntry` preparada para esa entrada, de forma que un cambio en `navigation.currentPageId` no permita comprometer un render útil intermedio todavía contaminado por el snapshot anterior.
- Mientras la nueva tanda esté en curso, cualquier nodo o formulario que lea `queries.{queryName}.data` de una query precargada debe ver un estado vacío de esa query, no el último dato exitoso de una entrada anterior.
- Si un formulario dependiente de una query precargada llega a montarse durante `loading` con un valor placeholder coherente con query vacía, ese estado prístino inicial no debe bloquear la hidratación efectiva del `defaultValue` de la misma `pageEntry` cuando la respuesta fresca llegue por primera vez.
- Esa hidratación diferida solo debe cerrar la ventana de entrada de la `pageEntry` activa y no puede redefinir `defaultValue` como mecanismo reactivo general una vez el campo ya quedó inicializado efectivamente o el usuario lo editó.
- El agregado `pageEntry` debe seguir representando la entrada activa con su semántica actual `idle | loading | success | error`.
- La página debe poder renderizar durante `loading`, de modo que `queryStateFeedback`, formularios y otros nodos reaccionen contra el estado limpio y la nueva carga real.
- Si una página no declara `preloads`, no debe introducirse ninguna limpieza adicional de queries por el mero hecho de navegar.
- Si una query se ejecuta manualmente fuera del mecanismo de `preloads`, debe conservar su semántica vigente de recarga, incluido el comportamiento actual de mantener el último `data` válido durante `loading`.
- Si varias operaciones forman parte de la misma tanda de `preloads`, todas deben partir de su estado limpio antes de que sus nuevos resultados puedan poblar otra vez el store compartido.
- Si una entrada antigua resuelve tarde, la semántica latest-only del agregado `pageEntry` debe seguir evitando que esa entrada reabra o reescriba el agregado visible de una entrada más reciente.
- Este comportamiento debe fijarse como semántica actual de `preloads` por nueva entrada: una reentrada automática prioriza coherencia con los `params` activos sobre reutilizar visualmente datos previos de la misma query.
- `persistOnUnmount: false` mantiene su semántica actual de limpieza al desmontar; esta feature no puede depender de que exista un `unmount` real para impedir que la nueva entrada lea datos obsoletos.

## Requisitos no funcionales
- La solución debe ser coherente con la terminología actual del runtime: `pageEntry`, `preloads`, `queries.{queryName}`, `queryStateFeedback` y `params.*`.
- El comportamiento resultante debe ser comprobable con tests de integración sobre reentrada de página, navegación con params, orden de render y formularios con `defaultValue` basado en `queries.*`.
- El cambio debe mantenerse acotado al contrato ya existente de navegación interna y precargas, sin exigir a la configuración JSON nueva sintaxis ni migraciones.
- La feature no debe cerrar la puerta a una futura política explícita de caché o reutilización de queries, pero esa capacidad queda fuera de alcance en esta iteración.

## Áreas de producto afectadas
- Navegación interna entre páginas con historial por entrada.
- Precargas automáticas declaradas en `pages[].preloads`.
- Formularios que leen datos remotos cargados por `preloads`.
- Inicialización de `defaultValue` en formularios que dependen de `queries.*`.
- Feedback visual basado en `queries.{queryName}.status` y `queryStateFeedback`.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/current-state.md`
- una futura feature de caché de queries o reutilización entre entradas de página, todavía no definida

## Criterios de aceptación
- Al entrar por primera vez a una página con un `preload`, la página puede permanecer visible mientras la query precargada pasa por `loading` y se rellena cuando llega la respuesta.
- Si el usuario vuelve atrás y entra de nuevo a esa misma página con otro `param` efectivo que alimenta el `preload`, el runtime no debe renderizar de forma transitoria el `data` de la visita anterior para esa query.
- Si un formulario usa `defaultValue` derivado de una query precargada, al reentrar con otro `param` no debe inicializarse con el registro anterior antes de que la nueva petición quede en curso.
- Si ese mismo formulario permanece visible durante `loading` y arranca con un placeholder derivado de query vacía, debe hidratarse con el dato fresco de la nueva entrada cuando la query precargada resuelva por primera vez, sin quedarse fijado en `''` ni en el registro previo.
- Si un formulario consume datos de una query precargada, al reentrar con otro `param` no debe mostrarse el registro anterior mientras la nueva petición está en curso.
- Durante esa reentrada, los nodos que reaccionen a `queryStateFeedback.states.loading` deben poder mostrarse según la semántica actual de `loading`.
- Durante esa reentrada, la query precargada no debe exponer un paso visible por `idle` entre la limpieza del dato previo y la nueva carga.
- Una recarga manual de una query disparada desde botón o submit fuera de `preloads` debe conservar el comportamiento vigente de mantener el último `data` mientras la nueva ejecución sigue en curso.
- Navegar a una página sin `preloads` no debe vaciar queries no relacionadas.

## Casos límite
- Reentrada a la misma página con los mismos params efectivos: sigue siendo un no-op observable y no debe disparar una limpieza nueva.
- Reentrada a la misma página con params distintos: debe tratarse como una nueva `pageEntry` y limpiar las queries precargadas antes de relanzarlas.
- Vuelta atrás hacia una entrada previa con `preloads`: debe aplicarse la misma política de limpieza previa a la nueva tanda automática de esa entrada reactivada.
- Varias queries en la misma tanda de `preloads`: ninguna debe exponer datos viejos mientras está cargando la nueva entrada.
- Precargas con error: la query debe reflejar el error de la nueva ejecución y no conservar visualmente el éxito previo de otra entrada.
- Formularios con `persistOnUnmount: false` que ya se desmontan correctamente siguen sin ser suficientes para cerrar por sí solos esta regresión si existe un render de la nueva entrada antes del reset visible de `queries`.
- Formulario visible durante `loading` cuyo `defaultValue` depende de una query precargada: puede arrancar con placeholder vacío, pero debe absorber el primer dato fresco de esa entrada mientras siga prístino y no haya quedado hidratado efectivamente todavía.
- Bloques que no dependan de las queries precargadas deben poder seguir renderizando durante la carga de la nueva entrada.

## Riesgos o preguntas abiertas
- Esta feature fija el contrato actual de `preloads` como carga fresca por entrada y deja fuera de alcance cualquier sistema de caché o reutilización; cuando esa capacidad llegue, habrá que decidir si actúa como excepción explícita por query, por página o por entrada.
- Debe vigilarse el impacto sobre pantallas que hoy dependan implícitamente de ver datos anteriores durante una recarga automática de `preloads`, aunque ese comportamiento pase a considerarse no deseado para flujos parametrizados.
- La implementación tendrá que decidir cómo coordinar `navigation`, `pageEntry` y la primera hidratación prístina de formularios dependientes de `queries.*` para cerrar la ventana sin convertir `defaultValue` en una referencia reactiva general.
