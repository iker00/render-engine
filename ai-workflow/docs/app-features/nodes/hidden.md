> Cuándo leer: nodo `hidden`, campo sin render que aporta valor al payload del submit.
> Tamaño: corto.
> Relacionados: [[../forms/lifecycle.md]], [[../forms/submit.md]].

# `hidden`

## Contrato (`props`)
- `props.fieldId`: string obligatorio y único dentro del `form` contenedor.
- `props.value`: obligatorio. Literal JSON simple (string, number, boolean) o referencia dinámica completa soportada por el runtime. Se resuelve una sola vez en el momento de la inicialización del campo, con la misma semántica que `defaultValue` en el resto de campos.

## Props no soportados
- No declara `label`, `placeholder`, `validations`, `defaultValue`, `icon`, `iconPosition` ni ninguna otra prop visual o de validación. Si se declaran, el config se rechaza antes del render.

## Reglas de render
- No produce ningún elemento DOM. No tiene label, error, wrapper ni espacio visual.

## Valor en store
- `forms.{formId}.{fieldId}.value` almacena el valor resuelto de `props.value`.

## Inicialización
- No es lazy. Se inicializa al montar el `form` independientemente de cualquier condición de visibilidad de nodos padres, ya que el nodo no tiene representación visual.

## Validación
- No participa en validación. No bloquea el submit ni genera errores.

## Payload
- Su valor se incluye en el payload del submit como cualquier otro campo del formulario cuando se referencia desde `submitAction.body`, `submitAction.query` o `submitAction.headers`.
- Un campo hidden nunca se omite del payload por la lógica de omisión de campos ocultos, independientemente de la visibilidad de sus nodos padres.

## Integración transversal
- No soporta `visibility`, `queryStateFeedback` ni `layout.span`. Si se declaran `visibility` o `queryStateFeedback` en el nodo, el config se rechaza antes del render. `layout.span` se descarta silenciosamente.
- Solo es válido como descendiente de un `form`. Un hidden fuera de form rechaza el config antes del render.
- Puede aparecer dentro de `repeater.props.template` dentro de un `form`, con la misma semántica de contexto `item.*` que el resto de campos.

## Diferencia con campos ocultos por `visibility`
- Un campo de otro tipo (input, select, etc.) oculto por `visibility` conserva su estado y se omite del payload.
- Un campo `hidden` siempre tiene valor y siempre se incluye en el payload — no le aplica `visibility` ni `queryStateFeedback`.

## Límites
- No soporta `disabled` ni `readOnly`.
