# Spec: nodo `steps`

## Objetivo
Añadir un nuevo nodo `steps` al catálogo del runtime que permita construir formularios organizados en pasos secuenciales (wizard), con navegación controlada por validación (no se avanza a un paso siguiente si el paso actual tiene errores) y tres distribuciones visuales configurables del indicador de progreso.

## Alcance
- Nuevo nodo estructural `steps`, válido únicamente como hijo directo o indirecto de `form` (mismo nivel de encaje que `tabs` y `accordion` hoy dentro de `form.children`).
- `props.items`: lista ordenada de pasos, cada uno con etiqueta y su propio subárbol de `children`, análogo en shape a `tabs.props.items`.
- `props.variant`: tres distribuciones visuales seleccionables — `horizontal` (stepper numerado arriba del panel, con etiquetas y línea de progreso), `vertical` (stepper lateral, lista de pasos a la izquierda y panel a la derecha) y `progress` (indicador minimalista tipo "Paso X de Y", sin listar las etiquetas de todos los pasos).
- Navegación híbrida:
  - Avanzar ("Siguiente"): solo permitido cuando el paso actual valida correctamente con el motor de validación de campos ya existente (`required`, `minLength`, `maxLength`, `min`, `max`, `minSelections`, `maxSelections`, `pattern`, `email`, `url`, `when`). Si hay errores, no se avanza y los errores se muestran en el paso actual, igual que hoy hace el submit de un `form`.
  - Retroceder: libre a cualquier paso ya visitado, tanto pulsando el paso correspondiente en el indicador (en `horizontal`/`vertical`; en `progress` no hay indicador clicable) como con el botón "Atrás".
  - No es posible saltar hacia adelante a un paso todavía no alcanzado.
- Botones de navegación ("Atrás", "Siguiente", "Enviar" o equivalentes) generados automáticamente por el propio nodo al final de cada panel, sin que el autor del JSON los declare como nodos `button` sueltos. Los tres textos son configurables vía `props` para soportar traducciones, con valores por defecto razonables si no se personalizan.
- El botón del último paso reutiliza el `submitAction` ya existente del `form` padre — mismo mecanismo de submit implícito que ya usa un `button` sin `action` dentro de `form`, sin mecanismo de envío nuevo.
- Inicialización de campos por paso: lazy al entrar a cada paso por primera vez (a diferencia de `tabs`, que inicializa de forma eager todos los campos de todos los tabs al montar el form).
- Pasos ocultos por `visibility` a nivel de item: sus campos no participan en validación ni en el payload del submit, igual que hoy con un item de `tabs` oculto por `visibility`.
- El nodo respeta las capacidades transversales ya soportadas por cualquier nodo del catálogo: `layout.span`, `visibility` (a nivel de nodo completo) y `queryStateFeedback`.

## Fuera de alcance
- Uso de `steps` fuera de `form`.
- Saltar directamente a un paso todavía no visitado (sea por indicador o por cualquier mecanismo).
- Generación dinámica de pasos desde una colección de `queries.*`.
- Persistencia del paso activo entre navegación de página o reentrada por `pageEntry`; al remontar el `form`, `steps` siempre arranca en el primer paso, igual que el resto del estado del formulario se reinicializa por defecto sin `persistOnUnmount`.
- `props.defaultStep`/equivalente para arrancar en un paso distinto del primero: se descarta explícitamente porque rompería la garantía de que ningún paso llega al submit sin haber sido validado.
- Deshabilitar o cerrar pasos individuales sin ocultarlos completamente.
- Carga lazy de paneles no visitados (los paneles se comportan como el resto del catálogo respecto al DOM; el lazy es solo de inicialización de estado de campos, no de código/bundle).
- Soporte en el editor visual (`dev-editor`) para configurar `steps` desde un panel de propiedades dedicado. Se aborda, si se decide necesario, en una feature separada posterior, siguiendo el mismo patrón ya usado para otros nodos nuevos (p. ej. `map`).
- Cambiar el comportamiento actual de `visibility` sobre campos ocultos (conservación en memoria, omisión del payload): `steps` reutiliza ese comportamiento sin modificarlo.

## Requisitos funcionales
1. El runtime reconoce `steps` como tipo de nodo válido dentro del catálogo, exclusivamente como descendiente de `form`; declarado fuera de `form` el config se rechaza antes del render.
2. `props.items` es obligatorio y debe tener al menos un elemento; cada item declara `label` (etiqueta del paso) y opcionalmente `visibility` y `children`.
3. `props.variant` acepta `horizontal`, `vertical` o `progress`; si se omite, usa un valor por defecto razonable (`horizontal`).
4. Al montar, el paso activo es siempre el primer item visible por índice creciente (no existe forma de arrancar en otro paso).
5. Al pulsar "Siguiente", el runtime valida únicamente los campos visibles del paso actualmente activo con el motor de validación ya existente; si algún campo falla, no se avanza y los errores se muestran en el paso actual.
6. Al pulsar "Siguiente" y el paso actual validar correctamente, el paso activo avanza al siguiente item visible.
7. El usuario puede retroceder libremente a cualquier paso ya visitado, mediante el botón "Atrás" o, en las variantes `horizontal`/`vertical`, pulsando ese paso en el indicador.
8. En la variante `progress`, no existe indicador de pasos individuales clicable; el retroceso solo está disponible mediante el botón "Atrás".
9. El último paso visible muestra un botón que dispara el `submitAction` del `form` padre en vez de "Siguiente".
10. Los tres textos de navegación ("Atrás", "Siguiente", texto de envío) son configurables vía `props`; si no se personalizan, el runtime usa un texto por defecto.
11. Los campos de un paso se inicializan en el store (con su `defaultValue` resuelto) la primera vez que ese paso se activa, no al montar el `form`.
12. Un item de `steps` con `visibility` que evalúa como oculto excluye sus campos de validación, inicialización y payload del submit, igual que hoy ocurre con un item de `tabs` oculto por `visibility`; ese paso tampoco aparece en el indicador ni es alcanzable por navegación.
13. Si el paso actualmente activo pasa a estar oculto por un cambio de `visibility` en runtime, el nodo activa automáticamente el primer paso visible disponible, sin intervención del usuario (mismo criterio ya vigente en `tabs`).
14. Dado que no se puede avanzar sin validar el paso actual, al llegar al último paso todos los pasos visibles ya recorridos están garantizados válidos; no existe el escenario (posible hoy en `tabs`) de un campo `required` en un paso nunca visitado que solo falla al hacer submit.
15. `steps` admite `layout.span`, `visibility` (a nivel de nodo completo) y `queryStateFeedback` siguiendo las reglas transversales ya vigentes para el resto del catálogo.

