# Spec: Compact institutional density

## Objetivo
Reducir la densidad excesivamente grande de la UI actual del runtime para acercarla a una composición más compacta, limpia y administrativa, alineada con la referencia de la pantalla de "Solicitud general" aportada por el usuario.

La feature debe refinar la baseline visual institucional ya existente sin rediseñarla: menos padding en controles y acciones, títulos más contenidos y espacios verticales más ajustados, manteniendo legibilidad, jerarquía y coherencia responsive.

## Alcance
- Ajustar la densidad visual base del runtime ya soportado para que el resultado general sea más próximo a la referencia.
- Reducir el padding y la altura percibida de:
  - `input`
  - `textarea`
  - `select`
  - `button`
  - secciones de formulario y bloques equivalentes
- Ajustar la escala visual de títulos y textos introductorios para evitar una jerarquía sobredimensionada.
- Reducir parte del espaciado vertical entre:
  - título y descripción
  - secciones de formulario
  - grupos de campos
  - cierre de acciones
- Mantener la gramática institucional ya fijada por la feature `0026`, cambiando la densidad pero no el lenguaje visual base.
- Definir la referencia visual operativa suficiente para que la implementación posterior sepa qué compactar y qué debe conservar.

## Fuera de alcance
- Reabrir la baseline visual institucional creada en `0026` con un rediseño completo de colores, tipografía, bordes o tono general.
- Introducir theming declarativo desde JSON o variantes visuales configurables por nodo.
- Añadir nodos nuevos, nuevas interacciones o cambios en el contrato funcional del runtime.
- Replicar literalmente toda la captura de referencia, incluyendo shell externo, pasos laterales, ayudas, tarjetas adicionales o comportamientos no soportados.
- Convertir la UI en una interfaz ultra densa o agresivamente compacta que perjudique la lectura o el toque en móvil.

## Áreas de producto afectadas
- shell visible del contenido principal
- jerarquía tipográfica del runtime
- experiencia de formularios
- acciones primarias y secundarias
- espaciado vertical entre bloques visibles

## Requisitos funcionales
1. La UI principal del runtime debe verse perceptiblemente más compacta que el estado actual, sin abandonar la referencia institucional ya consolidada.
2. Los títulos principales y de sección deben reducir su presencia visual respecto al estado actual, manteniendo una jerarquía clara entre título de página, títulos de bloque y labels.
3. Los textos introductorios deben acompañar al título sin abrir un bloque excesivamente alto antes del contenido principal.
4. Los controles de formulario (`input`, `textarea`, `select`) deben ocupar menos altura visual que hoy, manteniendo legibilidad del valor, placeholder y label.
5. Los botones deben reducir padding y altura percibida respecto al estado actual, conservando la diferenciación visible entre CTA principal y acción secundaria.
6. Los `container` y secciones dentro de `form` deben mantener su papel de agrupación visual, pero con una separación vertical más contenida que en la baseline actual.
7. El espaciado entre grupos de campos relacionados debe reducirse de forma coherente, evitando tanto el efecto de bloques aislados como el de campos apelmazados.
8. El cierre de acciones de un formulario debe quedar más próximo al último bloque de contenido que en el estado actual, sin perder claridad ni margen táctil.
9. La compactación debe aplicarse de forma coherente también a pantallas del runtime que no reproduzcan exactamente la captura, para que el sistema visual siga pareciendo uno solo.
10. La adaptación responsive debe conservar la misma lógica de compactación en desktop, tablet y móvil, sin crear una versión móvil excesivamente estrecha o difícil de tocar.
11. La feature debe dejar explícito que la referencia buscada es "más parecida a la imagen aportada" en densidad y proporción general, no una copia pixel-perfect.

## Requisitos no funcionales
- La reducción de tamaño debe sentirse deliberada y consistente, no como una suma de pequeños recortes aislados.
- La solución debe mantener contraste, foco visible, affordance clara y legibilidad suficiente en todos los controles.
- La compactación no debe romper la comodidad mínima de interacción en móvil.
- La implementación posterior debe poder resolverse dentro de la convención visual actual del proyecto basada en `Tailwind CSS` y tokens globales.
- La documentación debe dejar claro qué elementos deben compactarse seguro y cuáles solo requieren un ajuste moderado.

## Criterios de aceptación
- Existe una spec cerrada para una feature incremental de compactación visual sobre la baseline institucional actual.
- Existe una guía de diseño de la feature que concreta la dirección visual para títulos, campos, botones y espaciados.
- El bloque introductorio de una página con formulario ocupa menos altura total que en el estado actual.
- Los campos visibles del runtime se renderizan con una altura y padding perceptiblemente más contenidos que en la baseline actual.
- Los botones visibles del runtime se renderizan con una altura y padding perceptiblemente más contenidos que en la baseline actual.
- La separación entre secciones y grupos de campos disminuye de forma visible sin perder la lectura por bloques.
- La jerarquía entre título principal, títulos de sección, labels y texto auxiliar sigue siendo clara tras la compactación.
- La CTA principal sigue destacando frente a acciones secundarias aunque ambas reduzcan tamaño.
- El resultado final se percibe más cercano a la referencia aportada por el usuario que al estado actual, especialmente en densidad vertical y proporción general del formulario.

## Casos límite
- Una pantalla puede no contener formularios; aun así debe beneficiarse del ajuste de jerarquía tipográfica y espaciado general sin romper su composición.
- Un formulario puede usar varias secciones `container`; la compactación no debe eliminar el separador mental entre bloques ni hacer que parezcan un único bloque continuo.
- Un layout con pocos elementos no debe quedar visualmente encogido o pobre; la compactación debe seguir pareciendo intencional.
- Un layout muy cargado no debe resolver la compactación reduciendo tanto el espacio que se pierda legibilidad o facilidad de toque.
- En móvil, la reducción de padding de botones y campos no debe producir controles incómodos o visualmente frágiles.

## Riesgos o preguntas abiertas
- La referencia visual marca una dirección clara, pero no aporta medidas exactas; la implementación deberá validar que la compactación final se perciba suficientemente cercana sin sobrerreducir tamaños.
- Existe riesgo de compactar de forma desigual entre títulos, campos y espacios; la planificación debe asegurar una reducción coordinada y no ajustes aislados por componente.
- La baseline institucional actual se apoya en una gramática común para nodos con y sin formulario; conviene vigilar que la compactación conserve esa coherencia global.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/current-state.md`
