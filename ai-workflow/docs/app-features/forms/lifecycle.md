> Cuándo leer: estado por `formId.fieldId`, inicialización lazy, limpieza por desmontaje, `persistOnUnmount`, invalidación por `pageEntry`, comportamiento de campos ocultos.
> Tamaño: medio.
> Relacionados: [[defaults.md]], [[validation-rules.md]], [[../references/visibility.md]], [[../references/query-state-feedback.md]].

# Ciclo de vida del estado de formulario

## Modelo
- Cada formulario tiene `id`.
- `form.id` debe ser único dentro de toda la configuración.
- Los campos heredan siempre el `formId` desde el contenedor; no lo declaran en su propio shape.
- Los campos escriben en un estado interno por `forms.{formId}.{fieldId}`.
- Cada campo mantiene como base `value`, `error`, `touched`, `dirty` y `defaultValue`.

## Inicialización lazy
- La inicialización de campos es lazy: solo se crea estado para un campo cuando aparece visible por primera vez y todavía no existe en la instancia activa.
- Si un campo ya tiene estado mientras su `form` sigue montado, el runtime conserva ese valor y no rehidrata el `defaultValue`.
- Un campo controlado por `visibility` puede inicializarse lazy la primera vez que llegue a mostrarse, aunque el resto del formulario ya exista en store.
- **Excepción con `tabs` dentro de `form`**: los campos en todos los tabs (con `visibility` visible) se inicializan de forma eager al montar el form, no lazy. Esto permite que campos en tabs inactivos se validen y participen en submit incluso si nunca han sido visitados.
- **Excepción con `hidden`**: los campos `hidden` se inicializan de forma eager al montar el form, independientemente de la visibilidad de nodos padres. El valor de `props.value` (literal o referencia dinámica) se resuelve una sola vez en el momento de la inicialización.

## Desmontaje y persistencia
- Al desmontarse realmente un `form`, el runtime elimina por defecto `forms.{formId}` completo; al volver a montarse, sus campos vuelven a inicializarse como un primer montaje efectivo.
- `form.persistOnUnmount: true` recupera de forma explícita la persistencia histórica dentro de la misma instancia del runtime cuando un flujo necesita conservar valores entre desmontajes.
- Si el formulario se desmonta y vuelve a montarse sin `persistOnUnmount`, el runtime recalcula el `defaultValue` contra el contexto vigente de ese nuevo montaje.

## Reentrada por `pageEntry`
- Si esa referencia dinámica de un `defaultValue` apunta a una query incluida en los `preloads` de una nueva `pageEntry`, la primera inicialización efectiva de esa reentrada ya ocurre contra la query limpia de la entrada activa, no contra el éxito conservado de una visita anterior.

## Campos ocultos
- Un campo oculto por `queryStateFeedback` conserva su valor y su error, pero no bloquea el submit mientras siga oculto.
- Un campo oculto por `visibility` también conserva `value`, `error`, `dirty`, `touched` y `defaultValue`, pero no bloquea el submit mientras siga oculto.
- La visibilidad efectiva de esos campos reutiliza exactamente la misma utilidad compartida que usa el renderer central para combinar `queryStateFeedback` y `visibility`.
- Un campo oculto por `queryStateFeedback.states.idle` no bloquea el submit antes de la primera ejecución de la query observada y vuelve a validarse cuando la query abandona `idle`.
- Si un campo vuelve a hacerse visible tras una regla `visibility`, el runtime reutiliza su estado local existente y vuelve a incluirlo en la validación normal.
- **Omisión de payload**: cuando un campo del formulario está oculto en el momento del submit, cualquier clave del request (`body`, `query`, `headers`) cuya referencia apunte a ese campo se omite del payload final, en lugar de viajar vacía. Esto aplica solo a referencias a campos del propio formulario que dispara el submit; referencias a campos de otros formularios, `params.*`, `queries.*` o `item.*` siguen siendo errores si faltan.
- **Excepción de payload para `hidden`**: los campos de tipo `hidden` nunca se omiten del payload, independientemente de la visibilidad de sus nodos padres. Un campo hidden siempre tiene valor y siempre se incluye.

## Campos dentro de `tabs` en formularios

Cuando un nodo `tabs` es hijo de un nodo `form`:

- Los campos de todos los items de `tabs` (con `visibility` evaluada como visible) se descubren, inicializan y validan **independientemente del tab activo**. A diferencia de `accordion` (donde los campos no se descubren hasta que su sección se abre), los campos en tabs inactivos participan desde el montaje del form.
- **Validación sin visibilidad**: si un campo `required` vive en un tab que el usuario nunca ha visitado, el submit falla igual que si el campo fuera visible. El error de validación se almacena en el state del campo, pero el usuario no lo verá hasta que conmute al tab correspondiente.
- **Items con `visibility` oculta**: si un item de `tabs` tiene `visibility` que evalúa como oculto, sus campos no participan en validación ni submit, igual que cualquier campo oculto por `visibility`.
- **Items sin `visibility` pero inactivos**: si un item de `tabs` no tiene `visibility` declarada pero simplemente no es el tab activo, sus campos **sí** participan en validación y submit. Esta es la diferencia intencional con `accordion`.
- **Inicialización de `defaultValue`**: los campos en tabs inactivos se inicializan con su `defaultValue` resuelto al montar el form. Si el `defaultValue` referencia una `queries.*`, se resuelve contra el estado vigente de esa query.
- **Estado local conservado**: mientras el form esté montado, los campos en tabs inactivos conservan `value`, `error`, `dirty`, `touched` y `defaultValue`. El cambio de tab no afecta su estado.

## Encaje en el contrato de páginas
- El runtime implementa `form` como nodo contenedor real dentro de `pages[].layout`.
- La raíz de `pages[].layout` sigue siendo una colección ordenada, así que un formulario puede convivir con otros bloques hermanos sin wrapper sintético.
- `form.children` reutiliza el árbol declarativo existente y admite `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `toggle`, `hidden`, `button`, `heading`, `paragraph`, `image`, `table`, `container`, `accordion`, `tabs` y `divider`.
- El dominio compartido `forms` del store sigue siendo la única fuente de verdad para valores y errores de formulario.

## Casos funcionales soportados
- formulario de búsqueda con resultados
- formulario de edición con datos iniciales cargados por `preloads` o recibidos por `params.*`
- formulario simple de alta o edición con submit declarativo vía `api`
- campos condicionales ocultables por `queryStateFeedback` sin perder su estado local
- campos condicionales ocultables por `visibility` según `forms.*` o `queries.*`, sin perder su estado local ni bloquear el submit mientras siguen ocultos
- reentrada a una página con `defaultValue` dependiente de `params.*` o `queries.*` sin reutilizar por defecto valores escritos en una visita previa si hubo desmontaje real del formulario
- reentrada a una página con `preloads` y `defaultValue` basado en `queries.*` sin hidratar transitoriamente el registro de la entrada anterior mientras la nueva carga está en curso
- formularios cuyos labels u opciones visibles combinan texto literal con `forms.*`, `queries.*`, `params.*` o `item.*` mediante placeholders `{{...}}`
- formularios organizados en secciones visuales por `tabs`, donde todos los campos de todos los tabs participan en validación y submit aunque el usuario solo haya visitado algunos

## Lo que no hace todavía
- No existe todavía una política nueva de limpieza global de formularios al cambiar de página.
- No existe rehidratación automática de campos ya montados cuando cambian `params.*`, `queries.*` u otros datos externos sin desmontaje real.
- No expone un estado agregado de `isValid`, `isSubmitting` o `submitErrors` separado de `forms.*` y `queries.*`.
