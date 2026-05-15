# Spec: Expanded container layout controls

## Objetivo
Ampliar la capacidad declarativa de `container` para que pueda resolver más combinaciones de layout sin introducir nodos nuevos ni abrir todavía una API general de estilos desde JSON.

La feature debe permitir que un mismo `container` cubra de forma estable:
- una escala de `gap` más amplia y con default predecible
- distribuciones en columnas de 1 a 12
- alineación declarativa mediante `align-items`
- distribución declarativa mediante `justify-content`
- control declarativo de `wrap`

## Alcance
- Ampliar el contrato visible de `container.props` para soportar una escala cerrada de `gap` con alias `sm`, `md`, `lg`, `xl` y `2xl`.
- Fijar `md` como separación por defecto de `container` cuando no se declare `gap`.
- Añadir una capacidad declarativa para resolver layouts en columnas con un máximo de 12 columnas.
- Añadir una capacidad declarativa para controlar `align-items` y `justify-content` desde el JSON en los contenedores.
- Añadir una capacidad declarativa para controlar `wrap`, con `nowrap` como comportamiento por defecto.
- Mantener la compatibilidad funcional del catálogo actual de nodos, incluidos los `container` usados dentro de `form`.
- Dejar explícito en la documentación estable del runtime qué combinaciones de layout admite ahora `container` y cuáles siguen fuera de alcance.

## Fuera de alcance
- Introducir una API visual genérica para cualquier propiedad CSS.
- Añadir theming declarativo o variantes visuales arbitrarias por nodo.
- Incorporar responsive declarativo por breakpoint dentro del JSON para `container`.
- Crear nodos nuevos de `grid`, `row`, `column` o equivalentes separados de `container`.
- Abrir una semántica de spans por hijo, ordenación visual por hijo o auto-placement avanzado.
- Convertir esta iteración en un sistema completo de layout comparable a un framework de diseño.

## Requisitos funcionales
1. `container` debe seguir siendo el nodo contenedor reutilizable del runtime y continuar aceptando `children` como colección ordenada.
2. `container.props.gap` debe aceptar una escala cerrada de alias `sm`, `md`, `lg`, `xl` y `2xl`.
3. Cuando `container.props.gap` no exista, el comportamiento por defecto debe equivaler a `md`.
4. La ampliación de la escala de `gap` no debe exigir declarar valores CSS arbitrarios para cubrir los casos normales de composición del runtime.
5. `container` debe poder declarar una distribución en columnas con valores enteros de 1 a 12.
6. La distribución por columnas debe ordenar visualmente los hijos en la misma secuencia declarada en el JSON, sin alterar su orden lógico.
7. Cuando un `container` declare columnas, el runtime debe comportarse como un único contenedor de layout con esa rejilla declarativa, sin exigir wrappers adicionales por fila.
8. `container` debe poder declarar alineación de items con una superficie declarativa estable basada en las opciones habituales de `align-items`.
9. `container` debe poder declarar distribución de espacio con una superficie declarativa estable basada en las opciones habituales de `justify-content`.
10. `container` debe poder declarar `wrap` con un catálogo cerrado de opciones, manteniendo `nowrap` como default cuando no se declare esa propiedad.
11. La semántica de `align-items`, `justify-content` y `wrap` debe aplicarse tanto al layout lineal actual como al layout por columnas cuando la combinación declarada sea válida para el modo activo, sin reinterpretaciones ad hoc por tipo de pantalla.
12. Si `container` declara a la vez `direction` y `columns`, `columns` debe prevalecer como modo de layout explícito.
13. Los `container` verticales usados dentro de `form` deben conservar su función actual de sección semántica y divisor visual, pudiendo además beneficiarse de las nuevas opciones de `gap`, columnas, alineación, distribución y `wrap` cuando se declaren.
14. La validación del config debe rechazar valores fuera del catálogo soportado para `gap`, alineación, distribución, `wrap` o número de columnas, con diagnósticos claros sobre la ruta afectada.
15. La validación del config debe seguir admitiendo valores arbitrarios de `gap` como vía de compatibilidad para configuraciones existentes, aunque la escala cerrada pase a ser la recomendación principal.
16. La documentación funcional del runtime y del contrato JSON debe reflejar el nuevo alcance declarativo de `container`, incluidos defaults, precedencias y límites.

