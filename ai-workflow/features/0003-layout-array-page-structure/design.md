# Design: Feature 0003 - layout-array-page-structure

## Contexto
La feature `0002` cerró un contrato en el que cada página tiene un único nodo raíz en `layout` y el renderer consume ese árbol validado directamente. La feature `0003` cambia ese contrato raíz: una página pasa a exponer `layout` como colección ordenada de elementos hermanos y deja de requerir un `container` artificial para envolver contenido simple.

El riesgo no está en añadir nuevos nodos visuales, sino en migrar una frontera ya estable entre validación, tipos, fixtures y renderer. Sin decisiones explícitas, distintos agentes podrían implementar resultados incompatibles, por ejemplo aceptando temporalmente dos shapes de `layout`, introduciendo un wrapper sintético en tiempo de render o redefiniendo de forma distinta la composición anidada.

## Objetivos / No objetivos

### Objetivos
- Migrar `pages[].layout` desde un nodo único a una colección ordenada de elementos declarativos.
- Mantener `pages` e `initialPage` como contrato de navegación actual.
- Preservar la anidación interna de los elementos compositivos ya soportados.
- Hacer explícito el comportamiento ante `layout` vacío, shape raíz antiguo y elementos inválidos.
- Dejar el contrato listo para futuras features que introduzcan formularios sin volver a romper la raíz de página.

### No objetivos
- Introducir en esta feature un nodo `form` funcional ni estado de formularios.
- Ampliar el catálogo visual más allá de `container`, `heading`, `paragraph` y `list`.
- Mantener compatibilidad estable con el shape antiguo `layout` como objeto raíz.
- Diseñar todavía reglas completas de composición interna de futuros formularios.
- Introducir navegación, queries, referencias dinámicas o theming nuevo.

## Decisiones
- La migración será estricta desde el primer cambio estable de la feature: `layout` solo se aceptará como array. No habrá modo transitorio que acepte simultáneamente páginas antiguas con `layout` objeto y páginas nuevas con `layout` array dentro de la misma versión funcional.
- El runtime separará validación de colección y validación de elemento. `pages[].layout` y cualquier `children` soportado por nodos compositivos usarán una colección ordenada del mismo tipo base de elemento declarativo.
- `layout: []` será válido. También será válido que un `container` tenga `children: []` o que omita `children`.
- El catálogo soportado por esta feature sigue siendo el actual: `container`, `heading`, `paragraph` y `list`. La referencia de la spec a formularios se resuelve aquí como requisito de compatibilidad futura del contrato raíz, no como soporte funcional inmediato de un nuevo tipo de nodo.
- La composición estructural seguirá usando `children` como colección explícita y ordenada para los nodos que hoy admiten anidación. Esta feature no introduce una propiedad hija especializada para formularios ni adelanta su shape interno.
- El renderer de página no sintetizará un `container` de layout para envolver los elementos raíz. Puede existir un contenedor semántico de página (`section`) fuera del contrato de layout, pero no un nodo visual inventado con semántica de `container` solo para adaptarse al contrato anterior.
- Los errores del shape antiguo o de elementos inválidos seguirán clasificándose como errores de configuración explícitos, manteniendo diagnóstico visible en desarrollo y degradación controlada en producción según el comportamiento ya establecido.

## Riesgos y trade-offs
- Eliminar compatibilidad dual simplifica el contrato y evita ambigüedad, pero obliga a migrar fixtures, tests y cualquier configuración de ejemplo en la misma pasada.
- Mantener el catálogo de nodos sin añadir `form` reduce riesgo y acota la feature, pero exige que la documentación deje claro que el nuevo shape raíz prepara esa evolución sin implementarla todavía.
- Reutilizar `children` como única colección estructural hoy evita bifurcar el modelo declarativo prematuramente, aunque futuras features de formularios puedan necesitar propiedades adicionales para campos o acciones.
- Evitar un wrapper sintético en render fuerza a adaptar `RuntimePage` y tests existentes, pero preserva el beneficio funcional principal de la feature: múltiples hermanos reales en la raíz.

## Migración o despliegue
- La migración es interna al frontend y no requiere despliegue escalonado ni datos persistidos.
- `src/dev/config.json`, fixtures de tests y ejemplos embebidos en `data-config` deben migrarse al nuevo shape dentro de la misma implementación.
- El cierre de la feature exige que la documentación estable deje de describir `layout` como nodo raíz y lo documente solo como colección.

## Preguntas abiertas resueltas por este diseño
- Compatibilidad temporal con ambos shapes de `layout`:
  No. La migración es estricta y el shape antiguo pasa a error explícito.
- Propiedad de composición compartida:
  Sí. La composición estructural soportada en esta fase sigue usando `children` como colección ordenada.
- Soporte de formularios en esta feature:
  No. La feature solo deja el contrato raíz preparado para que un futuro nodo `form` pueda ser hermano en la raíz sin otra rotura estructural.
