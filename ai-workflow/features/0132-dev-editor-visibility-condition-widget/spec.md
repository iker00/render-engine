# Spec — 0132 dev-editor-visibility-condition-widget

## Objetivo
Crear un widget reutilizable de edición para la forma "condición/grupo" que ya usa `visibility` en el editor
visual (dev mode) — hoy renderizada por el dispatcher genérico del panel de propiedades sin selector explícito,
sin ocultación de campos irrelevantes por operador y sin edición real de `value` salvo cuando ya es un string —
para que el usuario pueda: declarar un grupo de N condiciones combinadas con `and`/`or` desde un control
explícito, y editar cada condición viendo solo los campos que aplican a su `operator`, incluido un editor
correcto para `value` (hoy roto para número/booleano/null) y para `itemField` (visible solo con `arrayContains`).

## Alcance
- Nuevo componente compartido para la forma condición/grupo de `visibility` (ver
  [[../../docs/app-features/references/visibility.md]]), que sustituye al editor genérico actual en los tres
  sitios que ya reutilizan esa forma:
  - `node.visibility` en el panel de propiedades de `Layout`.
  - `when` de `executeOperations.operations` y de `onSuccess`/`onError` (`button.props.action`,
    `link.props.action`, `form.submitAction`).
  - `visibility` de `menuItem`/`menuItemChild` (`shell.header.menu`) y de `sidebarItem`
    (`shell.sidebar.items`, a cualquier profundidad) en el panel `Shell`.
- Selector explícito de forma con dos opciones: "Condición simple" y "Grupo (y/o)", sustituyendo la detección
  silenciosa por forma del valor actual (`resolveUnionBranch`) que usa hoy el dispatcher para esta unión.
- Cambiar de forma conserva datos en ambos sentidos: pasar a "Grupo (y/o)" siembra el grupo con la condición ya
  rellenada como primera fila; pasar a "Condición simple" desde un grupo toma la primera condición del grupo
  como la nueva condición simple (el resto de filas del grupo, si había más de una, se descarta).
- Dentro de "Grupo (y/o)": selector del operador del grupo (`and`/`or`) como control de dos segmentos, y lista
  de N condiciones simples con controles "Añadir"/"Quitar" por fila; "Quitar" queda bloqueado mientras solo
  quede 1 condición (un grupo no puede quedar vacío, regla ya vigente del validador de runtime).
- Dentro de cada fila de condición (tanto la condición simple top-level como cada fila de un grupo), los campos
  se muestran u ocultan según el `operator` seleccionado en esa misma fila:
  - `itemField` visible únicamente con `operator: "arrayContains"`.
  - `value` visible únicamente con `operator` en `equals | notEquals | greaterThan | lessThan | arrayContains`;
    oculto con `isTruthy`/`isFalsy`.
  - `reference` y `negate` se muestran siempre, sin condicionar por `operator`.
- Editor de `value` propiamente dicho, corrigiendo el comportamiento actual (hoy cae al fallback genérico de
  solo-lectura salvo que el valor ya sea un string):
  - Con `operator` en `equals | notEquals | arrayContains`: selector explícito de tipo con cuatro opciones
    (Texto, Número, Booleano, Null); el control de valor mostrado debajo cambia según el tipo elegido (input de
    texto, input numérico, control booleano de dos estados, o ningún campo adicional para Null).
  - Con `operator` en `greaterThan | lessThan`: `value` se edita directamente como input numérico simple, sin
    selector de tipo (el operador ya exige numérico).
- Al cambiar el `operator` de una fila de forma que el `value` u `itemField` actuales dejen de ser válidos para
  el nuevo operador, se reconstruyen a un estado por defecto válido para el nuevo operador (ver Requisitos
  funcionales, "Reconstrucción al cambiar de operador"), en vez de conservar un valor que el validador
  rechazaría.

