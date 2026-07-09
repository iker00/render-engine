# Feature 0094 — Extended form fields and validations

## Objetivo

Ampliar el catálogo de nodos de formulario con dos campos nuevos (`toggle` y `hidden`) y extender el sistema de
validación local con tres reglas nuevas (`pattern`, `email`, `url`) y soporte de validación condicional (`when`)
reutilizando el shape de condición de `visibility`.

## Alcance

### Nuevos nodos de formulario

#### `toggle`

Nodo de formulario con semántica booleana (`true`/`false`) renderizado como un interruptor on/off.

- `props.fieldId`: string obligatorio y único dentro del `form` contenedor.
- `props.label`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.labelPosition`: enum cerrado `top | inline`, default `top`.
    - `top`: label encima del control, siguiendo la disposición habitual de los demás campos del catálogo.
    - `inline`: label a la derecha del control en la misma línea.
- `props.defaultValue`: boolean literal (`true` o `false`) o referencia dinámica completa soportada por el runtime. Si
  no se declara, el valor inicial es `false`.
- `props.validations`: objeto opcional y ordenado por declaración.
    - `props.validations.required`: `true` o `{ value: true, message?: string }`. Para un toggle, `required` significa
      que el campo debe estar en `true` (activado) para pasar la validación. Un toggle en `false` con `required` falla
      la validación.

Valor en store: `forms.{formId}.{fieldId}.value` almacena `true` o `false` como boolean.

Valor en payload: se serializa como boolean en `body`/`query` del submit.

Accesibilidad: el control renderiza un `<button>` con `role="switch"` y `aria-checked` con el valor actual. Cuando hay
error activo, incluye `aria-describedby="${formId}-${fieldId}-error"` apuntando al span de error.

El toggle no acepta `items`, `optionLayout`, `minSelections`, `maxSelections`, `minLength`, `maxLength`, `min`, `max`,
`icon` ni `iconPosition`.

#### `hidden`

Nodo de formulario que aporta un valor al payload del submit sin renderizar nada en la UI.

- `props.fieldId`: string obligatorio y único dentro del `form` contenedor.
- `props.value`: obligatorio. Literal JSON simple (string, number, boolean) o referencia dinámica completa soportada por
  el runtime. Se resuelve una sola vez en el momento de la inicialización del campo, con la misma semántica que
  `defaultValue` en el resto de campos.

El campo `hidden` no declara `label`, `placeholder`, `validations`, `defaultValue`, `icon`, `iconPosition` ni ninguna
otra prop visual o de validación.

Valor en store: `forms.{formId}.{fieldId}.value` almacena el valor resuelto de `props.value`.

Inicialización: no es lazy. Se inicializa al montar el `form` independientemente de cualquier condición de visibilidad,
ya que el nodo no tiene representación visual.

Validación: no participa en validación. No bloquea el submit ni genera errores.

Render: no produce ningún elemento DOM. No tiene label, error, wrapper ni espacio visual.

Payload: su valor se incluye en el payload del submit como cualquier otro campo del formulario cuando se referencia
desde `submitAction.body`, `submitAction.query` o `submitAction.headers`.

Campos ocultos vs. `hidden`: un campo de otro tipo (input, select, etc.) oculto por `visibility` conserva su estado y se
omite del payload. Un campo `hidden` siempre tiene valor y siempre se incluye en el payload — no le aplica `visibility`
ni `queryStateFeedback`.

### Nuevas reglas de validación

#### `pattern`

Validación por expresión regular aplicable a campos textuales (`input` con `inputType` text, email, password, search,
tel, url; y `textarea`).

- Shape: `string` (solo el pattern) o `{ value: string, message?: string }`.
- El valor de `pattern` es un string de expresión regular JavaScript sin flags. Se aplica sin anclaje automático: si el
  autor quiere validar el string completo, debe incluir `^` y `$` en el pattern.
- Si el campo está vacío (`''`), `pattern` no falla. El control de obligatoriedad se delega a `required`.
- Si el pattern no compila como `RegExp` válido, el config completo se rechaza antes del render con la ruta exacta.
- Mensaje por defecto: `"Invalid format."`.

Ejemplo:

```json
{
  "validations": {
    "pattern": {
      "value": "^\\d{5}$",
      "message": "Introduce un código postal válido"
    }
  }
}
```

#### `email`

Validación de formato de email aplicable a campos textuales (`input` con cualquier `inputType` textual; y `textarea`).

- Shape: `true` o `{ value: true, message?: string }`.
- El runtime aplica una validación básica de formato (presencia de `@`, al menos un carácter antes y después, dominio
  con al menos un punto). No pretende cubrir RFC 5322 completo.
- Si el campo está vacío (`''`), `email` no falla.
- Mensaje por defecto: `"Invalid email address."`.

Ejemplo:

```json
{
  "validations": {
    "email": {
      "value": true,
      "message": "{{translations.invalid_email}}"
    }
  }
}
```

#### `url`

Validación de formato de URL aplicable a campos textuales (`input` con cualquier `inputType` textual; y `textarea`).

- Shape: `true` o `{ value: true, message?: string }`.
- El runtime valida que el string sea parseable como URL válida (usando `URL` constructor nativo) con protocolo `http` o
  `https`.
- Si el campo está vacío (`''`), `url` no falla.
- Mensaje por defecto: `"Invalid URL."`.

Ejemplo:

```json
{
  "validations": {
    "url": true
  }
}
```

### Validación condicional (`when`)

Cualquier regla de validación en su forma extendida (objeto con `value` y opcionalmente `message`) puede incluir un
campo `when` que condiciona la evaluación de esa regla.

El shape de `when` es idéntico al shape de condición de `visibility`:

```json
{
  "reference": "forms.myForm.userType",
  "operator": "equals",
  "value": "business"
}
```

- `reference`: referencia runtime completa no vacía. Admite las mismas familias que `visibility`: `params.*`, `item.*`,
  `forms.*`, `queries.*`.
- `operator`: `equals | notEquals | isTruthy | isFalsy | greaterThan | lessThan`.
- `value`: obligatorio para `equals`, `notEquals`, `greaterThan`, `lessThan`; prohibido para `isTruthy`, `isFalsy`.

Comportamiento:

- Cuando `when` está presente y la condición **se cumple**, la regla se evalúa normalmente.
- Cuando `when` está presente y la condición **no se cumple**, la regla se omite como si no estuviera declarada.
- Cuando `when` no está presente, la regla se evalúa siempre (comportamiento actual sin cambios).
- Una referencia válida pero ausente sigue la misma semántica que `visibility`: `isFalsy` la considera falsa, `isTruthy`
  no hace match, el resto de operadores no hace match.

Validación de shape:

- Si `when.reference` sale del alcance soportado, el config completo se rechaza antes del render.
- Si `when.operator` usa un valor fuera del catálogo soportado, el config completo se rechaza antes del render.
- Si `when.operator` es `isTruthy` o `isFalsy` y declara `value`, el config completo se rechaza antes del render.
- Si `when.operator` es `equals`, `notEquals`, `greaterThan` o `lessThan` y omite `value`, el config completo se rechaza
  antes del render.
- Si `when.operator` es `equals` o `notEquals` y `value` no es un literal escalar, el config completo se rechaza antes
  del render.
- Si `when.operator` es `greaterThan` o `lessThan` y `value` no es numérico, el config completo se rechaza antes del
  render.

`when` aplica a todas las reglas de validación, tanto las existentes (`required`, `minLength`, `maxLength`, `min`,`max`,
`minSelections`, `maxSelections`) como las nuevas (`pattern`, `email`, `url`).

Las formas cortas de las reglas existentes no se modifican: `required: true` sigue funcionando sin `when`. Solo la forma
extendida (`required: { value: true, when: {...} }`) admite condición.

Ejemplo completo:

```json
{
  "validations": {
    "required": {
      "value": true,
      "message": "Campo obligatorio para empresas",
      "when": {
        "reference": "forms.registration.entityType",
        "operator": "equals",
        "value": "business"
      }
    },
    "minLength": {
      "value": 8,
      "when": {
        "reference": "forms.registration.entityType",
        "operator": "notEquals",
        "value": "individual"
      }
    }
  }
}
```

Reutilización de código: la evaluación de la condición `when` debe reutilizar la misma lógica de evaluación de
condiciones que ya usa `visibility`, `submitAction.onSuccess[*].when`, `preloads[*].when` y `operations[*].when`. El
shape es el mismo; la implementación debe compartirse.

### Integración transversal

- `toggle`: soporta `visibility`, `queryStateFeedback` y `layout.span` como cualquier otro nodo de formulario.
- `hidden`: no soporta `visibility`, `queryStateFeedback` ni `layout.span` (no tiene representación visual).
- `toggle` solo es válido como descendiente de un `form`.
- `hidden` solo es válido como descendiente de un `form`.
- `form.children` pasa a admitir `toggle` y `hidden` además de los nodos ya soportados.
- `toggle` y `hidden` pueden aparecer dentro de `repeater.props.template` dentro de un `form`, con la misma semántica de
  contexto `item.*` que el resto de campos.

## Fuera de alcance

- Validación remota (server-side) o validación asíncrona.
- Validación cruzada entre campos (ej. "campo A debe ser mayor que campo B"). `when` condiciona si una regla aplica, no
  compara valores entre campos.
- Composición booleana de condiciones en `when` (AND, OR, múltiples condiciones). Una regla admite un solo `when`.
- Nuevas reglas de validación más allá de `pattern`, `email` y `url`.
- Soporte de flags en `pattern` (case-insensitive, multiline, etc.).
- Variantes visuales del toggle más allá de `labelPosition`.
- Soporte de `disabled` o `readOnly` para `toggle` ni para `hidden` (ningún campo del catálogo actual lo soporta).
- Cambios en el comportamiento de campos existentes (`input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`,
  `fileInput`).

## Requisitos funcionales

### RF-1: Toggle como nodo de formulario

El runtime debe soportar un nodo `toggle` como campo de formulario con semántica booleana, almacenamiento en
`forms.{formId}.{fieldId}`, label con dos posiciones (`top`, `inline`), `defaultValue` boolean o dinámico, y validación
`required` que exige `true`.

### RF-2: Hidden como nodo de formulario

El runtime debe soportar un nodo `hidden` como campo de formulario que aporta un valor fijo o dinámico al payload del
submit sin producir ningún elemento DOM visible, sin participar en validación y con inicialización no lazy al montar el
form.

### RF-3: Validación pattern

El runtime debe soportar una regla `pattern` en `props.validations` que valide el valor de un campo textual contra una
expresión regular JavaScript sin flags ni anclaje automático, con rechazo en config si el pattern no compila.

### RF-4: Validación email

El runtime debe soportar una regla `email` en `props.validations` que valide formato básico de email (presencia de `@`,
caracteres antes y después, dominio con punto), sin fallar en campo vacío.

### RF-5: Validación url

El runtime debe soportar una regla `url` en `props.validations` que valide que el valor sea una URL parseable con
protocolo `http` o `https`, sin fallar en campo vacío.

### RF-6: Validación condicional con `when`

Cualquier regla de validación en forma extendida debe poder declarar un campo `when` con el shape de condición de
`visibility` para condicionar si la regla se evalúa o se omite, reutilizando la lógica de evaluación existente.

### RF-7: Validación de shape en config

El config completo debe rechazarse antes del render cuando:

- `toggle` aparece fuera de un `form`.
- `hidden` aparece fuera de un `form`.
- `toggle.props.labelPosition` tiene un valor fuera del enum cerrado.
- `hidden.props.value` está ausente.
- `pattern.value` no compila como RegExp válido.
- `when` tiene un shape inválido según las mismas reglas que `visibility`.
- `toggle.props.defaultValue` es un literal no boolean.
- `hidden` declara `validations`, `label`, `defaultValue` u otras props no soportadas.

## Requisitos no funcionales

- Las nuevas reglas de validación (`pattern`, `email`, `url`) deben evaluarse en `runtime-form-validations` siguiendo el
  mismo patrón que las reglas existentes.
- La evaluación de `when` debe reutilizar la función de evaluación de condiciones ya existente en el runtime, no
  reimplementar la lógica.
- La validación de shape de `when` debe reutilizar la validación de shape de condición ya existente en `src/config/`.
- El umbral de cobertura del 80% debe mantenerse.

## Criterios de aceptación

### Toggle

- CA-1: Un `toggle` sin `defaultValue` renderiza un interruptor en estado `false`.
- CA-2: Un `toggle` con `defaultValue: true` renderiza un interruptor en estado `true`.
- CA-3: Un `toggle` con `labelPosition: inline` renderiza el label a la derecha del control en la misma línea.
- CA-4: Un `toggle` con `labelPosition: top` (o sin `labelPosition`) renderiza el label encima del control.
- CA-5: Un `toggle` con `required: true` bloquea el submit cuando el valor es `false`.
- CA-6: Un `toggle` con `required: true` permite el submit cuando el valor es `true`.
- CA-7: El valor del toggle se incluye como boolean en el payload del submit.
- CA-8: Un `toggle` oculto por `visibility` no bloquea el submit.
- CA-9: Un `toggle` fuera de `form` rechaza el config antes del render.
- CA-10: Un `toggle` con `defaultValue` referencia dinámica resuelve el valor al inicializarse.

### Hidden

- CA-11: Un `hidden` no produce ningún elemento DOM visible.
- CA-12: Un `hidden` con `value` literal almacena ese valor en `forms.{formId}.{fieldId}.value` al montar el form.
- CA-13: Un `hidden` con `value` referencia dinámica resuelve el valor una vez al inicializarse.
- CA-14: Un `hidden` no bloquea el submit aunque no declare `validations`.
- CA-15: Un `hidden` se incluye en el payload del submit cuando se referencia desde `submitAction`.
- CA-16: Un `hidden` fuera de `form` rechaza el config antes del render.
- CA-17: Un `hidden` sin `props.value` rechaza el config antes del render.
- CA-18: `visibility` y `queryStateFeedback` no aplican a `hidden` (se ignoran si se declaran o se rechazan).

### Pattern

- CA-19: Un campo con `pattern: "^\\d{5}$"` rechaza `"abc"` y acepta `"12345"`.
- CA-20: Un campo con `pattern` vacío (`''`) rechaza el config.
- CA-21: Un campo con `pattern` con regex inválido (ej. `"[invalid"`) rechaza el config.
- CA-22: Un campo vacío con `pattern` no falla la validación (delegado a `required`).
- CA-23: El mensaje por defecto de `pattern` es `"Invalid format."`.

### Email

- CA-24: Un campo con `email: true` rechaza `"noarroba"` y acepta `"user@example.com"`.
- CA-25: Un campo vacío con `email: true` no falla la validación.
- CA-26: El mensaje por defecto de `email` es `"Invalid email address."`.

### URL

- CA-27: Un campo con `url: true` rechaza `"no-es-url"` y acepta `"https://example.com"`.
- CA-28: Un campo con `url: true` rechaza URLs sin protocolo http/https (ej. `"ftp://files.com"`).
- CA-29: Un campo vacío con `url: true` no falla la validación.
- CA-30: El mensaje por defecto de `url` es `"Invalid URL."`.

### Validación condicional

- CA-31: Una regla con `when` cuya condición se cumple se evalúa normalmente y puede fallar.
- CA-32: Una regla con `when` cuya condición no se cumple se omite y no produce error.
- CA-33: Una regla sin `when` se evalúa siempre (retrocompatibilidad).
- CA-34: `when` con referencia fuera del alcance soportado rechaza el config.
- CA-35: `when` con `operator` fuera del catálogo soportado rechaza el config.
- CA-36: `when` con `isTruthy` y `value` declarado rechaza el config.
- CA-37: `when` funciona con las reglas existentes (`required`, `minLength`, `maxLength`, `min`, `max`, `minSelections`,
  `maxSelections`) además de las nuevas.
- CA-38: La reevaluación local del campo tras edición respeta la condición `when` vigente.

## Casos límite

- Un `toggle` dentro de un `repeater` dentro de un `form` debe resolver `defaultValue` con `item.*` si aplica, y
  mantener estado independiente por iteración.
- Un `hidden` dentro de un `repeater` dentro de un `form` debe resolver `props.value` con `item.*` contra la iteración
  actual.
- Un `hidden` con valor referencia dinámica que apunta a una query en `preloads`: se resuelve contra el estado de la
  query en el momento del montaje del form (misma semántica que `defaultValue` de otros campos).
- Si varias reglas de un mismo campo tienen `when` y ninguna condición se cumple, el campo pasa la validación como si no
  tuviera reglas.
- Si una regla tiene `when` que referencia un campo del mismo formulario que todavía no se ha inicializado (lazy), la
  referencia se trata como ausente con la misma semántica que `visibility`.
- `pattern` con regex que contiene `/` no necesita escape especial porque el valor llega como string JSON, no como
  literal regex JavaScript.
- `email` y `url` no aplican a `inputType: number`, `date`, `datetime-local` ni `time`; si se declaran en esos tipos, el
  config se rechaza.
- Un campo `hidden` que declara `visibility` o `queryStateFeedback` en su nodo: el config se rechaza antes del render
  para evitar ambigüedad semántica.

## Riesgos o preguntas abiertas

Ninguno. Todas las decisiones de producto relevantes se han resuelto durante la exploración previa.

## Áreas de producto afectadas

- Catálogo de nodos: dos nodos nuevos (`toggle`, `hidden`).
- Formularios y validación: tres reglas nuevas (`pattern`, `email`, `url`), mecanismo `when` transversal.
- Contrato JSON / config: ampliación de schemas Zod.
- Desarrollo local: `config.json` y JSON Schema del editor Monaco deben reflejar los nuevos nodos y reglas.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/` — dos fichas nuevas (`toggle.md`, `hidden.md`), actualización de `index.md`.
- `ai-workflow/docs/app-features/forms/validation-rules.md` — nuevas reglas y mecanismo `when`.
- `ai-workflow/docs/app-features/forms/lifecycle.md` — inicialización de `hidden`.
- `ai-workflow/docs/app-features/forms/index.md` — actualización del índice.
- `ai-workflow/docs/current-state.md` — última feature relevante del área de formularios.
