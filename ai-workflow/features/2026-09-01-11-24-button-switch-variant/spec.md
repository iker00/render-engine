# Spec: variante `switch` en `button.props.variant`

## Objetivo
Permitir marcar un elemento como principal/favorito (o cualquier estado booleano equivalente) desde una fila de `table`/`repeater` mediante un control visual tipo interruptor que dispara una operación de API directamente al pulsarse, sin pasar por un `form`. El catálogo actual no cubre este caso: `toggle` y `checkboxGroup` solo escriben en `forms.{formId}.{fieldId}.value` y no admiten `action`; solo `button` puede disparar `executeOperation`/`executeOperations` fuera de un submit de formulario, pero hoy siempre se renderiza como botón rectangular con label, no como interruptor. Se resuelve extendiendo `button` con una nueva variante de render (`switch`) que reutiliza el catálogo de `action` ya existente y liga su estado visual a una referencia de datos.

## Alcance
- Nuevo valor `switch` en el enum cerrado de `button.props.variant` (hoy `solid | outline | ghost | link`).
- Nuevo prop `button.props.checked`: boolean literal o referencia dinámica completa soportada por el runtime (misma frontera que `defaultValue` en el resto del catálogo: `item.*`, `queries.*`, `forms.*`, `params.*`). Determina el estado visual marcado/no marcado del switch. Solo válido cuando `variant: 'switch'`.
- Nuevo prop `button.props.labelVisible`: boolean opcional, default `true`. Cuando es `false`, `label` deja de renderizarse como texto visible junto al switch pero se sigue usando como nombre accesible (`aria-label`). Solo válido cuando `variant: 'switch'`.
- `variant: 'switch'` reutiliza el `props.action` ya existente en `button` sin restricciones adicionales sobre su `type`: cualquier click dispara la `action` configurada, exactamente igual que un botón normal.
- Nueva referencia sintética `switch.next`, disponible solo dentro de `props.action.query`/`body`/`headers` del mismo `button` que declara `variant: 'switch'`. Resuelve al booleano contrario al valor actual de `props.checked` de esa misma instancia en el momento del click (si `checked` resuelve `true`, `switch.next` es `false`, y viceversa). Es lo que permite mandar al backend el valor real al que se está pasando (p. ej. `body: { isPrimary: "switch.next" }`), sin lo cual la `action` no tendría forma de saber qué valor enviar más allá de un literal fijo.
- `variant: 'switch'` reutiliza `color` para teñir el estado marcado (`checked: true`) con el color semántico configurado; el estado no marcado usa siempre el mismo tratamiento neutro, sin variación por `color`.
- `variant: 'switch'` puede aparecer en cualquier contexto donde `button` ya es válido hoy: suelto, dentro de `repeater.props.template`, dentro de `table` (celda-nodo), dentro de `modal`, o como botón auxiliar dentro de un `form`. No queda restringido a estar dentro o fuera de un `form`.
- El estado visual `checked` se deriva siempre de la referencia de datos configurada, nunca de un estado local optimista del click: un click dispara la `action`, pero el switch solo cambia de aspecto cuando el dato de origen (`checked`) cambia — típicamente tras el refetch encadenado en `onSuccess` de la propia `action`.

## Fuera de alcance
- Cambios en `toggle` o `checkboxGroup`: siguen sin admitir `action`, sin cambios de comportamiento ni de contrato.
- Lógica de exclusividad "solo un item principal a la vez": se asume resuelta enteramente en el backend (el endpoint que marca principal deja los demás sin marcar) y reflejada en la siguiente lectura de los datos de origen del `checked`. El switch no orquesta desmarcado de otras filas ni de otros switches.
- Cualquier estado `disabled` nuevo en el catálogo de `button`: `variant: 'switch'` no introduce un mecanismo de deshabilitado; el click siempre dispara la `action`, incluso cuando el switch ya está `checked: true`.
- `labelPosition` tipo `top | inline` como en `toggle`: la nueva variante solo controla visibilidad del label (`labelVisible`), no su posición relativa al control.
- Cualquier animación o transición visual específica más allá de reflejar el valor booleano actual.
- Edición dedicada de `checked`/`labelVisible` en el editor visual de desarrollo: se evalúa en implementación si el mecanismo genérico del panel de propiedades ya lo cubre sin trabajo adicional.

