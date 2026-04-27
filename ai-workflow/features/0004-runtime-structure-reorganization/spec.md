# Spec: Runtime structure reorganization

## Objetivo
Reorganizar la estructura interna del runtime para que refleje mejor las responsabilidades ya existentes del producto, reduzca abstracciones redundantes y deje una base clara para ampliar el renderer declarativo, la validación de configuración y futuras capacidades como formularios, eventos y queries, sin cambiar el comportamiento funcional visible que hoy soporta el runtime.

## Alcance
- Reordenar la estructura del código del runtime para separar con más claridad validación, tipos, composición de página y render de nodos soportados.
- Consolidar un renderer central capaz de resolver el catálogo actual de nodos por `type` y delegar cada nodo soportado a una pieza concreta con responsabilidad explícita.
- Separar dentro de `config/` el contrato de tipos y la validación estructural mínima del runtime para que la frontera de entrada quede más legible y extensible.
- Eliminar abstracciones vacías, triviales o redundantes que no aporten encapsulación real al comportamiento actual del runtime.
- Dejar explícita una estructura objetivo suficientemente clara para el crecimiento inmediato del proyecto, incluyendo el encaje de áreas futuras como eventos, validaciones adicionales o utilidades compartidas, sin obligar a materializar subsistemas todavía no usados.
- Mantener intacto el contrato funcional actual del JSON, la resolución de `initialPage`, el catálogo estable de nodos soportados y la semántica de errores ya documentada.

## Fuera de alcance
- Introducir nuevos nodos de layout o ampliar el catálogo visual soportado.
- Cambiar el shape funcional de `api`, `pages`, `initialPage` o `pages[].layout`.
- Añadir navegación interna, formularios funcionales, queries ejecutables, `preloads` o resolución de referencias dinámicas.
- Crear carpetas, capas o componentes ceremoniales que no tengan uso real en el estado actual del runtime.
- Rediseñar la experiencia visual, los estilos base o la semántica visible de los bloques ya soportados.
- Convertir esta feature en una reescritura completa del runtime ni en una reorganización genérica sin criterio de responsabilidad comprobable.

## Requisitos funcionales
- El runtime debe seguir validando toda la configuración antes de renderizar.
- El runtime debe seguir resolviendo la página inicial a partir de `initialPage` y renderizar únicamente la página seleccionada.
- El renderer debe seguir soportando exactamente los nodos documentados hoy: `container`, `heading`, `paragraph` y `list`.
- El render de una página válida debe conservar el mismo resultado visible antes y después de la reorganización, incluida la posibilidad de renderizar varios bloques hermanos en la raíz de `layout`.
- La validación debe seguir rechazando configuraciones inválidas con el mismo criterio funcional actual, incluyendo `initialPage` inexistente, `layout` inválido, shape raíz antiguo basado en objeto y nodos no soportados.
- El comportamiento de errores entre desarrollo y producción debe mantenerse alineado con el contrato vigente: diagnóstico visible en desarrollo y degradación silenciosa para errores `development-only` en producción.
- La estructura resultante debe dejar explícito qué pieza resuelve cada nodo soportado y cuál actúa como punto central de composición del render declarativo.
- La estructura resultante debe dejar explícita la separación entre definición del contrato de configuración y lógica de validación del runtime.
- Las abstracciones redundantes identificadas durante la reorganización deben eliminarse cuando no cambien el contrato funcional ni oculten comportamiento relevante.

## Requisitos no funcionales
- La reorganización debe mejorar la mantenibilidad del runtime y reducir la concentración excesiva de lógica en archivos únicos.
- La estructura final debe facilitar la incorporación de nuevas capacidades sin volver a mezclar render, validación, tipos y composición en la misma unidad.
- La nueva organización debe seguir siendo deliberadamente austera: debe preparar crecimiento real sin llenar el proyecto de carpetas vacías o fronteras artificiales.
- La intención de cada área principal debe poder entenderse leyendo la estructura del proyecto sin depender de conocimiento histórico implícito.
- La reorganización debe tratarse como un refactor con riesgo medio y planificación explícita, no como un simple movimiento mecánico de archivos.
- La documentación de arquitectura y estado actual debe poder alinearse fácilmente con la nueva organización estable.

## Criterios de aceptación
- Dada una configuración válida que hoy renderiza correctamente una página estática, el runtime sigue renderizando el mismo contenido visible tras la reorganización.
- Dada una configuración válida con varios hermanos en `pages[].layout`, el runtime sigue respetando el orden visible actual sin introducir wrappers artificiales.
- Si `initialPage` no existe dentro de `pages`, el runtime sigue fallando con un error explícito.
- Si `layout` usa el shape raíz antiguo basado en objeto o contiene un nodo no soportado, la configuración sigue rechazándose con comportamiento diagnóstico equivalente al actual.
- El código del renderer deja identificable un punto central de resolución `type -> pieza de render` y una pieza concreta para cada nodo soportado hoy.
- El código de `config/` deja identificable la separación entre tipos del contrato y validación estructural del runtime.
- Las abstracciones redundantes incluidas en el alcance dejan de existir o quedan justificadas por una responsabilidad real y visible.
- La estructura objetivo documentada para crecimiento inmediato no obliga a introducir subsistemas completos sin uso actual, pero sí deja claro dónde encajar futuras capacidades cercanas al runtime.

## Casos límite
- La reorganización mueve piezas entre módulos sin cambiar el comportamiento, pero una dependencia implícita entre archivos antiguos provoca una regresión accidental.
- Un layout válido con `layout: []` debe seguir resolviéndose como página vacía sin inventar contenido.
- Un `container` con `children: []` o sin `children` declarados debe mantener el comportamiento actual.
- Un nodo soportado comparte helpers o utilidades con otros nodos y la separación por responsabilidad no debe duplicar lógica de forma innecesaria.
- La estructura objetivo propone espacio para áreas futuras como eventos o validaciones, pero sin crear una jerarquía tan rígida que vuelva costosa la siguiente feature real.

## Riesgos o preguntas abiertas
- Hace falta concretar en `design.md` qué nivel exacto de anidación y nomenclatura debe adoptar la estructura objetivo para equilibrar claridad y austeridad.
- La reorganización afecta varias fronteras a la vez, especialmente renderer, validación e imports de tests, así que la planificación debe separar bien cambios estructurales de cambios puramente mecánicos.
- Sigue abierta la decisión de cuánto de la estructura futura debe materializarse ya en código y cuánto debe quedar solo documentado para evitar carpetas ceremoniales.
- La feature no cambia producto visible, pero sí altera una base temprana del runtime; la planificación debe tratar explícitamente el riesgo de regresión y la actualización de documentación estable.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración en su frontera de validación
- Arquitectura interna del runtime
- Preparación estructural para futuras capacidades declarativas

## Documentación probablemente afectada
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
