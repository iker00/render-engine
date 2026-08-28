> Cuándo leer: `defaultValue` literal o dinámico, integración con `params.*` e `item.*`, política de hidratación con `preloads`, política con `select`/`radioGroup` cuando la opción desaparece.
> Tamaño: corto.
> Relacionados: [[lifecycle.md]], [[../references/reference-resolution.md]], [[../queries/preloads.md]].

# Valores por defecto

## Reglas básicas
- Los campos pueden declarar `defaultValue`.
- Ese valor puede ser literal o dinámico.
- La familia `params.*` ya forma parte de las referencias dinámicas soportadas para `defaultValue`.
- Dentro de un `repeater`, `defaultValue` también puede resolver `item.*` contra la iteración activa.
- Si `defaultValue` es una referencia dinámica, se resuelve una sola vez en el momento de la primera inicialización efectiva del campo.
- `defaultValue` no aplica interpolación parcial: puede ser literal o referencia completa soportada, pero un string como `Hola {{params.userId}}` se trata como literal.

## Hidratación con `preloads`
- Si esa referencia dinámica apunta a una query incluida en los `preloads` de una nueva `pageEntry`, la primera inicialización efectiva de esa reentrada ya ocurre contra la query limpia de la entrada activa, no contra el éxito conservado de una visita anterior.
- Si el dato dinámico aparece más tarde mientras el formulario sigue montado, el runtime no rehidrata automáticamente el campo.
- **Excepción acotada ya implementada**: si el campo sigue prístino y todavía no ha quedado hidratado efectivamente durante la nueva entrada, puede absorber el primer dato fresco que llegue desde esa tanda de `preloads` sin convertir `defaultValue` en una referencia reactiva general.

## Política al desmontar y remontar
- Si el formulario se desmonta y vuelve a montarse sin `persistOnUnmount`, el runtime recalcula el `defaultValue` contra el contexto vigente de ese nuevo montaje.

## Opciones que desaparecen
- En `select` simple y en `radioGroup`, si el valor efectivo no coincide con ninguna opción disponible en la colección resuelta, el campo queda vacío.
- En `select.multiple` y en `checkboxGroup`, solo se conservan seleccionados los valores que sigan existiendo en la colección efectiva disponible.
- **Excepción — `autocomplete` con `props.items` dinámico** (`queries.*` o `item.*`): no sigue esta regla. Una vez fijado un valor simple o añadido un chip, permanece seleccionado aunque una búsqueda o resolución posterior deje de incluirlo entre las sugerencias, porque en shape dinámico la colección representa solo las sugerencias visibles de la búsqueda más reciente, no un catálogo completo y estable. `autocomplete` con `props.items` manual (literal o escalar) sigue el comportamiento estándar de arriba. Ver [[../nodes/autocomplete.md#persistencia-de-selecciones-frente-a-datos-dinámicos-cambiantes]].

## Reset
- El reset por formulario restaura el estado inicial efectivo de cada campo usando ese `defaultValue` cuando exista.
