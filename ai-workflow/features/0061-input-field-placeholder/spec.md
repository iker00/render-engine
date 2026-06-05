# Spec: placeholder en nodos de formulario

## Objetivo
Permitir que los nodos `input`, `textarea` y `select` declaren un texto de ayuda visual que aparece cuando el campo está vacío, usando el mecanismo nativo del navegador o su equivalente declarativo.

## Alcance
- `input.props.placeholder`: string opcional con soporte de interpolación `{{...}}`. Se pasa al atributo HTML nativo `placeholder` del `<input>`.
- `textarea.props.placeholder`: string opcional con soporte de interpolación `{{...}}`. Se pasa al atributo HTML nativo `placeholder` del `<textarea>`.
- `select.props.placeholder`: string opcional con soporte de interpolación `{{...}}`. Se renderiza como `<option value="" disabled>` al inicio del listado de opciones. Visible solo cuando ningún valor está seleccionado. No computa como valor efectivo ni como selección válida.
- Para `select.multiple`, `placeholder` se ignora: no existe una convención HTML equivalente para selección múltiple.
- `placeholder` se añade al catálogo de superficies que admiten interpolación parcial `{{...}}` en `dynamic-strings.md`.

## Fuera de alcance
- `radioGroup` y `checkboxGroup`: no existe concepto de `placeholder` en HTML para estos controles.
- Estilos específicos del texto de placeholder más allá de la presentación nativa del navegador (futura feature de theming).
- Placeholders dinámicos con referencias completas (solo `string` literal o interpolación parcial).
- Validación de que el `placeholder` tenga contenido: es siempre opcional y puede quedar vacío o sin declarar.

## Requisitos funcionales

### `input`
- Acepta `props.placeholder` como string opcional.
- Si se declara, se pasa directamente al atributo `placeholder` del `<input>` renderizado.
- Si no se declara o resuelve como vacío, el campo no incluye el atributo `placeholder`.

### `textarea`
- Acepta `props.placeholder` como string opcional.
- Si se declara, se pasa directamente al atributo `placeholder` del `<textarea>` renderizado.
- Si no se declara o resuelve como vacío, el campo no incluye el atributo `placeholder`.

### `select` simple
- Acepta `props.placeholder` como string opcional.
- Cuando `placeholder` se declara y no hay valor seleccionado, se renderiza como primera opción `<option value="" disabled>` con el texto del placeholder. Esta opción no es seleccionable por el usuario.
- Cuando hay un valor seleccionado, la opción placeholder sigue presente en el DOM pero no visible como selección activa (comportamiento nativo del `<select>`).
- La opción placeholder no participa en la colección efectiva de valores válidos ni en la validación `required`.

### `select.multiple`
- `placeholder` se ignora aunque esté declarado.

### Interpolación
- Los tres campos soportan interpolación parcial `{{...}}` con el mismo catálogo de referencias que ya admite `props.label`: `forms.*`, `queries.*`, `params.*`, `item.*`, `translations.*`.
- Un placeholder no resoluble o con referencias ausentes degrada a string vacío siguiendo la semántica estándar de placeholders de interpolación.

### Validación de configuración
- `placeholder` es opcional en los tres nodos; su ausencia no invalida el config.
- `placeholder` acepta cualquier string; no se valida el contenido.
- Si `select.multiple: true` y se declara `placeholder`, la validación no lo rechaza pero el runtime lo ignora silenciosamente.

## Requisitos no funcionales
- Sin regresión en el contrato visual ni en la accesibilidad existente de los nodos afectados.
- Sin cambios en la semántica de validación de formularios: `placeholder` no afecta a `required`, `minLength`, `maxLength` ni a cualquier otra regla.

## Criterios de aceptación
1. Un `input` con `props.placeholder: "Introduce tu nombre"` muestra el texto en el campo vacío y lo oculta al escribir.
2. Un `textarea` con `props.placeholder: "Escribe aquí..."` muestra el texto en el área vacía.
3. Un `select` simple con `props.placeholder: "Selecciona una opción"` muestra esa opción deshabilitada como primera opción cuando no hay valor seleccionado.
4. Un `select` simple con `required` y solo el placeholder seleccionado falla la validación `required`.
5. Un `select.multiple` ignora `placeholder` aunque esté declarado; no aparece ninguna opción adicional.
6. Un `input` con `props.placeholder: "Hola {{params.userName}}"` resuelve la referencia dinámica correctamente.
7. Un `input` sin `props.placeholder` no incluye el atributo `placeholder` en el HTML renderizado.
8. Añadir `placeholder` a cualquiera de los tres nodos no cambia el comportamiento de los demás campos del formulario ni el proceso de submit.

## Casos límite
- `placeholder` declarado como string vacío `""`: equivale a no declararlo; no se pasa el atributo al DOM.
- Referencia en `placeholder` que resuelve a `null`, objeto o array: el placeholder queda vacío (semántica estándar de interpolación).
- `select` con `defaultValue` que no coincide con ninguna opción: el campo queda vacío y el placeholder es visible si está declarado.
- `select` con `defaultValue` que coincide: el placeholder no es la opción activa aunque esté en el DOM.

## Riesgos o preguntas abiertas
Ninguno.
