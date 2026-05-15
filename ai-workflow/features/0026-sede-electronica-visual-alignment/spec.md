# Spec: Sede electrónica visual alignment

## Objetivo
Definir una referencia visual estable para el runtime a partir de la pantalla de "Solicitud general" de sede electrónica y usarla como contrato para adaptar la UI actual sin reinterpretaciones libres en futuras iteraciones.

La feature debe conseguir dos resultados complementarios:
- convertir la imagen de referencia en un documento de diseño operativo y reutilizable
- alinear todas las pantallas renderizadas por el runtime, independientemente del JSON de origen, con esa referencia institucional desde el bloque de título y descripción hacia abajo

## Alcance
- Crear una especificación visual y funcional de la experiencia de "Solicitud general" basada en la imagen de referencia.
- Establecer un documento de diseño canónico en `ai-workflow/design/` que describa composición, tokens visuales, comportamiento responsive y prioridades de fidelidad.
- Adaptar el shell visible del runtime a una estética institucional clara, sobria y administrativa.
- Adaptar todos los nodos visibles ya soportados por el runtime para que compartan una misma gramática visual cuando se rendericen en cualquier pantalla:
  - contenedores
  - títulos y textos
  - botones
  - inputs, selects, textareas y grupos de opción
  - listas
  - tarjetas y bloques de sección
- Reproducir y generalizar solo la parte relevante de la pantalla de referencia a partir del título y la descripción:
  - título principal
  - texto explicativo
  - formulario principal organizado en bloques comprensibles
  - separaciones visuales consistentes entre secciones cuando existan
  - barra final de acciones
- Definir cómo debe responder esa composición en desktop, tablet y móvil para que la adaptación futura de otros componentes conserve la misma lógica visual.

## Fuera de alcance
- Introducir theming declarativo desde JSON como nueva capacidad general del runtime.
- Implementar un sistema de subida de archivos completo si sigue fuera del catálogo soportado por el runtime.
- Replicar cabecera, barra lateral izquierda, pasos del trámite, bloque lateral de ayuda o tarjeta de confianza de la captura como parte de esta iteración.
- Replicar comportamientos interactivos no soportados hoy por el contrato actual, como acordeones genéricos o colapsables de sección.
- Cambiar el modelo de datos del runtime o ampliar por defecto el catálogo de nodos más allá de lo necesario para materializar el diseño acordado.

## Áreas de producto afectadas
- renderer visible del runtime
- experiencia de formularios
- estructura de página desde el bloque principal de contenido
- documentación de diseño para futuras features visuales

## Requisitos funcionales
1. Debe existir una referencia de diseño canónica basada en la imagen proporcionada, escrita para que otro agente pueda derivar cambios visuales coherentes sin depender de interpretación manual de la imagen.
2. La UI principal del runtime debe abandonar la estética oscura actual y adoptar una presentación clara, institucional y administrativa.
3. La composición de página debe priorizar lectura guiada:
   - título principal
   - texto explicativo
   - formulario dividido en bloques comprensibles
   - cierre con acciones claras
4. El formulario visible debe organizarse en secciones diferenciadas con encabezado propio y separación suficiente entre grupos de campos.
5. Los campos obligatorios deben seguir siendo reconocibles visualmente sin saturar la interfaz.
6. La acción principal debe ser inequívoca y mantenerse visualmente prioritaria frente a acciones secundarias.
7. La experiencia responsive debe conservar el mismo orden lógico de lectura en desktop, tablet y móvil, evitando que la versión compacta pierda contexto o agrupe elementos sin jerarquía.
8. Los componentes actuales soportados por el runtime, incluidos los que no aparecen en la captura, deben recibir un diseño coherente con el lenguaje visual derivado de la referencia.
9. El sistema visual debe exponer tokens globales reutilizables para colores, tipografía, espaciado, radios, bordes, sombras y estados, de forma que futuras variantes visuales puedan cambiarse sin reescribir la estructura de los componentes.
10. La implementación debe hacerse con `Tailwind CSS` siempre que sea posible, usando una capa CSS-first estable para los tokens globales y evitando estilos fuera de la convención del proyecto salvo excepciones ya admitidas.
11. La documentación resultante debe dejar explícitas las partes de la referencia visual que son:
   - obligatorias en la adaptación inicial
   - opcionales o progresivas
   - actualmente limitadas por el contrato del runtime

