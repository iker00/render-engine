# Spec: NavigateTo page params

## Objetivo
Permitir que `button.props.action.type: navigateTo` envíe parámetros declarativos a la página destino para que esa entrada de navegación pueda reutilizarlos dentro del runtime, especialmente en `preloads`, en referencias dinámicas visibles y en formularios que dependan de datos remotos cargados al entrar.

## Alcance
- Ampliar `navigateTo` para aceptar un bloque opcional `params`.
- Tratar esos parámetros como parte de la entrada activa de página y no como datos globales ajenos a la navegación.
- Hacer que la página destino pueda leer esos parámetros mediante una convención declarativa estable de referencias.
- Permitir que `preloads` y operaciones `api` reutilicen esos parámetros al entrar en la página destino.
- Permitir que formularios y bloques visibles de la página destino consuman esos parámetros del mismo modo que hoy consumen otras referencias completas soportadas.
- Mantener la navegación interna al runtime, sin introducir sincronización con la URL del navegador.

## Fuera de alcance
- Deep links, query string del navegador o sincronización con el historial externo.
- Un sistema general de routing con segmentos de URL.
- Acciones por item dentro de `list` o un nuevo catálogo visual para filas editables.
- Mutación parcial de parámetros de página sin navegar de nuevo.
- Políticas de caché, deduplicación o refetch condicional basadas en si los parámetros cambiaron o no.
- Referencias complejas, interpolación parcial dentro de strings o expresiones compuestas sobre parámetros.

## Requisitos funcionales
- `button.props.action.type: navigateTo` debe poder declarar opcionalmente `params`.
- `params` debe permitir pasar un conjunto pequeño y explícito de claves de negocio a la página destino.
- Los valores de `params` deben poder declararse como literales compatibles con el runtime actual y también como referencias completas ya soportadas en el origen de la navegación.
- La navegación debe seguir fallando en bootstrap si `pageId` apunta a una página inexistente, aunque el shape de `params` sea válido.
- Al navegar a una página, la entrada activa debe conservar tanto el `pageId` como los parámetros efectivos resueltos para esa navegación concreta.
- Al usar `goBack`, el runtime debe restaurar también los parámetros asociados a la entrada anterior y no solo la página.
- La página de entrada inicial debe seguir siendo válida sin declarar parámetros; en ese caso la página activa entra con parámetros ausentes.
- La nueva familia de referencias soportadas debe exponerse como `params.{paramName}`.
- `params.*` debe poder reutilizarse al menos en:
  - `api.query`
  - `api.body`
  - `api.headers`
  - `button.props.action.query`
  - `button.props.action.body`
  - `button.props.action.headers`
  - `form.submitAction.query`
  - `form.submitAction.body`
  - `form.submitAction.headers`
  - `defaultValue` de `input`, `textarea` y `select`
  - `heading.props.text`
  - `paragraph.props.text`
- Si una página declara `preloads`, esas operaciones deben poder resolver `params.*` al entrar en la página destino.
- El caso de uso de edición debe quedar soportado cuando la pantalla de destino pueda:
  - recibir un identificador por `navigateTo.params`
  - usar ese identificador en una operación declarada en `api`
  - disparar esa operación por `preloads`
  - rellenar la UI visible o los valores por defecto del formulario a partir del resultado cargado en `queries.*`
- Si una referencia `params.*` apunta a una clave ausente, debe degradar según la política visible del consumidor igual que hoy ocurre con otras referencias runtime ausentes.
- Navegar varias veces a la misma página con parámetros distintos debe crear entradas distintas de navegación a efectos observables del runtime.
- Volver a entrar en una página mediante una nueva navegación debe mantener la semántica actual de `preloads`: la entrada nueva vuelve a disparar la tanda correspondiente.

## Requisitos no funcionales
- La feature debe mantener el alcance deliberadamente pequeño y no convertir la navegación interna en un router general.
- El contrato debe seguir siendo validable antes del render con diagnósticos trazables sobre la ruta del JSON afectada.
- La semántica de parámetros debe ser consistente con la convención existente de referencias completas del runtime.
- La feature no debe romper la compatibilidad hacia atrás de configuraciones que usan `navigateTo` sin `params`.
- La redacción del contrato debe dejar claro que `params.*` representa parámetros de navegación interna de página y no `routeParams` del navegador.

## Áreas de producto afectadas
- Navegación interna entre páginas.
- Contrato declarativo del JSON del runtime.
- Referencias dinámicas disponibles en la página destino.
- Precargas automáticas y operaciones `api` parametrizadas.
- Formularios declarativos que dependen de datos cargados al entrar.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/current-state.md`

## Criterios de aceptación
- Un botón con `action.type: navigateTo` puede navegar a otra página declarando `params: { userId: '42' }`, y la página destino puede usar `params.userId` en un `preload` sin lógica imperativa adicional.
- Un botón con `action.type: navigateTo` puede resolver el valor de un parámetro desde una referencia completa ya soportada en el origen de la navegación, y el valor efectivo viaja a la página destino ya resuelto.
- Si la página destino muestra un `heading` o `paragraph` cuyo texto es `params.userId`, el runtime usa el valor recibido en esa entrada de navegación.
- Si la página destino define un `preload` cuya operación usa `params.userId` en `api.query` o `api.body`, la operación se construye con ese valor al entrar en la página.
- Un formulario de la página destino puede depender del resultado de esa query precargada para rellenar `defaultValue` de sus campos, manteniendo la semántica actual de inicialización lazy.
- Si se navega a la misma página con `params.userId: '1'` y después con `params.userId: '2'`, la segunda entrada visible usa el segundo valor y dispara su propia tanda de `preloads`.
- Si después se ejecuta `goBack`, la página anterior recupera también los parámetros que tenía asociados cuando fue visitada.
- Una configuración previa con `navigateTo` sin `params` sigue validando y comportándose igual que antes.
- Si el config usa `params.*` fuera del alcance soportado por la feature o con un shape inválido en `navigateTo.params`, el runtime rechaza la configuración antes del render con una ruta diagnóstica estable.

## Casos límite
- Navegación a una página sin `preloads`, pero que aun así consume `params.*` en texto o en valores por defecto.
- Parámetro declarado pero resuelto a valor ausente en el momento de navegar.
- Navegación repetida a la misma página con parámetros distintos y luego uso de `goBack`.
- Página inicial sin parámetros y referencias `params.*` presentes en su layout o en sus operaciones.
- `preloads` de la página destino que combinan `params.*` con `forms.*` o `queries.*` dentro del mismo request.
- Formularios que ya tienen estado previo en store y vuelven a una página cuyos `defaultValue` dependen de parámetros distintos de una entrada anterior.

## Riesgos o preguntas abiertas
- Riesgo medio-alto por impacto transversal en contrato JSON, estado de navegación, resolución de referencias, `preloads` y formularios.
- La spec asume `params.*` como namespace principal para navegación interna y mantiene `routeParams.*` fuera de alcance; si el producto quisiera alinear esto más adelante con URL real, esa expansión deberá tratarse como alcance nuevo.
