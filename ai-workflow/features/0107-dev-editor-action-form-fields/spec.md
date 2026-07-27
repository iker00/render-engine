# Spec — Editor de acciones desde el formulario del dev editor

## Objetivo

Permitir configurar completamente `button.props.action`, `link.props.action` y `form.submitAction` desde el panel de
propiedades del editor visual (modo Editor de `DevRuntime`), sin depender del editor Monaco. Hoy estos tres campos caen
siempre al fallback de solo lectura ("Este valor no se puede editar de forma segura desde el formulario. Usa el editor
JSON (Monaco) para modificarlo.") porque el schema del nodo no expone su estructura interna al panel.

## Alcance

- Panel de propiedades del nodo `button`: campo `props.action` editable con selector de tipo y campos específicos por
  variante.
- Panel de propiedades del nodo `link`: campo `props.action` editable con selector de tipo y campos específicos por
  variante, limitado al catálogo cerrado ya vigente (`navigateTo`, `goBack`).
- Panel de propiedades del nodo `form`: campo `submitAction` editable con selector de tipo (`executeOperation`,
  `executeOperations`) y campos específicos, incluyendo las listas `onSuccess` y `onError`.
- Selector de tipo de acción con las 7 variantes soportadas por el runtime (según aplique al nodo): `navigateTo`,
  `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal`, `closeModal`.
- Estado explícito "Sin acción" en el selector para los tres campos (todos opcionales en su nodo), distinto de elegir
  una variante real.
- Campos por variante:
    - `navigateTo`: `pageId` (texto), `params` (editor clave-valor opcional).
    - `goBack`: sin campos adicionales.
    - `executeOperation`: `operationName` (texto), `query` (editor clave-valor opcional), `body` (editor clave-valor con
      excepción a edición JSON libre por clave anidada, ver más abajo), `headers` (editor clave-valor opcional).
    - `executeOperations`: `operations` (lista editable de entradas), cada una con `operationName`, `query`, `body`,
      `headers` (igual que `executeOperation`) y `when` (condición opcional).
    - `resetForm`: `formId` (texto).
    - `openModal`: `modalId` (texto).
    - `closeModal`: `modalId` (texto).
    - `form.submitAction` añade además `onSuccess` y `onError`: listas opcionales de acciones (cualquiera de las 7
      variantes anteriores), cada entrada con `when` opcional.
- El editor clave-valor genérico (usado en `params`, `query`, `headers` y, con la excepción indicada, `body`) permite
  añadir, editar y quitar pares clave-valor de texto libre. Cubre literales, interpolaciones `{{...}}` y referencias
  dinámicas (`queries.x.data`, etc.), que son siempre strings en su forma declarada.
- `body` se edita con el mismo editor clave-valor para el caso plano (payload sin anidamiento). Si el valor actual de
  una clave concreta de `body` ya es un array o un objeto anidado, esa clave en particular cae a edición JSON libre (
  equivalente al fallback actual), sin afectar al resto de claves ni al resto del formulario de la acción.
- `when` (en entradas de `executeOperations.operations` y de `onSuccess`/`onError`) se edita reutilizando el mismo
  editor ya existente para `visibility` (condición simple o grupo compuesto), sin duplicar esa lógica.

## Fuera de alcance

- El editor de `items` de `select`, `radioGroup` y `checkboxGroup` (`props.items`): es una feature separada, ya
  acordada, pendiente de spec propia.
- La validación de `table.props.rows` (filas fijas manuales) contra su schema real: tarea suelta a decidir en planning,
  no forma parte de esta feature salvo que se incluya explícitamente más adelante.
- Un selector con autocompletado de `operationName` contra las operaciones declaradas en `api`, o de `pageId`/`modalId`/
  `formId` contra los catálogos existentes en el config: estos campos se editan como texto libre, igual que el resto de
  referencias string en el panel (convención ya vigente en el editor: "no incluye pickers contextuales para referencias
  string").
- Selector de tipo por valor dentro del editor clave-valor (string/number/boolean explícitos): todos los valores de
  `params`, `query`, `headers` y `body` (caso plano) se editan como texto.
- Deshacer/rehacer de cambios en el selector de tipo de acción.
- Cualquier cambio de comportamiento en tiempo de ejecución del runtime (fuera del editor de desarrollo): esta feature
  solo añade superficie de edición en el dev editor.

## Requisitos funcionales

1. El panel de propiedades de `button`, `link` y `form` debe mostrar un selector de tipo de acción para `props.action` /
   `submitAction`, con las opciones válidas según el catálogo cerrado de cada nodo (7 variantes + "Sin acción" para
   `button`; `navigateTo`/`goBack` + "Sin acción" para `link`; `executeOperation`/`executeOperations` + "Sin acción"
   para `form.submitAction`).
2. Al elegir una variante distinta a la actual, el panel reconstruye el valor con los campos por defecto de la nueva
   variante, descartando los campos de la variante anterior.
3. Al elegir "Sin acción", la propiedad (`props.action` o `submitAction`) queda completamente sin definir.
4. Cada variante muestra únicamente los campos que le corresponden, editables individualmente sin salir del formulario.
5. Los campos de tipo mapa clave-valor (`params`, `query`, `headers`, `body` en su forma plana) permiten añadir, editar
   el nombre de la clave, editar el valor y quitar una entrada.
6. `body` degrada a edición JSON libre solo en las claves cuyo valor actual sea un array o un objeto, conservando el
   editor clave-valor para el resto de claves de ese mismo `body`.
7. `executeOperations.operations` y `onSuccess`/`onError` se editan como listas: añadir crea una nueva entrada con
   valores por defecto de la primera variante disponible; quitar elimina la entrada seleccionada.
8. Cada entrada de `executeOperations.operations`, `onSuccess` y `onError` permite declarar opcionalmente una condición
   `when`, editada con el mismo control que `visibility`.
9. Cualquier cambio realizado desde estos campos se refleja de inmediato en el contenido renderizado y en el buffer de
   Monaco, igual que el resto de campos del panel de propiedades.

## Requisitos no funcionales

- Mantener la convención ya vigente del panel: los campos de referencia string se editan como texto plano, sin pickers
  contextuales.
- No introducir un segundo contrato de UI hardcodeado por tipo de nodo: la resolución de variantes de acción debe
  apoyarse en el schema (patrón ya usado para `visibility` y `layout.span`), no en lógica ad-hoc dispersa por nodo.
- No degradar el rendimiento percibido del panel de propiedades al editar formularios con `executeOperations` de varias
  operaciones.
- Mantener accesibilidad equivalente al resto de controles del panel (labels asociados, botones con `aria-label` donde
  ya sea convención).

## Criterios de aceptación

- Un `button.props.action` de cualquiera de las 7 variantes se puede configurar íntegramente desde el panel, sin abrir
  Monaco, y el resultado serializado coincide con el contrato documentado en `nodes/button.md`.
- Un `link.props.action` limitado a `navigateTo`/`goBack` no ofrece las otras 5 variantes en el selector.
- Un `form.submitAction` de tipo `executeOperation` o `executeOperations`, incluyendo `onSuccess`/`onError` con
  múltiples entradas y `when` por entrada, se puede configurar íntegramente desde el panel.
- Cambiar de variante en el selector limpia los campos de la variante previa y muestra los campos por defecto de la
  nueva variante.
- Elegir "Sin acción" dejar la propiedad `undefined`; un botón dentro de un `form` sin acción vuelve a comportarse como
  submit implícito.
- Un `body` con una clave de valor anidado (objeto o array) muestra esa clave como edición JSON libre y el resto de
  claves como campos de texto normales.
- Guardar una acción configurada desde el panel produce un config que pasa `validateRuntimeConfig` sin diferencias de
  comportamiento respecto al mismo config editado hoy manualmente desde Monaco.

## Casos límite

- `executeOperations.operations` vacío: el schema exige un array no vacío; el editor no debe permitir dejarlo en cero
  entradas (mismo patrón que arrays con `minItems` ya vigente: botón "Quitar" deshabilitado en el mínimo).
- `onSuccess`/`onError` ausentes o con array vacío: válido, no se ejecuta ninguna acción adicional tras el submit.
- Cambiar repetidamente de variante sin guardar cambios reales: cada cambio reconstruye el valor por defecto; no se
  conserva un historial de valores previos por variante.
- `link` con `props.href` ya declarado y el usuario elige una variante de `action` distinta de "Sin acción": ambos
  campos quedarían declarados a la vez; la validación existente (mutuamente excluyentes) rechaza el config al aplicar,
  igual que ya ocurre hoy si se declaran ambos desde Monaco. El panel no impide este estado transitorio mientras se
  edita.
- `executeOperations` con una entrada cuyo `when` se elimina tras haberlo declarado: la entrada vuelve a lanzarse
  siempre (comportamiento ya documentado para "operación sin `when`").
- Body con un array como valor de una clave: cae a edición JSON libre igual que un objeto anidado (misma excepción, no
  distingue array de objeto).

## Riesgos o preguntas abiertas

- Los campos hoy son `z.unknown()` en el schema Zod del nodo; conectarlos a un schema real (discriminated union por
  `type`) es un prerequisito técnico de esta feature. Endurecer esa validación podría rechazar configs de producción ya
  guardados que no encajen exactamente con el contrato documentado. Decidir en `design.md` si esto es aceptable tal cual
  o si hace falta alguna estrategia de compatibilidad.
- El selector de tipo de acción requiere un mecanismo nuevo en el panel/dispatcher para leer las variantes de una unión
  discriminada por `type` y reconstruir el valor por defecto al cambiar de variante; a diseñar en `design.md` (no existe
  hoy, solo la resolución de una rama ya elegida vía `resolveUnionBranch`).
- Etiquetas legibles por variante de acción y para "Sin acción" (textos exactos en español): quedan pendientes de
  definir en diseño/implementación, no bloquean esta spec.