## Requisitos funcionales
1. `button.props.variant` acepta `switch` como quinto valor del enum, junto a `solid | outline | ghost | link`.
2. Cuando `variant: 'switch'`, `button.props.checked` es obligatorio y acepta boolean literal o referencia dinámica completa; sin `checked`, el config se rechaza antes del render.
3. Cuando `variant` no es `switch`, `checked` y `labelVisible` no son válidos: si aparecen, el config se rechaza antes del render.
4. `variant: 'switch'` se renderiza como `<button type="button" role="switch" aria-checked={checked}>`, con la misma semántica de accesibilidad que ya usa `toggle` (`toggle.md`).
5. Un click sobre `variant: 'switch'` dispara la `action` configurada en `props.action`, con la misma resolución de `item.*`/`query`/`body`/`headers` y el mismo catálogo de tipos (`executeOperation`, `executeOperations`, `navigateTo`, `goBack`, `resetForm`, `openModal`, `closeModal`) que ya tiene `button` hoy.
6. `props.action.query`/`body`/`headers` de un `button` con `variant: 'switch'` puede referenciar `switch.next` (además de `item.*`/`queries.*`/`forms.*`/`params.*`, ya soportados) para incluir en el payload el booleano al que el click está pasando esa instancia: la negación del `checked` resuelto de esa misma instancia en el momento del click.
7. `variant: 'switch'` no está restringido a vivir dentro de un `form`: puede aparecer suelto, dentro de `repeater`, `table`, `modal`, o como botón auxiliar dentro de un `form`.
8. `button.props.labelVisible: false` deja de renderizar el texto de `label` visualmente, pero el valor resuelto de `label` se sigue usando como `aria-label` del control.
9. `button.props.labelVisible` ausente o `true` renderiza el `label` visible junto al switch (comportamiento por defecto).
10. El color semántico (`props.color`) tiñe el estado `checked: true` del switch; el estado `checked: false` usa siempre el mismo tratamiento visual neutro, sin importar `color`.
11. El estado visual del switch (marcado/no marcado) se recalcula únicamente a partir del valor resuelto de `checked` en cada render; un click no cambia ese valor ni el de `switch.next` de forma local antes de que el dato de origen se actualice — ambos se recalculan en cada disparo a partir del `checked` vigente en ese momento.

## Requisitos no funcionales
- Reutilizar el ejecutor de acciones ya existente de `button` (mismo camino de código que `solid|outline|ghost|link`), sin introducir un segundo modelo de disparo de operaciones.
- Mantener el umbral de cobertura de tests del 80% sobre `src/` ya exigido por el proyecto.
- Sin cambios de comportamiento observable para instancias existentes de `button` que no declaren `variant: 'switch'`.
- Accesibilidad consistente con el patrón ya usado por `toggle` (`role="switch"`, `aria-checked`), para que ambos controles se comporten igual ante lectores de pantalla pese a ser nodos distintos.

## Criterios de aceptación
- Un `button` con `variant: 'switch'`, `checked: "item.isPrimary"` y `action.type: executeOperation` dentro de `repeater.props.template` se renderiza marcado o no marcado según el valor de `item.isPrimary` de cada fila, sin depender de ningún otro nodo.
- Al hacer click, se dispara la operación configurada en `action`, resolviendo `item.*` de la fila que originó el click, igual que ya hace cualquier `button` dentro de un `repeater` hoy.
- Un `action.onSuccess` que relanza la query del listado deja, tras la respuesta, exactamente un switch marcado en toda la colección cuando el backend aplica exclusividad — el resto se muestran no marcados porque su `checked` (`item.isPrimary`) cambia a `false` en la nueva lectura de datos, no porque el switch gestione la exclusividad.
- Un `button` con `variant: 'switch'`, `checked: "item.isPrimary"` y `action.body: { isPrimary: "switch.next" }`: si `item.isPrimary` resuelve `false` en el momento del click, el body enviado lleva `isPrimary: true`; si resuelve `true`, el body enviado lleva `isPrimary: false`.
- Click sobre un switch ya `checked: true`: dispara igualmente su `action` configurada, con `switch.next` resolviendo `false` en ese payload. Si el backend no aplica ese cambio (por ejemplo, porque no permite desmarcar el único item principal), tras el refetch de `onSuccess` el switch se muestra otra vez `checked: true`, sin lógica adicional de "deshabilitado" en el control.
- Un config con `variant: 'switch'` sin `checked` se rechaza en bootstrap.
- Un config con `checked` declarado y `variant` distinto de `switch` (o ausente, que por defecto es `solid`) se rechaza en bootstrap.
- Un `button` con `variant: 'switch'` y `labelVisible: false` no muestra el texto de `label` en el DOM visible, pero el elemento expone ese texto como `aria-label`.
- Un `button` con `variant: 'switch'` sin `labelVisible` (o `labelVisible: true`) muestra el `label` como texto visible junto al switch.
- Un `button` con `variant: 'switch'` fuera de cualquier `form` se renderiza y dispara su `action` con normalidad, sin el rechazo de bootstrap que hoy aplica a un `button` sin `action` fuera de `form` (ese rechazo sigue aplicando solo cuando no hay `action`, y `switch` exige `action`).
- Botones existentes con `variant: 'solid' | 'outline' | 'ghost' | 'link'` (o sin `variant`) no cambian de comportamiento tras esta feature.