## Requisitos no funcionales
- La fidelidad visual debe priorizar jerarquía, proporción, espaciado y tono institucional antes que la copia pixel-perfect.
- La interfaz debe mantener contraste suficiente, legibilidad y affordances claros en formularios y acciones.
- La adaptación debe ser reusable: nuevos componentes o pantallas del runtime deben poder apoyarse en el mismo contrato visual sin redefinir estilos desde cero.
- La referencia documental debe minimizar ambigüedad para futuras sesiones o agentes.
- La solución debe respetar el enfoque del proyecto basado en utilidades de `Tailwind CSS`.
- El sistema debe ser tematizable mediante tokens globales estables declarados en CSS, sin convertir esta iteración en una API de theming declarativa desde JSON.

## Criterios de aceptación
- Existe una `spec.md` para la feature y un documento de diseño canónico en `ai-workflow/design/` que traduce la imagen a reglas operativas.
- La experiencia visible del runtime usa una base clara y administrativa, con fondo suave, superficies claras, bordes discretos y un color de acento institucional consistente para la acción principal.
- Todas las pantallas renderizadas por el runtime heredan esa misma base visual a partir del contenido principal y dejan de depender de una estética específica del JSON de ejemplo actual.
- El bloque introductorio, las secciones del formulario y la barra de acciones mantienen una jerarquía reconocible y consistente con la imagen de referencia.
- Los nodos de formulario ya soportados por el runtime comparten estilos coherentes entre sí y dejan de parecer piezas aisladas.
- Los nodos que no aparecen en la captura mantienen una presentación coherente con el mismo sistema visual.
- En desktop, la pantalla conserva una composición amplia y limpia centrada en el contenido principal.
- En tablet y móvil, la composición se reordena sin perder contexto, priorizando primero la información del trámite y después la captura de datos.
- Existe una capa de tokens visuales globales reutilizables que permite tematizar el sistema sin rehacer las clases estructurales de los nodos.
- La documentación deja explícito qué elementos de la imagen son referencia visual obligatoria y qué elementos quedan pendientes por limitaciones funcionales actuales.

## Casos límite
- Si una pantalla del runtime usa solo una parte del catálogo visual, esa parte debe seguir pareciendo perteneciente al mismo sistema.
- Si el runtime todavía no soporta un bloque funcional equivalente a subida de archivos, la planificación posterior deberá decidir entre un placeholder visual explícito o diferir esa parte sin inventar una interacción falsa.
- Si la composición móvil no puede replicar exactamente el colapso de secciones de la imagen en la primera iteración, la adaptación no debe fingir ese comportamiento; debe dejar la diferencia documentada.
- Si un `container` aparece dentro de un `form`, la separación de secciones debe resolverse sin nodos nuevos y sin convertir cada bloque en una tarjeta adicional: basta con una semántica de `section` y un divisor superior a sangre cuando aplique.
- Si una pantalla no incluye formularios, su jerarquía visual debe seguir siendo coherente con el mismo sistema de espaciado, tipografía, superficies y acciones.
- Si una pantalla incluye listas, deben mantenerse con bullets sobrios y consistentes salvo que una futura feature defina otra variante explícita.

## Riesgos o preguntas abiertas
- La imagen incluye una sección de documentación adjunta con interacción de subida y gestión de archivos, pero el estado actual del proyecto indica que la subida de archivos sigue fuera del alcance estable del runtime. Debe decidirse si esta sección entra como placeholder visual, como alcance nuevo o si se difiere.
- La imagen móvil sugiere secciones colapsables. Debe decidirse si ese comportamiento forma parte de la primera implementación o si la primera alineación se limita a layout y styling responsive.
- Debe vigilarse que la tematización por variables no derive en una segunda capa de estilos ajena a Tailwind o en componentes visualmente acoplados a valores hardcoded.

## Documentación probablemente afectada
- `ai-workflow/design/`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
