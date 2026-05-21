# Spec: Inline choice groups

## Objetivo
Permitir que los nodos `radioGroup` y `checkboxGroup` puedan renderizar sus opciones en línea como alternativa opt-in al apilado vertical actual, manteniendo intacta su semántica de selección, validación y submit.

## Alcance
- Añadir una opción declarativa específica para `radioGroup` y `checkboxGroup` que permita mostrar sus opciones en línea dentro del formulario.
- Mantener el layout vertical actual como comportamiento por defecto para no romper configuraciones existentes.
- Aplicar la nueva capacidad tanto a grupos con opciones manuales como a grupos alimentados por `queries.*` o `item.*` donde ya estén soportados.
- Hacer que la presentación en línea siga siendo usable en anchos reducidos, sin exigir que todas las opciones quepan siempre en una sola fila.
- Mantener la misma semántica actual de label de campo, controles nativos, selección, `defaultValue`, validación local, visibilidad y submit.

## Fuera de alcance
- Cambiar el comportamiento visible por defecto de `radioGroup` o `checkboxGroup` en configuraciones existentes.
- Añadir variantes visuales adicionales para las opciones, como tarjetas, chips, botones segmentados o theming declarativo.
- Introducir configuración declarativa de columnas, alineaciones complejas, separación por breakpoint o layout distinto por opción.
- Extender esta capacidad a `select`, `input`, `textarea` u otros nodos del catálogo.
- Alterar la semántica de `items`, de `defaultValue`, de `forms.*` o de validación local ya vigente para estos campos.

## Requisitos funcionales
- `radioGroup` y `checkboxGroup` deben poder declarar una nueva opción de layout para mostrar sus opciones en línea.
- Esa opción debe ser explícita y opt-in; si no se declara, ambos nodos deben conservar el apilado vertical vigente.
- La capacidad debe aplicarse por nodo, de modo que un mismo formulario pueda mezclar grupos en línea y grupos apilados.
- En modo en línea, cada opción debe seguir mostrando su control nativo y su texto asociado como una unidad clara y clicable.
- En modo en línea, el grupo debe poder repartir varias opciones en la misma fila cuando haya espacio suficiente.
- Si no hay espacio horizontal suficiente, el grupo debe degradar de forma usable repartiendo opciones en varias líneas, sin solapamientos ni recortes que rompan la interacción.
- El modo en línea no debe cambiar la semántica de selección:
  - `radioGroup` sigue permitiendo una única selección efectiva
  - `checkboxGroup` sigue permitiendo varias selecciones efectivas
- El modo en línea no debe cambiar la semántica de valor vacío ni de almacenamiento:
  - `radioGroup` sigue usando `''` como vacío
  - `checkboxGroup` sigue usando `[]` como vacío
- La semántica vigente de `defaultValue` debe mantenerse igual en ambas variantes visuales.
- La semántica vigente de catálogos dinámicos también debe mantenerse igual en ambas variantes visuales:
  - las opciones pueden seguir viniendo de colecciones manuales o dinámicas
  - si una selección deja de existir en la colección efectiva, el runtime debe seguir limpiándola con las reglas ya vigentes
- La validación declarativa local debe seguir funcionando igual en modo vertical y en modo en línea, incluyendo `required`, `minSelections` y `maxSelections` donde apliquen.
- Los grupos ocultos por `visibility` o `queryStateFeedback` deben conservar la misma semántica actual independientemente de si estaban configurados en vertical o en línea.
- El submit declarativo del formulario debe seguir exponiendo los mismos valores en `forms.{formId}.{fieldId}` sin transformación adicional por usar el modo en línea.
- La configuración debe seguir validándose antes del render y debe rechazar valores fuera del catálogo soportado para esta nueva opción.

## Requisitos no funcionales
- La feature debe mantenerse dentro del alcance visual acotado del runtime y no abrir una API general de layout para opciones de formulario.
- La terminología debe mantenerse alineada con el resto del proyecto: `radioGroup`, `checkboxGroup`, `items`, `defaultValue`, `forms.*`, `visibility` y `queryStateFeedback`.
- El comportamiento debe seguir siendo consistente entre contrato JSON, renderer visible, estado compartido del formulario y validación local.
- La variante en línea debe seguir siendo compatible con la baseline visual compacta vigente del runtime.
- La nueva capacidad debe poder verificarse con tests de render e integración sin depender de una pantalla React específica.

## Criterios de aceptación
- Dado un `radioGroup` sin la nueva opción declarada, el grupo conserva su render vertical actual.
- Dado un `checkboxGroup` sin la nueva opción declarada, el grupo conserva su render vertical actual.
- Dado un `radioGroup` con la nueva opción activada, sus opciones se muestran en línea cuando el ancho disponible lo permite.
- Dado un `checkboxGroup` con la nueva opción activada, sus opciones se muestran en línea cuando el ancho disponible lo permite.
- Dado un grupo en línea con más opciones de las que caben en una sola fila, el render sigue siendo usable distribuyendo opciones en varias líneas sin perder clicabilidad ni legibilidad.
- Dado un `radioGroup` en línea, seleccionar una opción sigue deseleccionando la anterior y actualizando un único valor en `forms.{formId}.{fieldId}`.
- Dado un `checkboxGroup` en línea, marcar o desmarcar opciones sigue actualizando la colección efectiva de valores en `forms.{formId}.{fieldId}`.
- Dado un `radioGroup` o `checkboxGroup` en línea con `defaultValue` válido, el grupo refleja esa selección inicial igual que en el layout vertical.
- Dado un `checkboxGroup` en línea con validación `required` o `minSelections`, el submit sigue bloqueándose cuando la selección efectiva no cumple la regla.
- Dado un grupo en línea alimentado por `queries.*` o `item.*`, las opciones visibles siguen respondiendo al catálogo efectivo sin cambiar la semántica de selección o limpieza de valores inválidos.
- Dada una configuración que mezcla grupos verticales y en línea dentro del mismo formulario, cada nodo respeta exclusivamente su propia configuración.
- Dada una configuración con un valor no soportado para la nueva opción, el config completo falla antes del render con diagnóstico trazable.

## Casos límite
- Grupo en línea con una sola opción.
- Grupo en línea con labels largos que obligan a ocupar varias líneas.
- Grupo en línea dentro de un `container` con `columns` o con ancho disponible reducido.
- Grupo en línea alimentado por una colección dinámica vacía o todavía no disponible.
- Grupo en línea que pierde alguna opción seleccionada tras cambiar su colección efectiva.
- Formulario que mezcla `radioGroup` vertical, `checkboxGroup` en línea y otros campos compactos de la baseline actual.

## Riesgos o preguntas abiertas
- No quedan dudas funcionales bloqueantes; la decisión de producto es mantener el layout vertical como default y añadir la variante en línea solo bajo configuración explícita.
- Debe vigilarse en implementación que el modo en línea no degrade la legibilidad con labels extensos ni rompa la baseline compacta en móvil.
- La feature sigue siendo de riesgo bajo porque no cambia la semántica de datos ni introduce nuevas fuentes de estado, pero sí requiere coordinar contrato, render y tests visuales básicos.

## Áreas de producto afectadas
- Formularios y validación.
- Contrato de configuración.
- Baseline visual del runtime para campos de selección.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/current-state.md`
