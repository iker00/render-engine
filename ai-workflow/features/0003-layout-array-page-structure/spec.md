# Spec: Layout array page structure

## Objetivo
Modificar el contrato funcional de las páginas para que `layout` deje de ser un nodo raíz con `type` propio y pase a ser un array ordenado de elementos declarativos. Cada elemento del array puede ser un componente básico, un contenedor o un formulario, y los elementos que actúen como composición pueden seguir anidando otros elementos dentro.

## Alcance
- Cambiar el shape funcional de `pages[].layout` para que sea un array de elementos en lugar de un único nodo raíz.
- Mantener `pages` e `initialPage` como marco de organización de páginas del runtime.
- Permitir que el array de `layout` combine elementos heterogéneos dentro de la misma página.
- Mantener la capacidad de anidación dentro de los elementos que actúan como contenedores de otros bloques.
- Alinear el contrato de configuración y la semántica del renderer con la idea de que una página puede empezar con varios bloques hermanos sin exigir un `container` artificial en la raíz.
- Dejar explícito cómo debe comportarse el runtime ante layouts vacíos, elementos inválidos y combinaciones de elementos no soportadas.

## Fuera de alcance
- Definir todavía navegación entre páginas o cambios en `initialPage`.
- Introducir un sistema de componentes genérico o plugins arbitrarios.
- Diseñar en esta spec el detalle técnico de migración automática de configuraciones existentes.
- Ampliar aquí el comportamiento interactivo completo de formularios, validación de campos, submit o queries.
- Cambiar el modelo global de referencias dinámicas más allá de cómo se inserten los elementos dentro de `layout`.
- Fijar en esta fase un sistema visual nuevo o reglas de estilo avanzadas.

## Requisitos funcionales
- Cada página debe seguir declarando un `id` único y un `layout` obligatorio.
- `layout` debe ser un array ordenado de elementos declarativos de página.
- El orden de los elementos dentro de `layout` debe determinar su orden visible de renderizado.
- `layout` ya no debe exigir un nodo raíz con `type: container` ni ningún otro tipo raíz artificial.
- Cada elemento incluido en `layout` debe seguir un contrato declarativo consistente con su propia categoría funcional.
- El array raíz debe admitir al menos tres categorías de elementos:
  - componentes básicos de contenido
  - contenedores estructurales
  - formularios
- Los componentes básicos deben seguir representando bloques hoja de contenido y no deben requerir un wrapper estructural adicional para aparecer en la página.
- Los contenedores deben poder agrupar elementos hijos para construir composición interna dentro de la página.
- Los formularios deben poder aparecer como elementos de primer nivel dentro de `layout` y también dentro de otros elementos que admitan composición, siempre que esa combinación forme parte del catálogo soportado por el runtime.
- Los elementos que soporten anidación deben declarar sus hijos de forma explícita y ordenada, manteniendo el mismo modelo declarativo general que use la página para componer bloques.
- El runtime debe validar `layout` como colección y no como nodo único.
- Si `layout` no es un array válido, el arranque debe fallar con un error explícito de configuración.
- Si un elemento del array raíz o de un nivel anidado usa un tipo no soportado, el runtime debe tratarlo como error de configuración y no reinterpretarlo silenciosamente.
- El runtime debe poder renderizar una página válida cuyo `layout` contenga varios elementos hermanos en la raíz sin introducir un contenedor visual inventado solo para satisfacer el contrato anterior.
- Un `layout` vacío debe considerarse válido si el contrato de la página lo permite, y en ese caso la página debe resolverse sin contenido inventado ni errores falsos.
- Las páginas existentes deben migrarse a la nueva forma de `layout` de manera explícita y coherente, sin dejar una coexistencia ambigua de dos contratos raíz distintos dentro de la misma versión funcional estable.

## Requisitos no funcionales
- El nuevo contrato debe simplificar la configuración de páginas simples y evitar wrappers estructurales innecesarios.
- La evolución debe seguir siendo deliberadamente acotada y no convertir el runtime en un motor UI completamente genérico.
- El cambio debe dejar un camino claro para futuras features de formularios y composición sin volver a romper la estructura raíz de la página.
- La validación de configuración debe seguir priorizando mensajes diagnósticos claros en desarrollo y degradación controlada en producción.
- La documentación funcional del contrato JSON debe quedar alineada con la nueva semántica de `layout` como colección.
- La planificación posterior debe tratar explícitamente el riesgo de regresión sobre configuraciones y tests que hoy asumen un único nodo raíz.

## Criterios de aceptación
- Dada una página válida con `layout` como array de varios elementos básicos hermanos, el runtime renderiza esos bloques en el mismo orden en que aparecen en la configuración.
- Dada una página válida con `layout` que combina componentes básicos y contenedores, el runtime interpreta correctamente los elementos raíz y la composición interna de los contenedores.
- Dada una página válida cuyo `layout` incluye un formulario en una posición permitida por el catálogo soportado, el runtime acepta su presencia dentro del árbol declarativo sin exigir un wrapper raíz especial.
- Si `layout` se declara como objeto en lugar de array, la configuración se rechaza con un error explícito.
- Si un elemento del array raíz es inválido o usa un tipo no soportado, la configuración falla de forma explícita y diagnóstica.
- Dada una página válida con `layout: []`, el runtime resuelve la página sin renderizar contenido inventado ni producir un error por ausencia de nodo raíz.
- La versión estable del contrato no deja dudas entre dos modelos distintos de raíz de página: `layout` se documenta y valida solo como array.
- Una configuración migrada al nuevo contrato sigue pudiendo expresar anidación interna de bloques sin perder la capacidad ya existente de composición estructural.

## Casos límite
- `layout` es un array vacío.
- `layout` contiene un único elemento básico sin contenedor envolvente.
- `layout` mezcla varios elementos hermanos y uno de ellos es inválido.
- Un contenedor válido tiene hijos vacíos.
- Un formulario aparece como primer elemento de la página.
- Una página migrada desde el contrato anterior tenía un único `container` raíz y ahora ese contenedor pasa a ser un elemento más dentro del array.
- La configuración intenta mezclar en producción páginas antiguas con `layout` como objeto y páginas nuevas con `layout` como array.

## Riesgos o preguntas abiertas
- Hace falta concretar en planificación si la transición aceptará temporalmente ambos shapes de `layout` durante desarrollo o si el cambio será estricto desde el primer momento.
- La categoría "formularios" ya está reconocida a nivel funcional, pero su shape exacto dentro del árbol y sus reglas de composición deben alinearse con la futura feature de formularios para no duplicar contratos.
- Queda por decidir si todos los elementos con hijos deben reutilizar el mismo nombre de propiedad para su composición o si algunos bloques, como formularios, necesitan una estructura hija especializada.
- Cambiar el contrato raíz de `layout` afecta validación, renderer, fixtures de desarrollo y tests existentes, así que la planificación debe tratarlo como una migración de contrato y no como un ajuste local.

## Áreas de producto afectadas
- Contrato de configuración
- Runtime UI configurable
- Modelo de páginas renderizables
- Futuro encaje de formularios en el árbol declarativo

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/current-state.md`