## Fuera de alcance
- Cambios al contrato JSON de `visibility`/`when`, a su validador de runtime o a sus reglas funcionales
  (operadores soportados, referencias admitidas, precedencia con `queryStateFeedback`, semántica de
  `arrayContains`/`negate`/composición booleana) — ver [[../../docs/app-features/references/visibility.md]]. Esta
  feature es exclusivamente la capa de edición visual del dev editor.
- Anidamiento de grupos dentro de grupos — sigue sin estar soportado por el contrato, el widget no lo ofrece.
- Picker contextual o autocompletado para el campo `reference` (sigue como texto libre, igual que el resto de
  referencias string del panel).
- Cambios en cómo se resuelve `visibility` en producción o en modo Visual del editor.
- Deshacer/rehacer — sigue sin existir en el editor visual.
- Cualquier campo o superficie que no reutilice hoy esta misma forma condición/grupo (por ejemplo,
  `queryStateFeedback`, que tiene su propio contrato y su propio editor, no se toca).

## Requisitos funcionales

### Selector de forma (condición simple / grupo)
- Dos opciones explícitas: "Condición simple" y "Grupo (y/o)", visibles siempre que se edita un valor de esta
  forma, con independencia de dónde se use (`visibility`, `when`, menú/sidebar).
- La opción activa se determina por la forma del valor actual al montar el widget (una condición simple si el
  valor tiene forma de condición; un grupo si tiene forma de grupo), igual que ya se infiere hoy, pero ahora con
  un control visible que además permite cambiarla explícitamente.
- Pasar de "Condición simple" a "Grupo (y/o)" construye un grupo con `operator: "and"` por defecto y
  `conditions: [<condición actual>]` como única fila inicial.
- Pasar de "Grupo (y/o)" a "Condición simple" toma la primera condición de `conditions` tal cual y la aplica
  como el nuevo valor (forma de condición simple), descartando el resto de condiciones del grupo si había más
  de una.

### Grupo (y/o)
- Control de dos segmentos para `operator` (`and`/`or`) del grupo, reutilizando el widget de alternancia por
  segmentos ya existente en el editor (`SegmentedTogglePropertyField`).
- Lista de filas, una por condición de `conditions`, cada una renderizada con el mismo editor de condición
  simple descrito abajo.
- Botón "Añadir" al final de la lista, que agrega una nueva condición con valores por defecto mínimos válidos
  (mismo criterio ya usado en el resto del panel para arrays de objetos: un valor por cada propiedad requerida).
- Botón "Quitar" por fila, deshabilitado mientras `conditions` tenga longitud 1 (un grupo no puede quedar vacío;
  el validador de runtime ya rechaza `conditions: []`).
- Sin límite superior de N; el widget no impone ningún máximo de condiciones por grupo.

### Editor de condición (simple o fila de grupo)
- Campos `reference` (texto) y `negate` (booleano) siempre visibles, sin condicionar por `operator`.
- Selector de `operator` con el catálogo completo soportado (`equals | notEquals | isTruthy | isFalsy |
  greaterThan | lessThan | arrayContains`).
- `itemField` (texto) visible únicamente cuando `operator === "arrayContains"`.
- `value` visible únicamente cuando `operator` está en `equals | notEquals | greaterThan | lessThan |
  arrayContains`; ausente del formulario con `isTruthy`/`isFalsy`.

### Editor de `value`
- Con `operator` en `equals | notEquals | arrayContains`: selector explícito de tipo (Texto / Número / Booleano
  / Null); el tipo activo se detecta a partir del tipo JS del valor actual (string → Texto, number → Número,
  boolean → Booleano, null → Null; un valor ausente arranca en Texto vacío por defecto). Cambiar de tipo
  reconstruye `value` con un valor por defecto de ese tipo (`''`, `0`, `false`, o `null` respectivamente) — no
  intenta convertir el valor anterior entre tipos.
  - Tipo Texto: input de texto libre.
  - Tipo Número: input numérico.
  - Tipo Booleano: control de dos estados (true/false).
  - Tipo Null: sin campo adicional; el valor es `null`.
- Con `operator` en `greaterThan | lessThan`: `value` se edita como input numérico simple, sin selector de tipo.

