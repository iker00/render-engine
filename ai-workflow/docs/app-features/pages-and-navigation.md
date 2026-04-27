# Páginas y navegación

## Objetivo
Permitir flujos multipágina dentro del runtime sin cambiar la URL del navegador.

## Modelo de páginas
- La configuración declara varias páginas en `pages`.
- Cada página tiene un `id` único.
- Cada página contiene su propio `layout`.
- Cada página puede declarar `preloads` para cargar datos al activarse.

## Página inicial
- La configuración declara `initialPage`.
- El runtime entra en esa página al arrancar.

## Navegación soportada en v1
Acciones soportadas:
- `navigateTo`
- `goBack`

## Route params
- `navigateTo` puede pasar `routeParams` a la página destino.
- La página destino puede leer esos valores para renderizado, params de endpoints o valores por defecto de formulario.

## Casos de uso objetivo
- búsqueda a listado
- listado a detalle
- detalle a edición
- volver a la página anterior sin depender del navegador

## Límites de v1
- la URL del navegador no cambia
- no hay deep links
- no hay sincronización con historial externo del navegador
