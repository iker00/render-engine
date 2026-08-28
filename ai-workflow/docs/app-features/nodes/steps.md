> Cuándo leer: si la tarea toca el nodo `steps` — formulario organizado en pasos secuenciales (wizard), navegación gateada por validación, variantes visuales.
> Tamaño: medio.
> Relacionados: [[form.md]], [[../forms/lifecycle.md]], [[../forms/validation-rules.md]], [[tabs.md]], [[../references/visibility.md]], [[../references/query-state-feedback.md]].

# Nodo `steps`

Nodo estructural que organiza un formulario en pasos secuenciales (wizard), exclusivo como descendiente de `form` — a diferencia de `tabs` y `accordion`, `steps` fuera de `form` rechaza el config antes del render. La navegación entre pasos está gateada por validación: no se avanza a un paso siguiente si el paso actual tiene errores. El nodo genera automáticamente sus propios botones de navegación; el autor del JSON no los declara como nodos `button` sueltos.

## Props

| Prop | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `props.items` | `Array<{ label: string, visibility?: VisibilityRule, children?: Node[] }>` | sí | — | Lista ordenada de pasos. Debe tener al menos un elemento. Mismo shape que `tabs.props.items`. |
| `props.variant` | `"horizontal" \| "vertical" \| "progress"` | no | `"horizontal"` | Distribución visual del indicador de progreso. |
| `props.backLabel` | `string` | no | `"Back"` | Texto del botón "Atrás". Soporta interpolación `{{...}}`. |
| `props.nextLabel` | `string` | no | `"Next"` | Texto del botón "Siguiente". Soporta interpolación `{{...}}`. |
| `props.submitLabel` | `string` | no | `"Submit"` | Texto del botón de envío del último paso. Soporta interpolación `{{...}}`. |

### Estructura de cada item de `props.items`

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `label` | `string` | sí | Etiqueta visible del paso. Soporta interpolación `{{...}}`. |
| `visibility` | `VisibilityRule` | no | Regla de visibilidad específica del item. Un paso oculto no aparece en el indicador, no es alcanzable y sus campos no participan en validación ni payload. |
| `children` | `Node[]` | no | Nodos del panel de ese paso. Admite cualquier nodo válido del catálogo. |
| `onNext` | `{ operationName: string, query?, body?, headers? }` | no | Operación de `api.*` que gatea el avance desde este paso (ver "Gating de avance con `onNext`" más abajo). Aplica igual al último paso, donde gatea el envío del `form`. |

`steps` no acepta `children` en su raíz: solo `props.items[i].children`, igual que `tabs`.

## Campos transversales

- `visibility`: oculta o muestra el nodo entero (indicador + panel).
- `queryStateFeedback`: sustituye el nodo entero por el feedback correspondiente cuando el estado de la query no es la rama principal.
- `layout.span`: ocupa columnas dentro de un `container` con `columns` activo.

## Comportamiento

### Navegación

- Al montar, el paso activo es siempre el primer item visible por índice creciente. No existe `props.defaultStep` ni equivalente: arrancar en otro paso rompería la garantía de que ningún paso llega al submit sin haber sido validado.
- **Avanzar ("Siguiente")**: valida únicamente los campos visibles del paso activo con el mismo motor de validación de campos (`required`, `minLength`, `maxLength`, `min`, `max`, `minSelections`, `maxSelections`, `pattern`, `email`, `url`, `when`) que usa el submit del `form`. Si algún campo falla, el paso no avanza y los errores se muestran en el paso actual. Si todos los campos son válidos, el paso activo avanza al siguiente paso visible.
- **Retroceder ("Atrás")**: libre, nunca requiere validación. Mueve el paso activo al paso visible anterior y conserva los valores ya introducidos en todos los pasos.
- **Indicador clicable** (`horizontal`/`vertical`): permite retroceder a cualquier paso ya alcanzado (posición ≤ posición del paso más avanzado alcanzado mediante un "Siguiente" válido). Un paso todavía no alcanzado no es clicable y un clic sobre él no tiene efecto. En `progress` no existe indicador clicable; el retroceso solo está disponible mediante el botón "Atrás".
- El índice del paso más avanzado alcanzado (`maxVisitedIndex`) se actualiza solo al superarlo mediante un "Siguiente" válido, nunca al navegar hacia atrás.
- Si el paso activo pasa a estar oculto por un cambio de `visibility` en runtime, el nodo activa automáticamente el primer paso visible disponible, sin intervención del usuario (mismo criterio que `tabs`).

### Gating de avance con `onNext`

- Cualquier item de `props.items` puede declarar `onNext: { operationName, query?, body?, headers? }`, una operación de `api.*` que gatea el avance desde ese paso. Aplica igual al último paso: ahí gatea el envío del `form` en vez del avance a un paso siguiente (ver "Botones de navegación").
- Orden de evaluación al pulsar "Siguiente" (o el botón de envío si el último paso declara `onNext`): primero la validación de campos del paso activo, idéntica a un paso sin `onNext`. Solo si el paso es válido se ejecuta `onNext`; un paso con campos inválidos nunca llega a invocarlo.
- Mientras `onNext` está en curso, el botón que lo disparó queda `disabled` y `aria-busy="true"`, y se muestra un indicador accesible `role="status"` (oculto visualmente) hasta que se resuelve.
- Si `onNext` resuelve en error (error HTTP de la operación o su `errorCondition` de negocio), el paso no avanza y el mensaje de error se muestra bajo el panel con `role="alert"`. Un reintento que resuelve en éxito sustituye el error anterior; nunca se acumulan mensajes.
- Si `onNext` resuelve en éxito, el paso avanza al siguiente paso visible con normalidad (o, en el último paso, se dispara el envío del `form`).
- El botón "Atrás" nunca ejecuta `onNext`, en ningún paso — el retroceso sigue siendo libre y sin validación ni gating.
- El estado de `onNext` (pendiente/error) es por instancia de `steps`, no por paso: al cambiar el paso activo (por ejemplo con "Atrás"), cualquier error de `onNext` pendiente se descarta.
- Si el usuario navega fuera del paso que disparó `onNext` mientras la operación sigue en curso, el resultado se descarta al resolver: ni error ni avance se aplican sobre un paso que ya no es el activo.

