> Cuándo leer: estructura de `pages`, contrato de `id` y `layout` por página, comportamiento de `initialPage`.
> Tamaño: corto.
> Relacionados: [[hash-navigation.md]], [[../config/structure.md]].

# Modelo de páginas

## Modelo
- La configuración declara varias páginas en `pages`.
- Cada página tiene un `id` único.
- Cada página contiene su propio `layout` como colección ordenada de bloques.
- En la capacidad actualmente implementada, el runtime valida todas las páginas declaradas y resuelve la visible desde estado interno compartido.
- La página seleccionada puede empezar por varios bloques hermanos sin `container` raíz artificial.

## Página inicial
- La configuración declara `initialPage`.
- El runtime entra en esa página al arrancar.
- Si la página inicial declara `preloads`, el runtime dispara automáticamente esa tanda al montar la instancia.
- Si `initialPage` no coincide con ningún `id`, el arranque falla con un error claro.
