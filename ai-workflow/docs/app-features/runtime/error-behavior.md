> Cuándo leer: comportamiento del runtime ante config inválido, hash inválido, página inexistente, errores `development-only`, degradación visible.
> Tamaño: corto.
> Relacionados: [[../config/validation.md]], [[../navigation/hash-navigation.md]].

# Comportamiento de errores

## Errores de configuración
- Si `initialPage` no coincide con ninguna página declarada, el runtime muestra un error visible.
- Si un botón `navigateTo` apunta a una página inexistente, el runtime rechaza el config antes del render con una ruta diagnóstica del árbol afectado.
- Si el `layout` es inválido, usa el shape raíz antiguo basado en objeto o aparece un nodo no soportado, en desarrollo se muestra un error diagnóstico.
- Los errores estructurales mantienen los códigos públicos actuales y mejoran la trazabilidad con rutas canónicas del JSON cuando el fallo depende de una rama concreta.

## Errores de navegación
- Si el navegador entra con un hash inválido o con un slug de página inexistente, el runtime degrada a `initialPage` y reescribe la URL a `#/`.

## Política de visibilidad de errores
- En desarrollo, los errores de configuración deben ser diagnósticos y visibles.
- En producción, los errores marcados como `development-only` degradan sin mostrar mensaje genérico visible.
- En producción, los errores `development-only` degradan a una superficie vacía en lugar de mostrar un mensaje genérico o inventar contenido.
