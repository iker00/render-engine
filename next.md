## Hardening final de v1

Cerrar la primera versión con pruebas de integración de flujos reales, revisión de cobertura, consolidación documental y
limpieza de APIs internas, dejando una base estable antes de ampliar alcance funcional.

# General

- Permitir strings dinámicos en `text` y `labels`. Ejemplo: `"Nombre del usuario: {item.username}"`. 

## checkboxGroup y radioGroup:

## container

- Opción para que los elementos hijos tengan un ancho determinado. Es decir, si se especifica, los elementos hijos
  tendrán ese ancho, sino se ajustarán al contenido.
- Soporte responsive declarativo para `columns`: permitir un valor fijo o un mapa por breakpoint para que un
  `container` con varias columnas pueda colapsar en móvil, por ejemplo de 4 a 2 o 1 columnas según la configuración.
- Soporte responsive declarativo para `span` en cualquier nodo hijo: permitir un valor fijo o un mapa por breakpoint
  para controlar cuántas columnas ocupa cada nodo dentro de un `container` con `columns`.

## Tablas

- Añadir filtros, ordenación y paginación en las tablas

## Repeatable

- Añadir paginación

## Forms

