# Queries y feedback

## Objetivo
Coordinar llamadas API declaradas y exponer su estado para que la UI pueda reaccionar con carga, error, vacío o éxito.

## Modelo de estado
Cada query expone en v1:
- `status`: `idle | loading | success | error`
- `data`
- `error`

## Ejecución de endpoints
- Los endpoints se declaran en `api` y se invocan por nombre.
- `GET` usa query string.
- `POST`, `PUT`, `PATCH` y `DELETE` permiten body JSON.
- Una acción puede llamar a uno o varios endpoints.

## Precargas
- Las precargas se declaran a nivel de página.
- Se ejecutan al entrar en la página.
- La página puede depender de esos datos para mostrar su layout o bloques concretos.

## Refetch y acciones mutadoras
- Algunas acciones pueden necesitar relanzar queries después de éxito.
- Caso típico: borrar un item y recargar el listado.
- La intención funcional es soportar este patrón sin exigir lógica imperativa dispersa.

## Feedback visual
- El layout puede definir explícitamente qué mostrar en `loading`, `error` y estado vacío.
- Si no lo define, el runtime debe ofrecer un fallback genérico razonable.
- La UI no debe romperse por un error local recuperable.

## Casos funcionales previstos
- mostrar spinner o placeholder mientras carga una query
- mostrar mensaje de error de servidor
- mostrar mensaje de “sin resultados”
- ocultar bloques hasta que exista un resultado o un estado concreto
