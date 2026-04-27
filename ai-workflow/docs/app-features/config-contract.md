# Contrato de configuración

## Objetivo
Definir la estructura funcional del JSON que el runtime interpreta.

## Estructura de v1
La configuración parte de tres bloques principales:
- `api`: catálogo de endpoints reutilizables
- `pages`: páginas navegables del runtime
- `initialPage`: identificador de la página de entrada

## Endpoints declarados
La sección `api` declara operaciones reutilizables por nombre.

Cada endpoint puede incluir:
- `endpoint`
- `method`
- `headers`
- `params` para query string cuando aplica
- `body` o payload JSON cuando aplica

## Referencias dinámicas
Los valores dinámicos se expresan como strings por convención, por ejemplo:
- `forms.userSearch.name`
- `queries.searchUsers.data`
- `item.id`
- `routeParams.userId`
- `params.id`

Esta decisión prioriza compatibilidad con el backend legacy frente a un contrato más tipado.

## Validación
- La configuración debe validarse antes de renderizarse.
- La validación debe comprobar estructura general, tipos soportados y formas básicas esperadas.
- En desarrollo, los errores de configuración deben ser diagnósticos y visibles.
- En producción, los errores deben degradar de forma controlada cuando sea posible.

## Límites de v1
- No hay lenguaje abierto de plantillas.
- No hay interpolación compleja dentro de strings.
- No hay sistema de plugins para componentes externos.