### Reconstrucción al cambiar de operador
- Cambiar `operator` a `isTruthy`/`isFalsy`: se elimina `value` de la condición (queda ausente, no `undefined`
  explícito ni ningún otro valor), ya que el validador rechaza `value` presente con estos operadores.
- Cambiar `operator` desde uno que no sea `arrayContains` a `arrayContains`: `value` se reconstruye como texto
  vacío (`''`) si no había uno ya válido; `itemField` permanece ausente hasta que el usuario lo rellene (sigue
  siendo opcional también con `arrayContains`).
- Cambiar `operator` desde `arrayContains` a cualquier otro: `itemField`, si estaba declarado, se elimina de la
  condición (el validador rechaza `itemField` presente con un `operator` distinto de `arrayContains`).
- Cambiar `operator` a `greaterThan`/`lessThan` con un `value` que no sea ya numérico: `value` se reconstruye a
  `0`.
- Cambiar `operator` entre `equals`/`notEquals`/`arrayContains` entre sí conserva `value` tal cual (los tres
  admiten los mismos cuatro tipos, sin necesidad de reconstruir).

### Integración en los tres sitios de uso
- `node.visibility` en el panel de propiedades de `Layout`: sustituye la resolución actual vía
  `resolveUnionBranch` + editor genérico.
- `when` de `executeOperations.operations`, `onSuccess`/`onError`: mismo widget, mismo comportamiento, sin
  editor duplicado.
- `visibility` de `menuItem`/`menuItemChild` y `sidebarItem` en el panel `Shell`: mismo widget, integrado en
  `MenuItemFieldsEditor`/`SidebarItemFieldsEditor` con el mismo pipeline de commit ya vigente en esos paneles.

## Requisitos no funcionales
- Componente único reutilizado entre las tres superficies de integración, sin duplicar lógica de selector de
  forma, edición de condición o edición de `value` entre integraciones.
- Cada commit (cambio de forma, de operador, de tipo de `value`, de contenido de cualquier campo, alta/baja de
  condición) sigue el mismo pipeline de validación ya vigente (`validateRuntimeConfig`) y el mismo patrón de
  aviso `role="alert"` ante un commit rechazado, sin relajar el gate de validación existente.
- Sin cambios en el contrato JSON de `visibility`/`when` ni en su validación de runtime.
- Sin cambios de comportamiento observable en producción ni en modo Visual del editor.
- Controles operables por teclado con semántica accesible coherente con el resto del panel (selectores de forma
  y de tipo con semántica de grupo de opciones, mismo criterio que los widgets de alternancia ya existentes).
- Mantener el umbral mínimo global de cobertura de tests del 80% sobre `src/`.

## Criterios de aceptación
1. Seleccionar un nodo con `visibility` ya declarada como condición simple muestra el selector de forma en
   "Condición simple" y los campos de esa condición, con `itemField`/`value` visibles u ocultos según su
   `operator` actual.
2. Seleccionar un nodo con `visibility` ya declarada como grupo `and`/`or` muestra el selector de forma en
   "Grupo (y/o)", el operador correcto en el toggle, y una fila por cada condición de `conditions`.
3. Cambiar de "Condición simple" a "Grupo (y/o)" produce un grupo `and` de una sola fila con los mismos
   `reference`/`operator`/`value`/`itemField`/`negate` que tenía la condición simple.
4. Cambiar de "Grupo (y/o)" a "Condición simple" aplica la primera condición del grupo como el nuevo valor,
   descartando el resto de filas si había más de una.
5. En un grupo con una única condición, el botón "Quitar" de esa fila está deshabilitado; con 2 o más
   condiciones, "Quitar" está habilitado en todas las filas.
6. Pulsar "Añadir" en un grupo agrega una fila nueva con valores por defecto mínimamente válidos.
7. En una fila con `operator: "arrayContains"`, `itemField` es visible y editable; con cualquier otro
   `operator`, `itemField` no se muestra.
