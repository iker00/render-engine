# Queries y feedback

## Objetivo
Coordinar llamadas API declaradas y exponer su estado para que la UI pueda reaccionar con carga, error, vacío o éxito.

## Modelo de estado
Cada query expone en v1:
- `status`: `idle | loading | success | error`
- `data`
- `error`

En el estado implementado hoy:
- las queries viven en `queries.{queryName}` dentro del store compartido por instancia
- una recarga puede pasar a `loading` conservando el último `data` válido
- el error se guarda con shape estable orientado a UI (`message` y `code` opcional)
- un cambio de página no limpia por defecto el estado de queries

## Ejecución de endpoints
- Los endpoints se declaran en `api` y se invocan por nombre.
- `GET` usa query string.
- `POST`, `PUT`, `PATCH` y `DELETE` permiten body JSON.
- Una acción puede llamar a uno o varios endpoints.

La infraestructura de estado ya está preparada para recibir resultados compartidos, pero la ejecución real de endpoints sigue pendiente.

## Precargas
- Las precargas se declaran a nivel de página.
- Se ejecutan al entrar en la página.
- La página puede depender de esos datos para mostrar su layout o bloques concretos.

Todavía no existe ejecución real de `preloads`; esta sección describe el contrato funcional objetivo, no una capacidad ya activa.

## Refetch y acciones mutadoras
- Algunas acciones pueden necesitar relanzar queries después de éxito.
- Caso típico: borrar un item y recargar el listado.
- La intención funcional es soportar este patrón sin exigir lógica imperativa dispersa.

La base de estado para ese patrón ya existe mediante transiciones controladas del store compartido, pero todavía no hay acciones declarativas finales ni red real conectada.

## Feedback visual
- El layout puede definir explícitamente qué mostrar en `loading`, `error` y estado vacío.
- Si no lo define, el runtime debe ofrecer un fallback genérico razonable.
- La UI no debe romperse por un error local recuperable.

Hoy solo está consolidado el almacenamiento del estado de feedback dentro del runtime; la representación visual declarativa de esos estados sigue pendiente.

## Casos funcionales previstos
- mostrar spinner o placeholder mientras carga una query
- mostrar mensaje de error de servidor
- mostrar mensaje de “sin resultados”
- ocultar bloques hasta que exista un resultado o un estado concreto
