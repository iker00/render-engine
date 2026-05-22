# Design: Client-side collection pagination

## Decisiones funcionales de interacción
- La primera versión usa paginación en cliente sobre la colección completa ya cargada por la query.
- El cambio de página no dispara red ni modifica la query origen.
- Los controles visibles iniciales son anterior, siguiente y un indicador de página.
- La página activa se mantiene de forma independiente por cada consumidor paginado.
- La página activa se reinicia a la primera página cuando cambia la colección origen o el tamaño de página efectivo.
- Si la colección no tiene suficientes elementos para más de una página, los controles no deben ofrecer acciones inútiles.
- `repeater` es el primer consumidor de la capacidad, pero la semántica debe poder reutilizarse en `table` sin rediseñar el modelo.

## Contrato esperado a cerrar en planificación
La planificación cierra el shape exacto de v1 para `repeater`:

```json
{
  "type": "repeater",
  "props": {
    "items": {
      "source": "queries.posts.data.results",
      "key": "id"
    },
    "pagination": {
      "enabled": true,
      "pageSize": 10,
      "controls": {
        "variant": "previousNext"
      }
    },
    "template": []
  }
}
```

Reglas del contrato v1:
- `props.pagination` es opcional; si no existe, el `repeater` conserva exactamente su comportamiento actual.
- Si `props.pagination` existe, activa paginación en cliente de forma explícita.
- `props.pagination.enabled` debe existir y ser exactamente `true`; v1 no acepta `false` ni objetos de paginación inertes.
- `props.pagination.pageSize` es obligatorio, entero, finito y mayor o igual que `1`.
- `props.pagination.controls` es opcional; si no existe, el runtime usa el default efectivo `{ variant: 'previousNext' }`.
- `props.pagination.controls.variant` solo acepta `previousNext` en v1.
- Las claves no soportadas dentro de `props.pagination` o `props.pagination.controls` se rechazan como excepción acotada a la política general de descarte de extras, porque en esta superficie podrían simular paginación remota, cursores o variantes de controles todavía no soportadas.
- La ausencia de `props.pagination` es el único modo soportado para no paginar.

Para `table`, una futura iteración debería poder reutilizar el vocabulario funcional `pagination.enabled`, `pagination.pageSize` y `pagination.controls.variant`, aunque la ubicación exacta dentro de `table.props` se cerrará cuando se implemente esa integración.

El contrato no debe introducir todavía:
- metadatos remotos
- cursores
- URLs nuevas
- selector de tamaño
- números de página
- infinite scroll

## Estado visible
- Primera página: anterior no accionable; siguiente accionable si hay más páginas.
- Página intermedia: anterior y siguiente accionables.
- Última página: siguiente no accionable; anterior accionable si hay páginas previas.
- Colección vacía o no disponible: sin items visibles y sin controles accionables.
- Colección con una sola página efectiva: se renderizan los items y no se muestran controles de paginación porque no existe navegación útil.
- En `repeater`, la paginación visible se aplica sobre las iteraciones renderizables tras conservar la política actual de key: los items con key ausente, no escalar o duplicada se omiten con el mismo diagnóstico de desarrollo, no cuentan para `totalItems` ni generan páginas fantasma.
- Si el `repeater` paginado vive dentro de un grid efectivo, el bloque de controles es el único markup propio añadido por la paginación y debe ocupar una fila completa para no mezclarse como una tarjeta o celda más del template repetido.

## Estado local y caché
- La página activa vive en estado local del consumidor paginado, no en el dominio compartido de queries ni en la URL.
- Cada instancia renderizada de un consumidor paginado mantiene su propia página activa, incluso si varias instancias leen la misma query.
- El cambio de página no modifica `queries.*`, `pageEntry`, `forms.*` ni navegación.
- Cuando cambia la referencia de colección resuelta o el tamaño de página efectivo, la página activa vuelve a la primera página.
- La caché de v1 se modela como un resultado derivado por referencia de colección y `pageSize`: mientras esos dos inputs no cambien, la navegación entre páginas reutiliza páginas ya materializadas o un índice equivalente y no vuelve a cortar la colección en cada transición.
- La caché no forma parte del JSON normalizado ni del estado compartido serializable del runtime.
- La preparación específica de `repeater` puede filtrar keys inválidas o duplicadas antes de llamar a la utilidad reusable; esa normalización no debe entrar en el helper común de paginación porque pertenece a la semántica del consumidor.

## Extensibilidad reservada
La capacidad debe dejar espacio para futuras variantes, pero sin implementarlas:
- integración en `table`
- números de página
- salto a página
- infinite scroll
- paginación remota con metadatos de backend
- paginación remota por cursor o por página

La v1 no debe simular ninguno de esos modelos con campos ambiguos.

## Riesgos de diseño
- Si el contrato de v1 se diseña como una API visual demasiado cerrada, puede dificultar añadir otros modos de control después.
- Si el contrato o la implementación se acoplan al `template` de `repeater`, la futura paginación de `table` acabará duplicando lógica.
- Si el estado de página se acopla al estado de query, varios consumidores sobre la misma query podrían interferirse.
- Si la caché se basa solo en longitud de colección, puede mostrar páginas obsoletas cuando cambian los items sin cambiar el tamaño del array.
