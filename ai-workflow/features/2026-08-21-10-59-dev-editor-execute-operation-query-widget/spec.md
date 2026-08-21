# Spec: dev-editor-execute-operation-query-widget

## Objetivo
Hoy, `query` de una acción `executeOperation`/`executeOperations` (en `button.props.action` y en `form.submitAction`, incluidas las entradas de sus listas `onSuccess`/`onError`) no se puede editar visualmente en el editor de desarrollo: el panel de propiedades muestra ese campo como un grupo completamente vacío — sin filas, sin botón "Añadir", sin ningún fallback a JSON crudo. La única forma de tocar `query` en esos puntos es editando el JSON a mano en Monaco. Esta feature corrige ese vacío para que `query` se edite con el mismo editor visual de filas clave/valor que ya usan hoy `headers` y `body` de la misma acción.

## Alcance
- El campo `query` de `executeOperation` y de cada entrada de `executeOperations.operations[]`, en `button.props.action` y en `form.submitAction` (incluidas las ramas anidadas `onSuccess[]`/`onError[]` de `form.submitAction`, donde el mismo contrato de acción se reutiliza), pasa a editarse con el mismo editor visual de pares clave/valor ya usado para `headers` en esos mismos puntos.
- Sincronización en vivo con Monaco y con el mismo pipeline de validación/commit que ya usa el resto del editor visual, sin comportamiento nuevo distinto al que ya tienen `headers`/`body` en esos mismos puntos.

## Fuera de alcance
- `query` de las operaciones del bloque raíz `api` y de las entradas de `preloads` (panel "Api"): ya se edita correctamente hoy con el mismo widget, por un camino de código distinto (editor bespoke, no genérico); no se toca.
- `navigateTo.params`: ya tiene su propio editor visual dedicado (feature previa ya entregada); no se toca.
- `headers`/`body` de `executeOperation`/`executeOperations`: no se amplía su comportamiento, salvo un ajuste puntual encontrado durante la implementación: un `body` sin declarar (`undefined`) no arrancaba realmente en el editor visual con opción de alta ("Añadir"), pese a que este documento ya asumía en FR5 que sí lo hacía. Se corrige ese caso concreto para que `body` sin declarar se comporte igual que `query`/`headers` sin declarar, dejando el resto de su comportamiento intacto.
- `validations` de `input`/`textarea`/`select`/`radioGroup`/`checkboxGroup`: mismo tipo de vacío en el editor visual (el campo tampoco se renderiza), pero en un dominio distinto (reglas de validación de formulario, no parámetros de petición HTTP). Queda fuera para no mezclar dominios; candidato a una feature independiente.
- Ampliar el editor de pares clave/valor para editar visualmente valores anidados (objeto/array) o no-string por fila en `body` o en `navigateTo.params`, en vez de la degradación a solo lectura que ya existe hoy para esos campos. Se asume que, por ahora, los valores de esos campos son simples (string); ampliar el soporte a valores anidados queda para una feature futura.
- Cambios de comportamiento en producción o en el contrato JSON consumido por el runtime: `query` ya es un campo válido y soportado por el runtime hoy; esta feature solo cambia que se pueda editar visualmente en el editor de desarrollo.
- Persistencia a backend: sigue igual que el resto del editor de desarrollo (memoria de sesión + Monaco sincronizado, sin escribir a disco).

## Requisitos funcionales
- FR1: `query` de una acción `executeOperation` (en `button.props.action` o en `form.submitAction`, incluidas sus ramas `onSuccess`/`onError`) se edita desde un editor visual de pares clave/valor, con el mismo aspecto e interacción que el ya usado para `headers` en ese mismo punto.
- FR2: `query` de cada entrada de `executeOperations.operations[]` (mismos puntos de montaje que FR1) se edita con el mismo editor visual, de forma independiente por entrada del array.
- FR3: Añadir, editar o quitar una fila de `query` actualiza el config en memoria y el buffer de Monaco de inmediato, igual que ya ocurre hoy con `headers`/`body` de la misma acción.
- FR4: Un `query` ya existente que incluya algún valor no-string (number o boolean, los únicos tipos adicionales que el runtime admite en `query`) no rompe el editor: esa fila concreta se muestra en modo de solo lectura (editable solo desde Monaco), sin afectar a la edición del resto de filas del mismo `query` — misma degradación por fila que ya existe hoy para `headers`/`body`.
- FR5: Un `query` vacío o sin declarar en una acción `executeOperation`/`executeOperations` existente muestra el mismo estado vacío con opción de alta ("Añadir") que ya muestran hoy `headers`/`body` en ausencia de valor.

## Requisitos no funcionales
- Consistencia visual: el campo corregido usa exactamente el mismo componente y las mismas convenciones visuales (Tailwind, `aria-label`/`role="alert"`) ya vigentes para `headers`/`body`; no se introduce una presentación nueva.
- Toda mutación aplicada desde este campo pasa por el mismo pipeline de validación/commit que ya usa el resto del editor: un cambio inválido se rechaza de forma visible, sin aplicar el cambio parcialmente.
- Exclusivo del editor de desarrollo: sin cambios en el comportamiento de producción ni en el contrato JSON consumido por el runtime.

## Criterios de aceptación
- Dado un botón con acción `executeOperation` y `query` ya declarado como mapa string→string/number/boolean, su panel de propiedades muestra un editor de filas clave/valor (no un grupo vacío ni JSON crudo); añadir, editar o quitar una fila actualiza el config y el Monaco en vivo.
- Dado un `executeOperation` sin `query` declarado, el panel permite dar de alta la primera fila con "Añadir".
- Dado un `query` con algún valor number/boolean, esas filas se muestran editables como texto (mismo criterio ya vigente hoy para `headers`/`body`: solo un valor objeto/array anidado degradaría una fila a solo lectura, algo que `query` no puede recibir por contrato).
- El mismo comportamiento se observa igual dentro de cada entrada de `executeOperations.operations[]`, y dentro de las entradas `onSuccess[]`/`onError[]` de `form.submitAction`.
- El comportamiento de `query` en el panel "Api" (operaciones raíz y `preloads`) no cambia.

## Casos límite
- `query` con clave vacía en alguna fila: mismo comportamiento ya vigente hoy en el resto de usos del widget de pares clave/valor (`headers`/`body`).
- `query` con algún valor no-string (number/boolean) llegado desde Monaco: esa fila se muestra en solo lectura, igual que ya ocurre con un valor no-string en `body`.
- `query` con un valor objeto/array anidado escrito a mano en Monaco (fuera del contrato normal de `query`, pero posible si el config llega así): esa fila se degrada a solo lectura por el mismo criterio ya vigente para `body`, sin romper el resto del editor.

## Riesgos o preguntas abiertas
Ninguna. El comportamiento esperado replica exactamente el ya vigente para `headers`/`body` de la misma acción; no hay decisión de producto pendiente. La causa técnica ya está identificada (el detector genérico de mapas clave/valor del dispatcher no reconoce un `additionalProperties` con `anyOf` de tipos primitivos, solo `additionalProperties: {type:'string'}`), pero la estrategia de corrección es un detalle de implementación sin impacto en el contrato funcional descrito arriba.

## Áreas de producto afectadas
- Editor de desarrollo (`dev-runtime`): panel de propiedades de nodos (`button`, `form`).

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`, sección "Editor clave-valor (`params`, `query`, `headers`, `body`)": el texto ya describe `query` de `executeOperation`/`executeOperations` como cubierto por este widget (documentación adelantada al comportamiento real). Tras esta feature, el comportamiento del código pasa a coincidir con lo ya documentado; verificar que no haga falta ningún cambio de texto.