### Botones de navegación

- El nodo genera automáticamente hasta tres botones al final del panel activo: "Atrás", "Siguiente" y el botón de envío del último paso.
- El botón del último paso visible se renderiza como `<button type="submit">` y dispara el `submitAction` ya existente del `form` padre — mismo mecanismo que usa hoy un `button` sin `action` dentro de `form`, sin ningún mecanismo de submit nuevo. **Excepción**: si el último item declara `onNext`, el botón se renderiza como `<button type="button">` con un interceptor que valida el paso, ejecuta `onNext` con el mismo gating de la sección anterior y, solo si resuelve en éxito, dispara `requestSubmit()` sobre el `form` para reutilizar el pipeline de envío existente. No existe ningún mecanismo de merge entre el resultado de `onNext` y el payload agregado del submit; son dos llamadas independientes a `api.*`.
- Los botones "Atrás" y "Siguiente" son `type="button"` y no disparan submit nativo.
- Cuando solo hay un paso visible, no se renderizan "Atrás" ni "Siguiente"; solo el botón de envío.
- Los tres textos son configurables vía `props.backLabel`/`props.nextLabel`/`props.submitLabel`, con valores por defecto en inglés si no se personalizan.

### Ciclo de vida de campos dentro de `form`

- **Inicialización lazy por paso**: a diferencia de `tabs` (que inicializa de forma eager todos los campos de todos los items al montar el `form`), `steps` inicializa los campos de un paso solo la primera vez que ese paso se activa. El detalle completo vive en [[../forms/lifecycle.md#Campos dentro de steps en formularios]].
- **Descubrimiento, validación y payload de submit**: para estos tres usos, `steps` se comporta exactamente igual que `tabs` — los campos de todos los items con `visibility` visible participan, independientemente de qué paso esté activo. Como no se puede avanzar sin validar el paso actual, al llegar al último paso todos los pasos visibles ya recorridos están garantizados válidos; aun así, el submit del `form` vuelve a descubrir y validar el árbol completo (incluyendo pasos nunca visitados por el usuario), igual que hace hoy con `tabs`.
- Un item de `steps` con `visibility` oculta excluye sus campos de validación, inicialización y payload del submit, igual que un item de `tabs` oculto.

## Variantes visuales

- **`horizontal`** (default): indicador numerado en fila horizontal encima del panel, con scroll horizontal si excede el ancho disponible. Reutiliza la técnica de "tab conectado" de `tabs`: el paso activo funde su borde inferior con el borde superior del panel.
- **`vertical`**: indicador en columna a la izquierda del panel (ancho fijo ~192px), panel a la derecha. El paso activo funde su borde derecho con el borde izquierdo del panel.
- **`progress`**: sin indicador de pasos individuales; muestra únicamente un texto tipo "Paso X de Y" (posición 1-based del paso activo entre los pasos visibles) y el botón "Atrás". No hay ningún control clicable para saltar de paso.

En `horizontal`/`vertical`, cada paso del indicador muestra un marcador circular numerado (1-based sobre los pasos visibles) con tres estados visuales: activo, ya visitado (alcanzable) y todavía no alcanzado.

## Casos límite

- `props.items` vacío: rechazado en validación previa al render, igual que `tabs`.
- Todos los items ocultos por `visibility`: el nodo no renderiza ni indicador ni panel — degradación silenciosa.
- Un único item visible: no se muestran los botones "Atrás"/"Siguiente", solo el botón de envío.
- El paso activo queda oculto por un cambio de `visibility` en runtime: el nodo activa automáticamente el primer paso visible disponible.
- Un item no declara `visibility`: se comporta siempre como visible, sin afectar a otros items.
- Un item no declara `children` o los declara como array vacío: el panel de ese paso se muestra vacío sin error.
- `queryStateFeedback` activo en un estado distinto de la rama principal: sustituye el nodo `steps` entero.

## Validación previa al render

- `steps` fuera de `form` (como descendiente directo o indirecto de cualquier otro nodo, o en la raíz de `layout`) rechaza el config completo antes del render.
- `props.items` es obligatorio y debe tener al menos un elemento.
- Cada item de `props.items` debe declarar `label` como string.
- `props.variant` solo acepta `"horizontal"`, `"vertical"` o `"progress"` si se declara.
- Los `children` de cada item se validan recursivamente con las mismas reglas del catálogo.

## Lo que está fuera de alcance (v1)

- Uso de `steps` fuera de `form`.
- Saltar directamente a un paso todavía no visitado, por cualquier mecanismo.
- Generación dinámica de pasos desde una colección de `queries.*`.
- Persistencia del paso activo entre navegación de página o reentrada por `pageEntry`; al remontar el `form`, `steps` siempre arranca en el primer paso.
- `props.defaultStep` o equivalente.
- Deshabilitar o cerrar pasos individuales sin ocultarlos completamente.
- Carga lazy de paneles no visitados (el lazy es solo de inicialización de estado de campos, no de código/bundle).
- Soporte en el editor visual (`dev-editor`) para configurar `steps` desde un panel de propiedades dedicado.