## Requisitos no funcionales
- No introduce ninguna dependencia externa nueva; se apoya en el mismo stack (`React`, `Tailwind CSS`) y en el motor de validación de campos ya existente.
- El nodo debe convivir con el resto del catálogo sin romper el umbral mínimo de cobertura del 80% sobre `src/` que exige el proyecto.
- La coherencia visual con `tabs` (paleta, tipografía, técnica de "tab conectado" u otras convenciones ya establecidas) debe evaluarse y decidirse en `design.md`, no reinventarse desde cero.

## Criterios de aceptación
- Dado un `steps` con 3 pasos y ningún `defaultStep`, al montar el formulario el paso activo es el primero.
- Dado un paso activo con un campo `required` vacío, al pulsar "Siguiente" el paso no avanza y el campo muestra su error.
- Dado un paso activo con todos sus campos válidos, al pulsar "Siguiente" el paso activo pasa a ser el siguiente paso visible.
- Dado un usuario que ya avanzó hasta el paso 3, al pulsar "Atrás" (o pulsar el paso 1 en el indicador, en `horizontal`/`vertical`) el paso activo retrocede a ese paso ya visitado, conservando los valores introducidos.
- Dado el último paso visible con todos sus campos válidos, al pulsar el botón de envío se dispara el `submitAction` del `form` padre con el payload agregado de todos los pasos no ocultos.
- Dado un item de `steps` con `visibility` oculta, sus campos no aparecen en el payload del submit ni bloquean el avance de otros pasos.
- Dado `props.variant: "progress"`, el indicador no ofrece ningún paso individual pulsable; solo el botón "Atrás" permite retroceder.
- Dado `props.labels` (o equivalente) personalizado para los tres botones, el runtime muestra esos textos en vez de los valores por defecto.

## Casos límite
- `props.items` vacío: rechazado en validación previa al render, igual que `tabs`.
- Todos los items ocultos por `visibility`: el nodo no renderiza ni indicador ni panel, degradación silenciosa (igual que `tabs`).
- `steps` con un único item visible: no se muestran los botones "Atrás"/"Siguiente" (no hay paso previo ni siguiente), solo el botón de envío.
- El paso activo queda oculto por un cambio de `visibility` en runtime: el nodo activa automáticamente el primer paso visible disponible.
- Un item no declara `visibility`: se comporta siempre como visible, sin afectar a otros items (igual que `tabs`).
- Un item no declara `children` o los declara como array vacío: el panel de ese paso se muestra vacío sin error.
- `queryStateFeedback` activo en un estado distinto de la rama principal: sustituye el nodo `steps` entero, igual que en el resto del catálogo.

## Riesgos o preguntas abiertas
- Shape técnico exacto de `props.items`, `props.variant` y de los props de personalización de textos de los botones (nombres de campos concretos, si hay algún atributo adicional por item más allá de `label`/`visibility`/`children`) — pendiente de `generate-feature-design`.
- Mecanismo interno de determinación de "campos del paso actual" para el gating de validación al pulsar "Siguiente" cuando hay containers anidados u otras estructuras dentro de un panel — pendiente de `generate-feature-design`.
- Detalle visual concreto de las tres variantes (proporciones, iconografía del indicador de progreso en `horizontal`, coherencia con la técnica de "tab conectado" de `tabs`) — pendiente de `generate-feature-design`.

## Áreas de producto afectadas
- Catálogo de nodos (`nodes/`): nuevo nodo `steps`.
- Formularios y validación (`forms/`): nueva excepción de ciclo de vida (inicialización lazy por paso) y nuevo modo de validación parcial gateada, distinto de `tabs` y de `accordion`.
- Config (`config/`): nuevo tipo de nodo soportado en el schema y su validación previa al render, incluyendo la restricción de que solo es válido dentro de `form`.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/nodes/index.md`: nueva entrada en el catálogo (sección "Nodos estructurales" o "Nodos de formulario", a decidir).
- Nueva ficha `ai-workflow/docs/app-features/nodes/steps.md`.
- `ai-workflow/docs/app-features/forms/lifecycle.md`: nueva sección de excepción de inicialización lazy por paso y de gating de validación, análoga a la ya existente para `tabs`.
- `ai-workflow/docs/app-features/nodes/form.md`: ampliar la lista de `children` admitidos por `form` para incluir `steps`.
- `ai-workflow/docs/current-state.md`: posible actualización de la fila de "Catálogo de nodos" o "Formularios y validación" si cambia la última feature relevante del área.
