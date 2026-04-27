# Spec: Tailwind runtime styling baseline

## Objetivo
Definir y alinear una convención estable para que la presentación visible del runtime se implemente con `Tailwind CSS`, sustituyendo el uso de estilos inline en los nodos soportados hoy, sin introducir todavía un sistema de theming ni una API visual configurable desde JSON.

## Alcance
- Fijar que los estilos base del runtime deben resolverse con utilidades de `Tailwind CSS`.
- Alinear el renderer visible actual para que `container`, `heading`, `paragraph` y `list` dejen de depender de estilos inline.
- Mantener el mismo contrato funcional del JSON y el mismo catálogo de nodos ya soportado.
- Preservar una presentación mínima y legible para validar jerarquía, estructura y lectura de contenido.
- Reflejar en la documentación estable del proyecto que `Tailwind` es la vía de styling vigente mientras no exista una feature específica de theming.

## Fuera de alcance
- Diseñar o introducir un sistema de theming, tokens globales o variantes visuales configurables.
- Ampliar el contrato JSON con propiedades de estilo, apariencia o personalización visual por nodo.
- Rediseñar el catálogo visual actual o introducir nuevos tipos de nodo.
- Cambiar navegación, formularios, queries, validación de configuración o integración con backend.
- Convertir esta feature en una definición completa de design system.

## Requisitos funcionales
- El runtime debe seguir renderizando la página resuelta por `initialPage` con el mismo comportamiento funcional actual.
- Los nodos `container`, `heading`, `paragraph` y `list` deben seguir mostrando el mismo contenido y respetando la misma estructura declarativa ya soportada.
- La implementación visual de esos nodos debe expresarse con clases y utilidades de `Tailwind CSS`, en lugar de estilos inline como mecanismo principal.
- La ausencia de theming no debe bloquear una base visual consistente y suficientemente legible para la v1.
- Las capacidades ya soportadas por `container.props`, como `direction` y `gap`, deben seguir funcionando tras el cambio de criterio visual.
- La conversión a `Tailwind` no debe introducir nuevas capacidades visuales configurables desde JSON que no existan hoy.
- La documentación del proyecto debe dejar explícito que el styling del runtime usa `Tailwind` por convención y que el theming sigue pendiente de definición.

## Requisitos no funcionales
- La feature debe mantener el alcance deliberadamente pequeño: alinear el mecanismo de styling, no abrir una capa de diseño completa.
- El resultado debe seguir siendo fácil de extender en iteraciones futuras hacia theming, pero sin anticipar ahora una arquitectura de theme no validada.
- La convención resultante debe reducir ambigüedad para futuras implementaciones del runtime y evitar mezclar varias estrategias visuales equivalentes.
- La salida visible no tiene que ser pixel-perfect ni definitiva, pero sí estable y suficientemente clara para tests y desarrollo local.
- La documentación estable debe reflejar con honestidad cualquier diferencia temporal entre la convención acordada y la implementación vigente.

## Criterios de aceptación
- Dado el runtime actual con una configuración válida, la UI visible sigue mostrando el mismo contenido funcional después de sustituir estilos inline por utilidades de `Tailwind`.
- Dado un `container` con `direction` y `gap`, la disposición visible sigue respetando esas propiedades sin depender de estilos inline.
- Dado un `heading`, `paragraph` o `list` válidos, su legibilidad y jerarquía visual básica se mantienen sin introducir una API nueva de estilos en el JSON.
- La documentación global del proyecto indica de forma explícita que `Tailwind CSS` es el mecanismo de styling vigente del runtime mientras no exista theming.
- La documentación funcional del runtime indica de forma explícita que esta feature no define todavía tokens, temas ni personalización visual declarativa.
- No existe dentro del alcance una nueva convención paralela que mezcle de forma equivalente estilos inline y `Tailwind` para los mismos componentes del runtime.

## Casos límite
- Un `container` usa un valor de `gap` soportado hoy por alias y la conversión a `Tailwind` debe preservar el resultado visible esperado.
- Un `container` usa un valor de `gap` no alineado con escalas predefinidas y la planificación debe decidir cómo mantener compatibilidad sin reabrir el alcance hacia theming.
- El shell de aplicación ya usa `Tailwind`, pero los nodos del runtime todavía no; la documentación debe distinguir entre estado vigente y dirección objetivo.
- La migración a `Tailwind` puede mantener pequeñas diferencias visuales no funcionales siempre que no rompan la jerarquía, la legibilidad ni el contrato del renderer.

## Riesgos o preguntas abiertas
- Sigue abierta la decisión de cómo resolver valores de `gap` arbitrarios que hoy aceptan cualquier valor CSS sin mantener estilos inline como vía de escape.
- Hay que decidir en planificación si conviene normalizar algunos valores visuales mínimos para que la migración a `Tailwind` no genere utilidades dinámicas difíciles de mantener.
- La feature alinea una convención transversal; si no se revisa bien el alcance, podría deslizarse hacia una discusión prematura de theming o design system.

## Áreas de producto afectadas
- Runtime UI configurable
- Convenciones de implementación frontend
- Presentación base del catálogo inicial de nodos
- Documentación estable del flujo de desarrollo

## Documentación probablemente afectada
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/conventions.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