## Casos límite
- `checked` con una referencia bien formada pero cuyo dato aún no existe (por ejemplo, `item.isPrimary` antes de que la colección cargue): se degrada a `false` (no marcado), consistente con la política general de degradación segura del runtime ante datos no disponibles.
- `checked` con literal boolean fijo (`true` o `false`, sin referencia dinámica): el switch se muestra siempre en ese estado; sigue disparando su `action` con normalidad al pulsarse, aunque el estado visual nunca cambie por sí solo.
- `variant: 'switch'` con `props.icon` declarado: se rechaza en bootstrap — la variante switch no admite icono, análogo a como `toggle` no admite `icon`/`iconPosition` hoy.
- `variant: 'switch'` dentro de `repeater.props.template` donde `checked` referencia `item.*`: cada iteración resuelve su propio valor de `checked`, igual que ya ocurre con cualquier otra referencia `item.*` dentro de un `repeater`.
- Dos instancias de `variant: 'switch'` en la misma fila con distinto `action.operationName`: cada una dispara su propia operación de forma independiente, sin coordinación entre ellas (igual que hoy con dos `button` distintos).
- `variant: 'switch'` sin `action`: se rechaza en bootstrap, ya que sin `action` el control no tiene ningún efecto observable más allá de mostrar un estado — un switch decorativo sin acción no forma parte del alcance de esta feature.
- `checked` literal fijo (`true` o `false`, sin referencia dinámica) combinado con `switch.next` en el payload: `switch.next` sigue resolviendo la negación del literal en cada click; como `checked` nunca cambia por sí solo, todos los clicks sucesivos mandan el mismo valor negado.
- `switch.next` referenciado en `props.action.query`/`body`/`headers` de un `button` cuyo `variant` no es `switch`: se rechaza en bootstrap, igual que cualquier referencia fuera de su frontera soportada (mismo criterio que `item.*` fuera de `repeater`).
- `switch.next` referenciado en cualquier superficie que no sea `props.action.query`/`body`/`headers` del propio `button` (por ejemplo, en `props.checked`, en `visibility.reference`, o en la `action` de otro nodo): se rechaza en bootstrap por estar fuera de su frontera soportada.

## Áreas de producto afectadas (alto nivel)
- Catálogo de nodos: `button` (`nodes/button.md`).
- Referencias dinámicas: `references/reference-resolution.md` (añadir `button.props.checked` a las superficies que admiten referencia completa, junto al resto de `defaultValue`; añadir `switch.next` como nueva familia de referencia sintética, con frontera propia análoga a `item.$key`/`item.$index`/`row.$index`).
- Queries y ejecución: `queries/execution.md` (dejar constancia de que la resolución de `switch.next` ocurre en el mismo punto de composición de request que ya resuelve `item.*` para acciones de botón).
- Editor visual de desarrollo: previsiblemente el panel de propiedades ya deriva el widget del enum `variant` y de los props booleanos por convención genérica; a confirmar en implementación si `checked` necesita un widget de referencia dedicado (como ya existe para otros props de referencia) o si el mecanismo genérico ya lo cubre. `switch.next` no necesita widget propio (es un valor sintético, no una referencia que el usuario del editor tenga que buscar en un selector).

## Documentación probablemente afectada (alto nivel)
- `ai-workflow/docs/app-features/nodes/button.md`
- `ai-workflow/docs/app-features/references/reference-resolution.md`
- `ai-workflow/docs/app-features/queries/execution.md`
- `ai-workflow/docs/current-state.md` si cambia el resumen de la fila "Catálogo de nodos"

## Riesgos o preguntas abiertas
- Confirmar con quien mantenga el backend del caso de uso que dispara esta feature (marcar principal/favorita) que el endpoint de marcado deja todos los demás items sin marcar de forma atómica, y que el `onSuccess` de refetch del listado es suficiente para reflejarlo — si no fuera atómico, haría falta lógica adicional (`executeOperations`) fuera del alcance de esta spec.
- Decisión técnica pendiente, no bloqueante para la spec pero sí para planificar: dónde vive la resolución de `switch.next` dentro del pipeline ya existente de resolución de referencias (`src/queries/` construye el request final; el resolver de referencias es compartido entre nodos) sin acoplar ese resolver genérico a un prop específico de `button`. Es la razón por la que esta feature marca `requires_design: true`.
- El resto de decisiones (disparo en click sin `disabled`, visibilidad de `label` configurable con `labelVisible`, no restricción a `form`) se cerraron en la fase de exploración conversacional previa.