## Requisitos no funcionales
- La ampliación debe seguir siendo intencionadamente acotada y basada en un catálogo cerrado de opciones revisables.
- El contrato resultante debe priorizar combinaciones útiles y predecibles frente a flexibilidad CSS irrestricta.
- La feature no debe deteriorar la legibilidad base del runtime ni la coherencia visual ya fijada para formularios y contenido general.
- La semántica de defaults debe reducir fricción para JSONs nuevos, evitando que cada `container` necesite declarar espaciado básico.
- La feature debe dejar una base clara para futuras ampliaciones de layout sin comprometer todavía una API completa de diseño responsivo.
- La compatibilidad con `gap` arbitrario debe mantenerse como excepción controlada y no como vía principal para modelar nuevos layouts del runtime.

## Criterios de aceptación
- Dado un `container` sin `gap`, sus hijos se renderizan con una separación equivalente a `md`.
- Dado un `container` con `gap: sm`, `md`, `lg`, `xl` o `2xl`, el runtime aplica la separación correspondiente sin requerir valores CSS libres.
- Dado un `container` con un número de columnas entre 1 y 12, sus hijos se distribuyen en esa rejilla manteniendo el orden declarado.
- Dado un `container` con `align-items` válido, la alineación visible de sus hijos cambia conforme a la opción declarada.
- Dado un `container` con `justify-content` válido, la distribución visible del espacio cambia conforme a la opción declarada.
- Dado un `container` con `wrap` válido, el comportamiento de salto de línea o no salto cambia conforme a la opción declarada, y cuando no se declara el default es `nowrap`.
- Dado un `container` con `direction` y `columns` a la vez, prevalece `columns` como modo de layout efectivo.
- Dado un `container` dentro de un `form`, la separación visual de sección existente sigue funcionando y puede convivir con las nuevas capacidades de layout.
- Dado un `container` con un `gap` arbitrario compatible, el runtime sigue aceptándolo como excepción de compatibilidad sin exigir migración inmediata a la escala cerrada.
- Dado un config con un alias de `gap`, un valor de alineación, una opción de distribución, una opción de `wrap` o un número de columnas no soportados, el runtime rechaza el config antes del render con un error diagnóstico explícito.
- La documentación estable del proyecto deja claro que `container` ya soporta escala de `gap` ampliada, columnas hasta 12 y controles declarativos de alineación, distribución y `wrap`.

## Casos límite
- Un `container` sin props debe seguir siendo válido y ahora resolver un espaciado por defecto en lugar de quedar sin separación entre hijos.
- Un `container` con `columns: 1` debe seguir siendo válido y no debe introducir un comportamiento divergente respecto a una composición de una sola columna.
- Un `container` con muchos hijos y `columns: 12` debe mantener el orden de lectura y no exigir emparejar manualmente filas en el JSON.
- Un `container` dentro de un `form` puede necesitar varias columnas para agrupar campos, pero no debe perder su semántica actual de sección cuando siga actuando como bloque vertical.
- Un `container` puede declarar a la vez `gap`, columnas, alineación y distribución; la combinación resultante debe ser válida o rechazarse de forma explícita, nunca degradar en silencio a una interpretación ambigua.
- Un `container` puede declarar a la vez `gap`, columnas, alineación, distribución y `wrap`; la combinación resultante debe ser válida o rechazarse de forma explícita, nunca degradar en silencio a una interpretación ambigua.
- Un `container` con `wrap` declarado junto con `columns` no debe abrir una semántica ambigua de doble layout; la planificación debe definir si esa combinación se soporta explícitamente o se rechaza como inválida.
- Los JSON históricos que hoy dependen de `gap` arbitrario deben seguir funcionando sin migración obligatoria inmediata.

## Riesgos o preguntas abiertas
- El vocabulario cerrado de layout debe mantenerse pequeño y coherente para no convertir `container` en una fachada informal de CSS.
- La combinación entre `columns` y `wrap` requiere una decisión explícita de planificación para evitar interpretaciones divergentes entre flex y grid.
- Mantener `gap` arbitrario por compatibilidad añade coste de validación, documentación y tests; conviene tratarlo como excepción heredada y no como camino principal.

## Áreas de producto afectadas
- contrato JSON del runtime
- renderer visible del nodo `container`
- composición de formularios y bloques de contenido
- documentación funcional del catálogo de nodos

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/current-state.md`
