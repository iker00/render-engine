# Spec: Form container alignment

## Objetivo
Corregir la semántica visual especial que hoy aplica el runtime a los `container` dentro de un `form` cuando esa semántica provoca desplazamientos horizontales y una composición menos predecible que la del resto del layout.

La feature debe conseguir que un `container` anidado en un `form` mantenga su papel actual de bloque visual separado dentro del formulario, pero deje de usar sangrado lateral implícito a sangre. El borde separador entre bloques debe conservarse, mientras la alineación horizontal del contenido vuelve a respetar el ancho útil normal del formulario.

## Alcance
- Ajustar el tratamiento visual especial que hoy convierte ciertos `container` dentro de `form` en secciones con separación a sangre.
- Mantener el contrato JSON actual de `container`, `form` y sus props sin introducir nuevas claves obligatorias.
- Mantener dentro de `form` las capacidades actuales de `container` para `direction`, `gap`, `columns`, `align`, `justify` y `wrap`.
- Conservar la separación visual entre bloques de formulario, evitando únicamente el desplazamiento horizontal implícito y cualquier padding horizontal heurístico asociado.
- Actualizar la documentación funcional para reflejar que `container` dentro de `form` sigue aportando separación visual, pero ya no debe desbordar lateralmente el ancho útil del formulario.

## Fuera de alcance
- Introducir un nodo nuevo de `section`, `fieldset` o equivalente para reconstruir secciones visuales de formulario en esta iteración.
- Añadir una API visual declarativa nueva en JSON para controlar bordes, padding, márgenes o variantes de superficie.
- Rediseñar la gramática visual completa de formularios más allá de este ajuste de composición.
- Cambiar la semántica funcional de `form`, su submit, validación, persistencia o estado compartido.
- Reabrir el alcance general de `container` fuera del contexto de formularios.
- Eliminar el borde separador entre bloques cuando ese separador ya forme parte de la gramática visual estable del formulario.

## Requisitos funcionales
1. Un `container` descendiente de un `form` debe seguir renderizándose como parte válida del árbol declarativo del formulario.
2. Un `container` dentro de `form` debe conservar sus props declarativas de layout y seguir pudiendo organizar campos, textos y botones en columna, fila o grid.
3. El runtime no debe añadir por defecto sangrado lateral horizontal a un `container` dentro de `form`.
4. El runtime no debe añadir por defecto márgenes negativos horizontales a un `container` dentro de `form`.
5. Un `container` dentro de `form` debe conservar separación vertical útil entre bloques, pero no debe recibir padding horizontal implícito por heurística de contexto.
6. El runtime debe conservar por defecto el divisor superior específico de sección en los `container` dentro de `form` que hoy ya actúan como bloques visuales del formulario.
7. Un `container` dentro de `form` debe mantener el mismo comportamiento base de `gap`, incluyendo el default vigente cuando no se declara `gap`.
8. Un `container` dentro de `form` que use `columns` debe seguir pudiendo componer campos en varias columnas sin perder automáticamente su separación visual de bloque.
9. Un `container` dentro de `form` que use `direction: row` debe seguir comportándose como layout lineal normal, sin recuperar márgenes negativos laterales por contexto de formulario.
10. La corrección de esa semántica visual no debe cambiar el contrato de validación del config ni exigir migraciones del JSON existente.
11. La documentación funcional del runtime debe dejar explícito que `container` dentro de `form` sigue pudiendo actuar como sección visual separada, pero sin desbordar lateralmente el ancho útil del formulario.

## Requisitos no funcionales
- El resultado visible debe ser más predecible: un mismo `container` no debe cambiar de caja visual solo por estar dentro de un `form`.
- La composición debe evitar desplazamientos horizontales aparentes respecto al ancho útil del formulario y del shell principal.
- La feature debe mantener la v1 acotada y no abrir una API de estilos arbitrarios para resolver este ajuste.
- La documentación debe dejar claro que este cambio corrige una compensación lateral de layout sin eliminar la separación visual entre bloques de formulario.

## Criterios de aceptación
- Dado un `container` dentro de un `form` sin props especiales, el runtime lo renderiza sin margen negativo lateral, manteniendo la separación visual de sección que siga formando parte del bloque.
- Dado un `container` dentro de un `form` sin props especiales, el runtime puede conservar padding vertical útil de sección, pero no añade padding horizontal implícito.
- Dado un `container` dentro de un `form` con `gap` omitido, el espaciado entre hijos sigue usando el default estable de `container`.
- Dado un `container` dentro de un `form` con `columns`, el runtime mantiene la composición en grid y su separación visual de bloque, pero no añade sangrado lateral a sangre.
- Dado un `container` dentro de un `form` con `direction: row`, el runtime mantiene la composición lineal declarada sin márgenes negativos laterales por contexto de formulario.
- Dado un formulario con varios `container`, todos conservan alineación horizontal consistente con el resto del contenido del formulario y del shell visible.
- El mismo JSON de formulario sigue siendo válido tras la feature y no requiere nuevas props para conservar su comportamiento funcional.
- La documentación estable del proyecto deja claro que `container` dentro de `form` conserva su papel de sección visual diferenciada, pero ya no se interpreta como un bloque a sangre.

## Casos límite
- Un `form` puede no contener ningún `container`; ese caso no debe cambiar su comportamiento visible actual.
- Un `form` puede contener `container` anidados solo para agrupar campos o acciones; al desaparecer el sangrado lateral, esos bloques no deben dejar huecos residuales ni estilos implícitos inconsistentes.
- Un `container` dentro de `form` puede declarar `columns: 1`; debe seguir siendo válido y no activar una variante visual distinta por ese solo hecho.
- Un `container` dentro de `form` puede mezclar `columns`, `align`, `justify` y `gap`; la composición declarativa debe seguir funcionando sin reintroducir sangrado lateral implícito.
- Un formulario histórico puede haberse beneficiado visualmente del divisor superior entre bloques; esta feature asume que ese divisor debe mantenerse mientras se elimina solo la compensación lateral que lo llevaba a sangre.

## Riesgos o preguntas abiertas
- Algunos formularios existentes pueden depender visualmente de la relación exacta entre borde, padding y sangrado lateral; la planificación debe concretar cómo conservar la separación percibida sin mantener el desbordamiento horizontal.
- La feature simplifica el comportamiento visible, pero cambia una semántica ya documentada y testada; conviene tratarla como ajuste deliberado de producto y no como refactor invisible.
- Si en el futuro sigue haciendo falta distinguir secciones de formulario, esa necesidad debería abrirse con una capacidad explícita y no volver a depender de heurísticas implícitas por contexto.

## Áreas de producto afectadas
- experiencia visible de formularios
- composición de `container` dentro de `form`
- gramática visual base del runtime

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/current-state.md`