8. En una fila con `operator` en `isTruthy`/`isFalsy`, `value` no se muestra; con cualquier otro `operator`,
   `value` es visible.
9. Con `operator` en `equals`/`notEquals`/`arrayContains`, el editor de `value` muestra el selector de 4 tipos;
   elegir cada tipo muestra el control correspondiente (texto, número, booleano de dos estados, o ningún campo
   para Null) y el commit resultante fija `value` con el tipo JS correcto (string/number/boolean/null).
10. Con `operator` en `greaterThan`/`lessThan`, el editor de `value` es un input numérico simple sin selector de
    tipo.
11. Cambiar `operator` de una fila con `value`/`itemField` ya no compatibles con el nuevo operador reconstruye
    esos campos según las reglas de "Reconstrucción al cambiar de operador" (value ausente en
    isTruthy/isFalsy, value 0 en greaterThan/lessThan si no era numérico, itemField eliminado al salir de
    arrayContains), y el commit resultante pasa la validación de runtime.
12. El widget se usa de forma idéntica (mismo comportamiento de forma/operador/N condiciones/campos
    condicionales/tipo de value) en `node.visibility` (Layout), en `when` de acciones (executeOperations,
    onSuccess/onError) y en `visibility` de `menuItem`/`sidebarItem` (Shell).
13. Un commit rechazado por validación en cualquier campo de este widget conserva el valor introducido y
    muestra el aviso `role="alert"` ya documentado, sin modificar el config aplicado.
14. No hay cambio de comportamiento observable en producción ni en modo Visual: la evaluación de `visibility`
    (simple o grupo, cualquier operador, `itemField`, `negate`) sigue exactamente igual que antes de esta
    feature.

## Casos límite
- `visibility` no declarada (campo opcional ausente): el widget arranca sin selección de forma forzada, con el
  mismo criterio ya usado hoy para campos opcionales de la unión (el panel debe permitir empezar a declararla
  desde cero, sea como condición simple o como grupo).
- Condición con `value` ya presente pero de un tipo que ya no es válido para su `operator` actual (por ejemplo,
  un config editado a mano en Monaco con `operator: "isTruthy"` y `value` igualmente presente, técnicamente
  inválido pero cargado en el panel): el editor de condición no debe romperse al montar; se comporta según las
  reglas de visibilidad condicional de campos ya fijadas (con `isTruthy`, `value` no se muestra, quedando listo
  para que el siguiente commit válido lo elimine).
- Grupo con una condición cuyo `value` no es reconocible por el selector de 4 tipos (por ejemplo, un objeto o
  array cargado a mano desde Monaco, fuera del contrato pero técnicamente presente en memoria antes de un
  commit): se trata como "Texto" con el valor sin representar de forma fiel, mismo criterio de degradación
  silenciosa ya usado en otros campos del panel ante datos fuera de contrato, sin bloquear el resto del panel.
- Cambiar de nodo seleccionado, o de sub-vista Header/Sidebar en `Shell`, con un aviso de commit rechazado
  pendiente en este widget: el aviso se descarta, igual que el resto de campos del panel.
- `when` de una entrada de `executeOperations.operations`/`onSuccess`/`onError` sin declarar (campo opcional
  ausente): mismo comportamiento que `visibility` no declarada.

## Riesgos o preguntas abiertas
- El mecanismo técnico exacto para enganchar este widget en los tres sitios de uso (extender el hook `x-widget`
  del dispatcher de `Layout`, sustituir `resolveUnionBranch` para este caso concreto, o una combinación con
  integración directa en `MenuItemFieldsEditor`/`SidebarItemFieldsEditor` igual que ya ocurre con el widget de
  iconos) implica más de una estrategia razonable con distintas implicaciones de mantenimiento — se resuelve en
  `generate-feature-design` antes de planificar.
- Las etiquetas exactas de UI (texto de las opciones del selector de forma, de los 4 tipos de `value`, orden de
  los tipos en el selector) son detalle de implementación, no bloquean esta spec.
