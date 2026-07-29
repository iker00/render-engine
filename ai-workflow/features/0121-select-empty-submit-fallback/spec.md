# Spec: valor de sustitución en submit para `select` vacío

## Objetivo

Permitir que un `select` de selección simple envíe un valor literal configurado en vez del string vacío (`""`) cuando se
construye el payload de submit y el campo no tiene ninguna opción seleccionada.

Esto resuelve un caso real: un `select` opcional con `items` dinámicos (cargados desde un endpoint) que, al quedar sin
selección, envía `""` a una API consumidora que exige un valor tipo integer-compatible incluso para ese campo opcional.
El equipo no controla esa API a corto plazo, así que este apaño vive en el runtime de formularios.

## Alcance

- Nuevo prop opcional `props.emptySubmitValue` en el nodo `select`, exclusivamente para selección simple (`props.multiple`
  ausente o `false`).
- El prop es literal (no referencia dinámica) y escalar (`string | number`), siguiendo la misma familia de tipos que
  `props.items`/`props.defaultValue` para selección simple.
- El valor de este prop **no necesita coincidir** con ninguna opción existente en `props.items` (manual o dinámica). A
  diferencia de `defaultValue`, no se valida contra la colección resuelta.
- La sustitución ocurre únicamente al construir el payload de submit (`api.body`, `api.query`, `api.headers`, y los
  canales equivalentes de `submitAction.body`/`submitAction.query`/`submitAction.headers`), y solo quando el valor
  efectivo del campo es `""` en el momento del submit.
- El valor de sustitución se normaliza a string en el payload final, siguiendo la misma normalización que ya aplica hoy
  a cualquier valor de `select` al enviarse.
- Si el campo tiene una selección real (valor efectivo distinto de `""`), el comportamiento de submit no cambia.
- Si el prop no está declarado, el comportamiento de submit no cambia respecto al actual (se envía `""`).

## Fuera de alcance

- `select.props.multiple` (selección múltiple, valor vacío `[]`).
- `radioGroup`, `checkboxGroup`, `input`, `textarea` u otros nodos de formulario.
- Cambios en la semántica o validación de `props.defaultValue`.
- Cualquier mecanismo genérico de coerción de tipos (string → integer real en JSON) en el sistema de referencias.
- Cualquier cambio en `visibility`, `queryStateFeedback` o en otras referencias `forms.{formId}.{fieldId}` fuera del
  payload de submit (por ejemplo, otro campo cuyo `defaultValue` dinámico apunte a este campo sigue viendo `""` cuando
  el campo está vacío).
- Cambios en el estado almacenado en store del campo: el store sigue guardando `""` cuando no hay selección; la UI sigue
  mostrando el placeholder/estado vacío.
- Reset de formulario: no se ve afectado, ya que `resetForm` restaura el `defaultValue` efectivo, no el valor de
  sustitución de submit.
  
## Requisitos funcionales

1. `select` de selección simple admite un nuevo prop opcional `props.emptySubmitValue`, literal y escalar
   (`string | number`), que representa el valor a enviar en el payload de submit cuando el campo está vacío.
2. En el momento de construir el payload de submit, si el valor efectivo del campo es `""`, cualquier referencia
   `forms.{formId}.{fieldId}` usada en `api.body`/`api.query`/`api.headers` o en los canales equivalentes de
   `submitAction` resuelve al valor de sustitución configurado en vez de `""`.
3. El valor de sustitución se normaliza a string antes de entrar en el payload, igual que cualquier otro valor efectivo
   de `select`.
4. Si el campo tiene un valor efectivo distinto de `""` en el momento del submit, el prop no tiene ningún efecto: se
   envía el valor seleccionado real.
5. Si el prop no está declarado, el comportamiento de submit es exactamente el actual: se envía `""` cuando el campo
   está vacío.
6. `emptySubmitValue` no participa en la validación `required`: un campo vacío con este prop configurado sigue
   considerándose inválido si `props.validations.required` está activo (la sustitución solo afecta al wire format del
   submit, no a la validación local).
7. `emptySubmitValue` no participa en `visibility`, `queryStateFeedback` ni en referencias `defaultValue` de otros
   campos: esas superficies siguen viendo el valor efectivo real (`""`) del campo mientras esté vacío.
8. `emptySubmitValue` no necesita coincidir con ningún `value` de `props.items` (manual o dinámico); es válido declarar
   un valor de sustitución que nunca aparece entre las opciones cargadas.

## Requisitos no funcionales

- El cambio debe quedar acotado a la construcción del payload de submit del nodo `select`; no debe introducir un
  mecanismo genérico de coerción reutilizable por otras superficies de referencias.
- El prop debe validarse en bootstrap con las mismas restricciones de tipo que un `defaultValue` literal de selección
  simple (escalar, no array), rechazando el config completo si se declara con un shape inválido (por ejemplo, en un
  `select.props.multiple: true`).
- Debe mantenerse cobertura de test que documente explícitamente que el store y la UI no cambian (siguen en `""`
  /placeholder) aunque el submit envíe el valor de sustitución.

## Criterios de aceptación

- Dado un `select` de selección simple sin selección y con `emptySubmitValue` configurado, al hacer submit el payload
  contiene el valor de sustitución (normalizado a string) en vez de `""`.
- Dado un `select` de selección simple sin selección y **sin** `emptySubmitValue` configurado, al hacer submit el
  payload sigue conteniendo `""` (sin regresión).
- Dado un `select` de selección simple con una opción realmente seleccionada, al hacer submit el payload contiene el
  valor seleccionado, sin importar si `emptySubmitValue` está declarado.
- Dado un `select` con `emptySubmitValue` configurado a un valor que no existe en `props.items`, el bootstrap no
  rechaza el config y el submit sigue sustituyendo correctamente cuando el campo está vacío.
- Dado un `select` con `props.validations.required: true` y `emptySubmitValue` configurado, el campo vacío sigue
  bloqueando el submit por validación local (el prop no elude `required`).
- Dado un `select.props.multiple: true` con `emptySubmitValue` declarado, el config completo se rechaza en bootstrap.
- Dado otro campo del formulario cuyo `defaultValue` dinámico referencia `forms.{formId}.{fieldId}` de este `select`
  mientras está vacío, ese otro campo sigue resolviendo `""` (no ve el valor de sustitución).

## Casos límite

- El valor de sustitución es `0`: debe enviarse como `"0"` (string), no omitirse ni tratarse como falsy.
- El valor de sustitución es un string vacío (`""`) declarado explícitamente: equivale a no declarar el prop; el
  comportamiento observable es idéntico al caso sin prop.
- El campo está oculto por `visibility` en el momento del submit: sigue aplicando la regla ya existente de omitir del
  payload cualquier clave que referencie un campo oculto, con independencia de que tenga valor de sustitución
  configurado. La sustitución nunca reintroduce una clave que ya se omite por estar oculta.
- El campo pasa de tener una selección real a quedar vacío (por ejemplo, la opción seleccionada desaparece de la
  colección dinámica) antes del submit: en ese momento el valor efectivo es `""` y aplica la sustitución con normalidad,
  igual que si nunca se hubiera seleccionado nada.

## Riesgos o preguntas abiertas

- Ninguna pregunta bloqueante pendiente: el alcance, el punto de aplicación (solo submit), los límites (solo selección
  simple) y el nombre del prop (`emptySubmitValue`) quedaron cerrados en la conversación de exploración previa y en la
  confirmación posterior del usuario.
